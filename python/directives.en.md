# MKP Python Directive Supplement

English | [中文](./directives.md) | [Shared Command Reference](../directives.en.md) | [Python README](./README.en.md)

---

## Table of Contents

- [Document Scope](#document-scope)
- [Python Conventions](#python-conventions)
- [Example Index](#example-index)
- [Python API Mapping](#python-api-mapping)
- [Common Exceptions and Debugging](#common-exceptions-and-debugging)
- [Response Model Index](#response-model-index)
- [Controller HTTP API and CLI Mapping](#controller-http-api-and-cli-mapping)
- [Notes](#notes)

## Document Scope

For shared directive semantics, use `../directives.en.md`.

This document keeps only Python-specific material:

- Python helper / dataclass mappings
- Python example paths and run commands
- Python's automatic debug-summary behavior
- Python HTTP server and CLI exposure

## Python Conventions

- Before synchronous parsing, call `open()`, `reset_input_buffer()`, and `start_read_loop()`.
- `send_parsed()` is suitable for structured waiting only when `sync_output_enabled = True`.
- All paths and commands below are relative to `mkp-kit/python/`.
- `examples.common.init_sfport()` is the recommended initialization flow.

## Example Index

| Directive | Source path | Run command | Behavior |
|---|---|---|---|
| `sn` | `examples/directives/sn.py` | `python -m examples.directives.sn` | Query the device serial number |
| `aversion` | `examples/directives/aversion.py` | `python -m examples.directives.aversion` | Query version information |
| `alive` | `examples/directives/alive.py` | `python -m examples.directives.alive` | Query liveness / heartbeat |
| `list_dir` | `examples/directives/list_dir.py` | `python -m examples.directives.list_dir` | List directories |
| `clean_dir` | `examples/directives/clean_dir.py` | `python -m examples.directives.clean_dir` | Clean directories |
| `delete_file` | `examples/directives/delete_file.py` | `python -m examples.directives.delete_file` | Delete files |
| `join` | `examples/directives/join.py` | `python -m examples.directives.join [ssid] [password]` | Connect to Wi‑Fi |
| `wifi_auto` | `examples/directives/wifi_auto.py` | `python -m examples.directives.wifi_auto [0|1]` | Query or set Wi‑Fi auto-connect |
| `ahttpbase` | `examples/directives/ahttpbase.py` | `python -m examples.directives.ahttpbase [url]` | Query or set the file-service base URL |
| `ainsp` | `examples/directives/ainsp.py` | `python -m examples.directives.ainsp` | Read basic log information |
| `atime` | `examples/directives/atime.py` | `python -m examples.directives.atime` | Read log duration |
| `adumj` | `examples/directives/adumj.py` | `python -m examples.directives.adumj <log_path>` | Convert a device log into action JSON |
| `aget` | `examples/directives/aget.py` | `python -m examples.directives.aget <filepath>` | Pull a file from the file server into MKP |
| `aput` | `examples/directives/aput.py` | `python -m examples.directives.aput <filepath>` | Upload a file from MKP to the file server |
| `ajson2log` | `examples/directives/ajson2log.py` | `python -m examples.directives.ajson2log <jsonpath> <outputlogpath>` | Convert action JSON back into MKP log format |
| `alog` | `examples/directives/alog.py` | `python -m examples.directives.alog [log_name]` | Start synchronous recording |
| `astop` | `examples/directives/astop.py` | `python -m examples.directives.astop` | Stop the current recording |

## Python API Mapping

| Directive | Python helper / method | Return |
|---|---|---|
| `alog` | `alog()` / `Controller.alog()` | `None` / `str` |
| `aplay` | `sfport.start_replaying()` / `Controller.start_replaying()` | `None` |
| `astop` | `astop()` / `stop_record()` | `None` / `str` |
| `acancel` | `cancel()` | `dict` / `str` / empty text |
| `sn` | `device_sn()` | `SN` |
| `list_dir` | `list_dir()` | `FileSystem` |
| `clean_dir` | `clean_dir()` | `str` |
| `delete_file` | `delete_file()` | `str` |
| `join` | `join()` | `str` |
| `wifi_auto` | `wifi_auto()` | `str` |
| `ahttpbase` | `ahttpbase()` | `AHTTPBase` |
| `adumj` | `adumj()` | `ActionDump` |
| `aget` | `aupload_to_mkp()` | `AGet` / text |
| `aput` | `adownload_from_mkp()` | `APut` / text |
| `ajson2log` | `ajson2log()` | `AJson2Log` / text |
| `alive` | `alive()` | `Heartbeat` |
| `atime` | `atime()` | `LogLength` |
| `aversion` | `aversion()` | `MKPVersion` |
| `ainsp` | `ainspect()` | `LogInfo` |
| `m10` | `mouse10()` | no structured output |
| `kpad` | `keypad()` / `key_tap()` | no structured output |

## Common Exceptions and Debugging

When synchronous waiting times out, or a parser cannot extract the expected payload:

- the Python port writes raw serial artifacts into `.mkp-debug/`
- the directory can be overridden with `MKP_DEBUG_SERIAL_DIR`
- debug files typically include an auto summary, the original directive, raw serial output, the pending buffer, the last successful synchronous output, and the latest read error

This is one of the strongest Python-specific troubleshooting features compared with the other ports.

## Response Model Index

| Python dataclass | Usage |
|---|---|
| `SN` | `sn` output |
| `Heartbeat` | `alive` output |
| `MKPVersion` | `aversion` output |
| `LogLength` | `atime` output |
| `LogInfo` | `ainsp` output |
| `FileSystem` | `list_dir` output |
| `ActionDump` | `adumj` output |
| `AHTTPBase` | `ahttpbase` output |

## Controller HTTP API and CLI Mapping

- `Controller`: higher-level recording, replay, filesystem, and input orchestration
- HTTP server: `src/mkp_python/server.py`
- CLI: `src/mkp_python/cli.py`
- file server: `mkp-file-server`
- converter tools: `mkp-converter` / `mkp-log2json` / `mkp-json2log`

## Notes

- Update `../directives.en.md` first when shared directive meaning changes.
- This Python supplement should only carry Python helper names, debugging behavior, CLI / HTTP exposure, and dataclass naming.
- `send_parsed()` chooses the parser; higher-level helpers then convert `dict` payloads into dataclass models.
