# MKP Rust Command Reference

English | [中文](./directives.md) | [README](./README.en.md)

---

> This document is based on the current `mkp-rust` codebase: `src/sdk.rs`, `src/helper.rs`, `src/parser.rs`, `src/models.rs`, `src/controller.rs`, `src/converter.rs`, `src/server.rs`, and `src/cli.rs`.
> It is intended to be a Rust-specific quick reference for **CLI directives / Rust helpers / Controller extensions / parsers / response models / tools**.

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
- [Response Model Index](#response-model-index)
- [Tools](#tools)
- [Controller / CLI / Server Mapping](#controller--cli--server-mapping)
- [Known Limitations / Differences from `mkp-go`](#known-limitations--differences-from-mkp-go)

## Conventions

- Default serial type: `SFSerialPort`, created by `new_sf_serial_port()`.
- Default port flags: mouse `mouse_port_flag = "1"`, keyboard `keyboard_port_flag = "2"`.
- All low-level directives automatically append `\r\n` before writing to the serial port.
- For synchronous helpers, you normally need: `open()` -> `start_read_loop()` -> `set_sync_output_enabled(true)`.
- Default EOF marker: `<EOF>`; when no parser is registered, synchronous waiting falls back to `cli>`.

### Example Layout

- Directive examples have been reorganized to mirror `mkp-go` under `examples/directives/<name>/main.rs`.
- Examples: `examples/directives/sn/main.rs`, `examples/directives/list_dir/main.rs`, `examples/directives/ahttpbase/main.rs`.
- Even though the source files now live in nested directories, they still run with the same commands: `cargo run --example sn`, `cargo run --example list_dir -- /eMMC/applog`.
- `m10` and `kpad` are not part of `examples/directives/`; they remain top-level examples at `examples/m10.rs` and `examples/kpad.rs`.

Minimal example:

```rust
let mut sfport = mkp_rust::new_sf_serial_port();
sfport.name = "COM5".to_string();
sfport.open()?;
sfport.start_read_loop()?;
sfport.set_sync_output_enabled(true);

let version = mkp_rust::aversion(&mut sfport, None)?;
println!("{version:#?}");
```

## Example Index

The table below follows the same README style and summarizes the standalone directive examples. `aplay` and `acancel` are documented at the API level, but do not yet have dedicated example programs.

| Directive | Source path | Run command | Behavior |
|---|---|---|---|
| `sn` | `examples/directives/sn/main.rs` | `cargo run --example sn --quiet` | Query the device serial number |
| `aversion` | `examples/directives/aversion/main.rs` | `cargo run --example aversion --quiet` | Query version information |
| `alive` | `examples/directives/alive/main.rs` | `cargo run --example alive --quiet` | Query liveness / heartbeat |
| `list_dir` | `examples/directives/list_dir/main.rs` | `cargo run --example list_dir --quiet` | List the default `/eMMC` directory, or pass a custom path |
| `clean_dir` | `examples/directives/clean_dir/main.rs` | `cargo run --example clean_dir --quiet` | Clean the default `/eMMC/applog/subdir1`, or pass a custom path |
| `delete_file` | `examples/directives/delete_file/main.rs` | `cargo run --example delete_file --quiet` | Delete the default `/eMMC/applog/uuu3.log`, or pass a custom path |
| `join` | `examples/directives/join/main.rs` | `cargo run --example join --quiet -- [ssid] [password]` | Connect to Wi‑Fi; without args it uses the saved configuration |
| `wifi_auto` | `examples/directives/wifi_auto/main.rs` | `cargo run --example wifi_auto --quiet -- [0|1]` | Query or set Wi‑Fi auto-connect |
| `ahttpbase` | `examples/directives/ahttpbase/main.rs` | `cargo run --example ahttpbase --quiet -- [url]` | Query or set the file-service base URL |
| `ainsp` | `examples/directives/ainsp/main.rs` | `cargo run --example ainsp --quiet` | Read basic info from the default `/eMMC/applog/uuu2.log`, or pass a custom path |
| `atime` | `examples/directives/atime/main.rs` | `cargo run --example atime --quiet` | Read duration from the default `/eMMC/applog/uuu2.log`, or pass a custom path |
| `adumj` | `examples/directives/adumj/main.rs` | `cargo run --example adumj --quiet -- <log_path>` | Convert a device log into action JSON |
| `aget` | `examples/directives/aget/main.rs` | `cargo run --example aget --quiet -- <filepath>` | Pull a file from the file server into MKP |
| `aput` | `examples/directives/aput/main.rs` | `cargo run --example aput --quiet -- <filepath>` | Upload a file from MKP to the file server |
| `ajson2log` | `examples/directives/ajson2log/main.rs` | `cargo run --example ajson2log --quiet -- <jsonpath> <outputlogpath>` | Convert action JSON back into MKP log format |
| `alog` | `examples/directives/alog/main.rs` | `cargo run --example alog --quiet` | Start synchronous recording with default `subdir1/test`, or pass a custom log name |
| `astop` | `examples/directives/astop/main.rs` | `cargo run --example astop --quiet` | Stop the current recording |
## Quick Overview

| Directive | CLI Form | Rust helper / API | Output / Parser |
|---|---|---|---|
| `alog` | `alog [logName] [options...]` | `start_record()` / `alog()` | Text, `PlainSuccess` |
| `aplay` | `aplay [logName] [--delay ms]` | `start_replaying()` | Usually async, no structured helper |
| `astop` | `astop` | `stop_record()` / `astop()` | Text, `AStop` |
| `acancel` | `acancel` | `cancel()` | JSON text, `RawJsonText` |
| `sn` | `sn` | `device_sn()` | JSON -> `SN` |
| `list_dir` | `list_dir <path>` | `list_dir()` | JSON -> `FileSystem` |
| `clean_dir` | `clean_dir <path>` | `clean_dir()` | Text, `PlainSuccess` |
| `delete_file` | `delete_file <path>` | `delete_file()` | Text, `PlainSuccess` |
| `join` | `join [ssid password]` | `join()` | Text, `Join` |
| `wifi_auto` | `wifi_auto [0|1]` | `wifi_auto()` | Text, `WifiAuto` |
| `adumj` | `adumj <logPath>` | `adumj()` | JSON -> `ActionDump` |
| `ahttpbase` | `ahttpbase [url]` | `ahttpbase()` | JSON -> `AHTTPBase` |
| `aget` | `aget <filepath>` | `aupload_to_mkp()` | Text, `AGet` |
| `aput` | `aput <filepath>` | `adownload_from_mkp()` | Text, `APut` |
| `ajson2log` | `ajson2log <jsonpath> -o <outputlogpath>` | `ajson2log()` | Text, `AJson2Log` |
| `alive` | `alive` | `alive()` | JSON -> `Heartbeat` |
| `atime` | `atime <path>` | `atime()` | JSON line -> `LogLength` |
| `aversion` | `aversion` | `aversion()` | JSON -> `MKPVersion` |
| `ainsp` | `ainsp <path>` | `ainspect()` | JSON line -> `LogInfo` |
| `m10` | `m10 --port <port> ...` | `mouse10()` / `mouse_release_all()` | No structured parser |
| `kpad` | `kpad --port <port> ...` | `keypad()` / `key_tap()` / `key_down()` / `key_up()` | No structured parser |

## Synchronous and Asynchronous Sending

### 1. Synchronous raw output

```rust
let raw = sfport.send_directive("alive", false, None)?;
```

- Waits for the current directive's EOF marker.
- Returns the raw device output.
- Useful when you want custom post-processing.

### 2. Synchronous wait but ignore output

```rust
let _ = sfport.send_directive("m10 --port 1 --x 10", true, None)?;
```

- Still waits for completion.
- Returns an empty string.
- Useful for `m10` / `kpad` style real-time control when output is irrelevant.

### 3. Asynchronous send

```rust
sfport.send_directive_async("m10 --port 1 --x 10")?;
```

- Writes to the serial port only and does not wait for device output.
- Best for high-frequency input events.

### 4. Structured Helpers

```rust
let sn = mkp_rust::device_sn(&mut sfport, None)?;
let version = mkp_rust::aversion(&mut sfport, None)?;
```

- Internally use `send_parsed()` to select the registered parser.
- Return Rust structs or typed textual results.

## Recording and Replay Commands

### `alog`

```text
alog [logName] [--width n] [--heigh n] [--stposx n] [--stposy n]
```

### Rust API

- `start_record(sfport, log_name, opt)`: start recording asynchronously.
- `alog(sfport, log_name, opt, timeout)`: send synchronously and return text.

### Notes

- `LogOption` still follows the firmware flag spelling `--heigh`.
- `alog()` requires synchronous mode and therefore checks `sync_output_enabled`.

### `aplay`

```text
aplay [logName] [--delay ms]
```

### Rust API

- `SFSerialPort::start_replaying(log_name, delay)`
- `Controller::start_replaying(log_name, delay)`

### Notes

- Currently sent asynchronously by default.
- The Rust server also exposes `/api/v1/directives/aplay/{record_id}` for replaying a stored record by ID.

### `astop`

```text
astop
```

### Rust API

- `stop_record(sfport)`
- `astop(sfport, timeout)`

### `acancel`

```text
acancel
```

### Rust API

- `cancel(sfport, timeout)`

### Notes

- The Rust helper returns `ParsedOutput`.
- The current parser expects JSON text.

## Device, Network, and Filesystem Commands

### `sn`

```text
sn
```

**Returns:** `SN { sn: String }`

### `list_dir`

```text
list_dir <path>
```

**Returns:** `FileSystem`

### Notes

- If the payload contains an `error` field, the Rust helper converts it into `MkpError::State`.

### `clean_dir`

```text
clean_dir <path>
```

### Notes

- The Rust helper restricts the path to locations under `/eMMC/applog`.

### `delete_file`

```text
delete_file <path>
```

### Notes

- The helper normalizes the input with `compose_log_fullpath()` first.
- The target must remain under `/eMMC/applog`.

### `join`

```text
join [ssid password]
```

### Rust API

- `join(sfport, None, timeout)`: use the device's most recently saved configuration.
- `join(sfport, Some(JoinOption { ssid, password }), timeout)`: connect with explicit credentials.

### `wifi_auto`

```text
wifi_auto [0|1]
```

### Rust API

- `wifi_auto(sfport, None, timeout)`: query current state.
- `wifi_auto(sfport, Some(WifiAutoOption { state }), timeout)`: set state.

### Notes

- `state` only accepts empty string, `0`, or `1`.

### `adumj`

```text
adumj <logPath>
```

**Returns:** `ActionDump`

### `ahttpbase`

```text
ahttpbase [url]
```

**Returns:** `AHTTPBase { ahttpbase: String }`

### Notes

- Without an argument, it queries the current base URL.
- With an argument, it sets the URL and returns a structured response.

### `aget`

```text
aget <filepath>
```

**Rust helper:** `aupload_to_mkp()`

### `aput`

```text
aput <filepath>
```

**Rust helper:** `adownload_from_mkp()`

### `ajson2log`

```text
ajson2log <jsonpath> -o <outputlogpath>
```

**Returns:** `AJson2Log`

### `alive`

```text
alive
```

**Returns:** `Heartbeat`

### `atime`

```text
atime <path>
```

**Returns:** `LogLength`

### `aversion`

```text
aversion
```

**Returns:** `MKPVersion`

### `ainsp`

```text
ainsp <path>
```

**Rust helper:** `ainspect()`

**Returns:** `LogInfo`

## Mouse Command: `m10`

### CLI

```text
m10 --port 1 --x 400
m10 --port 1 --y -400
m10 --port 1 --b 1
m10 --port 1 --b 0
```

### Rust API

- `SFSerialPort::mouse10(opt)`
- `mouse_release_all(sfport, opt)`

### `M10Option` Common Fields

- `port`: port flag, usually `"1"`
- `x`, `y`: relative movement
- `b`: button state / button action
- `w`: wheel value
- `async_mode`: whether to send asynchronously

### Notes

- Real-time mouse control defaults to asynchronous sending.
- For strict ordering, set `async_mode = false`.
- `mouse_release_all()` is useful after drag-style operations.

### Helper / Controller Extensions

- `mkp_rust::m10(&mut sfport, opt)` is the helper-style compatibility entry.
- `Controller::mouse_down(button, opt)` / `mouse_up(opt)`
- `Controller::mouse_click(button, double, sleep_interval_ms, opt)`
- `Controller::mouse_scroll(dir, steps, sleep_interval_ms)`
- `Controller::mouse_scroll_with_button(dir, steps, button, sleep_interval_ms)`
- `Controller::mouse_move(button, rel_x, rel_y, interval, opt)`
- `Controller::mouse_move_offsets(button, offsets, opt)`

`mouse_move_offsets()` uses `MouseMoveOffset` for segmented replay:

```rust
use mkp_rust::MouseMoveOffset;

let offsets = vec![
    MouseMoveOffset::new(-100, 0),
    MouseMoveOffset::new(0, -100).with_wheel(1).with_pause(50),
];
controller.mouse_move_offsets("left", &offsets, None)?;
```

### Example

Move left by `400`, then up by `400`:

```rust
use mkp_rust::{M10Option, mouse_release_all};

let mut left = M10Option::default();
left.x = -400;
sfport.mouse10(left)?;

let mut up = M10Option::default();
up.y = -400;
sfport.mouse10(up)?;

mouse_release_all(&mut sfport, None)?;
```

## Keyboard Command: `kpad`

### CLI

```text
kpad --port 2 --s 0b --x1 0f --rel 1
```

### Rust API

- `SFSerialPort::keypad(opt)`
- `key_down(sfport, key, opt)`
- `key_up(sfport, key, opt)`
- `key_tap(sfport, key, opt)`
- `keypad_release(sfport, opt)`
- `keypad_release_all(sfport, opt)`

### `KpadOption` Common Fields

- `port`: port flag, usually `"2"`
- `s`: modifier byte
- `x1`..`x6`: key slots
- `rel`: release flag
- `d`: delay
- `v`: optional literal / verbose-style field used by current implementation
- `async_mode`: whether to send asynchronously

### Notes

- Rust examples distinguish uppercase and lowercase by choosing the correct key sequence, instead of auto-inferring text layout.
- Repeated text entry is usually implemented as multiple `key_tap()` calls.

### Example

Type `Hello MKP!` with case sensitivity:

```rust
for key in ["Shift+h", "e", "l", "l", "o", "Space", "Shift+m", "Shift+k", "Shift+p", "Shift+1"] {
    mkp_rust::key_tap(&mut sfport, key, None)?;
}
```

## Output Parser Index

Registered parser kinds in `src/parser.rs`:

| Directive prefix | Parser kind | EOF |
|---|---|---|
| `alog` | plain text success | `cli>` |
| `astop` | plain text stop output | `<EOF>` |
| `acancel` | raw JSON text | `<EOF>` |
| `join` | textual join output | `cli>` |
| `wifi_auto` | textual wifi_auto output | `cli>` |
| `list_dir` | JSON blob extraction | `<EOF>` |
| `alive` | JSON blob extraction | `<EOF>` |
| `atime` | JSON blob extraction | `<EOF>` |
| `aversion` | JSON blob extraction | `<EOF>` |
| `aget` | textual transfer output | `cli>` |
| `aput` | textual transfer output | `cli>` |
| `ajson2log` | textual conversion output | `cli>` |
| `ahttpbase` | JSON blob extraction | `cli>` |
| `adumj` | JSON blob extraction | `cli>` |
| `ainsp` | JSON blob extraction | `cli>` |
| `sn` | JSON blob extraction | `cli>` |

Parser behavior summary:

- `trim_cli_output()` removes the echoed directive, line endings, and trailing EOF markers.
- JSON-style parsers extract the first JSON object from mixed output.
- Some directives end with `cli>` rather than `<EOF>`, so parser registration matters.

## Response Model Index

Common response structs live in `src/models.rs`.

| Directive / helper | Rust model |
|---|---|
| `device_sn()` | `SN` |
| `alive()` | `Heartbeat` |
| `atime()` | `LogLength` |
| `aversion()` | `MKPVersion` |
| `list_dir()` | `FileSystem` |
| `adumj()` | `ActionDump` |
| `ahttpbase()` | `AHTTPBase` |
| `ainspect()` | `LogInfo` |
| `join()` | `Join` |
| `wifi_auto()` | `WifiAuto` |
| `aupload_to_mkp()` | `AGet` |
| `adownload_from_mkp()` | `APut` |
| `ajson2log()` | `AJson2Log` |

## Tools

In addition to the serial SDK, the repository now includes these standalone utilities:

- `converter`: auto-detect `.log` / `.json` conversion direction from the input extension
- `log2json`: compatibility-style `.log -> .json` wrapper
- `json2log`: compatibility-style `.json -> .log` wrapper
- `file_server`: development file server exposing `GET /<path>`, `PUT /<path>`, `POST /upload`, and `GET /list?path=`

Common commands:

```powershell
cargo run --bin converter -- -f D:\tmp\demo.log
cargo run --bin log2json -- -f D:\tmp\demo.log
cargo run --bin json2log -- -f D:\tmp\demo.json
cargo run --bin file_server -- --root D:\tmp\file_root --port 8081
```

## Controller / CLI / Server Mapping

Rust currently exposes MKP operations through four main layers:

- `src/sdk.rs`: serial object, directive transport, and core typed helpers.
- `src/helper.rs`: compatibility-style wrappers and small utility helpers aligned with `mkp-go/helper`.
- `src/controller.rs`: higher-level orchestration plus mouse actions such as `mouse_click()` and `mouse_move_offsets()`.
- `src/server.rs` / `src/cli.rs`: HTTP and CLI entry points.

Layer mapping:

- Device directive helpers in `src/sdk.rs` are the core building blocks.
- `helper.rs` keeps a flatter function-oriented API for callers migrating from Go.
- `Controller` wraps common workflows such as replaying stored records, filesystem operations, and higher-level mouse behavior.
- `server.rs` exposes selected flows over HTTP.
- `cli.rs` exposes selected flows as local command-line commands.

## Known Limitations / Differences from `mkp-go`

- Rust helper names are Rust-idiomatic in a few places and do not always mirror the raw directive name exactly.
- `ainsp` is wrapped by `ainspect()`.
- `aget` / `aput` are wrapped by `aupload_to_mkp()` / `adownload_from_mkp()`.
- Synchronous helpers require an active read loop; forgetting `start_read_loop()` will usually make parsed helpers appear hung or empty.
- `Controller::mouse_move()` / `mouse_move_offsets()` currently use lightweight segmented replay rather than the full trajectory simulator used in `mkp-go`.
- Some server-side cursor movement behavior is still incomplete; consult `src/server.rs` before assuming parity with other ports.












