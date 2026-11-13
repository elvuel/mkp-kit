# MKP Python

English | [中文](./README.md) | [Shared Overview](../README.en.md) | [Shared Command Reference](../directives.en.md) | [Python Directive Supplement](./directives.en.md) | [PyPI Publishing Guide](./PYPI.md)

---

This document only keeps the **Python-specific usage and differences** for `mkp-kit/python/`.

Cross-language shared content is maintained at the repository root:

- Shared overview: `../README.en.md`
- Shared command reference: `../directives.en.md`
- Python publishing guide: `./PYPI.md`

## Installation

Within the `mkp-kit` monorepo, the Python implementation lives in the `python/` subdirectory.

```powershell
cd D:\projects\mkp-kit\python
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
pip install -e .[dev]
```

Current `pyproject.toml` requirements:

- Python `>= 3.12`
- main dependencies: `pyserial`, `fastapi`, `uvicorn`, `sqlalchemy`, `PyJWT`, `httpx`, `typer`

## Quick Start

```python
from mkp_python import check_sf_serial_port, device_sn, new_sf_serial_port

sfport = new_sf_serial_port()
sfport.name = check_sf_serial_port()
sfport.open()
sfport.reset_input_buffer()
sfport.start_read_loop()

try:
    print(device_sn(sfport))
finally:
    sfport.close()
```

Synchronous parsing requires:

- `start_read_loop()` is running
- `sfport.sync_output_enabled = True`

## Examples

All paths and commands below are relative to `mkp-kit/python/`.

| Example | Source path | Run command | Behavior |
|---|---|---|---|
| `m10` | `examples/m10.py` | `python -m examples.m10` | Moves the mouse left by `400`, then up by `400` |
| `kpad` | `examples/kpad.py` | `python -m examples.kpad` | Types `Hello MKP!` with correct case |
| `keys` | `examples/keys.py` | `python -m examples.keys` | Demonstrates helper-level key down, key up, tap, and release-all |
| `context` | `examples/context.py` | `python -m examples.context` | Demonstrates `alog` timeout handling and manual `astop` interruption |
| `common` | `examples/common.py` | Reused by other examples | Provides serial initialization and pretty-print helpers |

Common directive examples:

| Directive examples | Source path | Run command | Purpose |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/directives/<name>.py` | `python -m examples.directives.sn` | Query device serial number, version, and liveness |
| `list_dir` / `clean_dir` / `delete_file` | `examples/directives/<name>.py` | `python -m examples.directives.list_dir "/eMMC/applog"` | Browse directories, clean directories, and delete files |
| `join` / `wifi_auto` / `ahttpbase` | `examples/directives/<name>.py` | `python -m examples.directives.join <ssid> <password>` | Configure Wi‑Fi, auto-connect, and HTTP base address |
| `ainsp` / `atime` | `examples/directives/<name>.py` | `python -m examples.directives.atime "/eMMC/applog/spike.log"` | Inspect log metadata and duration |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/directives/<name>.py` | `python -m examples.directives.ajson2log "D:\tmp\demo.json" "/eMMC/applog/demo.log"` | Upload, download, and convert between JSON and MKP logs |
| `alog` / `astop` | `examples/directives/<name>.py` | `python -m examples.directives.alog "mkpdemo/demo"` | Start and stop device-side recording |

## Python-Specific Surfaces

### HTTP Server

```powershell
$env:MKP_SF_PORT = "COM5"
$env:MKP_JWT_SECRET = "change-me"
$env:MKP_USER = "admin"
$env:MKP_PASSWORD = "admin123"
python -m mkp_python.server
```

Main routes:

- `GET /health`
- `POST /api/v1/auth/token`
- `GET /api/v1/version`
- `GET /api/v1/directives/list`
- `GET /api/v1/directives/records/{record_id}`
- `DELETE /api/v1/directives/records/{record_id}`
- `GET /api/v1/directives/replay/status`
- `POST /api/v1/directives/alog`
- `POST /api/v1/directives/astop`
- `POST /api/v1/directives/aplay/{record_id}`
- `POST /api/v1/directives/acancel`

### CLI

```powershell
mkp version
mkp auth login admin admin123
mkp auth token
mkp list
mkp record start demo --width 1920 --height 1080
mkp stop
mkp replay <record_id>
mkp cancel
mkp remove <record_id>
```

### Conversion Tools and File Server

```powershell
mkp-converter -f .\sample.log
mkp-converter -f .\sample.json
mkp-json2log -f .\sample.json -o .\sample.log
mkp-log2json -f .\sample.log -o .\sample.json
mkp-file-server --root .\file_root --port 8080
```

## Repository Layout

All paths below are relative to `mkp-kit/python/`.

| Path | Description |
|---|---|
| `src/mkp_python/sdk.py` | serial object, directive sending, and core helpers |
| `src/mkp_python/parser.py` | parser registry and parse logic |
| `src/mkp_python/models.py` | dataclass response models and option types |
| `src/mkp_python/controller.py` | higher-level orchestration layer |
| `src/mkp_python/server.py` | FastAPI HTTP server |
| `src/mkp_python/cli.py` | Typer CLI |
| `examples/` | `m10` / `kpad` / directive examples |
| `directives.en.md` | Python directive supplement |

## Python-Specific Notes

- When a synchronous directive times out, or a parser cannot extract structured output, `mkp-python` writes debug artifacts into `.mkp-debug/` by default (`MKP_DEBUG_SERIAL_DIR` overrides it).
- Debug files may include an auto summary, the original directive, raw serial output, the pending buffer, and the last successful synchronous output.
- `send_parsed()` first yields `dict` output where applicable; higher-level helpers then convert it into dataclass models.
- When shared directive meaning changes, update the root docs first, then record Python-specific differences under `python/`.
