# MKP Shared Command Reference

[中文](./directives.md) | English | [Shared Overview](./README.en.md)

---

## Table of Contents

- [Document Scope](#document-scope)
- [Shared Conventions](#shared-conventions)
- [Shared Directive Overview](#shared-directive-overview)
- [Synchronous and Asynchronous Rules](#synchronous-and-asynchronous-rules)
- [Recording and Replay Commands](#recording-and-replay-commands)
- [Device Network and Filesystem Commands](#device-network-and-filesystem-commands)
- [Mouse Command m10](#mouse-command-m10)
- [Keyboard Command kpad](#keyboard-command-kpad)
- [Language Supplement Docs](#language-supplement-docs)

## Document Scope

This document maintains the **shared MKP directive semantics across Go, Python, Rust, Node.js, C++, and .NET**.

It describes:

- what each directive is for
- the meaning of common inputs
- contract-level synchronous / asynchronous behavior
- shared expectations for device output
- protocol-level meaning of `m10` and `kpad`

It does **not** own language-specific details such as:

- import / package / crate names
- exact helper / controller function names
- parser registration implementation details
- language-specific HTTP / CLI wrappers
- known limitations in a single port

Those belong in the language supplement docs.

## Shared Conventions

- Unless stated otherwise, MKP CLI directives are written with the device-required line ending.
- The same directive should keep aligned default behavior, success meaning, and failure meaning across all six ports as much as practical.
- If one language cannot fully match the others yet, the gap should be documented explicitly in that language supplement instead of silently drifting.
- Language naming can remain idiomatic, but the mapping back to the raw directive should stay easy to find.

## Shared Directive Overview

| Directive | Category | Shared meaning | Typical output |
|---|---|---|---|
| `alog` | recording | Start device-side recording | text success output |
| `aplay` | replay | Start replaying a recorded log | usually async start |
| `astop` | recording | Stop the current recording | text stop output |
| `acancel` | replay | Cancel the current replay task | text or JSON status |
| `sn` | device info | Query the device serial number | JSON |
| `alive` | device info | Query liveness / heartbeat | JSON |
| `aversion` | device info | Query version information | JSON |
| `atime` | log info | Query log duration | JSON |
| `ainsp` | log info | Query basic log information | JSON |
| `list_dir` | filesystem | List a directory | JSON |
| `clean_dir` | filesystem | Clean a directory | text |
| `delete_file` | filesystem | Delete a file | text |
| `aget` | transfer | Pull a file from the file server into MKP | text |
| `aput` | transfer | Upload a file from MKP to the file server | text |
| `adumj` | conversion | Convert a device log into action JSON | JSON |
| `ajson2log` | conversion | Convert action JSON back into MKP log format | text |
| `join` | network | Connect to Wi‑Fi | text |
| `wifi_auto` | network | Query or set Wi‑Fi auto-connect | text |
| `ahttpbase` | network | Query or set the file-service base URL | JSON or text |
| `m10` | mouse | Send one relative mouse action | usually no structured output |
| `kpad` | keyboard | Send one keyboard action packet | usually no structured output |

## Synchronous and Asynchronous Rules

Shared rules:

- `m10` and `kpad` are typically used as control directives that do not rely on structured output.
- Directives whose responses need to be parsed must first satisfy the language-specific read-loop / sync-output setup requirements.
- Parser correctness depends both on device output and on whether the language port registers the correct EOF / prompt behavior for that directive.
- When device output mixes echo, prompts, plain text, and JSON, language ports usually need to trim outer noise before extracting the JSON body.

In other words, the shared contract owns **what the directive is supposed to mean and return**, while the language supplement explains **how that port reads it reliably**.

## Recording and Replay Commands

### `alog`

- Purpose: start device-side recording.
- Common input: log name, optionally with recording parameters such as dimensions or start position.
- Shared expectation: on success, the device enters a recording state.

### `aplay`

- Purpose: replay a recorded log.
- Common input: record name, optionally with delay or replay options.
- Shared expectation: many ports treat it as a “start operation” and pair it with status polling or later `acancel` handling.

### `astop`

- Purpose: stop the current recording.
- Shared expectation: if the device is recording, the directive should return a stop-success indication.

### `acancel`

- Purpose: cancel the current replay task.
- Shared expectation: return cancellation state; exact text details may vary slightly by firmware version.

## Device Network and Filesystem Commands

### Device information

- `sn`: device serial number
- `alive`: liveness / heartbeat
- `aversion`: version information
- `atime`: log duration
- `ainsp`: basic log inspection

These directives commonly share one trait: **they usually expose a JSON body that can be structured by the language port**.

### Filesystem

- `list_dir`: list directory contents
- `clean_dir`: clean a directory
- `delete_file`: delete a file

Common behavior:

- `list_dir` usually returns a JSON directory structure
- `clean_dir` / `delete_file` more often use plain-text success or failure output
- many ports add safety restrictions such as limiting destructive actions to `/eMMC/applog`

### Transfer and conversion

- `aget`: file server -> MKP
- `aput`: MKP -> file server
- `adumj`: device log -> JSON
- `ajson2log`: JSON -> device log

These directives are often used together with local tools, a file server, and path conventions. The shared semantics stay aligned, while local wrappers remain language-specific.

### Network configuration

- `join`: connect to Wi‑Fi
- `wifi_auto`: query or set Wi‑Fi auto-connect
- `ahttpbase`: query or set the file-service base URL

Shared emphasis:

- `join` usually returns textual status
- `wifi_auto` may support both read and write modes
- `ahttpbase` may either query the current value or update it

## Mouse Command `m10`

At the protocol level, `m10` represents one mouse action, typically including:

- button state
- relative X / Y movement
- wheel delta
- release-all intent
- synchronous / asynchronous send preference as wrapped by the language port

Shared interpretation:

- it is a **device control directive**, not primarily a structured-response query
- higher-level dragging, segmented movement, and human-like trajectories are usually built on top of `m10` by helpers or controllers in each language

## Keyboard Command `kpad`

At the protocol level, `kpad` represents one keyboard action packet, typically including:

- modifier-key state
- normal key slots
- release intent
- optional delay
- synchronous / asynchronous send preference as wrapped by the language port

Shared interpretation:

- `kpad` expresses low-level keyboard packets, not high-level text-entry semantics
- behavior such as typing `Hello MKP!` is usually decomposed by language helpers into multiple `kpad` or `key_tap` calls

## Language Supplement Docs

- Go: `go/directives.en.md`
- Python: `python/directives.en.md`
- Rust: `rust/directives.en.md`
- Node.js: `node/directives.en.md`
- C++: `cpp/directives.en.md`
- .NET: `dotnet/directives.en.md`

Those documents should keep only implementation-specific details such as:

- synchronous initialization steps
- example paths and run commands
- helper / controller / CLI / HTTP mappings
- parser registries
- response-model names
- known differences and limitations

