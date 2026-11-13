# Java Converter

`java/converter/` is the bidirectional `.log <-> .json` converter module inside `mkp-kit/java/`.

It aligns the host-side converter behavior used by the other language ports and converts between:

- MKP binary applog: `.log`
- MKP action envelope: `.json`

## Scope

The current Java converter covers:

- `.log -> .json`
- `.json -> .log`
- `MKv1` / `MKv2` header parsing and writing
- mouse 5-byte payload encode/decode
- keyboard 8-byte report encode/decode
- `MouseMove` / `MouseDown` / `MouseUp` / `Wheel`
- `KeyDown` / `KeyUp`
- negative timestamp delta clamping to `0`
- stop trailer emission on write

## Package

- converter package: `io.github.elvuel.mkpkit.java.converter`

## Build

Run inside `mkp-kit/java/`:

```powershell
.\gradlew.bat :converter:build
```

## Usage

Show help:

```powershell
.\gradlew.bat :converter:run --args="--help"
```

Basic form:

```powershell
.\gradlew.bat :converter:run --args="-f <input> [-o <output>]"
```

The direction is decided by the input file extension:

| `-f` extension | direction | default output extension |
|---|---|---|
| `.log` | `log -> json` | `.json` |
| `.json` | `json -> log` | `.log` |

If `-o` is omitted, the output path defaults to the input path with the extension swapped.

If `-o` is present without the target extension, the Java converter appends the canonical one automatically.

## Examples

```powershell
# log -> json
.\gradlew.bat :converter:run --args="-f .\demo.log"

# json -> log
.\gradlew.bat :converter:run --args="-f .\demo.json"

# explicit output directory or prefix
.\gradlew.bat :converter:run --args="-f .\demo.log -o .\artifact\out"
# -> writes .\artifact\out.json
```

## JSON Contract

The JSON envelope uses this top-level shape:

- `format`
- `version`
- `meta`
- `events`

Where:

- `version` currently accepts `MKv1` and `MKv2`
- `meta` currently contains `width`, `height`, `startX`, and `startY`
- each item in `events` must be an object with **exactly one event-name key**

Supported event names:

- `MouseMove`
- `MouseDown`
- `MouseUp`
- `Wheel`
- `KeyDown`
- `KeyUp`

## Implementation Notes

- The Java converter reuses `java/core/` `Keycodes` for keyboard key-name and modifier mapping
- During `json -> log`, events are consumed in their original JSON order and are not reordered when timestamps go backwards
- Unknown key names, unknown mouse buttons, or more than 6 simultaneous non-modifier keys cause a hard conversion error

## Key Files

| File | Purpose |
|---|---|
| `src/main/java/io/github/elvuel/mkpkit/java/converter/ConverterCore.java` | codec and conversion state machines |
| `src/main/java/io/github/elvuel/mkpkit/java/converter/ConverterCli.java` | CLI parsing and execution |
| `src/main/java/io/github/elvuel/mkpkit/java/converter/Main.java` | CLI entry point |
