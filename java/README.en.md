# Java

`java/` is the Java implementation directory inside the `mkp-kit` monorepo.

## Current Scope

- Implemented: `core`, `examples`, `cli`, `client`, `server`, `file-server`, `converter`
- Aligned for the Java port: directives, parser behavior, serial transport, helpers, and controller
- Local CLI, HTTP API client, HTTP server, file server, and bidirectional log/json converter are now available

## Packages

- root package: `io.github.elvuel.mkpkit.java`
- examples package: `io.github.elvuel.mkpkit.java.examples`
- directive examples package: `io.github.elvuel.mkpkit.java.examples.directives`

## Maven Coordinates

- `groupId`: `io.github.elvuel.mkpkit`
- `core`: `mkpkit-java-core`
- `cli`: `mkpkit-java`
- `client`: `mkpkit-java-client`
- `server`: `mkpkit-java-server`
- `file-server`: `mkpkit-java-file-server`
- `converter`: `mkpkit-java-converter`
- `examples`: `mkpkit-java-examples`

## Script Names

- CLI: `mkpkit-java`
- client: `mkpkit-java-client`
- server: `mkpkit-java-server`
- file server: `mkpkit-java-file-server`
- converter: `mkpkit-java-converter`
- examples: `mkpkit-java-examples`

## Build And Test

Run inside `java/`:

```bash
./gradlew build
```

Windows PowerShell:

```powershell
.\gradlew.bat build
```

## Examples

- dry-run `m10`: `.\gradlew.bat :examples:runM10`
- dry-run `kpad`: `.\gradlew.bat :examples:runKpad`
- device `m10`: set `MKP_SERIAL_PORT=COMx`, then run `.\gradlew.bat :examples:runM10Device`
- device `kpad`: set `MKP_SERIAL_PORT=COMx`, then run `.\gradlew.bat :examples:runKpadDevice`

See `java/examples/README.md` for more examples.

## CLI / Client / Server / File Server / Converter

- CLI help: `.\gradlew.bat :cli:run --args="--help"`
- client help: `.\gradlew.bat :client:run --args="--help"`
- server help: `.\gradlew.bat :server:run --args="--help"`
- file server help: `.\gradlew.bat :file-server:run --args="--help"`
- converter help: `.\gradlew.bat :converter:run --args="--help"`

## Docs

- converter doc: `java/converter/README.en.md`
- Java directives doc: `java/directives.en.md`
- Chinese README: `java/README.md`
- Chinese directives: `java/directives.md`
