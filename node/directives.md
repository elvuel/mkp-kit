# MKP Node.js / TypeScript 指令补充说明

[English](./directives.en.md) | 中文 | [共享指令说明](../directives.md) | [Node README](./README.md)

---

## 目录

- [文档定位](#文档定位)
- [Node 使用约定](#node-使用约定)
- [示例索引](#示例索引)
- [Node API 快速对照](#node-api-快速对照)
- [输出解析索引](#输出解析索引)
- [返回结构索引](#返回结构索引)
- [Controller / HTTP API / CLI 对照](#controller--http-api--cli-对照)
- [已知差异](#已知差异)

## 文档定位

共享 directive 语义请直接查阅仓库根目录：`../directives.md`。

本文档只保留 Node.js / TypeScript 语言特有内容：

- Node helper / interface 映射
- Node example 路径与运行命令
- Node parser 的 EOF / prompt 约定
- Node 的 HTTP server / HTTP client CLI / serial CLI 暴露方式

## Node 使用约定

- 以下路径与命令均相对于 `mkp-kit/node/`
- 运行示例前建议先执行一次 `npm run build`
- `examples/directives/*` 默认连接真实设备；如需离线验证 parser，可追加 `--fixture` 切换到桩响应
- `examples/m10.ts` / `examples/kpad.ts` 默认走 `DryRunTransport`
- 真实设备联调时，可通过 `MKP_SERIAL_PORT` 或 `--port COMx` 指定串口；`--fixture` 会禁用真实串口并改用固定示例响应
- Node 版同步解析由 `sendParsed()` 内部完成，不需要外部显式读循环
- 所有 `examples/directives/*` 示例都支持统一的 `-h` / `--help` 帮助输出

## 示例索引

| 指令 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `sn` | `examples/directives/sn.ts` | `npm run build && node dist/examples/directives/sn.js` | 查询设备序列号 |
| `aversion` | `examples/directives/aversion.ts` | `npm run build && node dist/examples/directives/aversion.js` | 查询版本信息 |
| `alive` | `examples/directives/alive.ts` | `npm run build && node dist/examples/directives/alive.js` | 查询在线状态 / 心跳 |
| `list_dir` | `examples/directives/list_dir.ts` | `npm run build && node dist/examples/directives/list_dir.js /eMMC/applog` | 列目录 |
| `clean_dir` | `examples/directives/clean_dir.ts` | `npm run build && node dist/examples/directives/clean_dir.js /eMMC/applog` | 清理目录 |
| `delete_file` | `examples/directives/delete_file.ts` | `npm run build && node dist/examples/directives/delete_file.js /eMMC/applog/demo.log` | 删除文件 |
| `join` | `examples/directives/join.ts` | `npm run build && node dist/examples/directives/join.js [ssid] [password]` | 连接指定 Wi‑Fi |
| `wifi_auto` | `examples/directives/wifi_auto.ts` | `npm run build && node dist/examples/directives/wifi_auto.js [0|1]` | 查询或设置 Wi‑Fi 自动连接 |
| `ahttpbase` | `examples/directives/ahttpbase.ts` | `npm run build && node dist/examples/directives/ahttpbase.js [url]` | 查询或设置文件服务基地址 |
| `ainsp` | `examples/directives/ainsp.ts` | `npm run build && node dist/examples/directives/ainsp.js /eMMC/applog/demo.log` | 读取日志基础信息 |
| `atime` | `examples/directives/atime.ts` | `npm run build && node dist/examples/directives/atime.js /eMMC/applog/spike.log` | 读取日志时长 |
| `adumj` | `examples/directives/adumj.ts` | `npm run build && node dist/examples/directives/adumj.js /eMMC/applog/demo.log` | 设备日志转动作 JSON |
| `aget` | `examples/directives/aget.ts` | `npm run build && node dist/examples/directives/aget.js <filepath>` | 从 file server 拉取文件到 MKP |
| `aput` | `examples/directives/aput.ts` | `npm run build && node dist/examples/directives/aput.js <filepath>` | 从 MKP 上传文件到 file server |
| `ajson2log` | `examples/directives/ajson2log.ts` | `npm run build && node dist/examples/directives/ajson2log.js <jsonpath> <outputlogpath>` | JSON 动作转回 MKP log |
| `alog` | `examples/directives/alog.ts` | `npm run build && node dist/examples/directives/alog.js [log_name]` | 启动同步录制 |
| `astop` | `examples/directives/astop.ts` | `npm run build && node dist/examples/directives/astop.js` | 停止当前录制 |

## Node API 快速对照

| 指令 | Node helper / 方法 | 返回 |
|---|---|---|
| `alog` | `alog()` / `Controller.alog()` / `SerialPort.alog()` | `string` |
| `aplay` | `SerialPort.startReplaying()` / `Controller.startReplaying()` | `Promise<void>` |
| `astop` | `stopRecord()` / `Controller.stopRecord()` / `Controller.astop()` | `string` |
| `acancel` | `cancel()` / `Controller.cancel()` / `SerialPort.cancelReplay()` | `unknown` |
| `sn` | `deviceSn()` / `Controller.deviceSn()` / `sfport.sn()` | `SN` |
| `list_dir` | `listDir()` / `Controller.listDir()` / `sfport.listDir()` | `FileSystem` |
| `clean_dir` | `cleanDir()` / `Controller.cleanDir()` / `sfport.cleanDir()` | `string` |
| `delete_file` | `deleteFile()` / `Controller.deleteFile()` / `sfport.deleteFile()` | `string` |
| `join` | `join()` / `Controller.join()` / `sfport.join()` | `string` |
| `wifi_auto` | `wifiAuto()` / `Controller.wifiAuto()` / `sfport.wifiAuto()` | `string` |
| `ahttpbase` | `ahttpbase()` / `Controller.ahttpbase()` / `sfport.ahttpbase()` | `AHTTPBase` |
| `adumj` | `adumj()` / `Controller.adumj()` / `sfport.adumj()` | `ActionDump` |
| `aget` | `auploadToMkp()` / `Controller.auploadToMkp()` / `sfport.aget()` | `string` |
| `aput` | `adownloadFromMkp()` / `Controller.adownloadFromMkp()` / `sfport.aput()` | `string` |
| `ajson2log` | `ajson2log()` / `Controller.ajson2log()` / `sfport.ajson2log()` | `string` |
| `alive` | `alive()` / `Controller.alive()` / `sfport.alive()` | `Heartbeat` |
| `atime` | `atime()` / `Controller.atime()` / `sfport.atime()` | `LogLength` |
| `aversion` | `aversion()` / `Controller.aversion()` / `sfport.aversion()` | `MKPVersion` |
| `ainsp` | `ainsp()` / `ainspect()` / `Controller.ainsp()` / `Controller.ainspect()` | `LogInfo` |
| `m10` | `m10()` / `sfport.mouse10()` / `Controller.mouseMove()` | 无结构化输出 |
| `kpad` | `typeText()` / `keyTap()` / `sfport.keypad()` / `Controller.keyTap()` | 无结构化输出 |

## 输出解析索引

Node 在 `src/parser.ts` 中注册 parser。

| Directive prefix | Parse mode | EOF / prompt |
|---|---|---|
| `alog` | 纯文本成功输出 | `cli>` |
| `astop` | 纯文本停止输出 | `cli>` |
| `acancel` | 原始 JSON 文本，允许空输出 | `<EOF>` |
| `clean_dir` / `delete_file` | 纯文本状态输出 | `cli>` |
| `join` / `wifi_auto` | 纯文本状态输出 | `cli>` |
| `aget` / `aput` / `ajson2log` | 纯文本输出 | `cli>` |
| `sn` / `alive` / `aversion` / `ainsp` / `list_dir` | JSON 提取 | `<EOF>` |
| `atime` | 行内 JSON 提取 | `<EOF>` |
| `adumj` | JSON 提取 | `cli>` |
| `ahttpbase` | 专用解析：优先 JSON，失败时回退 URL 行提取 | `cli>` |

## 返回结构索引

| Node interface | 用途 |
|---|---|
| `SN` | `sn` 输出 |
| `Heartbeat` | `alive` 输出 |
| `MKPVersion` | `aversion` 输出 |
| `LogLength` | `atime` 输出 |
| `LogInfo` | `ainsp` 输出 |
| `FileSystem` | `list_dir` 输出 |
| `ActionDump` | `adumj` 输出 |
| `AHTTPBase` | `ahttpbase` 输出 |
| `SerialPortStatus` | `snapshotStatus()` 输出 |
| `LogOption` / `JoinOption` / `WifiAutoOption` / `AGetOption` / `APutOption` / `AJSON2LogOption` / `AHTTPBaseOption` | directive option 类型 |
| `M10Option` / `KpadOption` / `MouseMoveOffset` | 鼠标 / 键盘与 controller option 类型 |

## Controller / HTTP API / CLI 对照

- `src/helper.ts`：`m10`、`typeText`、`keyTap`、`keyDown`、`keyUp`、`keyPresses` 等便捷 helper
- `src/controller.ts`：更高层录制、回放、文件系统、键盘、鼠标编排
- `src/cli.ts`：`mkp` 串口 CLI
- `src/client.ts`：`mkp-client` HTTP client CLI
- `src/server.ts`：HTTP server
- `src/server_config.ts`：`server.json` / `--config` 解析
- `src/bin/`：`mkp`、`mkp-client`、`mkp-server`、`converter`、`log2json`、`json2log`、`file-server`

## 已知差异

- Node directive 示例现已默认面向真实设备，但仍可通过 `--fixture` 切换回离线桩响应。
- Node 当前没有 Python 那样的自动串口调试摘要与 `.mkp-debug/` 机制。
- `join` / `wifi_auto` / `aget` / `aput` / `ajson2log` 在 Node 侧仍主要返回文本，而不是专门的结构化模型。
- `astop` 在 Node parser 中按 `cli>` 提示符结束，这一点与部分其它语言实现不同。
- `examples/context.ts` 展示的是 `AbortSignal` 封装思路，而不是 Go `context.Context` 的 API 直接映射。
- 共享 directive 语义变更时，请先更新 `../directives.md`，再记录 Node 特有差异。





