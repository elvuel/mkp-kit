# AGENTS.md

## Scope

- This file applies to the entire `mkp-kit` monorepo unless a deeper `AGENTS.md` overrides it.
- `mkp-kit` is one MKP SDK product with seven language implementations: `go/`, `python/`, `rust/`, `node/`, `cpp/`, `dotnet/`, and `java/`.

## Skill Routing

- Repo-scoped Codex skills should live under `.agents/skills/` so they can be discovered automatically in new sessions.
- When a task creates scratch scripts, temporary logs, extracted intermediates, patch payloads, ad hoc dumps, or other disposable session artifacts, use the `artifact-cleanup` skill if available.
- Prefer isolating temporary artifacts under repo-local temp paths such as `.tmp_artifacts/<session-id>/` or clearly disposable `.tmp_*` names instead of scattering them through the repository.
- Before final handoff, clean disposable session artifacts or explicitly report why any temporary artifact was intentionally kept.

## Repo Model

- Treat feature parity, documentation parity, and bug-fix parity as repo-level concerns by default.
- Do not treat a requirement or bug as language-local unless the user explicitly scopes it that way or the root cause is clearly language-specific.
- Shared MKP semantics are repo contracts, not language-local details.
- Unless the root docs or an explicit parity exception say otherwise, `go/` is the default behavioral baseline for shared SDK behavior.
- Baseline does not mean blind copying. Each language may stay idiomatic, but user-visible semantics, documented meaning, and device-visible behavior must stay aligned.

## Canonical Shared Surface

For this monorepo, the following are shared contracts unless explicitly exempted:

- directive names, arguments, defaults, and error expectations
- user-visible model and data-structure fields
- JSON keys, casing, omission rules, and nullability expectations
- parser preflight, EOF or prompt stripping, and raw-to-typed wrapper behavior
- helper, controller, client, and service return shapes
- CLI and HTTP request or response shapes, when exposed
- example command shapes and example output shapes
- `README.md` / `README.en.md` section structure and section intent
- `directives.md` / `directives.en.md` section structure and section intent
- shared terminology for the same MKP concept

If a shared difference is intentional, document it in the affected language docs and in `docs/parity-exceptions.md`.
If a shared difference is not documented there, treat it as unintended drift and fix it.

## Cross-Language Change Rules

When a change touches any shared SDK surface, review all seven language directories:

- directives and parsers
- helper / model wrappers
- controller behavior
- CLI / HTTP behavior
- tools, converters, and file-server flows
- examples and example indexes
- README / directives docs in both Chinese and English

When doing shared-surface work:

- Start from the current `go/` behavior and docs as the default baseline.
- Cross-check at least two non-Go implementations before declaring parity work complete.
- Do not copy Go blindly. If Go, root docs, and another language disagree, reconcile the contract explicitly.
- If Go is outdated relative to the agreed repo contract, update Go as part of the same task instead of propagating stale behavior.
- Update `go/`, `python/`, `rust/`, `node/`, `cpp/`, `dotnet/`, and `java/` in the same task when practical.
- Do not leave silent behavior drift, model drift, example drift, or documentation drift.

## Structural Parity Requirements

Unless `docs/parity-exceptions.md` says otherwise, keep these aligned across languages:

- model or data-structure names and user-visible fields
- example output shape for the same directive or workflow
- parser behavior and typed-wrapper behavior for the same response
- `README.md` / `README.en.md` high-level section structure
- `directives.md` / `directives.en.md` high-level section structure
- example indexes and command-path conventions
- terminology for the same SDK capability

Aligned means equivalent behavior and documented meaning, not identical syntax.

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

`README.md` and `README.en.md` should keep comparable high-level sections across languages:

- installation
- quick start
- examples
- language-specific surface area
- repository layout
- language-specific notes

`directives.md` and `directives.en.md` should keep comparable high-level sections across languages:

- scope or positioning
- language conventions
- example index
- API mapping
- output parser index
- response model index
- CLI / client / server / converter mapping
- known differences

If a section is not applicable in one language, keep the section and state that explicitly instead of deleting it silently.

## Directive / SDK Checklist

When adding or changing a directive or SDK behavior, check at least:

- parser registration and EOF assumptions
- helper return models / typed wrappers
- response models and JSON field names
- examples and example output shape
- CLI / server exposure, if applicable
- user-facing docs in both languages
- whether a parity exception entry is required

## Shared-Surface Completion Gate

A shared-surface task is not complete until one of the following is true for each relevant surface:

- shared model or data-structure changes are aligned across languages
- parser or wrapper behavior is aligned across languages
- examples and example outputs are aligned across languages
- touched README / directives docs are aligned in Chinese and English
- every intentional difference is recorded in `docs/parity-exceptions.md`
- validation was run for each touched language when practical, or the exact unverified gap is stated explicitly

If those conditions are not met, report the remaining gap clearly instead of implying parity is complete.

## Validation

- Run focused validation for each touched language when practical.
- Prefer the smallest meaningful validation first, then broader checks if needed.
- For parity-sensitive changes, validate at least one baseline path and one non-Go path when practical.
- If hardware, serial devices, or environment dependencies prevent verification, say exactly what was not verified.

## Parity Exceptions

- `docs/parity-exceptions.md` is the source of truth for intentional cross-language deviations.
- Record one entry per intentional exception.
- Each entry must identify the affected language set, shared surface, exact difference, reason, user-visible impact, required doc updates, validation notes, and follow-up.
- If an exception is resolved, remove or update the entry in the same task.

## Working Style

- Prefer small, scoped changes over broad refactors for symmetry alone.
- Compare `go/`, `python/`, `rust/`, `node/`, `cpp/`, `dotnet/`, and `java/` before editing shared surfaces.
- Fix drift at the contract level rather than papering over a one-language symptom.
- Do not mark shared work complete if models, examples, or docs still diverge silently.