# MKP 共享指令说明

[English](./directives.en.md) | 中文 | [共享总览](./README.md)

---

## 目录

- [文档定位](#文档定位)
- [共享约定](#共享约定)
- [共享指令总览](#共享指令总览)
- [同步与异步规则](#同步与异步规则)
- [录制与回放指令](#录制与回放指令)
- [设备网络与文件系统指令](#设备网络与文件系统指令)
- [鼠标指令m10](#鼠标指令m10)
- [键盘指令kpad](#键盘指令kpad)
- [语言补充文档](#语言补充文档)

## 文档定位

本文档维护 **跨 Go / Python / Rust / Node.js / C++ / .NET 共享的 MKP directive 语义**。

它描述的是：

- directive 的用途
- 典型参数含义
- 同步 / 异步的契约层规则
- 设备侧输出的共享预期
- `m10` / `kpad` 的协议层语义

它**不负责**描述语言特有的：

- import / package / crate 名称
- helper / controller 的具体函数名
- parser 注册实现细节
- HTTP / CLI 的语言端路由或命令包装
- 某一语言端的已知限制

这些内容请看各语言补充文档。

## 共享约定

- 除特别说明外，所有 MKP CLI directive 发送时都以设备协议要求的换行结尾。
- 同一条 directive 在七个语言端应尽量保持一致的默认行为、成功语义和失败语义。
- 如果某语言存在未对齐行为，应在该语言补充文档中显式标注，而不是隐式漂移。
- 语言命名可以保持 idiomatic，但应能清楚映射回原始 directive。

## 共享指令总览

| 指令 | 类别 | 共享语义 | 典型输出 |
|---|---|---|---|
| `alog` | 录制 | 开始设备端录制 | 文本成功信息 |
| `aplay` | 回放 | 开始回放指定记录 | 通常异步启动 |
| `astop` | 录制 | 停止当前录制 | 文本停止信息 |
| `acancel` | 回放 | 取消当前回放任务 | 文本或 JSON 状态 |
| `sn` | 设备信息 | 查询设备序列号 | JSON |
| `alive` | 设备信息 | 查询在线状态 / 心跳 | JSON |
| `aversion` | 设备信息 | 查询版本信息 | JSON |
| `atime` | 日志信息 | 查询日志时长 | JSON |
| `ainsp` | 日志信息 | 查询日志基础信息 | JSON |
| `list_dir` | 文件系统 | 列目录 | JSON |
| `clean_dir` | 文件系统 | 清理目录 | 文本 |
| `delete_file` | 文件系统 | 删除文件 | 文本 |
| `aget` | 文件传输 | 从 file server 拉取文件到 MKP | 文本 |
| `aput` | 文件传输 | 从 MKP 上传文件到 file server | 文本 |
| `adumj` | 转换 | 设备日志转动作 JSON | JSON |
| `ajson2log` | 转换 | JSON 动作转回 MKP log | 文本 |
| `join` | 网络 | 连接 Wi‑Fi | 文本 |
| `wifi_auto` | 网络 | 查询或设置 Wi‑Fi 自动连接 | 文本 |
| `ahttpbase` | 网络 | 查询或设置文件服务基地址 | JSON 或文本 |
| `m10` | 鼠标 | 发送一条相对鼠标动作 | 通常无结构化输出 |
| `kpad` | 键盘 | 发送一条键盘动作 | 通常无结构化输出 |

## 同步与异步规则

共享规则如下：

- `m10` 与 `kpad` 默认通常按“无需结构化输出”的控制指令使用。
- 需要解析返回内容的 directive，应先满足语言端各自的同步读循环前提。
- 同一条 directive 的 parser 是否能正确工作，既依赖设备输出，也依赖语言端 parser 注册是否覆盖对应 EOF / prompt 模式。
- 若设备回包混合了 echo、提示符、文本和 JSON，语言端通常需要先裁剪外层噪声，再提取 JSON 主体。

换句话说，**共享契约在“这条 directive 应该返回什么”**，而语言补充文档负责说明 **“该语言如何把它可靠读出来”**。

## 录制与回放指令

### `alog`

- 作用：开始设备端录制。
- 常见输入：日志名称，可附带宽高、起点坐标等录制参数。
- 共享预期：成功后设备进入录制状态。

### `aplay`

- 作用：开始回放指定日志。
- 常见输入：记录名，可附加延迟或其它回放参数。
- 共享预期：多数语言端把它视为“启动型操作”，常配合轮询或后续 `acancel` / 状态查询使用。

### `astop`

- 作用：停止当前录制。
- 共享预期：若设备当前在录制，应返回停止成功信息。

### `acancel`

- 作用：取消当前回放任务。
- 共享预期：返回当前取消状态；不同固件文本细节可能略有差异。

## 设备网络与文件系统指令

### 设备信息

- `sn`：设备序列号
- `alive`：在线状态 / 心跳
- `aversion`：版本信息
- `atime`：日志时长
- `ainsp`：日志基础信息

这些 directive 的共享特点是：**通常存在可结构化解析的 JSON 主体**。

### 文件系统

- `list_dir`：列目录内容
- `clean_dir`：清理目录
- `delete_file`：删除文件

这些 directive 的共享特点是：

- `list_dir` 通常返回 JSON 目录结构
- `clean_dir` / `delete_file` 更常见的是文本成功 / 失败语义
- 多数语言端会额外限制危险路径，例如限制在 `/eMMC/applog` 下工作

### 文件传输与转换

- `aget`：从 file server 拉取文件到 MKP
- `aput`：从 MKP 上传文件到 file server
- `adumj`：设备 log -> JSON
- `ajson2log`：JSON -> 设备 log

这些 directive 往往和本地工具链、file server、路径约定一起使用；共享语义保持一致，但本地命令包装由语言端负责。

### 网络配置

- `join`：连接 Wi‑Fi
- `wifi_auto`：查询或设置 Wi‑Fi 自动连接
- `ahttpbase`：查询或设置文件服务基地址

共享重点：

- `join` 常返回文本状态
- `wifi_auto` 可能既承担查询也承担设置
- `ahttpbase` 既可查询当前值，也可更新当前值

## 鼠标指令：`m10`

协议层上，`m10` 代表一条鼠标动作，通常包含：

- 鼠标按键状态
- 相对 X / Y 位移
- 滚轮值
- 是否释放全部按键
- 同步 / 异步发送偏好（由语言端 option 封装）

共享理解：

- 它是 **设备控制型 directive**，而不是面向结构化返回的查询型 directive。
- 更高层的拖动、分段移动、拟人轨迹，通常由各语言的 helper / controller 在 `m10` 之上组合实现。

## 键盘指令：`kpad`

协议层上，`kpad` 代表一条键盘动作，通常包含：

- 修饰键状态
- 普通按键槽位
- 是否释放
- 可选延迟
- 同步 / 异步发送偏好（由语言端 option 封装）

共享理解：

- `kpad` 负责表达底层键盘包，而不是高层文本输入语义。
- “输出 `Hello MKP!`” 之类的大小写逻辑，通常由各语言 helper 负责拆成多次 `kpad` / `key_tap` 调用。

## 语言补充文档

- Go：`go/directives.md`
- Python：`python/directives.md`
- Rust：`rust/directives.md`
- Node.js：`node/directives.md`
- C++：`cpp/directives.md`
- .NET：`dotnet/directives.md`
- Java：`java/directives.md`

这些子文档应只保留语言实现差异，例如：

- 同步初始化步骤
- example 路径与运行命令
- helper / controller / CLI / HTTP 对照
- parser 注册表
- 返回模型名称
- 已知差异与限制

