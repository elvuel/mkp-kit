# MKP Kit

[中文](./README.md) | English | [Shared Command Reference](./directives.en.md)

---

`mkp-kit` is the monorepo for the MKP device SDK, maintained across Go, Python, and Rust.

## What is MKP?

**MKP** is a serial-controlled **mouse / keyboard recording, replay, and file-management device protocol**.

A typical flow looks like this:

```text
Host program -> serial port -> MKP device / firmware -> USB HID mouse / keyboard events -> target system
```

All three language ports therefore share the same device protocol, the same directive semantics, and the same device-side recording / replay / file-management capabilities.

## Monorepo Positioning

`mkp-kit` no longer treats Go, Python, and Rust as unrelated repositories. It treats them as **three language implementations of one SDK product**.

The following should therefore be maintained as cross-language concerns by default:

- directive semantics and default behavior
- parser / response-model contract meaning
- example coverage and documented behavior
- bilingual README / directive reference docs
- consistency of feature work and bug fixes

## Shared Capability Overview

| Capability | Description | Typical directives |
|---|---|---|
| Serial connectivity | Open devices, send raw directives, and wait for synchronous or asynchronous output | language-specific `send_directive` / `send_parsed` wrappers |
| Mouse control | Relative movement, buttons, wheel, release-all | `m10` |
| Keyboard control | Key down, key up, tap, combinations | `kpad` |
| Recording / replay | Device-side recording, stop, cancel, replay | `alog`, `astop`, `acancel`, `aplay` |
| File management | Browse directories, delete files, clean directories, import/export logs | `list_dir`, `delete_file`, `clean_dir`, `aget`, `aput`, `ajson2log` |
| Device information | Serial number, heartbeat, version, log duration, log inspection | `sn`, `alive`, `aversion`, `atime`, `ainsp` |
| Network configuration | Wi‑Fi and device-side HTTP base configuration | `join`, `wifi_auto`, `ahttpbase` |

For shared directive semantics, use [`directives.en.md`](./directives.en.md).

## Repository Layout

- `go/`: Go SDK, helpers, controller, examples, and language-specific supplement docs
- `python/`: Python SDK, server, CLI, converter, file server, examples, and language-specific supplement docs
- `rust/`: Rust SDK, server, CLI, converter, file server, examples, and language-specific supplement docs
- `docs/`: repo-level governance, research, and maintenance notes

## Documentation Strategy

Documentation now follows a two-layer structure:

1. **Root shared docs** for cross-language content
   - `README.md` / `README.en.md`
   - `directives.md` / `directives.en.md`
2. **Language-subdirectory supplements** for implementation-specific content
   - installation steps
   - import / package / crate names
   - example run commands
   - helper / controller / CLI / HTTP exposure differences
   - parser registration details, response-model naming differences, and known limitations

In practice, this means:

- shared background, shared directive meaning, and shared maintenance policy should be updated at the repository root first
- language docs should converge toward “how to use this language port” plus “how it differs”
- if one language cannot fully match the others yet, the gap should be documented explicitly in that language subtree

## Language Entry Points

- Go: `go/README.md`
- Python: `python/README.md`
- Rust: `rust/README.md`

Language-specific directive supplements:

- Go: `go/directives.en.md`
- Python: `python/directives.en.md`
- Rust: `rust/directives.en.md`

## Directory Mapping

- former `mkp-go` -> `go/`
- former `mkp-python` -> `python/`
- former `mkp-rust` -> `rust/`

## History

This merge keeps the existing Git histories by importing each project with subtree:

- `go/` <- `mkp-go`
- `python/` <- `mkp-python`
- `rust/` <- `mkp-rust`
