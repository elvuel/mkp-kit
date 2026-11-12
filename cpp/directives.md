# MKP C++ 指令补充说明

[English](./directives.en.md) | 中文 | [共享指令说明](../directives.md) | [C++ README](./README.md)

---

本文档只补充 `mkp-kit/cpp/` 中 **C++ 语言侧的 directive 封装、helper 命名、CLI / HTTP 暴露与当前差异**。

跨语言共享的 directive 语义、参数含义与设备行为，以仓库根 `../directives.md` 为准。

## 文档定位

优先阅读顺序：

1. `../directives.md`：跨语言共享 directive 语义
2. `cpp/README.md`：C++ 目录用法、构建、示例入口
3. 本文档：C++ 命名、封装层、当前差异

## C++ 使用约定

常见使用层次：

- 低层串口对象：`mkp::SFSerialPort`
- 高层业务封装：`mkp::Controller`
- 输入 helper：`type_text()`、`mouse_click()`、`mouse_move_smooth()` 等
- CLI：`build\mkp.exe`
- HTTP server：`build\mkp-server.exe`

典型同步调用：

- 查询类 directive 直接返回结构体，例如 `sfport.sn()`、`sfport.atime(path)`
- 输入类 directive 通常直接发送，例如 `sfport.mouse10(...)`、`type_text(sfport, "Hello")`
- `Controller` 在 `SFSerialPort` 基础上封装录制、回放、文件与输入代理

## 示例索引

以下路径均相对于 `mkp-kit/cpp/`。

| 分类 | 示例路径 | 说明 |
|---|---|---|
| 设备信息 | `examples/directives/sn.cpp` / `alive.cpp` / `aversion.cpp` | 查询 SN、在线状态与版本 |
| 日志信息 | `examples/directives/atime.cpp` / `ainsp.cpp` | 查询时长与日志元数据 |
| 文件管理 | `examples/directives/list_dir.cpp` / `clean_dir.cpp` / `delete_file.cpp` | 浏览、清理与删除设备文件 |
| 网络配置 | `examples/directives/join.cpp` / `wifi_auto.cpp` / `ahttpbase.cpp` | Wi‑Fi 与 HTTP 基地址配置 |
| 录制回放 | `examples/directives/alog.cpp` / `astop.cpp` / `acancel.cpp` | 开始、停止、取消录制 |
| 文件传输 | `examples/directives/aget.cpp` / `aput.cpp` / `ajson2log.cpp` / `adumj.cpp` | 上传、下载、动作导出与转换 |
| 输入动作 | `examples/m10.cpp` / `examples/kpad.cpp` / `examples/context_keys.cpp` | 鼠标移动、文本输入、组合键与释放 |

## C++ API 快速对照

| 共享 directive | C++ API / helper | 典型输出 |
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
| `m10` | `sfport.mouse10(opt)` / `controller.mouse_move(...)` | 无结构化输出 |
| `kpad` | `sfport.kpad(opt)` / `type_text(...)` / `controller.type_text(...)` | 无结构化输出 |

## 调试输出与超时定位

当前 C++ 版具备基础调试输出能力，但与 Python 版相比仍更轻量：

- 查询类 directive 使用 parser 提取 JSON / 文本结果
- 超时或解析失败时会保留基础错误上下文
- 目前没有 Python 版那样完整的自动摘要、最近成功输出、缓冲区快照等调试落盘体验

因此在排查串口问题时，建议优先：

- 显式指定 `--port COMx`
- 先运行 `sn`、`alive` 等简单指令确认链路可用
- 再逐步验证 `list_dir`、`ahttpbase`、`atime` 等结构化输出 directive

## 返回结构索引

| C++ 类型 | 用途 |
|---|---|
| `SN` | `sn` 输出 |
| `Heartbeat` | `alive` 输出 |
| `MKPVersion` | `aversion` 输出 |
| `LogLength` | `atime` 输出 |
| `LogInfo` | `ainsp` 输出 |
| `FileSystem` | `list_dir` 输出 |
| `ActionDump` | `adumj` 输出 |
| `AHTTPBase` | `ahttpbase` 输出 |
| `SerialPortStatus` | 当前串口状态快照 |
| `LogOption` / `JoinOption` / `AGetOption` 等 | directive option 组装 |

## Controller / HTTP API / CLI 对照

- `Controller`：更高层录制、回放、文件与输入动作代理，定义见 `include/mkp/controller.hpp`
- HTTP server：`src/server.cpp`
- CLI：`src/cli.cpp`
- file server：`src/file_server.cpp`
- converter：`src/converter.cpp` 与 `src/bin/*.cpp`

## 当前差异

相对其它语言实现，当前 C++ 版仍有这些明确差异：

- `mkp-client` 尚未提供
- `mkp-server` 记录持久化当前为 JSON 文件，不是 SQLite
- CLI 仅暴露较小的命令子集，不是全部 directive
- `mkp-converter` 可用，但二进制 `.log` 某些细节尚未完全对齐 Go / Node
- 当前 transport / 示例主要按 Windows 串口环境说明

## 注意事项

- 共享 directive 语义变动，应先更新 `../directives.md`。
- C++ 子文档只补充 C++ API 命名、类型、CLI / HTTP 暴露与已知限制。
- 若后续补齐 `mkp-client`、SQLite 或更完整 CLI，应同步回填本文件与 `cpp/README.md`。
