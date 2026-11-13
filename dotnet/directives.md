# MKP .NET 指令补充说明

[English](./directives.en.md) | 中文 | [共享总览](../README.md) | [共享指令说明](../directives.md) | [.NET README](./README.md)

---

本文档只补充 `mkp-kit/dotnet/` 中 **.NET 特有的 directive 使用方式、API 命名、解析入口与暴露方式**。

## 目录

- 文档定位
- .NET 使用约定
- 示例索引
- .NET API 快速对照
- 输出解析索引
- 返回结构索引
- Controller / HTTP API / CLI 对照
- 已知差异
- 注意事项

## 文档定位

共享 directive 语义、输入输出约定、跨语言统一说明，请优先查看：

- 共享总览：`../README.md`
- 共享指令说明：`../directives.md`

本文只补充：

- `.NET` SDK 上的类型名与方法名
- `.NET` parser registry 与输出提取方式
- `.NET` 的 examples、CLI、HTTP client、HTTP server 暴露方式

## .NET 使用约定

- 以下路径与命令均相对于 `mkp-kit/dotnet/`
- `SFSerialPort` 是 direct serial directive 的核心入口，定义位于 `src/MkpKit/Serial/Transport.cs`
- 默认 parser registry 通过 `DirectiveParserRegistry.CreateDefault()` 创建
- 查询类 directive 通常返回强类型 record / model
- 输入动作与组合键辅助位于 `MkpKit.Helpers.DeviceHelpers`
- 更高层组合封装位于 `MkpKit.Controller.Controller`
- `examples/Directives/` 采用单项目 + 子命令方式承载多条 directive 示例

## 示例索引

| 指令 / 示例 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `sn` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- sn --port COM5` | 查询设备序列号 |
| `aversion` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- aversion --port COM5` | 查询版本信息 |
| `alive` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- alive --port COM5` | 查询在线状态 / 心跳 |
| `list_dir` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- list_dir /eMMC/applog --port COM5` | 列目录 |
| `clean_dir` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- clean_dir /eMMC/applog/tmp --port COM5` | 清理目录 |
| `delete_file` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- delete_file /eMMC/applog/demo.log --port COM5` | 删除文件 |
| `join` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- join <ssid> <password> --port COM5` | 连接指定 Wi‑Fi |
| `wifi_auto` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- wifi_auto 1 --port COM5` | 查询或设置 Wi‑Fi 自动连接 |
| `ahttpbase` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- ahttpbase http://127.0.0.1:8080 --port COM5` | 查询或设置文件服务基地址 |
| `ainsp` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- ainsp /eMMC/applog/demo.log --port COM5` | 读取日志基础信息 |
| `atime` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- atime /eMMC/applog/demo.log --port COM5` | 读取日志时长 |
| `adumj` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- adumj /eMMC/applog/demo.log --port COM5` | 设备日志转动作 JSON |
| `aget` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- aget /upload/demo.bin --port COM5` | 从 file server 拉取文件到 MKP |
| `aput` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- aput /eMMC/applog/demo.log --port COM5` | 从 MKP 上传文件到 file server |
| `ajson2log` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- ajson2log demo.json /eMMC/applog/demo.log --port COM5` | JSON 动作转回 MKP log |
| `alog` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- alog demo --port COM5` | 启动同步录制 |
| `astop` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- astop --port COM5` | 停止当前录制 |
| `acancel` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- acancel --port COM5` | 取消当前录制或回放 |
| `aplay` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- aplay demo -1 --port COM5` | 触发异步回放 |
| `m10` | `examples/M10/` | `dotnet run --project .\examples\M10 -- --port COM5` | 鼠标左平移 `400`，再向上移动 `400` |
| `kpad` | `examples/Kpad/` | `dotnet run --project .\examples\Kpad -- --port COM5` | 输出 `Hello MKP!` |
| `keys` / `context` | `examples/ContextKeys/` | `dotnet run --project .\examples\ContextKeys -- keys --port COM5` | 组合键、释放与 context 行为演示 |

## .NET API 快速对照

| 共享 directive | .NET API / helper | 返回 |
|---|---|---|
| `sn` | `sfport.SnAsync()` | `SN` |
| `alive` | `sfport.AliveAsync()` | `Heartbeat` |
| `aversion` | `sfport.AVersionAsync()` | `MKPVersion` |
| `atime` | `sfport.ATimeAsync(path)` | `LogLength` |
| `ainsp` | `sfport.AInspAsync(path)` | `LogInfo` |
| `list_dir` | `sfport.ListDirAsync(path)` | `FileSystem` |
| `clean_dir` | `sfport.CleanDirAsync(path)` | `string` |
| `delete_file` | `sfport.DeleteFileAsync(path)` | `string` |
| `join` | `sfport.JoinAsync(option)` | `string` |
| `wifi_auto` | `sfport.WifiAutoAsync(option)` | `string` |
| `ahttpbase` | `sfport.AHttpBaseAsync(option)` | `AHTTPBase` |
| `adumj` | `sfport.ADumjAsync(path)` | `ActionDump` |
| `aget` | `sfport.AGetAsync(option)` | `string` |
| `aput` | `sfport.APutAsync(option)` | `string` |
| `ajson2log` | `sfport.AJson2LogAsync(option)` | `string` |
| `alog` | `sfport.ALogAsync(args)` | `string` |
| `astop` | `sfport.AStopAsync()` | `string` |
| `acancel` | `sfport.ACancelAsync()` | `string` / JSON 文本 |
| `aplay` | `sfport.APlayAsync(option)` | 无同步结构化输出 |
| `m10` | `sfport.Mouse10Async(option)` / `controller.MouseMoveSmoothAsync(...)` | 无结构化输出 |
| `kpad` | `sfport.KeypadAsync(option)` / `DeviceHelpers.TypeTextAsync(...)` / `controller.TypeTextAsync(...)` | 无结构化输出 |

## 输出解析索引

`.NET` 版的 directive parser 注册表位于 `src/MkpKit/Parser/DirectiveParsing.cs`。

| 输出类别 | 主要解析入口 | 代表 directive |
|---|---|---|
| `Json` | `OutputParsing.ParseJson()` | `sn`、`alive`、`aversion`、`list_dir` |
| `LineJson` | `OutputParsing.ParseLineJson()` | `atime`、`ainsp` |
| `Text` | `OutputParsing.ParseTextSuccess()` / `ParsePlainSuccess()` / `ParseJoin()` / `ParseWifiAuto()` | `astop`、`clean_dir`、`delete_file`、`join`、`wifi_auto`、`alog`、`aget`、`aput`、`ajson2log` |
| `RawJsonText` | `OutputParsing.ParseRawJsonText()` | `acancel` |
| 自定义 JSON 提取 | `OutputParsing.ParseAHttpBase()` / `ParseOptionalJson()` | `ahttpbase`、`adumj` |

补充说明：

- `aplay` 走异步发送，不依赖同步 parser 返回结构化结果
- 默认 EOF 标志组合为 `<EOF>` 与 `cli>`，由 parser registration 决定

## 返回结构索引

| .NET 类型 | 用途 |
|---|---|
| `SN` | `sn` 输出 |
| `Heartbeat` | `alive` 输出 |
| `MKPVersion` | `aversion` 输出 |
| `LogLength` | `atime` 输出 |
| `LogInfo` | `ainsp` 输出 |
| `FileSystem` | `list_dir` 输出 |
| `ActionDump` | `adumj` 输出 |
| `AHTTPBase` | `ahttpbase` 输出 |
| `SerialPortStatus` | 当前串口状态快照 |
| `JoinOption` / `AGetOption` / `APlayOption` / `M10Option` / `KpadOption` | directive option 组装 |

## Controller / HTTP API / CLI 对照

- `Controller`：`src/MkpKit/Controller/Controller.cs`
- helper：`src/MkpKit/Helpers/DeviceHelpers.cs`
- CLI：`src/MkpKit.Cli/`
- client：`src/MkpKit.Client/`
- HTTP server：`src/MkpKit.Server/`
- file server：`src/MkpKit.FileServer/`
- converter：`src/MkpKit.Converter/`
- examples：`examples/`

## 已知差异

- `examples/Directives/` 使用单项目 + 子命令方式，而不是一条 directive 一个目录
- `mkp-dotnet-client` 当前面向 HTTP server API，不直接代理 raw serial directive
- `MKPVersion` 模型保存的是设备原始 `app` / `boot` / `hw` 字段；client 的 `version` 展示层会兼容 Go 风格的 `uver` / `aver`
- replay records 当前持久化为 JSON 文件，而不是 SQLite / 其它数据库

## 注意事项

- 共享 directive 语义变动，应优先更新 `../directives.md`
- 新增或修改 directive 时，应同步检查 `DirectiveParserRegistry.CreateDefault()`、examples、CLI、HTTP server 与本文件
- `.NET` 子文档只补充 .NET API 命名、parser 行为、CLI / HTTP 暴露与实现差异

