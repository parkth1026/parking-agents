---
name: rust-workflow
description: >
  Rust/Cargo development workflow for AI coding. Defines fast flow (inner loop)
  and full flow (quality gate) strategies based on Deno CLAUDE.md, Ruff AGENTS.md,
  and uv AGENTS.md real-world practices. Use when writing, checking, testing,
  or committing Rust code.
user-invocable: false
---

# Rust/Cargo AI Coding Workflow

## Two-Tier Strategy

### Fast Flow (Inner Loop) — While Writing Code

- **Do NOT manually run** `cargo fmt`, `cargo clippy`, or `cargo test` during iteration
- Rely on **rust-analyzer on-save** (configured with `check.command: "clippy"`) for real-time feedback
- For single-crate changes: `cargo check -p <crate_name>` (~1-3s)
- Use `cargo check` instead of `cargo build` (2-3x faster, no binary output)
- Only run tests on the modified crate: `cargo nextest run -p <crate_name>`

### Full Flow (Quality Gate) — Before Commit

Pre-commit hook handles this automatically. Just run `git commit`.

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo nextest run --workspace
```

## Code Discipline

### MUST follow (from Deno + Ruff + uv consensus)

**Error Handling:**
- **Never** use `panic!()`, `unwrap()`, or `unreachable!()` in production code
- Use `Result<T, E>` + `?` operator for error handling
- Use `.expect("meaningful message")` only where panic is truly the right behavior

**Linting:**
- Use `#[expect()]` instead of `#[allow()]` for clippy lint suppression

**Build & Test Efficiency:**
- Prefer `debug` build for development; `release` only when needed
- Prefer running only the tests relevant to the modified code over the full test suite

### Code Style

- Follow `rustfmt` defaults (configured in `rustfmt.toml`)
- Use `thiserror` for library error types, `anyhow` for application error types
- Prefer strong typing with enums over stringly-typed code
- Use `Option<T>` instead of sentinel values
- All public APIs must have doc comments

## Testing

- Unit tests: `#[cfg(test)] mod tests` at bottom of source files
- Integration tests: `tests/` directory
- Use `cargo nextest run` (1.4x-3.4x faster than `cargo test`)
- Tokio async tests: `#[tokio::test]` (supported by nextest)
- Test naming: `test_<function>_<scenario>_<expected>`

## Key VS Code Settings (already configured)

```jsonc
{
  "rust-analyzer.check.command": "clippy",
  "rust-analyzer.checkOnSave": true,
  "rust-analyzer.cargo.targetDir": true  // 13x speedup
}
```

## Evidence Sources

- [Deno CLAUDE.md](https://github.com/denoland/deno/blob/main/CLAUDE.md)
- [Ruff AGENTS.md](https://github.com/astral-sh/ruff/blob/main/AGENTS.md)
- [uv AGENTS.md](https://github.com/astral-sh/uv/blob/main/AGENTS.md)
- [corrode.dev compile optimization](https://corrode.dev/blog/tips-for-faster-rust-compile-times/)
