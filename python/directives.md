# MKP Python 指令补充说明

[English](./directives.en.md) | 中文 | [共享指令说明](../directives.md) | [Python README](./README.md)

---

## 目录

- [文档定位](#文档定位)
- [Python 使用约定](#python-使用约定)
- [示例索引](#示例索引)
- [Python API 快速对照](#python-api-快速对照)
- [常见异常与调试](#常见异常与调试)
- [返回结构索引](#返回结构索引)
- [Controller / HTTP API / CLI 对照](#controller--http-api--cli-对照)
- [注意事项](#注意事项)

## 文档定位

共享 directive 语义请直接查阅仓库根目录：`../directives.md`。

本文档只保留 Python 语言特有内容：

- Python helper / dataclass 映射
- Python example 路径与运行命令
- Python 版自动调试摘要能力
- Python 的 HTTP server / CLI 暴露方式

## Python 使用约定

- 串口同步解析前，应先 `open()`、`reset_input_buffer()`、`start_read_loop()`
- `sync_output_enabled = True` 时，`send_parsed()` 才适合等待结构化输出
- 以下路径与命令均相对于 `mkp-kit/python/`
- 推荐直接复用 `examples.common.init_sfport()`

## 示例索引

| 指令 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `sn` | `examples/directives/sn.py` | `python -m examples.directives.sn` | 查询设备序列号 |
| `aversion` | `examples/directives/aversion.py` | `python -m examples.directives.aversion` | 查询版本信息 |
| `alive` | `examples/directives/alive.py` | `python -m examples.directives.alive` | 查询在线状态 / 心跳 |
| `list_dir` | `examples/directives/list_dir.py` | `python -m examples.directives.list_dir` | 列目录 |
| `clean_dir` | `examples/directives/clean_dir.py` | `python -m examples.directives.clean_dir` | 清理目录 |
| `delete_file` | `examples/directives/delete_file.py` | `python -m examples.directives.delete_file` | 删除文件 |
| `join` | `examples/directives/join.py` | `python -m examples.directives.join [ssid] [password]` | 连接指定 Wi‑Fi |
| `wifi_auto` | `examples/directives/wifi_auto.py` | `python -m examples.directives.wifi_auto [0|1]` | 查询或设置 Wi‑Fi 自动连接 |
| `ahttpbase` | `examples/directives/ahttpbase.py` | `python -m examples.directives.ahttpbase [url]` | 查询或设置文件服务基地址 |
| `ainsp` | `examples/directives/ainsp.py` | `python -m examples.directives.ainsp` | 读取日志基础信息 |
| `atime` | `examples/directives/atime.py` | `python -m examples.directives.atime` | 读取日志时长 |
| `adumj` | `examples/directives/adumj.py` | `python -m examples.directives.adumj <log_path>` | 设备日志转动作 JSON |
| `aget` | `examples/directives/aget.py` | `python -m examples.directives.aget <filepath>` | 从 file server 拉取文件到 MKP |
| `aput` | `examples/directives/aput.py` | `python -m examples.directives.aput <filepath>` | 从 MKP 上传文件到 file server |
| `ajson2log` | `examples/directives/ajson2log.py` | `python -m examples.directives.ajson2log <jsonpath> <outputlogpath>` | JSON 动作转回 MKP log |
| `alog` | `examples/directives/alog.py` | `python -m examples.directives.alog [log_name]` | 启动同步录制 |
| `astop` | `examples/directives/astop.py` | `python -m examples.directives.astop` | 停止当前录制 |

## Python API 快速对照

| 指令 | Python helper / 方法 | 返回 |
|---|---|---|
| `alog` | `alog()` / `Controller.alog()` | `None` / `str` |
| `aplay` | `sfport.start_replaying()` / `Controller.start_replaying()` | `None` |
| `astop` | `astop()` / `stop_record()` | `None` / `str` |
| `acancel` | `cancel()` | `dict` / `str` / 空文本 |
| `sn` | `device_sn()` | `SN` |
| `list_dir` | `list_dir()` | `FileSystem` |
| `clean_dir` | `clean_dir()` | `str` |
| `delete_file` | `delete_file()` | `str` |
| `join` | `join()` | `str` |
| `wifi_auto` | `wifi_auto()` | `str` |
| `ahttpbase` | `ahttpbase()` | `AHTTPBase` |
| `adumj` | `adumj()` | `ActionDump` |
| `aget` | `aupload_to_mkp()` | `AGet` / 文本 |
| `aput` | `adownload_from_mkp()` | `APut` / 文本 |
| `ajson2log` | `ajson2log()` | `AJson2Log` / 文本 |
| `alive` | `alive()` | `Heartbeat` |
| `atime` | `atime()` | `LogLength` |
| `aversion` | `aversion()` | `MKPVersion` |
| `ainsp` | `ainspect()` | `LogInfo` |
| `m10` | `mouse10()` | 无结构化输出 |
| `kpad` | `keypad()` / `key_tap()` | 无结构化输出 |

## 常见异常与调试

当同步等待超时，或 parser 无法从设备输出中提取期望内容时：

- Python 版会把原始串口输出写到 `.mkp-debug/`
- 目录可由 `MKP_DEBUG_SERIAL_DIR` 覆盖
- 调试文件通常包含自动摘要、directive 原文、原始串口输出、待处理缓冲区、最近一次成功同步输出、最近一次读错误

这部分是 Python 版相对 Go / Rust 更突出的排障能力。

## 返回结构索引

| Python dataclass | 用途 |
|---|---|
| `SN` | `sn` 输出 |
| `Heartbeat` | `alive` 输出 |
| `MKPVersion` | `aversion` 输出 |
| `LogLength` | `atime` 输出 |
| `LogInfo` | `ainsp` 输出 |
| `FileSystem` | `list_dir` 输出 |
| `ActionDump` | `adumj` 输出 |
| `AHTTPBase` | `ahttpbase` 输出 |

## Controller / HTTP API / CLI 对照

- `Controller`：更高层录制、回放、文件与输入动作代理
- HTTP server：`src/mkp_python/server.py`
- CLI：`src/mkp_python/cli.py`
- file server：`mkp-file-server`
- converter：`mkp-converter` / `mkp-log2json` / `mkp-json2log`

## 注意事项

- 共享 directive 语义改动，应优先更新 `../directives.md`。
- Python 子文档只补充 Python helper、调试能力、CLI / HTTP 暴露和 dataclass 命名。
- `send_parsed()` 负责 parser 选择，高层 helper 再负责把 `dict` 转成 dataclass。
