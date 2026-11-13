---
name: artifact-cleanup
description: Track and remove session-created temporary artifacts that could interfere with later commands, parsing, builds, or diffs.
metadata:
  short-description: Remove session temp artifacts safely
---

# Artifact Cleanup

## Purpose

Prevent stale intermediate files, debug logs, extracted byproducts, and temporary scripts from polluting the workspace or interfering with later reasoning, parsing, builds, examples, diffs, or validation steps.

## Use this skill when

- you create scratch scripts, patch files, or throwaway notes
- you redirect command output into temporary files for diagnosis
- you create disposable build or extraction directories for one-off verification
- you download or unpack intermediate assets needed only during the current task
- repeated runs may read stale output left by an earlier step

Do not use this skill to remove normal source files, committed assets, expected build outputs, or durable user data unless the user explicitly asks for that cleanup.

## Core Rules

1. **Isolate Temporary Outputs**: Write temporary scripts, intermediate dumps, extracted scratch data, and one-off logs into a dedicated workspace-local temp area such as `.tmp_artifacts/<session-id>/`, or use clearly disposable names such as `.tmp_*`. Do not scatter temporary files across the repo root unless the user explicitly asks for that layout.
2. **Track All Creations**: Maintain an internal manifest of temporary files and directories created solely for intermediate reasoning, testing, inspection, or data transformation during the current task.
3. **Verify Before Removal**: Never delete user-authored source files, pre-existing datasets, lockfiles, fixtures, expected build outputs, or requested deliverables. When unsure whether something is disposable, keep it and report it instead of deleting it silently.
4. **Prefer Targeted Cleanup**: Remove only the tracked disposable set rather than broad directories or pattern-based sweeps when a precise cleanup is possible.
5. **Execute Teardown Promptly**: After final verification or immediately before handing off the final response, remove tracked temporary files and any now-empty temporary directories created only for those artifacts.
6. **Reset Context**: After deletion, do not refer to removed temporary artifacts as active resources in future turns.

## Cleanup Workflow

1. **Before Running Tools**: Decide whether the next step needs a temporary file, script, dump, or extraction directory. If yes, route it into `.tmp_artifacts/<session-id>/` or give it a clearly disposable `.tmp_*` name.
2. **During Execution**: Log each created temporary file or directory in the internal manifest, including scratch scripts, patch payloads, captured logs, extracted archives, and ad hoc verification outputs.
3. **Before Cleanup**: Separate tracked paths into `safe to delete`, `keep for user visibility`, and `uncertain`.
4. **Teardown**: Delete only the `safe to delete` set, then remove empty temp directories created solely for those artifacts.
5. **Clean-State Check**: When cleanup is relevant to correctness, confirm the workspace has returned to the intended state by checking `git status`, a focused directory listing, or another minimal verification against the expected post-task baseline.
6. **Final Handoff**: Report what was deleted, what was intentionally kept, and any uncertain artifacts left in place.

## Typical Removable Artifacts

- temporary patch files
- scratch PowerShell, Bash, Python, Node.js, or other one-off helper scripts
- captured stdout or stderr logs written only for the current investigation
- extracted archives used only for inspection
- temp verification outputs such as ad hoc JSON dumps or text snapshots
- temporary build directories created solely for exploratory validation and not part of the repo's normal workflow

## Avoid Deleting Without Explicit Reason

- language package caches and lockfiles
- expected repo build directories that are part of normal developer workflow
- generated outputs that users may inspect or compare
- fixtures, examples, golden files, or snapshots used by tests or docs
- files outside the repo root unless the user explicitly scoped them
- any artifact that may still be needed for debugging, audit, or a requested deliverable

## Final Handoff

In the final response, list the deleted paths when the cleanup is user-visible or relevant to later steps. Also mention any leftover uncertain artifacts that were intentionally not removed.