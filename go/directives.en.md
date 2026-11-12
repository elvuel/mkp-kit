# MKP Go Directive Supplement

English | [中文](./directives.md) | [Shared Command Reference](../directives.en.md) | [Go README](./README.en.md)

---

## Table of Contents

- [Document Scope](#document-scope)
- [Go Conventions](#go-conventions)
- [Example Index](#example-index)
- [Go API Mapping](#go-api-mapping)
- [Output Parser Index](#output-parser-index)
- [Response Model Index](#response-model-index)
- [Go-Specific Entry Points](#go-specific-entry-points)
- [Draft or Unwrapped Commands](#draft-or-unwrapped-commands)
- [Notes](#notes)

## Document Scope

For shared directive semantics, use `../directives.en.md`.

This document keeps only Go-specific material:

- `SFSerialPort` / `helper` / `controller` entry points
- Go example paths and run commands
- Go parser and response-model names
- draft items that still mainly exist in the Go-side notes

## Go Conventions

- Default serial type: `*mkpgo.SFSerialPort`
- Synchronous output requires `go sfport.Read()`
- The sync-output field name is `SyncOuputEnabled`
- All paths and commands below are relative to `mkp-kit/go/`

## Example Index

| Directive | Source path | Run command | Behavior |
|---|---|---|---|
| `sn` | `examples/directives/sn/main.go` | `go run .\examples\directives\sn` | Query the device serial number |
| `aversion` | `examples/directives/aversion/main.go` | `go run .\examples\directives\aversion` | Query version information |
| `alive` | `examples/directives/alive/main.go` | `go run .\examples\directives\alive` | Query liveness / heartbeat |
| `list_dir` | `examples/directives/list_dir/main.go` | `go run .\examples\directives\list_dir` | List the built-in `/eMMC` directory |
| `clean_dir` | `examples/directives/clean_dir/main.go` | `go run .\examples\directives\clean_dir` | Clean `/eMMC/applog/subdir1` |
| `delete_file` | `examples/directives/delete_file/main.go` | `go run .\examples\directives\delete_file` | Delete `/eMMC/applog/uuu3.log` |
| `join` | `examples/directives/join/main.go` | `go run .\examples\directives\join [ssid password]` | Connect to Wi‑Fi |
| `wifi_auto` | `examples/directives/wifi_auto/main.go` | `go run .\examples\directives\wifi_auto [0|1]` | Query or set Wi‑Fi auto-connect |
| `ahttpbase` | `examples/directives/ahttpbase/main.go` | `go run .\examples\directives\ahttpbase [http-base-url]` | Query or set the file-service base URL |
| `ainsp` | `examples/directives/ainsp/main.go` | `go run .\examples\directives\ainsp` | Read basic log information |
| `atime` | `examples/directives/atime/main.go` | `go run .\examples\directives\atime` | Read log duration |
| `adumj` | `examples/directives/adumj/main.go` | `go run .\examples\directives\adumj <logPath>` | Convert a device log into action JSON |
| `aget` | `examples/directives/aget/main.go` | `go run .\examples\directives\aget <file-server-path>` | Pull a file from the file server into MKP |
| `aput` | `examples/directives/aput/main.go` | `go run .\examples\directives\aput <mkp-file-path>` | Upload a file from MKP to the file server |
| `ajson2log` | `examples/directives/ajson2log/main.go` | `go run .\examples\directives\ajson2log <jsonpath> <outputlogpath>` | Convert action JSON back into MKP log format |
| `alog` | `examples/directives/alog/main.go` | `go run .\examples\directives\alog` | Start synchronous recording with `subdir1/test` |
| `astop` | `examples/directives/astop/main.go` | `go run .\examples\directives\astop` | Stop the current recording |

## Go API Mapping

| Directive | Go API | Return |
|---|---|---|
| `alog` | `StartRecording` / `helper.Alog` | `string` / plain text |
| `aplay` | `StartReplaying` | usually async |
| `astop` | `StopRecording` / `helper.Astop` | `string` / plain text |
| `acancel` | `CancelReplay` / `helper.Cancel` | `string` / raw JSON text |
| `sn` | `helper.DeviceSN` | `SN` |
| `list_dir` | `helper.ListDir` | `FileSystem` |
| `clean_dir` | `helper.CleanDir` | empty text or error |
| `delete_file` | `helper.DeleteFile` | empty text or error |
| `join` | `helper.Join` / `controller.Controller.Join` | text |
| `wifi_auto` | `helper.WiFiAuto` | text |
| `ahttpbase` | `helper.AHTTPBase` | `AHTTPBase` |
| `adumj` | `helper.Adumj` | `ActionDump` |
| `aget` | `helper.AGet` | text |
| `aput` | `helper.APut` | text |
| `ajson2log` | `helper.AJson2Log` | text |
| `alive` | `helper.Alive` | `Heartbeat` |
| `atime` | `helper.Atime` | `LogLength` |
| `aversion` | `helper.Aversion` | `MKPVersion` |
| `ainsp` | `helper.AInspect` | `LogInfo` |
| `m10` | `Mouse10` / `controller.Controller.MouseMove` | no structured output |
| `kpad` | `Keypad` / `helper.KeyTap` | no structured output |

## Output Parser Index

Go registers built-in parsers through `mkpgo.InitParsers()`.

| Directive prefix | Typical output | Notes |
|---|---|---|
| `alog` | text | recording-success output |
| `astop` | text | stop-recording output |
| `acancel` | JSON / text | cancellation status |
| `join` | text | Wi‑Fi connection status |
| `wifi_auto` | text | auto-connect state |
| `list_dir` | JSON | directory tree |
| `alive` / `atime` / `aversion` / `sn` / `ainsp` / `adumj` / `ahttpbase` | JSON | structured output |
| `aget` / `aput` / `ajson2log` | text | transfer / conversion status |

## Response Model Index

| Go type | Usage |
|---|---|
| `SN` | `sn` output |
| `Heartbeat` | `alive` output |
| `MKPVersion` | `aversion` output |
| `LogLength` | `atime` output |
| `LogInfo` | `ainsp` output |
| `FileSystem` | `list_dir` output |
| `ActionDump` | `adumj` output |
| `AHTTPBase` | `ahttpbase` output |

## Go-Specific Entry Points

- `SFSerialPort` directive methods: root package
- `helper` package: `helper/`
- `controller.Controller`: `controller/`
- Go client commands: `cmd/client/`
- Go HTTP server: `cmd/server/`

## Draft or Unwrapped Commands

These still mainly survive as Go-side draft notes:

- `apause`
- `aresume`

If they become real shared features later, they should move into the root shared docs first.

## Notes

- Update `../directives.en.md` first when shared directive meaning changes.
- This Go supplement should only carry Go API, parser, type naming, and Go-specific limitations.
- Higher-level dragging and human-like movement belong more to Go's `controller` layer than to the shared protocol description.
