# MKP Node.js / TypeScript Directive Supplement

English | [中文](./directives.md) | [Shared Command Reference](../directives.en.md) | [Node README](./README.en.md)

---

## Table of Contents

- [Scope](#scope)
- [Node Conventions](#node-conventions)
- [Example Index](#example-index)
- [Node API Mapping](#node-api-mapping)
- [Output Parser Index](#output-parser-index)
- [Response Model Index](#response-model-index)
- [Controller / HTTP API / CLI Mapping](#controller--http-api--cli-mapping)
- [Known Differences](#known-differences)

## Scope

For shared directive semantics, read the monorepo root document directly: `../directives.en.md`.

This file only keeps Node.js / TypeScript-specific content:

- Node helper / interface mappings
- Node example paths and run commands
- Node parser EOF / prompt expectations
- Node HTTP server / HTTP client CLI / serial CLI exposure

## Node Conventions

- All paths and commands below are relative to `mkp-kit/node/`
- Run `npm run build` before examples when in doubt
- `examples/directives/*` default to a real device; add `--fixture` when you want offline canned parser responses
- `examples/m10.ts` / `examples/kpad.ts` default to `DryRunTransport`
- For real hardware, provide `MKP_SERIAL_PORT` or `--port COMx`; passing `--fixture` disables the real serial port and uses canned responses instead
- Synchronous parsing is completed inside `sendParsed()`; the Node implementation does not require an external explicit read loop
- All `examples/directives/*` examples support the same `-h` / `--help` output format

## Example Index

| Directive | Source path | Run command | Behavior |
|---|---|---|---|
| `sn` | `examples/directives/sn.ts` | `npm run build && node dist/examples/directives/sn.js` | Query the device serial number |
| `aversion` | `examples/directives/aversion.ts` | `npm run build && node dist/examples/directives/aversion.js` | Query version information with `uver` / `aver` |
| `alive` | `examples/directives/alive.ts` | `npm run build && node dist/examples/directives/alive.js` | Query liveness / heartbeat |
| `list_dir` | `examples/directives/list_dir.ts` | `npm run build && node dist/examples/directives/list_dir.js /eMMC/applog` | List directories |
| `clean_dir` | `examples/directives/clean_dir.ts` | `npm run build && node dist/examples/directives/clean_dir.js /eMMC/applog` | Clean directories |
| `delete_file` | `examples/directives/delete_file.ts` | `npm run build && node dist/examples/directives/delete_file.js /eMMC/applog/demo.log` | Delete files |
| `join` | `examples/directives/join.ts` | `npm run build && node dist/examples/directives/join.js [ssid] [password]` | Connect to Wi‑Fi |
| `wifi_auto` | `examples/directives/wifi_auto.ts` | `npm run build && node dist/examples/directives/wifi_auto.js [0|1]` | Query or set Wi‑Fi auto-connect |
| `ahttpbase` | `examples/directives/ahttpbase.ts` | `npm run build && node dist/examples/directives/ahttpbase.js [url]` | Query or set the file-service base URL |
| `ainsp` | `examples/directives/ainsp.ts` | `npm run build && node dist/examples/directives/ainsp.js /eMMC/applog/demo.log` | Read basic log metadata with `seconds` / `milsec` / `width` / `heigh` / `stpos` |
| `atime` | `examples/directives/atime.ts` | `npm run build && node dist/examples/directives/atime.js /eMMC/applog/spike.log` | Read log duration |
| `adumj` | `examples/directives/adumj.ts` | `npm run build && node dist/examples/directives/adumj.js /eMMC/applog/demo.log` | Convert a device log into action JSON |
| `aget` | `examples/directives/aget.ts` | `npm run build && node dist/examples/directives/aget.js <filepath>` | Pull a file from the file server into MKP |
| `aput` | `examples/directives/aput.ts` | `npm run build && node dist/examples/directives/aput.js <filepath>` | Upload a file from MKP to the file server |
| `ajson2log` | `examples/directives/ajson2log.ts` | `npm run build && node dist/examples/directives/ajson2log.js <jsonpath> <outputlogpath>` | Convert action JSON back into MKP log format |
| `alog` | `examples/directives/alog.ts` | `npm run build && node dist/examples/directives/alog.js [log_name]` | Start synchronous recording |
| `astop` | `examples/directives/astop.ts` | `npm run build && node dist/examples/directives/astop.js` | Stop the current recording |

## Node API Mapping

| Directive | Node helper / method | Return |
|---|---|---|
| `alog` | `alog()` / `Controller.alog()` / `SerialPort.alog()` | `string` |
| `aplay` | `SerialPort.startReplaying()` / `Controller.startReplaying()` | `Promise<void>` |
| `astop` | `stopRecord()` / `Controller.stopRecord()` / `Controller.astop()` | `string` |
| `acancel` | `cancel()` / `Controller.cancel()` / `SerialPort.cancelReplay()` | `unknown` |
| `sn` | `deviceSn()` / `Controller.deviceSn()` / `sfport.sn()` | `SN` |
| `list_dir` | `listDir()` / `Controller.listDir()` / `sfport.listDir()` | `FileSystem` |
| `clean_dir` | `cleanDir()` / `Controller.cleanDir()` / `sfport.cleanDir()` | `string` |
| `delete_file` | `deleteFile()` / `Controller.deleteFile()` / `sfport.deleteFile()` | `string` |
| `join` | `join()` / `Controller.join()` / `sfport.join()` | `string` |
| `wifi_auto` | `wifiAuto()` / `Controller.wifiAuto()` / `sfport.wifiAuto()` | `string` |
| `ahttpbase` | `ahttpbase()` / `Controller.ahttpbase()` / `sfport.ahttpbase()` | `AHTTPBase` |
| `adumj` | `adumj()` / `Controller.adumj()` / `sfport.adumj()` | `ActionDump` |
| `aget` | `auploadToMkp()` / `Controller.auploadToMkp()` / `sfport.aget()` | `string` |
| `aput` | `adownloadFromMkp()` / `Controller.adownloadFromMkp()` / `sfport.aput()` | `string` |
| `ajson2log` | `ajson2log()` / `Controller.ajson2log()` / `sfport.ajson2log()` | `string` |
| `alive` | `alive()` / `Controller.alive()` / `sfport.alive()` | `Heartbeat` |
| `atime` | `atime()` / `Controller.atime()` / `sfport.atime()` | `LogLength` |
| `aversion` | `aversion()` / `Controller.aversion()` / `sfport.aversion()` | `MKPVersion` |
| `ainsp` | `ainsp()` / `ainspect()` / `Controller.ainsp()` / `Controller.ainspect()` | `LogInfo` |
| `m10` | `m10()` / `sfport.mouse10()` / `Controller.mouseMove()` | no structured output |
| `kpad` | `typeText()` / `keyTap()` / `sfport.keypad()` / `Controller.keyTap()` | no structured output |

## Output Parser Index

Node registers parsers in `src/parser.ts`.

| Directive prefix | Parse mode | EOF / prompt |
|---|---|---|
| `alog` | plain-text success output | `cli>` |
| `astop` | plain-text stop output | `cli>` |
| `acancel` | raw JSON text, empty output allowed | `<EOF>` |
| `clean_dir` / `delete_file` | plain-text status output | `cli>` |
| `join` / `wifi_auto` | plain-text status output | `cli>` |
| `aget` / `aput` / `ajson2log` | plain-text output | `cli>` |
| `sn` / `alive` / `aversion` / `list_dir` | JSON extraction | `<EOF>` |
| `ainsp` / `atime` | line-JSON extraction | `<EOF>` |
| `adumj` | JSON extraction | `cli>` |
| `ahttpbase` | dedicated parser: JSON first, URL-line fallback | `cli>` |

## Response Model Index

| Node interface | Usage |
|---|---|
| `SN` | `sn` output |
| `Heartbeat` | `alive` output |
| `MKPVersion` | `aversion` output; canonical fields are `uver` / `aver` |
| `LogLength` | `atime` output; canonical fields are `seconds` / `milsec` |
| `LogInfo` | `ainsp` output; canonical fields are `seconds` / `milsec` / `width` / `heigh` / `stpos` |
| `FileSystem` | `list_dir` output |
| `ActionDump` | `adumj` output |
| `AHTTPBase` | `ahttpbase` output |
| `SerialPortStatus` | `snapshotStatus()` output |
| `LogOption` / `JoinOption` / `WifiAutoOption` / `AGetOption` / `APutOption` / `AJSON2LogOption` / `AHTTPBaseOption` | directive option types |
| `M10Option` / `KpadOption` / `MouseMoveOffset` | mouse / keyboard / controller option types |

## Controller / HTTP API / CLI Mapping

- `src/helper.ts`: helper functions such as `m10`, `typeText`, `keyTap`, `keyDown`, `keyUp`, and `keyPresses`
- `src/controller.ts`: higher-level recording, replay, filesystem, keyboard, and mouse orchestration
- `src/cli.ts`: `mkp` serial CLI
- `src/client.ts`: `mkp-client` HTTP client CLI
- `src/server.ts`: HTTP server
- `src/server_config.ts`: `server.json` / `--config` parsing
- `src/bin/`: `mkp`, `mkp-client`, `mkp-server`, `converter`, `log2json`, `json2log`, `file-server`

## Known Differences

- Node directive examples now default to real-device execution, while `--fixture` remains available for offline canned responses.
- Node does not currently include the Python-style automatic serial debug summary and `.mkp-debug/` dump mechanism.
- `aversion` is now aligned to `uver` / `aver`; the parser still accepts older firmware payloads that expose `app` / `boot`.
- `ainsp` is now aligned to `seconds` / `milsec` / `width` / `heigh` / `stpos` rather than using `name` / `path` / `size` as its primary response structure.
- `join` / `wifi_auto` / `aget` / `aput` / `ajson2log` still return plain text on the Node side rather than dedicated structured response models.
- `astop` in the Node parser currently waits for the `cli>` prompt, which differs from some other language implementations.
- `examples/context.ts` demonstrates an `AbortSignal` wrapper pattern rather than a direct API mapping of Go `context.Context`.
- When shared directive meaning changes, update `../directives.en.md` first and then record the Node-specific differences here.
