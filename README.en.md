# MKP Kit

[中文](./README.md) | English

---

`mkp-kit` is a monorepo that merges `mkp-go`, `mkp-python`, and `mkp-rust`.

## Repository Layout

- `go/`: Go SDK, helpers, controller, examples, and directive docs
- `python/`: Python SDK, server, CLI, converter, file server, examples, and directive docs
- `rust/`: Rust SDK, server, CLI, converter, file server, examples, and directive docs

## Directory Mapping

- former `mkp-go` -> `go/`
- former `mkp-python` -> `python/`
- former `mkp-rust` -> `rust/`

## Language Entry Points

- Go: `go/README.md`
- Python: `python/README.md`
- Rust: `rust/README.md`

## Maintenance Notes

- Each language keeps its own package / module / crate structure
- Language-specific docs, examples, and tests stay inside their own subdirectory
- Cross-language guidance, release policy, and repo-level conventions should live at the repository root

## History

This merge keeps the existing Git histories by importing each project with subtree:

- `go/` <- `mkp-go`
- `python/` <- `mkp-python`
- `rust/` <- `mkp-rust`
