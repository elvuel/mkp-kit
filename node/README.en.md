# MKP Node.js / TypeScript

English | [中文](./README.md) | [Shared Overview](../README.en.md) | [Shared Command Reference](../directives.en.md) | [Node Directive Supplement](./directives.en.md)

---

This document only keeps the **Node.js / TypeScript-specific usage and differences** for `mkp-kit/node/`.

Cross-language shared content lives in the monorepo root:

- Shared overview: `../README.en.md`
- Shared command reference: `../directives.en.md`

## Installation

Inside the `mkp-kit` monorepo, the Node.js / TypeScript implementation lives under `node/`.

```powershell
cd D:\projects\mkp-kit\node
npm install
npm run build
```

Current `package.json` expectations:

- package name: `@elvuel/mkp-node`
- currently still `private: true`
- Node.js `>= 20`
- main runtime dependency: `serialport`
- SQLite-backed `mkp-server` persistence has been verified on Node.js `24.x`; if `node:sqlite` is unavailable, use `MKP_DB_DRIVER=memory`

## Quick Start

```ts
import { checkSFSerialPort, deviceSn, newSFSerialPort } from "@elvuel/mkp-node";

async function main(): Promise<void> {
  const portName = process.env.MKP_SERIAL_PORT ?? await checkSFSerialPort();
  const sfport = newSFSerialPort({ name: portName });
  await sfport.open();

  try {
    console.log(await deviceSn(sfport));
  } finally {
    await sfport.close();
  }
}

void main();
```

Synchronous parsing expectations:

- the serial port is already `open()`
- structured output is normally waited through `sendParsed()`
- unlike Go / Python, the Node implementation does not require an explicit external read loop

## Examples

All paths and commands below are relative to `mkp-kit/node/`.

| Example | Source path | Run command | Behavior |
|---|---|---|---|
| `m10` | `examples/m10.ts` | `npm run example:m10` | Demonstrates moving left `400` and then up `400` in dry-run mode |
| `kpad` | `examples/kpad.ts` | `npm run example:kpad` | Prints `Hello MKP!` with case preserved in dry-run mode |
| `keys` | `examples/keys.ts` | `npm run example:keys` | Demonstrates `keyTap`, `keyDown`, `keyUp`, and `keyPresses` |
| `context` | `examples/context.ts` | `npm run example:context` | Demonstrates timeout cancelation and manual cancelation with `AbortSignal` |
| `m10_device` | `examples/m10_device.ts` | `npm run example:m10:device` | Runs `m10` against a real device |
| `kpad_device` | `examples/kpad_device.ts` | `npm run example:kpad:device` | Runs `kpad` against a real device |
| `common` | `examples/common.ts` | Reused by other examples | Provides fixture transport, example-arg parsing, port resolution, and output helpers |

Common directive examples:

| Directive examples | Source path | Run command | Purpose |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/directives/<name>.ts` | `npm run build && node dist/examples/directives/sn.js --help` | Query device serial number, version, and liveness, with shared help output |
| `list_dir` / `clean_dir` / `delete_file` | `examples/directives/<name>.ts` | `npm run build && node dist/examples/directives/list_dir.js /eMMC/applog` | Browse directories, clean directories, and delete files |
| `join` / `wifi_auto` / `ahttpbase` | `examples/directives/<name>.ts` | `npm run build && node dist/examples/directives/join.js <ssid> <password>` | Configure Wi‑Fi, auto-connect, and the HTTP base address |
| `ainsp` / `atime` | `examples/directives/<name>.ts` | `npm run build && node dist/examples/directives/atime.js /eMMC/applog/spike.log` | Read log metadata and duration |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/directives/<name>.ts` | `npm run build && node dist/examples/directives/ajson2log.js D:\tmp\demo.json /eMMC/applog/demo.log` | Upload, download, and convert between JSON and MKP logs |
| `alog` / `astop` | `examples/directives/<name>.ts` | `npm run build && node dist/examples/directives/alog.js mkpdemo/demo` | Start and stop recording |

## Node-Specific Surface Area

### HTTP Server

```powershell
cd D:\projects\mkp-kit\node
npm run build
$env:MKP_SF_PORT = "COM5"
$env:MKP_JWT_SECRET = "change-me"
$env:MKP_USER = "admin"
$env:MKP_PASSWORD = "admin123"
node .\dist\src\bin\mkp-server.js --config .\server.json
```

Primary routes:

- `GET /health`
- `POST /api/v1/auth/token`
- `GET /api/v1/version`
- `GET /api/v1/directives/list`
- `GET /api/v1/directives/records/:id`
- `DELETE /api/v1/directives/records/:id`
- `GET /api/v1/directives/replay/status`
- `POST /api/v1/directives/alog`
- `POST /api/v1/directives/astop`
- `POST /api/v1/directives/aplay/:id`
- `POST /api/v1/directives/acancel`

The current Node server also adds:

- HMAC SHA256 JWT auth tokens
- `server.json` / `MKP_CONFIG_PATH` config loading
- CORS plus `OPTIONS` preflight handling
- `sqlite` / `sqlite3` / `memory` record drivers

### HTTP Client

```powershell
node .\dist\src\bin\mkp-client.js auth login --server http://127.0.0.1:8000 --username admin --password admin123
node .\dist\src\bin\mkp-client.js auth token
node .\dist\src\bin\mkp-client.js list
node .\dist\src\bin\mkp-client.js recording --name demo
node .\dist\src\bin\mkp-client.js stop
node .\dist\src\bin\mkp-client.js replay --id 1
node .\dist\src\bin\mkp-client.js remove --id 1
node .\dist\src\bin\mkp-client.js version
```

`mkp-client` supports a local config file, token caching, token reuse, and version caching.

### CLI

```powershell
node .\dist\src\bin\mkp.js --help
node .\dist\src\bin\mkp.js sn
node .\dist\src\bin\mkp.js m10 --x -400 --y -400
node .\dist\src\bin\mkp.js kpad --text "Hello MKP!"
node .\dist\src\bin\mkp.js raw sn
```

### Converter and File Server

```powershell
node .\dist\src\bin\converter.js -f .\sample.log
node .\dist\src\bin\converter.js -f .\sample.json -o .\out
node .\dist\src\bin\json2log.js -f .\sample.json -o .\sample.log
node .\dist\src\bin\log2json.js -f .\sample.log -o .\sample.json
node .\dist\src\bin\file-server.js -p 8080 -r .\file_root
```

## Repository Layout

All paths below are relative to `mkp-kit/node/`.

| Path | Description |
|---|---|
| `package.json` | Node package manifest, bin entrypoints, and scripts |
| `src/sdk.ts` | serial-port object, directive sending, and basic helpers |
| `src/parser.ts` | parser registration and output parsing logic |
| `src/models.ts` | result interfaces and option types |
| `src/helper.ts` | keyboard / mouse helper functions |
| `src/controller.ts` | higher-level orchestration and business helpers |
| `src/cli.ts` | `mkp` serial CLI |
| `src/client.ts` | `mkp-client` HTTP client CLI |
| `src/server.ts` | main HTTP server implementation |
| `src/server_config.ts` | `server.json` and `--config` parsing |
| `src/converter.ts` | `.log` / `.json` conversion |
| `src/file_server.ts` | file server |
| `examples/` | `m10` / `kpad` / `keys` / `context` / directive examples |
| `directives.en.md` | Node directive supplement |

## Node-Specific Notes

- `examples/directives/*` now default to a real device; for offline parser demos, explicitly add `--fixture` to use canned responses.
- `examples/m10.ts` and `examples/kpad.ts` use `DryRunTransport` by default; directive examples use a real device by default and support `MKP_SERIAL_PORT` / `--port COMx` for port selection.
- `examples/context.ts` demonstrates a Node-side cancellation wrapper based on `AbortSignal`; it is not a one-to-one API match for Go `context.Context`.
- `join` / `wifi_auto` / `aget` / `aput` / `ajson2log` still return plain text in Node, instead of dedicated response models used in some other language implementations.
- `mkp-server` currently supports only `sqlite`, `sqlite3`, and `memory`; MySQL / PostgreSQL driver parity with Go can be added later.
- When shared directive meaning changes, update the monorepo root docs first, then record the Node-specific differences under `node/`.




