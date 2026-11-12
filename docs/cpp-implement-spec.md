# MKP Kit C++ Port Implement Spec

更新日期：2026-11-12

## 1. 背景

`mkp-kit` 当前已经是一个 monorepo，根目录统一维护共享能力定义、共享 directive 语义、共享文档契约以及跨语言维护规则。

现有语言实现已经包含：

- `go/`
- `python/`
- `rust/`
- `node/`

因此，C++ 版本不应被视为一个独立的新项目，而应被视为 `mkp-kit` 的下一个正式语言实现目录：`cpp/`。

本 spec 的目标，是把 C++ 端口的范围、目录结构、依赖决策、实施顺序、验收标准与风险边界明确下来，便于后续按阶段自动推进，而不是在实现中边写边重定 scope。

## 2. 目标

本次 C++ port 的首要目标是：

1. 在 monorepo 中新增 `cpp/` 子目录。
2. 提供可运行的 C++ SDK 核心能力。
3. 对齐当前共享 directive 语义与默认行为。
4. 优先交付可稳定驱动设备、可验证协议行为的 MVP。
5. 为后续 controller / CLI / HTTP / tools / persistence 留出清晰扩展路径。

## 3. 非目标

首个实现阶段不以以下目标为前置门槛：

- 不要求第一阶段就完成所有 HTTP server 能力。
- 不要求第一阶段就完成完整 `mkp-client` 体验。
- 不要求第一阶段就完成 converter / `json2log` / `log2json` 全量工具链。
- 不要求第一阶段就补齐 Go 侧所有高阶 controller / helper 行为。
- 不要求第一阶段就覆盖发布、安装包、CI、跨平台打包流程。

这些能力应被视为 phase 2 及以后逐步补齐的内容。

## 4. 语言与构建决策

### 4.1 语言基线

建议使用：

- **C++20** 作为默认实现基线

说明：

- C++20 足以支撑现代字符串处理、`std::chrono`、RAII 封装、测试与工具组织；
- 若个别依赖或编译器环境受限，可向下兼容到 **C++17**，但 spec 默认按 C++20 设计；
- 不建议为了追求“纯 C 风格”而主动回避 STL / RAII / 强类型模型。

### 4.2 构建系统

建议使用：

- `CMake`

要求：

- 以 monorepo 中的 `cpp/` 为独立子工程；
- 支持 out-of-tree build；
- 支持在 Windows 上直接构建；
- 支持将第三方依赖集中声明，避免手工散落 vendor。

### 4.3 依赖策略

建议策略：

- 优先采用 `FetchContent` 或等价的可声明式依赖获取方式；
- 允许为单头文件依赖提供 vendor fallback；
- 避免第一版引入过多大型框架。

## 5. 依赖建议

### 5.1 Phase 1 必需依赖

建议：

- 串口：`Boost.Asio` 的 `serial_port`
- JSON：`nlohmann/json`
- 测试：`Catch2` 或 `doctest`

说明：

- 串口层应优先解决同步读写、超时、EOF 切分、stale buffer 清理；
- JSON 层应优先解决 directive 输出到 typed model 的稳定映射；
- 测试框架应轻量，便于快速补 parser regression tests。

### 5.2 Phase 2 可选依赖

建议：

- HTTP server/client：`cpp-httplib`
- JWT：`jwt-cpp`
- 持久化：`sqlite3`
- CLI 参数：`CLI11` 或 `cxxopts`

说明：

- Phase 1 不要求把这些全部引入；
- 只有当 `server` / `client` / `tools` 真正开工时，再补齐对应依赖；
- 避免在 SDK 核心未稳定前过早扩张依赖面。

## 6. 目录结构

建议在仓库根目录新增：

```text
cpp/
  CMakeLists.txt
  README.md
  README.en.md
  directives.md
  directives.en.md
  include/
    mkp/
      sdk.hpp
      parser.hpp
      models.hpp
      keycodes.hpp
      helper.hpp
      controller.hpp
      error.hpp
      debug.hpp
  src/
    sdk.cpp
    parser.cpp
    models.cpp
    keycodes.cpp
    helper.cpp
    controller.cpp
    cli.cpp
    converter.cpp
    server.cpp
    file_server.cpp
    debug.cpp
  examples/
    common/
    directives/
      adumj.cpp
      aget.cpp
      ahttpbase.cpp
      ainsp.cpp
      ajson2log.cpp
      alive.cpp
      alog.cpp
      aput.cpp
      astop.cpp
      atime.cpp
      aversion.cpp
      clean_dir.cpp
      delete_file.cpp
      join.cpp
      list_dir.cpp
      sn.cpp
      wifi_auto.cpp
    m10.cpp
    kpad.cpp
    context_keys.cpp
  tools/
    converter/
    file_server/
    json2log/
    log2json/
  tests/
    parser_tests.cpp
    sdk_tests.cpp
    helper_tests.cpp
    controller_tests.cpp
    converter_tests.cpp
    server_tests.cpp
```

说明：

- `include/mkp/` 暴露公共头文件；
- `src/` 放实现；
- `examples/` 对齐当前 monorepo 的 examples 结构；
- `tools/` 为后续 parity 预留位置；
- `tests/` 同时覆盖 parser、SDK、helper 与工具层。

## 7. 模块设计

### 7.1 `models`

职责：

- 定义 directive 对应的返回模型；
- 定义 `M10Option`、`KpadOption`、`JoinOption`、`WifiAutoOption`、`AGetOption`、`APutOption`、`AHTTPBaseOption`、`AJSON2LogOption`、`LogOption` 等参数模型；
- 为结构化解析提供统一字段约束；
- 统一默认值与序列化辅助。

要求：

- 字段语义优先对齐共享协议；
- 命名可保持 C++ 风格，但必须可追溯到原始 directive 参数与设备返回结构；
- 尽量避免把“原始 JSON 字段名耦合”散落到各业务调用处。

### 7.2 `keycodes`

职责：

- 定义 HID keycode 映射；
- 支持大小写、数字、符号、修饰键组合；
- 支撑 `kpad` / `typeText` / `keyTap` 等高层 helper。

要求：

- 与 Go / Python / Rust / Node 的字符到按键语义保持一致；
- 避免出现“只打出首字符”或“大小写丢失”这类状态机错误；
- 明确建模 shift / ctrl / alt / meta 与普通键组合。

### 7.3 `parser`

职责：

- 为每个 directive 注册对应 parser；
- 处理 raw text、整段 JSON、line JSON、混合文本中的 JSON blob；
- 提供 parse failed 时的调试入口。

要求：

- parser 注册必须显式；
- 不允许把所有解析逻辑塞到 `sdk` 读循环里；
- 必须覆盖 `atime`、`list_dir`、`ahttpbase`、`adumj`、`ajson2log` 等易错指令；
- 必须处理一次成功、后续失败这类 stale buffer / 粘包问题。

### 7.4 `sdk`

职责：

- 管理串口连接、关闭、同步发送、异步发送；
- 统一 directive 响应读取；
- 对接 parser 返回 typed result；
- 暴露指令级 wrappers 与基础 raw send 能力。

建议抽象：

- `SerialTransport`
- `MKPClient` 或 `SFSerialPort`
- `DirectiveParserRegistry`
- `RawDirectiveResponse`

要求：

- 同步发送必须能正确区分当前请求与上次残留数据；
- 必须提供 timeout；
- 必须提供 parse failed / timeout 的 debug capture；
- 必须支持仅获取 raw response，用于调试与回归测试；
- Phase 1 先把同步模型做稳，再考虑异步封装。

### 7.5 `helper`

职责：

- 提供比原始 directive 更高层的组合能力；
- 封装 `typeText`、`releaseAll`、`keyTap`、`keyDown`、`keyUp` 等；
- 承担最基础的易用性增强。

要求：

- helper 不应破坏底层可预测性；
- 对设备可见行为的改动必须和其它语言一致；
- 若有语言特有便利 API，应在文档中明确标注。

### 7.6 `controller`

职责：

- 承担更高层的组合控制，如鼠标平滑移动、键鼠脚本动作、录制/回放辅助；
- 为未来 server / client / automation 提供稳定抽象边界。

要求：

- Phase 1 可只做最小 controller；
- Phase 2 再对齐 Go 中更复杂的鼠标轨迹或动作流；
- 不应在 controller 中重复 parser 或底层串口逻辑。

### 7.7 `server` / `cli` / `tools`

职责：

- `cli`：提供本地命令行入口；
- `server`：暴露 HTTP API；
- `tools`：承载 converter、file server、`json2log`、`log2json` 等工具。

要求：

- 全部视为 phase 2 以后能力；
- 实施前先复查 Go / Python / Rust / Node 四端的共同契约；
- 不允许为赶 parity 把 server 逻辑直接硬塞进 SDK 主库。

## 8. Phase 1 必须覆盖的 directive / API

建议最小可交付集合：

- `sn`
- `alive`
- `aversion`
- `atime`
- `ainsp`
- `list_dir`
- `join`
- `wifi_auto`
- `ahttpbase`
- `m10`
- `kpad`

说明：

- 这批能力足以验证：串口收发、模型解析、键鼠控制、文件系统查询、网络配置、示例可运行；
- 它们也是当前多语言端口里 parser 最容易出现行为差异的地方。

## 9. Phase 2 补齐项

建议下一阶段继续补：

- `alog`
- `astop`
- `acancel`
- `aplay`
- `aget`
- `aput`
- `delete_file`
- `clean_dir`
- `ajson2log`
- `adumj`

以及：

- converter
- file server
- `mkp-server`
- `mkp-client`
- JWT / CORS / config-file
- records persistence

## 10. I/O 与解析契约

### 10.1 读取边界

必须明确：

- 哪些 directive 以空闲超时结束；
- 哪些 directive 以固定 EOF / prompt / 空行结束；
- 哪些 directive 会返回混合文本 + JSON；
- 哪些 directive 可能分多段到达。

要求：

- 这些规则应集中在 parser / response profile 中维护；
- 不应散落在每个 example 或 wrapper 里各写一套。

### 10.2 stale buffer 清理

必须处理：

- 上一条指令残留输出影响下一条同步读取；
- 一条指令第一次成功、第二次失败；
- JSON 前面夹带历史残留文本。

要求：

- 提供发送前 drain 或等价策略；
- 提供 parse 前预处理；
- 提供 debug 日志以便回放问题样本。

### 10.3 debug capture

建议提供：

- timeout 样本落盘；
- parse failed 样本落盘；
- 可关闭或配置输出目录。

要求：

- 目录策略应与 monorepo 其它语言保持尽量一致；
- 不得默认无限制膨胀日志；
- 文档必须说明如何开启、如何清理。

## 11. examples 设计

首批 examples 至少应包含：

- `examples/m10.cpp`
- `examples/kpad.cpp`
- `examples/context_keys.cpp`
- `examples/directives/sn.cpp`
- `examples/directives/alive.cpp`
- `examples/directives/aversion.cpp`
- `examples/directives/atime.cpp`
- `examples/directives/ainsp.cpp`
- `examples/directives/list_dir.cpp`
- `examples/directives/join.cpp`
- `examples/directives/wifi_auto.cpp`
- `examples/directives/ahttpbase.cpp`

要求：

- 运行方式应与其它语言一样直观；
- 每个 example 聚焦一个能力，不混杂多个职责；
- 公共端口获取与输出格式应抽到 `examples/common/`；
- 设备依赖项、参数说明、风险提示应写到对应 README。

## 12. 文档要求

`cpp/` 目录最终应具备四件套：

- `cpp/README.md`
- `cpp/README.en.md`
- `cpp/directives.md`
- `cpp/directives.en.md`

要求：

- 明确这是 monorepo 下的 `cpp/` 子目录；
- 路径、命令默认相对于 `cpp/`；
- 与根目录共享文档保持术语一致；
- 明确列出 phase 1 已支持项与未支持项；
- examples 小节必须独立成章；
- 若某能力尚未实现，不得文档先写成已支持。

## 13. 测试与验证要求

### 13.1 测试层级

至少分三层：

1. **parser 单元测试**
2. **SDK / mock serial 集成测试**
3. **有设备时的手工 examples 验证**

### 13.2 parser 测试必须覆盖

- `atime` line JSON
- `list_dir` JSON blob
- `ahttpbase` query / set 两种模式
- `adumj` 混合输出中的 JSON 抽取
- `ajson2log` 文本输出
- `acancel` raw JSON text
- parser preflight 对残留前缀的清理

### 13.3 SDK 测试必须覆盖

- sync directive timeout
- stale buffer 对本次 directive 的隔离
- 不同 EOF 标记的切分
- parser 缺失时的错误路径
- debug capture 写盘路径

### 13.4 examples 验证

若存在真实设备，至少手工验证：

- `m10`
- `kpad`
- `sn`
- `alive`
- `atime`
- `list_dir`
- `ahttpbase`

若不存在真实设备：

- 明确说明只完成 mock / parser 层验证；
- 不得把未验证的硬件行为写成“已确认正常”。

## 14. 实施顺序

建议按以下顺序执行：

### Phase 0：脚手架

- 初始化 `cpp/`
- 建立 `CMakeLists.txt`
- 建立头文件 / 源文件骨架
- 建立测试脚手架
- 建立 README / directives 文档骨架

### Phase 1：模型与 keycodes

- 实现 `models`
- 实现 `keycodes`
- 落定 option / result 类型

### Phase 2：parser

- 实现 parser 基础设施
- 注册全部 MVP directives parser
- 写 parser regression tests

### Phase 3：SDK 串口层

- 实现串口封装
- 实现同步读循环
- 实现 timeout / stale buffer 清理
- 实现 debug capture
- 接入 parser

### Phase 4：wrappers / helper / examples

- 实现 MVP directive wrappers
- 实现 `m10` / `kpad`
- 实现基础 helper
- 跑通 examples

### Phase 5：controller / tools / docs 补齐

- 补最小 controller
- 补 converter / file server 规划位
- 补 README / directives 补充文档

### Phase 6：HTTP / persistence

- `mkp-server`
- `mkp-client`
- JWT / CORS / config-file
- SQLite records persistence

## 15. 验收标准

C++ MVP 视为完成，至少需要满足：

1. `cpp/` 可独立配置并编译。
2. parser 测试覆盖主要易错 directives。
3. SDK 可以稳定发送并解析同步 directives。
4. `m10` 与 `kpad` examples 可运行。
5. 主要 directives examples 可运行或至少完成 mock / parser 级验证。
6. `cpp/` 文档四件套齐全。
7. 文档明确列出未实现项与已知限制。

## 16. 风险清单

主要风险：

- 串口同步响应切分不稳定；
- parser 规则与其它语言不一致；
- 键盘状态缓存或大小写处理不完整；
- Windows 构建链差异导致依赖接入不顺；
- 过早引入 HTTP / CLI / tools 使首版范围失控。

对应策略：

- 先固化 parser 与 SDK，再上高层能力；
- 先做 Core SDK + examples，不急于做全量 server；
- 通过 mock serial + examples 双路径验证；
- 将易错行为写成回归测试，不靠手工记忆维护。

## 17. 建议的首批落地任务

如果下一步开始实施，建议先拆成以下任务：

1. 初始化 `cpp/` 工程骨架与 `CMakeLists.txt`。
2. 建立 `models` / `keycodes` / `error` 公共头文件。
3. 完成 parser MVP 与 parser tests。
4. 完成串口同步读循环与 timeout / debug capture。
5. 完成 `m10` / `kpad` / `sn` / `alive` / `aversion` / `atime` / `list_dir` / `ahttpbase`。
6. 跑通 `examples/m10.cpp` 与 `examples/kpad.cpp`。
7. 再继续补 `ainsp` / `join` / `wifi_auto` 与其余 directives。

## 18. 结论

C++ 端口应被作为 `mkp-kit` 的下一个正式语言实现推进。

实现策略上，优先顺序应为：

- 共享协议行为对齐
- parser 稳定性
- SDK 可用性
- examples 可验证性
- 再逐步上升到 controller / CLI / HTTP / tools

换言之，**先做一个稳定、可验证、易维护的 C++ SDK 核心，再逐步补齐更高层工具链**。
