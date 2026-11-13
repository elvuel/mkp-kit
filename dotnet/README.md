# MKP .NET

[English](./README.en.md) | 中文 | [共享总览](../README.md) | [共享指令说明](../directives.md) | [.NET 指令补充](./directives.md)

---

本文档只维护 `mkp-kit/dotnet/` 的 **.NET 语言特有用法与差异**。

跨语言共享内容统一维护在仓库根目录：

- 共享总览：`../README.md`
- 共享指令说明：`../directives.md`

## 安装

在 `mkp-kit` monorepo 中，`.NET` 实现位于 `dotnet/` 子目录。

```powershell
cd D:\projects\mkp-kit\dotnet
dotnet build .\MkpKit.sln -c Debug
dotnet test .\MkpKit.sln -c Debug --no-build --no-restore
```

当前实现约定：

- 目标框架：`net10.0`，请使用 `.NET 10 SDK`
- 当前以 monorepo 源码形态维护，还不是独立发布的 NuGet 包
- 核心项目：`MkpKit`、`MkpKit.Cli`、`MkpKit.Client`、`MkpKit.Server`、`MkpKit.FileServer`、`MkpKit.Converter`

## 快速开始

```csharp
using MkpKit.Serial;

var portName = SFSerialPort.CheckSfSerialPort();
await using var sfport = new SFSerialPort(new SerialPortOptions
{
    Name = portName,
    SyncOutputTimeoutMs = 10_000
});

await sfport.OpenAsync();
try
{
    Console.WriteLine(await sfport.SnAsync());
}
finally
{
    await sfport.CloseAsync();
}
```

`.NET` 版使用约定：

- 查询类 directive 通常直接调用 `SFSerialPort` 的 `*Async()` 方法
- 输入类 directive 通常直接调用 `Mouse10Async()`、`KeypadAsync()`
- 更高层输入辅助位于 `MkpKit.Helpers.DeviceHelpers`
- 组合输入与平滑移动封装位于 `MkpKit.Controller.Controller`

## 示例

以下路径与命令均相对于 `mkp-kit/dotnet/`。

| 示例 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `m10` | `examples/M10/` | `dotnet run --project .\examples\M10 -- --port COM5` | 演示鼠标左平移 `400`，然后再向上移动 `400` |
| `kpad` | `examples/Kpad/` | `dotnet run --project .\examples\Kpad -- --port COM5` | 输出 `Hello MKP!` |
| `keys` | `examples/ContextKeys/` | `dotnet run --project .\examples\ContextKeys -- keys --port COM5` | 演示 `KeyTapAsync`、`KeyDownAsync`、`KeyUpAsync` |
| `context` | `examples/ContextKeys/` | `dotnet run --project .\examples\ContextKeys -- context` | 演示上下文取消与超时控制 |
| `common` | `examples/Common/` | 被其它示例复用 | 提供 `--port` 解析、输出辅助与端口初始化 |

常见 directive 示例：

| 指令示例 | 源码路径 | 运行命令 | 用途 |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- sn --port COM5` | 查询设备序列号、版本与在线状态 |
| `list_dir` / `clean_dir` / `delete_file` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- list_dir /eMMC/applog --port COM5` | 浏览目录、清理目录、删除文件 |
| `join` / `wifi_auto` / `ahttpbase` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- join <ssid> <password> --port COM5` | 配置 Wi‑Fi、自动联网与 HTTP 基地址 |
| `ainsp` / `atime` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- atime /eMMC/applog/demo.log --port COM5` | 查看日志信息与时长 |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- ajson2log demo.json /eMMC/applog/demo.log --port COM5` | 上传、下载与 JSON/日志互转 |
| `alog` / `astop` / `acancel` / `aplay` | `examples/Directives/Program.cs` | `dotnet run --project .\examples\Directives -- aplay demo -1 --port COM5` | 开始录制、停止录制、取消录制与触发回放 |

## .NET 特有表面

### HTTP Server

```powershell
cd D:\projects\mkp-kit\dotnet
dotnet run --project .\src\MkpKit.Server -- --config .\server.json
```

主要路由：

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/token`
- `GET /api/v1/version`
- `GET /api/v1/directives/list`
- `GET /api/v1/directives/records/{id}`
- `DELETE /api/v1/directives/records/{id}`
- `GET /api/v1/directives/replay/status`
- `POST /api/v1/directives/alog`
- `POST /api/v1/directives/astop`
- `POST /api/v1/directives/aplay/{id}`
- `POST /api/v1/directives/acancel`

当前 `.NET server` 还提供：

- 基于配置文件的 `bind` / `port` / `sfPort` / runtime 参数加载
- JWT 鉴权与 debug 模式下的可选静音
- CORS 与 `OPTIONS` 预检
- 基础 directive 的 HTTP 代理接口
- macro records 的 JSON 文件持久化，默认 `./.mkp-server-records.json`

### HTTP Client

```powershell
cd D:\projects\mkp-kit\dotnet
dotnet run --project .\src\MkpKit.Client -- auth login --server http://127.0.0.1:8080 --username admin --password admin
dotnet run --project .\src\MkpKit.Client -- auth token
dotnet run --project .\src\MkpKit.Client -- list
dotnet run --project .\src\MkpKit.Client -- recording --name demo
dotnet run --project .\src\MkpKit.Client -- stop
```

当前 `mkp-dotnet-client` 覆盖：

- `version`
- `auth login` / `auth token` / `auth revoke`
- `list`
- `recording`
- `replay`
- `remove`
- `stop`

配置文件查找顺序：

- 显式 `--config`
- 环境变量 `MKP_CONFIG_PATH`
- 当前目录 `client.json`
- 用户目录 `~/.mkp/client.json`

### CLI

```powershell
cd D:\projects\mkp-kit\dotnet
dotnet run --project .\src\MkpKit.Cli -- --help
dotnet run --project .\src\MkpKit.Cli -- sn --port COM5
dotnet run --project .\src\MkpKit.Cli -- m10 --x -400 --y -400 --port COM5
dotnet run --project .\src\MkpKit.Cli -- kpad "Hello MKP!" --port COM5
dotnet run --project .\src\MkpKit.Cli -- aplay demo --delay -1 --port COM5
```

当前 CLI 额外提供：

- `raw` / `raw-async` 直发 directive
- `status`、`--json`、`--timeout`、`--mouse-port`、`--keyboard-port`
- 统一的串口打开、打印与错误返回风格

### 转换工具与文件服务

```powershell
cd D:\projects\mkp-kit\dotnet
dotnet run --project .\src\MkpKit.FileServer -- --root .\artifact --port 8081
dotnet run --project .\src\MkpKit.Converter -- --help
dotnet run --project .\src\MkpKit.Converter -- -f .\demo.log
dotnet run --project .\src\MkpKit.Converter -- -f .\demo.json -o .\artifact
```

当前 file server 支持：

- `PUT /<path>` 原始上传
- `GET /<path>` 文件下载
- `POST /upload` multipart 上传
- `GET /list?path=` 目录列举
- 路径穿越保护与文件名清洗

## 仓库结构

| 路径 | 作用 |
|---|---|
| `src/MkpKit/` | 核心 SDK、串口 transport、parser、model、helper、controller |
| `src/MkpKit.Cli/` | 直连设备的 CLI |
| `src/MkpKit.Client/` | 面向 HTTP server 的 API client |
| `src/MkpKit.Server/` | HTTP server |
| `src/MkpKit.FileServer/` | file server |
| `src/MkpKit.Converter/` | `.log <-> .json` 转换工具 |
| `examples/` | `.NET` 语言级示例 |
| `tests/` | SDK / CLI / client / server / converter 测试 |

## .NET 特有注意事项

- `examples/Directives/` 采用单项目 + 子命令方式，不是像 Go / Python / Rust 那样每条 directive 一个目录
- `MKPVersion` 模型当前直接承载设备返回的 `app` / `boot` / `hw` 字段；`mkp-dotnet-client version` 输出层会兼容为 `uver` / `aver` 语义
- `mkp-dotnet-client` 目前是 HTTP API client，不是 direct serial directive client
- 共享 directive 语义变动，应优先更新根文档 `../directives.md`

