# Parity Exceptions

This file records intentional cross-language deviations for shared MKP SDK behavior.

If a shared difference is not recorded here, treat it as unintended drift and fix it.

## Rules

- One entry per intentional exception.
- Keep entries concise but specific.
- Update or remove the entry as soon as the gap is resolved.
- Link the affected language docs when the difference is user-visible.

## Entry Template

```md
## <short exception title>

- Status: temporary | permanent
- Affected languages: <go/python/rust/node/cpp/dotnet/java>
- Shared surface: <directive/model/parser/example/cli/http/doc structure>
- Scope: <specific directive, model, endpoint, example, or doc section>
- Baseline: <what Go or the agreed repo contract does>
- Current difference: <exact deviation>
- Reason: <why the difference exists>
- User-visible impact: <none | describe impact>
- Required doc updates:
  - <language>/README.md
  - <language>/README.en.md
  - <language>/directives.md
  - <language>/directives.en.md
- Validation notes: <what was or was not verified>
- Follow-up: <what must happen to remove this exception>
```

## Active Exceptions

None currently. Add a new entry above when an intentional deviation is introduced.