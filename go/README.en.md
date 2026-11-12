# MKP Go

English | [中文](./README.md) | [Shared Overview](../README.en.md) | [Shared Command Reference](../directives.en.md) | [Go Directive Supplement](./directives.en.md) | [Controller.MouseMove Guide](./doc/controller_mouse_move.en.md)

---

This document only keeps the **Go-specific usage and differences** for `mkp-kit/go/`.

Cross-language shared content—MKP background, shared directive semantics, and shared maintenance policy—is maintained at the repository root:

- Shared overview: `../README.en.md`
- Shared command reference: `../directives.en.md`

## Installation

Within the `mkp-kit` monorepo, the Go implementation lives in the `go/` subdirectory.

```bash
go get github.com/elvuel/mkp-kit/go
```

Current `go/go.mod` declaration:

```text
module github.com/elvuel/mkp-kit/go
go 1.25.0
```

## Quick Start

```go
package main

import (
    "fmt"

    mkpgo "github.com/elvuel/mkp-kit/go"
    "github.com/elvuel/mkp-kit/go/helper"
)

func main() {
    sfport := mkpgo.NewSFSerialPort()
    sfport.Name = "COM5"

    if err := sfport.Open(); err != nil {
        panic(err)
    }
    defer sfport.Close()

    go sfport.Read()

    sn, err := helper.DeviceSN(sfport)
    if err != nil {
        panic(err)
    }
    fmt.Println(sn.SN)
}
```

> For helpers that parse synchronous output, start `go sfport.Read()` first and keep `SyncOuputEnabled=true`.

## Examples

All paths and commands below are relative to `mkp-kit/go/`.

| Example | Source path | Run command | Behavior |
|---|---|---|---|
| `m10` | `examples/m10/main.go` | `go run .\examples\m10` | Demonstrates relative mouse movement plus button press/release |
| `kpad` | `examples/kpad/main.go` | `go run .\examples\kpad` | Demonstrates text input, key combos, and auto release |
| `keys` | `examples/keys/main.go` | `go run .\examples\keys` | Demonstrates `helper.KeyTap`, `KeyDown`, and `KeyUp` |
| `context` | `examples/context/main.go` | `go run .\examples\context` | Demonstrates timeout cancelation and manual cancelation with `context` |
| `commonpkg` | `examples/commonpkg/common.go` | Reused by other examples | Provides serial initialization, stop-record, and logging helpers |

Common directive examples:

| Directive examples | Source path | Run command | Purpose |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/directives/<name>/main.go` | `go run .\examples\directives\sn` | Query device serial number, version, and liveness |
| `list_dir` / `clean_dir` / `delete_file` | `examples/directives/<name>/main.go` | `go run .\examples\directives\list_dir /eMMC/applog` | Browse directories, clean directories, and delete files |
| `join` / `wifi_auto` / `ahttpbase` | `examples/directives/<name>/main.go` | `go run .\examples\directives\join <ssid> <password>` | Configure Wi‑Fi, auto-connect, and HTTP base address |
| `ainsp` / `atime` | `examples/directives/<name>/main.go` | `go run .\examples\directives\atime /eMMC/applog/spike.log` | Inspect log metadata and duration |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/directives/<name>/main.go` | `go run .\examples\directives\ajson2log D:\tmp\demo.json /eMMC/applog/demo.log` | Upload, download, and convert between JSON and MKP logs |
| `alog` / `astop` | `examples/directives/<name>/main.go` | `go run .\examples\directives\alog mkpdemo/demo` | Start and stop device-side recording |

## Go-Specific Surface Area

- `helper/`: business-oriented helper functions
- `controller/`: higher-level mouse / keyboard controller
- `cmd/client/`: Go client command entry points
- `cmd/server/`: Go HTTP server implementation
- `doc/controller_mouse_move*.md`: Go-specific mouse trajectory guide

## Repository Layout

All paths below are relative to `mkp-kit/go/`.

| Path | Description |
|---|---|
| `go.mod` | Go module declaration with module path `github.com/elvuel/mkp-kit/go` |
| `helper/` | business-facing helper wrappers |
| `controller/` | higher-level mouse / keyboard controller |
| `cmd/client/` | Go client command entry points |
| `cmd/server/` | Go HTTP server, config, and models |
| `examples/` | `m10` / `kpad` / directive examples |
| `directives.en.md` | Go directive supplement |

## Notes

- For synchronous commands, make sure `SyncOuputEnabled=true` and `go sfport.Read()` is running.
- `m10` / `kpad` are asynchronous by default. Use `WithAsync(false)` or `WithSyncIgnoreOutput(true)` when you need ordering while ignoring output.
- File deletion / cleaning helpers are intentionally limited to `/eMMC/applog`.
- When shared directive meaning changes, update the root docs first, then record Go-specific differences under `go/`.
