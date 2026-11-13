# MKP Java 指令补充说明

[English](./directives.en.md) | 中文 | [共享指令说明](../directives.md) | [Java README](./README.md)

---

## 目录

- [文档定位](#文档定位)
- [Java 使用约定](#java-使用约定)
- [示例索引](#示例索引)
- [Java API 快速对照](#java-api-快速对照)
- [输出解析索引](#输出解析索引)
- [返回结构索引](#返回结构索引)
- [CLI / Client / Server / Converter 对照](#cli--client--server--converter-对照)
- [已知差异](#已知差异)

## 文档定位

共享 directive 语义请直接查阅仓库根目录：`../directives.md`。

本文档只保留 Java 语言特有内容：

- Java API / interface 映射
- Java example 路径与运行命令
- Java parser 的 EOF / prompt 约定
- Java 的 CLI / HTTP client / HTTP server / file server / converter 暴露方式

## Java 使用约定

- 以下路径与命令均相对于 `mkp-kit/java/`
- 运行示例前建议先执行一次 `.\gradlew.bat build`
- `examples/directives/*` 默认连接真实设备
- 当前没有 Node 那样的 `--fixture` 离线桩响应模式
- 真实设备联调时，通常通过 `MKP_SERIAL_PORT` 或代码中的 `COM3` 默认值指定串口
- Java 版同步解析由 `sendParsed()` / `sfport.<directive>()` 内部完成，不需要外部显式读循环
- 当前构建目标为 JDK `21`

## 示例索引

| 指令 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `sn` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/SnExample.java` | `.\gradlew.bat :examples:runSn` | 查询设备序列号 |
| `aversion` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AVersionExample.java` | `.\gradlew.bat :examples:runAversion` | 查询版本信息，输出 `uver` / `aver` |
| `alive` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AliveExample.java` | `.\gradlew.bat :examples:runAlive` | 查询在线状态 / 心跳 |
| `list_dir` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/ListDirExample.java` | `.\gradlew.bat :examples:runListDir --args="/eMMC/applog"` | 列目录 |
| `clean_dir` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/CleanDirExample.java` | `.\gradlew.bat :examples:runCleanDir --args="/eMMC/applog/subdir1"` | 清理目录 |
| `delete_file` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/DeleteFileExample.java` | `.\gradlew.bat :examples:runDeleteFile --args="/eMMC/applog/demo.log"` | 删除文件 |
| `join` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/JoinExample.java` | `.\gradlew.bat :examples:runJoin --args="<ssid> <password>"` | 连接指定 Wi‑Fi |
| `wifi_auto` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/WifiAutoExample.java` | `.\gradlew.bat :examples:runWifiAuto --args="1"` | 查询或设置 Wi‑Fi 自动连接 |
| `ahttpbase` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AHttpBaseExample.java` | `.\gradlew.bat :examples:runAhttpbase --args="http://127.0.0.1:8080"` | 查询或设置文件服务基地址 |
| `ainsp` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AInspExample.java` | `.\gradlew.bat :examples:runAinsp --args="/eMMC/applog/demo.log"` | 读取日志基础信息，输出 `seconds` / `milsec` / `width` / `heigh` / `stpos` |
| `atime` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/ATimeExample.java` | `.\gradlew.bat :examples:runAtime --args="/eMMC/applog/spike.log"` | 读取日志时长，输出 `seconds` / `milsec` |
| `adumj` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/ADumjExample.java` | `.\gradlew.bat :examples:runAdumj --args="/eMMC/applog/demo.log"` | 设备日志转动作 JSON |
| `aget` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AGetExample.java` | `.\gradlew.bat :examples:runAget --args="/tmp/demo.txt"` | 从 file server 拉取文件到 MKP |
| `aput` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/APutExample.java` | `.\gradlew.bat :examples:runAput --args="/eMMC/applog/demo.log"` | 从 MKP 上传文件到 file server |
| `ajson2log` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AJson2LogExample.java` | `.\gradlew.bat :examples:runAjson2log --args="demo.json /eMMC/applog/demo.log"` | JSON 动作转回 MKP log |
| `alog` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/ALogExample.java` | `.\gradlew.bat :examples:runAlog --args="subdir1/test"` | 启动同步录制 |
| `astop` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AStopExample.java` | `.\gradlew.bat :examples:runAstop` | 停止当前录制 |
| `acancel` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/ACancelExample.java` | `.\gradlew.bat :examples:runAcancel` | 取消当前回放 |
| `aplay` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/APlayExample.java` | `.\gradlew.bat :examples:runAplay --args="demo -1"` | 启动回放 |

## Java API 快速对照

| 指令 | Java API / 方法 | 返回 |
|---|---|---|
| `sn` | `SFSerialPort.sn()` | `Models.SN` |
| `alive` | `SFSerialPort.alive()` | `Models.Heartbeat` |
| `aversion` | `SFSerialPort.aversion()` | `Models.MkpVersion` |
| `atime` | `SFSerialPort.atime(path)` | `Models.LogLength` |
| `ainsp` | `SFSerialPort.ainsp(path)` | `Models.LogInfo` |
| `list_dir` | `SFSerialPort.listDir(path)` | `Models.FileSystem` |
| `clean_dir` | `SFSerialPort.cleanDir(path)` | `String` |
| `delete_file` | `SFSerialPort.deleteFile(path)` | `String` |
| `join` | `SFSerialPort.join(option)` | `String` |
| `wifi_auto` | `SFSerialPort.wifiAuto(option)` | `String` |
| `ahttpbase` | `SFSerialPort.ahttpbase(option)` | `Models.AHttpBase` |
| `adumj` | `SFSerialPort.adumj(path)` | `Models.ActionDump` |
| `aget` | `SFSerialPort.aget(option)` | `String` |
| `aput` | `SFSerialPort.aput(option)` | `String` |
| `ajson2log` | `SFSerialPort.ajson2log(option)` | `String` |
| `alog` | `SFSerialPort.alog(logName, option, timeoutMs)` / `SFSerialPort.startRecording(args)` | `String` / `void` |
| `astop` | `SFSerialPort.stopRecording()` | `String` |
| `acancel` | `SFSerialPort.cancelReplay()` | `Object` |
| `aplay` | `SFSerialPort.startReplaying(logName, delay)` | `void` |
| `m10` | `SFSerialPort.mouse10(option)` / `Controller.mouse10(option)` | 无结构化输出 |
| `kpad` | `SFSerialPort.keypad(option)` / `Controller.keypad(option)` / `Controller.typeText(text, option)` / `DeviceHelpers.typeText(sfport, text, option)` | 无结构化输出 |

## 输出解析索引

Java 在 `core/src/main/java/io/github/elvuel/mkpkit/java/DirectiveParsing.java` 中注册 parser。

| Directive prefix | Parse mode | EOF / prompt |
|---|---|---|
| `alog` | 异步发送；同步 `alog(...)` 返回文本 | `cli>` |
| `astop` | 纯文本停止输出 | `cli>` |
| `acancel` | 原始 JSON 文本，允许空输出 | `<EOF>` |
| `clean_dir` / `delete_file` | 纯文本状态输出 | `cli>` |
| `join` | 专用状态文本解析（`connected` / `connecting`） | `cli>` |
| `wifi_auto` | 专用状态文本解析 | `cli>` |
| `aget` / `aput` / `ajson2log` | 专用文本成功 / 失败解析 | `cli>` |
| `sn` / `alive` / `aversion` / `list_dir` | JSON 提取 | `<EOF>` |
| `ainsp` / `atime` | 行内 JSON 提取 | `<EOF>` |
| `adumj` | JSON 提取 | `cli>` |
| `ahttpbase` | 专用解析：优先 JSON，失败时回退 URL 行提取 | `cli>` |

## 返回结构索引

| Java model | 用途 |
|---|---|
| `Models.SN` | `sn` 输出 |
| `Models.Heartbeat` | `alive` 输出 |
| `Models.MkpVersion` | `aversion` 输出；规范字段为 `uver` / `aver` |
| `Models.LogLength` | `atime` 输出；规范字段为 `seconds` / `milsec` |
| `Models.StPos` | `ainsp` 的起始坐标 |
| `Models.LogInfo` | `ainsp` 输出；规范字段为 `seconds` / `milsec` / `width` / `heigh` / `stpos` |
| `Models.FileNode` / `Models.FileSystem` | `list_dir` 输出 |
| `Models.ActionDump` | `adumj` 输出 |
| `Models.AHttpBase` | `ahttpbase` 输出 |
| `Models.SerialPortStatus` | `snapshotStatus()` 输出 |
| `Models.LogOption` / `Models.JoinOption` / `Models.WifiAutoOption` / `Models.AGetOption` / `Models.APutOption` / `Models.AJson2LogOption` / `Models.AHttpBaseOption` | directive option 类型 |
| `M10Option` / `KpadOption` | 鼠标 / 键盘 option 类型 |

## CLI / Client / Server / Converter 对照

- `cli/`：`mkpkit-java` 串口 CLI
- `client/`：`mkpkit-java-client` HTTP client CLI
- `server/`：`mkpkit-java-server` HTTP server
- `file-server/`：`mkpkit-java-file-server`
- `converter/`：`mkpkit-java-converter`
- `core/`：`SFSerialPort`、`DirectiveParsing`、`Models`、`Controller`、`DeviceHelpers`

## 已知差异

- Java directive 示例默认面向真实设备；当前没有 Node 风格的 `--fixture` 离线桩响应模式。
- Java 当前通常要求显式串口名，不像部分语言实现那样内建自动探测 helper。
- `aversion` 现已对齐到 `uver` / `aver`；parser 仍兼容旧 `app` / `boot` 固件返回。
- `ainsp` 现已对齐到 `seconds` / `milsec` / `width` / `heigh` / `stpos`；不再以 `name` / `path` / `size` 作为主返回结构。
- `join` / `wifi_auto` / `aget` / `aput` / `ajson2log` 在 Java 侧仍主要返回文本，而不是专门的结构化模型。
- 共享 directive 语义变更时，请先更新 `../directives.md`，再记录 Java 特有差异。
