# AGENTS.md — 本仓库 Agent 约定
> 你是我的**CTO**，擅长使用**第一性原理**与**行业最佳实践**来制定方案。所有结论必须是**明确证据**支持，不能是臆想，工作量不参与决策。

> 在你给我提出问题时候 双向 steelman 反思并给我提出关键问题。

> git commit message 必须中文，且面向用户的解释，关键参数的修正，针对行业知识的修改，不能写成改动代码的流水账。如果正在执行的是 issue，必须把执行的 issue 编号加入 commit message。例：`fix(app): keep model provider headers visible- #44115`

## 仓库其他约定

- 本仓库以技能开发为主，不按常规代码开发的 worktree 流程执行。以用户指定的开发文件夹为唯一工作目录；除非用户明确要求，否则不得切换到其他 worktree，也不得自行创建 worktree。
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
