# Cross-Language Governance Basis for Root `AGENTS.md`

## Purpose

This document records the governance basis for the root `AGENTS.md` policy in `mkp-kit`.
It explains why the monorepo should be maintained as one MKP SDK product across `go/`, `python/`, `rust/`, `node/`, `cpp/`, `dotnet/`, and `java/`, while still allowing language-idiomatic implementation details.

This file is a governance note, not a replacement for the root `AGENTS.md`.
When there is any ambiguity, the root `AGENTS.md` is the operative rule set.

## Repository Position

- `mkp-kit` is one monorepo for one MKP SDK product.
- The language directories are multiple implementations of the same shared device-facing SDK contract.
- Language-specific syntax, packaging, and ecosystem conventions may differ, but shared semantics should not drift silently.

## Governance Basis

### 1. Shared behavior is a repo-level concern

Feature parity, bug-fix parity, and documentation parity are repo-level concerns by default.
A requirement or bug should not be treated as language-local unless the user explicitly scopes it that way or the root cause is clearly language-specific.

Implication:

- shared SDK work should begin with a repo-level parity mindset
- one-language-only fixes require an explicit reason

### 2. `go/` is the default baseline for shared semantics

The monorepo needs one practical default comparison target to reduce ambiguity during porting and maintenance.
For `mkp-kit`, that default baseline is `go/` unless the root docs or an explicit parity exception say otherwise.

Implication:

- start parity analysis from the current Go behavior and docs
- do not copy Go blindly when Go is outdated or when another repo-level contract supersedes it
- if Go is stale, update Go too instead of propagating stale behavior into other languages

### 3. Shared contracts include more than directive names

Parity work must treat the following as shared SDK contracts unless explicitly exempted:

- directive names, arguments, defaults, and error expectations
- user-visible model and data-structure fields
- JSON keys, casing, omission rules, and nullability expectations
- parser preflight, prompt or EOF stripping, and raw-to-typed wrapper behavior
- helper, controller, client, and service return shapes
- CLI and HTTP request or response shapes, when exposed
- example command forms and example output forms
- repo terminology for the same MKP concept
- `README.md` / `README.en.md` section structure and section intent
- `directives.md` / `directives.en.md` section structure and section intent

Implication:

- model drift is parity drift
- example-output drift is parity drift
- documentation-structure drift is parity drift

### 4. Cross-checking must be multi-language, not one-way

Using Go as the baseline is necessary but not sufficient.
To avoid one-language implementation bias, parity-sensitive work should also cross-check at least two non-Go implementations before being declared complete.

Implication:

- compare Go with at least two of `python/`, `rust/`, `node/`, `cpp/`, `dotnet/`, or `java/`
- if Go, docs, and another language disagree, reconcile the contract explicitly instead of choosing implicitly
- use the comparison to catch stale assumptions, not just to copy signatures

### 5. Documentation structure is part of the contract

In this monorepo, documentation is intentionally maintained as a parallel, user-facing surface across languages.
The structure and section intent of language READMEs and directive references are part of the maintained contract because users navigate them comparatively.

Implication:

- `README.md` / `README.en.md` should keep comparable high-level sections across languages
- `directives.md` / `directives.en.md` should keep comparable high-level sections across languages
- when a section is not applicable, the section should remain and say so explicitly rather than disappearing silently

### 6. Completion requires explicit parity closure

Shared-surface work is not complete just because one implementation compiles or one example runs.
Completion requires either cross-language alignment or an explicit recorded exception.

Implication:

- shared model, parser, example, CLI or HTTP, and doc changes should be aligned across touched languages when practical
- if not aligned, the remaining gap must be stated explicitly
- silent divergence should be treated as unfinished work

### 7. Intentional deviations need a registry

The monorepo needs a single place to record intentional cross-language differences.
That registry is `docs/parity-exceptions.md`.

Implication:

- if a shared difference is intentional, record it there
- if a shared difference is not recorded there, treat it as unintended drift
- remove or update the entry when the deviation is resolved

### 8. Validation should prove parity-sensitive paths when practical

Validation should not be limited to the language being edited when the change affects a shared contract.
At minimum, parity-sensitive work should validate one baseline path and one non-Go path when practical.

Implication:

- prefer focused checks first
- record exact hardware or environment gaps when verification is blocked
- do not imply full parity validation when only one implementation was exercised

## Resulting Expectations for Contributors and Agents

The root `AGENTS.md` should therefore enforce the following working model:

1. Treat `mkp-kit` as one SDK product with seven language implementations.
2. Treat directives, parsers, models, wrappers, helpers, controllers, CLI or HTTP surfaces, examples, and normative docs as shared concerns by default.
3. Use `go/` as the default baseline for shared behavior unless superseded by root docs or an explicit parity exception.
4. Cross-check at least two non-Go implementations before declaring parity-sensitive work complete.
5. Treat documentation structure as part of the maintained contract, not as an incidental formatting detail.
6. Require explicit recording of any intentional cross-language deviation in `docs/parity-exceptions.md`.
7. Require clear disclosure of any remaining gap when full parity is not completed in the same task.
8. Require focused multi-language validation when practical.

## Practical Review Lens

When reviewing a shared SDK change, ask at least:

- does Go define the current baseline behavior clearly
- do at least two non-Go implementations agree with the intended contract
- are model fields and JSON shapes still aligned
- do typed wrappers and parser assumptions still match
- do examples still show the same user-visible behavior
- do `README*` and `directives*` keep the expected section structure and intent
- if there is intentional drift, is it recorded in `docs/parity-exceptions.md`

## Conclusion

The root `AGENTS.md` should be read as a strong cross-language governance file for the MKP SDK monorepo.
Its job is to keep shared behavior, models, examples, and documentation aligned across all language implementations, while still allowing each language subtree to remain idiomatic in code organization and style.