# MKP Kit

中文 | [English](./README.en.md) | [共享指令说明](./directives.md)

---

`mkp-kit` 是 MKP 设备 SDK 的 monorepo，统一维护 Go、Python、Rust、Node.js、C++、.NET 六个语言实现。

## MKP 是什么？

**MKP** 指一套通过串口控制的 **鼠标 / 键盘录制、回放与文件管理设备及其 CLI 指令协议**。

典型链路如下：

```text
上位机程序 -> 串口 -> MKP 设备 / 固件 -> USB HID 鼠标 / 键盘事件 -> 目标系统
```

也就是说，六个语言端口共享的是同一套设备协议、同一批 directive 语义、以及同一组设备侧录制 / 回放 / 文件管理能力。

## Monorepo 定位

`mkp-kit` 不再把 Go、Python、Rust、Node.js、C++、.NET 视为多个互不相关的仓库，而是把它们视为 **同一 SDK 产品的六种语言实现**。

因此，以下内容默认按跨语言能力统一维护：

- directive 语义与默认行为
- parser / 返回结构的契约含义
- examples 的覆盖范围与行为说明
- README / directives 双语规范文档
- 需求实现与 bug 修复的一致性

## 共享能力总览

| 能力 | 说明 | 典型 directive |
|---|---|---|
| 串口连接 | 打开设备、发送原始 directive、同步 / 异步等待输出 | `send_directive` / `send_parsed` 等各语言封装 |
| 鼠标控制 | 相对移动、按键、滚轮、全释放 | `m10` |
| 键盘控制 | 按下、释放、点击、组合键 | `kpad` |
| 录制回放 | 设备端录制、停止、取消、回放 | `alog`、`astop`、`acancel`、`aplay` |
| 文件管理 | 浏览目录、删除文件、清理目录、导入导出日志 | `list_dir`、`delete_file`、`clean_dir`、`aget`、`aput`、`ajson2log` |
| 设备信息 | SN、心跳、版本、日志时长、日志详情 | `sn`、`alive`、`aversion`、`atime`、`ainsp` |
| 网络配置 | Wi‑Fi、HTTP 基地址等设备侧配置 | `join`、`wifi_auto`、`ahttpbase` |

共享 directive 语义请直接查阅 [`directives.md`](./directives.md)。

## 仓库结构

- `go/`：Go 版 SDK / helper / controller / examples / 语言补充文档
- `python/`：Python 版 SDK / server / CLI / converter / file server / 语言补充文档
- `rust/`：Rust 版 SDK / server / CLI / converter / file server / 语言补充文档
- `node/`：Node.js 版 SDK / server / CLI / converter / file server / 语言补充文档
- `cpp/`：C++ 版 SDK / helper / controller / server / converter / file server / 语言补充文档
- `dotnet/`：.NET 版 SDK / CLI / client / server / converter / file server / examples 与语言补充文档
- `docs/`：仓库级治理、研究、维护说明等补充文档

## 文档维护策略

从现在开始，文档按两层维护：

1. **根目录共享文档**：维护跨语言一致的内容
   - `README.md` / `README.en.md`
   - `directives.md` / `directives.en.md`
2. **语言子目录补充文档**：只维护语言实现差异
   - 安装方式
   - import / package / crate 名称
   - 示例运行命令
   - helper / controller / CLI / HTTP 暴露差异
   - parser 注册细节、返回模型命名差异、已知限制

这意味着：

- 共享背景、共享 directive 含义、共享维护约定，优先在仓库根目录更新
- 语言子目录文档应尽量收敛为“本语言如何使用 / 有何差异”的补充说明
- 若某语言暂时无法完全对齐，必须在对应子目录文档显式标出差异

## 语言入口

- Go：`go/README.md`
- Python：`python/README.md`
- Rust：`rust/README.md`
- Node.js：`node/README.md`
- C++：`cpp/README.md`
- .NET：`dotnet/README.md`

语言补充版 directive 说明：

- Go：`go/directives.md`
- Python：`python/directives.md`
- Rust：`rust/directives.md`
- Node.js：`node/directives.md`
- C++：`cpp/directives.md`
- .NET：`dotnet/directives.md`

## 目录映射

- 原 `mkp-go` -> `go/`
- 原 `mkp-python` -> `python/`
- 原 `mkp-rust` -> `rust/`
- monorepo 内新增 Node.js 实现 -> `node/`
- monorepo 内新增 C++ 实现 -> `cpp/`
- monorepo 内新增 .NET 实现 -> `dotnet/`

## 历史说明

当前合并方式保留了三边 Git 历史，并通过 subtree 方式导入：

- `go/` <- `mkp-go`
- `python/` <- `mkp-python`
- `rust/` <- `mkp-rust`

`node/`、`cpp/` 与 `dotnet/` 当前在 `mkp-kit` monorepo 中继续演进。

