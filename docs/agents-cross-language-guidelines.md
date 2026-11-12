# Cross-Language Governance Basis for Root `AGENTS.md`

## Purpose

This document records the repository-internal basis for the root `AGENTS.md` policy in `mkp-kit`.
Its purpose is to explain why the monorepo should be maintained as one MKP SDK product across Go, Python, and Rust, while still allowing language-idiomatic implementation details.

## Source Scope

This note is based on the repository's normative Markdown documents, primarily:

- root `README.md` and `README.en.md`
- per-language `README.md` and `README.en.md`
- per-language `directives.md` and `directives.en.md`

## Governance Findings

### 1. Root policy belongs at the monorepo level

The root documentation explicitly defines `mkp-kit` as a monorepo that combines the former Go, Python, and Rust repositories, while keeping repo-level guidance at the repository root.

Source evidence:
- `README.md:17`
- `README.md:18`
- `README.md:19`
- `README.en.md:17`
- `README.en.md:18`
- `README.en.md:19`

Policy implication:
- The root `AGENTS.md` should govern cross-language rules, repository structure, and shared maintenance expectations.
- It should not impose one language's internal package, module, or crate layout onto the others.

### 2. Directive behavior is a shared SDK contract

The language ports expose the same MKP device protocol and document directive behavior as part of the maintained SDK surface.
Python documentation already treats parity with Go as an explicit maintenance concern, and Rust documentation mirrors Go's directive example layout and helper/controller surface.

Source evidence:
- `python/directives.md:448`
- `python/directives.md:449`
- `python/directives.en.md:448`
- `python/directives.en.md:449`
- `rust/directives.md:38`
- `rust/directives.md:39`
- `rust/directives.en.md:38`
- `rust/directives.en.md:39`
- `rust/directives.en.md:554`

Policy implication:
- Directive additions, removals, renames, parser changes, response-model changes, and behavior fixes should be reviewed across all language ports.
- If full parity is not completed in one change, the remaining gap should be documented explicitly.

### 3. Examples, helpers, controllers, and tools are part of the maintained public surface

The Go documentation presents examples, directive examples, helper APIs, and controller APIs as supported user-facing entry points. Rust similarly exposes helper, controller, CLI, server, and tool layers as maintained surfaces rather than incidental implementation details.

Source evidence:
- `go/README.md:104`
- `go/README.md:105`
- `go/README.md:114`
- `go/README.md:176`
- `go/README.md:177`
- `go/README.en.md:104`
- `go/README.en.md:114`
- `go/README.en.md:176`
- `go/README.en.md:177`
- `rust/directives.md:512`
- `rust/directives.md:513`
- `rust/directives.md:514`
- `rust/directives.md:515`
- `rust/directives.md:516`
- `rust/directives.en.md:550`
- `rust/directives.en.md:551`
- `rust/directives.en.md:552`

Policy implication:
- Cross-language maintenance should cover not only core directive send/parse code, but also helpers, controllers, examples, CLI/HTTP exposure, and relevant tools.

### 4. Documentation structure is intentionally aligned across languages

The repository has already been normalized so each language keeps parallel README and directive-reference structure, including example indexes and monorepo-relative path conventions.

Source evidence:
- `go/README.en.md:110`
- `python/directives.en.md:57`
- `python/directives.en.md:59`
- `rust/directives.en.md:58`
- `go/directives.en.md:54`
- `python/directives.md:59`
- `rust/directives.md:60`

Policy implication:
- Documentation updates should preserve structural parity where practical.
- When implementation changes are shared in nature, both Chinese and English normative docs should be updated together.

### 5. Synchronous parsing guidance is part of the contract

Each language documents prerequisites for synchronous directive parsing, such as read-loop setup, sync-output mode, and EOF/parser expectations.
These requirements materially affect user-visible behavior.

Source evidence:
- `go/directives.en.md:27`
- `go/directives.en.md:31`
- `python/directives.en.md:34`
- `python/directives.en.md:38`
- `python/directives.en.md:39`
- `python/directives.en.md:40`
- `rust/directives.en.md:28`
- `rust/directives.en.md:31`
- `rust/directives.en.md:32`

Policy implication:
- Contributors should not change synchronous transport or parser behavior in one port without checking the others and updating the related docs/examples.

## Resulting Root Policy Expectations

The root `AGENTS.md` should therefore require the following:

1. Treat `mkp-kit` as one SDK product with three language implementations.
2. Treat directive semantics, parser behavior, response models, examples, helpers, controllers, CLI/HTTP exposure, and normative docs as cross-language concerns by default.
3. Allow idiomatic naming and code organization within each language, while keeping device-visible behavior and documented expectations aligned.
4. Require explicit documentation when a parity gap remains.
5. Require focused validation for every touched language when practical.
6. Keep supplementary governance and maintenance notes under `docs/` at the repository root.

## Conclusion

The root `AGENTS.md` is best understood as a cross-language governance file for the MKP SDK monorepo.
It should coordinate shared behavior, documentation, and maintenance expectations across `go/`, `python/`, and `rust/`, while leaving language-specific implementation style to each subtree.
