# MKP C++

[English](./README.en.md) | 中文 | [共享总览](../README.md) | [共享指令说明](../directives.md) | [C++ 指令补充](./directives.md)

---

本文档只维护 `mkp-kit/cpp/` 的 **C++ 语言特有用法与差异**。

跨语言共享内容统一维护在仓库根目录：

- 共享总览：`../README.md`
- 共享指令说明：`../directives.md`

## 构建

在 `mkp-kit` monorepo 中，C++ 实现位于 `cpp/` 子目录。

```powershell
cd D:\projects\mkp-kit\cpp
cmake -S . -B build
cmake --build build
```

默认统一使用 `cpp/build/` 作为构建输出目录；除非你有明确区分生成器、配置或临时实验的需要，否则不再推荐保留 `build-core`、`build-http`、`build-nmake`、`build-vs` 这类变体目录。

当前 `CMakeLists.txt` 默认配置：

- C++ 标准：`C++17`
- `MKP_CPP_BUILD_EXAMPLES=ON`
- `MKP_CPP_BUILD_HTTP_TOOLS=ON`
- `MKP_CPP_BUILD_TESTS=OFF`

内置头文件依赖：

- `include/nlohmann/json.hpp`
- `include/httplib.h`

如需测试构建，可额外开启：

```powershell
cmake -S . -B build -DMKP_CPP_BUILD_TESTS=ON
cmake --build build
ctest --test-dir build
```

如果需要切换生成器，优先直接重建 `build/`，而不是长期并存多个 `build-*` 目录。

## 快速开始

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

端口选择顺序：

- 优先读取环境变量 `MKP_SFPORT`
- 或在 CLI / examples 中显式传 `--port COMx`
- 若都未提供，则做 Windows 侧的 `COM1..COM32` 启发式探测

## 示例

以下路径与命令均相对于 `mkp-kit/cpp/`。

| 示例 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `m10` | `examples/m10.cpp` | `build\example-m10.exe --port COM5` | 鼠标左平移 `400`，然后再向上移动 `400` |
| `kpad` | `examples/kpad.cpp` | `build\example-kpad.exe --port COM5` | 输出 `Hello MKP!`（区分大小写） |
| `context_keys` | `examples/context_keys.cpp` | `build\example-context_keys.exe --port COM5` | 演示 helper / controller 层键盘按下、抬起、组合与全释放 |
| `common` | `examples/common/common.hpp` | 被其它示例复用 | 提供串口初始化与输出辅助 |

常见 directive 示例：

| 指令示例 | 源码路径 | 运行命令 | 用途 |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/directives/<name>.cpp` | `build\example-directive-sn.exe --port COM5` | 查询设备序列号、版本与在线状态 |
| `list_dir` / `clean_dir` / `delete_file` | `examples/directives/<name>.cpp` | `build\example-directive-list_dir.exe /eMMC/applog --port COM5` | 浏览目录、清理目录、删除文件 |
| `join` / `wifi_auto` / `ahttpbase` | `examples/directives/<name>.cpp` | `build\example-directive-join.exe <ssid> <password> --port COM5` | 配置 Wi‑Fi、自动联网与 HTTP 基地址 |
| `ainsp` / `atime` | `examples/directives/<name>.cpp` | `build\example-directive-atime.exe /eMMC/applog/spike.log --port COM5` | 查看日志信息与时长 |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/directives/<name>.cpp` | `build\example-directive-ajson2log.exe D:\tmp\demo.json /eMMC/applog/demo.log --port COM5` | 上传、下载与 JSON/日志互转 |
| `alog` / `astop` / `acancel` | `examples/directives/<name>.cpp` | `build\example-directive-alog.exe mkpdemo/demo --port COM5` | 开始录制、停止录制与取消 |

## C++ 特有表面

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

当前内置 CLI 只覆盖一个较小的常用命令子集：

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

当前支持：

- JWT 登录：`POST /api/v1/auth/token`
- CORS 预检：`OPTIONS *`
- 健康检查：`GET /health`
- 版本查询：`GET /api/v1/version`
- directive 录制 / 停止 / 回放 / 删除 / 取消相关 API
- JSON 文件持久化的录制记录存储

### 转换工具与文件服务

```powershell
build\mkp-converter.exe -f .\sample.log
build\mkp-converter.exe -f .\sample.json -o .\out
build\mkp-json2log.exe .\sample.json .\sample.log
build\mkp-log2json.exe .\sample.log .\sample.json
build\mkp-file-server.exe -r .\file_root -p 8080
```

## 仓库结构

以下路径均相对于 `mkp-kit/cpp/`。

| 路径 | 说明 |
|---|---|
| `include/mkp/sdk.hpp` | 串口对象、directive API、transport 抽象 |
| `include/mkp/models.hpp` | 返回模型与 option 类型 |
| `include/mkp/controller.hpp` | 更高层 controller / helper 能力 |
| `src/parser.cpp` | parser 注册与输出解析逻辑 |
| `src/helper.cpp` | 键鼠 helper 与高层输入动作 |
| `src/controller.cpp` | 更高层录制、回放、文件与输入封装 |
| `src/server.cpp` | HTTP server 与记录存储 |
| `src/file_server.cpp` | 文件上传、下载与目录浏览服务 |
| `src/converter.cpp` | JSON / log 转换工具逻辑 |
| `src/bin/` | `mkp` / `mkp-server` / `mkp-file-server` 等可执行入口 |
| `examples/` | `m10` / `kpad` / directive 示例 |
| `directives.md` | C++ 版 directive 补充说明 |

## C++ 特有注意事项

- 当前串口 transport 以 Windows 为主；文档和示例默认按 `COMx` 说明。
- `mkp-server` 当前使用 JSON 文件持久化录制记录，尚未切换到 SQLite。
- `mkp-client` 目前尚未提供，与 Python / Rust / Node 下更完整的客户端表面相比仍有差距。
- `mkp-converter` 已可完成 C++ 侧 roundtrip，但二进制 `.log` 的某些细节尚未完全对齐 Go / Node 工具链。
- 当前有超时与解析错误调试输出能力，但自动摘要与排障信息丰富度不如 Python 版。


