# MKP Rust 指令补充说明

[English](./directives.en.md) | 中文 | [共享指令说明](../directives.md) | [Rust README](./README.md)

---

## 目录

- [文档定位](#文档定位)
- [Rust 使用约定](#rust-使用约定)
- [示例索引](#示例索引)
- [Rust API 快速对照](#rust-api-快速对照)
- [输出解析器索引](#输出解析器索引)
- [返回结构索引](#返回结构索引)
- [工具与高层入口](#工具与高层入口)
- [已知差异](#已知差异)

## 文档定位

共享 directive 语义请直接查阅仓库根目录：`../directives.md`。

本文档只保留 Rust 语言特有内容：

- Rust helper / model 命名
- Rust example 路径与运行命令
- Rust parser 注册与 tools / CLI / server 对照
- Rust 当前与其它语言未完全对齐的差异

## Rust 使用约定

- 同步 helper 通常要求：`open()` -> `start_read_loop()` -> `set_sync_output_enabled(true)`
- 以下路径与命令均相对于 `mkp-kit/rust/`
- directive 示例源码在 `examples/directives/<name>/main.rs`
- 运行时仍使用短 example 名称：`cargo run --example sn`

## 示例索引

| 指令 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `sn` | `examples/directives/sn/main.rs` | `cargo run --example sn --quiet` | 查询设备序列号 |
| `aversion` | `examples/directives/aversion/main.rs` | `cargo run --example aversion --quiet` | 查询版本信息 |
| `alive` | `examples/directives/alive/main.rs` | `cargo run --example alive --quiet` | 查询在线状态 / 心跳 |
| `list_dir` | `examples/directives/list_dir/main.rs` | `cargo run --example list_dir --quiet` | 列目录 |
| `clean_dir` | `examples/directives/clean_dir/main.rs` | `cargo run --example clean_dir --quiet` | 清理目录 |
| `delete_file` | `examples/directives/delete_file/main.rs` | `cargo run --example delete_file --quiet` | 删除文件 |
| `join` | `examples/directives/join/main.rs` | `cargo run --example join --quiet -- [ssid] [password]` | 连接指定 Wi‑Fi |
| `wifi_auto` | `examples/directives/wifi_auto/main.rs` | `cargo run --example wifi_auto --quiet -- [0|1]` | 查询或设置 Wi‑Fi 自动连接 |
| `ahttpbase` | `examples/directives/ahttpbase/main.rs` | `cargo run --example ahttpbase --quiet -- [url]` | 查询或设置文件服务基地址 |
| `ainsp` | `examples/directives/ainsp/main.rs` | `cargo run --example ainsp --quiet` | 读取日志基础信息 |
| `atime` | `examples/directives/atime/main.rs` | `cargo run --example atime --quiet` | 读取日志时长 |
| `adumj` | `examples/directives/adumj/main.rs` | `cargo run --example adumj --quiet -- <log_path>` | 设备日志转动作 JSON |
| `aget` | `examples/directives/aget/main.rs` | `cargo run --example aget --quiet -- <filepath>` | 从 file server 拉取文件到 MKP |
| `aput` | `examples/directives/aput/main.rs` | `cargo run --example aput --quiet -- <filepath>` | 从 MKP 上传文件到 file server |
| `ajson2log` | `examples/directives/ajson2log/main.rs` | `cargo run --example ajson2log --quiet -- <jsonpath> <outputlogpath>` | JSON 动作转回 MKP log |
| `alog` | `examples/directives/alog/main.rs` | `cargo run --example alog --quiet` | 启动同步录制 |
| `astop` | `examples/directives/astop/main.rs` | `cargo run --example astop --quiet` | 停止当前录制 |

## Rust API 快速对照

| 指令 | Rust helper / API | 返回 |
|---|---|---|
| `alog` | `start_record()` / `alog()` | 文本 |
| `aplay` | `start_replaying()` | 通常异步 |
| `astop` | `stop_record()` / `astop()` | 文本 |
| `acancel` | `cancel()` | JSON 文本 |
| `sn` | `device_sn()` | `SN` |
| `list_dir` | `list_dir()` | `FileSystem` |
| `clean_dir` | `clean_dir()` | 文本 |
| `delete_file` | `delete_file()` | 文本 |
| `join` | `join()` | `Join` |
| `wifi_auto` | `wifi_auto()` | `WifiAuto` |
| `ahttpbase` | `ahttpbase()` | `AHTTPBase` |
| `adumj` | `adumj()` | `ActionDump` |
| `aget` | `aupload_to_mkp()` | `AGet` |
| `aput` | `adownload_from_mkp()` | `APut` |
| `ajson2log` | `ajson2log()` | `AJson2Log` |
| `alive` | `alive()` | `Heartbeat` |
| `atime` | `atime()` | `LogLength` |
| `aversion` | `aversion()` | `MKPVersion` |
| `ainsp` | `ainspect()` | `LogInfo` |
| `m10` | `mouse10()` / `Controller::mouse_move()` | 无结构化输出 |
| `kpad` | `keypad()` / `key_tap()` | 无结构化输出 |

## 输出解析器索引

Rust 的 parser 注册位于 `src/parser.rs`。

| 指令前缀 | 解析方式 | EOF / prompt |
|---|---|---|
| `alog` | 文本成功输出 | `cli>` |
| `astop` | 文本停止输出 | `<EOF>` |
| `acancel` | 原始 JSON 文本 | `<EOF>` |
| `join` / `wifi_auto` | 文本状态 | `cli>` |
| `list_dir` / `alive` / `atime` / `aversion` / `ahttpbase` / `adumj` / `ainsp` / `sn` | JSON 提取 | `<EOF>` 或 `cli>` |
| `aget` / `aput` / `ajson2log` | 文本输出 | `cli>` |

## 返回结构索引

| Rust 模型 | 用途 |
|---|---|
| `SN` | `sn` 输出 |
| `Heartbeat` | `alive` 输出 |
| `MKPVersion` | `aversion` 输出 |
| `LogLength` | `atime` 输出 |
| `LogInfo` | `ainsp` 输出 |
| `FileSystem` | `list_dir` 输出 |
| `ActionDump` | `adumj` 输出 |
| `AHTTPBase` | `ahttpbase` 输出 |
| `Join` | `join` 输出 |
| `WifiAuto` | `wifi_auto` 输出 |
| `AGet` | `aget` 输出 |
| `APut` | `aput` 输出 |
| `AJson2Log` | `ajson2log` 输出 |

## 工具与高层入口

- `src/helper.rs`：兼容风格 helper 与工具函数
- `src/controller.rs`：高层录制、回放、文件与鼠标动作代理
- `src/server.rs`：HTTP server
- `src/cli.rs`：CLI client
- `src/bin/`：`mkp`、`mkp-server`、`converter`、`log2json`、`json2log`、`file_server`

## 已知差异

- Rust helper 命名有少量更 Rust-idiomatic 的映射，例如 `ainsp -> ainspect()`。
- `aget` / `aput` 映射为 `aupload_to_mkp()` / `adownload_from_mkp()`。
- `Controller::mouse_move()` / `mouse_move_offsets()` 当前采用轻量分段回放，不是 `mkp-go` 那套完整轨迹模拟器。
- 共享 directive 语义改动，应优先更新 `../directives.md`，再回到 `rust/` 记录 Rust 特有差异。
