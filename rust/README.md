# MKP Rust

[English](./README.en.md) | 中文 | [指令帮助索引](./directives.md) | [实现说明](./docs/implement-spec.md)

---

### MKP 是什么？

**MKP** 在本项目中指一套通过串口控制的 **鼠标 / 键盘录制、回放与文件管理设备及其 CLI 指令协议**。

它通常运行在带 USB HID 能力的外部设备 / 固件上：上位机通过串口向 MKP 设备发送 `m10`、`kpad`、`alog`、`aplay`、`list_dir` 等指令，设备再以 USB HID 鼠标 / 键盘的形式向目标电脑输出输入事件，或在设备端录制、回放、检查和管理输入日志 / 文件。

`mkp-rust` 是 MKP 协议的 Rust SDK / 客户端库与配套服务实现，当前主要覆盖：

- 串口 SDK 与同步 / 异步指令发送；
- `helper` / `Controller` 兼容层；
- HTTP server 与 CLI client；
- `.log` / `.json` 转换工具与开发用 file server。

> 简单来说：**MKP 是硬件 / 固件侧的鼠标键盘自动化与回放协议；MKP Rust 是用 Rust 操作它的库与配套服务实现。**

### 项目定位

`mkp-rust` 不是直接调用系统鼠标键盘事件的本地自动化库。它的核心链路是：

```text
Rust 程序 -> 串口 -> MKP 设备 / 固件 -> USB HID 鼠标 / 键盘事件 -> 目标系统
```

它适合：

- 需要通过外部 HID 设备输出鼠标 / 键盘事件；
- 需要在设备端录制、保存、检查、回放与传输输入日志；
- 需要把 MKP CLI 指令封装成 Rust SDK、HTTP API 或 CLI。

### 主要能力

| 能力 | 说明 | 入口 |
|---|---|---|
| 串口连接 | 打开串口、读循环、同步等待、状态快照 | `new_sf_serial_port()` / `SFSerialPort` |
| 原始指令 | 同步发送、异步发送、按指令 parser 解析 | `send_directive()` / `send_directive_async()` / `send_parsed()` |
| helper 兼容层 | 对齐 `mkp-go/helper` 的常用封装与工具函数 | `src/helper.rs` / `m10()` / `auto_m10_duration()` |
| 鼠标控制 | 相对移动、按键、滚轮、全释放 | `m10` / `mouse10()` / `mouse_release_all()` |
| 高层鼠标动作 | 点击、滚轮、分段移动、offset 序列移动 | `Controller::mouse_click()` / `mouse_scroll()` / `mouse_move()` / `mouse_move_offsets()` |
| 键盘控制 | down / up / tap / 组合键 / 全释放 | `kpad` / `keypad()` / `key_tap()` / `keypad_release_all()` |
| 录制回放 | 录制、停止、取消、回放启动 | `alog` / `astop` / `acancel` / `aplay` |
| 文件与设备信息 | `sn`、`list_dir`、`clean_dir`、`delete_file`、`alive`、`atime`、`aversion`、`ainsp` | helper 与 `Controller` |
| 独立工具 | log / json 双向转换、开发用文件服务器 | `converter` / `log2json` / `json2log` / `file_server` |
| HTTP server | 健康检查、鉴权、录制列表、回放控制 | `mkp-server` |
| CLI | `version`、`list`、`record start`、`stop`、`replay`、`cancel`、`remove`、`auth *` | `mkp` |

完整指令索引见：[`directives.md`](./directives.md)

## 安装

在 `mkp-kit` monorepo 中，Rust 实现位于 `rust/` 子目录。

建议环境：

- Rust stable toolchain
- Windows 串口环境，且 MKP 设备已被系统识别
- PowerShell 或任意可运行 `cargo` 的 shell

常用准备命令：

```powershell
cd D:\projects\mkp-kit\rust
$env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path
cargo test
cargo check --examples --bins
```

## 快速开始

### 1. 直接运行现成示例

```powershell
$env:MKP_SF_PORT = "COM5"
cargo run --example sn --quiet
cargo run --example aversion --quiet
cargo run --example alive --quiet
```

### 2. 最小串口 SDK 示例

```rust
use mkp_rust::{device_sn, new_sf_serial_port};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut sfport = new_sf_serial_port();
    sfport.name = "COM5".to_string();
    sfport.open()?;
    sfport.start_read_loop()?;
    sfport.set_sync_output_enabled(true);

    let sn = device_sn(&mut sfport, None)?;
    println!("device sn: {}", sn.sn);

    sfport.close()?;
    Ok(())
}
```

> 对需要等待设备输出的 helper，记得先 `start_read_loop()` 并保持 `sync_output_enabled=true`。

## 示例

下表按“源码路径 / 运行命令 / 示例行为”整理 Rust 版示例；以下路径与命令均相对于 `mkp-kit/rust/`。

| 示例 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `m10` | `examples/m10.rs` | `cargo run --example m10 --quiet` | 鼠标左平移 `400`，然后再向上移动 `400` |
| `kpad` | `examples/kpad.rs` | `cargo run --example kpad --quiet` | 输出 `Hello MKP!`（区分大小写） |
| `support` | `examples/support/common.rs` | 被其它示例复用 | 提供串口初始化、停止录制与日志输出辅助 |

Rust 的 directive 源码位于 `examples/directives/<name>/main.rs`，但运行时仍使用简短的 Cargo example 名称：

| 指令示例 | 源码路径 | 运行命令 | 用途 |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/directives/<name>/main.rs` | `cargo run --example sn --quiet` | 查询设备序列号、版本与在线状态 |
| `list_dir` / `clean_dir` / `delete_file` | `examples/directives/<name>/main.rs` | `cargo run --example list_dir -- /eMMC/applog` | 浏览目录、清理目录、删除文件 |
| `join` / `wifi_auto` / `ahttpbase` | `examples/directives/<name>/main.rs` | `cargo run --example join -- <ssid> <password>` | 配置 Wi‑Fi、自动联网与 HTTP 基地址 |
| `ainsp` / `atime` | `examples/directives/<name>/main.rs` | `cargo run --example atime -- /eMMC/applog/spike.log` | 查看日志信息与时长 |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/directives/<name>/main.rs` | `cargo run --example ajson2log -- D:\tmp\demo.json /eMMC/applog/demo.log` | 上传、下载与 JSON/日志互转 |
| `alog` / `astop` | `examples/directives/<name>/main.rs` | `cargo run --example alog -- mkpdemo/demo` | 开始录制与停止录制 |

## 工具

当前已补上与 `mkp-go/tools` 对应的基础命令：

```powershell
cargo run --bin converter -- -f D:\tmp\demo.log
cargo run --bin log2json -- -f D:\tmp\demo.log
cargo run --bin json2log -- -f D:\tmp\demo.json
cargo run --bin file_server -- --root D:\tmp\file_root --port 8081
```

说明：

- `converter`：按扩展名自动在 `.log` 与 `.json` 之间转换
- `log2json`：兼容 `mkp-go/tools/log2json`
- `json2log`：兼容 `mkp-go/tools/json2log`
- `file_server`：提供 `GET /<path>`、`PUT /<path>`、`POST /upload`、`GET /list?path=`

## HTTP Server

启动方式：

```powershell
$env:MKP_SF_PORT = "COM5"
$env:MKP_JWT_SECRET = "change-me"
$env:MKP_USER = "admin"
$env:MKP_PASSWORD = "admin123"
cargo run --bin mkp-server
```

当前路由范围：

- `GET /health`
- `POST /api/v1/auth/token`
- `GET /api/v1/version`
- `GET /api/v1/directives/list`
- `GET /api/v1/directives/records/{record_id}`
- `DELETE /api/v1/directives/records/{record_id}`
- `GET /api/v1/directives/replay/status`
- `POST /api/v1/directives/alog`
- `POST /api/v1/directives/astop`
- `POST /api/v1/directives/aplay/{record_id}`
- `POST /api/v1/directives/acancel`

主要环境变量：

- `MKP_SF_PORT` / `SF_PORT`
- `MKP_PORT` / `PORT`，默认 `8080`
- `MKP_JWT_SECRET` / `JWT_SECRET`
- `MKP_USER` / `JWT_USER`
- `MKP_PASSWORD` / `JWT_PASSWORD`
- `MKP_DATABASE_URL`，默认 `sqlite:///mkp.db`
- `MKP_SYNC_DIRECTIVE_TIMEOUT_MS`
- `MKP_ASYNC_DIRECTIVE_TIMEOUT_MS`
- `MKP_DB_TIMEOUT_MS`
- `MKP_REPLAY_COMPLETION_GRACE_MS`
- `MKP_REPLAY_MIN_DURATION_MS`

## CLI

当前 CLI 对齐 `mkp-python`：

```powershell
cargo run --bin mkp -- auth login admin admin123
cargo run --bin mkp -- version
cargo run --bin mkp -- list --limits 10
cargo run --bin mkp -- record start demo --width 1920 --height 1080 --stposx 10 --stposy 20
cargo run --bin mkp -- stop
cargo run --bin mkp -- replay <record_id>
cargo run --bin mkp -- cancel
cargo run --bin mkp -- remove <record_id>
cargo run --bin mkp -- auth token
cargo run --bin mkp -- auth revoke --forget
```

CLI 默认行为：

- 默认服务地址：`http://127.0.0.1:8080`
- 默认超时：`15` 秒
- 本地配置：`~/.mkp/client.json`
- 若请求需要鉴权且本地仅保存了用户名 / 密码，则会自动换取并缓存 token

## 仓库结构

以下路径均相对于 `mkp-kit/rust/`。

| 路径 | 说明 |
|---|---|
| `src/sdk.rs` | 串口对象、directive 发送、基础 helper 实现 |
| `src/helper.rs` | `mkp-go/helper` 对应封装与工具函数 |
| `src/parser.rs` | 内置 raw directive parser 注册与解析逻辑 |
| `src/models.rs` | CLI 响应模型、`M10Option`、`KpadOption`、`MouseMoveOffset` 等 |
| `src/controller.rs` | 面向业务调用的高层代理与鼠标高级动作 |
| `src/converter.rs` | `.log` / `.json` 双向转换核心逻辑 |
| `src/server.rs` | Axum HTTP server、SQLite、JWT |
| `src/cli.rs` | Rust CLI client |
| `src/bin/` | `mkp`、`mkp-server`、`converter`、`log2json`、`json2log`、`file_server` |
| `examples/` | 顶层 `m10` / `kpad` 示例，以及 `examples/directives/*/main.rs` 指令示例 |
| `docs/implement-spec.md` | 当前 Rust 迁移实现说明 |

## 与 `mkp-go` 的当前差异

- `mkp-rust` 已有 HTTP server、CLI、converter 与 file server；`mkp-go` 当前在鼠标轨迹模拟与长期沉淀的 helper/controller 设计上仍更成熟
- `ainsp` 的 Rust helper 名为 `ainspect()`
- `aget` / `aput` 在 Rust helper 中分别映射为 `aupload_to_mkp()` / `adownload_from_mkp()`
- Rust 的 `Controller` 已补上 `mouse_click()`、`mouse_scroll()`、`mouse_move()`、`mouse_move_offsets()` 等高层动作，但轨迹实现仍偏轻量

## 注意事项

- 同步 helper 依赖读循环：请先 `open()`、`start_read_loop()`，再调用 `send_parsed()` 或结构化 helper
- `m10` 与 `kpad` 默认异步发送；如需等待完成，可切到同步忽略输出模式
- `Controller::mouse_move()` / `mouse_move_offsets()` 当前采用轻量分段回放，不是 `mkp-go` 那套完整轨迹模拟器
- `clean_dir()` 与 `delete_file()` 会限制在 `/eMMC/applog` 工作目录内，以降低误删风险
- `LogOption` 当前沿用设备 CLI 的 `--heigh` 拼写，不是 `--height`
- 不同固件版本的输出细节可能略有差异；如遇解析失败，可检查 `.mkp-debug/` 下保存的串口调试日志

















