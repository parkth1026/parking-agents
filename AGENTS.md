# AGENTS.md — 本仓库 Agent 约定


## 仓库其他约定

- 仓库脚本一律 `.mjs`（Node 内置模块、零依赖），不新增 PowerShell 脚本。
- `.agents/skills/` 是开发侧平铺活跃真源；`skills/` 是跨平台分类发布树。
  自研技能只在开发侧编辑，通过 `category`、评测门槛与 `scripts/build-release.mjs`
  生成发布副本；生成物不得手改。上游移植技能仍在发布侧按其来源维护。

## Agent skills

（Matt Pocock engineering 技能族的 per-repo 配置入口，操作细节见 `docs/agents/`）

### Issue tracker

Issue 走 GitHub Issues（`parkth1026/parking-agents`），用 `gh` CLI 操作。见 `docs/agents/issue-tracker.md`。

### Triage labels

五个默认标签，字符串与角色名一致：`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`。见 `docs/agents/triage-labels.md`。

### Domain docs

单一上下文（single-context）：根目录一个 `CONTEXT.md` + `docs/adr/`，由 `domain-modeling` 按需惰性创建。见 `docs/agents/domain.md`。
