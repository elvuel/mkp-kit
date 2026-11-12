# C / C++ Port Feasibility Research

日期：2026-11-12

## 结论

可以 port 到 C / C++，但**更建议先做 C++ 版本，而不是纯 C 版本**。

原因不是“能不能做”，而是“做到什么程度、成本多高、后续维护是否划算”：

- 如果目标只是**串口 SDK 核心**（directive 发送、parser、`m10` / `kpad`、基础 helper），那么 **C 和 C++ 都可行**。
- 如果目标是对齐当前 monorepo 已经逐步形成的更完整表面（SDK + controller + examples + converter + file server + HTTP server/client + JWT/CORS/config-file），那么 **C++ 明显更合适**。
- 纯 C 也能实现，但在以下方面会显著吃亏：
  - JSON 到强类型模型映射
  - controller / helper 层抽象表达
  - HTTP server/client 组织
  - RAII 风格资源管理（串口、socket、db、线程、文件）
  - 测试与后续多平台维护成本

因此，当前阶段最合理的判断是：

1. **可以开始 port 到 C/C++**
2. **首选 C++17 / C++20 版本**
3. **若要纯 C，建议只做 core SDK / parser / minimal CLI，不建议一开始追求和 Python / Rust / Node 完整对齐**

## 当前 `mkp-kit` 对新语言端口的真实目标面

从仓库现状看，新的语言端口不只是“能发几条串口指令”即可，而是至少要面对以下共享表面：

- 串口连接、发送 directive、同步 / 异步解析
- `m10` / `kpad` 鼠标键盘控制
- `alog` / `astop` / `acancel` / `aplay` 录制回放
- `list_dir` / `delete_file` / `clean_dir` / `aget` / `aput` / `ajson2log` 文件与转换
- `sn` / `alive` / `aversion` / `atime` / `ainsp` 结构化返回
- `join` / `wifi_auto` / `ahttpbase` 网络配置

仓库根文档已经把这些能力当作**跨语言共享契约**维护，而不仅是单一语言内部实现。

另外，现状也已经不只剩 Go / Python / Rust；`node/` 目录也已经具备独立 SDK / CLI / server / examples / docs。对于 C/C++ 端口，这意味着对齐目标实际上比早期更高。

## 为什么更推荐 C++ 而不是纯 C

### 1. 串口层

C 和 C++ 都能做。

- **C 路线**：`libserialport` 是跨平台 C 串口库，支持 Windows / Linux / macOS / Android，但它是 **LGPL-3.0-or-later**。这在“作为 SDK 内嵌依赖”时，需要先确认你的分发与链接策略是否接受该许可证。官方也明确说明它是跨平台、最小化的 C 串口库。 
- **C++ 路线**：`Boost.Asio` 官方文档直接包含 `serial_port`，并说明 Windows 的 `COMx` 与 POSIX 串口都可支持；它非常适合统一串口 I/O、超时控制和后续事件循环。 

对 `mkp-kit` 来说，串口只是第一层；后面还有 parser、超时、组合控制器、HTTP server/client。因此，**用 C++ 把串口 I/O 纳入统一异步 / 同步抽象会更顺手**。

### 2. JSON / parser / 返回模型

当前 `mkp-kit` 很多 directive 的关键价值在于：

- 把设备返回的 JSON / line-JSON / text
- 稳定解析为语言端的结构化模型

C++ 在这里优势很明显：

- `nlohmann/json` 是成熟的 Modern C++ JSON 库，官方文档说明它可以单头文件集成，也支持包管理 / CMake 集成。 
- 这类库很适合把 `SN`、`Heartbeat`、`MKPVersion`、`LogLength`、`LogInfo`、`FileSystem`、`ActionDump` 之类模型统一建模。 

纯 C 当然也能用 `cJSON`，但会回到：

- 手工字段校验
- 手工内存释放
- 手工错误传播
- 很多结构体 / builder / parser 样板代码

如果只做 core parser，这还可以接受；但如果要扩展到 helper / controller / server / client，就会明显拖慢开发节奏。

### 3. HTTP server / client / file server

当前 Node / Python / Rust 实现已经说明：一个完整语言端口通常还要承接：

- `mkp-server`
- `mkp-client`
- `mkp-file-server`
- converter / json2log / log2json
- JWT / CORS / config-file

这部分是纯 C 和 C++ 分水岭最明显的地方：

- **C++ 路线**：
  - `cpp-httplib` 官方仓库说明它是 header-only 的 HTTP/HTTPS server + client 库，跨平台、易集成，但它是 **blocking I/O**，只支持 **HTTP/1.1**。如果只是实现类似当前 `mkp-server` / `mkp-client` 这种中小规模本地控制面，这通常足够。 
  - 如果你更希望偏“嵌入式 web server”风格，`CivetWeb` 官方说明它是 MIT 许可的可嵌入 C/C++ web server，并且也可作为库加入已有应用。 
- **纯 C 路线**：
  - `CivetWeb` 其实更像纯 C 最稳妥的选择之一，因为它本身就是 C API。官方嵌入文档也直接建议新代码优先用它的 C 接口。 
  - `Mongoose` 也是成熟的 C/C++ 嵌入式网络库，但如果目标主要是对齐当前桌面 SDK / CLI / 本地服务形态，`CivetWeb` 往往比“偏嵌入式联网平台”的路线更贴近你现在的 monorepo 用例。 

综合看：**如果要做完整 server/client/file-server，对 C++ 更友好；如果只做 C 版，也建议 HTTP 层尽量最小化**。

### 4. JWT / config-file / SQLite

- **JWT**：
  - C++ 可直接选 `jwt-cpp`，官方说明它是 header-only，并支持 OpenSSL / LibreSSL / wolfSSL。 
  - C 侧也能做，`libjwt` 是成熟选择，但这会再引入 C 风格 JSON / crypto / 资源管理复杂度。 
- **SQLite**：
  - SQLite 官方明确说明它本身就是 C 语言库，小、快、自包含、可靠，而且 C/C++ 接口天然可用。它非常适合对齐当前 monorepo 里的 record 持久化能力。 
  - 这意味着不管做 C 还是 C++，**SQLite 都几乎是“最容易对齐”的一块**。 
- **config-file**：
  - C++ 可直接沿用 JSON config；借助 `nlohmann/json` 成本很低。 
  - 纯 C 也能做，但配置结构体映射和校验会更啰嗦。

## 推荐技术路线

### 路线 A：**C++17 / C++20 版本（推荐）**

推荐度：**高**

建议组合：

- 串口：`Boost.Asio serial_port`
- JSON：`nlohmann/json`
- HTTP server/client：
  - 优先 `cpp-httplib`（上手快，适合当前规模）
  - 或 `CivetWeb`（如果你更重视嵌入式 server / C API 可回退）
- JWT：`jwt-cpp`
- DB：`sqlite3`
- 构建：`CMake` + `FetchContent` / vendor 第三方依赖

这个组合最接近当前 monorepo 的“完整语言实现”节奏：

- 可较自然地表达 `SerialPort` / `Controller` / `ServerApp` / `ClientConfig`
- 可较容易复刻 Node / Rust 的 parser 注册表、返回模型和 CLI 帮助风格
- 可较平滑对齐 converter / file server / records persistence

### 路线 B：**纯 C 版本（只推荐做 core SDK）**

推荐度：**中**

建议组合：

- 串口：`libserialport`
- JSON：`cJSON`
- HTTP server/file server：`CivetWeb`
- JWT：`libjwt`
- DB：`sqlite3`
- 构建：`CMake`

但建议把 scope 严格限制为：

- 串口对象 / 发送 API
- parser 注册与结构化读取
- `m10` / `kpad`
- 常见 directive helper
- minimal CLI

不建议首发就追完整 parity：

- `mkp-server`
- `mkp-client`
- 高层 controller
- converter / file server 全量工具
- 复杂 records persistence 和 replay state 管理

否则，项目会很快变成“C 语言工程管理练习”，而不是高效地增加一个可维护 SDK 端口。

## 推荐的落地顺序

### 方案 1：先做 `cpp/`（最推荐）

建议目录：`cpp/`

阶段建议：

1. **Phase 1 — Core SDK**
   - `SerialPort`
   - parser registry
   - models / option structs
   - `sn` / `alive` / `aversion` / `atime` / `ainsp` / `list_dir`
   - `m10` / `kpad`
   - examples

2. **Phase 2 — Helper / Controller**
   - `keyTap` / `keyDown` / `keyUp` / `typeText`
   - `mouseMove` / segmented move
   - record / replay helpers

3. **Phase 3 — Tools**
   - converter
   - log2json / json2log
   - file server

4. **Phase 4 — HTTP layer**
   - `mkp-server`
   - `mkp-client`
   - JWT / CORS / config-file
   - SQLite records persistence

### 方案 2：先做 `c/` 最小实现，再评估是否上 `cpp/`

只有在你明确想要：

- 更低依赖
- 更靠近嵌入式 C 生态
- 更容易被其它语言 FFI 调用

时，才建议先做纯 C。

但这种方案应把目标写死为 **minimal SDK**，否则 scope 会失控。

## 主要风险

### 1. 许可证风险

- `libserialport` 是 LGPL-3.0-or-later。若你要把它作为 SDK 内嵌依赖，需要提前确认这是否符合你的分发策略。 
- `CivetWeb`、`cpp-httplib`、`jwt-cpp`、`nlohmann/json` 这类路线整体更容易维持宽松许可证组合。 

### 2. 纯 C 维护成本风险

纯 C 不是“做不到”，而是：

- 样板代码会多很多
- JSON -> 结构体的健壮性更难保持
- 高层 controller 与 HTTP client/server 的可读性会更快恶化

### 3. 与 monorepo 契约的对齐风险

`mkp-kit` 当前已经把 feature parity / doc parity / bug-fix parity 视为 repo-level concern。新语言端口一旦进入 monorepo，就不是“做几个 demo 即可”，而会被自然拉向：

- parser 行为一致
- examples 覆盖一致
- 文档描述一致
- bug 修复同步

这对纯 C 端口会更重，对 C++ 端口则更可控。

## 结论建议

如果你问的是：

> “现在是否可以 port 到 C/C++？”

答案是：**可以。**

如果你问的是：

> “现在最值得开始的是哪条路线？”

答案是：

- **首选：C++17 / C++20 版本**
- **纯 C：只建议做 minimal core SDK，不建议首发追完整 parity**

如果后续要继续推进，我建议下一步直接写：

1. `docs/cpp-implement-spec.md`
2. 明确 `cpp/` 首发 scope 只到 **Core SDK + examples**
3. 等 Core SDK 跑通后，再决定是否补 server / client / converter / file server

## 参考来源（官方 / 主项目）

以下为本次判断主要依赖的官方或主项目资料：

- Boost.Asio Serial Ports（boost.org）
- JSON for Modern C++ / nlohmann/json（json.nlohmann.me / GitHub）
- cpp-httplib（GitHub）
- CivetWeb 与其 Embedding 文档（GitHub / GitHub Pages）
- SQLite 官方主页与特性说明（sqlite.org）
- jwt-cpp（GitHub）
- libserialport（sigrok.org）
- libjwt（GitHub）
- CMake FetchContent 文档（cmake.org）
