# Java

`java/` 是 `mkp-kit` monorepo 下的 Java 语言实现目录。

## 当前范围

- 已实现：`core`、`examples`、`cli`、`client`、`server`、`file-server`、`converter`
- 已对齐首批 directive / parser / serial transport / helper / controller
- 已补上本地 CLI、HTTP API client、HTTP server、文件服务、双向 log/json converter

## Package

- 根包：`io.github.elvuel.mkpkit.java`
- 示例包：`io.github.elvuel.mkpkit.java.examples`
- 指令示例包：`io.github.elvuel.mkpkit.java.examples.directives`

## Maven 坐标

- `groupId`：`io.github.elvuel.mkpkit`
- `core`：`mkpkit-java-core`
- `cli`：`mkpkit-java`
- `client`：`mkpkit-java-client`
- `server`：`mkpkit-java-server`
- `file-server`：`mkpkit-java-file-server`
- `converter`：`mkpkit-java-converter`
- `examples`：`mkpkit-java-examples`

## 脚本名

- CLI：`mkpkit-java`
- Client：`mkpkit-java-client`
- Server：`mkpkit-java-server`
- File server：`mkpkit-java-file-server`
- Converter：`mkpkit-java-converter`
- Examples：`mkpkit-java-examples`

## 构建与测试

在 `java/` 目录执行：

```bash
./gradlew build
```

Windows PowerShell：

```powershell
.\gradlew.bat build
```

## Examples

- dry-run `m10`：`.\gradlew.bat :examples:runM10`
- dry-run `kpad`：`.\gradlew.bat :examples:runKpad`
- device `m10`：先设置 `MKP_SERIAL_PORT=COMx`，再执行 `.\gradlew.bat :examples:runM10Device`
- device `kpad`：先设置 `MKP_SERIAL_PORT=COMx`，再执行 `.\gradlew.bat :examples:runKpadDevice`

更多示例见 `java/examples/README.md`。

## CLI / Client / Server / File Server / Converter

- CLI 帮助：`.\gradlew.bat :cli:run --args="--help"`
- Client 帮助：`.\gradlew.bat :client:run --args="--help"`
- Server 帮助：`.\gradlew.bat :server:run --args="--help"`
- File server 帮助：`.\gradlew.bat :file-server:run --args="--help"`
- Converter 帮助：`.\gradlew.bat :converter:run --args="--help"`

## 文档

- Converter 说明：`java/converter/README.md`
- Java 指令说明：`java/directives.md`
- English README：`java/README.en.md`
- English directives：`java/directives.en.md`
