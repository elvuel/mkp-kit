# MKP .NET Directive Supplement

English | [中文](./directives.md) | [Shared Overview](../README.en.md) | [Shared Directives](../directives.en.md) | [.NET README](./README.en.md)

---

This document only adds **.NET-specific directive usage, API naming, parsing entry points, and exposure surfaces** for `mkp-kit/dotnet/`.

## Contents

- Document Positioning
- .NET Usage Conventions
- Example Index
- .NET API Quick Map
- Output Parsing Index
- Return Type Index
- Controller / HTTP API / CLI Map
- Known Differences
- Notes

## Document Positioning

For the shared directive contract, input/output semantics, and cross-language behavior, start with:

- shared overview: `../README.en.md`
- shared directives: `../directives.en.md`

This file only adds:

- `.NET` type names and method names
- `.NET` parser registry and output extraction details
- `.NET` example, CLI, HTTP client, and HTTP server exposure points

## .NET Usage Conventions

- all paths and commands below are relative to `mkp-kit/dotnet/`
- `SFSerialPort` is the core direct-serial directive entry point, defined in `src/MkpKit/Serial/Transport.cs`
- the default parser registry is created by `DirectiveParserRegistry.CreateDefault()`
- query directives usually return strongly typed records / models
- input helpers live in `MkpKit.Helpers.DeviceHelpers`
- higher-level composition lives in `MkpKit.Controller.Controller`
- `examples/Directives/` uses one project with subcommands to host multiple directive examples

## Example Index

| Directive / Example | Source Path | Run Command | Behavior |
|---|---|---|---|
| `sn` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- sn --port COM5` | Queries the device serial number |
| `aversion` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- aversion --port COM5` | Queries version information |
| `alive` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- alive --port COM5` | Queries heartbeat / online status |
| `list_dir` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- list_dir /eMMC/applog --port COM5` | Lists a directory |
| `clean_dir` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- clean_dir /eMMC/applog/tmp --port COM5` | Cleans a directory |
| `delete_file` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- delete_file /eMMC/applog/demo.log --port COM5` | Deletes a file |
| `join` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- join <ssid> <password> --port COM5` | Joins the specified Wi‑Fi |
| `wifi_auto` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- wifi_auto 1 --port COM5` | Queries or sets Wi‑Fi auto-connect |
| `ahttpbase` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- ahttpbase http://127.0.0.1:8080 --port COM5` | Queries or sets the file-server base URL |
| `ainsp` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- ainsp /eMMC/applog/demo.log --port COM5` | Reads log metadata |
| `atime` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- atime /eMMC/applog/demo.log --port COM5` | Reads log duration |
| `adumj` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- adumj /eMMC/applog/demo.log --port COM5` | Converts a device log to action JSON |
| `aget` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- aget /upload/demo.bin --port COM5` | Pulls a file from the file server into MKP |
| `aput` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- aput /eMMC/applog/demo.log --port COM5` | Uploads a file from MKP to the file server |
| `ajson2log` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- ajson2log demo.json /eMMC/applog/demo.log --port COM5` | Converts action JSON back into an MKP log |
| `alog` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- alog demo --port COM5` | Starts synchronous recording |
| `astop` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- astop --port COM5` | Stops the current recording |
| `acancel` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- acancel --port COM5` | Cancels the current recording or replay |
| `aplay` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- aplay demo -1 --port COM5` | Triggers asynchronous replay |
| `m10` | `examples/M10/` | `dotnet run --project .\examples\M10 -- --port COM5` | Moves left `400`, then up `400` |
| `kpad` | `examples/Kpad/` | `dotnet run --project .\examples\Kpad -- --port COM5` | Types `Hello MKP!` |
| `keys` / `context` | `examples/ContextKeys/` | `dotnet run --project .\examples\ContextKeys -- keys --port COM5` | Demonstrates key combos, release handling, and context behavior |

## .NET API Quick Map

| Shared Directive | .NET API / Helper | Return |
|---|---|---|
| `sn` | `sfport.SnAsync()` | `SN` |
| `alive` | `sfport.AliveAsync()` | `Heartbeat` |
| `aversion` | `sfport.AVersionAsync()` | `MKPVersion` |
| `atime` | `sfport.ATimeAsync(path)` | `LogLength` |
| `ainsp` | `sfport.AInspAsync(path)` | `LogInfo` |
| `list_dir` | `sfport.ListDirAsync(path)` | `FileSystem` |
| `clean_dir` | `sfport.CleanDirAsync(path)` | `string` |
| `delete_file` | `sfport.DeleteFileAsync(path)` | `string` |
| `join` | `sfport.JoinAsync(option)` | `string` |
| `wifi_auto` | `sfport.WifiAutoAsync(option)` | `string` |
| `ahttpbase` | `sfport.AHttpBaseAsync(option)` | `AHTTPBase` |
| `adumj` | `sfport.ADumjAsync(path)` | `ActionDump` |
| `aget` | `sfport.AGetAsync(option)` | `string` |
| `aput` | `sfport.APutAsync(option)` | `string` |
| `ajson2log` | `sfport.AJson2LogAsync(option)` | `string` |
| `alog` | `sfport.ALogAsync(args)` | `string` |
| `astop` | `sfport.AStopAsync()` | `string` |
| `acancel` | `sfport.ACancelAsync()` | `string` / JSON text |
| `aplay` | `sfport.APlayAsync(option)` | no synchronous structured output |
| `m10` | `sfport.Mouse10Async(option)` / `controller.MouseMoveSmoothAsync(...)` | no structured output |
| `kpad` | `sfport.KeypadAsync(option)` / `DeviceHelpers.TypeTextAsync(...)` / `controller.TypeTextAsync(...)` | no structured output |

## Output Parsing Index

The `.NET` directive parser registry lives in `src/MkpKit/Parser/DirectiveParsing.cs`.

| Output Kind | Main Parsing Entry | Representative Directives |
|---|---|---|
| `Json` | `OutputParsing.ParseJson()` | `sn`, `alive`, `aversion`, `list_dir` |
| `LineJson` | `OutputParsing.ParseLineJson()` | `atime`, `ainsp` |
| `Text` | `OutputParsing.ParseTextSuccess()` / `ParsePlainSuccess()` / `ParseJoin()` / `ParseWifiAuto()` | `astop`, `clean_dir`, `delete_file`, `join`, `wifi_auto`, `alog`, `aget`, `aput`, `ajson2log` |
| `RawJsonText` | `OutputParsing.ParseRawJsonText()` | `acancel` |
| Custom JSON extraction | `OutputParsing.ParseAHttpBase()` / `ParseOptionalJson()` | `ahttpbase`, `adumj` |

Additional notes:

- `aplay` is sent asynchronously and does not rely on a synchronous parser result
- the effective EOF markers are `<EOF>` and `cli>`, depending on the parser registration for each directive

## Return Type Index

| .NET Type | Purpose |
|---|---|
| `SN` | `sn` output |
| `Heartbeat` | `alive` output |
| `MKPVersion` | `aversion` output |
| `LogLength` | `atime` output |
| `LogInfo` | `ainsp` output |
| `FileSystem` | `list_dir` output |
| `ActionDump` | `adumj` output |
| `AHTTPBase` | `ahttpbase` output |
| `SerialPortStatus` | current serial-port status snapshot |
| `JoinOption` / `AGetOption` / `APlayOption` / `M10Option` / `KpadOption` | directive option assembly |

## Controller / HTTP API / CLI Map

- `Controller`: `src/MkpKit/Controller/Controller.cs`
- helpers: `src/MkpKit/Helpers/DeviceHelpers.cs`
- CLI: `src/MkpKit.Cli/`
- client: `src/MkpKit.Client/`
- HTTP server: `src/MkpKit.Server/`
- file server: `src/MkpKit.FileServer/`
- converter: `src/MkpKit.Converter/`
- examples: `examples/`

## Known Differences

- `examples/Directives/` uses one project with subcommands instead of one directory per directive
- `mkp-dotnet-client` targets the HTTP server API and does not proxy raw serial directives directly
- the `MKPVersion` model stores the raw device `app` / `boot` / `hw` fields; the client `version` view maps them to Go-style `uver` / `aver` semantics
- replay records are currently persisted as a JSON file instead of SQLite or another database

## Notes

- when shared directive semantics change, update `../directives.en.md` first
- when adding or changing a directive, check `DirectiveParserRegistry.CreateDefault()`, examples, CLI, HTTP server, and this file together
- this `.NET` supplement only documents .NET API naming, parser behavior, CLI / HTTP exposure, and implementation-specific differences

