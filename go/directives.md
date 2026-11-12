# MKP Go 指令补充说明

[English](./directives.en.md) | 中文 | [共享指令说明](../directives.md) | [Go README](./README.md)

---

## 目录

- [文档定位](#文档定位)
- [Go 使用约定](#go-使用约定)
- [示例索引](#示例索引)
- [Go API 快速对照](#go-api-快速对照)
- [输出解析器索引](#输出解析器索引)
- [返回结构索引](#返回结构索引)
- [Go 专属入口](#go-专属入口)
- [草案未封装指令](#草案未封装指令)
- [注意事项](#注意事项)

## 文档定位

共享 directive 语义请直接查阅仓库根目录：`../directives.md`。

本文档只保留 Go 语言特有内容：

- `SFSerialPort` / `helper` / `controller` 的函数入口
- Go 版 example 路径与运行命令
- Go parser 注册与返回结构名
- Go 版尚未完全上提到共享文档的草案内容

## Go 使用约定

- 默认串口类型：`*mkpgo.SFSerialPort`
- 同步输出前提：请先 `go sfport.Read()`
- 同步开关字段名为 `SyncOuputEnabled`
- 以下路径与命令均相对于 `mkp-kit/go/`

## 示例索引

| 指令 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `sn` | `examples/directives/sn/main.go` | `go run .\examples\directives\sn` | 查询设备序列号 |
| `aversion` | `examples/directives/aversion/main.go` | `go run .\examples\directives\aversion` | 查询版本信息 |
| `alive` | `examples/directives/alive/main.go` | `go run .\examples\directives\alive` | 查询在线状态 / 心跳 |
| `list_dir` | `examples/directives/list_dir/main.go` | `go run .\examples\directives\list_dir` | 列出内置 `/eMMC` 目录 |
| `clean_dir` | `examples/directives/clean_dir/main.go` | `go run .\examples\directives\clean_dir` | 清空 `/eMMC/applog/subdir1` |
| `delete_file` | `examples/directives/delete_file/main.go` | `go run .\examples\directives\delete_file` | 删除 `/eMMC/applog/uuu3.log` |
| `join` | `examples/directives/join/main.go` | `go run .\examples\directives\join [ssid password]` | 连接指定 Wi‑Fi |
| `wifi_auto` | `examples/directives/wifi_auto/main.go` | `go run .\examples\directives\wifi_auto [0|1]` | 查询或设置 Wi‑Fi 自动连接 |
| `ahttpbase` | `examples/directives/ahttpbase/main.go` | `go run .\examples\directives\ahttpbase [http-base-url]` | 查询或设置文件服务基地址 |
| `ainsp` | `examples/directives/ainsp/main.go` | `go run .\examples\directives\ainsp` | 读取日志基础信息 |
| `atime` | `examples/directives/atime/main.go` | `go run .\examples\directives\atime` | 读取日志时长 |
| `adumj` | `examples/directives/adumj/main.go` | `go run .\examples\directives\adumj <logPath>` | 将设备日志转成动作 JSON |
| `aget` | `examples/directives/aget/main.go` | `go run .\examples\directives\aget <file-server-path>` | 从 file server 拉取文件到 MKP |
| `aput` | `examples/directives/aput/main.go` | `go run .\examples\directives\aput <mkp-file-path>` | 从 MKP 上传文件到 file server |
| `ajson2log` | `examples/directives/ajson2log/main.go` | `go run .\examples\directives\ajson2log <jsonpath> <outputlogpath>` | 将 JSON 动作转回 MKP log |
| `alog` | `examples/directives/alog/main.go` | `go run .\examples\directives\alog` | 以 `subdir1/test` 启动同步录制 |
| `astop` | `examples/directives/astop/main.go` | `go run .\examples\directives\astop` | 停止当前录制 |

## Go API 快速对照

| 指令 | Go API | 返回 |
|---|---|---|
| `alog` | `StartRecording` / `helper.Alog` | `string` / 文本 |
| `aplay` | `StartReplaying` | 通常异步 |
| `astop` | `StopRecording` / `helper.Astop` | `string` / 文本 |
| `acancel` | `CancelReplay` / `helper.Cancel` | `string` / JSON 文本 |
| `sn` | `helper.DeviceSN` | `SN` |
| `list_dir` | `helper.ListDir` | `FileSystem` |
| `clean_dir` | `helper.CleanDir` | `error` 或空文本 |
| `delete_file` | `helper.DeleteFile` | `error` 或空文本 |
| `join` | `helper.Join` / `controller.Controller.Join` | 文本 |
| `wifi_auto` | `helper.WiFiAuto` | 文本 |
| `ahttpbase` | `helper.AHTTPBase` | `AHTTPBase` |
| `adumj` | `helper.Adumj` | `ActionDump` |
| `aget` | `helper.AGet` | 文本 |
| `aput` | `helper.APut` | 文本 |
| `ajson2log` | `helper.AJson2Log` | 文本 |
| `alive` | `helper.Alive` | `Heartbeat` |
| `atime` | `helper.Atime` | `LogLength` |
| `aversion` | `helper.Aversion` | `MKPVersion` |
| `ainsp` | `helper.AInspect` | `LogInfo` |
| `m10` | `Mouse10` / `controller.Controller.MouseMove` | 无结构化输出 |
| `kpad` | `Keypad` / `helper.KeyTap` | 无结构化输出 |

## 输出解析器索引

Go 内置 parser 通过 `mkpgo.InitParsers()` 注册。

| 指令前缀 | 典型输出 | 说明 |
|---|---|---|
| `alog` | 文本 | 录制成功文本 |
| `astop` | 文本 | 停止录制文本 |
| `acancel` | JSON / 文本 | 取消状态 |
| `join` | 文本 | Wi‑Fi 连接状态 |
| `wifi_auto` | 文本 | 自动联网状态 |
| `list_dir` | JSON | 目录树 |
| `alive` / `atime` / `aversion` / `sn` / `ainsp` / `adumj` / `ahttpbase` | JSON | 结构化返回 |
| `aget` / `aput` / `ajson2log` | 文本 | 传输 / 转换结果 |

## 返回结构索引

| Go 结构 | 用途 |
|---|---|
| `SN` | `sn` 输出 |
| `Heartbeat` | `alive` 输出 |
| `MKPVersion` | `aversion` 输出 |
| `LogLength` | `atime` 输出 |
| `LogInfo` | `ainsp` 输出 |
| `FileSystem` | `list_dir` 输出 |
| `ActionDump` | `adumj` 输出 |
| `AHTTPBase` | `ahttpbase` 输出 |

## Go 专属入口

- `SFSerialPort` 指令方法：根包
- `helper` 包：`helper/`
- `controller.Controller`：`controller/`
- Go 客户端命令：`cmd/client/`
- Go HTTP server：`cmd/server/`

## 草案/未封装指令

以下条目仍主要是 Go 侧的草案记录：

- `apause`
- `aresume`

如果未来三门语言一起落地，应优先迁移到仓库根目录共享文档。

## 注意事项

- 共享 directive 语义改动，应优先更新 `../directives.md`。
- Go 子文档只补充 Go API、parser、结构体命名和 Go 特有限制。
- `m10` / `kpad` 的高层拖动 / 拟人化移动更多体现在 `controller` 层，而不是共享协议层。
