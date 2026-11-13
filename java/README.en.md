# MKP Java

English | [中文](./README.md) | [Shared Overview](../README.en.md) | [Shared Command Reference](../directives.en.md) | [Java Directive Supplement](./directives.en.md)

---

This document only keeps the **Java-specific usage and differences** for `mkp-kit/java/`.

Cross-language shared content lives in the monorepo root:

- Shared overview: `../README.en.md`
- Shared command reference: `../directives.en.md`

## Installation

Inside the `mkp-kit` monorepo, the Java implementation lives under `java/`.

```powershell
cd D:\projects\mkp-kit\java
.\gradlew.bat build
```

Current build and runtime expectations:

- JDK `21`
- Gradle wrapper: `gradlew` / `gradlew.bat`
- core serial dependency: `jSerialComm`
- JSON dependency: `jackson-databind`

Current modules:

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

Synchronous parsing expectations:

- the serial port is already `open()`
- structured output is completed inside `sendParsed()` / `sfport.<directive>()`
- unlike Go / Python, the Java implementation does not require an explicit external read loop

## Examples

All paths and commands below are relative to `mkp-kit/java/`.

| Example | Source path | Run command | Behavior |
|---|---|---|---|
| `m10` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/M10Example.java` | `.\gradlew.bat :examples:runM10` | Demonstrates moving left `400` and then up `400` |
| `kpad` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/KpadExample.java` | `.\gradlew.bat :examples:runKpad` | Prints `Hello MKP!` with case preserved |
| `m10_device` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/M10DeviceExample.java` | `$env:MKP_SERIAL_PORT="COM5"; .\gradlew.bat :examples:runM10Device` | Runs `m10` against a real device |
| `kpad_device` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/KpadDeviceExample.java` | `$env:MKP_SERIAL_PORT="COM5"; .\gradlew.bat :examples:runKpadDevice` | Runs `kpad` against a real device |

Common directive examples:

| Directive examples | Source path | Run command | Purpose |
|---|---|---|---|
| `sn` / `aversion` / `alive` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/*Example.java` | `.\gradlew.bat :examples:runSn` | Query device serial number, version, and liveness |
| `list_dir` / `clean_dir` / `delete_file` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/*Example.java` | `.\gradlew.bat :examples:runListDir --args="/eMMC/applog"` | Browse directories, clean directories, and delete files |
| `join` / `wifi_auto` / `ahttpbase` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/*Example.java` | `.\gradlew.bat :examples:runJoin --args="<ssid> <password>"` | Configure Wi‑Fi, auto-connect, and the HTTP base address |
| `ainsp` / `atime` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/*Example.java` | `.\gradlew.bat :examples:runAtime --args="/eMMC/applog/spike.log"` | Read log metadata and duration; `atime` returns `seconds` / `milsec`, and `ainsp` returns `seconds` / `milsec` / `width` / `heigh` / `stpos` |
| `adumj` / `aget` / `aput` / `ajson2log` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/*Example.java` | `.\gradlew.bat :examples:runAjson2log --args="demo.json /eMMC/applog/demo.log"` | Upload, download, and convert between JSON and MKP logs |
| `alog` / `astop` / `acancel` / `aplay` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/*Example.java` | `.\gradlew.bat :examples:runAlog --args="subdir1/test"` | Start recording, stop recording, cancel replay, and launch replay |

See `java/examples/README.md` for more examples.

## Java-Specific Surface Area

### CLI

```powershell
.\gradlew.bat :cli:run --args="--help"
.\gradlew.bat :cli:run --args="sn"
.\gradlew.bat :cli:run --args="m10 --x -400 --y -400"
.\gradlew.bat :cli:run --args="kpad --text Hello MKP!"
.\gradlew.bat :cli:run --args="raw sn"
```

CLI executable name: `mkpkit-java`

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

Client executable name: `mkpkit-java-client`

### HTTP Server

```powershell
$env:MKP_SF_PORT = "COM5"
$env:MKP_JWT_SECRET = "change-me"
$env:MKP_USER = "admin"
$env:MKP_PASSWORD = "admin123"
.\gradlew.bat :server:run --args="--config .\server.json"
```

Primary routes:

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

The current Java server also supports:

- HMAC SHA256 JWT auth tokens
- `server.json` / `MKP_CONFIG_PATH` config loading
- CORS plus `OPTIONS` preflight handling
- local record-store persistence files

### File Server / Converter

```powershell
.\gradlew.bat :file-server:run --args="--help"
.\gradlew.bat :converter:run --args="--help"
.\gradlew.bat :converter:run --args="-f .\demo.log"
.\gradlew.bat :converter:run --args="-f .\demo.json -o .\artifact\out"
```

See `java/converter/README.en.md` for more converter details.

## Repository Layout

All paths below are relative to `mkp-kit/java/`.

| Path | Description |
|---|---|
| `build.gradle.kts` | root build configuration plus Maven-publication mapping |
| `settings.gradle.kts` | Gradle subproject declarations |
| `core/` | serial SDK, parser, models, controller, and helpers |
| `examples/` | `m10` / `kpad` / directive examples |
| `cli/` | `mkpkit-java` serial CLI |
| `client/` | `mkpkit-java-client` HTTP client CLI |
| `server/` | `mkpkit-java-server` HTTP server |
| `file-server/` | `mkpkit-java-file-server` |
| `converter/` | `mkpkit-java-converter` and bidirectional log/json conversion |
| `README.en.md` | Java language overview |
| `directives.en.md` | Java directive supplement |

## Java-Specific Notes

- Java currently expects an explicit serial port name; examples usually resolve the port from `MKP_SERIAL_PORT` or a code-level `COM3` default rather than auto-detecting hardware the way some other language ports do.
- `aversion` now follows the Go-aligned `uver` / `aver` shape; the parser still accepts older firmware payloads that expose `app` / `boot`.
- `ainsp` now follows the Go-aligned `seconds` / `milsec` / `width` / `heigh` / `stpos` shape rather than treating `name` / `path` / `size` as its primary response structure.
- `examples/directives/*` default to a real device; there is currently no Node-style `--fixture` canned-response mode.
- `join` / `wifi_auto` / `aget` / `aput` / `ajson2log` still return plain text rather than more specialized structured response models.
- When shared directive meaning changes, update the monorepo root docs first and then record the Java-specific differences under `java/`.
