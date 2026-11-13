# MKP Kit 是否可以继续 port 到 .NET（cross-platform，research）

更新日期：2026-11-12

## TL;DR

可以，而且**现在就可以开始**。

如果目标是为 `mkp-kit` 新增一个 **跨平台 .NET 语言实现**（SDK + examples + 可选 CLI / HTTP server / converter / file server），从当前 monorepo 状态看，并没有明显的协议级阻塞点。

更具体地说：

- `mkp-kit` 需要的关键基础能力是：**串口、文本/JSON 解析、HTTP client、HTTP server、配置、测试、打包发布**。
- 这些能力在官方 .NET 生态中都已有成熟的一手支持。
- 唯一需要提前重视的不是“能不能做”，而是 **`System.IO.Ports` 在真实串口环境下的稳定性验证策略**：建议把读取路径设计成**显式同步/异步读循环**，不要一开始把可靠性押在事件驱动回调上。

结论：**可以 port 到 .NET，而且建议直接以 cross-platform 为目标来做，而不是先做 Windows-only 版本。**

建议起步版本：**`.NET 10 LTS`**。

---

## 1. 先看 `mkp-kit` 当前到底要求新语言端口具备什么

从 monorepo 根文档与现有五种实现看，新的语言端口不只是“能发几条串口指令”即可，而是至少要覆盖以下共享表面：

- 串口连接与 directive 发送 / 同步解析
- `m10` / `kpad` 底层输入指令与 helper / controller 组合能力
- `sn` / `alive` / `aversion` / `atime` / `ainsp` 这类结构化返回
- `list_dir` / `clean_dir` / `delete_file` / `aget` / `aput` / `ajson2log` 这类文件与转换能力
- `join` / `wifi_auto` / `ahttpbase` 这类网络配置能力
- 以及部分语言已经具备的 CLI / HTTP server / file server / converter 表面

本地证据：

- `README.md`
- `directives.md`
- `AGENTS.md`

这意味着 .NET 端口需要解决的是一整套 **SDK + 工具层** 对齐问题，但它本质上仍然主要依赖：

1. 串口 I/O
2. 文本 / JSON 解析
3. HTTP client / server
4. 配置与依赖注入
5. 可测试、可打包、可跨平台发布

这几件事，官方 .NET 栈都能承接。

---

## 2. 为什么说 .NET 现在已经具备可行性

### 2.1 串口：官方就有 `System.IO.Ports`

官方 NuGet 上存在第一方 `System.IO.Ports` 包，当前页面显示它目标包含：

- `.NET 10.0`
- `.NET Standard 2.0`
- `.NET Framework 4.6.2`

这说明 .NET 侧并不需要依赖第三方串口库才能起步，至少在 API 面上，官方已经提供了可直接用于 MKP 串口收发的基础库。

来源：

- NuGet `System.IO.Ports`：<https://www.nuget.org/packages/System.IO.Ports>

### 2.2 HTTP server：ASP.NET Core Kestrel 天然是跨平台的

Microsoft Learn 明确写到：

- Kestrel 是 ASP.NET Core 的跨平台 web server；
- 运行于 Windows / Linux / macOS；
- 默认就是 ASP.NET Core 模板中的推荐服务器；
- 并且 “Kestrel is supported on all platforms and versions that .NET supports”。

这基本可以直接对齐 `mkp-server` 这类需求。

来源：

- Kestrel：<https://learn.microsoft.com/en-us/aspnet/core/fundamentals/servers/kestrel?view=aspnetcore-9.0>

### 2.3 HTTP client：官方推荐 `IHttpClientFactory`

如果要实现和现有 Node / Python / Rust 一样的：

- `aget` / `aput` 对 file server 的访问
- HTTP API client
- 可配置 base URL / headers / middleware / logging

那么官方的 `IHttpClientFactory` 已经足够。Microsoft Learn 直接列出它的好处：

- 暴露 DI-ready 的 `HttpClient`
- 集中配置逻辑客户端
- 支持 outgoing middleware / delegating handlers
- 管理底层 handler 生命周期
- 提供统一 logging

来源：

- `IHttpClientFactory`：<https://learn.microsoft.com/en-us/dotnet/core/extensions/httpclient-factory>

### 2.4 JSON：官方 `System.Text.Json` 足够做 parser 与 typed models

`mkp-kit` 现在很多关键价值都在于：

- 从设备噪声输出中提取 JSON 主体
- 再把结果映射为强类型模型

官方 `System.Text.Json` 文档说明：

- `System.Text.Json` 提供 JSON 序列化 / 反序列化能力；
- 强调高性能与低内存分配；
- 提供内存内 DOM；
- 提供 `System.Net.Http.Json` 扩展；
- 在 .NET Core 3.0+ 内置于 shared framework。

这足以覆盖 `SN`、`Heartbeat`、`MKPVersion`、`LogLength`、`LogInfo`、`FileSystem`、`ActionDump` 等 typed wrappers 的建模需求。

来源：

- `System.Text.Json` overview：<https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/overview>

### 2.5 配置 / DI / 生命周期：官方 `Generic Host` + `Configuration`

如果要把 `.NET` 版做成和现有语言类似的长期可维护结构，最自然的官方基线是：

- `Microsoft.Extensions.Hosting` / Generic Host
- `Microsoft.Extensions.Configuration`
- `appsettings.json` + 环境变量 + 命令行覆盖

官方文档说明：

- `.NET Generic Host` 负责应用启动与生命周期管理，而且可以用于 Console apps；
- 默认配置优先级包含 command-line、environment variables、`appsettings.{Environment}.json`、`appsettings.json`；
- 配置可以绑定到强类型对象（options pattern）。

这对对齐当前 monorepo 里的：

- config file
- env vars
- CLI flags
- server settings
- HTTP base URL
- JWT/CORS 等 server 配置

非常合适。

来源：

- Generic Host：<https://learn.microsoft.com/en-us/dotnet/core/extensions/generic-host>
- Configuration：<https://learn.microsoft.com/en-us/dotnet/core/extensions/configuration>

### 2.6 CORS / JWT：官方 ASP.NET Core 直接可做

如果 .NET 端口以后也要对齐现有 server 面（尤其是 Node / Go 里已有的 JWT / CORS / config-file 方向），官方文档已经给出直接做法：

- `AddCors(...)` / `UseCors(...)` 配置跨域策略；
- ASP.NET Core 有完整的 JWT bearer authentication 文档。

来源：

- CORS：<https://learn.microsoft.com/en-us/aspnet/core/security/cors?view=aspnetcore-9.0>
- JWT bearer：<https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-9.0>

### 2.7 发布：可以做单文件，但仍然是按目标平台分别发布

如果希望像现有各语言工具一样便于分发，官方 `dotnet publish` 支持 single-file/self-contained。官方文档同时明确说明：

- single-file 发布可以和 self-contained 组合；
- 但 single-file 产物是 **OS / architecture specific**；
- 因此仍然需要为 `win-x64`、`linux-x64`、`linux-arm64`、`osx-arm64` 等目标分别发布。

这很适合做 `mkp-cli` / `mkp-server` / `mkp-file-server` 的预编译分发。

来源：

- Single-file deployment：<https://learn.microsoft.com/en-us/dotnet/core/deploying/single-file/overview>

---

## 3. 版本建议：为什么推荐直接上 `.NET 10 LTS`

截至 **2026-11-12**，Microsoft Learn 的支持页显示：

- `.NET 10` 是 LTS，支持到 **2028 年 11 月**；
- `.NET 9` 是 STS，支持到 **2026 年 11 月**；
- `.NET 8` 是 LTS，但支持只到 **2026 年 11 月**。

因此，以当前日期看：

- 不建议新开一个长期维护语言端口再从 `net8.0` 起步；
- 也不建议把长期 SDK 主线压在 STS 的 `net9.0` 上；
- 最合适的是 **`net10.0`**。

来源：

- .NET releases and support：<https://learn.microsoft.com/en-us/dotnet/core/releases-and-support>

---

## 4. 对 `mkp-kit` 而言，.NET 端口建议怎么拆

建议把 `.NET` 端口作为 monorepo 下新的 `dotnet/` 子目录来做，而不是把所有内容塞到一个项目里。

推荐最小结构：

```text
dotnet/
  MkpKit.sln
  src/
    MkpKit/                 # 核心 SDK：models / parser / serial / helper / controller
    MkpKit.Cli/             # mkp-cli 风格入口
    MkpKit.Server/          # HTTP API server
    MkpKit.FileServer/      # file server（如需要）
    MkpKit.Converter/       # json2log / log2json / adumj 等本地工具
  tests/
    MkpKit.Tests/
    MkpKit.Server.Tests/
  examples/
    Directives/
    M10/
    Kpad/
```

### 4.1 第一阶段

先做这些：

- `SerialPort` 封装
- directive parser 注册与 EOF / prompt 规则
- typed models
- `sendDirective` / `sendParsed`
- `m10` / `kpad`
- `sn` / `alive` / `aversion` / `atime` / `ainsp`
- `list_dir` / `clean_dir` / `delete_file`
- `join` / `wifi_auto` / `ahttpbase`
- `examples/directives/*`

这部分已经足够形成“能跑、能对齐、能验证 parser 行为”的第一版 SDK。

### 4.2 第二阶段

再补这些：

- `aget` / `aput`
- `ajson2log` / `adumj`
- converter / file server
- `Controller`
- `mkp-cli`
- `mkp-server`

### 4.3 第三阶段

最后再补高阶对齐：

- JWT / CORS / config-file
- 持久化与 replay 管理
- HTTP client
- examples / README / directives 双语补齐

---

## 5. 真实风险点：不是“能不能做”，而是“串口怎么做得稳”

### 5.1 官方串口 API 可用，但仍应尽早做硬件验证

虽然第一方 `System.IO.Ports` 已经存在，但这并不自动等于“你在 MKP 设备上的收包行为一定稳”。

在 `dotnet/runtime` 官方仓库里，目前仍能看到针对 `System.IO.Ports.SerialPort` 接收稳定性的 open issue，例如 2024 年的一个问题报告直接声称 `DataReceived` 在严肃 RS232 场景下存在丢字节 / 不可靠问题。是否会影响 MKP，需要你自己在真实设备上验证；但它至少说明 **串口读取层应被视为早期重点验证对象**。

对 `mkp-kit` 来说，我的建议是：

- 设计上优先参考现有 Go / Python / Rust / Node / C++ 的**显式读循环**思路；
- 不要把 parser 正确性绑定到 UI 风格的事件回调；
- 先把 `sn`、`list_dir`、`atime`、`ahttpbase` 这类最容易暴露“回包裁剪 / EOF / 超时”问题的 directive 跑通。

来源：

- `System.IO.Ports` NuGet：<https://www.nuget.org/packages/System.IO.Ports>
- `dotnet/runtime` issue #106631：<https://github.com/dotnet/runtime/issues/106631>

### 5.2 single-file 不等于“一份包到处跑”

如果未来要发布预编译 CLI / server，single-file 很方便，但它仍然要按 RID 分开产物；也就是说，`.NET` 可以 cross-platform，但**你的发布工件仍应按平台矩阵构建**。

来源：

- Single-file deployment：<https://learn.microsoft.com/en-us/dotnet/core/deploying/single-file/overview>

### 5.3 如果将来做 GUI，要另算

本研究结论针对的是：

- SDK
- CLI
- HTTP server / file server
- examples / tests

也就是当前 `mkp-kit` 现有语言实现的主要对齐面。

如果你后面希望的是一个跨平台 GUI（而不只是 SDK/CLI/server），那会引入另一层技术选型问题；但这不影响当前先做 `.NET` SDK 端口的可行性判断。

---

## 6. 最终判断

### 结论

**可以 port 到 .NET，而且建议直接按 cross-platform 的目标来做。**

### 推荐技术基线

- 语言：`C#`
- 目标框架：`net10.0`
- 串口：第一方 `System.IO.Ports`
- JSON：`System.Text.Json`
- HTTP client：`HttpClient` + `IHttpClientFactory`
- HTTP server：ASP.NET Core Minimal API / Kestrel
- 配置与生命周期：`Generic Host` + `Configuration`
- 测试：`dotnet test` + xUnit

### 推荐启动顺序

1. 先做 `dotnet/src/MkpKit` 核心 SDK。
2. 用真实设备先打通 `sn`、`list_dir`、`atime`、`ahttpbase`。
3. 确认串口读循环、超时、EOF / prompt 裁剪模型稳定后，再补 helper / controller。
4. 再扩展 `MkpKit.Cli`、`MkpKit.Server`、`MkpKit.FileServer`。

### 一句话建议

如果你现在准备开第六种语言实现，**`.NET` 是可行的，而且比“先上更小众的生态”更稳妥**；但第一周的重点不该放在 server 或 docs，而应放在：

- 串口读写稳定性
- parser 对齐
- 4~6 条代表性 directive 的真实硬件验证

这三件事一旦跑通，后面的 CLI / server / config / docs 基本都会顺下来。
