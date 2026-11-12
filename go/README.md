# MKP Go

[English](./README.en.md) | 中文 | [共享总览](../README.md) | [共享指令说明](../directives.md) | [Go 指令补充](./directives.md) | [Controller.MouseMove 使用说明](./doc/controller_mouse_move.md)

---

本文档只维护 `mkp-kit/go/` 的 **Go 语言特有用法与差异**。

跨语言共享内容（MKP 背景、共享 directive 语义、共享维护约定）统一维护在仓库根目录：

- 共享总览：`../README.md`
- 共享指令说明：`../directives.md`

## 安装

在 `mkp-kit` monorepo 中，Go 实现位于 `go/` 子目录。

```bash
go get github.com/elvuel/mkp-kit/go
```

当前 `go/go.mod` 声明：

```text
module github.com/elvuel/mkp-kit/go
go 1.25.0
```

## 快速开始

```go
package main

import (
    "fmt"

    mkpgo "github.com/elvuel/mkp-kit/go"
    "github.com/elvuel/mkp-kit/go/helper"
)

func main() {
    sfport := mkpgo.NewSFSerialPort()
    sfport.Name = "COM5"

    if err := sfport.Open(); err != nil {
        panic(err)
    }
    defer sfport.Close()

    go sfport.Read()

    sn, err := helper.DeviceSN(sfport)
    if err != nil {
        panic(err)
    }
    fmt.Println(sn.SN)
}
```

> 对需要同步读取输出的 helper，请先启动 `go sfport.Read()` 并保持 `SyncOuputEnabled=true`。

## 示例

以下路径与命令均相对于 `mkp-kit/go/`。

| 示例 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `m10` | `examples/m10/main.go` | `go run .\examples\m10` | 演示鼠标相对移动、按键按下与释放 |
| `kpad` | `examples/kpad/main.go` | `go run .\examples\kpad` | 演示键盘字符、组合键与自动释放 |
| `keys` | `examples/keys/main.go` | `go run .\examples\keys` | 演示 `helper.KeyTap`、`KeyDown`、`KeyUp` |
| `context` | `examples/context/main.go` | `go run .\examples\context` | 演示带 `context` 的超时取消与手动取消 |
| `commonpkg` | `examples/commonpkg/common.go` | 被其它示例复用 | 提供串口初始化、停止录制与日志输出辅助 |

常见 directive 示例：

| 指令示例 | 源码路径 | 运行命令 | 用途 |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/directives/<name>/main.go` | `go run .\examples\directives\sn` | 查询设备序列号、版本与在线状态 |
| `list_dir` / `clean_dir` / `delete_file` | `examples/directives/<name>/main.go` | `go run .\examples\directives\list_dir /eMMC/applog` | 浏览目录、清理目录、删除文件 |
| `join` / `wifi_auto` / `ahttpbase` | `examples/directives/<name>/main.go` | `go run .\examples\directives\join <ssid> <password>` | 配置 Wi‑Fi、自动联网与 HTTP 基地址 |
| `ainsp` / `atime` | `examples/directives/<name>/main.go` | `go run .\examples\directives\atime /eMMC/applog/spike.log` | 查看日志信息与时长 |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/directives/<name>/main.go` | `go run .\examples\directives\ajson2log D:\tmp\demo.json /eMMC/applog/demo.log` | 上传、下载与 JSON/日志互转 |
| `alog` / `astop` | `examples/directives/<name>/main.go` | `go run .\examples\directives\alog mkpdemo/demo` | 开始录制与停止录制 |

## Go 特有表面

- `helper/`：面向业务的便捷函数
- `controller/`：更高层的鼠标 / 键盘控制器
- `cmd/client/`：Go 版客户端命令入口
- `cmd/server/`：Go 版 HTTP server 实现
- `doc/controller_mouse_move*.md`：Go 版鼠标轨迹说明

## 仓库结构

以下路径均相对于 `mkp-kit/go/`。

| 路径 | 说明 |
|---|---|
| `go.mod` | Go module 声明，module path 为 `github.com/elvuel/mkp-kit/go` |
| `helper/` | 面向业务的 helper 封装 |
| `controller/` | 更高层的鼠标 / 键盘控制器 |
| `cmd/client/` | Go 客户端命令入口 |
| `cmd/server/` | Go HTTP server、配置与模型 |
| `examples/` | `m10` / `kpad` / directive 示例 |
| `directives.md` | Go 版 directive 补充说明 |

## 注意事项

- 使用同步指令时，请确保 `SyncOuputEnabled=true` 且已执行 `go sfport.Read()`。
- `m10` / `kpad` 默认异步发送；如需串行保证完成，可通过 `WithAsync(false)` 或 `WithSyncIgnoreOutput(true)` 切换为同步等待且忽略输出。
- 文件删除 / 清理 helper 默认限制在 `/eMMC/applog` 下，避免误操作设备其他路径。
- 共享 directive 含义变更时，请优先更新仓库根目录文档，再回到 `go/` 补 Go 特有差异。
