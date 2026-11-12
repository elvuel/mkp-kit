# MKP C++ Directive Notes

[中文](./directives.md) | English | [Shared Directives](../directives.en.md) | [C++ README](./README.en.md)

---

This document only supplements the **C++-side directive wrappers, helper naming, CLI / HTTP exposure, and current gaps** under `mkp-kit/cpp/`.

For cross-language directive semantics, argument meaning, and device-visible behavior, use the repository root `../directives.en.md` as the source of truth.

## Document Scope

Recommended reading order:

1. `../directives.en.md`: shared directive semantics across languages
2. `cpp/README.en.md`: C++ usage, build steps, and example entry points
3. This document: C++ naming, wrapper layers, and current differences

## C++ Usage Conventions

Common usage layers:

- Low-level serial object: `mkp::SFSerialPort`
- Higher-level business wrapper: `mkp::Controller`
- Input helpers: `type_text()`, `mouse_click()`, `mouse_move_smooth()`, and related helpers
- CLI: `build\mkp.exe`
- HTTP server: `build\mkp-server.exe`

Typical synchronous calling style:

- Query directives return structs directly, such as `sfport.sn()` and `sfport.atime(path)`
- Input directives usually send immediately, such as `sfport.mouse10(...)` and `type_text(sfport, "Hello")`
- `Controller` wraps record, replay, file, and input operations on top of `SFSerialPort`

## Example Index

All paths below are relative to `mkp-kit/cpp/`.

| Category | Example Path | Description |
|---|---|---|
| Device info | `examples/directives/sn.cpp` / `alive.cpp` / `aversion.cpp` | Query SN, liveness, and version |
| Log info | `examples/directives/atime.cpp` / `ainsp.cpp` | Query duration and log metadata |
| File management | `examples/directives/list_dir.cpp` / `clean_dir.cpp` / `delete_file.cpp` | Browse, clean, and delete device files |
| Network config | `examples/directives/join.cpp` / `wifi_auto.cpp` / `ahttpbase.cpp` | Wi‑Fi and HTTP base configuration |
| Record / replay | `examples/directives/alog.cpp` / `astop.cpp` / `acancel.cpp` | Start, stop, and cancel recording |
| File transfer | `examples/directives/aget.cpp` / `aput.cpp` / `ajson2log.cpp` / `adumj.cpp` | Upload, download, action dump, and conversion |
| Input actions | `examples/m10.cpp` / `examples/kpad.cpp` / `examples/context_keys.cpp` | Mouse move, text input, combos, and release flows |

## C++ API Quick Map

| Shared Directive | C++ API / Helper | Typical Output |
|---|---|---|
| `sn` | `sfport.sn()` / `controller.device_sn()` | `SN` |
| `alive` | `sfport.alive()` / `controller.alive()` | `Heartbeat` |
| `aversion` | `sfport.aversion()` / `controller.aversion()` | `MKPVersion` |
| `atime` | `sfport.atime(path)` / `controller.atime(path)` | `LogLength` |
| `ainsp` | `sfport.ainsp(path)` / `controller.ainsp(path)` | `LogInfo` |
| `list_dir` | `sfport.list_dir(path)` / `controller.list_dir(path)` | `FileSystem` |
| `clean_dir` | `sfport.clean_dir(path)` / `controller.clean_dir(path)` | `std::string` |
| `delete_file` | `sfport.delete_file(path)` / `controller.delete_file(path)` | `std::string` |
| `join` | `sfport.join(opt)` / `controller.join(opt)` | `std::string` |
| `wifi_auto` | `sfport.wifi_auto(opt)` / `controller.wifi_auto(opt)` | `std::string` |
| `ahttpbase` | `sfport.ahttpbase(opt)` / `controller.ahttpbase(opt)` | `AHTTPBase` |
| `alog` | `sfport.alog(name, opt)` / `controller.alog(name, opt)` | `std::string` |
| `astop` | `sfport.astop()` / `controller.astop()` | `std::string` |
| `acancel` | `sfport.acancel()` / `controller.cancel()` | `nlohmann::json` |
| `aget` | `sfport.aget(opt)` / `controller.aget(opt)` | `std::string` |
| `aput` | `sfport.aput(opt)` / `controller.aput(opt)` | `std::string` |
| `ajson2log` | `sfport.ajson2log(opt)` / `controller.ajson2log(opt)` | `std::string` |
| `adumj` | `sfport.adumj(path)` / `controller.adumj(path)` | `ActionDump` |
| `m10` | `sfport.mouse10(opt)` / `controller.mouse_move(...)` | No structured output |
| `kpad` | `sfport.kpad(opt)` / `type_text(...)` / `controller.type_text(...)` | No structured output |

## Debug Output and Timeout Diagnosis

The current C++ implementation has basic diagnostics, but it is still lighter than the Python version:

- Query directives use registered parsers to extract JSON / text results
- Timeout or parse-failure cases keep basic error context
- It does not yet provide Python-style rich persisted debug artifacts with automatic summaries, last successful output, and buffer snapshots

For serial troubleshooting, prefer this order:

- Pass `--port COMx` explicitly
- Validate the link first with simple directives such as `sn` and `alive`
- Then verify structured directives such as `list_dir`, `ahttpbase`, and `atime`

## Return Type Index

| C++ Type | Purpose |
|---|---|
| `SN` | `sn` output |
| `Heartbeat` | `alive` output |
| `MKPVersion` | `aversion` output |
| `LogLength` | `atime` output |
| `LogInfo` | `ainsp` output |
| `FileSystem` | `list_dir` output |
| `ActionDump` | `adumj` output |
| `AHTTPBase` | `ahttpbase` output |
| `SerialPortStatus` | Current serial status snapshot |
| `LogOption` / `JoinOption` / `AGetOption` and related types | Directive option builders |

## Controller / HTTP API / CLI Map

- `Controller`: higher-level proxy for recording, replay, file, and input operations, declared in `include/mkp/controller.hpp`
- HTTP server: `src/server.cpp`
- CLI: `src/cli.cpp`
- file server: `src/file_server.cpp`
- converter: `src/converter.cpp` and `src/bin/*.cpp`

## Current Gaps

Compared with the other language implementations, the current C++ port still has these explicit gaps:

- `mkp-client` is not available yet
- `mkp-server` persists records in a JSON file instead of SQLite
- The CLI only exposes a small common-command subset, not all directives
- `mkp-converter` is usable, but some binary `.log` details are not yet fully aligned with Go / Node
- The current transport and examples are primarily documented for Windows serial environments

## Notes

- Shared directive semantics should be updated in `../directives.en.md` first.
- The C++ language docs only supplement C++ API naming, types, CLI / HTTP exposure, and known limitations.
- If `mkp-client`, SQLite storage, or a more complete CLI are added later, update this file together with `cpp/README.en.md`.
