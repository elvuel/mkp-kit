from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import typer

app = typer.Typer(help="MKP API client")
auth_app = typer.Typer(help="Manage JWT token and credentials")
record_app = typer.Typer(help="Manage recording")
app.add_typer(auth_app, name="auth")
app.add_typer(record_app, name="record")

DEFAULT_SERVER = "http://127.0.0.1:8080"
DEFAULT_TIMEOUT = 15.0
CONFIG_PATH = Path.home() / ".mkp" / "client.json"


@dataclass(slots=True)
class ClientConfig:
    server_addr: str = DEFAULT_SERVER
    mode: str = "release"
    token: str = ""
    token_expires_at: str = ""
    username: str = ""
    password: str = ""
    timeout_seconds: int = int(DEFAULT_TIMEOUT)


def load_config() -> ClientConfig:
    if not CONFIG_PATH.exists():
        return ClientConfig()
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return ClientConfig(**{k: payload.get(k, getattr(ClientConfig(), k)) for k in ClientConfig.__dataclass_fields__})


def save_config(cfg: ClientConfig) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(asdict(cfg), ensure_ascii=False, indent=2), encoding="utf-8")


def runtime(server: str | None, token: str | None, username: str | None, password: str | None, timeout: float | None) -> tuple[ClientConfig, str, str, str, str, float]:
    cfg = load_config()
    base = (server or os.getenv("MKP_SERVER") or cfg.server_addr or DEFAULT_SERVER).rstrip("/")
    tok = token or os.getenv("MKP_TOKEN") or cfg.token
    user = username or os.getenv("MKP_USER") or cfg.username
    pwd = password or os.getenv("MKP_PASSWORD") or cfg.password
    to = timeout or float(os.getenv("MKP_TIMEOUT", cfg.timeout_seconds or DEFAULT_TIMEOUT))
    return cfg, base, tok, user, pwd, to


def request_json(method: str, path: str, payload: Any | None, require_auth: bool, server: str | None, token: str | None, username: str | None, password: str | None, timeout: float | None) -> dict[str, Any]:
    cfg, base, tok, user, pwd, to = runtime(server, token, username, password, timeout)
    if require_auth and not tok:
        if not user or not pwd:
            raise typer.BadParameter("missing token and stored credentials")
        login = request_json("POST", "/api/v1/auth/token", {"username": user, "password": pwd}, False, base, None, user, pwd, to)
        tok = str(login["token"])
        cfg.server_addr = base
        cfg.username = user
        cfg.password = pwd
        cfg.token = tok
        cfg.token_expires_at = (datetime.now(UTC) + timedelta(seconds=int(login.get("expires_in", 0)))).isoformat()
        save_config(cfg)
    headers = {"Content-Type": "application/json"}
    if require_auth and tok:
        headers["Authorization"] = f"Bearer {tok}"
    with httpx.Client(timeout=to) as client:
        resp = client.request(method, base + path, json=payload, headers=headers)
    data = resp.json()
    if resp.status_code >= 400:
        message = data.get("detail") or data.get("error") or str(data)
        raise typer.Exit(message=message)
    return data


@auth_app.command("login")
def auth_login(username: str, password: str, server: str | None = None, timeout: float | None = None) -> None:
    cfg, base, _, _, _, to = runtime(server, None, username, password, timeout)
    data = request_json("POST", "/api/v1/auth/token", {"username": username, "password": password}, False, base, None, username, password, to)
    cfg.server_addr = base
    cfg.username = username
    cfg.password = password
    cfg.token = str(data["token"])
    cfg.token_expires_at = (datetime.now(UTC) + timedelta(seconds=int(data.get("expires_in", 0)))).isoformat()
    save_config(cfg)
    typer.echo(f"token saved (expires in {data.get('expires_in', 0)}s)")


@auth_app.command("token")
def auth_token() -> None:
    cfg = load_config()
    if not cfg.token:
        raise typer.BadParameter("no local token stored")
    typer.echo(cfg.token)


@auth_app.command("revoke")
def auth_revoke(forget: bool = False) -> None:
    cfg = load_config()
    cfg.token = ""
    cfg.token_expires_at = ""
    if forget:
        cfg.username = ""
        cfg.password = ""
    save_config(cfg)
    typer.echo("local token cleared" if not forget else "local token and credentials cleared")


@app.command()
def version(server: str | None = None, timeout: float | None = None) -> None:
    typer.echo(json.dumps(request_json("GET", "/api/v1/version", None, False, server, None, None, None, timeout), ensure_ascii=False, indent=2))


@app.command()
def list(server: str | None = None, token: str | None = None, username: str | None = None, password: str | None = None, timeout: float | None = None, limits: int = 10, name: str = "") -> None:
    query = f"?limits={max(1, min(10, limits))}"
    if name.strip():
        query += f"&name={name.strip()}"
    typer.echo(json.dumps(request_json("GET", "/api/v1/directives/list" + query, None, True, server, token, username, password, timeout), ensure_ascii=False, indent=2))


@record_app.command("start")
def record_start(log_name: str, width: int = 0, height: int = 0, stposx: int | None = None, stposy: int | None = None, server: str | None = None, token: str | None = None, username: str | None = None, password: str | None = None, timeout: float | None = None) -> None:
    payload = {"log_name": log_name, "width": width, "height": height, "stposx": stposx, "stposy": stposy}
    typer.echo(json.dumps(request_json("POST", "/api/v1/directives/alog", payload, True, server, token, username, password, timeout), ensure_ascii=False, indent=2))


@app.command("stop")
def stop_command(server: str | None = None, token: str | None = None, username: str | None = None, password: str | None = None, timeout: float | None = None) -> None:
    typer.echo(json.dumps(request_json("POST", "/api/v1/directives/astop", None, True, server, token, username, password, timeout), ensure_ascii=False, indent=2))


@app.command()
def replay(record_id: str, server: str | None = None, token: str | None = None, username: str | None = None, password: str | None = None, timeout: float | None = None) -> None:
    typer.echo(json.dumps(request_json("POST", f"/api/v1/directives/aplay/{record_id}", None, True, server, token, username, password, timeout), ensure_ascii=False, indent=2))


@app.command()
def cancel(server: str | None = None, token: str | None = None, username: str | None = None, password: str | None = None, timeout: float | None = None) -> None:
    typer.echo(json.dumps(request_json("POST", "/api/v1/directives/acancel", None, True, server, token, username, password, timeout), ensure_ascii=False, indent=2))


@app.command()
def remove(record_id: str, server: str | None = None, token: str | None = None, username: str | None = None, password: str | None = None, timeout: float | None = None) -> None:
    typer.echo(json.dumps(request_json("DELETE", f"/api/v1/directives/records/{record_id}", None, True, server, token, username, password, timeout), ensure_ascii=False, indent=2))


def main() -> None:
    app()
