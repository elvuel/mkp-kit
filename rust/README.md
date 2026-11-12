# MKP Rust

[English](./README.en.md) | 中文 | [共享总览](../README.md) | [共享指令说明](../directives.md) | [Rust 指令补充](./directives.md)

---

本文档只维护 `mkp-kit/rust/` 的 **Rust 语言特有用法与差异**。

跨语言共享内容统一维护在仓库根目录：

- 共享总览：`../README.md`
- 共享指令说明：`../directives.md`

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

以下路径与命令均相对于 `mkp-kit/rust/`。

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

## Rust 特有表面

### 工具

```powershell
cargo run --bin converter -- -f D:\tmp\demo.log
cargo run --bin log2json -- -f D:\tmp\demo.log
cargo run --bin json2log -- -f D:\tmp\demo.json
cargo run --bin file_server -- --root D:\tmp\file_root --port 8081
```

### HTTP Server

```powershell
$env:MKP_SF_PORT = "COM5"
$env:MKP_JWT_SECRET = "change-me"
$env:MKP_USER = "admin"
$env:MKP_PASSWORD = "admin123"
cargo run --bin mkp-server
```

### CLI

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
| `directives.md` | Rust 版 directive 补充说明 |

## Rust 特有注意事项

- Rust helper 命名有少量更 Rust-idiomatic 的映射，例如 `ainsp -> ainspect()`。
- `aget` / `aput` 在 Rust helper 层映射为 `aupload_to_mkp()` / `adownload_from_mkp()`。
- `Controller::mouse_move()` / `mouse_move_offsets()` 当前采用轻量分段回放，不是 `mkp-go` 那套完整轨迹模拟器。
- 不同固件版本输出细节可能略有差异；如遇解析失败，可检查 `.mkp-debug/` 下保存的串口调试日志。
- 共享 directive 含义变更时，请优先更新仓库根目录文档，再回到 `rust/` 补 Rust 特有差异。
