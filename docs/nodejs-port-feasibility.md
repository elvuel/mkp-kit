# MKP Kit 是否可以继续 port 到 Node.js（research）

更新日期：2026-11-12

## TL;DR

可以，而且**现在比一开始更适合做 Node.js 端口**。

原因不是“Node.js 天生更容易”，而是 `mkp-kit` 现在已经具备了做第四种语言端口所需的三个前提：

1. **共享协议面已明确**：根文档已经把跨语言共享能力和 directive 语义固定下来。
2. **已有三份参考实现**：Go / Python / Rust 已经覆盖串口、parser、typed wrappers、examples，以及部分 CLI / server / converter / file-server。
3. **Node.js 生态已具备直接可用的一手能力**：串口、流式分包、HTTP、文件系统、测试替身都已有成熟官方/一手文档支撑。

结论：**完全可以开始做 Node.js 版本**；建议以 **Node.js runtime + TypeScript** 为主线，先做 SDK / parser / examples，再逐步补 CLI、converter、file-server、HTTP server。

---

## 1. 现有 monorepo 是否已经具备 Node.js port 的输入条件？

是。

### 1.1 共享能力面已经清楚

根文档已经把共享能力收敛到这些类别：

- 串口连接
- 鼠标控制 `m10`
- 键盘控制 `kpad`
- 录制 / 回放
- 文件管理
- 设备信息
- 网络配置

本地证据：

- `README.en.md`
- `directives.en.md`
- `AGENTS.md`

这意味着 Node.js 版不需要重新“发明协议”，而是直接对齐现有共享语义即可。

### 1.2 三份现有实现已经把“要 port 什么”说明白了

当前三种实现都已经覆盖核心 SDK 层：

- Go：`go/sf_serial_port.go`、`go/directive_parser.go`、`go/helper/helper.go`、`go/controller/controller.go`
- Python：`python/src/mkp_python/sdk.py`、`python/src/mkp_python/parser.py`、`python/src/mkp_python/models.py`
- Rust：`rust/src/sdk.rs`、`rust/src/parser.rs`、`rust/src/models.rs`

此外，monorepo 里已经有 examples、CLI / server、converter、file-server 这些更高层的落点：

- Go：`go/cmd/`、`go/tools/`
- Python：`python/src/mkp_python/cli.py`、`python/src/mkp_python/server.py`、`python/src/mkp_python/converter.py`、`python/src/mkp_python/file_server.py`
- Rust：`rust/src/bin/`

这对 Node.js 版非常关键，因为它说明 Node.js 不是从 0 到 1，而是从 **3 份稳定参考实现中提炼一份新的语言适配层**。

---

## 2. Node.js 生态是否足以承接这个 port？

是，且没有明显技术阻塞。

### 2.1 串口能力是现成的

Node SerialPort 官方文档明确说明：

- `serialport` 是用于 Node.js / Electron 的串口库；
- 它提供默认的 Node stream API；
- 它带有跨平台 bindings；
- 它同时提供 mock binding 以便测试。  

来源：

- Node SerialPort About：<https://serialport.io/docs/>
- Node SerialPort API：<https://serialport.io/docs/api-serialport/>
- Node SerialPort Testing：<https://serialport.io/docs/guide-testing/>

这基本一一对应了 MKP SDK 的底层需求：

- 打开/关闭串口
- 读写字节流
- 按 directive 发送命令
- 在无硬件时做测试替身

### 2.2 输出切分/分包能力也是现成的

MKP 的难点之一不是“能不能读串口”，而是“能不能按当前 directive 正确切出一段完整回复”。

SerialPort 官方 parser 文档表明：

- SerialPort 的 parsers 通常是 Transform streams；
- 可以按 delimiter 切分消息；
- `@serialport/parser-delimiter` 与 `ReadlineParser` 都可直接使用。  

来源：

- Parsers overview：<https://serialport.io/docs/api-parsers-overview/>
- Delimiter parser：<https://serialport.io/docs/api-parser-delimiter/>
- Readline parser：<https://serialport.io/docs/next/api-parser-readline/>

不过，**Node.js 版不能只依赖一个通用分隔 parser 就结束**。原因是当前 MKP 三种实现都在做更细的事：

- 按 directive 选择 `cli>` 或 `<EOF>` 作为完成标记；
- 先等到当前 directive echo 出现，再截取本次响应；
- 清理串口噪声 / stale prompt；
- 从混合文本里抽出 JSON blob；
- 记录 timeout / parse_failed 的 debug capture。

本地证据：

- `python/src/mkp_python/parser.py`
- `python/src/mkp_python/sdk.py`
- `rust/src/parser.rs`
- `rust/src/sdk.rs`
- `go/directive_parser.go`
- `go/sf_serial_port.go`
- `go/serial_port_base.go`

因此，Node.js 在“串口可用性”上没有问题，但在“MKP 特有同步读循环与解析策略”上仍然需要认真移植。

### 2.3 HTTP / file server / 本地文件工具没有生态阻塞

Node.js 官方文档已经提供：

- `node:http` 可直接 `createServer()`；
- `node:fs/promises` 提供异步文件系统 API；
- `node:path` 提供路径工具，但会因 Windows / POSIX 不同而表现不同。  

来源：

- HTTP：<https://nodejs.org/api/http.html>
- FS：<https://nodejs.org/api/fs.html>
- Path：<https://nodejs.org/api/path.html>

因此：

- 简单 file-server 不需要引入重量级 web 框架；
- converter / json2log / log2json 这类本地工具可以直接使用内建模块完成；
- 但**Windows 本地路径**与**设备端 `/eMMC/...` 路径**一定要显式区分，不要混用 `path` 语义。

### 2.4 测试能力也足够

Node.js 官方测试运行器已经稳定可用，且 SerialPort 官方提供 `MockBinding`。  

来源：

- Node test runner：<https://nodejs.org/api/test.html>
- SerialPort mock binding：<https://serialport.io/docs/api-binding-mock/>

这意味着 Node.js 版可以较低成本地补两层测试：

1. **纯 parser / helper 单元测试**
2. **mock serial port 集成测试**

这比纯硬件回归更适合持续维护。

---

## 3. 现在做 Node.js port，建议做到什么范围？

建议分两层理解：

### 3.1 最小可行版本（推荐先做）

第一阶段建议只做这些：

- `SerialPort` / `SFSerialPort` 封装
- sync / async directive send
- parser registry
- `send_parsed()`
- `m10` / `kpad`
- 当前共享文档里列出的 directive wrappers：
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
- examples：
  - `m10`
  - `kpad`
  - directives examples

这个范围已经足够形成“Node.js 可用 SDK”。

### 3.2 第二阶段再补的高层能力

第二阶段再补：

- helper（文本输入、组合键等）
- controller（更高层鼠标移动/拖拽/人类化轨迹）
- CLI
- file server
- converter / json2log / log2json
- HTTP server / API

原因很简单：这些能力依赖更多本地 I/O 与工程组织，但它们并不阻塞 Node.js 版首先变成“可连接设备并完整覆盖 directive”的 SDK。

---

## 4. 真正的难点会在哪里？

### 4.1 最大难点不是串口库，而是同步响应模型

这是最重要的结论。

从 Python / Rust / Go 当前实现看，最近已经形成一个共同模式：

- 后台读线程/循环持续读串口；
- 发送同步 directive 前先重置/登记当前等待态；
- 收到数据后，不是简单按行返回，而是**结合当前 directive 和 EOF 规则**来截取；
- timeout / parse error 时落 debug 信息，帮助定位“没看到 echo”、“看到了 echo 但没看到 EOF”、“JSON blob 没抽出来”等情况。

这套机制在 Node.js 里必须原样建模，不能只写成“发一个命令，读一次 data event”。

### 4.2 `ahttpbase` / `atime` / `list_dir` 这类历史易错点要优先验证

从现有 Python / Rust parser 设计可以看出，这几类指令并不总是“标准 JSON 块直接返回”：

- 有时要从混合输出里提 JSON；
- 有时是 line JSON；
- 有时 query / set 两种模式的输出不一样；
- 有时 EOF 走 `cli>` 而不是 `<EOF>`。

本地证据：

- `python/src/mkp_python/parser.py`
- `rust/src/parser.rs`
- `go/directive_parser.go`

Node.js 版应优先用这些指令做 parser 回归样本。

### 4.3 安装层面仍然有一个现实约束：`serialport` 带 native bindings

这不是 blocker，但要在计划里写清楚：

- `serialport` 当前文档说明支持当前 Node LTS / Active / Maintenance 版本；
- 文档也说明在标准平台通常直接 `npm install serialport` 即可；
- 在不被预编译覆盖的平台上，安装时可能需要本地编译环境；
- 当前 monorepo 用户如果主要在 Windows x64 上开发，落地风险相对较低。  

来源：

- Supported environments：<https://serialport.io/docs/guide-platform-support/>
- Installation：<https://serialport.io/docs/guide-installation/>
- serialport monorepo package.json（当前爬取结果显示 `engines.node >= 20.0.0`）：<https://github.com/serialport/node-serialport/blob/main/package.json>

因此建议把 Node.js 版的最低版本直接定在 **Node 20+**。

---

## 5. 推荐的 Node.js 目录结构

建议直接按 monorepo 现有语言布局新增：

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
    file_server.ts
    converter.ts
    cli.ts
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
    directives/
      alog.ts
      ...
  test/
    parser.test.ts
    sdk.test.ts
    helper.test.ts
    server.test.ts
```

其中：

- `src/sdk.ts` 对齐 `python/src/mkp_python/sdk.py` / `rust/src/sdk.rs`
- `src/parser.ts` 对齐 `python/src/mkp_python/parser.py` / `rust/src/parser.rs` / `go/directive_parser.go`
- `src/models.ts` 对齐三端 typed wrappers
- `src/helper.ts` / `src/controller.ts` 放高层行为
- `src/bin/` 对齐 Rust 的二进制布局，比较适合 Node/TS 多入口工具

---

## 6. 推荐实施顺序

### Phase 0：仓库脚手架

- 新建 `node/`
- 选定 TypeScript
- 约定最低版本 Node 20+
- 先补 README / directives supplement 骨架

### Phase 1：底层串口与 parser

- `sdk.ts`
- `parser.ts`
- typed models
- `sendDirective()` / `sendDirectiveAsync()` / `sendParsed()`
- debug capture

### Phase 2：共享 directive 全覆盖

- 先做最容易稳定的 JSON / text directives
- 再重点验证：`atime`、`list_dir`、`ahttpbase`、`adumj`、`ajson2log`

### Phase 3：examples 与测试

- `m10`
- `kpad`
- directives examples
- parser tests
- mock serial tests

### Phase 4：helper / controller

- 键盘文本输入
- 鼠标高层轨迹
- 与 `m10`/`kpad` 组合的高层封装

### Phase 5：CLI / file-server / converter / HTTP

- CLI
- file-server
- converter
- server/API

---

## 7. 最终判断

**结论：可以 port 到 Node.js，而且建议现在就可以开始。**

更具体地说：

- **协议层面**：没有阻塞，现有 monorepo 已经把共享语义整理好了。
- **运行时层面**：没有阻塞，Node.js + `serialport` + 内建 `http/fs/path` 足以承接。
- **工程层面**：有风险，但主要集中在“同步读取/解析模型的精确复刻”，不是生态缺失。
- **维护层面**：Node.js 版若按 monorepo 规则建设，也能并入当前跨语言一致性维护方式。

我的建议不是“先做 CLI/server”，而是：

1. 先做 `node/` SDK 核心与 parser。
2. 先跑通 `m10`、`kpad`、共享 directives examples。
3. 通过 mock binding + parser 测试把同步读循环稳定下来。
4. 再扩到 CLI / converter / file-server / HTTP。

如果后续要正式开工，Node.js 版应优先以 **TypeScript SDK** 的形式启动，而不是直接从“一个大 CLI 工程”切入。

---

## 一手来源

### 本地仓库证据

- `AGENTS.md`
- `README.en.md`
- `directives.en.md`
- `go/sf_serial_port.go`
- `go/directive_parser.go`
- `go/serial_port_base.go`
- `go/helper/helper.go`
- `go/controller/controller.go`
- `python/src/mkp_python/sdk.py`
- `python/src/mkp_python/parser.py`
- `python/src/mkp_python/models.py`
- `python/src/mkp_python/cli.py`
- `python/src/mkp_python/server.py`
- `python/src/mkp_python/converter.py`
- `python/src/mkp_python/file_server.py`
- `rust/src/sdk.rs`
- `rust/src/parser.rs`
- `rust/src/models.rs`
- `rust/src/bin/`

### 外部一手资料

- Node SerialPort About: <https://serialport.io/docs/>
- Node SerialPort API: <https://serialport.io/docs/api-serialport/>
- Node SerialPort Parsers Overview: <https://serialport.io/docs/api-parsers-overview/>
- Node SerialPort Delimiter Parser: <https://serialport.io/docs/api-parser-delimiter/>
- Node SerialPort Readline Parser: <https://serialport.io/docs/next/api-parser-readline/>
- Node SerialPort Testing / MockBinding: <https://serialport.io/docs/guide-testing/>
- Node SerialPort Supported Environments: <https://serialport.io/docs/guide-platform-support/>
- Node SerialPort Installation: <https://serialport.io/docs/guide-installation/>
- serialport monorepo package.json: <https://github.com/serialport/node-serialport/blob/main/package.json>
- Node.js `http`: <https://nodejs.org/api/http.html>
- Node.js `fs`: <https://nodejs.org/api/fs.html>
- Node.js `path`: <https://nodejs.org/api/path.html>
- Node.js `timers/promises`: <https://nodejs.org/api/timers.html>
- Node.js `node:test`: <https://nodejs.org/api/test.html>
