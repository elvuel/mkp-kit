# MKP Java Directive Supplement

English | [中文](./directives.md) | [Shared Command Reference](../directives.en.md) | [Java README](./README.en.md)

---

## Table of Contents

- [Scope](#scope)
- [Java Conventions](#java-conventions)
- [Example Index](#example-index)
- [Java API Mapping](#java-api-mapping)
- [Output Parser Index](#output-parser-index)
- [Response Model Index](#response-model-index)
- [CLI / Client / Server / Converter Mapping](#cli--client--server--converter-mapping)
- [Known Differences](#known-differences)

## Scope

For shared directive semantics, read the monorepo root document directly: `../directives.en.md`.

This file only keeps Java-specific content:

- Java API / interface mappings
- Java example paths and run commands
- Java parser EOF / prompt expectations
- Java CLI / HTTP client / HTTP server / file server / converter exposure

## Java Conventions

- All paths and commands below are relative to `mkp-kit/java/`
- Run `.\gradlew.bat build` before examples when in doubt
- `examples/directives/*` default to a real device
- there is currently no Node-style `--fixture` offline canned-response mode
- for real hardware, the serial port is usually supplied through `MKP_SERIAL_PORT` or a code-level `COM3` default
- synchronous parsing is completed inside `sendParsed()` / `sfport.<directive>()`; the Java implementation does not require an external explicit read loop
- the current build target is JDK `21`

## Example Index

| Directive | Source path | Run command | Behavior |
|---|---|---|---|
| `sn` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/SnExample.java` | `.\gradlew.bat :examples:runSn` | Query the device serial number |
| `aversion` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AVersionExample.java` | `.\gradlew.bat :examples:runAversion` | Query version information with `uver` / `aver` |
| `alive` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AliveExample.java` | `.\gradlew.bat :examples:runAlive` | Query liveness / heartbeat |
| `list_dir` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/ListDirExample.java` | `.\gradlew.bat :examples:runListDir --args="/eMMC/applog"` | List directories |
| `clean_dir` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/CleanDirExample.java` | `.\gradlew.bat :examples:runCleanDir --args="/eMMC/applog/subdir1"` | Clean directories |
| `delete_file` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/DeleteFileExample.java` | `.\gradlew.bat :examples:runDeleteFile --args="/eMMC/applog/demo.log"` | Delete files |
| `join` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/JoinExample.java` | `.\gradlew.bat :examples:runJoin --args="<ssid> <password>"` | Connect to Wi‑Fi |
| `wifi_auto` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/WifiAutoExample.java` | `.\gradlew.bat :examples:runWifiAuto --args="1"` | Query or set Wi‑Fi auto-connect |
| `ahttpbase` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AHttpBaseExample.java` | `.\gradlew.bat :examples:runAhttpbase --args="http://127.0.0.1:8080"` | Query or set the file-service base URL |
| `ainsp` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AInspExample.java` | `.\gradlew.bat :examples:runAinsp --args="/eMMC/applog/demo.log"` | Read basic log metadata with `seconds` / `milsec` / `width` / `heigh` / `stpos` |
| `atime` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/ATimeExample.java` | `.\gradlew.bat :examples:runAtime --args="/eMMC/applog/spike.log"` | Read log duration with `seconds` / `milsec` |
| `adumj` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/ADumjExample.java` | `.\gradlew.bat :examples:runAdumj --args="/eMMC/applog/demo.log"` | Convert a device log into action JSON |
| `aget` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AGetExample.java` | `.\gradlew.bat :examples:runAget --args="/tmp/demo.txt"` | Pull a file from the file server into MKP |
| `aput` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/APutExample.java` | `.\gradlew.bat :examples:runAput --args="/eMMC/applog/demo.log"` | Upload a file from MKP to the file server |
| `ajson2log` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AJson2LogExample.java` | `.\gradlew.bat :examples:runAjson2log --args="demo.json /eMMC/applog/demo.log"` | Convert action JSON back into MKP log format |
| `alog` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/ALogExample.java` | `.\gradlew.bat :examples:runAlog --args="subdir1/test"` | Start synchronous recording |
| `astop` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/AStopExample.java` | `.\gradlew.bat :examples:runAstop` | Stop the current recording |
| `acancel` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/ACancelExample.java` | `.\gradlew.bat :examples:runAcancel` | Cancel the current replay |
| `aplay` | `examples/src/main/java/io/github/elvuel/mkpkit/java/examples/directives/APlayExample.java` | `.\gradlew.bat :examples:runAplay --args="demo -1"` | Start replay |

## Java API Mapping

| Directive | Java API / method | Return |
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
| `m10` | `SFSerialPort.mouse10(option)` / `Controller.mouse10(option)` | no structured output |
| `kpad` | `SFSerialPort.keypad(option)` / `Controller.keypad(option)` / `Controller.typeText(text, option)` / `DeviceHelpers.typeText(sfport, text, option)` | no structured output |

## Output Parser Index

Java registers parsers in `core/src/main/java/io/github/elvuel/mkpkit/java/DirectiveParsing.java`.

| Directive prefix | Parse mode | EOF / prompt |
|---|---|---|
| `alog` | async send; synchronous `alog(...)` returns text | `cli>` |
| `astop` | plain-text stop output | `cli>` |
| `acancel` | raw JSON text, empty output allowed | `<EOF>` |
| `clean_dir` / `delete_file` | plain-text status output | `cli>` |
| `join` | dedicated status-text parsing (`connected` / `connecting`) | `cli>` |
| `wifi_auto` | dedicated status-text parsing | `cli>` |
| `aget` / `aput` / `ajson2log` | dedicated text success / failure parsing | `cli>` |
| `sn` / `alive` / `aversion` / `list_dir` | JSON extraction | `<EOF>` |
| `ainsp` / `atime` | line-JSON extraction | `<EOF>` |
| `adumj` | JSON extraction | `cli>` |
| `ahttpbase` | dedicated parser: JSON first, URL-line fallback | `cli>` |

## Response Model Index

| Java model | Usage |
|---|---|
| `Models.SN` | `sn` output |
| `Models.Heartbeat` | `alive` output |
| `Models.MkpVersion` | `aversion` output; canonical fields are `uver` / `aver` |
| `Models.LogLength` | `atime` output; canonical fields are `seconds` / `milsec` |
| `Models.StPos` | start-position coordinates inside `ainsp` |
| `Models.LogInfo` | `ainsp` output; canonical fields are `seconds` / `milsec` / `width` / `heigh` / `stpos` |
| `Models.FileNode` / `Models.FileSystem` | `list_dir` output |
| `Models.ActionDump` | `adumj` output |
| `Models.AHttpBase` | `ahttpbase` output |
| `Models.SerialPortStatus` | `snapshotStatus()` output |
| `Models.LogOption` / `Models.JoinOption` / `Models.WifiAutoOption` / `Models.AGetOption` / `Models.APutOption` / `Models.AJson2LogOption` / `Models.AHttpBaseOption` | directive option types |
| `M10Option` / `KpadOption` | mouse / keyboard option types |

## CLI / Client / Server / Converter Mapping

- `cli/`: `mkpkit-java` serial CLI
- `client/`: `mkpkit-java-client` HTTP client CLI
- `server/`: `mkpkit-java-server` HTTP server
- `file-server/`: `mkpkit-java-file-server`
- `converter/`: `mkpkit-java-converter`
- `core/`: `SFSerialPort`, `DirectiveParsing`, `Models`, `Controller`, and `DeviceHelpers`

## Known Differences

- Java directive examples default to real-device execution; there is currently no Node-style `--fixture` offline canned-response mode.
- Java currently expects an explicit serial-port name in most flows rather than shipping a built-in auto-detection helper like some other language ports.
- `aversion` is now aligned to `uver` / `aver`; the parser still accepts older firmware payloads that expose `app` / `boot`.
- `ainsp` is now aligned to `seconds` / `milsec` / `width` / `heigh` / `stpos` rather than using `name` / `path` / `size` as its primary response structure.
- `join` / `wifi_auto` / `aget` / `aput` / `ajson2log` still return plain text rather than more specialized structured response models.
- When shared directive meaning changes, update `../directives.en.md` first and then record the Java-specific differences here.
