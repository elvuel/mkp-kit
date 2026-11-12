# C++ Build Issues

## Status

- Result: fixed
- Verified build command: `cmake -S cpp -B cpp/build -G "MinGW Makefiles"` + `cmake --build cpp/build --parallel 4`
- Verified on: Windows + MinGW-w64 GCC 8.1.0

## Issues Encountered

### 1. Old MinGW/GCC 8 could not compile `std::filesystem`

Symptoms observed during the first build:

- compile failures inside libstdc++ `fs_path.h`
- failures around `std::filesystem::path` comparisons and path-based stream constructors

Root cause:

- the local Windows MinGW-w64 GCC 8.1.0 toolchain does not reliably support the codebase's previous `std::filesystem` usage pattern
- the project was configured for `C++20`, which further exposed incompatibilities in this toolchain

Fix applied:

- lowered the project language standard from `C++20` to `C++17` in `cpp/CMakeLists.txt`
- added `cpp/include/mkp/fs.hpp` as a Windows + old GNU compatibility layer
- switched C++ sources that used filesystem paths to the compatibility layer:
  - `cpp/src/converter.cpp`
  - `cpp/src/debug.cpp`
  - `cpp/src/file_server.cpp`
  - `cpp/src/server.cpp`
  - `cpp/src/sdk.cpp`
  - `cpp/src/bin/json2log.cpp`
  - `cpp/src/bin/log2json.cpp`

### 2. Debug log capture opened files through path overloads that old MinGW did not accept

Symptoms observed during the first build:

- `std::ofstream` path constructor related errors on Windows wide-character path overload resolution

Fix applied:

- changed debug capture file opening to use a string path instead of relying on the problematic path-based stream constructor

### 3. HTTP tools failed to link on Windows because Winsock was not linked

Symptoms observed during later build attempts:

- undefined references such as `__imp_setsockopt`, `__imp_closesocket`, `__imp_recv`, `__imp_send`, `__imp_select`

Root cause:

- `httplib`-based server/file-server code requires `ws2_32` on Windows

Fix applied:

- added `ws2_32` to Windows linker dependencies in `cpp/CMakeLists.txt`

## Outcome

After the above fixes, a full default build succeeded, including:

- `mkp.exe`
- `mkp-converter.exe`
- `mkp-json2log.exe`
- `mkp-log2json.exe`
- `mkp-file-server.exe`
- `mkp-server.exe`
- examples under `cpp/examples/` and `cpp/examples/directives/`

## Recommended Rebuild Script

Use `cpp/build-mingw.ps1` to reproduce the successful build.
