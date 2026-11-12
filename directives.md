# MKP Rust 指令帮助索引

[English](./directives.en.md) | 中文 | [README](./README.md)

---

> 本文档基于当前 `mkp-rust` 代码整理：`src/sdk.rs`、`src/helper.rs`、`src/parser.rs`、`src/models.rs`、`src/controller.rs`、`src/converter.rs`、`src/server.rs`、`src/cli.rs`。  
> 目标是提供一份 Rust 版可快速查找的 **CLI 指令 / Rust helper / Controller 扩展 / parser / 返回模型 / tools** 索引。

## 目录

- [使用约定](#使用约定)
- [示例索引](#示例索引)
- [快速总览](#快速总览)
- [同步/异步发送规则](#同步异步发送规则)
- [录制与回放指令](#录制与回放指令)
- [设备、网络与文件系统指令](#设备网络与文件系统指令)
- [鼠标指令：m10](#鼠标指令m10)
- [键盘指令：kpad](#键盘指令kpad)
- [输出解析器索引](#输出解析器索引)
- [返回结构索引](#返回结构索引)
- [工具](#工具)
- [Controller / CLI / Server 对照](#controller--cli--server-对照)
- [已知限制 / 与 `mkp-go` 的差异](#已知限制--与-mkp-go-的差异)

## 使用约定

- 默认串口类型：`SFSerialPort`，由 `new_sf_serial_port()` 创建
- 默认端口标记：鼠标 `mouse_port_flag = "1"`，键盘 `keyboard_port_flag = "2"`
- 所有底层 directive 发送都会自动追加 `\r\n`
- 对同步 helper，通常需要先：`open()` → `start_read_loop()` → `set_sync_output_enabled(true)`
- 默认 EOF 标记：`<EOF>`；未注册 parser 时，同步等待回退到 `cli>`

### 示例目录约定

- directive 示例已按 `mkp-go` 结构重排到 `examples/directives/<name>/main.rs`
- 例如：`examples/directives/sn/main.rs`、`examples/directives/list_dir/main.rs`、`examples/directives/ahttpbase/main.rs`
- 虽然源码在子目录中，仍可直接运行：`cargo run --example sn`、`cargo run --example list_dir -- /eMMC/applog`
- `m10` 与 `kpad` 不属于 `examples/directives/`，仍保留在顶层：`examples/m10.rs`、`examples/kpad.rs`

最小使用示例：

```rust
let mut sfport = mkp_rust::new_sf_serial_port();
sfport.name = "COM5".to_string();
sfport.open()?;
sfport.start_read_loop()?;
sfport.set_sync_output_enabled(true);

let version = mkp_rust::aversion(&mut sfport, None)?;
println!("{version:#?}");
```

## 示例索引

下表沿用 README 的表格风格，整理当前独立 directive 示例。`aplay` 与 `acancel` 目前只有 API 说明，尚未提供单独 example。

| 指令 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `sn` | `examples/directives/sn/main.rs` | `cargo run --example sn --quiet` | 查询设备序列号 |
| `aversion` | `examples/directives/aversion/main.rs` | `cargo run --example aversion --quiet` | 查询版本信息 |
| `alive` | `examples/directives/alive/main.rs` | `cargo run --example alive --quiet` | 查询在线状态 / 心跳 |
| `list_dir` | `examples/directives/list_dir/main.rs` | `cargo run --example list_dir --quiet` | 列出默认 `/eMMC` 目录，或传入自定义路径 |
| `clean_dir` | `examples/directives/clean_dir/main.rs` | `cargo run --example clean_dir --quiet` | 清空默认 `/eMMC/applog/subdir1`，或传入自定义路径 |
| `delete_file` | `examples/directives/delete_file/main.rs` | `cargo run --example delete_file --quiet` | 删除默认 `/eMMC/applog/uuu3.log`，或传入自定义路径 |
| `join` | `examples/directives/join/main.rs` | `cargo run --example join --quiet -- [ssid] [password]` | 连接指定 Wi‑Fi；不带参数时使用已保存配置 |
| `wifi_auto` | `examples/directives/wifi_auto/main.rs` | `cargo run --example wifi_auto --quiet -- [0|1]` | 查询或设置 Wi‑Fi 自动连接 |
| `ahttpbase` | `examples/directives/ahttpbase/main.rs` | `cargo run --example ahttpbase --quiet -- [url]` | 查询或设置文件服务基地址 |
| `ainsp` | `examples/directives/ainsp/main.rs` | `cargo run --example ainsp --quiet` | 读取默认 `/eMMC/applog/uuu2.log` 基础信息，或传入自定义路径 |
| `atime` | `examples/directives/atime/main.rs` | `cargo run --example atime --quiet` | 读取默认 `/eMMC/applog/uuu2.log` 时长，或传入自定义路径 |
| `adumj` | `examples/directives/adumj/main.rs` | `cargo run --example adumj --quiet -- <log_path>` | 将设备日志转成动作 JSON |
| `aget` | `examples/directives/aget/main.rs` | `cargo run --example aget --quiet -- <filepath>` | 从 file server 拉取文件到 MKP |
| `aput` | `examples/directives/aput/main.rs` | `cargo run --example aput --quiet -- <filepath>` | 从 MKP 上传文件到 file server |
| `ajson2log` | `examples/directives/ajson2log/main.rs` | `cargo run --example ajson2log --quiet -- <jsonpath> <outputlogpath>` | 将 JSON 动作转回 MKP log |
| `alog` | `examples/directives/alog/main.rs` | `cargo run --example alog --quiet` | 以默认 `subdir1/test` 启动同步录制，或指定日志名 |
| `astop` | `examples/directives/astop/main.rs` | `cargo run --example astop --quiet` | 停止当前录制 |
## 快速总览

| 指令 | CLI 形式 | Rust helper / API | 输出 / 解析 |
|---|---|---|---|
| `alog` | `alog [logName] [options...]` | `start_record()` / `alog()` | 文本，`PlainSuccess` |
| `aplay` | `aplay [logName] [--delay ms]` | `start_replaying()` | 通常异步发送，无内置结构化 helper |
| `astop` | `astop` | `stop_record()` / `astop()` | 文本，`AStop` |
| `acancel` | `acancel` | `cancel()` | JSON 文本，`RawJsonText` |
| `sn` | `sn` | `device_sn()` | JSON -> `SN` |
| `list_dir` | `list_dir <path>` | `list_dir()` | JSON -> `FileSystem` |
| `clean_dir` | `clean_dir <path>` | `clean_dir()` | 文本，`PlainSuccess` |
| `delete_file` | `delete_file <path>` | `delete_file()` | 文本，`PlainSuccess` |
| `join` | `join [ssid password]` | `join()` | 文本，`Join` |
| `wifi_auto` | `wifi_auto [0|1]` | `wifi_auto()` | 文本，`WifiAuto` |
| `adumj` | `adumj <logPath>` | `adumj()` | JSON -> `ActionDump` |
| `ahttpbase` | `ahttpbase [url]` | `ahttpbase()` | JSON -> `AHTTPBase` |
| `aget` | `aget <filepath>` | `aupload_to_mkp()` | 文本，`AGet` |
| `aput` | `aput <filepath>` | `adownload_from_mkp()` | 文本，`APut` |
| `ajson2log` | `ajson2log <jsonpath> -o <outputlogpath>` | `ajson2log()` | 文本，`AJson2Log` |
| `alive` | `alive` | `alive()` | JSON -> `Heartbeat` |
| `atime` | `atime <path>` | `atime()` | JSON 行 -> `LogLength` |
| `aversion` | `aversion` | `aversion()` | JSON -> `MKPVersion` |
| `ainsp` | `ainsp <path>` | `ainspect()` | JSON 行 -> `LogInfo` |
| `m10` | `m10 --port <port> ...` | `mouse10()` / `mouse_release_all()` | 无结构化 parser |
| `kpad` | `kpad --port <port> ...` | `keypad()` / `key_tap()` / `key_down()` / `key_up()` | 无结构化 parser |

## 同步/异步发送规则

### 1. 同步返回原始输出

```rust
let raw = sfport.send_directive("alive", false, None)?;
```

- 会等待当前指令对应的 EOF 标记
- 返回原始文本输出
- 常用于需要进一步自定义解析的场景

### 2. 同步等待但忽略输出

```rust
let _ = sfport.send_directive("m10 --port 1 --x 10", true, None)?;
```

- 仍会等待完成
- 返回空字符串
- 适合 `m10`、`kpad` 这类实时控制且不关心输出内容的场景

### 3. 异步发送

```rust
sfport.send_directive_async("m10 --port 1 --x 10")?;
```

- 只写串口，不等待设备输出
- 适合高频输入事件

### 4. 结构化 Helper

```rust
let sn = mkp_rust::device_sn(&mut sfport, None)?;
let version = mkp_rust::aversion(&mut sfport, None)?;
```

- 内部通过 `send_parsed()` 自动选择 parser
- 返回 Rust 结构体或文本结果

## 录制与回放指令

### `alog`

```text
alog [logName] [--width n] [--heigh n] [--stposx n] [--stposy n]
```

**Rust API：**

- `start_record(sfport, log_name, opt)`：异步启动录制
- `alog(sfport, log_name, opt, timeout)`：同步等待并返回文本

**说明：**

- `LogOption` 当前沿用固件参数名 `--heigh`
- `alog()` 需要同步模式，因此会检查 `sync_output_enabled`

### `aplay`

```text
aplay [logName] [--delay ms]
```

**Rust API：**

- `SFSerialPort::start_replaying(log_name, delay)`
- `Controller::start_replaying(log_name, delay)`

**说明：**

- 当前默认异步发送
- Rust server 侧提供基于数据库记录 ID 的 `/api/v1/directives/aplay/{record_id}`

### `astop`

```text
astop
```

**Rust API：**

- `stop_record(sfport)`
- `astop(sfport, timeout)`

### `acancel`

```text
acancel
```

**Rust API：**

- `cancel(sfport, timeout)`

**说明：**

- Rust helper 返回 `ParsedOutput`
- 当前 parser 期望 JSON 文本

## 设备、网络与文件系统指令

### `sn`

```text
sn
```

**返回：** `SN { sn: String }`

### `list_dir`

```text
list_dir <path>
```

**返回：** `FileSystem`

**说明：**

- 若 payload 中包含 `error` 字段，Rust helper 会转成 `MkpError::State`

### `clean_dir`

```text
clean_dir <path>
```

**说明：**

- Rust helper 限制路径必须位于 `/eMMC/applog` 下

### `delete_file`

```text
delete_file <path>
```

**说明：**

- Rust helper 会先通过 `compose_log_fullpath()` 规范化路径
- 限制目标必须位于 `/eMMC/applog` 下

### `join`

```text
join [ssid password]
```

**Rust API：**

- `join(sfport, None, timeout)`：使用设备最近保存配置
- `join(sfport, Some(JoinOption { ssid, password }), timeout)`：显式指定热点

### `wifi_auto`

```text
wifi_auto [0|1]
```

**Rust API：**

- `wifi_auto(sfport, None, timeout)`：查询
- `wifi_auto(sfport, Some(WifiAutoOption { state }), timeout)`：设置

**说明：**

- `state` 仅允许空字符串、`0`、`1`

### `adumj`

```text
adumj <logPath>
```

**返回：** `ActionDump`

### `ahttpbase`

```text
ahttpbase [url]
```

**返回：** `AHTTPBase { ahttpbase: String }`

**说明：**

- 无参数时查询当前 base URL
- 有参数时设置后返回结构化结果

### `aget`

```text
aget <filepath>
```

**Rust helper：** `aupload_to_mkp()`

### `aput`

```text
aput <filepath>
```

**Rust helper：** `adownload_from_mkp()`

### `ajson2log`

```text
ajson2log <jsonpath> -o <outputlogpath>
```

**Rust helper：** `ajson2log()`

**说明：**

- `jsonpath` 与 `outputlogpath` 都是必填

### `alive`

```text
alive
```

**返回：** `Heartbeat`

### `atime`

```text
atime <path>
```

**返回：** `LogLength`

### `aversion`

```text
aversion
```

**返回：** `MKPVersion`

### `ainsp`

```text
ainsp <path>
```

**Rust helper：** `ainspect()`

**返回：** `LogInfo`

## 鼠标指令：`m10`

### CLI

```text
m10 --port <port> [--b button] [--x dx] [--y dy] [--w wheel]
```

### Rust API

```rust
sfport.mouse10(mkp_rust::M10Option::default().set_x(100).set_y(50))?;
sfport.mouse10(mkp_rust::M10Option::default().with_left_button())?;
mkp_rust::mouse_release_all(&mut sfport, None)?;
```

### `M10Option` 常用构建方法

- `set_button(v)` / `with_button(v)`
- `with_left_button()` / `with_right_button()` / `with_middle_button()`
- `set_x(v)` / `set_y(v)` / `set_wheel(v)`
- `with_async(bool)`
- `with_sync_ignore_output(bool)`

### 注意事项

- 默认异步发送
- 需要强制顺序时可切同步忽略输出模式
- 当前坐标范围说明沿用 `mkp-go`：`x/y` 约为 `-2048~2047`，`wheel` 约为 `-128~127`

### Helper / Controller 扩展

除底层 `m10` 外，Rust 还补了与 `mkp-go/controller` 对齐的一批高层鼠标动作：

- `mkp_rust::m10(&mut sfport, opt)`：helper 兼容入口
- `Controller::mouse_down(button, opt)` / `mouse_up(opt)`
- `Controller::mouse_click(button, double, sleep_interval_ms, opt)`
- `Controller::mouse_scroll(dir, steps, sleep_interval_ms)`
- `Controller::mouse_scroll_with_button(dir, steps, button, sleep_interval_ms)`
- `Controller::mouse_move(button, rel_x, rel_y, interval, opt)`
- `Controller::mouse_move_offsets(button, offsets, opt)`

其中 `mouse_move_offsets()` 使用 `MouseMoveOffset`：

```rust
use mkp_rust::MouseMoveOffset;

let offsets = vec![
    MouseMoveOffset::new(-100, 0),
    MouseMoveOffset::new(0, -100).with_wheel(1).with_pause(50),
];
controller.mouse_move_offsets("left", &offsets, None)?;
```

## 键盘指令：`kpad`

### CLI

```text
kpad --port <port> [--s status] [--x1 key] [--x2 key] [--x3 key] [--x4 key] [--x5 key] [--x6 key] [--rel n] [--d n] [--v 1]
```

### Rust API

```rust
mkp_rust::key_tap(&mut sfport, "A", None)?;
mkp_rust::key_down(&mut sfport, "CTRL", None)?;
mkp_rust::key_up(&mut sfport, "CTRL", None)?;
sfport.keypad(
    mkp_rust::KpadOption::default()
        .with_keys(vec!["CTRL".into(), "C".into()])
        .with_auto_release(),
)?;
```

### `KpadOption` 常用方法

- `with_keys(Vec<String>)`
- `with_key("A")`
- `with_hold()`
- `with_auto_release()`
- `with_duration(ms)`
- `with_delay(ms)`
- `with_async(bool)`
- `with_sync_ignore_output(bool)`
- `key_down(key)` / `key_up(key)`

### 注意事项

- 默认异步发送
- `key_tap()` 会自动做 press-then-release
- 符号键会通过 `expand_kpad_input_key()` 展开，例如 `!` -> `MOD_LSHIFT` + `1`
- Rust 内部维护本地按键缓存，用于 `key_down()` / `key_up()` 的组合键状态跟踪

## 输出解析器索引

| 指令 | ParserKind | JSON 输出 | EOF |
|---|---|---:|---|
| `astop` | `AStop` | 否 | `cli>` |
| `acancel` | `RawJsonText` | 是 | `<EOF>` |
| `sn` | `RawJsonText` | 是 | `<EOF>` |
| `list_dir` | `RawJsonText` | 是 | `<EOF>` |
| `clean_dir` | `PlainSuccess` | 否 | `cli>` |
| `delete_file` | `PlainSuccess` | 否 | `cli>` |
| `alive` | `RawJsonText` | 是 | `<EOF>` |
| `atime` | `LineJson` | 是 | `<EOF>` |
| `aversion` | `RawJsonText` | 是 | `<EOF>` |
| `ainsp` | `LineJson` | 是 | `<EOF>` |
| `join` | `Join` | 否 | `cli>` |
| `wifi_auto` | `WifiAuto` | 否 | `cli>` |
| `adumj` | `Adumj` | 是 | `cli>` |
| `ahttpbase` | `AHttpBase` | 是 | `cli>` |
| `aget` | `AGet` | 否 | `cli>` |
| `aput` | `APut` | 否 | `cli>` |
| `ajson2log` | `AJson2Log` | 否 | `cli>` |
| `alog` | `PlainSuccess` | 否 | `cli>` |

## 返回结构索引

| 结构 | 用途 |
|---|---|
| `SN` | 设备序列号 |
| `FileNode` / `FileSystem` | 目录树与文件系统查询结果 |
| `Heartbeat` | `alive` 输出 |
| `LogLength` | `atime` 输出 |
| `MKPVersion` | `aversion` 输出 |
| `LogInfo` | `ainsp` 输出 |
| `AHTTPBase` | `ahttpbase` 输出 |
| `ActionDump` | `adumj` 输出 |

## 工具

除串口 SDK 外，当前仓库还提供以下独立工具：

- `converter`：根据输入扩展名在 `.log` / `.json` 之间自动转换
- `log2json`：偏兼容命名的 `.log -> .json` 包装器
- `json2log`：偏兼容命名的 `.json -> .log` 包装器
- `file_server`：开发用文件服务器，提供 `GET /<path>`、`PUT /<path>`、`POST /upload`、`GET /list?path=`

常用命令如下：

```powershell
cargo run --bin converter -- -f D:\tmp\demo.log
cargo run --bin log2json -- -f D:\tmp\demo.log
cargo run --bin json2log -- -f D:\tmp\demo.json
cargo run --bin file_server -- --root D:\tmp\file_root --port 8081
```

## Controller / CLI / Server 对照

- `src/sdk.rs` 提供串口对象、directive 发送与基础结构化 helper
- `src/helper.rs` 负责兼容 `mkp-go/helper` 风格的函数入口与小型工具函数
- `Controller` 在基础 helper 之上，额外补了 `mouse_click()`、`mouse_scroll()`、`mouse_move()`、`mouse_move_offsets()` 等高层动作
- `mkp` CLI 走 HTTP server，而不是直接串口
- `mkp-server` 内部通过 `Controller` 与串口设备交互，并额外管理 JWT、SQLite、录制元数据与回放状态

## 已知限制 / 与 `mkp-go` 的差异

- `Controller::mouse_move()` / `mouse_move_offsets()` 当前是轻量分段回放，不是 `mkp-go` 那套完整轨迹模拟器
- `move_cursor()` 在 server 实现里当前还是占位逻辑
- 不同固件版本返回文本可能有细微差异；若解析失败，可检查 `.mkp-debug/`













