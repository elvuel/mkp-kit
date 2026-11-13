# MKP Kit Java Port Implement Spec

更新日期：2026-11-13

## 1. 背景

`mkp-kit` 当前已经在 monorepo 中维护了 `go/`、`python/`、`rust/`、`node/`、`cpp/`、`dotnet/` 六种语言实现，并且仓库根目录已经统一了：

- 共享能力定义
- 共享 directive 语义
- monorepo 维护规则
- 跨语言文档职责边界

因此，Java 版本不应被视为一个独立新项目，而应被视为 `mkp-kit` 的**第七个语言实现目录**：`java/`。

本 spec 的目标，是把 Java 端口的：

- 落地范围
- 目录结构
- 技术基线
- 实施顺序
- 验收标准
- 与现有六端对齐的关键点

明确下来，便于后续按阶段自动推进。

## 2. 目标

本次 Java port 的首要目标是：

1. 在 monorepo 中新增 `java/` 子目录。
2. 提供可运行的 Java SDK 核心能力。
3. 对齐当前共享 directive 语义与默认行为。
4. 先交付可直接驱动设备与验证协议行为的 MVP。
5. 为后续 CLI / client / HTTP server / converter / file server 留出明确扩展路径。

## 3. 非目标

首个实现阶段不以以下目标为前置门槛：

- 不要求第一阶段就完成全部 HTTP server 路由。
- 不要求第一阶段就完成 `mkp-client`。
- 不要求第一阶段就完成 converter / file server。
- 不要求第一阶段就复刻所有高阶 controller 与平滑轨迹封装。
- 不要求第一阶段就完成 Maven Central 发布、GitHub Actions、签名发布等分发工作。
- 不要求第一阶段就引入 Spring Boot、Micronaut、Quarkus 等较重框架。

这些能力应作为 phase 2 及以后逐步补齐的内容。

## 4. 语言与运行时决策

### 4.1 实现语言

Java 版本建议使用：

- **Java 21 LTS** 作为实现基线
- 同时在 **Java 25 LTS** 上做兼容验证

原因：

- Java 21 是稳定的长期支持基线；
- Java 25 也是 LTS，适合作为前瞻兼容目标；
- 串口依赖 `jSerialComm` 在 Java 24+ 上可能涉及 native-access 启动参数，先以 21 作为开发基线更稳妥。

### 4.2 构建系统

建议使用：

- **Gradle Kotlin DSL**

原因：

- 更适合 multi-module 工程；
- 便于管理 examples、CLI、server、converter 等多入口；
- 相比 Maven，更方便按模块拆分可执行入口与共享测试夹具。

### 4.3 包命名

建议统一使用：

- `io.github.elvuel.mkp.java.*`

原因：

- 与 GitHub 仓库归属一致；
- 便于未来若发布到 Maven Central 时沿用同一命名体系；
- 与 monorepo 其他语言目录名称不冲突。

## 5. 目录结构

建议在仓库根目录新增：

```text
java/
  settings.gradle.kts
  build.gradle.kts
  gradle.properties
  README.md
  README.en.md
  directives.md
  directives.en.md
  core/
    build.gradle.kts
    src/main/java/io/github/elvuel/mkp/java/core/
    src/test/java/io/github/elvuel/mkp/java/core/
  cli/
    build.gradle.kts
    src/main/java/io/github/elvuel/mkp/java/cli/
    src/test/java/io/github/elvuel/mkp/java/cli/
  client/
    build.gradle.kts
    src/main/java/io/github/elvuel/mkp/java/client/
    src/test/java/io/github/elvuel/mkp/java/client/
  server/
    build.gradle.kts
    src/main/java/io/github/elvuel/mkp/java/server/
    src/test/java/io/github/elvuel/mkp/java/server/
  file-server/
    build.gradle.kts
    src/main/java/io/github/elvuel/mkp/java/fileserver/
    src/test/java/io/github/elvuel/mkp/java/fileserver/
  converter/
    build.gradle.kts
    src/main/java/io/github/elvuel/mkp/java/converter/
    src/test/java/io/github/elvuel/mkp/java/converter/
  examples/
    README.md
    common/
    directives/
    m10/
    kpad/
    context/
```

说明：

- `core/` 只放 SDK 基础能力；
- `cli/` 与 `client/` 拆分，分别对应直连设备 CLI 与 HTTP API client；
- `server/` 与 `file-server/` 分开，避免首版就把职责混在一起；
- `examples/` 独立放置，风格对齐其它语言的 examples 目录。

## 6. 模块设计

### 6.1 `core/`

职责：

- 串口 transport 封装
- directive parser registry
- typed models
- helpers / controller
- keycodes 与输入组合
- 核心 converter 逻辑中可复用的模型与协议代码

建议子包：

- `serial`
- `parser`
- `model`
- `helper`
- `controller`
- `keycodes`
- `diagnostics`

### 6.2 `cli/`

职责：

- 提供直连设备的 `mkp-java` CLI
- 对齐当前其它语言 CLI 暴露的子命令与 flags

### 6.3 `client/`

职责：

- 提供面向 `mkp-server` 的 HTTP API client
- 对齐 `version`、`auth`、`list`、`recording`、`replay`、`remove`、`stop`

### 6.4 `server/`

职责：

- 提供 Java 版 `mkp-server`
- 对齐 auth、directive proxy、records CRUD、replay status、录制 / 回放控制

### 6.5 `file-server/`

职责：

- 提供文件上传 / 下载 / 列目录服务
- 对齐路径穿越保护与文件名清洗

### 6.6 `converter/`

职责：

- 提供 `.log <-> .json`
- 支撑 `adumj` / `ajson2log` 相关离线能力

## 7. 核心模型与类型要求

Java 端口应尽早落定这些共享模型：

- `SN`
- `Heartbeat`
- `MKPVersion`
- `LogLength`
- `LogInfo`
- `FileNode`
- `FileSystem`
- `ActionDump`
- `AHTTPBase`
- `SerialPortStatus`

以及这些 option 类型：

- `JoinOption`
- `WifiAutoOption`
- `AGetOption`
- `APutOption`
- `AHttpBaseOption`
- `AJson2LogOption`
- `APlayOption`
- `LogOption`
- `M10Option`
- `KpadOption`

要求：

- 字段语义优先对齐共享协议；
- 命名允许 Java 化，但必须能清楚映射回原始 directive 参数与返回值；
- 对于 `MKPVersion`，需同时考虑设备原始 `app` / `boot` / `hw` 与 Go client 风格 `uver` / `aver` 的展示兼容。

## 8. parser 设计

### 8.1 基础要求

parser 必须按 directive 注册，不得只写一个统一“猜类型”的解析器。

建议提供：

- `DirectiveParser`
- `DirectiveParserRegistry`
- `DirectiveOutputKind`
- `DirectiveEofFlags`

输出类型至少支持：

- `json`
- `text`
- `line-json`
- `raw-json-text`
- `empty-ok`

### 8.2 必须优先对齐的 directive

parser MVP 必须优先覆盖：

- `sn`
- `alive`
- `aversion`
- `atime`
- `ainsp`
- `list_dir`
- `join`
- `wifi_auto`
- `ahttpbase`
- `adumj`
- `aget`
- `aput`
- `ajson2log`
- `alog`
- `astop`
- `acancel`

### 8.3 易错点要求

必须显式处理：

- directive echo
- `cli>` prompt
- `<EOF>`
- 噪声日志前缀
- JSON blob 抽取
- line JSON 定位
- stale buffer 对本次 directive 的隔离

重点是：

- `atime` 一类 line JSON
- `list_dir` 一类 blob JSON
- `ahttpbase` 查询 / 设置双模式
- `acancel` raw JSON text

## 9. 串口 transport 设计

### 9.1 技术选型

串口层使用：

- `jSerialComm`

要求：

- 使用显式读循环 / 显式同步等待模型；
- 不要把 parser 正确性押在事件回调上；
- timeout、EOF、剩余缓冲区管理必须可测试。

### 9.2 最小接口

建议定义：

- `SFSerialPort`
- `SerialPortOptions`
- `SerialPortStatus`
- `ISerialTransport` 或同等抽象

最小能力：

- `open()` / `close()`
- `sendDirective()`
- `sendDirectiveNoWait()`
- `sendParsed()`
- status snapshot

### 9.3 debug capture

Java 版建议一开始就留出调试能力，而不是后补。

最低要求：

- 当同步等待超时或 parser 失败时，可选落盘调试信息
- 调试目录可由环境变量覆盖
- 调试内容至少包含：directive、raw output、buffer snapshot、parser name、timeout 信息

这部分不要求第一阶段就追平 Python 的完整自动摘要，但必须预留挂点。

## 10. helper / controller 设计

### 10.1 helper

建议提供与其它语言语义对齐的高层 helper：

- `keyTap`
- `keyDown`
- `keyUp`
- `keyPresses`
- `typeText`
- `mouseReleaseAll`
- `keypadRelease`
- `keypadReleaseAll`

### 10.2 controller

建议提供 `Controller` 封装：

- 组合输入动作
- 平滑鼠标移动
- 更高层录制 / 回放 / 文件代理

首版不要求一开始就做得很重，但要给出清晰扩展位。

## 11. CLI 设计

建议使用：

- `picocli`

首版 `mkp-java` 应至少覆盖：

- `status`
- `sn` / `alive` / `aversion`
- `atime` / `ainsp`
- `list_dir` / `clean_dir` / `delete_file`
- `join` / `wifi_auto` / `ahttpbase`
- `aget` / `aput` / `adumj` / `ajson2log`
- `alog` / `astop` / `acancel` / `aplay`
- `m10`
- `kpad`
- `raw`
- `raw-async`

CLI 行为要求：

- 帮助输出应稳定；
- 错误返回码统一；
- `--port`、`--timeout`、`--mouse-port`、`--keyboard-port` 应统一由全局参数处理；
- 允许 `--json` 控制结构化输出打印。

## 12. client 设计

Java 版 `mkp-client` 建议对齐当前 Go / Node / .NET client 结构。

首版至少支持：

- `version`
- `auth login`
- `auth token`
- `auth revoke`
- `list`
- `recording`
- `replay`
- `remove`
- `stop`

要求：

- 支持配置文件查找顺序
- 支持环境变量覆盖
- 支持 token 自动刷新
- 支持 version cache
- `version` 表格输出尽量对齐 Go 风格

## 13. server 设计

### 13.1 技术基线

建议首版直接基于：

- JDK `HttpServer`

不要把首版前置到更重的 Web 框架。

### 13.2 首版路由范围

建议至少覆盖：

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

以及基础 directive 代理接口。

### 13.3 横切能力

首版 server 至少要明确：

- config-file
- JWT / token 生成
- CORS / `OPTIONS`
- records persistence 抽象
- debug / release mode 差异

## 14. file server 设计

Java 版 file server 不建议把 `SimpleFileServer` 直接当最终实现。

建议：

- 开发 / 调试阶段可借鉴 `SimpleFileServer` 设计；
- 正式实现应基于 `HttpServer` 自定义 handler。

首版至少覆盖：

- `PUT /<path>` 原始上传
- `GET /<path>` 文件下载
- `POST /upload` multipart 上传
- `GET /list?path=` 目录列举
- traversal protection
- filename sanitization

## 15. converter 设计

Java 版 converter 应尽量复用其它语言已经验证过的 envelope 语义。

至少包含：

- `log -> json`
- `json -> log`
- 对 `adumj` / `ajson2log` 相关 payload 的对齐

建议：

- 先以离线命令行工具实现；
- 再视需要补更细颗粒度的库 API。

## 16. examples 设计

Java 版 examples 至少应包含：

- `examples/directives/`
- `examples/m10/`
- `examples/kpad/`
- `examples/context/`

要求：

- 命令与路径说明统一；
- 公共端口获取与输出打印抽到 `examples/common/`；
- `m10` 示例明确“左平移 400，再向上移动 400”；
- `kpad` 示例明确输出 `Hello MKP!`。

## 17. 文档要求

`java/` 目录最终应具备四件套：

- `java/README.md`
- `java/README.en.md`
- `java/directives.md`
- `java/directives.en.md`

以及：

- `java/examples/README.md`

要求：

- 明确这是 monorepo 下的 `java/` 子目录；
- 路径、命令默认相对于 `java/`；
- 与根目录共享文档保持术语一致；
- 若某能力未实现，不得文档先写成已支持；
- examples 小节必须独立成章。

## 18. 测试与验证要求

### 18.1 测试层级

至少分三层：

1. parser 单元测试
2. SDK / mock serial 集成测试
3. 有设备时的手工 examples 验证

### 18.2 parser 测试必须覆盖

- `atime` line JSON
- `list_dir` JSON blob
- `ahttpbase` query / set 双模式
- `adumj` 混合输出中的 JSON 抽取
- `ajson2log` 文本输出
- `acancel` raw JSON text
- parser preflight 对残留前缀的清理

### 18.3 SDK 测试必须覆盖

- sync directive timeout
- stale buffer 对本次 directive 的隔离
- 不同 EOF 标记的切分
- parser 缺失时的错误路径
- debug capture 写盘路径

### 18.4 client / server 测试必须覆盖

- token 获取与缓存
- expired token 自动刷新
- version cache
- list / replay / remove / stop 路径
- auth / records / replay status 路由行为

### 18.5 examples 验证

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

## 19. 实施顺序

建议按以下顺序执行：

### Phase 0：脚手架

- 初始化 `java/`
- 建立 multi-module Gradle 工程
- 建立 README / directives 文档骨架
- 建立测试脚手架

### Phase 1：核心模型与 parser

- 实现 `model`
- 实现 `keycodes`
- 实现 parser registry
- 写 parser regression tests

### Phase 2：串口层

- 接入 `jSerialComm`
- 实现 `SFSerialPort`
- 实现同步读循环
- 实现 timeout / stale buffer 管理
- 接入 parser

### Phase 3：MVP wrappers / helpers / examples

- 实现 MVP directive wrappers
- 实现 `m10` / `kpad`
- 实现 helper / 轻量 controller
- 跑通 examples

### Phase 4：CLI / converter

- 实现 `mkp-java`
- 实现 `.log <-> .json` converter
- 补 CLI / converter 测试

### Phase 5：client / server / file server

- 实现 `mkp-client`
- 实现 `mkp-server`
- 实现 `mkp-file-server`
- 补 JWT / CORS / config-file / persistence

### Phase 6：文档与差异收口

- 补 README / directives 四件套
- 补 examples README
- 明确已实现项、未实现项、已知差异

## 20. 验收标准

Java MVP 视为完成，至少需要满足：

1. `java/` 工程可独立构建。
2. parser 测试覆盖主要易错 directives。
3. SDK 可以稳定发送并解析同步 directives。
4. `m10` 与 `kpad` examples 可运行。
5. `sn` / `alive` / `aversion` / `atime` / `list_dir` / `ahttpbase` 至少完成 mock 或真机级验证。
6. 文档四件套齐全。
7. 文档明确列出未实现项与已知限制。

## 21. 风险清单

主要风险：

- Java 24+ / 25 上 `jSerialComm` native-access 启动参数带来的运行摩擦；
- 串口同步响应切分不稳定；
- parser 规则与其它语言不一致；
- 过早引入 server / client / file server 使首版范围失控；
- keycodes 与大小写 / 组合键处理不完整。

对应策略：

- 先以 Java 21 LTS 作为实现基线；
- 先固化 parser 与 SDK，再上高层能力；
- 用 mock serial + examples 双路径验证；
- 将易错行为写成回归测试，不靠手工记忆维护。

## 22. 建议的首批落地任务

如果下一步开始实施，建议先拆成这些任务：

1. 初始化 `java/` multi-module Gradle 工程。
2. 建立 `core` 下的 `model` / `keycodes` / `diagnostics` 骨架。
3. 完成 parser MVP 与 parser tests。
4. 接入 `jSerialComm` 并完成同步读循环与 timeout / debug capture。
5. 完成 `sn` / `alive` / `aversion` / `atime` / `list_dir` / `ahttpbase` / `m10` / `kpad`。
6. 跑通 `examples/m10/` 与 `examples/kpad/`。
7. 再继续补 `ainsp` / `join` / `wifi_auto` / `adumj` / `aget` / `aput` / `ajson2log`。
8. 最后推进 CLI / client / server / file server / converter。

## 23. 结论

Java 端口应被作为 `mkp-kit` 的下一个正式语言实现推进。

实现策略上，优先顺序应为：

- 共享协议行为对齐
- parser 稳定性
- SDK 可用性
- examples 可验证性
- 再逐步上升到 CLI / client / server / file server / converter

换言之，**先做一个稳定、可验证、易维护的 Java SDK 核心，再逐步补齐更高层工具链**。

