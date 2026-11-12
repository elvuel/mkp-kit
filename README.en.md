# MKP Python

English | [中文](./README.md) | [Command Reference](./directives.en.md)

---

### What is MKP?

**MKP** means a serial-controlled **mouse / keyboard recording, replay, and file-management device protocol**.

It usually runs on an external USB HID-capable board or firmware. A host program sends directives such as `m10`, `kpad`, `alog`, `aplay`, and `list_dir` to the MKP device over a serial port. The device then emits USB HID mouse / keyboard events to a target machine, or records, replays, inspects, and manages input logs / files on-device.

`mkp-python` is the Python SDK / client library for the MKP protocol. It mainly provides:

- a serial SDK with synchronous / asynchronous directive sending;
- high-level mouse, keyboard, recording, replay, and file helpers;
- JSON / text output parsing for device responses;
- a FastAPI HTTP server and a Typer-based CLI;
- `.log` / `.json` conversion tools and a local file server.

> In short: **MKP is the hardware / firmware-side mouse-keyboard automation and replay protocol; MKP Python is the Python library for controlling it.**

### Project Scope

`mkp-python` is not a local OS-native mouse / keyboard automation library. Its main data path is:

```text
Python program -> Serial port -> MKP device / firmware -> USB HID mouse / keyboard events -> Target system
```

It fits scenarios where you need to:

- drive input through an external HID device;
- record and replay input logs on-device;
- wrap MKP CLI directives as Python APIs, HTTP APIs, or CLI commands.

### Features

| Feature | Description | Related API / command |
|---|---|---|
| Serial connection | Open port, start the read loop, wait for sync output | `new_sf_serial_port()` / `open()` / `start_read_loop()` |
| Raw directives | Send any directive directly | `send_directive()` / `send_directive_async()` / `send_parsed()` |
| Mouse control | Relative move, buttons, wheel, release all | `m10` / `mouse10()` / `mouse_release_all()` |
| Keyboard control | Down, up, tap, combos, release all | `kpad` / `keypad()` / `key_tap()` |
| Recording / replay | Start recording, stop, cancel, replay | `alog` / `astop` / `acancel` / `start_replaying()` |
| File management | List, delete, and clean directories | `list_dir` / `delete_file` / `clean_dir` |
| Device info | SN, heartbeat, version, log duration, and log metadata | `sn` / `alive` / `aversion` / `atime` / `ainsp` |
| Network / transfer | Wi‑Fi, HTTP base, upload / download, conversion | `join` / `wifi_auto` / `ahttpbase` / `aget` / `aput` / `ajson2log` |
| HTTP API | JWT auth, recording list, replay control | `mkp-server` |
| CLI | Client for the HTTP API | `mkp` |
| Utilities | Log conversion and local file server | `mkp-converter` / `mkp-file-server` |

See [directives.en.md](./directives.en.md) for the full directive guide.

## Installation

```powershell
cd D:\projects\mkp-python
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
pip install -e .[dev]
```

Current `pyproject.toml` requirements:

- Python `>= 3.12`
- main dependencies: `pyserial`, `fastapi`, `uvicorn`, `sqlalchemy`, `PyJWT`, `httpx`, `typer`

## Quick Start

### 1. Initialize a Serial Port Manually

```python
from mkp_python import check_sf_serial_port, device_sn, new_sf_serial_port

sfport = new_sf_serial_port()
sfport.name = check_sf_serial_port()
sfport.open()
sfport.reset_input_buffer()
sfport.start_read_loop()

try:
    sn = device_sn(sfport)
    print(sn)
finally:
    sfport.close()
```

For synchronous output parsing, make sure:

- `start_read_loop()` is running
- `sfport.sync_output_enabled = True`

`examples.common.init_sfport()` already applies these steps.

## Examples

The table below uses the same format across languages: source path, run command, and observed behavior.

| Example | Source path | Run command | Behavior |
|---|---|---|---|
| `m10` | `examples/m10.py` | `python -m examples.m10` | Moves the mouse left by `400`, then up by `400` |
| `kpad` | `examples/kpad.py` | `python -m examples.kpad` | Types `Hello MKP!` with correct case |
| `keys` | `examples/keys.py` | `python -m examples.keys` | Demonstrates helper-level key down, key up, tap, and release-all |
| `context` | `examples/context.py` | `python -m examples.context` | Demonstrates `alog` timeout handling and manual `astop` interruption |
| `common` | `examples/common.py` | Reused by other examples | Provides serial initialization and pretty-print helpers |

Common directive examples are summarized the same way:

| Directive examples | Source path | Run command | Purpose |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/directives/<name>.py` | `python -m examples.directives.sn` | Query device serial number, version, and liveness |
| `list_dir` / `clean_dir` / `delete_file` | `examples/directives/<name>.py` | `python -m examples.directives.list_dir "/eMMC/applog"` | Browse directories, clean directories, and delete files |
| `join` / `wifi_auto` / `ahttpbase` | `examples/directives/<name>.py` | `python -m examples.directives.join <ssid> <password>` | Configure Wi‑Fi, auto-connect, and HTTP base address |
| `ainsp` / `atime` | `examples/directives/<name>.py` | `python -m examples.directives.atime "/eMMC/applog/spike.log"` | Inspect log metadata and duration |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/directives/<name>.py` | `python -m examples.directives.ajson2log "D:\tmp\demo.json" "/eMMC/applog/demo.log"` | Upload, download, and convert between JSON and MKP logs |
| `alog` / `astop` | `examples/directives/<name>.py` | `python -m examples.directives.alog "mkpdemo/demo"` | Start and stop device-side recording |

## Common APIs

### Recording / Replay

```python
from mkp_python import LogOption, alog, astop, cancel

alog(sfport, "demo", LogOption(width=1920, height=1080))
astop(sfport)
cancel(sfport)

sfport.start_replaying("demo", 0)
```

### File / Device Information

```python
from mkp_python import ainspect, atime, aversion, device_sn, list_dir

print(device_sn(sfport))
print(list_dir(sfport, "/eMMC/applog"))
print(atime(sfport, "/eMMC/applog/demo.log"))
print(ainspect(sfport, "/eMMC/applog/demo.log"))
print(aversion(sfport))
```

### Keyboard Helpers

```python
from mkp_python import key_down, key_tap, key_up

key_tap(sfport, "A")
key_down(sfport, "W")
key_up(sfport, "W")
```

## Directive Modes and Parsing Rules

- `m10` and `kpad` are asynchronous by default.
- `M10Option.with_async(False)` and `with_sync_ignore_output(True)` both mean “send synchronously and ignore output”.
- `KpadOption` follows the same rule.
- `send_parsed()` selects a parser automatically and returns parsed JSON as `dict` when applicable.
- High-level helpers such as `atime()`, `ahttpbase()`, and `adumj()` convert parsed payloads into dataclass models.

When a parser fails or a synchronous wait times out, the Python port automatically captures raw serial output into a debug directory for troubleshooting device-side response differences.

## HTTP Server

Start it with:

```powershell
$env:MKP_SF_PORT = "COM5"
$env:MKP_JWT_SECRET = "change-me"
$env:MKP_USER = "admin"
$env:MKP_PASSWORD = "admin123"
python -m mkp_python.server
```

Important environment variables:

- `MKP_SF_PORT` / `SF_PORT`: serial port name
- `MKP_PORT` / `PORT`: HTTP port, default `8080`
- `MKP_JWT_SECRET` / `JWT_SECRET`: JWT secret
- `MKP_USER` / `JWT_USER`: username, default `admin`
- `MKP_PASSWORD` / `JWT_PASSWORD`: password, default `admin123`
- `MKP_DATABASE_URL`: database URL; default `sqlite:///mkp.db`
- `MKP_SYNC_DIRECTIVE_TIMEOUT_MS`: sync directive timeout, default `10000`
- `MKP_ASYNC_DIRECTIVE_TIMEOUT_MS`: async directive timeout, default `3000`

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

## CLI

The CLI defaults to `http://127.0.0.1:8080`, and stores local config in `~/.mkp/client.json`.

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

## Conversion Tools

```powershell
mkp-converter -f .\sample.log
mkp-converter -f .\sample.json
mkp-json2log -f .\sample.json -o .\sample.log
mkp-log2json -f .\sample.log -o .\sample.json
```

Use cases:

- `.log -> .json`: inspect or edit action logs
- `.json -> .log`: write a JSON action envelope back into device-compatible log format

## File Server

```powershell
mkp-file-server --root .\file_root --port 8080
```

Supported endpoints:

- `GET /<path>`: download a file
- `PUT /<path>`: upload raw bytes
- `POST /upload`: multipart upload with `file` + `path`
- `GET /list?path=`: list a directory

## Serial Debug and Auto Summary

When a synchronous directive times out, or a parser cannot extract structured output, `mkp-python` writes debug artifacts into `.mkp-debug/` by default (`MKP_DEBUG_SERIAL_DIR` overrides the location).

Each debug file may include:

- an auto-generated summary of the current failure point,
- the original directive,
- raw serial output,
- the pending buffer,
- the last successful synchronous output,
- and the latest read error.

This is Python-port-specific troubleshooting support for unstable device responses.

## Repository Layout

- `src/mkp_python/sdk.py`: serial port, helpers, `Controller`
- `src/mkp_python/models.py`: option and response dataclasses
- `src/mkp_python/parser.py`: directive parser registry and parsing logic
- `src/mkp_python/server.py`: FastAPI server
- `src/mkp_python/cli.py`: Typer CLI
- `src/mkp_python/converter.py`: `.log` / `.json` conversion
- `src/mkp_python/file_server.py`: local file server
- `examples/`: serial, mouse, keyboard, and directive examples
- `tests/`: parser, converter, and file server tests

## Notes

- The Python port focuses on core `mkp-go` SDK / directive / HTTP behavior parity.
- This documentation only covers currently implemented Python features.
- If firmware adds new directives, the parser registry and docs should be updated together.
- For directive-level details, see [directives.en.md](./directives.en.md).










