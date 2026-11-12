from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse


@dataclass(slots=True)
class ServerConfig:
    bind: str = "0.0.0.0"
    port: int = 8080
    file_root: str = "./file_root"


def resolve_root(root: str | Path) -> Path:
    return Path(root).expanduser().resolve()


def safe_join(root: Path, *parts: str) -> Path:
    candidate = root
    for part in parts:
        normalized = part.replace("\\", "/").lstrip("/")
        if not normalized:
            continue
        path_obj = Path(normalized)
        if path_obj.is_absolute() or path_obj.drive:
            raise ValueError("Path traversal rejected")
        candidate = candidate.joinpath(*[piece for piece in normalized.split("/") if piece not in ("", ".")])
    resolved = candidate.resolve()
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise ValueError("Path traversal rejected") from exc
    return resolved


def sanitize_filename(filename: str) -> str:
    cleaned = Path(filename.replace("\\", "/")).name
    for bad in '<>:"|?*':
        cleaned = cleaned.replace(bad, "_")
    if cleaned in {"", "."}:
        return "unnamed_file"
    return cleaned


def relative_path(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def list_directory(dir_path: Path, file_root: Path) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    for item in sorted(dir_path.iterdir(), key=lambda entry: entry.name):
        info = item.stat()
        is_dir = item.is_dir()
        entries.append(
            {
                "name": item.name,
                "type": "dir" if is_dir else "file",
                "size": 0 if is_dir else info.st_size,
                "path": relative_path(file_root, item),
            }
        )
    return entries


def create_app(file_root: str | Path) -> FastAPI:
    root = resolve_root(file_root)
    root.mkdir(parents=True, exist_ok=True)
    app = FastAPI(title="mkp-python-file-server", version="0.1.0")

    @app.get("/list")
    def handle_list(path: str = "") -> list[dict[str, object]]:
        try:
            fs_path = safe_join(root, path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not fs_path.exists() or not fs_path.is_dir():
            raise HTTPException(status_code=404, detail=f"Directory not found: {path}")
        return list_directory(fs_path, root)

    @app.post("/upload")
    async def handle_upload(file: UploadFile = File(...), path: str = Form(default="")) -> dict[str, object]:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Empty filename")
        filename = sanitize_filename(file.filename)
        try:
            target_path = safe_join(root, path, filename)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        target_path.parent.mkdir(parents=True, exist_ok=True)
        size = 0
        with target_path.open("wb") as handle:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                handle.write(chunk)
        return {"status": "ok", "path": relative_path(root, target_path), "size": size}

    @app.put("/{target_path:path}")
    async def handle_put(target_path: str, body: bytes = Body(default=b"", media_type="application/octet-stream")) -> dict[str, object]:
        try:
            fs_path = safe_join(root, target_path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not body:
            raise HTTPException(status_code=400, detail="Empty request body")
        fs_path.parent.mkdir(parents=True, exist_ok=True)
        fs_path.write_bytes(body)
        return {"status": "ok", "path": relative_path(root, fs_path), "size": len(body)}

    @app.get("/{target_path:path}")
    def handle_get(target_path: str) -> FileResponse:
        try:
            fs_path = safe_join(root, target_path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not fs_path.exists() or fs_path.is_dir():
            raise HTTPException(status_code=404, detail=f"File not found: {target_path}")
        return FileResponse(fs_path, filename=fs_path.name)

    return app


def parse_args(argv: list[str] | None = None) -> ServerConfig:
    parser = argparse.ArgumentParser(prog="mkp-file-server", description="Serve files for MKP upload/download workflows.")
    parser.add_argument("-p", "--port", type=int, default=8080, help="Port to listen on")
    parser.add_argument("-r", "--root", default="./file_root", help="File root directory")
    parser.add_argument("-b", "--bind", default="0.0.0.0", help="Address to bind to")
    args = parser.parse_args(argv)
    return ServerConfig(bind=args.bind, port=args.port, file_root=args.root)


def main() -> None:
    import uvicorn

    cfg = parse_args()
    root = resolve_root(cfg.file_root)
    root.mkdir(parents=True, exist_ok=True)
    print(f"file server root: {root}")
    print(f"listening on: {cfg.bind}:{cfg.port}")
    uvicorn.run(create_app(root), host=cfg.bind, port=cfg.port)
