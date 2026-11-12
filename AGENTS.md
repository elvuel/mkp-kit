# AGENTS.md

## Scope

- This file applies to the entire `mkp-kit` monorepo unless a deeper `AGENTS.md` overrides it.
- `mkp-kit` is one MKP SDK product with five language implementations: `go/`, `python/`, `rust/`, `node/`, and `cpp/`.

## Repo Model

- Treat feature parity, documentation parity, and bug-fix parity as repo-level concerns by default.
- Do not treat a requirement or bug as language-local unless the user explicitly scopes it that way or the root cause is clearly language-specific.
- Language APIs may remain idiomatic, but device-visible behavior, directive semantics, default values, and documented expectations should stay aligned.

## Cross-Language Change Rules

When a change touches any shared SDK surface, review all five language directories:

- directives and parsers
- helper / model wrappers
- controller behavior
- CLI / HTTP behavior
- tools, converters, and file-server flows
- examples and example indexes
- README / directives docs in both Chinese and English

If the change is shared in nature, update `go/`, `python/`, `rust/`, `node/`, and `cpp/` in the same task when practical.

If full parity cannot be completed in the same task:

- document the exact remaining gap explicitly in the affected docs or a repo note
- do not leave silent behavior or documentation drift

## Documentation Rules

- Keep repo-wide structure and workflow docs at the monorepo root.
- Supplementary governance, research, and maintenance notes should live under `docs/` at the repository root.
- Keep language-specific implementation docs inside their own language directory.
- For any affected language, keep these files aligned with the actual implementation:
  - `README.md`
  - `README.en.md`
  - `directives.md`
  - `directives.en.md`
- Preserve the monorepo path context in docs. Paths and commands inside language docs should be written relative to that language directory unless the document states otherwise.

## Directive / SDK Checklist

When adding or changing a directive or SDK behavior, check at least:

- parser registration and EOF assumptions
- helper return models / typed wrappers
- examples
- CLI / server exposure, if applicable
- user-facing docs in both languages

## Validation

- Run focused validation for each touched language when practical.
- Prefer the smallest meaningful validation first, then broader checks if needed.
- If hardware, serial devices, or environment dependencies prevent verification, say exactly what was not verified.

## Working Style

- Prefer small, scoped changes over broad refactors for symmetry alone.
- Keep differences explicit. If one language intentionally behaves differently, document that difference.
- Go can be a useful historical comparison target, but it is not the only source of truth for this monorepo.
- When uncertain, compare the existing Go, Python, Rust, Node.js, and C++ implementations and docs before editing.

