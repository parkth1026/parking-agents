# AGENTS.md — 本仓库 Agent 约定

任何 harness（Claude Code / Codex / Gemini / Cursor / Copilot CLI …）的 agent 在本仓库工作时先读这一份。
`CLAUDE.md` 与 `GEMINI.md` 通过 @-include 引用本文；`hooks/session-start` 每次会话注入本文。

## 产物落盘位置（强制，`tests/skills/test-artifact-hygiene.mjs` 门禁）

按产物性质选位置，**禁止默认写进当前工作目录（仓库根）**：

| 产物性质 | 去处 |
|---|---|
| 纯临时中间物（下载的日志、请求体、草稿、缓存） | `os.tmpdir()`，或技能 config 的 `tmpDir` |
| 运行生成的报告 / 审计 / 评测 / 分析产物（本机查看，不入库） | `docs/reports/<名称>-<日期>/`（.gitignore 已忽略） |
| 技能评测 workspace（iteration 产物、快照、探针原始数据） | `.agents/evals/<技能名>-workspace/`（scratch，.gitignore 已忽略）；持久评测依据（history.json、output-evals.json、trigger-*.json）住对应技能目录 |
| 需要跨机共享的数据 | 技能配置指向的 NAS 路径（NAS 只放数据，不放配置） |
| 要长期留档、随仓库演进的正式文档 | `docs/` 下正常提交进 git |

**禁止**在仓库根新建 `<名称>-<日期>/` 目录或散落带日期的报告文件
（如 `xxx-audit-2026-08-16/`）——门禁测试会拦。历史违例已收进 `docs/reports/`。

## 仓库其他约定

- 仓库脚本一律 `.mjs`（Node 内置模块、零依赖），不新增 PowerShell 脚本。
- 技能环境配置解析链：`$SKILL_ENV` > `~/.config/parking-agents/skill-env.json`；
  真实环境值（路径、凭据）不进 git，技能目录内 `config.json` 只放占位说明。
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
