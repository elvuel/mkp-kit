# MKP Python Command Reference

English | [中文](./directives.md) | [README](./README.en.md)

---

## Table of Contents

- [Conventions](#conventions)
- [Example Index](#example-index)
- [Quick Overview](#quick-overview)
- [Synchronous and Asynchronous Sending](#synchronous-and-asynchronous-sending)
- [Recording and Replay Commands](#recording-and-replay-commands)
- [Device, Network, and Filesystem Commands](#device-network-and-filesystem-commands)
- [Mouse Command: m10](#mouse-command-m10)
- [Keyboard Command: kpad](#keyboard-command-kpad)
- [Output Parser Index](#output-parser-index)
- [Common Exceptions](#common-exceptions)
- [Response Model Index](#response-model-index)
- [Controller Proxies](#controller-proxies)
- [HTTP API / CLI Mapping](#http-api--cli-mapping)
- [Notes](#notes)

## Conventions

This document covers the **MKP directives currently implemented and wrapped by the Python port**.

In `mkp-python`, directives are handled at roughly three layers:

1. **Raw string layer**: `send_directive()` / `send_directive_async()`
2. **Parser layer**: `send_parsed()` selects a parser by directive name
3. **Helper / model layer**: helpers such as `atime()`, `ahttpbase()`, and `adumj()` return dataclass models directly

### Requirements for Synchronous Parsing

If you want to wait for device output and parse it, make sure:

- the port is `open()`,
- `start_read_loop()` is running,
- and `sync_output_enabled = True`.

`examples.common.init_sfport()` already follows the recommended sequence:

1. `new_sf_serial_port()`
2. resolve the port name
3. `open()`
4. `reset_input_buffer()`
5. `start_read_loop()`
6. optionally `stop_record()` to clear device state

### Debug Capture

When synchronous waiting times out, or a parser cannot extract the expected payload, the Python port writes raw serial diagnostics into `.mkp-debug/` (override with `MKP_DEBUG_SERIAL_DIR`).

## Example Index

The table below follows the same README style and summarizes the standalone directive examples. `aplay` and `acancel` are documented at the API level, but do not yet have dedicated example programs.

| Directive | Source path | Run command | Behavior |
|---|---|---|---|
| `sn` | `examples/directives/sn.py` | `python -m examples.directives.sn` | Query the device serial number |
| `aversion` | `examples/directives/aversion.py` | `python -m examples.directives.aversion` | Query version information |
| `alive` | `examples/directives/alive.py` | `python -m examples.directives.alive` | Query liveness / heartbeat |
| `list_dir` | `examples/directives/list_dir.py` | `python -m examples.directives.list_dir` | List the default `/eMMC` directory, or pass a custom path |
| `clean_dir` | `examples/directives/clean_dir.py` | `python -m examples.directives.clean_dir` | Clean the default `/eMMC/applog/subdir1`, or pass a custom path |
| `delete_file` | `examples/directives/delete_file.py` | `python -m examples.directives.delete_file` | Delete the default `/eMMC/applog/uuu3.log`, or pass a custom path |
| `join` | `examples/directives/join.py` | `python -m examples.directives.join [ssid] [password]` | Connect to Wi‑Fi; without args it uses the saved configuration |
| `wifi_auto` | `examples/directives/wifi_auto.py` | `python -m examples.directives.wifi_auto [0|1]` | Query or set Wi‑Fi auto-connect |
| `ahttpbase` | `examples/directives/ahttpbase.py` | `python -m examples.directives.ahttpbase [url]` | Query or set the file-service base URL |
| `ainsp` | `examples/directives/ainsp.py` | `python -m examples.directives.ainsp` | Read basic info from the default `/eMMC/applog/uuu2.log`, or pass a custom path |
| `atime` | `examples/directives/atime.py` | `python -m examples.directives.atime` | Read duration from the default `/eMMC/applog/uuu2.log`, or pass a custom path |
| `adumj` | `examples/directives/adumj.py` | `python -m examples.directives.adumj <log_path>` | Convert a device log into action JSON |
| `aget` | `examples/directives/aget.py` | `python -m examples.directives.aget <filepath>` | Pull a file from the file server into MKP |
| `aput` | `examples/directives/aput.py` | `python -m examples.directives.aput <filepath>` | Upload a file from MKP to the file server |
| `ajson2log` | `examples/directives/ajson2log.py` | `python -m examples.directives.ajson2log <jsonpath> <outputlogpath>` | Convert action JSON back into MKP log format |
| `alog` | `examples/directives/alog.py` | `python -m examples.directives.alog [log_name]` | Start synchronous recording with default `subdir1/test`, or pass a custom log name |
| `astop` | `examples/directives/astop.py` | `python -m examples.directives.astop` | Stop the current recording |
## Quick Overview

| Category | Directive | Python helper / method | Return |
|---|---|---|---|
| Recording | `alog` | `start_record()` / `alog()` / `Controller.alog()` | `None` / `str` |
| Stop recording | `astop` | `stop_record()` / `astop()` | `None` / `str` |
| Cancel replay | `acancel` | `cancel()` | `dict` / `str` / empty text |
| Replay | `aplay` | `sfport.start_replaying()` / `Controller.start_replaying()` | `None` |
| Serial number | `sn` | `device_sn()` | `SN` |
| List directory | `list_dir` | `list_dir()` | `FileSystem` |
| Clean directory | `clean_dir` | `clean_dir()` | `str` |
| Delete file | `delete_file` | `delete_file()` | `str` |
| Heartbeat | `alive` | `alive()` | `Heartbeat` |
| Log duration | `atime` | `atime()` | `LogLength` |
| Version | `aversion` | `aversion()` | `MKPVersion` |
| Log inspect | `ainsp` | `ainspect()` | `LogInfo` |
| Join Wi‑Fi | `join` | `join()` | `str` |
| Wi‑Fi auto | `wifi_auto` | `wifi_auto()` | `str` |
| HTTP base | `ahttpbase` | `ahttpbase()` | `AHTTPBase` |
| Dump action JSON | `adumj` | `adumj()` | `ActionDump` |
| Download to device | `aget` | `aupload_to_mkp()` | `str` |
| Upload from device | `aput` | `adownload_from_mkp()` | `str` |
| JSON to device log | `ajson2log` | `ajson2log()` | `str` |
| Mouse | `m10` | `mouse10()` / `mouse_release_all()` | `None` |
| Keyboard | `kpad` | `keypad()` / `key_tap()` / `key_down()` / `key_up()` | `None` |

## Synchronous and Asynchronous Sending

### `send_directive(directive, ignore_output=False, timeout=None)`

- Sends a raw directive string.
- If `sync_output_enabled=True` and `ignore_output=False`, it waits synchronously for output.
- Returns the raw device output text.

### `send_directive_async(directive)`

- Sends without waiting.
- Fits naturally asynchronous directives such as `m10`, `kpad`, and `aplay`.

### `send_parsed(directive, timeout=None)`

- Looks up a parser from the directive's first token.
- If the parser sets `json_output=True`, the payload is extracted and passed through `json.loads()`.
- This is the foundation for most high-level helpers.

## Recording and Replay Commands

### `alog`

Two common modes:

- `start_record(sfport, log_name, opt=None)`: start recording asynchronously
- `alog(sfport, log_name, opt=None, timeout=None)`: wait synchronously for device output

`LogOption` supports:

- `width`
- `height`
- `stposx`
- `stposy`

### `astop`

- `stop_record(sfport)`: stop asynchronously
- `astop(sfport, timeout=None)`: stop and wait for output

### `acancel`

- `cancel(sfport, timeout=None)`: cancel current replay or related device-side activity

### `aplay`

The Python port currently exposes replay directly from the serial object or controller:

```python
sfport.start_replaying("demo", 0)
ctrl.start_replaying("demo", 0)
```

## Device, Network, and Filesystem Commands

### `sn`

```python
from mkp_python import device_sn
print(device_sn(sfport))
```

Returns `SN(sn="...")`.

### `list_dir`

```python
from mkp_python import list_dir
print(list_dir(sfport, "/eMMC/applog"))
```

Returns `FileSystem(path=..., files=[FileNode(...)])`.

### `clean_dir` / `delete_file`

- `clean_dir(sfport, path)`
- `delete_file(sfport, path)`

These are handled as plain successful text responses.

### `alive`

Returns `Heartbeat` for device liveness.

### `atime`

Returns `LogLength(seconds=..., milsec=...)`.

Example:

```powershell
python -m examples.directives.atime "/eMMC/applog/spike.log"
```

### `aversion`

Returns `MKPVersion(uver=..., aver=...)`.

### `ainsp`

The Python helper is named `ainspect()`, while the underlying directive remains `ainsp`.

Returns `LogInfo`, typically containing:

- `seconds`
- `milsec`
- `width`
- `height`
- `stposx`
- `stposy`

### `join`

`JoinOption` carries SSID / password fields. The parser normalizes output to:

- `connected`
- `connecting`

### `wifi_auto`

`WifiAutoOption` controls auto-connect state. The parser normalizes to:

- `on`
- `off`
- `""` if the device did not return a clear state

### `ahttpbase`

Returns `AHTTPBase(ahttpbase="...")`.

To handle firmware variations:

- it prefers JSON parsing,
- but if the device only replies with `OK`, it falls back to reconstructing the URL from the current CLI arguments.

### `adumj`

Returns `ActionDump(meta=..., datas=[...])`.

Use this to export device-side action logs as structured JSON data.

### `aget` / `aput` / `ajson2log`

- `aupload_to_mkp(sfport, AGetOption(...))`
- `adownload_from_mkp(sfport, APutOption(...))`
- `ajson2log(sfport, AJSON2LogOption(...))`

These helpers currently return plain device text. Outputs containing `error code`, `Upload failed`, or `server returned status` are treated as execution failures.

## Mouse Command: `m10`

`M10Option` currently supports:

- `button`
- `x`
- `y`
- `wheel`
- `async_mode`
- `sync_ignore_output`

Generated CLI fragments:

- `--b <button>`
- `--x <delta>`
- `--y <delta>`
- `--w <delta>`

### Common Usage

```python
from mkp_python import M10Option, mouse_release_all

sfport.mouse10(M10Option().set_x(100).set_y(50))
sfport.mouse10(M10Option().with_left_button())
mouse_release_all(sfport)
```

### Synchronous Mode

```python
sfport.mouse10(M10Option().set_x(10).with_async(False))
sfport.mouse10(M10Option().set_x(10).with_sync_ignore_output(True))
```

Both mean: **send synchronously and ignore text output**.

### Example

`examples/m10.py` currently:

1. moves left by `400`
2. then moves up by `400`

## Keyboard Command: `kpad`

`KpadOption` currently supports:

- `mod_keys`
- `keys`
- `release`
- `delay`
- `verbose`
- `async_mode`
- `sync_ignore_output`

Generated CLI fragments:

- `--s <modifier status>`
- `--x1 ... --x6`
- `--rel <release>`
- `--d <delay>`
- `--v 1`

### Common Usage

```python
from mkp_python import KpadOption, key_down, key_tap, key_up

sfport.keypad(KpadOption().with_keys(["CTRL", "C"]).with_auto_release())
key_tap(sfport, "A")
key_down(sfport, "W")
key_up(sfport, "W")
```

### Stateful Helpers

To preserve down / hold / release semantics, `KpadOption` works with an internal pressed-key cache. Related helpers include:

- `key_down()`
- `key_up()`
- `key_tap()`
- `key_presses()`
- `keypad_release()`
- `keypad_release_all()`
- `reset_kpad_pressed_caches()`

### Example

`examples/kpad.py` types `Hello MKP!` one step at a time, using `MOD_LSHIFT` for uppercase characters and `!`.

## Output Parser Index

Registered directive parsers in `parser.py`:

| Directive | Parser |
|---|---|
| `astop` | `AstopParser` |
| `acancel` | `RawJSONTextParser` |
| `sn` | `RawJSONTextParser` |
| `list_dir` | `RawJSONTextParser` |
| `clean_dir` | `PlainSuccessParser` |
| `delete_file` | `PlainSuccessParser` |
| `alive` | `RawJSONTextParser` |
| `atime` | `LineJSONParser` |
| `aversion` | `RawJSONTextParser` |
| `ainsp` | `LineJSONParser` |
| `join` | `JoinParser` |
| `wifi_auto` | `WifiAutoParser` |
| `adumj` | `AdumjParser` |
| `ahttpbase` | `AHTTPBaseParser` |
| `aget` | `AGetParser` |
| `aput` | `APutParser` |
| `ajson2log` | `AJSON2LogParser` |
| `alog` | `PlainSuccessParser` |

If a directive is not registered, `send_parsed()` raises `ErrDirectiveParserMissing`.

## Common Exceptions

- `ErrDirectiveParserMissing`: no parser is registered
- `ErrRawDirectiveParseFailed`: output exists but could not be parsed into the expected shape
- `ErrRawDirectiveExecutionFailed`: output indicates a device-side execution failure
- `DirectiveTimeoutError`: synchronous wait timed out

## Response Model Index

Directive-related dataclasses in `models.py` include:

- `SN`
- `FileNode`
- `FileSystem`
- `Heartbeat`
- `LogOption`
- `JoinOption`
- `WifiAutoOption`
- `AGetOption`
- `APutOption`
- `AJSON2LogOption`
- `AHTTPBaseOption`
- `AHTTPBase`
- `AdumjOption`
- `ActionDumpMeta`
- `ActionDump`
- `LogLength`
- `LogInfo`
- `MKPVersion`
- `M10Option`
- `KpadOption`
- `SerialPortStatus`

## Controller Proxies

`Controller` exposes serial helpers through a higher-level wrapper, including:

- `start_record()` / `stop_record()` / `alog()` / `astop()` / `cancel()`
- `join()` / `wifi_auto()` / `device_sn()`
- `list_dir()` / `clean_dir()` / `delete_file()`
- `alive()` / `atime()` / `aversion()` / `ainspect()`
- `aupload_to_mkp()` / `adownload_from_mkp()` / `ajson2log()` / `ahttpbase()` / `adumj()`
- `start_replaying()`
- `snapshot_status()`

## HTTP API / CLI Mapping

### HTTP API

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

- `mkp version`
- `mkp list`
- `mkp record start <log_name>`
- `mkp stop`
- `mkp replay <record_id>`
- `mkp cancel`
- `mkp remove <record_id>`
- `mkp auth login <username> <password>`
- `mkp auth token`
- `mkp auth revoke [--forget]`

## Notes

- This document only covers directives currently implemented in `mkp-python`.
- If you continue closing behavior gaps against `mkp-go`, verify the parser registry, helper return models, and examples together.
- For a higher-level overview, see [README.en.md](./README.en.md).









