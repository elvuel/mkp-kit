# MKP Kit Node.js Port Implement Spec

更新日期：2026-11-12

## 1. 背景

`mkp-kit` 当前已经有 `go/`、`python/`、`rust/` 三个语言实现，并且已经在仓库根目录统一了：

- 共享能力定义
- 共享 directive 语义
- monorepo 维护规则
- 各语言补充文档的职责边界

因此，Node.js 版本不应被视为一个独立新项目，而应被视为 `mkp-kit` 的第四个语言实现目录：`node/`。

本 spec 的目标，是把 Node.js 端口的落地范围、目录结构、实施顺序、验收标准、以及与现有三端对齐的关键点明确下来，便于后续按阶段自动推进。

## 2. 目标

本次 Node.js port 的首要目标是：

1. 在 monorepo 中新增 `node/` 子目录。
2. 提供可运行的 Node.js SDK 核心能力。
3. 对齐当前共享 directive 语义与默认行为。
4. 先交付可直接驱动设备与验证协议行为的 MVP。
5. 为后续 CLI / HTTP server / converter / file-server 留出明确扩展路径。

## 3. 非目标

首个实现阶段不以以下目标为前置门槛：

- 不要求第一阶段就完成 HTTP server。
- 不要求第一阶段就完成 HTTP client CLI。
- 不要求第一阶段就完成 converter / `json2log` / `log2json` 工具链。
- 不要求第一阶段就复刻 Go / Rust 中所有高阶鼠标轨迹控制器。
- 不要求第一阶段就覆盖所有打包、发布、CI、npm 发布流程。

这些能力应被视为 phase 2 及以后逐步补齐的内容。

## 4. 语言与运行时决策

### 4.1 实现语言

Node 版本建议使用：

- **TypeScript** 作为主实现语言
- 输出标准 Node.js 包

原因：

- 当前三端都已经有较明确的 typed model 概念；
- directive 输出存在多种 JSON / text 形态，TypeScript 更适合把返回结构稳定建模；
- 后续 CLI / server / tools 共用一套类型定义更容易维护。

### 4.2 Node 版本基线

建议最低版本：

- `Node.js 20+`

原因：

- 便于统一使用较新的标准库能力；
- 便于与当前串口生态的现代版本保持一致；
- 便于减少 polyfill 与兼容层负担。

## 5. 目录结构

建议在仓库根目录新增：

```text
node/
  package.json
  tsconfig.json
  README.md
  README.en.md
  directives.md
  directives.en.md
  src/
    index.ts
    sdk.ts
    parser.ts
    models.ts
    keycodes.ts
    helper.ts
    controller.ts
    server.ts
    cli.ts
    converter.ts
    file_server.ts
  src/bin/
    mkp.ts
    mkp-server.ts
    converter.ts
    file-server.ts
    json2log.ts
    log2json.ts
  examples/
    m10.ts
    kpad.ts
    common.ts
    directives/
      adumj.ts
      aget.ts
      ahttpbase.ts
      ainsp.ts
      ajson2log.ts
      alive.ts
      alog.ts
      aput.ts
      astop.ts
      atime.ts
      aversion.ts
      clean_dir.ts
      delete_file.ts
      join.ts
      list_dir.ts
      sn.ts
      wifi_auto.ts
  tests/
    parser.test.ts
    sdk.test.ts
    helper.test.ts
    converter.test.ts
    file_server.test.ts
    server.test.ts
```

说明：

- `src/` 按能力层划分；
- `src/bin/` 对齐 Rust 多二进制入口的组织方式；
- `examples/` 对齐当前三端 examples 结构；
- `tests/` 同时覆盖 parser、SDK、工具与 server。

## 6. 模块设计

### 6.1 `src/models.ts`

职责：

- 定义 typed return models；
- 定义 `M10Option`、`KpadOption`、`JoinOption`、`WifiAutoOption`、`AGetOption`、`APutOption`、`AHTTPBaseOption`、`AJSON2LogOption`、`LogOption` 等 option 类型；
- 定义键盘状态缓存所需的共享状态；
- 提供必要的构造器、默认值、序列化辅助。

要求：

- 字段语义优先对齐共享协议，不强行照搬 Go / Python / Rust 命名；
- 但必须保证能清楚映射回原始 directive 参数与返回值。

### 6.2 `src/keycodes.ts`

职责：

- 定义 HID keycode 映射；
- 支持大小写、数字、符号、常见组合键；
- 支持文本输入 helper 所需的字符到按键序列映射。

要求：

- 不能只实现 `Hello MKP!` 这样的最小硬编码案例；
- 应从现有三端 keycode 定义中抽出一套 Node 版可维护映射。

### 6.3 `src/parser.ts`

职责：

- 定义 parser registry；
- 维护 `EOF_DEFAULT` 与 `EOF_CLI`；
- 定义每个 directive 的 parser；
- 实现：
  - 预处理输出
  - 去除 echo / prompt 噪声
  - JSON blob 抽取
  - line JSON 提取
  - text success / failure 判断

必须对齐的重点：

- `atime`
- `list_dir`
- `ahttpbase`
- `adumj`
- `ajson2log`
- `acancel`

要求：

- parser 必须是**按 directive 注册**，不能只写一个统一“猜类型”的解析器；
- 必须支持输出类型区分：`json`、`text`、`raw-json-text`、`line-json`、`empty-ok`；
- 必须保留与后续 debug capture 集成的足够上下文。

### 6.4 `src/sdk.ts`

职责：

- 封装串口连接与设备发现；
- 提供 `SerialPort` / `SFSerialPort`；
- 提供：
  - `open()` / `close()`
  - `sendDirective()`
  - `sendDirectiveAsync()`
  - `sendParsed()`
  - sync output timeout 配置
  - read loop 生命周期管理
  - sync directive 状态管理
  - debug capture 输出

必须对齐的行为：

- 发送同步 directive 前清理当前等待态；
- 读取响应时先等待当前 directive echo，再依据 parser EOF 规则切分；
- timeout 时给出尽可能可诊断的信息；
- parse 失败时保留 raw output / parsed output / pending buffer / previous sync output 等上下文。

不允许的简化：

- 不允许只靠单次 `data` 事件就认定读完；
- 不允许把所有 directive 都按同一种 EOF 处理；
- 不允许忽略 stale prompt / old buffer 对解析的影响。

### 6.5 `src/helper.ts`

职责：

- 提供高频便捷封装：
  - `keyTap()`
  - `keyDown()`
  - `keyUp()`
  - `typeText()`
  - `mouseReleaseAll()`
  - `keypadReleaseAll()`
- 对外暴露最小但常用的组合行为。

要求：

- helper 只在 raw `m10` / `kpad` 之上构建；
- 不把 helper 写成与底层协议脱节的独立路径。

### 6.6 `src/controller.ts`

职责：

- 提供更高层的鼠标/键盘行为；
- phase 1 只保留薄层封装；
- phase 2 再决定是否补人类化轨迹、拖拽、分段移动等复杂行为。

要求：

- 不把 Go 当前 controller 当作唯一真相；
- 应优先围绕当前三端交集能力设计对外接口。

### 6.7 `src/server.ts`

职责：

- 在 phase 2 中提供 HTTP server；
- 暴露与现有 Python / Rust / Go server 接近的 API 路由；
- 用于远程触发 directive、录制、回放、文件管理等功能。

### 6.8 `src/cli.ts`

职责：

- 在 phase 2 中提供 HTTP client CLI；
- 命令集优先对齐现有三端已有能力。

### 6.9 `src/converter.ts` 与 `src/file_server.ts`

职责：

- 在 phase 2 中提供本地文件转换与文件服务能力；
- 支持 `aget` / `aput` / `adumj` / `ajson2log` 相关工作流。

## 7. MVP 范围

Node.js 版第一阶段必须包含：

1. `node/` 基础工程脚手架
2. `models.ts`
3. `keycodes.ts`
4. `parser.ts`
5. `sdk.ts`
6. 下列 SDK directive wrappers：
   - `alog`
   - `aplay`
   - `astop`
   - `acancel`
   - `sn`
   - `alive`
   - `aversion`
   - `atime`
   - `ainsp`
   - `list_dir`
   - `clean_dir`
   - `delete_file`
   - `aget`
   - `aput`
   - `adumj`
   - `ajson2log`
   - `join`
   - `wifi_auto`
   - `ahttpbase`
   - `m10`
   - `kpad`
7. 最小 helper 集
8. `examples/m10.ts`
9. `examples/kpad.ts`
10. `examples/directives/*`
11. `README.md` / `README.en.md`
12. `directives.md` / `directives.en.md`

## 8. Phase 2 范围

第二阶段补齐：

- HTTP server
- HTTP client CLI
- converter
- `json2log` / `log2json`
- file server
- 更高层 controller 行为
- 更完整的 examples
- 更多与三端一致性相关的集成测试

## 9. directive 对齐清单

实现时，必须逐项核对以下维度：

- directive 名称
- 参数顺序
- 默认值
- sync / async 发送方式
- 返回值类型
- parser EOF 规则
- 示例命令
- 文档描述
- 已知限制或安全限制

至少需要特别检查：

- `atime`
- `list_dir`
- `ahttpbase`
- `join`
- `wifi_auto`
- `aget`
- `aput`
- `adumj`
- `ajson2log`
- `acancel`

## 10. 键盘与鼠标行为要求

### 10.1 `m10`

Node 版必须支持：

- 相对移动
- 鼠标按键
- 滚轮
- 全释放

MVP 不要求：

- 完整人类化轨迹控制
- 全量鼠标轨迹模拟器

### 10.2 `kpad`

Node 版必须支持：

- key down
- key up
- key tap
- 文本输入
- modifier 组合
- release-all

要求：

- 正确处理大小写；
- 正确处理 `Hello MKP!` 这类包含大小写与标点的输入；
- 正确处理缓存状态，避免连续输入错乱。

## 11. examples 要求

第一阶段必须提供：

- `examples/m10.ts`
  - 演示：鼠标左平移 400，再向上移动 400
- `examples/kpad.ts`
  - 演示：输出 `Hello MKP!`
- `examples/directives/`
  - 与当前共享文档中的主要 directive 对应

要求：

- examples 命名与其他语言尽量保持一致；
- examples 应优先用于行为回归，而不是花哨封装展示。

## 12. 文档要求

Node 版新增后，必须同步补齐：

- `node/README.md`
- `node/README.en.md`
- `node/directives.md`
- `node/directives.en.md`

文档职责边界：

- 共享语义继续维护在仓库根文档；
- `node/` 下文档只写 Node.js 端的使用、实现映射、运行方式、已知差异。

Node 文档至少应包含：

- 安装与 Node 版本要求
- 串口依赖说明
- examples 运行命令
- directive 到 Node API 的映射表
- 已知限制
- phase 1 未覆盖项

## 13. 测试与验证要求

### 13.1 测试层级

至少分三层：

1. **parser 单元测试**
2. **SDK / mock serial 集成测试**
3. **无自动化硬件环境时的手工 examples 验证**

### 13.2 parser 测试必须覆盖

- `atime` line JSON
- `list_dir` JSON blob
- `ahttpbase` query / set 两种模式
- `adumj` 混合输出中的 JSON 抽取
- `ajson2log` 文本输出
- `acancel` raw JSON text
- 超时 / parse failed 的 debug capture 入口

### 13.3 SDK 测试必须覆盖

- sync directive timeout
- async directive send
- stale buffer 对本次 directive 的隔离
- 不同 EOF 标记的切分
- parser 缺失时的错误路径

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

- 初始化 `node/`
- 建立 `package.json`
- 建立 TypeScript 编译配置
- 建立测试脚手架
- 建立 README / directives 补充文档骨架

### Phase 1：模型与 keycodes

- 实现 `models.ts`
- 实现 `keycodes.ts`
- 落定 option / result 类型

### Phase 2：parser

- 实现 parser 基础设施
- 注册全部 MVP directives parser
- 写 parser 回归测试

### Phase 3：SDK 串口层

- 实现 `SerialPort` / `SFSerialPort`
- 实现 read loop
- 实现 sync / async send
- 实现 timeout / debug capture
- 接入 parser

### Phase 4：directive wrappers 与 helper

- 实现全部 MVP wrappers
- 实现 `m10` / `kpad`
- 实现文本输入、release-all 等 helper

### Phase 5：examples 与文档

- 补 `m10` / `kpad`
- 补 directives examples
- 补 README / directives 补充文档

### Phase 6：phase 2 能力

- server
- CLI
- converter
- file server
- 更高层 controller

## 15. 验收标准

Node MVP 视为完成，至少需要满足：

1. `node/` 可独立安装依赖并运行测试。
2. parser 测试覆盖主要易错 directives。
3. SDK 可以稳定发送 sync / async directives。
4. `m10` 与 `kpad` examples 可运行。
5. directives examples 至少覆盖当前共享文档中的主要设备查询、文件管理、网络配置类指令。
6. Node 文档四件套齐全：
   - `README.md`
   - `README.en.md`
   - `directives.md`
   - `directives.en.md`
7. Node 文档明确列出 phase 1 未实现项。

## 16. 风险清单

主要风险：

- 串口同步响应切分不稳定
- 各 directive parser 规则误配
- 键盘状态缓存处理不完整
- Windows 本地路径与设备路径混用
- 过早引入 HTTP / CLI / tools 导致首版范围失控

对应策略：

- 先固化 parser 与 SDK，再做更高层功能；
- 先追求协议行为对齐，再追求接口丰富；
- 通过 mock serial + examples 双路径验证。

## 17. 建议的首批落地任务

如果下一步开始实施，建议先拆成以下任务：

1. 初始化 `node/` 工程骨架。
2. 从三端抽取共享 model / keycode 结构。
3. 完成 parser MVP 与 parser tests。
4. 完成 `sdk.ts` 串口同步读循环。
5. 完成 `m10` / `kpad` / `sn` / `alive` / `atime` / `list_dir` / `ahttpbase`。
6. 跑通 `examples/m10.ts` 与 `examples/kpad.ts`。
7. 再继续补其余 directives wrappers。

## 18. 结论

Node.js 端口应被作为 `mkp-kit` 的正式第四语言实现推进。

实现策略上，优先顺序应为：

- 共享协议行为对齐
- parser 稳定性
- SDK 可用性
- examples 可验证性
- 再逐步上升到 CLI / server / tools

换言之，**先做一个能稳定驱动 MKP 协议的 Node SDK，再做一个“大而全”的 Node 工具链**。
