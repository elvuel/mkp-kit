# MKP Rust

English | [中文](./README.md) | [Command Reference](./directives.en.md) | [Implementation Spec](./docs/implement-spec.md)

---

### What is MKP?

In this project, **MKP** means a serial-controlled **mouse / keyboard recording, replay, and file-management device protocol**.

It usually runs on an external USB HID-capable board or firmware. A host program sends directives such as `m10`, `kpad`, `alog`, `aplay`, and `list_dir` to the MKP device over a serial port. The device then emits USB HID mouse / keyboard events to a target machine, or performs device-side recording, replay, inspection, and file management for input logs.

`mkp-rust` is the Rust SDK / client library for the MKP protocol plus its supporting service implementation. It currently focuses on:

- a serial SDK with synchronous / asynchronous directive sending;
- a `helper` / `Controller` compatibility layer;
- an HTTP server and a CLI client;
- `.log` / `.json` conversion tools and a development file server.

> In short: **MKP is the hardware / firmware-side mouse-keyboard automation and replay protocol; MKP Rust is the Rust library and service implementation for controlling it.**

### Project Scope

`mkp-rust` is not a local OS-native mouse / keyboard automation library. Its main data path is:

```text
Rust program -> Serial port -> MKP device / firmware -> USB HID mouse / keyboard events -> Target system
```

It fits scenarios where you need to:

- drive input through an external HID device;
- record, store, inspect, replay, and transfer input logs on-device;
- wrap MKP CLI directives as a Rust SDK, HTTP API, or CLI.

### Features

| Area | Description | Entry points |
|---|---|---|
| Serial connection | Open port, run reader loop, wait synchronously, inspect status | `new_sf_serial_port()` / `SFSerialPort` |
| Raw directives | Sync send, async send, parser-driven structured decoding | `send_directive()` / `send_directive_async()` / `send_parsed()` |
| Helper compatibility layer | Rust-facing wrappers and small utilities aligned with `mkp-go/helper` | `src/helper.rs` / `m10()` / `auto_m10_duration()` |
| Mouse control | Relative move, buttons, wheel, release-all | `m10` / `mouse10()` / `mouse_release_all()` |
| Higher-level mouse actions | Click, scroll, segmented move, offset-sequence move | `Controller::mouse_click()` / `mouse_scroll()` / `mouse_move()` / `mouse_move_offsets()` |
| Keyboard control | down / up / tap / combo / release-all | `kpad` / `keypad()` / `key_tap()` / `keypad_release_all()` |
| Recording / replay | Start recording, stop, cancel replay, start replay | `alog` / `astop` / `acancel` / `aplay` |
| File and device info | `sn`, `list_dir`, `clean_dir`, `delete_file`, `alive`, `atime`, `aversion`, `ainsp` | helpers and `Controller` |
| Standalone tools | log / json conversion and development file server | `converter` / `log2json` / `json2log` / `file_server` |
| HTTP server | Health, auth, record list, replay control | `mkp-server` |
| CLI | `version`, `list`, `record start`, `stop`, `replay`, `cancel`, `remove`, `auth *` | `mkp` |

See the full command reference in [`directives.en.md`](./directives.en.md).

## Installation

Recommended setup:

- Rust stable toolchain
- Windows serial environment with an MKP device recognized by the OS
- PowerShell or any shell that can run `cargo`

Common setup commands:

```powershell
cd D:\projects\mkp-rust
$env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path
cargo test
cargo check --examples --bins
```

## Quick Start

### 1. Run Existing Examples

```powershell
$env:MKP_SF_PORT = "COM5"
cargo run --example sn --quiet
cargo run --example aversion --quiet
cargo run --example alive --quiet
```

### 2. Minimal Serial SDK Example

```rust
use mkp_rust::{device_sn, new_sf_serial_port};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut sfport = new_sf_serial_port();
    sfport.name = "COM5".to_string();
    sfport.open()?;
    sfport.start_read_loop()?;
    sfport.set_sync_output_enabled(true);

    let sn = device_sn(&mut sfport, None)?;
    println!("device sn: {}", sn.sn);

    sfport.close()?;
    Ok(())
}
```

> For helpers that wait for device output, start the read loop first and keep `sync_output_enabled=true`.

## Examples

The table below uses the same format across languages: source path, run command, and observed behavior.

| Example | Source path | Run command | Behavior |
|---|---|---|---|
| `m10` | `examples/m10.rs` | `cargo run --example m10 --quiet` | Moves the mouse left by `400`, then up by `400` |
| `kpad` | `examples/kpad.rs` | `cargo run --example kpad --quiet` | Types `Hello MKP!` with correct case |
| `support` | `examples/support/common.rs` | Reused by other examples | Provides serial setup, stop-record, and logging helpers |

Rust directive sources live under `examples/directives/<name>/main.rs`, while the run commands still use the short Cargo example names:

| Directive examples | Source path | Run command | Purpose |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/directives/<name>/main.rs` | `cargo run --example sn --quiet` | Query device serial number, version, and liveness |
| `list_dir` / `clean_dir` / `delete_file` | `examples/directives/<name>/main.rs` | `cargo run --example list_dir -- /eMMC/applog` | Browse directories, clean directories, and delete files |
| `join` / `wifi_auto` / `ahttpbase` | `examples/directives/<name>/main.rs` | `cargo run --example join -- <ssid> <password>` | Configure Wi‑Fi, auto-connect, and HTTP base address |
| `ainsp` / `atime` | `examples/directives/<name>/main.rs` | `cargo run --example atime -- /eMMC/applog/spike.log` | Inspect log metadata and duration |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/directives/<name>/main.rs` | `cargo run --example ajson2log -- D:\tmp\demo.json /eMMC/applog/demo.log` | Upload, download, and convert between JSON and MKP logs |
| `alog` / `astop` | `examples/directives/<name>/main.rs` | `cargo run --example alog -- mkpdemo/demo` | Start and stop device-side recording |

## Tools

The repository now includes basic standalone tools corresponding to `mkp-go/tools`:

```powershell
cargo run --bin converter -- -f D:\tmp\demo.log
cargo run --bin log2json -- -f D:\tmp\demo.log
cargo run --bin json2log -- -f D:\tmp\demo.json
cargo run --bin file_server -- --root D:\tmp\file_root --port 8081
```

Notes:

- `converter`: auto-detects conversion direction from file extension
- `log2json`: compatibility wrapper matching `mkp-go/tools/log2json`
- `json2log`: compatibility wrapper matching `mkp-go/tools/json2log`
- `file_server`: development helper exposing `GET /<path>`, `PUT /<path>`, `POST /upload`, and `GET /list?path=`

## HTTP Server

Startup example:

```powershell
$env:MKP_SF_PORT = "COM5"
$env:MKP_JWT_SECRET = "change-me"
$env:MKP_USER = "admin"
$env:MKP_PASSWORD = "admin123"
cargo run --bin mkp-server
```

Current route set:

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

Main environment variables:

- `MKP_SF_PORT` / `SF_PORT`
- `MKP_PORT` / `PORT`, default `8080`
- `MKP_JWT_SECRET` / `JWT_SECRET`
- `MKP_USER` / `JWT_USER`
- `MKP_PASSWORD` / `JWT_PASSWORD`
- `MKP_DATABASE_URL`, default `sqlite:///mkp.db`
- `MKP_SYNC_DIRECTIVE_TIMEOUT_MS`
- `MKP_ASYNC_DIRECTIVE_TIMEOUT_MS`
- `MKP_DB_TIMEOUT_MS`
- `MKP_REPLAY_COMPLETION_GRACE_MS`
- `MKP_REPLAY_MIN_DURATION_MS`

## CLI

The Rust CLI currently follows `mkp-python`:

```powershell
cargo run --bin mkp -- auth login admin admin123
cargo run --bin mkp -- version
cargo run --bin mkp -- list --limits 10
cargo run --bin mkp -- record start demo --width 1920 --height 1080 --stposx 10 --stposy 20
cargo run --bin mkp -- stop
cargo run --bin mkp -- replay <record_id>
cargo run --bin mkp -- cancel
cargo run --bin mkp -- remove <record_id>
cargo run --bin mkp -- auth token
cargo run --bin mkp -- auth revoke --forget
```

CLI defaults:

- Default server: `http://127.0.0.1:8080`
- Default timeout: `15` seconds
- Local config path: `~/.mkp/client.json`
- If an authenticated request has no stored token but has saved username / password, the CLI auto-logins and persists the token

## Repository Layout

| Path | Description |
|---|---|
| `src/sdk.rs` | Serial port object, directive sending, and core helper implementations |
| `src/helper.rs` | Rust compatibility wrappers and utility functions matching `mkp-go/helper` |
| `src/parser.rs` | Built-in raw directive parser registry and parse logic |
| `src/models.rs` | CLI response models, `M10Option`, `KpadOption`, `MouseMoveOffset`, and related types |
| `src/controller.rs` | Higher-level wrapper plus advanced mouse actions |
| `src/converter.rs` | Core `.log` / `.json` conversion logic |
| `src/server.rs` | Axum HTTP server, SQLite, JWT |
| `src/cli.rs` | Rust CLI client |
| `src/bin/` | `mkp`, `mkp-server`, `converter`, `log2json`, `json2log`, `file_server` |
| `examples/` | Top-level `m10` / `kpad` examples plus directive examples under `examples/directives/*/main.rs` |
| `docs/implement-spec.md` | Current Rust port implementation notes |

## Current Differences from `mkp-go`

- `mkp-rust` already includes an HTTP server, CLI, converter, and file server; `mkp-go` is still more mature in mouse-trajectory simulation and long-lived helper/controller design
- The `ainsp` directive maps to the Rust helper `ainspect()`
- `aget` / `aput` map to `aupload_to_mkp()` / `adownload_from_mkp()` in the Rust helper layer
- Rust `Controller` now includes higher-level actions such as `mouse_click()`, `mouse_scroll()`, `mouse_move()`, and `mouse_move_offsets()`, but the movement strategy is still intentionally lightweight

## Notes

- Structured sync helpers depend on the reader loop: call `open()` and `start_read_loop()` first
- `m10` and `kpad` are async by default; switch to sync-ignore-output mode when ordering matters
- `Controller::mouse_move()` / `mouse_move_offsets()` currently use lightweight segmented replay, not the full trajectory simulator from `mkp-go`
- `clean_dir()` and `delete_file()` are restricted to `/eMMC/applog` to reduce accidental destructive operations
- `LogOption` intentionally keeps the firmware CLI spelling `--heigh`, not `--height`
- Firmware output details may vary by version; if parsing fails, inspect the serial debug logs saved under `.mkp-debug/`

















