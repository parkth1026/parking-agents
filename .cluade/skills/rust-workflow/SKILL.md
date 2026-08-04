---
name: rust-workflow
description: >
  Rust/Cargo development workflow for AI coding. Defines fast flow (inner loop)
  and full flow (quality gate) strategies based on Deno CLAUDE.md, Ruff AGENTS.md,
  and uv AGENTS.md real-world practices. Use when writing, checking, testing, or
  committing Rust code.
---

# Rust/Cargo 双流开发工作流

基于 Deno / Ruff / uv 三大项目的 AI coding 最佳实践，定义**快速流**（写代码时）和**完整流**（提交前）两种模式。

---

## 1. Fast Flow — Inner Loop（写代码时）

在迭代编写代码期间，**不要**手动运行 `cargo fmt`、`cargo clippy`、`cargo test`。依赖 rust-analyzer on-save 实时检查。

### 编译检查
- 用 `cargo check` 代替 `cargo build`（2-3× 更快，不生成二进制）
- 针对单 crate 检查：`cargo check -p <crate_name>`（~1-3s）
- **绝不**使用 `--release` 构建，除非复现性能问题

### 测试
- 只测修改的 crate：`cargo nextest run -p <crate_name>`
- 跑单个测试：`cargo nextest run -p <crate_name> -- test_name`
- 优先跑局部测试，不要每次都跑整个 workspace

### rust-analyzer 自动检查
IDE 已配置 `check.command: "clippy"`，保存时自动检查，无需手动运行 clippy。

---

## 2. Full Flow — Quality Gate（提交前）

提交代码前必须依次通过三步检查（由 pre-commit hook 自动执行）：

```bash
# Step 1: 格式化检查
cargo fmt --all -- --check

# Step 2: Lint 检查（所有 warning 视为错误）
cargo clippy --workspace --all-targets -- -D warnings

# Step 3: 全量测试
cargo nextest run --workspace
```

如果任一步失败，修复后重新提交。不要绕过 hook（禁止 `--no-verify`）。

---

## 3. Code Discipline（Deno + Ruff + uv 共识）

### 错误处理
- **禁止** `panic!()`、`unwrap()`、`unreachable!()` 在生产代码中使用
- 使用 `Result<T, E>` + `?` 操作符处理错误
- `.expect("descriptive message")` 仅在 panic 确实是正确行为时使用
- 优先用 `if let` 和 let chains 处理可失败操作

### Clippy 抑制
- 用 `#[expect()]` 而非 `#[allow()]` 抑制 clippy lint
- 如果 lint 抱怨未使用代码，直接删除代码而非抑制

### 代码风格
- import 放在文件顶部，不要局部 import
- 避免缩写变量名（用 `version` 不用 `ver`）
- 注释用于解释不变量和非常规做法，不要叙述代码
- 遵循相邻文件的代码风格
- 尽量少写新代码，先找现有工具/方法

### 可见性
- 默认使用最窄可见性
- 当其他 workspace crate 需要时才标记 `pub`

---

## 4. Testing

### 组织
- 单元测试：文件底部 `#[cfg(test)] mod tests` 块
- 集成测试：`tests/` 目录
- 用 `cargo nextest run` 而非 `cargo test`（并行速度快 1.4-3.4×）

### 命名
- 格式：`test_<function>_<scenario>_<expected>`
- 例：`test_parse_version_invalid_input_returns_error`

### 规范
- 所有改动必须有测试覆盖
- 优先在已有测试文件中添加，而非新建文件
- 添加新测试时模仿相邻测试的风格
- 优先集成测试，辅以单元测试
- 如果使用 insta 快照，运行后必须检查更新的快照内容

---

## 5. VS Code Settings（关键速度配置）

以下配置对开发速度有显著影响：

```jsonc
{
  // rust-analyzer 使用 clippy 做 on-save 检查
  "rust-analyzer.check.command": "clippy",
  "rust-analyzer.checkOnSave": true,

  // 独立 target 目录，防止 IDE 和 CLI 互相 invalidate 缓存（~13× 加速）
  "rust-analyzer.cargo.targetDir": true,

  // clippy 检查参数
  "rust-analyzer.check.extraArgs": ["--all-targets"]
}
```

---

## 6. Evidence Sources

以上规则提炼自以下真实大型 Rust 项目的 AI coding 指南：

| 项目 | 文件 | 链接 |
|------|------|------|
| Deno | CLAUDE.md | https://github.com/denoland/deno/blob/main/CLAUDE.md |
| Ruff | AGENTS.md | https://github.com/astral-sh/ruff/blob/main/AGENTS.md |
| uv | AGENTS.md | https://github.com/astral-sh/uv/blob/main/AGENTS.md |
