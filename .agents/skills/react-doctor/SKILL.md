---
name: react-doctor
description: Use when finishing a feature, fixing a bug, before committing React code, or when the user wants to improve code quality or clean up a codebase. Checks for score regression. Covers lint, accessibility, bundle size, architecture diagnostics.
disable-model-invocation: true
---

# React Doctor

Scans React codebases for security, performance, correctness, and architecture issues. Outputs a 0–100 health score.

## After making React code changes:

Run the repository-locked command `npx --no-install react-doctor --verbose --diff` and check the score did not regress. Only use `npx react-doctor@latest` after the user explicitly allows network download and an unpinned package.

If the score dropped, fix the regressions before committing.

## For general cleanup or code improvement:

Run `npx --no-install react-doctor --verbose` (without `--diff`) to scan the full codebase. Fix issues by severity — errors first, then warnings. If the locked package is unavailable, report that fact instead of silently downloading a latest version.

## Command

```bash
npx --no-install react-doctor --verbose --diff
```

| Flag        | Purpose                                       |
| ----------- | --------------------------------------------- |
| `.`         | Scan current directory                        |
| `--verbose` | Show affected files and line numbers per rule |
| `--diff`    | Only scan changed files vs base branch        |
| `--score`   | Output only the numeric score                 |
