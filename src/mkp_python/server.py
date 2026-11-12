from __future__ import annotations

import os
import platform
import threading
import uuid
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
import time
from typing import Generator

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .models import LogLength, LogOption, MKPVersion
from .sdk import Controller, check_sf_serial_port, new_sf_serial_port

APP_VERSION = "0.1.0"
SERIAL_SYNC_TIMEOUT_GRACE_MS = 2000


class Base(DeclarativeBase):
    pass


class MacroRecord(Base):
    __tablename__ = "macro_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    unique_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    mkp_path: Mapped[str] = mapped_column(String(512), nullable=False)
    start_point_x: Mapped[int] = mapped_column(Integer, default=0)
    start_point_y: Mapped[int] = mapped_column(Integer, default=0)
    screen_width: Mapped[int] = mapped_column(Integer, default=0)
    screen_height: Mapped[int] = mapped_column(Integer, default=0)
    os: Mapped[str] = mapped_column(String(64), nullable=False)
    seconds: Mapped[int] = mapped_column(Integer, default=0)
    milliseconds: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "unique_id": self.unique_id,
            "mkp_path": self.mkp_path,
            "start_point_x": self.start_point_x,
            "start_point_y": self.start_point_y,
            "screen_width": self.screen_width,
            "screen_height": self.screen_height,
            "os": self.os,
            "seconds": self.seconds,
            "milliseconds": self.milliseconds,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


@dataclass(slots=True)
class Settings:
    mode: str
    sf_port: str
    port: int
    jwt_secret: str
    user: str
    password: str
    issuer: str
    token_ttl_seconds: int
    mute_auth_in_debug: bool
    database_url: str
    sync_directive_timeout_ms: int
    async_directive_timeout_ms: int
    db_timeout_ms: int
    replay_completion_grace_ms: int
    replay_minimum_duration_ms: int


@dataclass(slots=True)
class AlogSession:
    name: str
    unique_id: str
    mkp_path: str
    start_point_x: int
    start_point_y: int
    screen_width: int
    screen_height: int
    os: str


class TokenRequest(BaseModel):
    username: str
    password: str


class AlogRequest(BaseModel):
    log_name: str = Field(alias="log_name")
    width: int = 0
    height: int = 0
    stposx: int | None = None
    stposy: int | None = None

    def log_option(self) -> LogOption | None:
        has_option = self.width > 0 or self.height > 0 or self.stposx is not None or self.stposy is not None
        if not has_option:
            return None
        return LogOption(
            width=self.width if self.width > 0 else 0,
            height=self.height if self.height > 0 else 0,
            stposx=self.stposx if self.stposx is not None else -1,
            stposy=self.stposy if self.stposy is not None else -1,
        )


class APIState:
    def __init__(self, settings: Settings, sfport=None, ctrl: Controller | None = None, engine=None, initialize_serial: bool = True) -> None:
        self.settings = settings
        self.sfport = sfport
        if self.sfport is None:
            port_name = settings.sf_port or check_sf_serial_port()
            self.sfport = new_sf_serial_port()
            self.sfport.name = port_name
        self.sfport.sync_output_enabled = True
        self.sfport.sync_output_timeout = settings.sync_directive_timeout_ms / 1000.0
        if initialize_serial:
            self.sfport.open()
            time.sleep(0.05)
            self.sfport.reset_input_buffer()
            self.sfport.start_read_loop()
            try:
                self.sfport.stop_recording()
            except Exception:
                pass
        self.ctrl = ctrl or Controller(self.sfport)
        self.engine = engine or create_engine(settings.database_url, future=True)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(self.engine, expire_on_commit=False, future=True)
        self.alog_lock = threading.Lock()
        self.replay_lock = threading.Lock()
        self.alog_running = False
        self.alog_started = False
        self.current_alog_id = ""
        self.current_alog: AlogSession | None = None
        self.replay_running = False
        self.current_replay_id = ""
        self.replay_started_at: datetime | None = None
        self.replay_done_at: datetime | None = None
        self.replay_release_at: datetime | None = None
        self.replay_timer: threading.Timer | None = None

    def db(self) -> Generator[Session, None, None]:
        with self.SessionLocal() as session:
            yield session

    def close(self) -> None:
        with self.replay_lock:
            self.reset_replay_state_locked()
        try:
            self.sfport.close()
        finally:
            self.engine.dispose()

    def replay_window_for_record(self, record: MacroRecord, started_at: datetime) -> tuple[datetime, datetime]:
        duration_ms = max(self.settings.replay_minimum_duration_ms, record.seconds * 1000 + record.milliseconds)
        done_at = started_at + timedelta(milliseconds=duration_ms)
        release_at = done_at + timedelta(milliseconds=self.settings.replay_completion_grace_ms)
        return done_at, release_at

    def reset_replay_state_locked(self) -> None:
        self.replay_running = False
        self.current_replay_id = ""
        self.replay_started_at = None
        self.replay_done_at = None
        self.replay_release_at = None
        if self.replay_timer is not None:
            self.replay_timer.cancel()
            self.replay_timer = None

    def is_replay_blocking_locked(self, now: datetime, record_id: str = "") -> tuple[bool, timedelta]:
        if not self.replay_running:
            return False, timedelta(0)
        if record_id and self.current_replay_id and self.current_replay_id != record_id:
            return False, timedelta(0)
        if self.replay_release_at is not None and now < self.replay_release_at:
            return True, self.replay_release_at - now
        return False, timedelta(0)

    def snapshot_alog_state(self) -> dict[str, object]:
        with self.alog_lock:
            return {
                "running": self.alog_running,
                "started": self.alog_started,
                "current_id": self.current_alog_id,
            }

    def snapshot_replay_state(self) -> dict[str, object]:
        now = datetime.now(UTC)
        with self.replay_lock:
            blocking, retry_after = self.is_replay_blocking_locked(now, "")
            payload: dict[str, object] = {
                "running": self.replay_running,
                "current_id": self.current_replay_id,
                "started_at": self.replay_started_at,
                "estimated_done_at": self.replay_done_at,
                "release_after": self.replay_release_at,
                "active": blocking,
            }
            if retry_after > timedelta(0):
                payload["retry_after_seconds"] = int(retry_after.total_seconds()) + 1
            return payload


def _resolve_run_mode(file_mode: str = "") -> str:
    mode = _first_non_empty(os.getenv("APP_MODE"), os.getenv("RUN_MODE"), os.getenv("GIN_MODE"), os.getenv("MKP_MODE"), file_mode, "release").strip().lower()
    if mode in {"dev", "development", "debug"}:
        return "debug"
    if mode in {"test", "testing"}:
        return "test"
    if mode in {"prod", "production", "release"}:
        return "release"
    return "release"


def _first_non_empty(*values: str) -> str:
    for value in values:
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _parse_positive_int(raw: str | None, default: int) -> int:
    if raw is None or not str(raw).strip():
        return default
    try:
        parsed = int(str(raw).strip())
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def _parse_bool(raw: str | None, default: bool) -> bool:
    if raw is None or not str(raw).strip():
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def _resolve_database_url() -> str:
    if value := _first_non_empty(os.getenv("MKP_DATABASE_URL")):
        return value
    driver = _first_non_empty(os.getenv("DB_DRIVER"), "sqlite3").lower()
    dsn = _first_non_empty(os.getenv("DB_DSN"))
    if not dsn:
        return "sqlite:///mkp.db"
    if "://" in dsn:
        return dsn
    if driver in {"", "sqlited", "sqlite", "sqlite3"}:
        return f"sqlite:///{dsn}"
    return dsn


def load_settings() -> Settings:
    return Settings(
        mode=_resolve_run_mode(),
        sf_port=_first_non_empty(os.getenv("SF_PORT"), os.getenv("MKP_SF_PORT")),
        port=_parse_positive_int(_first_non_empty(os.getenv("PORT"), os.getenv("MKP_PORT"), "8080"), 8080),
        jwt_secret=_first_non_empty(os.getenv("JWT_SECRET"), os.getenv("MKP_JWT_SECRET"), "mkp-go-dev-secret"),
        user=_first_non_empty(os.getenv("JWT_USER"), os.getenv("MKP_USER"), "admin"),
        password=_first_non_empty(os.getenv("JWT_PASSWORD"), os.getenv("MKP_PASSWORD"), "admin123"),
        issuer=_first_non_empty(os.getenv("JWT_ISSUER"), os.getenv("MKP_ISSUER"), "mkp-go-server"),
        token_ttl_seconds=_parse_positive_int(_first_non_empty(os.getenv("JWT_TTL_SECONDS"), os.getenv("MKP_TOKEN_TTL_SECONDS"), "86400"), 86400),
        mute_auth_in_debug=_parse_bool(_first_non_empty(os.getenv("MUTE_JWT_AUTH"), os.getenv("MKP_MUTE_JWT_AUTH")), False),
        database_url=_resolve_database_url(),
        sync_directive_timeout_ms=_parse_positive_int(os.getenv("MKP_SYNC_DIRECTIVE_TIMEOUT_MS"), 10000),
        async_directive_timeout_ms=_parse_positive_int(os.getenv("MKP_ASYNC_DIRECTIVE_TIMEOUT_MS"), 3000),
        db_timeout_ms=_parse_positive_int(os.getenv("MKP_DB_TIMEOUT_MS"), 5000),
        replay_completion_grace_ms=_parse_positive_int(os.getenv("MKP_REPLAY_COMPLETION_GRACE_MS"), 1500),
        replay_minimum_duration_ms=_parse_positive_int(os.getenv("MKP_REPLAY_MIN_DURATION_MS"), 1000),
    )


def _screen_size() -> tuple[int, int]:
    try:
        import ctypes
        return ctypes.windll.user32.GetSystemMetrics(0), ctypes.windll.user32.GetSystemMetrics(1)
    except Exception:
        return 1920, 1080


def _issue_token(settings: Settings, username: str) -> tuple[str, int]:
    now = datetime.now(UTC)
    expires_in = settings.token_ttl_seconds
    payload = {
        "username": username,
        "sub": username,
        "iss": settings.issuer,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256"), expires_in


def _api_error(status_code: int, message: str) -> None:
    raise HTTPException(status_code=status_code, detail=message)


def get_state(request: Request) -> APIState:
    state = getattr(request.app.state, "mkp_state", None)
    if state is None:
        _api_error(500, "application state is not initialized")
    return state


def get_db(state: APIState = Depends(get_state)) -> Generator[Session, None, None]:
    yield from state.db()


def require_auth(request: Request, authorization: str | None = Header(default=None), state: APIState = Depends(get_state)) -> str:
    if state.settings.mute_auth_in_debug and state.settings.mode == "debug":
        return state.settings.user
    if not authorization:
        _api_error(401, "missing Authorization header")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        _api_error(401, "invalid Authorization header format")
    token = parts[1].strip()
    if not token:
        _api_error(401, "missing bearer token")
    try:
        payload = jwt.decode(token, state.settings.jwt_secret, algorithms=["HS256"], issuer=state.settings.issuer)
    except Exception:
        _api_error(401, "invalid or expired token")
    return str(payload.get("username") or payload.get("sub") or "")


def create_app(settings: Settings | None = None, state: APIState | None = None) -> FastAPI:
    effective_settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if getattr(app.state, "mkp_state", None) is None:
            app.state.mkp_state = APIState(app.state.config_settings)
        try:
            yield
        finally:
            current_state = getattr(app.state, "mkp_state", None)
            if current_state is not None:
                current_state.close()
                app.state.mkp_state = None

    app = FastAPI(title="mkp-python", version=APP_VERSION, lifespan=lifespan)
    app.state.config_settings = effective_settings
    app.state.mkp_state = state

    @app.exception_handler(HTTPException)
    async def _http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"ok": False, "error": str(exc.detail)})

    @app.exception_handler(RequestValidationError)
    async def _validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(exc)})

    @app.get("/health")
    def health(state: APIState = Depends(get_state)) -> dict[str, object]:
        serial_snapshot = None
        serial_ready = False
        if state.sfport is not None:
            serial_snapshot = state.sfport.snapshot_status()
            serial_ready = serial_snapshot.port_open and serial_snapshot.read_loop_running and not serial_snapshot.read_closed
        db_ready = state.engine is not None
        ready = serial_ready and db_ready
        return {
            "ok": True,
            "status": "up" if ready else "degraded",
            "ready": ready,
            "db_ready": db_ready,
            "serial": asdict(serial_snapshot) if serial_snapshot is not None else None,
            "alog": state.snapshot_alog_state(),
            "replay": state.snapshot_replay_state(),
        }

    @app.post("/api/v1/auth/token")
    def auth_token(req: TokenRequest, state: APIState = Depends(get_state)) -> dict[str, object]:
        if req.username != state.settings.user or req.password != state.settings.password:
            _api_error(401, "invalid username or password")
        token, expires_in = _issue_token(state.settings, req.username)
        return {"ok": True, "token": token, "token_type": "Bearer", "expires_in": expires_in}

    @app.get("/api/v1/version")
    def version(state: APIState = Depends(get_state)) -> dict[str, object]:
        if state.sfport is None:
            _api_error(500, "serial port is not initialized")
        try:
            mkp_version = state.ctrl.aversion(timeout=(state.settings.sync_directive_timeout_ms + SERIAL_SYNC_TIMEOUT_GRACE_MS) / 1000.0)
        except Exception as exc:
            _api_error(500, str(exc))
        payload = asdict(mkp_version) if isinstance(mkp_version, MKPVersion) else mkp_version
        return {"ok": True, "directive": "version", "mkp_server": APP_VERSION, "mkp_device": payload}

    @app.get("/api/v1/directives/list")
    def list_records(limits: int = Query(default=10), name: str = Query(default=""), _user: str = Depends(require_auth), db: Session = Depends(get_db), state: APIState = Depends(get_state)) -> dict[str, object]:
        if state.engine is None:
            _api_error(500, "database is not initialized")
        limits = max(1, min(10, limits))
        stmt = select(MacroRecord).order_by(MacroRecord.created_at.desc()).limit(limits)
        if name.strip():
            stmt = stmt.where(MacroRecord.name.like(f"%{name.strip()}%"))
        records = db.scalars(stmt).all()
        response: dict[str, object] = {"ok": True, "directive": "list", "limits": limits, "count": len(records), "records": [record.to_dict() for record in records]}
        if name.strip():
            response["name"] = name.strip()
        return response

    @app.get("/api/v1/directives/records/{record_id}")
    def get_record(record_id: str, _user: str = Depends(require_auth), db: Session = Depends(get_db), state: APIState = Depends(get_state)) -> dict[str, object]:
        if state.engine is None:
            _api_error(500, "database is not initialized")
        record_id = record_id.strip()
        if not record_id:
            _api_error(400, "missing record id")
        record = db.scalar(select(MacroRecord).where(MacroRecord.unique_id == record_id))
        if record is None:
            _api_error(404, "record not found")
        return {"ok": True, "directive": "record", "record": record.to_dict()}

    @app.delete("/api/v1/directives/records/{record_id}")
    def remove_record(record_id: str, _user: str = Depends(require_auth), db: Session = Depends(get_db), state: APIState = Depends(get_state)):
        if state.engine is None:
            _api_error(500, "database is not initialized")
        record_id = record_id.strip()
        if not record_id:
            _api_error(400, "missing record id")
        record = db.scalar(select(MacroRecord).where(MacroRecord.unique_id == record_id))
        if record is None:
            _api_error(404, "record not found")
        with state.replay_lock:
            is_blocking, retry_after = state.is_replay_blocking_locked(datetime.now(UTC), record.unique_id)
        if is_blocking:
            payload: dict[str, object] = {"ok": False, "error": "record is currently being replayed"}
            if retry_after > timedelta(0):
                payload["retry_after_seconds"] = int(retry_after.total_seconds()) + 1
            return JSONResponse(status_code=409, content=jsonable_encoder(payload))
        response: dict[str, object] = {"ok": True, "directive": "record_delete", "id": record.unique_id}
        if record.mkp_path:
            try:
                state.ctrl.delete_file(record.mkp_path, timeout=(state.settings.sync_directive_timeout_ms + SERIAL_SYNC_TIMEOUT_GRACE_MS) / 1000.0)
            except Exception as exc:
                _api_error(500, str(exc))
            response["file_deleted"] = True
        db.delete(record)
        db.commit()
        return response

    @app.get("/api/v1/directives/replay/status")
    def replay_status(_user: str = Depends(require_auth), state: APIState = Depends(get_state)) -> dict[str, object]:
        return {"ok": True, "directive": "replay_status", "replay": state.snapshot_replay_state()}

    @app.post("/api/v1/directives/alog")
    def start_alog(req: AlogRequest, _user: str = Depends(require_auth), state: APIState = Depends(get_state)):
        alog_id = uuid.uuid4().hex[:20]
        start_x = req.stposx if req.stposx is not None and req.stposx >= 0 else 0
        start_y = req.stposy if req.stposy is not None and req.stposy >= 0 else 0
        width, height = (req.width, req.height) if req.width > 0 and req.height > 0 else _screen_size()
        session = AlogSession(
            name=req.log_name,
            unique_id=alog_id,
            mkp_path=state.ctrl.compose_log_fullpath(alog_id),
            start_point_x=start_x,
            start_point_y=start_y,
            screen_width=width,
            screen_height=height,
            os=platform.system().lower() or os.name,
        )
        with state.alog_lock:
            if state.alog_running:
                return JSONResponse(status_code=409, content={"ok": False, "error": "alog is already running"})
            state.alog_running = True
            state.alog_started = False
            state.current_alog_id = alog_id
            state.current_alog = session
        try:
            state.ctrl.move_cursor(start_x, start_y)
            state.ctrl.alog(alog_id, LogOption(width=width, height=height, stposx=start_x, stposy=start_y), timeout=(state.settings.sync_directive_timeout_ms + SERIAL_SYNC_TIMEOUT_GRACE_MS) / 1000.0)
        except Exception as exc:
            with state.alog_lock:
                if state.current_alog_id == alog_id:
                    state.alog_running = False
                    state.alog_started = False
                    state.current_alog_id = ""
                    state.current_alog = None
            _api_error(500, str(exc))
        with state.alog_lock:
            if state.current_alog_id == alog_id:
                state.alog_started = True
        return {"ok": True, "directive": "alog", "id": alog_id, "log_name": req.log_name, "status": "started"}

    @app.post("/api/v1/directives/astop")
    def stop_alog(_user: str = Depends(require_auth), db: Session = Depends(get_db), state: APIState = Depends(get_state)) -> dict[str, object]:
        try:
            state.ctrl.astop(timeout=state.settings.async_directive_timeout_ms / 1000.0)
        except Exception as exc:
            _api_error(500, str(exc))
        with state.alog_lock:
            if not state.alog_running:
                return {"ok": True, "directive": "astop", "status": "The stop command has been sent."}
            stopped_id = state.current_alog_id
            stopped_started = state.alog_started
            stopped_session = state.current_alog
            state.alog_running = False
            state.alog_started = False
            state.current_alog_id = ""
            state.current_alog = None
        response: dict[str, object] = {"ok": True, "directive": "astop", "id": stopped_id, "status": "stopped"}
        if stopped_session is not None and stopped_started:
            try:
                length = state.ctrl.atime(stopped_session.mkp_path, timeout=state.settings.db_timeout_ms / 1000.0)
            except Exception:
                length = LogLength()
            try:
                record = MacroRecord(
                    name=stopped_session.name,
                    unique_id=stopped_session.unique_id,
                    mkp_path=stopped_session.mkp_path,
                    start_point_x=stopped_session.start_point_x,
                    start_point_y=stopped_session.start_point_y,
                    screen_width=stopped_session.screen_width,
                    screen_height=stopped_session.screen_height,
                    os=stopped_session.os,
                    seconds=length.seconds,
                    milliseconds=length.milliseconds,
                )
                db.add(record)
                db.commit()
                db.refresh(record)
                response["persisted"] = True
                response["macro_record_id"] = record.id
            except Exception as exc:
                db.rollback()
                response["persisted"] = False
                response["persist_error"] = str(exc)
        elif stopped_session is not None:
            response["persisted"] = False
            response["persist_error"] = "alog session was not fully started"
        else:
            response["persisted"] = False
            response["persist_error"] = "missing alog session state"
        return response

    @app.post("/api/v1/directives/aplay/{record_id}")
    def replay_record(record_id: str, _user: str = Depends(require_auth), db: Session = Depends(get_db), state: APIState = Depends(get_state)):
        if state.engine is None:
            _api_error(500, "database is not initialized")
        with state.replay_lock:
            if state.replay_running:
                blocking, remaining = state.is_replay_blocking_locked(datetime.now(UTC), "")
                if blocking:
                    return JSONResponse(
                        status_code=409,
                        content=jsonable_encoder(
                            {
                                "ok": False,
                                "error": "replay is already running",
                                "retry_after_seconds": int(remaining.total_seconds()) + 1,
                                "estimated_done_at": state.replay_done_at,
                                "release_after": state.replay_release_at,
                            }
                        ),
                    )
                state.reset_replay_state_locked()
        record_id = record_id.strip()
        if not record_id:
            _api_error(400, "missing record id")
        record = db.scalar(select(MacroRecord).where(MacroRecord.unique_id == record_id))
        if record is None:
            _api_error(404, "record not found")
        state.ctrl.move_cursor(record.start_point_x if record.start_point_x >= 0 else 0, record.start_point_y if record.start_point_y >= 0 else 0)
        try:
            state.sfport.start_replaying(record.mkp_path, -1)
        except Exception as exc:
            _api_error(500, str(exc))
        started_at = datetime.now(UTC)
        done_at, release_after = state.replay_window_for_record(record, started_at)
        with state.replay_lock:
            state.replay_running = True
            state.current_replay_id = record.unique_id
            state.replay_started_at = started_at
            state.replay_done_at = done_at
            state.replay_release_at = release_after
            if state.replay_timer is not None:
                state.replay_timer.cancel()
            replay_id = record.unique_id
            delay_seconds = max((release_after - datetime.now(UTC)).total_seconds(), 0.0)
            state.replay_timer = threading.Timer(delay_seconds, _release_replay_state, args=(state, replay_id))
            state.replay_timer.daemon = True
            state.replay_timer.start()
        return {"ok": True, "directive": "aplay", "id": record.unique_id, "mkp_path": record.mkp_path, "status": "started", "estimated_done_at": done_at, "release_after": release_after}

    @app.post("/api/v1/directives/acancel")
    def cancel_record(_user: str = Depends(require_auth), state: APIState = Depends(get_state)) -> dict[str, object]:
        try:
            state.ctrl.cancel(timeout=state.settings.async_directive_timeout_ms / 1000.0)
        except Exception as exc:
            _api_error(500, str(exc))
        with state.replay_lock:
            replay_id = state.current_replay_id
            was_running = state.replay_running
            state.reset_replay_state_locked()
        return {"ok": True, "directive": "acancel", "id": replay_id, "was_running": was_running, "status": "cancel_sent"}

    return app


def _release_replay_state(state: APIState, replay_id: str) -> None:
    with state.replay_lock:
        if state.current_replay_id == replay_id:
            state.reset_replay_state_locked()


app = create_app()


def main() -> None:
    import uvicorn

    settings = load_settings()
    uvicorn.run(create_app(settings=settings), host="0.0.0.0", port=settings.port)
