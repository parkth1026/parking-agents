# AGENTS.md — 本仓库 Agent 约定


## 仓库其他约定

- 仓库脚本一律 `.mjs`（Node 内置模块、零依赖），不新增 PowerShell 脚本。
- `.agents/skills/` 是 开发侧活跃真源；`skills/` 是跨平台发布侧，
  两者改动需经移植流程同步，不视为同一份。

## Agent skills

（Matt Pocock engineering 技能族的 per-repo 配置入口，操作细节见 `docs/agents/`）

### Issue tracker

Issue 走 GitHub Issues（`parkth1026/parking-agents`），用 `gh` CLI 操作。见 `docs/agents/issue-tracker.md`。

### Triage labels

五个默认标签，字符串与角色名一致：`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`。见 `docs/agents/triage-labels.md`。

### Domain docs

单一上下文（single-context）：根目录一个 `CONTEXT.md` + `docs/adr/`，由 `domain-modeling` 按需惰性创建。见 `docs/agents/domain.md`。
