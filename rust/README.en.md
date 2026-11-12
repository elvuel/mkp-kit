# MKP Rust

English | [中文](./README.md) | [Shared Overview](../README.en.md) | [Shared Command Reference](../directives.en.md) | [Rust Directive Supplement](./directives.en.md)

---

This document only keeps the **Rust-specific usage and differences** for `mkp-kit/rust/`.

Cross-language shared content is maintained at the repository root:

- Shared overview: `../README.en.md`
- Shared command reference: `../directives.en.md`

## Installation

Within the `mkp-kit` monorepo, the Rust implementation lives in the `rust/` subdirectory.

Recommended setup:

- Rust stable toolchain
- Windows serial environment with an MKP device recognized by the OS
- PowerShell or any shell that can run `cargo`

Common setup commands:

```powershell
cd D:\projects\mkp-kit\rust
$env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path
cargo test
cargo check --examples --bins
```

## Quick Start

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

> For helpers that wait for device output, start `start_read_loop()` first and keep `sync_output_enabled=true`.

## Examples

All paths and commands below are relative to `mkp-kit/rust/`.

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

## Rust-Specific Surfaces

### Tools

```powershell
cargo run --bin converter -- -f D:\tmp\demo.log
cargo run --bin log2json -- -f D:\tmp\demo.log
cargo run --bin json2log -- -f D:\tmp\demo.json
cargo run --bin file_server -- --root D:\tmp\file_root --port 8081
```

### HTTP Server

```powershell
$env:MKP_SF_PORT = "COM5"
$env:MKP_JWT_SECRET = "change-me"
$env:MKP_USER = "admin"
$env:MKP_PASSWORD = "admin123"
cargo run --bin mkp-server
```

### CLI

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

## Repository Layout

All paths below are relative to `mkp-kit/rust/`.

| Path | Description |
|---|---|
| `src/sdk.rs` | serial object, directive sending, and core helpers |
| `src/helper.rs` | compatibility wrappers and utility functions aligned with `mkp-go/helper` |
| `src/parser.rs` | built-in raw directive parser registry and parsing logic |
| `src/models.rs` | CLI response models, `M10Option`, `KpadOption`, `MouseMoveOffset`, and related types |
| `src/controller.rs` | higher-level orchestration and advanced mouse actions |
| `src/converter.rs` | core `.log` / `.json` conversion logic |
| `src/server.rs` | Axum HTTP server, SQLite, JWT |
| `src/cli.rs` | Rust CLI client |
| `src/bin/` | `mkp`, `mkp-server`, `converter`, `log2json`, `json2log`, `file_server` |
| `examples/` | top-level `m10` / `kpad` examples plus directive examples under `examples/directives/*/main.rs` |
| `directives.en.md` | Rust directive supplement |

## Rust-Specific Notes

- Rust helper naming is slightly more idiomatic in some places, for example `ainsp -> ainspect()`.
- `aget` / `aput` map to `aupload_to_mkp()` / `adownload_from_mkp()` in the Rust helper layer.
- `Controller::mouse_move()` / `mouse_move_offsets()` currently use lightweight segmented replay instead of the full trajectory simulator from `mkp-go`.
- Firmware output details may vary slightly by version; if parsing fails, inspect the serial debug logs under `.mkp-debug/`.
- When shared directive meaning changes, update the root docs first, then record Rust-specific differences under `rust/`.
