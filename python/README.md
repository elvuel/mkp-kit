# MKP Python

[English](./README.en.md) | 中文 | [指令帮助索引](./directives.md)

---

### MKP 是什么？

**MKP** 在本项目中指一套通过串口控制的 **鼠标 / 键盘录制、回放与文件管理设备及其 CLI 指令协议**。

它通常运行在带 USB HID 能力的外部设备 / 固件上：上位机通过串口向 MKP 设备发送 `m10`、`kpad`、`alog`、`aplay`、`list_dir` 等指令，设备再以 USB HID 鼠标 / 键盘的形式向目标系统输出输入事件，或在设备端录制、回放、检查和管理输入日志 / 文件。

`mkp-python` 是 MKP 协议的 Python SDK / 客户端库，主要负责：

- 提供串口 SDK 与同步 / 异步指令发送；
- 提供鼠标、键盘、录制、回放、文件管理等高层 API；
- 解析设备返回的 JSON / 文本输出；
- 提供 FastAPI 版 HTTP server 与 Typer 版 CLI；
- 提供 `.log` / `.json` 转换工具与本地文件服务。

> 简单来说：**MKP 是硬件 / 固件侧的鼠标键盘自动化与回放协议；MKP Python 是用 Python 操作它的库。**

### 项目定位

`mkp-python` 不是直接调用系统鼠标键盘事件的本地自动化库。它的核心链路是：

```text
Python 程序 -> 串口 -> MKP 设备 / 固件 -> USB HID 鼠标 / 键盘事件 -> 目标系统
```

它适合：

- 需要通过外部 HID 设备输出鼠标 / 键盘事件；
- 需要在设备端录制并回放输入日志；
- 需要把 MKP CLI 指令封装成 Python API、HTTP API 或 CLI。

### 主要能力

| 能力 | 说明 | 相关 API / 命令 |
|---|---|---|
| 串口连接 | 打开串口、启动读循环、同步等待输出 | `new_sf_serial_port()`、`open()`、`start_read_loop()` |
| 原始指令 | 直接发送任意 directive | `send_directive()`、`send_directive_async()`、`send_parsed()` |
| 鼠标控制 | 相对移动、按键、滚轮、全释放 | `m10`、`mouse10()`、`mouse_release_all()` |
| 键盘控制 | 按下、释放、点击、组合键、全释放 | `kpad`、`keypad()`、`key_tap()` |
| 录制回放 | 启动录制、停止、取消、回放 | `alog`、`astop`、`acancel`、`start_replaying()` |
| 文件管理 | 列目录、删文件、清目录 | `list_dir`、`delete_file`、`clean_dir` |
| 设备信息 | SN、心跳、版本、日志长度与详情 | `sn`、`alive`、`aversion`、`atime`、`ainsp` |
| 网络 / 传输 | Wi‑Fi、HTTP 基址、日志导入导出 | `join`、`wifi_auto`、`ahttpbase`、`aget`、`aput`、`ajson2log` |
| HTTP API | JWT 鉴权、录制列表、回放控制 | `mkp-server` |
| CLI | 访问 HTTP API 的客户端 | `mkp` |
| 工具 | 日志转换、本地文件服务 | `mkp-converter`、`mkp-file-server` |

完整指令说明见 [directives.md](./directives.md)。

## 安装

在 `mkp-kit` monorepo 中，Python 实现位于 `python/` 子目录。

```powershell
cd D:\projects\mkp-kit\python
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
pip install -e .[dev]
```

当前 `pyproject.toml` 要求：

- Python `>= 3.12`
- 主要依赖：`pyserial`、`fastapi`、`uvicorn`、`sqlalchemy`、`PyJWT`、`httpx`、`typer`

## 快速开始

### 1. 手动初始化串口

```python
from mkp_python import check_sf_serial_port, device_sn, new_sf_serial_port

sfport = new_sf_serial_port()
sfport.name = check_sf_serial_port()
sfport.open()
sfport.reset_input_buffer()
sfport.start_read_loop()

try:
    sn = device_sn(sfport)
    print(sn)
finally:
    sfport.close()
```

如果需要同步等待设备输出，请确保：

- 已启动 `start_read_loop()`
- `sfport.sync_output_enabled = True`

`examples.common.init_sfport()` 已经封装了这些初始化步骤。

## 示例

下表按“源码路径 / 运行命令 / 示例行为”整理 Python 版示例；以下路径与命令均相对于 `mkp-kit/python/`。

| 示例 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `m10` | `examples/m10.py` | `python -m examples.m10` | 鼠标左平移 `400`，然后再向上移动 `400` |
| `kpad` | `examples/kpad.py` | `python -m examples.kpad` | 输出 `Hello MKP!`（区分大小写） |
| `keys` | `examples/keys.py` | `python -m examples.keys` | 演示 helper 层按下、抬起、点击与全释放 |
| `context` | `examples/context.py` | `python -m examples.context` | 演示 `alog` 超时与手动 `astop` 中断 |
| `common` | `examples/common.py` | 被其它示例复用 | 提供串口初始化与格式化输出辅助 |

常见 directive 示例同样按表整理：

| 指令示例 | 源码路径 | 运行命令 | 用途 |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/directives/<name>.py` | `python -m examples.directives.sn` | 查询设备序列号、版本与在线状态 |
| `list_dir` / `clean_dir` / `delete_file` | `examples/directives/<name>.py` | `python -m examples.directives.list_dir "/eMMC/applog"` | 浏览目录、清理目录、删除文件 |
| `join` / `wifi_auto` / `ahttpbase` | `examples/directives/<name>.py` | `python -m examples.directives.join <ssid> <password>` | 配置 Wi‑Fi、自动联网与 HTTP 基地址 |
| `ainsp` / `atime` | `examples/directives/<name>.py` | `python -m examples.directives.atime "/eMMC/applog/spike.log"` | 查看日志信息与时长 |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/directives/<name>.py` | `python -m examples.directives.ajson2log "D:\tmp\demo.json" "/eMMC/applog/demo.log"` | 上传、下载与 JSON/日志互转 |
| `alog` / `astop` | `examples/directives/<name>.py` | `python -m examples.directives.alog "mkpdemo/demo"` | 开始录制与停止录制 |

## 常见 API

### 录制 / 回放

```python
from mkp_python import LogOption, alog, astop, cancel

alog(sfport, "demo", LogOption(width=1920, height=1080))
astop(sfport)
cancel(sfport)

sfport.start_replaying("demo", 0)
```

### 文件 / 设备信息

```python
from mkp_python import ainspect, atime, aversion, device_sn, list_dir

print(device_sn(sfport))
print(list_dir(sfport, "/eMMC/applog"))
print(atime(sfport, "/eMMC/applog/demo.log"))
print(ainspect(sfport, "/eMMC/applog/demo.log"))
print(aversion(sfport))
```

### 键盘辅助函数

```python
from mkp_python import key_down, key_tap, key_up

key_tap(sfport, "A")
key_down(sfport, "W")
key_up(sfport, "W")
```

## 指令模式与解析规则

- `m10` / `kpad` 默认异步发送
- `M10Option.with_async(False)` 与 `with_sync_ignore_output(True)` 都表示同步发送并忽略输出
- `KpadOption` 也遵循同样规则
- `send_parsed()` 会按 directive 自动选择 parser，并将 JSON 结果反序列化为 `dict`
- 高层 helper（如 `atime()`、`ahttpbase()`、`adumj()`）会进一步转换为 dataclass 模型

如果解析失败或同步超时，Python 版会自动抓取原始串口输出并写入调试目录，便于排查设备端回包差异。

## HTTP Server

启动：

```powershell
$env:MKP_SF_PORT = "COM5"
$env:MKP_JWT_SECRET = "change-me"
$env:MKP_USER = "admin"
$env:MKP_PASSWORD = "admin123"
python -m mkp_python.server
```

默认值与常用环境变量：

- `MKP_SF_PORT` / `SF_PORT`：串口名
- `MKP_PORT` / `PORT`：HTTP 端口，默认 `8080`
- `MKP_JWT_SECRET` / `JWT_SECRET`：JWT 密钥
- `MKP_USER` / `JWT_USER`：用户名，默认 `admin`
- `MKP_PASSWORD` / `JWT_PASSWORD`：密码，默认 `admin123`
- `MKP_DATABASE_URL`：数据库连接串；默认 `sqlite:///mkp.db`
- `MKP_SYNC_DIRECTIVE_TIMEOUT_MS`：同步 directive 超时，默认 `10000`
- `MKP_ASYNC_DIRECTIVE_TIMEOUT_MS`：异步 directive 超时，默认 `3000`

主要路由：

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

## CLI

CLI 默认访问 `http://127.0.0.1:8080`，配置文件保存在 `~/.mkp/client.json`。

```powershell
mkp version
mkp auth login admin admin123
mkp auth token
mkp list
mkp record start demo --width 1920 --height 1080
mkp stop
mkp replay <record_id>
mkp cancel
mkp remove <record_id>
```

## 转换工具

```powershell
mkp-converter -f .\sample.log
mkp-converter -f .\sample.json
mkp-json2log -f .\sample.json -o .\sample.log
mkp-log2json -f .\sample.log -o .\sample.json
```

用途：

- `.log -> .json`：便于分析或编辑动作日志
- `.json -> .log`：把 JSON envelope 重新写回设备可用日志格式

## 文件服务

```powershell
mkp-file-server --root .\file_root --port 8080
```

支持：

- `GET /<path>`：下载文件
- `PUT /<path>`：原始字节上传
- `POST /upload`：multipart 上传，字段 `file` + `path`
- `GET /list?path=`：列目录

## 串口调试与自动摘要

当同步指令超时，或 parser 无法从设备输出中提取结构化结果时，`mkp-python` 会自动写入 `.mkp-debug/`（可由 `MKP_DEBUG_SERIAL_DIR` 覆盖）。

调试文件包含：

- 自动摘要：当前卡在哪一步、可能原因、下一步建议
- directive 原文
- 原始串口输出
- 当前待处理缓冲区
- 最近一次成功同步输出
- 最近一次读错误

这部分是 Python 版针对设备返回不稳定场景增加的排障能力。

## 仓库结构

以下路径均相对于 `mkp-kit/python/`。

- `src/mkp_python/sdk.py`：串口、helper、`Controller`
- `src/mkp_python/models.py`：各类 option / response dataclass
- `src/mkp_python/parser.py`：directive parser 注册与解析逻辑
- `src/mkp_python/server.py`：FastAPI server
- `src/mkp_python/cli.py`：Typer CLI
- `src/mkp_python/converter.py`：`.log` / `.json` 转换
- `src/mkp_python/file_server.py`：本地文件服务
- `examples/`：串口、鼠标、键盘、directive 示例
- `tests/`：parser、converter、file server 测试

## 注意事项

- Python 版优先对齐 `mkp-go` 的核心 SDK / directive / HTTP API 行为
- 文档仅覆盖当前 Python 仓库已实现能力；若设备固件新增 directive，需要同步补 parser 与文档
- 指令级细节见 [directives.md](./directives.md)










