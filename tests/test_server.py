from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from mkp_python.models import LogLength, MKPVersion, SerialPortStatus
from mkp_python.server import APIState, MacroRecord, Settings, _issue_token, create_app


class FakeSerialPort:
    def __init__(self) -> None:
        self.sync_output_enabled = True
        self.sync_output_timeout = 0.0
        self.replay_calls: list[tuple[str, int]] = []
        self.closed = False
        self.open_calls = 0
        self.start_read_loop_calls = 0
        self.reset_input_buffer_calls = 0
        self.stop_recording_calls = 0
        self.status = SerialPortStatus(
            name="COM_TEST",
            port_open=True,
            read_closed=False,
            read_loop_running=True,
            sync_output_enabled=True,
            sync_output_timeout_ms=10000,
            current_sync_directive="",
            sync_output_ignored=False,
            async_marked=False,
            last_read_at=None,
            last_read_error=None,
            last_read_error_at=None,
        )

    def open(self) -> None:
        self.open_calls += 1

    def reset_input_buffer(self) -> None:
        self.reset_input_buffer_calls += 1

    def start_read_loop(self) -> None:
        self.start_read_loop_calls += 1

    def stop_recording(self) -> None:
        self.stop_recording_calls += 1

    def snapshot_status(self) -> SerialPortStatus:
        return self.status

    def start_replaying(self, log_name: str, delay: int) -> None:
        self.replay_calls.append((log_name, delay))

    def close(self) -> None:
        self.closed = True


class FakeController:
    def __init__(self, sfport: FakeSerialPort) -> None:
        self.sfport = sfport
        self.move_calls: list[tuple[int, int]] = []
        self.delete_calls: list[tuple[str, float | None]] = []
        self.alog_calls: list[tuple[str, object, float | None]] = []
        self.cancel_calls: list[float | None] = []
        self.astop_calls: list[float | None] = []

    def compose_log_fullpath(self, log_path: str) -> str:
        return f"/eMMC/applog/{log_path}.log"

    def move_cursor(self, x: int, y: int) -> None:
        self.move_calls.append((x, y))

    def alog(self, log_name: str, opt=None, timeout: float | None = None) -> str:
        self.alog_calls.append((log_name, opt, timeout))
        return "started"

    def astop(self, timeout: float | None = None) -> str:
        self.astop_calls.append(timeout)
        return "stopped"

    def atime(self, path: str, timeout: float | None = None) -> LogLength:
        return LogLength(seconds=1, milsec=250)

    def aversion(self, timeout: float | None = None) -> MKPVersion:
        return MKPVersion(uver="u-test", aver="a-test")

    def delete_file(self, path: str, timeout: float | None = None) -> str:
        self.delete_calls.append((path, timeout))
        return "deleted"

    def cancel(self, timeout: float | None = None):
        self.cancel_calls.append(timeout)
        return {"ok": True}


def make_settings(**overrides) -> Settings:
    data = {
        "mode": "release",
        "sf_port": "COM_TEST",
        "port": 8080,
        "jwt_secret": "0123456789abcdef0123456789abcdef",
        "user": "admin",
        "password": "admin123",
        "issuer": "mkp-go-server",
        "token_ttl_seconds": 86400,
        "mute_auth_in_debug": False,
        "database_url": "sqlite+pysqlite:///:memory:",
        "sync_directive_timeout_ms": 10000,
        "async_directive_timeout_ms": 3000,
        "db_timeout_ms": 5000,
        "replay_completion_grace_ms": 1500,
        "replay_minimum_duration_ms": 1000,
    }
    data.update(overrides)
    return Settings(**data)


def make_state(settings: Settings | None = None) -> APIState:
    settings = settings or make_settings()
    sfport = FakeSerialPort()
    ctrl = FakeController(sfport)
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    return APIState(settings=settings, sfport=sfport, ctrl=ctrl, engine=engine, initialize_serial=False)


def auth_header(settings: Settings) -> dict[str, str]:
    token, _ = _issue_token(settings, settings.user)
    return {"Authorization": f"Bearer {token}"}


def insert_record(state: APIState, unique_id: str = "rid-1") -> MacroRecord:
    record = MacroRecord(
        name="demo",
        unique_id=unique_id,
        mkp_path=f"/eMMC/applog/{unique_id}.log",
        start_point_x=11,
        start_point_y=22,
        screen_width=1920,
        screen_height=1080,
        os="windows",
        seconds=1,
        milliseconds=250,
    )
    with state.SessionLocal() as db:
        db.add(record)
        db.commit()
        db.refresh(record)
    return record


def test_health_and_replay_status_match_go_shape() -> None:
    state = make_state()
    state.alog_running = True
    state.alog_started = True
    state.current_alog_id = "alog-1"
    now = datetime.now(UTC)
    state.replay_running = True
    state.current_replay_id = "rid-1"
    state.replay_started_at = now - timedelta(milliseconds=500)
    state.replay_done_at = now + timedelta(milliseconds=1500)
    state.replay_release_at = now + timedelta(seconds=2)

    with TestClient(create_app(settings=state.settings, state=state)) as client:
        health = client.get("/health")
        assert health.status_code == 200
        body = health.json()
        assert body["ready"] is True
        assert body["alog"]["current_id"] == "alog-1"
        assert body["replay"]["current_id"] == "rid-1"
        assert body["replay"]["active"] is True
        assert body["replay"]["retry_after_seconds"] >= 1

        replay = client.get("/api/v1/directives/replay/status", headers=auth_header(state.settings))
        assert replay.status_code == 200
        replay_body = replay.json()
        assert replay_body["directive"] == "replay_status"
        assert replay_body["replay"]["current_id"] == "rid-1"
        assert replay_body["replay"]["active"] is True


def test_auth_errors_use_error_key() -> None:
    state = make_state()
    with TestClient(create_app(settings=state.settings, state=state)) as client:
        response = client.get("/api/v1/directives/replay/status")
        assert response.status_code == 401
        assert response.json() == {"ok": False, "error": "missing Authorization header"}


def test_debug_mode_can_mute_auth() -> None:
    settings = make_settings(mode="debug", mute_auth_in_debug=True)
    state = make_state(settings)
    with TestClient(create_app(settings=settings, state=state)) as client:
        response = client.get("/api/v1/directives/replay/status")
        assert response.status_code == 200
        assert response.json()["ok"] is True


def test_delete_record_blocks_while_same_record_replaying() -> None:
    state = make_state()
    insert_record(state, "rid-del")
    state.replay_running = True
    state.current_replay_id = "rid-del"
    state.replay_release_at = datetime.now(UTC) + timedelta(seconds=2)

    with TestClient(create_app(settings=state.settings, state=state)) as client:
        response = client.delete("/api/v1/directives/records/rid-del", headers=auth_header(state.settings))
        assert response.status_code == 409
        body = response.json()
        assert body["ok"] is False
        assert body["error"] == "record is currently being replayed"
        assert body["retry_after_seconds"] >= 1


def test_aplay_conflict_includes_retry_window() -> None:
    state = make_state()
    insert_record(state, "rid-one")
    insert_record(state, "rid-two")
    now = datetime.now(UTC)
    state.replay_running = True
    state.current_replay_id = "rid-one"
    state.replay_done_at = now + timedelta(milliseconds=900)
    state.replay_release_at = now + timedelta(seconds=2)

    with TestClient(create_app(settings=state.settings, state=state)) as client:
        response = client.post("/api/v1/directives/aplay/rid-two", headers=auth_header(state.settings))
        assert response.status_code == 409
        body = response.json()
        assert body["ok"] is False
        assert body["error"] == "replay is already running"
        assert body["retry_after_seconds"] >= 1
        assert body["estimated_done_at"] is not None
        assert body["release_after"] is not None


def test_version_payload_matches_go_contract() -> None:
    state = make_state()
    with TestClient(create_app(settings=state.settings, state=state)) as client:
        response = client.get("/api/v1/version")
        assert response.status_code == 200
        assert response.json() == {
            "ok": True,
            "directive": "version",
            "mkp_server": "0.1.0",
            "mkp_device": {"uver": "u-test", "aver": "a-test"},
        }



def test_api_state_initialization_resets_serial_input_buffer() -> None:
    settings = make_settings()
    sfport = FakeSerialPort()
    state = APIState(settings=settings, sfport=sfport, initialize_serial=True)
    assert state.sfport is sfport
    assert sfport.open_calls == 1
    assert sfport.reset_input_buffer_calls == 1
    assert sfport.start_read_loop_calls == 1
    assert sfport.stop_recording_calls == 1
