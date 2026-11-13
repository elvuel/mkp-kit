# MKP Node.js / TypeScript

[English](./README.en.md) | 中文 | [共享总览](../README.md) | [共享指令说明](../directives.md) | [Node 指令补充](./directives.md)

---

本文档只维护 `mkp-kit/node/` 的 **Node.js / TypeScript 语言特有用法与差异**。

跨语言共享内容统一维护在仓库根目录：

- 共享总览：`../README.md`
- 共享指令说明：`../directives.md`

## 安装

在 `mkp-kit` monorepo 中，Node.js / TypeScript 实现位于 `node/` 子目录。

```powershell
cd D:\projects\mkp-kit\node
npm install
npm run build
```

当前 `package.json` 约定：

- package name：`@elvuel/mkp-node`
- 当前仍为 `private: true`
- Node.js `>= 20`
- 主要依赖：`serialport`
- `mkp-server` 的 SQLite 持久化已在 Node.js `24.x` 验证；若运行时没有 `node:sqlite`，可改用 `MKP_DB_DRIVER=memory`

## 快速开始

```ts
import { checkSFSerialPort, deviceSn, newSFSerialPort } from "@elvuel/mkp-node";

async function main(): Promise<void> {
  const portName = process.env.MKP_SERIAL_PORT ?? await checkSFSerialPort();
  const sfport = newSFSerialPort({ name: portName });
  await sfport.open();

  try {
    console.log(await deviceSn(sfport));
  } finally {
    await sfport.close();
  }
}

void main();
```

同步解析前提：

- 已 `open()` 串口
- 默认通过 `sendParsed()` 等待结构化输出
- Node 版不需要像 Go / Python 那样显式启动单独的读循环

## 示例

以下路径与命令均相对于 `mkp-kit/node/`。

| 示例 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `m10` | `examples/m10.ts` | `npm run example:m10` | 演示鼠标左平移 `400`，然后再向上移动 `400`（dry-run） |
| `kpad` | `examples/kpad.ts` | `npm run example:kpad` | 输出 `Hello MKP!`（区分大小写，dry-run） |
| `keys` | `examples/keys.ts` | `npm run example:keys` | 演示 `keyTap`、`keyDown`、`keyUp` 与 `keyPresses` |
| `context` | `examples/context.ts` | `npm run example:context` | 演示基于 `AbortSignal` 的超时取消与手动取消 |
| `m10_device` | `examples/m10_device.ts` | `npm run example:m10:device` | 连接真实设备执行 `m10` |
| `kpad_device` | `examples/kpad_device.ts` | `npm run example:kpad:device` | 连接真实设备执行 `kpad` |
| `common` | `examples/common.ts` | 被其它示例复用 | 提供 fixture transport、example 参数解析、端口解析与输出辅助 |

常见 directive 示例：

| 指令示例 | 源码路径 | 运行命令 | 用途 |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/directives/<name>.ts` | `npm run build && node dist/examples/directives/sn.js --help` | 查询设备序列号、版本与在线状态，并支持统一帮助输出 |
| `list_dir` / `clean_dir` / `delete_file` | `examples/directives/<name>.ts` | `npm run build && node dist/examples/directives/list_dir.js /eMMC/applog` | 浏览目录、清理目录、删除文件 |
| `join` / `wifi_auto` / `ahttpbase` | `examples/directives/<name>.ts` | `npm run build && node dist/examples/directives/join.js <ssid> <password>` | 配置 Wi‑Fi、自动联网与 HTTP 基地址 |
| `ainsp` / `atime` | `examples/directives/<name>.ts` | `npm run build && node dist/examples/directives/atime.js /eMMC/applog/spike.log` | 查看日志信息与时长；其中 `atime` 输出 `seconds` / `milsec`，`ainsp` 输出 `seconds` / `milsec` / `width` / `heigh` / `stpos` |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/directives/<name>.ts` | `npm run build && node dist/examples/directives/ajson2log.js D:\tmp\demo.json /eMMC/applog/demo.log` | 上传、下载与 JSON/日志互转 |
| `alog` / `astop` | `examples/directives/<name>.ts` | `npm run build && node dist/examples/directives/alog.js mkpdemo/demo` | 开始录制与停止录制 |

## Node 特有表面

### HTTP Server

```powershell
cd D:\projects\mkp-kit\node
npm run build
$env:MKP_SF_PORT = "COM5"
$env:MKP_JWT_SECRET = "change-me"
$env:MKP_USER = "admin"
$env:MKP_PASSWORD = "admin123"
node .\dist\src\bin\mkp-server.js --config .\server.json
```

主要路由：

- `GET /health`
- `POST /api/v1/auth/token`
- `GET /api/v1/version`
- `GET /api/v1/directives/list`
- `GET /api/v1/directives/records/:id`
- `DELETE /api/v1/directives/records/:id`
- `GET /api/v1/directives/replay/status`
- `POST /api/v1/directives/alog`
- `POST /api/v1/directives/astop`
- `POST /api/v1/directives/aplay/:id`
- `POST /api/v1/directives/acancel`

当前 Node server 还额外支持：

- 基于 HMAC SHA256 的 JWT token
- 基于 `server.json` / `MKP_CONFIG_PATH` 的配置文件加载
- CORS 与 `OPTIONS` 预检
- `sqlite` / `sqlite3` / `memory` 三种 records driver

### HTTP Client

```powershell
node .\dist\src\bin\mkp-client.js auth login --server http://127.0.0.1:8000 --username admin --password admin123
node .\dist\src\bin\mkp-client.js auth token
node .\dist\src\bin\mkp-client.js list
node .\dist\src\bin\mkp-client.js recording --name demo
node .\dist\src\bin\mkp-client.js stop
node .\dist\src\bin\mkp-client.js replay --id 1
node .\dist\src\bin\mkp-client.js remove --id 1
node .\dist\src\bin\mkp-client.js version
```

`mkp-client` 支持本地配置文件、token 缓存、自动复用与版本缓存。

### CLI

```powershell
node .\dist\src\bin\mkp.js --help
node .\dist\src\bin\mkp.js sn
node .\dist\src\bin\mkp.js m10 --x -400 --y -400
node .\dist\src\bin\mkp.js kpad --text "Hello MKP!"
node .\dist\src\bin\mkp.js raw sn
```

### 转换工具与文件服务

```powershell
node .\dist\src\bin\converter.js -f .\sample.log
node .\dist\src\bin\converter.js -f .\sample.json -o .\out
node .\dist\src\bin\json2log.js -f .\sample.json -o .\sample.log
node .\dist\src\bin\log2json.js -f .\sample.log -o .\sample.json
node .\dist\src\bin\file-server.js -p 8080 -r .\file_root
```

## 仓库结构

以下路径均相对于 `mkp-kit/node/`。

| 路径 | 说明 |
|---|---|
| `package.json` | Node package 声明、bin 入口与 scripts |
| `src/sdk.ts` | 串口对象、directive 发送与基础 helper |
| `src/parser.ts` | parser 注册与解析逻辑 |
| `src/models.ts` | 返回接口与 option 类型 |
| `src/helper.ts` | 键盘 / 鼠标便捷 helper |
| `src/controller.ts` | 更高层代理与业务能力 |
| `src/cli.ts` | `mkp` 串口 CLI |
| `src/client.ts` | `mkp-client` HTTP client CLI |
| `src/server.ts` | HTTP server 主实现 |
| `src/server_config.ts` | `server.json` 与 `--config` 解析 |
| `src/converter.ts` | `.log` / `.json` 转换 |
| `src/file_server.ts` | 文件服务 |
| `examples/` | `m10` / `kpad` / `keys` / `context` / directive 示例 |
| `directives.md` | Node 版 directive 补充说明 |

## Node 特有注意事项

- `examples/directives/*` 当前默认连接真实设备；如需离线演示 parser，可显式追加 `--fixture` 使用桩响应。
- `examples/m10.ts` 与 `examples/kpad.ts` 默认使用 `DryRunTransport`；directive 示例则默认连接真实设备，并支持 `MKP_SERIAL_PORT` / `--port COMx` 指定串口。
- `examples/context.ts` 展示的是 Node 侧基于 `AbortSignal` 的取消封装，不是 Go `context.Context` 的一比一 API 对齐。
- `aversion` 当前按 Go 语义输出 `uver` / `aver`；parser 仍兼容旧固件可能返回的 `app` / `boot` 字段。
- `ainsp` 当前按 Go 语义输出 `seconds` / `milsec` / `width` / `heigh` / `stpos`，不再以 `name` / `path` / `size` 作为主返回结构。
- 当前 `join` / `wifi_auto` / `aget` / `aput` / `ajson2log` 仍以文本返回为主，尚未像部分其它语言一样补齐专门返回模型。
- 当前 `mkp-server` 仅支持 `sqlite` / `sqlite3` / `memory`；Go 侧 MySQL / PostgreSQL driver parity 仍可后续补齐。
- 共享 directive 含义变更时，请优先更新仓库根目录文档，再回到 `node/` 补 Node 特有差异。
