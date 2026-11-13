# MKP Kit .NET Port Implement Spec

更新日期：2026-11-12

## 1. 背景

`mkp-kit` 当前已经是一个多语言 monorepo，根目录统一维护：

- 共享能力定义
- 共享 directive 语义
- 跨语言文档契约
- feature parity / bug-fix parity 的维护规则

现有正式语言实现已经包含：

- `go/`
- `python/`
- `rust/`
- `node/`
- `cpp/`

因此，`.NET` 版本不应被视为一个独立新项目，而应被视为 `mkp-kit` 的下一个正式语言实现目录：`dotnet/`。

本 spec 的目标，是把 `.NET` 端口的：

- 范围
- 目录结构
- 技术基线
- 实施顺序
- 验收标准
- 风险边界

明确下来，便于后续按阶段自动推进，而不是在实现过程中反复漂移 scope。

## 2. 目标

本次 `.NET` port 的首要目标是：

1. 在 monorepo 中新增 `dotnet/` 子目录。
2. 提供可运行的跨平台 .NET SDK 核心能力。
3. 对齐当前共享 directive 语义与默认行为。
4. 优先交付可稳定驱动设备、可验证协议行为的 MVP。
5. 为后续 CLI / HTTP server / converter / file server / docs parity 留出清晰扩展路径。

## 3. 非目标

首个实现阶段不以以下目标为前置门槛：

- 不要求第一阶段就完成完整 `mkp-server`。
- 不要求第一阶段就完成完整 `mkp-client` 体验。
- 不要求第一阶段就补齐所有 converter / file server / replay persistence。
- 不要求第一阶段就复刻 Go 当前所有高阶 controller 细节。
- 不要求第一阶段就覆盖 NuGet 发布、CI/CD、安装器、跨平台发布矩阵。

这些能力应被视为 phase 2 及以后逐步补齐的内容。

## 4. 语言与运行时决策

### 4.1 实现语言

建议使用：

- **C#** 作为主实现语言

原因：

- 能较自然地表达 typed models、options、parser registry、controller 与 server 分层；
- 便于和 `System.Text.Json`、ASP.NET Core、Generic Host、Configuration、DI 自然集成；
- 能兼顾 SDK、CLI、HTTP server、工具链与测试工程的统一维护体验。

### 4.2 目标框架基线

建议使用：

- **`.NET 10` / `net10.0`**

原因：

- 适合作为当前时间点的新长期维护端口基线；
- 便于直接使用较新的 SDK、Minimal API、Configuration、发布能力；
- 减少跨 `net8` / `net9` / `net10` 的兼容分支负担。

### 4.3 跨平台目标

首个正式目标平台应明确为：

- Windows
- Linux
- macOS

说明：

- 设备串口交互层需要从第一天就按跨平台思路设计；
- 但实际硬件验证优先顺序仍可先以 Windows 为主，再扩展到 Linux / macOS；
- 发布工件允许按 RID 分平台生成，不要求“一份二进制全平台通用”。

## 5. 目录结构

建议在仓库根目录新增：

```text
dotnet/
  MkpKit.sln
  Directory.Build.props
  NuGet.config
  README.md
  README.en.md
  directives.md
  directives.en.md
  src/
    MkpKit/
      MkpKit.csproj
      Models/
      Parser/
      Serial/
      Helpers/
      Controller/
      Diagnostics/
      Index.cs
    MkpKit.Cli/
      MkpKit.Cli.csproj
      Program.cs
    MkpKit.Server/
      MkpKit.Server.csproj
      Program.cs
      appsettings.json
      appsettings.Development.json
    MkpKit.FileServer/
      MkpKit.FileServer.csproj
      Program.cs
    MkpKit.Converter/
      MkpKit.Converter.csproj
      Program.cs
  examples/
    Common/
    Directives/
      Sn/
      AVersion/
      Alive/
      ListDir/
      CleanDir/
      DeleteFile/
      Join/
      WifiAuto/
      AHttpBase/
      AInsp/
      ATime/
      ADumj/
      AGet/
      APut/
      AJson2Log/
      ALog/
      AStop/
      ACancel/
    M10/
    Kpad/
    ContextKeys/
  tests/
    MkpKit.Tests/
      MkpKit.Tests.csproj
    MkpKit.Server.Tests/
      MkpKit.Server.Tests.csproj
    MkpKit.Converter.Tests/
      MkpKit.Converter.Tests.csproj
```

说明：

- `src/MkpKit/` 是核心 SDK；
- `src/MkpKit.Cli/`、`src/MkpKit.Server/`、`src/MkpKit.FileServer/`、`src/MkpKit.Converter/` 是 phase 2 以后逐步补齐的工具 / 服务层；
- `examples/` 对齐 monorepo 已有语言的 example 组织；
- `tests/` 至少分别覆盖 SDK、server、converter 等层面。

## 6. 命名与包边界

### 6.1 Namespace 建议

建议统一使用：

- `MkpKit`
- `MkpKit.Models`
- `MkpKit.Parser`
- `MkpKit.Serial`
- `MkpKit.Helpers`
- `MkpKit.Controller`
- `MkpKit.Diagnostics`

### 6.2 包边界建议

phase 1 先只维护一个核心库工程：

- `MkpKit`

phase 2 再逐步增加：

- `MkpKit.Cli`
- `MkpKit.Server`
- `MkpKit.FileServer`
- `MkpKit.Converter`

要求：

- 不允许为了图快把 server / converter / file-server 全部塞进 SDK 核心工程；
- SDK 核心工程必须保持可复用、可测试、可被 CLI / HTTP server 共享调用；
- 工程之间的依赖方向必须始终保持：`tool/server -> SDK`，而不是反过来。

## 7. 模块设计

### 7.1 `Models`

职责：

- 定义 directive 返回模型；
- 定义 `M10Option`、`KpadOption`、`JoinOption`、`WifiAutoOption`、`AGetOption`、`APutOption`、`AHttpBaseOption`、`AJson2LogOption`、`LogOption` 等参数模型；
- 封装默认值、参数拼接、必要的 JSON 映射与便利方法；
- 承担键盘缓存状态、修饰键组合等共享建模。

要求：

- 字段语义必须优先对齐共享协议；
- 命名允许更贴近 C# 习惯，但必须清楚映射到设备侧原始字段与 directive 参数；
- typed models 不能只当作“解析临时结构”，而应成为 SDK 公共契约的一部分。

### 7.2 `Parser`

职责：

- 维护 directive parser registry；
- 维护 `EOF_DEFAULT`、`EOF_CLI`、以及必要的 per-directive EOF 规则；
- 处理 raw text、line JSON、完整 JSON、混合文本里的 JSON blob；
- 提供 parse failed 时的足够调试上下文。

必须对齐的重点 directive：

- `atime`
- `list_dir`
- `ahttpbase`
- `adumj`
- `ajson2log`
- `acancel`

要求：

- parser 必须按 directive 显式注册；
- 不允许只写一个“猜输出类型”的大一统解析器；
- 必须能区分输出类型，例如：`json`、`text`、`line-json`、`raw-json-text`、`empty-ok`；
- 必须能处理一次成功、后续失败这类 stale buffer / prompt 粘连问题。

### 7.3 `Serial`

职责：

- 管理串口连接、关闭、同步发送、异步发送；
- 统一 directive 响应读取；
- 对接 parser 并返回 typed result；
- 暴露 raw send / parsed send / send with timeout 等基础能力。

建议抽象：

- `ISerialTransport`
- `SystemIoPortsTransport`
- `SFSerialPort`
- `SerialPortOptions`
- `DirectiveResponseBuffer`

要求：

- phase 1 优先做稳**显式读循环**，而不是依赖脆弱的事件回调；
- 同步 directive 发送前要清理可判定的旧缓冲；
- 读取响应时要先对齐当前 directive echo，再依据 parser EOF 规则切分；
- timeout、parse failed、unexpected output 都要能留下足够调试信息；
- 必须支持仅获取 raw response，用于回归测试与 parser 调试。

### 7.4 `Helpers`

职责：

- 提供常用组合封装：
  - `KeyTap`
  - `KeyDown`
  - `KeyUp`
  - `KeyPresses`
  - `TypeText`
  - `MouseReleaseAll`
  - `KeypadReleaseAll`
- 在 `m10` / `kpad` 之上提供最小但高频的易用性增强。

要求：

- helper 必须建立在原始 directive 语义之上；
- 不允许引入和设备协议脱节的“黑箱高层路径”；
- 文本输入必须正确处理大小写、符号、修饰键与 release 逻辑，避免再次出现“只输出首字符”或“大小写丢失”问题。

### 7.5 `Controller`

职责：

- 提供比 helper 更高层的组合控制，如：
  - 平滑鼠标移动
  - 基础点击 / 双击 / 拖动
  - 基础键鼠组合动作
  - 录制 / 回放辅助组合

要求：

- phase 1 可只做薄层 controller；
- phase 2 再决定是否补齐更复杂的人类化轨迹、拖拽控制、脚本动作流；
- controller 不应重复 parser / transport 逻辑；
- controller 的设备可见行为应与其它语言保持一致。

### 7.6 `Diagnostics`

职责：

- 统一 timeout / parse failed / unexpected output 的错误对象；
- 管理 debug capture 文件或内存快照；
- 为 examples / tests / CLI 输出提供稳定诊断信息。

要求：

- 错误对象中至少保留 directive、timeout、raw output、pending buffer、parser output 或相关摘要；
- 诊断结构不要散落在每个调用点临时拼接。

### 7.7 `Cli` / `Server` / `FileServer` / `Converter`

职责：

- `Cli`：本地命令行入口；
- `Server`：HTTP API server；
- `FileServer`：文件上传 / 下载服务；
- `Converter`：`json2log` / `log2json` / `adumj` 等工具。

要求：

- 这些都属于 phase 2 以后逐步补齐的内容；
- 开工前先复查 Go / Python / Rust / Node / C++ 的共同契约；
- 不允许为了赶 parity 把 HTTP / CLI / tool 逻辑倒灌进核心 SDK。

## 8. Phase 1 必须覆盖的 directive / API

建议最小可交付集合：

- `sn`
- `alive`
- `aversion`
- `atime`
- `ainsp`
- `list_dir`
- `clean_dir`
- `delete_file`
- `join`
- `wifi_auto`
- `ahttpbase`
- `m10`
- `kpad`

说明：

- 这批能力足以验证：串口收发、parser、typed model、键鼠控制、文件系统查询、网络配置；
- 它们也是当前多语言端口里 parser 行为最容易出现差异的地方；
- 只有这批先稳定，后续 `aget` / `aput` / `ajson2log` / `adumj` 的扩展才值得继续推进。

## 9. Phase 2 补齐项

建议下一阶段继续补：

- `aget`
- `aput`
- `adumj`
- `ajson2log`
- `alog`
- `astop`
- `acancel`
- `Controller` 的更高层行为
- `MkpKit.Cli`
- `MkpKit.Server`
- `MkpKit.FileServer`
- `MkpKit.Converter`

说明：

- phase 2 的核心目标是从“可用 SDK”走向“语言端口基本完整”；
- 但前提是 phase 1 的串口收发与 parser 模型已经稳定。

## 10. 串口实现策略

### 10.1 实现原则

`.NET` 版串口层必须优先保证：

- 当前请求与历史残留输出可区分；
- prompt / echo / JSON / 文本混合输出可稳定切片；
- timeout 行为可诊断；
- tests 中可以替换 transport。

### 10.2 不允许的简化

不允许：

- 只靠一次读取就判断“整条 directive 已结束”；
- 所有 directive 都使用同一种 EOF 规则；
- parser 和 transport 紧耦合到无法单测；
- 完全依赖 `DataReceived` 回调而没有清晰的同步读取模型；
- 忽略 stale prompt / old buffer / previous response 对下次解析的影响。

### 10.3 推荐测试替身

phase 1 就应支持 transport stub / fake，例如：

- 预置 raw output fixture
- 预置 line-by-line output fixture
- 预置 timeout / partial output fixture

这样可以在没有真实设备时对 parser regression 做稳定回归。

## 11. Example 设计要求

`.NET` 版 examples 必须对齐 monorepo 既有约定。

至少要提供：

- `examples/Directives/Sn`
- `examples/Directives/AVersion`
- `examples/Directives/Alive`
- `examples/Directives/ListDir`
- `examples/Directives/CleanDir`
- `examples/Directives/DeleteFile`
- `examples/Directives/Join`
- `examples/Directives/WifiAuto`
- `examples/Directives/AHttpBase`
- `examples/Directives/AInsp`
- `examples/Directives/ATime`
- `examples/M10`
- `examples/Kpad`
- `examples/ContextKeys`

要求：

- 所有 directive examples 应支持统一的 `--port` 参数；
- 缺参时输出一致的 usage/help；
- examples 默认优先连接真实设备，而不是先做 dry-run；
- 但 SDK tests 应保留 fake transport 路径。

## 12. 文档要求

在 `.NET` 端口实现落地时，最终需要补齐：

- `dotnet/README.md`
- `dotnet/README.en.md`
- `dotnet/directives.md`
- `dotnet/directives.en.md`

要求：

- 根目录文档继续维护共享语义；
- `dotnet/` 子目录文档只维护 .NET 语言差异；
- 运行命令、路径说明、namespace、project layout、build/test 命令必须和实现一致；
- 若 `.NET` 版刻意与其它语言存在行为差异，必须显式记录。

## 13. 测试与验收

### 13.1 Phase 1 最小测试集

至少应覆盖：

- parser registry tests
- JSON blob / line JSON / raw text 抽取 tests
- timeout tests
- stale buffer regression tests
- `TypeText` / keycode mapping tests
- `M10Option` / `KpadOption` 参数拼接 tests
- `sn` / `list_dir` / `atime` / `ahttpbase` fixture tests

### 13.2 真机验收优先级

建议真机优先验收：

1. `sn`
2. `list_dir /eMMC/applog`
3. `atime /eMMC/applog/spike.log`
4. `ahttpbase`
5. `m10`
6. `kpad`

原因：

- 这几条最容易暴露串口读取、EOF、JSON 提取、大小写输入、方向语义等问题；
- 也是其它语言端口曾经出现 parser / helper 偏差最多的区域。

### 13.3 Phase 1 完成标准

满足以下条件即可判定 phase 1 达标：

- `dotnet/` 目录已初始化完整工程结构；
- SDK 核心已能稳定打开串口并发送 / 解析最小集合 directive；
- 至少一组 parser fixture tests 已通过；
- 至少一组真机 examples 已通过；
- `.NET` 版 README / directives 文档已达到最小可用程度；
- 已明确记录尚未对齐的能力差距。

## 14. Phase 3 以后可选扩展

后续可再考虑：

- JWT / CORS / config-file 完整对齐
- replay / task persistence
- HTTP client CLI
- 更完整的 converter / file server
- 发布脚本与多平台预编译产物
- NuGet package 发布
- 与根目录 examples/共享文档的更细粒度自动对齐检查

## 15. 实施顺序建议

推荐按以下顺序推进：

1. 初始化 `dotnet/` solution 与核心 `MkpKit` 工程。
2. 先落 `Models`、`Parser`、`Serial` 三层。
3. 用 fake transport 把 parser / timeout / stale buffer regression tests 跑通。
4. 用真实设备打通 `sn`、`list_dir`、`atime`、`ahttpbase`。
5. 再补 `Helpers` 与最小 `Controller`。
6. 补 `M10` / `Kpad` / `ContextKeys` examples。
7. 再开 `Cli` / `Server` / `FileServer` / `Converter`。
8. 最后补齐双语文档与剩余 parity 项。

## 16. 总结

这份 spec 的核心约束只有三条：

1. `.NET` 端口是 `mkp-kit` 的**正式语言实现**，不是一次性旁支实验。
2. phase 1 的第一优先级不是 server，不是 docs，而是：**串口收发稳定、parser 稳定、真机验证稳定**。
3. 所有后续 CLI / HTTP / converter / file-server 能力，都必须建立在一个可复用、可单测、可诊断的核心 SDK 之上。

只要坚持这个顺序，`.NET` 端口就可以在不破坏 monorepo 维护节奏的前提下，逐步成长为和 Go / Python / Rust / Node / C++ 并列的第六种正式实现。
