# MKP Rust Directive Supplement

English | [中文](./directives.md) | [Shared Command Reference](../directives.en.md) | [Rust README](./README.en.md)

---

## Table of Contents

- [Document Scope](#document-scope)
- [Rust Conventions](#rust-conventions)
- [Example Index](#example-index)
- [Rust API Mapping](#rust-api-mapping)
- [Output Parser Index](#output-parser-index)
- [Response Model Index](#response-model-index)
- [Tools and Higher-Level Entry Points](#tools-and-higher-level-entry-points)
- [Known Differences](#known-differences)

## Document Scope

For shared directive semantics, use `../directives.en.md`.

This document keeps only Rust-specific material:

- Rust helper / model naming
- Rust example paths and run commands
- Rust parser registration plus tools / CLI / server mapping
- current gaps where Rust still differs from other ports

## Rust Conventions

- Synchronous helpers usually require `open()` -> `start_read_loop()` -> `set_sync_output_enabled(true)`.
- All paths and commands below are relative to `mkp-kit/rust/`.
- Directive sources live under `examples/directives/<name>/main.rs`.
- Runtime commands still use the short example name, for example `cargo run --example sn`.

## Example Index

| Directive | Source path | Run command | Behavior |
|---|---|---|---|
| `sn` | `examples/directives/sn/main.rs` | `cargo run --example sn --quiet` | Query the device serial number |
| `aversion` | `examples/directives/aversion/main.rs` | `cargo run --example aversion --quiet` | Query version information |
| `alive` | `examples/directives/alive/main.rs` | `cargo run --example alive --quiet` | Query liveness / heartbeat |
| `list_dir` | `examples/directives/list_dir/main.rs` | `cargo run --example list_dir --quiet` | List directories |
| `clean_dir` | `examples/directives/clean_dir/main.rs` | `cargo run --example clean_dir --quiet` | Clean directories |
| `delete_file` | `examples/directives/delete_file/main.rs` | `cargo run --example delete_file --quiet` | Delete files |
| `join` | `examples/directives/join/main.rs` | `cargo run --example join --quiet -- [ssid] [password]` | Connect to Wi‑Fi |
| `wifi_auto` | `examples/directives/wifi_auto/main.rs` | `cargo run --example wifi_auto --quiet -- [0|1]` | Query or set Wi‑Fi auto-connect |
| `ahttpbase` | `examples/directives/ahttpbase/main.rs` | `cargo run --example ahttpbase --quiet -- [url]` | Query or set the file-service base URL |
| `ainsp` | `examples/directives/ainsp/main.rs` | `cargo run --example ainsp --quiet` | Read basic log information |
| `atime` | `examples/directives/atime/main.rs` | `cargo run --example atime --quiet` | Read log duration |
| `adumj` | `examples/directives/adumj/main.rs` | `cargo run --example adumj --quiet -- <log_path>` | Convert a device log into action JSON |
| `aget` | `examples/directives/aget/main.rs` | `cargo run --example aget --quiet -- <filepath>` | Pull a file from the file server into MKP |
| `aput` | `examples/directives/aput/main.rs` | `cargo run --example aput --quiet -- <filepath>` | Upload a file from MKP to the file server |
| `ajson2log` | `examples/directives/ajson2log/main.rs` | `cargo run --example ajson2log --quiet -- <jsonpath> <outputlogpath>` | Convert action JSON back into MKP log format |
| `alog` | `examples/directives/alog/main.rs` | `cargo run --example alog --quiet` | Start synchronous recording |
| `astop` | `examples/directives/astop/main.rs` | `cargo run --example astop --quiet` | Stop the current recording |

## Rust API Mapping

| Directive | Rust helper / API | Return |
|---|---|---|
| `alog` | `start_record()` / `alog()` | text |
| `aplay` | `start_replaying()` | usually async |
| `astop` | `stop_record()` / `astop()` | text |
| `acancel` | `cancel()` | raw JSON text |
| `sn` | `device_sn()` | `SN` |
| `list_dir` | `list_dir()` | `FileSystem` |
| `clean_dir` | `clean_dir()` | text |
| `delete_file` | `delete_file()` | text |
| `join` | `join()` | `Join` |
| `wifi_auto` | `wifi_auto()` | `WifiAuto` |
| `ahttpbase` | `ahttpbase()` | `AHTTPBase` |
| `adumj` | `adumj()` | `ActionDump` |
| `aget` | `aupload_to_mkp()` | `AGet` |
| `aput` | `adownload_from_mkp()` | `APut` |
| `ajson2log` | `ajson2log()` | `AJson2Log` |
| `alive` | `alive()` | `Heartbeat` |
| `atime` | `atime()` | `LogLength` |
| `aversion` | `aversion()` | `MKPVersion` |
| `ainsp` | `ainspect()` | `LogInfo` |
| `m10` | `mouse10()` / `Controller::mouse_move()` | no structured output |
| `kpad` | `keypad()` / `key_tap()` | no structured output |

## Output Parser Index

Rust registers parsers in `src/parser.rs`.

| Directive prefix | Parse mode | EOF / prompt |
|---|---|---|
| `alog` | plain-text success output | `cli>` |
| `astop` | plain-text stop output | `<EOF>` |
| `acancel` | raw JSON text | `<EOF>` |
| `join` / `wifi_auto` | textual status | `cli>` |
| `list_dir` / `alive` / `atime` / `aversion` / `ahttpbase` / `adumj` / `ainsp` / `sn` | JSON extraction | `<EOF>` or `cli>` |
| `aget` / `aput` / `ajson2log` | plain text output | `cli>` |

## Response Model Index

| Rust model | Usage |
|---|---|
| `SN` | `sn` output |
| `Heartbeat` | `alive` output |
| `MKPVersion` | `aversion` output |
| `LogLength` | `atime` output |
| `LogInfo` | `ainsp` output |
| `FileSystem` | `list_dir` output |
| `ActionDump` | `adumj` output |
| `AHTTPBase` | `ahttpbase` output |
| `Join` | `join` output |
| `WifiAuto` | `wifi_auto` output |
| `AGet` | `aget` output |
| `APut` | `aput` output |
| `AJson2Log` | `ajson2log` output |

## Tools and Higher-Level Entry Points

- `src/helper.rs`: compatibility helpers and small utilities
- `src/controller.rs`: higher-level recording, replay, filesystem, and mouse orchestration
- `src/server.rs`: HTTP server
- `src/cli.rs`: CLI client
- `src/bin/`: `mkp`, `mkp-server`, `converter`, `log2json`, `json2log`, `file_server`

## Known Differences

- Rust helper naming is slightly more idiomatic in a few places, for example `ainsp -> ainspect()`.
- `aget` / `aput` map to `aupload_to_mkp()` / `adownload_from_mkp()`.
- `Controller::mouse_move()` / `mouse_move_offsets()` currently use lightweight segmented replay rather than the full trajectory simulator from `mkp-go`.
- Update `../directives.en.md` first when shared directive meaning changes, then record Rust-specific differences under `rust/`.
