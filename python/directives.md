# MKP Python 指令帮助索引

[English](./directives.en.md) | 中文 | [README](./README.md)

---

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
- [常见异常](#常见异常)
- [返回结构索引](#返回结构索引)
- [Controller 代理能力](#controller-代理能力)
- [HTTP API / CLI 对照](#http-api--cli-对照)
- [注意事项](#注意事项)

## 使用约定

本文档描述的是 **Python 版当前已经实现并封装的 MKP 指令行为**。

在 `mkp-python` 中，directive 大致分为三层：

1. **原始字符串层**：`send_directive()` / `send_directive_async()`
2. **parser 层**：`send_parsed()` 根据 directive 自动选 parser
3. **helper / model 层**：如 `atime()`、`ahttpbase()`、`adumj()`，直接返回 dataclass

### 同步发送前提

如果要等待设备输出并解析结果，请确保：

- 串口已 `open()`
- 已调用 `start_read_loop()`
- `sync_output_enabled = True`

推荐直接复用 `examples.common.init_sfport()` 的初始化顺序：

1. `new_sf_serial_port()`
2. 解析串口名
3. `open()`
4. `reset_input_buffer()`
5. `start_read_loop()`
6. 必要时先 `stop_record()` 清理设备状态

### 调试捕获

当同步等待超时，或 parser 无法从输出中提取期望内容时，Python 版会把原始串口输出写到 `.mkp-debug/`（可通过 `MKP_DEBUG_SERIAL_DIR` 覆盖）。

## 示例索引

下表沿用 README 的表格风格，整理当前独立 directive 示例。`aplay` 与 `acancel` 目前只有 API 说明，尚未提供单独 example。

| 指令 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `sn` | `examples/directives/sn.py` | `python -m examples.directives.sn` | 查询设备序列号 |
| `aversion` | `examples/directives/aversion.py` | `python -m examples.directives.aversion` | 查询版本信息 |
| `alive` | `examples/directives/alive.py` | `python -m examples.directives.alive` | 查询在线状态 / 心跳 |
| `list_dir` | `examples/directives/list_dir.py` | `python -m examples.directives.list_dir` | 列出默认 `/eMMC` 目录，或传入自定义路径 |
| `clean_dir` | `examples/directives/clean_dir.py` | `python -m examples.directives.clean_dir` | 清空默认 `/eMMC/applog/subdir1`，或传入自定义路径 |
| `delete_file` | `examples/directives/delete_file.py` | `python -m examples.directives.delete_file` | 删除默认 `/eMMC/applog/uuu3.log`，或传入自定义路径 |
| `join` | `examples/directives/join.py` | `python -m examples.directives.join [ssid] [password]` | 连接指定 Wi‑Fi；不带参数时使用已保存配置 |
| `wifi_auto` | `examples/directives/wifi_auto.py` | `python -m examples.directives.wifi_auto [0|1]` | 查询或设置 Wi‑Fi 自动连接 |
| `ahttpbase` | `examples/directives/ahttpbase.py` | `python -m examples.directives.ahttpbase [url]` | 查询或设置文件服务基地址 |
| `ainsp` | `examples/directives/ainsp.py` | `python -m examples.directives.ainsp` | 读取默认 `/eMMC/applog/uuu2.log` 基础信息，或传入自定义路径 |
| `atime` | `examples/directives/atime.py` | `python -m examples.directives.atime` | 读取默认 `/eMMC/applog/uuu2.log` 时长，或传入自定义路径 |
| `adumj` | `examples/directives/adumj.py` | `python -m examples.directives.adumj <log_path>` | 将设备日志转成动作 JSON |
| `aget` | `examples/directives/aget.py` | `python -m examples.directives.aget <filepath>` | 从 file server 拉取文件到 MKP |
| `aput` | `examples/directives/aput.py` | `python -m examples.directives.aput <filepath>` | 从 MKP 上传文件到 file server |
| `ajson2log` | `examples/directives/ajson2log.py` | `python -m examples.directives.ajson2log <jsonpath> <outputlogpath>` | 将 JSON 动作转回 MKP log |
| `alog` | `examples/directives/alog.py` | `python -m examples.directives.alog [log_name]` | 以默认 `subdir1/test` 启动同步录制，或指定日志名 |
| `astop` | `examples/directives/astop.py` | `python -m examples.directives.astop` | 停止当前录制 |
## 快速总览

| 类别 | Directive | Python helper / 方法 | 返回 |
|---|---|---|---|
| 录制 | `alog` | `start_record()` / `alog()` / `Controller.alog()` | `None` / `str` |
| 停止录制 | `astop` | `stop_record()` / `astop()` | `None` / `str` |
| 取消回放 | `acancel` | `cancel()` | `dict` / `str` / 空文本 |
| 回放 | `aplay` | `sfport.start_replaying()` / `Controller.start_replaying()` | `None` |
| 序列号 | `sn` | `device_sn()` | `SN` |
| 列目录 | `list_dir` | `list_dir()` | `FileSystem` |
| 清目录 | `clean_dir` | `clean_dir()` | `str` |
| 删文件 | `delete_file` | `delete_file()` | `str` |
| 心跳 | `alive` | `alive()` | `Heartbeat` |
| 日志时长 | `atime` | `atime()` | `LogLength` |
| 版本 | `aversion` | `aversion()` | `MKPVersion` |
| 日志详情 | `ainsp` | `ainspect()` | `LogInfo` |
| 连 Wi‑Fi | `join` | `join()` | `str` |
| Wi‑Fi 自动连接 | `wifi_auto` | `wifi_auto()` | `str` |
| HTTP 基址 | `ahttpbase` | `ahttpbase()` | `AHTTPBase` |
| 导出动作 JSON | `adumj` | `adumj()` | `ActionDump` |
| 下载到设备 | `aget` | `aupload_to_mkp()` | `str` |
| 从设备上传出 | `aput` | `adownload_from_mkp()` | `str` |
| JSON 转设备日志 | `ajson2log` | `ajson2log()` | `str` |
| 鼠标 | `m10` | `mouse10()` / `mouse_release_all()` | `None` |
| 键盘 | `kpad` | `keypad()` / `key_tap()` / `key_down()` / `key_up()` | `None` |

## 同步/异步发送规则

### `send_directive(directive, ignore_output=False, timeout=None)`

- 直接发送原始 directive
- 当 `sync_output_enabled=True` 且 `ignore_output=False` 时，会同步等待返回文本
- 返回值是设备原始输出字符串

### `send_directive_async(directive)`

- 仅发送，不等待输出
- 适合 `m10`、`kpad`、`aplay` 等天然异步命令

### `send_parsed(directive, timeout=None)`

- 根据 directive 首字段自动查找 parser
- 若 parser 标记为 `json_output=True`，会先提取 JSON 再 `json.loads()`
- 这是大多数 helper 的基础入口

## 录制与回放指令

### `alog`

两种常用模式：

- `start_record(sfport, log_name, opt=None)`：异步开始录制
- `alog(sfport, log_name, opt=None, timeout=None)`：同步等待设备响应

`LogOption` 支持：

- `width`
- `height`
- `stposx`
- `stposy`

### `astop`

- `stop_record(sfport)`：异步停止录制
- `astop(sfport, timeout=None)`：同步等待输出

### `acancel`

- `cancel(sfport, timeout=None)`：取消当前回放或设备侧取消动作

### `aplay`

Python 当前通过串口对象或控制器直接发送：

```python
sfport.start_replaying("demo", 0)
ctrl.start_replaying("demo", 0)
```

## 设备、网络与文件系统指令

### `sn`

```python
from mkp_python import device_sn
print(device_sn(sfport))
```

返回 `SN(sn="...")`。

### `list_dir`

```python
from mkp_python import list_dir
print(list_dir(sfport, "/eMMC/applog"))
```

返回 `FileSystem(path=..., files=[FileNode(...)])`。

### `clean_dir` / `delete_file`

- `clean_dir(sfport, path)`
- `delete_file(sfport, path)`

通常返回设备文本确认，parser 侧按纯文本成功处理。

### `alive`

返回 `Heartbeat`，用于检查设备在线状态。

### `atime`

返回 `LogLength(seconds=..., milsec=...)`。

示例：

```powershell
python -m examples.directives.atime "/eMMC/applog/spike.log"
```

### `aversion`

返回 `MKPVersion(uver=..., aver=...)`。

### `ainsp`

Python helper 名为 `ainspect()`，底层 directive 仍然是 `ainsp`。

返回 `LogInfo`，常见字段包含：

- `seconds`
- `milsec`
- `width`
- `height`
- `stposx`
- `stposy`

### `join`

`JoinOption` 用于传入 SSID / password 等参数，parser 最终归一化为：

- `connected`
- `connecting`

### `wifi_auto`

`WifiAutoOption` 控制自动连接开关，parser 最终归一化为：

- `on`
- `off`
- `""`（设备未明确返回时）

### `ahttpbase`

返回 `AHTTPBase(ahttpbase="...")`。

为了兼容不同固件回包：

- 优先解析 JSON
- 若只收到 `OK`，则回退为从当前 CLI 参数恢复 URL

### `adumj`

返回 `ActionDump(meta=..., datas=[...])`。

适合将设备上的动作日志导出为可进一步处理的 JSON 结构。

### `aget` / `aput` / `ajson2log`

- `aupload_to_mkp(sfport, AGetOption(...))`
- `adownload_from_mkp(sfport, APutOption(...))`
- `ajson2log(sfport, AJSON2LogOption(...))`

这些 helper 当前统一返回设备文本结果；若输出包含 `error code`、`Upload failed`、`server returned status` 等内容，则视为执行失败。

## 鼠标指令：`m10`

`M10Option` 当前支持：

- `button`
- `x`
- `y`
- `wheel`
- `async_mode`
- `sync_ignore_output`

对应 CLI 片段：

- `--b <button>`
- `--x <delta>`
- `--y <delta>`
- `--w <delta>`

### 常用用法

```python
from mkp_python import M10Option, mouse_release_all

sfport.mouse10(M10Option().set_x(100).set_y(50))
sfport.mouse10(M10Option().with_left_button())
mouse_release_all(sfport)
```

### 同步模式

```python
sfport.mouse10(M10Option().set_x(10).with_async(False))
sfport.mouse10(M10Option().set_x(10).with_sync_ignore_output(True))
```

以上两种写法都表示：**同步发送，并忽略设备输出文本**。

### 示例

`examples/m10.py` 当前会：

1. 左移 `400`
2. 上移 `400`

## 键盘指令：`kpad`

`KpadOption` 当前支持：

- `mod_keys`
- `keys`
- `release`
- `delay`
- `verbose`
- `async_mode`
- `sync_ignore_output`

对应 CLI 片段：

- `--s <mod status>`
- `--x1 ... --x6`
- `--rel <release>`
- `--d <delay>`
- `--v 1`

### 常用用法

```python
from mkp_python import KpadOption, key_down, key_tap, key_up

sfport.keypad(KpadOption().with_keys(["CTRL", "C"]).with_auto_release())
key_tap(sfport, "A")
key_down(sfport, "W")
key_up(sfport, "W")
```

### 状态型 helper

为了对齐按下 / 保持 / 释放语义，`KpadOption` 内部维护了已按下键缓存，相关 helper 包括：

- `key_down()`
- `key_up()`
- `key_tap()`
- `key_presses()`
- `keypad_release()`
- `keypad_release_all()`
- `reset_kpad_pressed_caches()`

### 示例

`examples/kpad.py` 当前会逐键输出 `Hello MKP!`，并通过 `MOD_LSHIFT` 区分大小写与 `!`。

## 输出解析器索引

当前 `parser.py` 中注册的 directive parser 如下：

| Directive | Parser |
|---|---|
| `astop` | `AstopParser` |
| `acancel` | `RawJSONTextParser` |
| `sn` | `RawJSONTextParser` |
| `list_dir` | `RawJSONTextParser` |
| `clean_dir` | `PlainSuccessParser` |
| `delete_file` | `PlainSuccessParser` |
| `alive` | `RawJSONTextParser` |
| `atime` | `LineJSONParser` |
| `aversion` | `RawJSONTextParser` |
| `ainsp` | `LineJSONParser` |
| `join` | `JoinParser` |
| `wifi_auto` | `WifiAutoParser` |
| `adumj` | `AdumjParser` |
| `ahttpbase` | `AHTTPBaseParser` |
| `aget` | `AGetParser` |
| `aput` | `APutParser` |
| `ajson2log` | `AJSON2LogParser` |
| `alog` | `PlainSuccessParser` |

如果某个 directive 尚未注册 parser，`send_parsed()` 会抛出 `ErrDirectiveParserMissing`。

## 常见异常

- `ErrDirectiveParserMissing`：未找到 parser
- `ErrRawDirectiveParseFailed`：输出存在，但没能按预期结构解析
- `ErrRawDirectiveExecutionFailed`：设备输出中含执行失败特征
- `DirectiveTimeoutError`：同步等待输出超时

## 返回结构索引

`models.py` 中与 directive 直接相关的 dataclass 包括：

- `SN`
- `FileNode`
- `FileSystem`
- `Heartbeat`
- `LogOption`
- `JoinOption`
- `WifiAutoOption`
- `AGetOption`
- `APutOption`
- `AJSON2LogOption`
- `AHTTPBaseOption`
- `AHTTPBase`
- `AdumjOption`
- `ActionDumpMeta`
- `ActionDump`
- `LogLength`
- `LogInfo`
- `MKPVersion`
- `M10Option`
- `KpadOption`
- `SerialPortStatus`

## Controller 代理能力

`Controller` 对串口 helper 做了一层方法代理，常见包括：

- `start_record()` / `stop_record()` / `alog()` / `astop()` / `cancel()`
- `join()` / `wifi_auto()` / `device_sn()`
- `list_dir()` / `clean_dir()` / `delete_file()`
- `alive()` / `atime()` / `aversion()` / `ainspect()`
- `aupload_to_mkp()` / `adownload_from_mkp()` / `ajson2log()` / `ahttpbase()` / `adumj()`
- `start_replaying()`
- `snapshot_status()`

## HTTP API / CLI 对照

### HTTP API

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

### CLI

- `mkp version`
- `mkp list`
- `mkp record start <log_name>`
- `mkp stop`
- `mkp replay <record_id>`
- `mkp cancel`
- `mkp remove <record_id>`
- `mkp auth login <username> <password>`
- `mkp auth token`
- `mkp auth revoke [--forget]`

## 注意事项

- 本文档仅覆盖 `mkp-python` 当前已实现指令
- 如果你要继续补齐和 `mkp-go` 的行为对齐，优先检查：parser 注册、helper 返回模型、examples 是否同步更新
- 上层总览见 [README.md](./README.md)











