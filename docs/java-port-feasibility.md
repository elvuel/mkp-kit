# MKP Kit 是否可以继续 port 到 Java（research）

更新日期：2026-11-13

## TL;DR

可以，而且**现在就可以开始**。

从 `mkp-kit` 当前 monorepo 的共享要求看，Java 侧需要覆盖的关键基础能力主要是：

- 串口访问
- 文本 / JSON 解析
- HTTP client
- HTTP server
- file server
- CLI
- 测试

这些能力在当前 Java 生态里都已经有成熟方案：

- 串口：`jSerialComm`
- HTTP client：JDK 自带 `java.net.http.HttpClient`
- HTTP server：JDK 自带 `com.sun.net.httpserver.HttpServer`
- file server：JDK 自带 `SimpleFileServer` 可用于开发调试；正式实现可基于 `HttpServer` 自定义 handler
- JSON：`Jackson`
- CLI：`picocli`
- 测试：`JUnit 5`

结论：**Java 版是可行的，没有明显的协议级阻塞点。**

不过有一个需要提前看清的现实：

- 如果选择 Java 24+ / 25 跑串口，`jSerialComm` 可能需要添加 `--enable-native-access=com.fazecast.jSerialComm` 或 `--enable-native-access=ALL-UNNAMED` 启动参数。

因此我更推荐：

- **实现基线选 Java 21 LTS**
- **兼容验证同时覆盖 Java 25 LTS**

这是基于官方 LTS 路线与 `jSerialComm` 最新文档做出的实现建议，而不是 Java 本身的功能限制。

---

## 1. 先看 `mkp-kit` 当前对新语言端口的实际要求

按当前 monorepo 的结构与维护方式，新的语言端口不是“能发几条串口指令”即可，而是通常要逐步对齐：

- 核心 SDK：串口、parser、typed models、helper / controller
- examples：directive、`m10`、`kpad`、`keys/context` 一类最小可运行样例
- CLI：直连设备的命令行入口
- client：面向 HTTP API server 的管理客户端
- server：HTTP API server
- file server：文件上传 / 下载 / 列目录
- converter：`.log <-> .json`

这意味着 Java 端口本质上要解决的是：

1. 串口 I/O
2. 文本 / JSON 解析
3. HTTP client / server
4. 文件收发与目录暴露
5. CLI 组织
6. 测试与长期维护

这些事情在 Java 生态里都是常规问题，而不是冷门问题。

---

## 2. 为什么说 Java 现在已经具备可行性

### 2.1 串口：`jSerialComm` 仍然是成熟可用的主力方案

`jSerialComm` 官方 wiki 把它定义为：

- 平台无关的串口访问库
- 不需要额外外部库、原生代码编写或其他额外工具
- 可从 Maven Central / Gradle / Maven 直接引入

同时官方文档也明确给出：

- 可以直接枚举可用串口 `SerialPort.getCommPorts()`
- 支持 Java 的 `InputStream` / `OutputStream` 读写模式
- Java 24 及之后，若应用调用 native code，可能需要额外的 `--enable-native-access` 启动参数

这基本可以覆盖 `mkp-kit` 在 Java 版最核心的串口读写需求。

来源：

- `jSerialComm` wiki Home
- `jSerialComm` Installation
- `jSerialComm` Library Features
- `jSerialComm` README

### 2.2 HTTP client：JDK 自带 `HttpClient`

Oracle 的 Java SE 25 API 文档明确说明：

- `HttpClient` 用于发送请求并获取响应
- 通过 builder 创建实例
- client 实例是不可变的，可复用连接池
- 既支持同步 `send(...)`，也支持异步 `sendAsync(...)`

这对 Java 版的这些表面已经足够：

- `mkp-client`
- `aget` / `aput` 对 file server 的 HTTP 访问
- 未来可能的管理 API / 健康检查 / 测试辅助客户端

来源：

- Java SE 25 `HttpClient` API

### 2.3 HTTP server：JDK 自带 `HttpServer`

Oracle 的 Java SE 25 API 文档明确说明：

- `HttpServer` 是一个简单 HTTP server
- 它绑定 IP 地址和端口监听 TCP 连接
- 通过 `HttpHandler` 处理请求
- 可以通过 `Executor` 管理线程

对 `mkp-kit` 来说，这已经足够支撑：

- `version`
- `auth/token`
- `records CRUD`
- `replay status`
- `alog/astop/acancel/aplay`
- 以及基础 directive 代理接口

也就是说，Java 版不需要一开始就依赖 Spring Boot 这类更重的框架，单用 JDK 自带 server 就能起步。

来源：

- Java SE 25 `HttpServer` API

### 2.4 file server：JDK 自带 `SimpleFileServer` 能做开发基线

Oracle 的 Java SE 25 API 文档明确说明：

- `SimpleFileServer` 是一个简单 HTTP 文件服务器
- ** intended for testing, development and debugging purposes only **
- 它能提供文件、目录列表
- 只内建支持 `HEAD` / `GET`
- 但可以和其他 handler 组合来处理 `PUT`

这意味着：

- Java 版 file server 的“开发 / 调试”基线几乎零门槛
- 正式实现如果要对齐 `mkp-kit` 现有 file server 的 `PUT` / 上传 / 目录列举等行为，建议直接基于 `HttpServer` 自定义 handler，而不是把 `SimpleFileServer` 当成最终形态

来源：

- Java SE 25 `SimpleFileServer` API

### 2.5 JSON：Jackson 依然是主流稳妥选择

Jackson 官方 README 明确说明：

- Jackson 是 Java / JVM 平台的 JSON 数据处理工具套件
- 包含 streaming parser / generator、data binding、以及多种数据格式扩展
- Jackson 3.x 是较新的主线，并且 **recommended for new projects**
- 2.x 仍被广泛采用，但 3.x 是更合适的新项目起点

对 `mkp-kit` 而言，Jackson 能覆盖：

- typed model 映射
- parser fixture 测试
- converter 的 JSON 读写
- server / client 的 JSON 请求响应

来源：

- Jackson Project README

### 2.6 CLI：picocli 非常适合 `mkp-cli` / `mkp-client`

picocli 官方 Quick Guide 说明：

- 它是一个轻量级 Java CLI framework
- 支持 POSIX / GNU / MS-DOS 风格命令行语法
- 可自动生成 usage help
- 支持嵌套 subcommands
- 也支持注解式和编程式 API

这和 `mkp-kit` 现有 CLI / client 的结构非常匹配，因为它们本身就是：

- 多子命令
- 混合 flags + positional args
- 需要一致的 help / usage 输出

来源：

- picocli Quick Guide
- picocli homepage

### 2.7 测试：JUnit 5 足够承担 SDK / parser / server / CLI 回归

JUnit 5 官方 User Guide 明确说明：

- JUnit 5 = Platform + Jupiter + Vintage
- 它既覆盖写测试，也覆盖测试执行基础设施
- 有 Console Launcher 与可扩展平台层

这足够承接：

- parser fixture regression
- converter regression
- CLI / client 参数解析测试
- server route / auth / replay 状态测试

来源：

- JUnit 5 User Guide

---

## 3. Java 版本怎么选更合适

Oracle 的 Java SE Support Roadmap 当前显示：

- Java 21 是 LTS，GA 于 2023-09，Premier Support 到 2028-09
- Java 25 是 LTS，GA 于 2025-09，Premier Support 到 2030-09
- Java 8、11、17、21、25 都属于 LTS 版本

与此同时，`jSerialComm` 官方文档又明确说：

- 从 Java 24 开始，调用 native code 可能需要 `--enable-native-access=...`

因此我建议：

- **开发与实现基线：Java 21 LTS**
- **兼容验证目标：Java 25 LTS**

这里的判断是一个工程建议：

- 选 Java 21 LTS，可以避开 Java 24+ 的 native access 新门槛，降低串口接入摩擦
- 同时尽早在 Java 25 上验证，确保未来升级路径明确

来源：

- Oracle Java SE Support Roadmap
- `jSerialComm` README / Installation

---

## 4. 对 `mkp-kit` 而言，Java 端口建议怎么拆

建议直接以 monorepo 子目录来做：

```text
java/
  pom.xml or build.gradle.kts
  src/
    main/
      java/
        io/elvuel/mkp/java/
          serial/
          parser/
          model/
          helper/
          controller/
          cli/
          client/
          server/
          fileserver/
          converter/
    test/
      java/
  examples/
```

如果按 `mkp-kit` 当前的语言组织去对齐，我建议最小拆分为：

- `java/src/main/java/.../core`：核心 SDK
- `java/src/main/java/.../cli`：直连设备 CLI
- `java/src/main/java/.../client`：HTTP API client
- `java/src/main/java/.../server`：HTTP API server
- `java/src/main/java/.../fileserver`：file server
- `java/src/main/java/.../converter`：`.log <-> .json`
- `java/examples/`：示例

---

## 5. 推荐技术基线

### 5.1 最稳妥的首选组合

- Java：`21 LTS`
- 构建：`Gradle Kotlin DSL` 或 `Maven`
- 串口：`jSerialComm`
- JSON：`Jackson 3.x`
- CLI：`picocli`
- HTTP client：JDK `HttpClient`
- HTTP server：JDK `HttpServer`
- 测试：`JUnit 5`

### 5.2 为什么我不建议第一版就上更重的 Web 框架

不是因为 Spring Boot 不行，而是因为当前 `mkp-kit` server 的职责很窄：

- auth
- directive proxy
- records CRUD
- replay status
- 少量配置加载

这类需求用 JDK 自带的 `HttpServer` 已经能覆盖。第一版先把：

- 串口稳定性
- parser 对齐
- converter 对齐
- 关键 route 语义对齐

跑通，收益会比一开始上大框架更高。

---

## 6. 真实风险点不在“能不能做”，而在“哪些地方最容易踩坑”

### 6.1 最大风险仍然是串口层，而不是 Web 层

Java 版最该尽早验证的不是 HTTP server，而是：

- 串口 open / close 生命周期
- 同步读循环
- EOF / `cli>` prompt 裁剪
- `atime` / `ainsp` 这类带噪声 line-JSON 的提取
- `list_dir` / `ahttpbase` 这类结构化 JSON 的稳态解析

`jSerialComm` 能力本身足够，但 Java 24+ 还要考虑 native-access 启动参数，这说明串口层仍然是第一优先级验证对象。

### 6.2 file server 最终实现不要直接停留在 `SimpleFileServer`

因为官方文档已经明确写了：

- 它主要面向 testing / development / debugging
- 内建只支持 `HEAD` / `GET`

所以如果你要和 `mkp-kit` 现有 file server 对齐，最终还是应该：

- 用 `HttpServer` 写自己的 handler
- 明确实现 `PUT` / multipart / list / path traversal protection

### 6.3 JSON 选型应尽早定死

Java 标准库没有像 .NET `System.Text.Json` 那样的等价默认 JSON 栈，因此第一天就要定：

- parser fixture
- server DTO
- client DTO
- converter JSON envelope

全部统一走 Jackson，避免后面混用多套 JSON API。

---

## 7. 推荐启动顺序

### 第一阶段：先做核心 SDK

建议先打通：

- 串口 transport
- parser registry
- typed models
- `sendDirective` / `sendParsed`
- `sn` / `alive` / `aversion`
- `list_dir` / `atime` / `ainsp` / `ahttpbase`
- `m10` / `kpad`

这是最能验证“Java 版到底稳不稳”的一层。

### 第二阶段：补 examples / CLI / converter

再补：

- `examples/directives`
- `m10` / `kpad` 示例
- `keys/context` 示例
- `mkp-cli`
- `.log <-> .json` converter

### 第三阶段：补 server / client / file server

最后补：

- `mkp-server`
- `mkp-client`
- `mkp-file-server`
- JWT / CORS / config-file
- records 持久化与 replay 管理

---

## 8. 最终判断

### 结论

**现在可以 port 到 Java。**

### 推荐实现路线

- 目标语言：Java
- 实现基线：Java 21 LTS
- 兼容验证：Java 25 LTS
- 串口：jSerialComm
- JSON：Jackson 3.x
- CLI：picocli
- HTTP client / server：优先使用 JDK 自带能力

### 一句话建议

如果你准备把 `mkp-kit` 再扩展一个 Java 版本，**现在完全值得开始**；但第一周的重点不应该是 server 或 docs，而应该是：

1. 串口读写稳定性
2. parser 对齐
3. `sn` / `list_dir` / `atime` / `ahttpbase` 这类代表性 directive 的真机验证

这三件事一旦跑通，Java 版的 CLI / client / server / converter 基本就只是工程实现问题了。

---

## 参考资料

- Oracle Java SE Support Roadmap  
  <https://www.oracle.com/java/technologies/java-se-support-roadmap.html>
- Java SE 25 `HttpClient` API  
  <https://docs.oracle.com/en/java/javase/25/docs/api/java.net.http/java/net/http/HttpClient.html>
- Java SE 25 `HttpServer` API  
  <https://docs.oracle.com/en/java/javase/25/docs/api/jdk.httpserver/com/sun/net/httpserver/HttpServer.html>
- Java SE 25 `SimpleFileServer` API  
  <https://docs.oracle.com/en/java/javase/25/docs/api/jdk.httpserver/com/sun/net/httpserver/SimpleFileServer.html>
- `jSerialComm` wiki Home  
  <https://github.com/Fazecast/jSerialComm/wiki>
- `jSerialComm` Installation  
  <https://github.com/Fazecast/jSerialComm/wiki/Installation>
- `jSerialComm` README  
  <https://github.com/Fazecast/jSerialComm/blob/master/README.md>
- `jSerialComm` Library Features  
  <https://github.com/Fazecast/jSerialComm/wiki/Library-Features>
- Jackson Project README  
  <https://github.com/FasterXML/jackson/blob/main/README.md>
- picocli Quick Guide  
  <https://picocli.info/quick-guide.html>
- picocli homepage  
  <https://picocli.info/>
- JUnit 5 User Guide  
  <https://docs.junit.org/5.13.1/user-guide/index.html>

