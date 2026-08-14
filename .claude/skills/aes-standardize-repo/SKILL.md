---
name: aes-standardize-repo
description: Standardize an existing repository or create a new repository with a zero-install run interface consisting of cross-platform wrappers, run.toml, and a dependency-free Node runner. Use when Codex needs to make repository setup, development, build, check, typecheck, test, gate, or distribution operations discoverable through bare ./run or .\run, safely previewable with -n, executable as first-level actions, and machine-readable with --json.
disable-model-invocation: true
---

# Standardize a repository

Add the run standard as the first independently versioned standardization phase. Keep future repository standards additive; do not expand this phase beyond the run interface.

## Choose the path

1. Use the existing-repository path when the target directory already contains project files.
2. Use the creation path only when the target is intended to become a new repository; initialize Git, then apply the same run generation flow.
3. Resolve and follow every applicable `AGENTS.md` before changing the target.

## Inspect before generating

1. Read package manifests, lockfiles, task-runner configuration, `README*`, and `AGENTS.md` files.
2. Extract only repository operations: setup, development/start, build, check, typecheck, test/gate, and distribution.
3. Keep Git commands out of the action list.
4. Preserve existing commands exactly; map to them instead of replacing or rewriting them.
5. Check the proposed ids and argv against [references/run-standard.md](references/run-standard.md).

## Generate the interface

Run the bundled generator from any directory. Replace `<repo>` and `<namespace/name>` with resolved values.

```powershell
node <skill-dir>/scripts/standardize_repo.mjs <repo> --project-id <namespace/name>
```

For an empty directory that must become a new repository, add `--create`:

```powershell
node <skill-dir>/scripts/standardize_repo.mjs <repo> --create --project-id <namespace/name>
```

The generator copies the templates from `assets/run/`, creates `run.toml`, preserves existing `AGENTS.md` bytes, and appends only this integration sentence:

```text
本仓库标准操作：`.\run` 发现，`.\run <id> -n` 预览，`.\run <id>` 执行，`--json` 机器可读。
```

Do not pass `--force` unless the user explicitly authorizes replacing an existing run interface. Treat generated `run.toml` as a candidate until repository-specific argv have been reviewed.

The generated runner parses `run.toml` with the vendored, zero-runtime-dependency TOML parser under `scripts/vendor/toml/`. It accepts the complete TOML 1.0 syntax, including multiline arrays, comments, quoted keys, inline tables, and date/time literals; the `run/v1` schema still restricts the resulting document to `[project].id` and `[[actions]]` entries with `id`, `name`, `kind`, and string-array `run`.

## Review the action map

1. Keep `[project]` and `[[actions]]` as the only top-level table forms.
2. Keep core actions supported by the repository; add project-specific development, test, gate, and distribution variants when authoritative task definitions expose them.
3. Represent every command as an explicit argv array. Never use shell strings, pipes, redirection, command chaining, or implicit working-directory changes.
4. Mark gate actions by `kind = "gate"`; the runner derives availability from the executable, so future installation activates them without changing the interface.
5. Never place `list`, `show`, `doctor`, `help`, or `run` in action ids.
6. Do not replace TOML arrays with JSON as a workaround. The generated runner owns TOML parsing; formatter-written multiline arrays and comments are valid input.

## Validate the result

Run all checks from the repository root:

```powershell
.\run
.\run doctor
.\run <safe-action> -n
.\run list --json
```

On macOS or Linux, use `./run`. Confirm that bare run lists actions, doctor distinguishes optional unavailable gate tooling from failures, preview launches no child process, and JSON stdout parses as one JSON document. Execute at least one safe real action and verify that its exit code is unchanged.

Read [references/run-standard.md](references/run-standard.md) before changing protocol fields, reserved words, exit semantics, or machine output. Validate this skill with the skill-creator `quick_validate.py` after modifying its instructions or resources.
