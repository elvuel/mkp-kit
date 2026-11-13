# MKP Java

[English](./README.en.md) | 中文 | [共享总览](../README.md) | [共享指令说明](../directives.md) | [Java 指令补充](./directives.md)

---

本文档只维护 `mkp-kit/java/` 的 **Java 语言特有用法与差异**。

跨语言共享内容统一维护在仓库根目录：

- 共享总览：`../README.md`
- 共享指令说明：`../directives.md`

## 安装

在 `mkp-kit` monorepo 中，Java 实现位于 `java/` 子目录。

```powershell
cd D:\projects\mkp-kit\java
.\gradlew.bat build
```

当前构建与运行前提：

- JDK `21`
- Gradle wrapper：`gradlew` / `gradlew.bat`
- 核心串口依赖：`jSerialComm`
- JSON 依赖：`jackson-databind`

当前模块：

- `core`
- `examples`
- `cli`
- `client`
- `server`
- `file-server`
- `converter`

## Quick Start

```java
import io.github.elvuel.mkpkit.java.JSerialCommTransport;
import io.github.elvuel.mkpkit.java.Models;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.SerialPortOptions;

public final class QuickStart {
    public static void main(String[] args) throws Exception {
        String portName = System.getenv("MKP_SERIAL_PORT");
        if (portName == null || portName.isBlank()) {
            portName = "COM3";
        }

        try (SFSerialPort sfport = new SFSerialPort(
            new SerialPortOptions()
                .withName(portName)
                .withTransport(new JSerialCommTransport(portName, 115_200))
        )) {
            sfport.open();
            Models.SN sn = sfport.sn();
            System.out.println(sn.sn());
        }
    }
}
```

同步解析前提：

- 已 `open()` 串口
- 结构化输出通过 `sendParsed()` / `sfport.<directive>()` 内部完成
- Java 版不需要像 Go / Python 那样显式启动单独读循环

## Examples

以下路径与命令均相对于 `mkp-kit/java/`。

| 示例 | 源码路径 | 运行命令 | 示例行为 |
|---|---|---|---|
| `m10` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/M10Example.java` | `.\gradlew.bat :examples:runM10` | 演示鼠标左平移 `400`，然后再向上移动 `400` |
| `kpad` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/KpadExample.java` | `.\gradlew.bat :examples:runKpad` | 输出 `Hello MKP!`，区分大小写 |
| `m10_device` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/M10DeviceExample.java` | `$env:MKP_SERIAL_PORT="COM5"; .\gradlew.bat :examples:runM10Device` | 连接真实设备执行 `m10` |
| `kpad_device` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/KpadDeviceExample.java` | `$env:MKP_SERIAL_PORT="COM5"; .\gradlew.bat :examples:runKpadDevice` | 连接真实设备执行 `kpad` |

常见 directive 示例：

| 指令示例 | 源码路径 | 运行命令 | 用途 |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/*Example.java` | `.\gradlew.bat :examples:runSn` | 查询设备序列号、版本与在线状态 |
| `list_dir` / `clean_dir` / `delete_file` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/*Example.java` | `.\gradlew.bat :examples:runListDir --args="/eMMC/applog"` | 浏览目录、清理目录、删除文件 |
| `join` / `wifi_auto` / `ahttpbase` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/*Example.java` | `.\gradlew.bat :examples:runJoin --args="<ssid> <password>"` | 配置 Wi‑Fi、自动联网与 HTTP 基地址 |
| `ainsp` / `atime` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/*Example.java` | `.\gradlew.bat :examples:runAtime --args="/eMMC/applog/spike.log"` | 查看日志信息与时长；其中 `atime` 输出 `seconds` / `milsec`，`ainsp` 输出 `seconds` / `milsec` / `width` / `heigh` / `stpos` |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/*Example.java` | `.\gradlew.bat :examples:runAjson2log --args="demo.json /eMMC/applog/demo.log"` | 上传、下载与 JSON/日志互转 |
| `alog` / `astop` / `acancel` / `aplay` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/*Example.java` | `.\gradlew.bat :examples:runAlog --args="subdir1/test"` | 开始录制、停止录制、取消回放与启动回放 |

更多示例见：`java/examples/README.md`

## Java 特有表面

### CLI

```powershell
.\gradlew.bat :cli:run --args="--help"
.\gradlew.bat :cli:run --args="sn"
.\gradlew.bat :cli:run --args="m10 --x -400 --y -400"
.\gradlew.bat :cli:run --args="kpad --text Hello MKP!"
.\gradlew.bat :cli:run --args="raw sn"
```

CLI 可执行名：`mkpkit-java`

### HTTP Client

```powershell
.\gradlew.bat :client:run --args="auth login --server http://127.0.0.1:8080 --username admin --password admin123"
.\gradlew.bat :client:run --args="auth token"
.\gradlew.bat :client:run --args="list"
.\gradlew.bat :client:run --args="recording --name demo"
.\gradlew.bat :client:run --args="stop"
.\gradlew.bat :client:run --args="replay --id rid-1"
.\gradlew.bat :client:run --args="version"
```

Client 可执行名：`mkpkit-java-client`

### HTTP Server

```powershell
$env:MKP_SF_PORT = "COM5"
$env:MKP_JWT_SECRET = "change-me"
$env:MKP_USER = "admin"
$env:MKP_PASSWORD = "admin123"
.\gradlew.bat :server:run --args="--config .\server.json"
```

主要路由：

- `GET /health`
- `POST /api/v1/auth/token`
- `GET /api/v1/version`
- `GET /api/v1/directives/list`
- `GET /api/v1/directives/records/:id`
- `DELETE /api/v1/directives/records/:id`
- `GET /api/v1/directives/replay/status`
- `POST /api/v1/directives/alog`
- `POST /api/v1/directives/astop`
- `POST /api/v1/directives/aplay/:id`
- `POST /api/v1/directives/acancel`

当前 Java server 还支持：

- 基于 HMAC SHA256 的 JWT token
- 基于 `server.json` / `MKP_CONFIG_PATH` 的配置文件加载
- CORS 与 `OPTIONS` 预检
- 本地 records 持久化文件

### File Server / Converter

```powershell
.\gradlew.bat :file-server:run --args="--help"
.\gradlew.bat :converter:run --args="--help"
.\gradlew.bat :converter:run --args="-f .\demo.log"
.\gradlew.bat :converter:run --args="-f .\demo.json -o .\artifact\out"
```

更多 converter 说明见：`java/converter/README.md`

## 仓库结构

以下路径均相对于 `mkp-kit/java/`。

| 路径 | 说明 |
|---|---|
| `build.gradle.kts` | 根构建配置与 Maven 发布坐标映射 |
| `settings.gradle.kts` | Gradle 子模块声明 |
| `core/` | 串口 SDK、parser、models、controller、helper |
| `examples/` | `m10` / `kpad` / directives 示例 |
| `cli/` | `mkpkit-java` 串口 CLI |
| `client/` | `mkpkit-java-client` HTTP client CLI |
| `server/` | `mkpkit-java-server` HTTP server |
| `file-server/` | `mkpkit-java-file-server` |
| `converter/` | `mkpkit-java-converter` 与双向 log/json 转换 |
| `README.md` | Java 语言说明 |
| `directives.md` | Java 版 directive 补充说明 |

## Java 特有注意事项

- Java 当前默认要求显式串口名；示例通常通过 `MKP_SERIAL_PORT` 或代码中的 `COM3` 默认值决定端口，不像部分语言版本那样自动探测。
- `aversion` 当前按 Go 语义输出 `uver` / `aver`；parser 仍兼容旧固件可能返回的 `app` / `boot` 字段。
- `ainsp` 当前按 Go 语义输出 `seconds` / `milsec` / `width` / `heigh` / `stpos`，不再以 `name` / `path` / `size` 作为主返回结构。
- `examples/directives/*` 默认连接真实设备；当前没有 Node 那样的 `--fixture` 离线桩响应模式。
- `join` / `wifi_auto` / `aget` / `aput` / `ajson2log` 仍以文本返回为主，尚未补成更细的专门结构化响应模型。
- 共享 directive 含义变更时，请优先更新仓库根目录文档，再回到 `java/` 补 Java 特有差异。
