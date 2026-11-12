# MKP C++

[中文](./README.md) | English | [Shared Overview](../README.en.md) | [Shared Directives](../directives.en.md) | [C++ Directive Notes](./directives.en.md)

---

This document only keeps **C++-specific usage and differences** for `mkp-kit/cpp/`.

Cross-language shared content is maintained at the repository root:

- Shared overview: `../README.en.md`
- Shared directive semantics: `../directives.en.md`

## Build

Inside the `mkp-kit` monorepo, the C++ implementation lives under `cpp/`.

```powershell
cd D:\projects\mkp-kit\cpp
cmake -S . -B build
cmake --build build
```

Use `cpp/build/` as the default shared build output directory. Unless you have a specific need to separate generators, configurations, or short-lived experiments, keeping long-lived variant directories such as `build-core`, `build-http`, `build-nmake`, or `build-vs` is no longer recommended.

Current default `CMakeLists.txt` configuration:

- C++ standard: `C++17`
- `MKP_CPP_BUILD_EXAMPLES=ON`
- `MKP_CPP_BUILD_HTTP_TOOLS=ON`
- `MKP_CPP_BUILD_TESTS=OFF`

Vendored headers:

- `include/nlohmann/json.hpp`
- `include/httplib.h`

To build tests as well:

```powershell
cmake -S . -B build -DMKP_CPP_BUILD_TESTS=ON
cmake --build build
ctest --test-dir build
```

If you need to switch generators, prefer rebuilding `build/` instead of keeping multiple long-lived `build-*` directories.

## Quick Start

```cpp
#include <iostream>

#include "mkp/helper.hpp"

int main() {
  auto port = mkp::check_sf_serial_port();
  auto sfport = mkp::new_sf_serial_port({port});
  sfport.open();

  try {
    std::cout << sfport.sn().sn << "\n";
  } catch (...) {
    sfport.close();
    throw;
  }

  sfport.close();
}
```

Port selection order:

- Prefer `MKP_SFPORT`
- Or pass `--port COMx` explicitly in CLI / examples
- Otherwise fall back to a Windows-side heuristic probe over `COM1..COM32`

## Examples

All paths and commands below are relative to `mkp-kit/cpp/`.

| Example | Source Path | Run Command | Behavior |
|---|---|---|---|
| `m10` | `examples/m10.cpp` | `build\example-m10.exe --port COM5` | Move left by `400`, then move up by `400` |
| `kpad` | `examples/kpad.cpp` | `build\example-kpad.exe --port COM5` | Type `Hello MKP!` with case preserved |
| `context_keys` | `examples/context_keys.cpp` | `build\example-context_keys.exe --port COM5` | Demonstrates helper / controller key down, key up, combos, and release-all |
| `common` | `examples/common/common.hpp` | Reused by other examples | Shared serial bootstrap and output helpers |

Common directive examples:

| Directive Example | Source Path | Run Command | Purpose |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/directives/<name>.cpp` | `build\example-directive-sn.exe --port COM5` | Query device serial number, version, and liveness |
| `list_dir` / `clean_dir` / `delete_file` | `examples/directives/<name>.cpp` | `build\example-directive-list_dir.exe /eMMC/applog --port COM5` | Browse directories, clean directories, delete files |
| `join` / `wifi_auto` / `ahttpbase` | `examples/directives/<name>.cpp` | `build\example-directive-join.exe <ssid> <password> --port COM5` | Configure Wi‑Fi, auto-connect, and HTTP base URL |
| `ainsp` / `atime` | `examples/directives/<name>.cpp` | `build\example-directive-atime.exe /eMMC/applog/spike.log --port COM5` | Inspect log metadata and duration |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/directives/<name>.cpp` | `build\example-directive-ajson2log.exe D:\tmp\demo.json /eMMC/applog/demo.log --port COM5` | Upload, download, and convert JSON/log files |
| `alog` / `astop` / `acancel` | `examples/directives/<name>.cpp` | `build\example-directive-alog.exe mkpdemo/demo --port COM5` | Start recording, stop recording, and cancel |

## C++-Specific Surfaces

### CLI

```powershell
build\mkp.exe --port COM5 sn
build\mkp.exe --port COM5 alive
build\mkp.exe --port COM5 aversion
build\mkp.exe --port COM5 atime /eMMC/applog/spike.log
build\mkp.exe --port COM5 list_dir /eMMC/applog
build\mkp.exe --port COM5 m10 -400 -400
build\mkp.exe --port COM5 kpad "Hello MKP!"
```

The built-in CLI currently covers a smaller common-command subset:

- `sn`
- `alive`
- `aversion`
- `atime <path>`
- `list_dir <path>`
- `m10 <x> <y>`
- `kpad <text>`

### HTTP Server

```powershell
build\mkp-server.exe --sf-port COM5 --port 8000 --db .\.mkp-server-records.json
```

Current support includes:

- JWT login: `POST /api/v1/auth/token`
- CORS preflight: `OPTIONS *`
- Health check: `GET /health`
- Version endpoint: `GET /api/v1/version`
- Directive APIs for record / stop / replay / delete / cancel flows
- JSON-file persistence for recorded macro metadata

### Converter Tools and File Server

```powershell
build\mkp-converter.exe -f .\sample.log
build\mkp-converter.exe -f .\sample.json -o .\out
build\mkp-json2log.exe .\sample.json .\sample.log
build\mkp-log2json.exe .\sample.log .\sample.json
build\mkp-file-server.exe -r .\file_root -p 8080
```

## Repository Layout

All paths below are relative to `mkp-kit/cpp/`.

| Path | Description |
|---|---|
| `include/mkp/sdk.hpp` | Serial port object, directive API, and transport abstraction |
| `include/mkp/models.hpp` | Return models and option types |
| `include/mkp/controller.hpp` | Higher-level controller / helper capabilities |
| `src/parser.cpp` | Parser registration and output parsing logic |
| `src/helper.cpp` | Mouse / keyboard helpers and higher-level input actions |
| `src/controller.cpp` | Higher-level record, replay, file, and input wrappers |
| `src/server.cpp` | HTTP server and record storage |
| `src/file_server.cpp` | File upload, download, and directory listing service |
| `src/converter.cpp` | JSON / log conversion tool logic |
| `src/bin/` | Executable entry points such as `mkp`, `mkp-server`, and `mkp-file-server` |
| `examples/` | `m10`, `kpad`, and directive examples |
| `directives.en.md` | C++ directive supplement |

## C++-Specific Notes

- The current serial transport is primarily Windows-oriented; docs and examples assume `COMx` naming.
- `mkp-server` currently persists records to a JSON file instead of SQLite.
- `mkp-client` is not provided yet, so the client surface is still behind Python / Rust / Node.
- `mkp-converter` already supports C++-side roundtrips, but some binary `.log` details are not yet fully aligned with the Go / Node toolchain.
- Timeout and parse-failure diagnostics exist, but the automatic summaries are still less rich than the Python implementation.


