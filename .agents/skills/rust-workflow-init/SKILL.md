---
name: rust-workflow-init
description: 为当前 Rust 项目初始化双流开发工作流（Fast Flow + Full Flow），创建 CLAUDE.md、AGENTS.md、VS Code 配置、pre-commit hook 等。用户明确要求搭建或重新生成 Rust AI 开发环境时使用；执行前检查现有配置并说明将要写入的文件。
disable-model-invocation: true
argument-hint: "[rust最佳AI开发环境搭建]"
---

# Rust 双流工作流初始化

为当前项目配置基于 Deno / Ruff / uv 最佳实践的 Rust 开发工作流。

## 前置检查

1. 确认项目根目录存在 `Cargo.toml`（如果提供了项目路径参数，使用该路径）
2. 读取根 `Cargo.toml`，提取以下信息：
   - `[package].name` — 项目名称（workspace 项目取 workspace 级别的名称或目录名）
   - `[package].edition` — Rust edition（2021 / 2024 等）
   - `[workspace].members` — workspace 成员列表（如果是 workspace 项目）
3. 检查是否为 workspace（`[workspace]` 存在）
4. 检查已有的配置文件，避免覆盖用户自定义内容
5. 检查工具链是否就绪：
   - 运行 `cargo nextest --version`；缺失时先报告将安装的版本和范围，取得确认后再运行 `cargo install cargo-nextest --locked`
   - 运行 `rustup component list --installed`；缺失时先报告组件和目标 toolchain，取得确认后再运行 `rustup component add rustfmt`

## 写入与安装边界

先列出将创建或修改的文件，以及将安装或补齐的工具；取得用户确认后再写入。
发现已有配置冲突时不得覆盖，先展示差异并等待决定。工具链安装属于用户级副作用，
需要单独确认；安装或写入失败时保留诊断，不得声称项目初始化完成。

## 创建/更新以下文件

### 1. CLAUDE.md（项目根目录）

如果已存在，在 Rust 相关章节追加内容；如果不存在，创建完整文件。

**生成前**：必须先读取 `Cargo.toml` 获取实际的项目名称和 crate 列表。不要使用占位符。

- 如果是 workspace 项目，从 `[workspace].members` 解析出所有 crate 名称
- 如果是单 crate 项目，使用 `[package].name`
- 标题使用实际项目名称

内容必须包含（以下 `<project-name>` 和 `<crate>` 替换为实际值）：

```markdown
# <project-name>

## 项目结构

<!-- workspace 项目才需要此节 -->
- `<member-path>/` — <crate-name>（简要说明）
- ...

## 构建与测试

- `cargo check -p <crate>` — 单 crate 检查
- `cargo nextest run -p <crate>` — 单 crate 测试
- `cargo nextest run -p <crate> -- test_name` — 单个测试
- `cargo clippy --workspace --all-targets -- -D warnings` — 全量 lint
- `cargo fmt --all -- --check` — 格式检查

> **局部测试策略**：开发阶段仅对修改的 crate 运行 `cargo check` / `cargo nextest run`（通过 `-p <crate>`），全量工作区测试由 pre-commit hook 自动执行。

> 如果修改涉及多个相互依赖的 crate，对所有受影响 crate 运行 `cargo check`：`cargo check -p crate_a -p crate_b`

## 代码规范

#### 错误处理（必须遵守）

- 禁止在生产代码中使用 `panic!()`、`unwrap()`、`unreachable!()`
- 使用 `Result<T, E>` + `?` 处理错误
- `.expect("message")` 仅在 panic 确实正确时使用
- 优先用 `if let` 和 let chains 处理可失败操作
- 用 `#[expect()]` 而非 `#[allow()]` 抑制 clippy lint

#### 风格约定（推荐）

- import 放在文件顶部
- 避免缩写变量名
- 默认使用最窄可见性
- 不要使用 `--release` 构建，除非复现性能问题

## 测试

- 单元测试：文件底部 `#[cfg(test)] mod tests`
- 命名格式：`test_<function>_<scenario>_<expected>`
- 用 `cargo nextest run` 而非 `cargo test`
- 所有改动必须有测试覆盖
- 优先在已有测试文件中添加测试用例，避免为每个功能创建独立测试文件；复用已有的 test fixtures 和 helper 函数
```

### 2. AGENTS.md（项目根目录）

AGENTS.md 是 GitHub Copilot Agent 读取的项目指南文件（等同于 CLAUDE.md 之于 Claude Code）。
两个文件的核心规则相同，但格式略有差异。

如果已存在，合并内容；如果不存在，创建文件。内容与 CLAUDE.md 相同的核心规则，但使用 AGENTS.md 惯例格式：

```markdown
# <project-name>

## Build & Test Commands

- `cargo check -p <crate>` — type-check a single crate
- `cargo nextest run -p <crate>` — test a single crate
- `cargo nextest run -p <crate> -- test_name` — run a single test
- `cargo clippy --workspace --all-targets -- -D warnings` — lint all
- `cargo fmt --all -- --check` — format check

## Code Style

- Use `#[expect()]` instead of `#[allow()]` for suppressing clippy lints
- Never use `panic!()`, `unwrap()`, `unreachable!()` in production code
- Use `Result<T, E>` + `?` for error handling
- `.expect("message")` only when panic is genuinely correct
- Prefer `if let` and let chains for fallible operations
- Imports at the top of the file
- Avoid abbreviated variable names
- Use narrowest visibility by default
- Don't build with `--release` unless reproducing perf issues

## Testing

- Unit tests: `#[cfg(test)] mod tests` at bottom of file
- Naming: `test_<function>_<scenario>_<expected>`
- Use `cargo nextest run` not `cargo test`
- All changes must have test coverage
- Prefer adding test cases to existing test files; reuse existing test fixtures and helpers instead of creating new test files for each feature
```

**CLAUDE.md vs AGENTS.md**：
- CLAUDE.md — Claude Code / Claude CLI 读取（中文，因为项目团队使用中文）
- AGENTS.md — GitHub Copilot Agent 读取（英文，因为是 GitHub 生态约定）

### 3. .vscode/settings.json

合并以下配置。**合并策略**：
1. 读取已有的 `.vscode/settings.json`（如果存在）
2. 对于每个键，如果已有文件中已存在该键则**保留已有值**（用户设置优先）
3. 仅添加不存在的键
4. 对于嵌套对象（如 `[rust]`），递归合并：已有子键保留，仅添加缺失子键
5. 写回时保持原有格式和注释（如果可能）

需要合并的配置：

```jsonc
{
  "rust-analyzer.check.command": "clippy",
  "rust-analyzer.checkOnSave": true,
  "rust-analyzer.cargo.targetDir": true,
  "rust-analyzer.check.extraArgs": ["--all-targets"],
  "editor.formatOnSave": true,
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  }
}
```

关键说明：`targetDir: true` 让 rust-analyzer 使用独立 target 目录，避免与 CLI 命令互相 invalidate 编译缓存，可带来约 13× 增量编译加速。

### 4. rustfmt.toml（项目根目录）

```toml
edition = "2021"
max_width = 100
use_field_init_shorthand = true
use_try_shorthand = true
```

如果项目使用 edition 2024，将 edition 字段改为 `"2024"`。使用前置检查中从 `Cargo.toml` 提取的 edition 值。

### 5. Cargo.toml workspace lints

如果是 workspace 项目，在根 `Cargo.toml` 添加 lint 配置。

**合并策略**：
1. 读取根 `Cargo.toml` 全部内容
2. 如果 `[workspace.lints.clippy]` 已存在，逐个检查以下键：仅添加缺失的键，不覆盖已有值
3. 如果 `[workspace.lints.clippy]` 不存在，整块添加

需要确保存在的配置：

```toml
[workspace.lints.clippy]
pedantic = { level = "warn", priority = -1 }
unwrap_used = "warn"
expect_used = "warn"
panic = "warn"
```

在每个 crate 的 `Cargo.toml` 中：
1. 检查是否已有 `[lints]` 节
2. 如果已有且包含 `workspace = true`，跳过
3. 如果没有 `[lints]` 节，添加：

```toml
[lints]
workspace = true
```

如果不是 workspace，对单个 `Cargo.toml` 执行同样的合并逻辑，但使用 `[lints.clippy]` 而非 `[workspace.lints.clippy]`。

### 6. .githooks/pre-commit

创建脚本并配置 Git。脚本需要兼容 Unix（sh）和 Windows（Git Bash）。

```sh
#!/bin/sh
set -e

echo "[pre-commit] Step 1/3: cargo fmt --check"
cargo fmt --all -- --check

echo "[pre-commit] Step 2/3: cargo clippy"
cargo clippy --workspace --all-targets -- -D warnings

echo "[pre-commit] Step 3/3: cargo nextest run"
cargo nextest run --workspace

echo "[pre-commit] All checks passed ✓"
```

配置 Git hooks 路径：
```bash
git config core.hooksPath .githooks
```

**平台处理**：
- Unix/macOS：运行 `chmod +x .githooks/pre-commit`
- Windows：跳过 chmod（Git for Windows 的 Git Bash 不需要，NTFS 不支持 Unix 权限位）

**持续失败处理**：
- 如果 hook 反复失败，先运行各步骤独立排查：`cargo fmt --all -- --check`、`cargo clippy ...`、`cargo nextest run ...`
- 紧急情况下可用 `git commit --no-verify` 临时跳过，但必须在后续 commit 中修复

### 7. bacon.toml（可选）

只在用户确认需要时创建：

```toml
[jobs.check]
command = ["cargo", "check", "--color", "always"]
need_stdout = false

[jobs.clippy]
command = ["cargo", "clippy", "--workspace", "--all-targets", "--color", "always", "--", "-D", "warnings"]
need_stdout = false

[jobs.test]
command = ["cargo", "nextest", "run", "--workspace"]
need_stdout = true

[default]
job = "check"
```

## 执行完成后

列出所有创建/修改的文件，以及每个文件的核心作用。

## 规则来源

| 项目 | 文件 | 链接 |
|------|------|------|
| Deno | CLAUDE.md | https://github.com/denoland/deno/blob/main/CLAUDE.md |
| Ruff | AGENTS.md | https://github.com/astral-sh/ruff/blob/main/AGENTS.md |
| uv | AGENTS.md | https://github.com/astral-sh/uv/blob/main/AGENTS.md |
