# MKP Python

[English](./README.en.md) | 中文 | [共享总览](../README.md) | [共享指令说明](../directives.md) | [Python 指令补充](./directives.md) | [PyPI 发布说明](./PYPI.md)

---

本文档只维护 `mkp-kit/python/` 的 **Python 语言特有用法与差异**。

跨语言共享内容统一维护在仓库根目录：

- 共享总览：`../README.md`
- 共享指令说明：`../directives.md`
- Python 发布说明：`./PYPI.md`

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

```python
from mkp_python import check_sf_serial_port, device_sn, new_sf_serial_port

sfport = new_sf_serial_port()
sfport.name = check_sf_serial_port()
sfport.open()
sfport.reset_input_buffer()
sfport.start_read_loop()

try:
    print(device_sn(sfport))
finally:
    sfport.close()
```

同步解析前提：

- 已启动 `start_read_loop()`
- `sfport.sync_output_enabled = True`

## 示例

以下路径与命令均相对于 `mkp-kit/python/`。

| 示例 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `m10` | `examples/m10.py` | `python -m examples.m10` | 鼠标左平移 `400`，然后再向上移动 `400` |
| `kpad` | `examples/kpad.py` | `python -m examples.kpad` | 输出 `Hello MKP!`（区分大小写） |
| `keys` | `examples/keys.py` | `python -m examples.keys` | 演示 helper 层按下、抬起、点击与全释放 |
| `context` | `examples/context.py` | `python -m examples.context` | 演示 `alog` 超时与手动 `astop` 中断 |
| `common` | `examples/common.py` | 被其它示例复用 | 提供串口初始化与格式化输出辅助 |

常见 directive 示例：

| 指令示例 | 源码路径 | 运行命令 | 用途 |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/directives/<name>.py` | `python -m examples.directives.sn` | 查询设备序列号、版本与在线状态 |
| `list_dir` / `clean_dir` / `delete_file` | `examples/directives/<name>.py` | `python -m examples.directives.list_dir "/eMMC/applog"` | 浏览目录、清理目录、删除文件 |
| `join` / `wifi_auto` / `ahttpbase` | `examples/directives/<name>.py` | `python -m examples.directives.join <ssid> <password>` | 配置 Wi‑Fi、自动联网与 HTTP 基地址 |
| `ainsp` / `atime` | `examples/directives/<name>.py` | `python -m examples.directives.atime "/eMMC/applog/spike.log"` | 查看日志信息与时长 |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/directives/<name>.py` | `python -m examples.directives.ajson2log "D:\tmp\demo.json" "/eMMC/applog/demo.log"` | 上传、下载与 JSON/日志互转 |
| `alog` / `astop` | `examples/directives/<name>.py` | `python -m examples.directives.alog "mkpdemo/demo"` | 开始录制与停止录制 |

## Python 特有表面

### HTTP Server

```powershell
$env:MKP_SF_PORT = "COM5"
$env:MKP_JWT_SECRET = "change-me"
$env:MKP_USER = "admin"
$env:MKP_PASSWORD = "admin123"
python -m mkp_python.server
```

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

### CLI

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

### 转换工具与文件服务

```powershell
mkp-converter -f .\sample.log
mkp-converter -f .\sample.json
mkp-json2log -f .\sample.json -o .\sample.log
mkp-log2json -f .\sample.log -o .\sample.json
mkp-file-server --root .\file_root --port 8080
```

## 仓库结构

以下路径均相对于 `mkp-kit/python/`。

| 路径 | 说明 |
|---|---|
| `src/mkp_python/sdk.py` | 串口对象、directive 发送、基础 helper |
| `src/mkp_python/parser.py` | parser 注册与解析逻辑 |
| `src/mkp_python/models.py` | dataclass 返回模型与 option 类型 |
| `src/mkp_python/controller.py` | 更高层代理与业务能力 |
| `src/mkp_python/server.py` | FastAPI HTTP server |
| `src/mkp_python/cli.py` | Typer CLI |
| `examples/` | `m10` / `kpad` / directive 示例 |
| `directives.md` | Python 版 directive 补充说明 |

## Python 特有注意事项

- 当同步指令超时，或 parser 无法提取结构化结果时，`mkp-python` 会自动写入 `.mkp-debug/`（可由 `MKP_DEBUG_SERIAL_DIR` 覆盖）。
- 调试文件会包含自动摘要、directive 原文、原始串口输出、待处理缓冲区、最近一次成功同步输出等信息。
- `send_parsed()` 会先得到 `dict`，高层 helper 再进一步转换为 dataclass 模型。
- 共享 directive 含义变更时，请优先更新仓库根目录文档，再回到 `python/` 补 Python 特有差异。
