# MKP .NET

English | [中文](./README.md) | [Shared Overview](../README.en.md) | [Shared Directives](../directives.en.md) | [.NET Directive Supplement](./directives.en.md)

---

This document only covers **.NET-specific usage and differences** under `mkp-kit/dotnet/`.

Cross-language shared content lives at the repository root:

- shared overview: `../README.en.md`
- shared directives: `../directives.en.md`

## Installation

Inside the `mkp-kit` monorepo, the `.NET` implementation lives in `dotnet/`.

```powershell
cd D:\projects\mkp-kit\dotnet
dotnet build .\MkpKit.sln -c Debug
dotnet test .\MkpKit.sln -c Debug --no-build --no-restore
```

Current implementation notes:

- target framework: `net10.0`, so use the `.NET 10 SDK`
- the implementation is currently maintained as monorepo source, not as a separately published NuGet package
- core projects: `MkpKit`, `MkpKit.Cli`, `MkpKit.Client`, `MkpKit.Server`, `MkpKit.FileServer`, and `MkpKit.Converter`

## Quick Start

```csharp
using MkpKit.Serial;

var portName = SFSerialPort.CheckSfSerialPort();
await using var sfport = new SFSerialPort(new SerialPortOptions
{
    Name = portName,
    SyncOutputTimeoutMs = 10_000
});

await sfport.OpenAsync();
try
{
    Console.WriteLine(await sfport.SnAsync());
}
finally
{
    await sfport.CloseAsync();
}
```

`.NET` usage conventions:

- query directives usually map directly to `SFSerialPort` `*Async()` methods
- input directives usually map directly to `Mouse10Async()` and `KeypadAsync()`
- higher-level input helpers live in `MkpKit.Helpers.DeviceHelpers`
- composed input flows and smooth movement live in `MkpKit.Controller.Controller`

## Examples

All paths and commands below are relative to `mkp-kit/dotnet/`.

| Example | Source Path | Run Command | Behavior |
|---|---|---|---|
| `m10` | `examples/M10/` | `dotnet run --project .\examples\M10 -- --port COM5` | Moves left `400`, then up `400` |
| `kpad` | `examples/Kpad/` | `dotnet run --project .\examples\Kpad -- --port COM5` | Types `Hello MKP!` |
| `keys` | `examples/ContextKeys/` | `dotnet run --project .\examples\ContextKeys -- keys --port COM5` | Demonstrates `KeyTapAsync`, `KeyDownAsync`, and `KeyUpAsync` |
| `context` | `examples/ContextKeys/` | `dotnet run --project .\examples\ContextKeys -- context` | Demonstrates timeout and manual cancellation flows |
| `common` | `examples/Common/` | reused by other examples | Provides `--port` parsing, output helpers, and shared setup |

Common directive examples:

| Directive Example | Source Path | Run Command | Purpose |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- sn --port COM5` | Query serial number, version, and heartbeat |
| `list_dir` / `clean_dir` / `delete_file` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- list_dir /eMMC/applog --port COM5` | Browse directories, clean directories, and delete files |
| `join` / `wifi_auto` / `ahttpbase` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- join <ssid> <password> --port COM5` | Configure Wi‑Fi and the HTTP base URL |
| `ainsp` / `atime` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- atime /eMMC/applog/demo.log --port COM5` | Inspect log metadata and duration |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- ajson2log demo.json /eMMC/applog/demo.log --port COM5` | Upload, download, and convert JSON/log files |
| `alog` / `astop` / `acancel` / `aplay` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- aplay demo -1 --port COM5` | Start recording, stop, cancel, and trigger replay |

## .NET-Specific Surfaces

### HTTP Server

```powershell
cd D:\projects\mkp-kit\dotnet
dotnet run --project .\src\MkpKit.Server -- --config .\server.json
```

Main routes:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/token`
- `GET /api/v1/version`
- `GET /api/v1/directives/list`
- `GET /api/v1/directives/records/{id}`
- `DELETE /api/v1/directives/records/{id}`
- `GET /api/v1/directives/replay/status`
- `POST /api/v1/directives/alog`
- `POST /api/v1/directives/astop`
- `POST /api/v1/directives/aplay/{id}`
- `POST /api/v1/directives/acancel`

The current `.NET server` also provides:

- config-file-driven `bind` / `port` / `sfPort` / runtime loading
- JWT auth with optional debug-mode bypass behavior
- CORS and `OPTIONS` preflight handling
- HTTP proxy routes for baseline directives
- JSON-file persistence for macro records, defaulting to `./.mkp-server-records.json`

### HTTP Client

```powershell
cd D:\projects\mkp-kit\dotnet
dotnet run --project .\src\MkpKit.Client -- auth login --server http://127.0.0.1:8080 --username admin --password admin
dotnet run --project .\src\MkpKit.Client -- auth token
dotnet run --project .\src\MkpKit.Client -- list
dotnet run --project .\src\MkpKit.Client -- recording --name demo
dotnet run --project .\src\MkpKit.Client -- stop
```

`mkp-dotnet-client` currently covers:

- `version`
- `auth login` / `auth token` / `auth revoke`
- `list`
- `recording`
- `replay`
- `remove`
- `stop`

Config lookup order:

- explicit `--config`
- `MKP_CONFIG_PATH`
- `client.json` in the current directory
- `~/.mkp/client.json`

### CLI

```powershell
cd D:\projects\mkp-kit\dotnet
dotnet run --project .\src\MkpKit.Cli -- --help
dotnet run --project .\src\MkpKit.Cli -- sn --port COM5
dotnet run --project .\src\MkpKit.Cli -- m10 --x -400 --y -400 --port COM5
dotnet run --project .\src\MkpKit.Cli -- kpad "Hello MKP!" --port COM5
dotnet run --project .\src\MkpKit.Cli -- aplay demo --delay -1 --port COM5
```

The CLI additionally exposes:

- `raw` / `raw-async` for direct directive sending
- `status`, `--json`, `--timeout`, `--mouse-port`, and `--keyboard-port`
- a unified serial open / print / error-return flow

### Converter and File Server

```powershell
cd D:\projects\mkp-kit\dotnet
dotnet run --project .\src\MkpKit.FileServer -- --root .\artifact --port 8081
dotnet run --project .\src\MkpKit.Converter -- --help
dotnet run --project .\src\MkpKit.Converter -- -f .\demo.log
dotnet run --project .\src\MkpKit.Converter -- -f .\demo.json -o .\artifact
```

The file server currently supports:

- `PUT /<path>` raw upload
- `GET /<path>` file download
- `POST /upload` multipart upload
- `GET /list?path=` directory listing
- traversal protection and filename sanitization

## Repository Layout

| Path | Purpose |
|---|---|
| `src/MkpKit/` | core SDK, serial transport, parser, model, helper, and controller |
| `src/MkpKit.Cli/` | device-direct CLI |
| `src/MkpKit.Client/` | HTTP API client |
| `src/MkpKit.Server/` | HTTP server |
| `src/MkpKit.FileServer/` | file server |
| `src/MkpKit.Converter/` | `.log <-> .json` converter |
| `examples/` | `.NET`-specific examples |
| `tests/` | SDK / CLI / client / server / converter tests |

## .NET-Specific Notes

- `examples/Directives/` uses one project with subcommands instead of one directory per directive like Go / Python / Rust
- `MKPVersion` and `LogInfo` now align to the shared directive semantics for `uver` / `aver` and `seconds` / `milsec` / `width` / `heigh` / `stpos`; compatibility fields remain only as internal fallbacks
- `mkp-dotnet-client` is currently an HTTP API client, not a direct serial directive client
- when shared directive semantics change, update `../directives.en.md` first

