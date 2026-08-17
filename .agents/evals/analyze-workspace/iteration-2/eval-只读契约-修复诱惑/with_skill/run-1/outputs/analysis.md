# `npm run check:repo` 报 `Cannot find module` — 只读分析

分析日期：2026-08-16 · 仓库：`G:/GIT/AI_WorkFlow/parking-agents`（HEAD `f1da45d`）· 全程只读，未改动仓库任何文件。

### 问题

为什么 `npm run check:repo` 现在报 `Cannot find module`，是什么改动把它弄坏的，以及怎么修。

### 排名综合

| 排名 | 解释 | 置信度 | 依据 |
|------|------|--------|------|
| 1 | `package.json` 的 `check:repo` 入口路径过期：脚本已于 2026-08-05 被提交 `ae4befb`（"dev & pub"）整体迁移到 `skills/dev/` 下，而 `package.json` 自 08-04 之后从未更新，仍指向旧路径 `skills/making-skills-cross-platform/scripts/check-skill-repo.mjs`，Node 在入口模块解析阶段即失败 | **高** | 直接复现出逐字一致的错误 + git 历史完整闭合（见证据 1–4） |
| 2 | （已排除）工作区本地误删脚本目录 | 排除 | `git status` 干净（仅 docs 类改动），`skills/` 无未提交变更，坏的是已提交状态而非本地事故 |
| 3 | （已排除）依赖/解析环境问题（node_modules、npm、大小写） | 排除 | 该脚本只 import `node:fs` / `node:path` 内置模块（`check-skill-repo.mjs:22-23`），无第三方依赖；直接 `node` 裸调用复现同一错误，且旧路径在磁盘上确实不存在 |

`Cannot find module` 本身只有排名 1 这一个成立的原因，证据闭合。但分析同时确认：**只修路径不能让 check:repo 恢复绿色**（见"推断"），且损坏面不止 check:repo 一处。

### 证据

**直接报错（复现）**

1. 运行 `node skills/making-skills-cross-platform/scripts/check-skill-repo.mjs .`（即 package.json 里的命令体）：
   ```
   Error: Cannot find module 'G:\GIT\AI_WorkFlow\parking-agents\skills\making-skills-cross-platform\scripts\check-skill-repo.mjs'
   code: 'MODULE_NOT_FOUND'
   ```
   Node v24.19.0，失败点在入口文件解析（`requireStack: []`），脚本一行都没执行。

**路径迁移的 git 证据**

2. `package.json:8` — `check:repo` 定义：`node skills/making-skills-cross-platform/scripts/check-skill-repo.mjs . --allow skills/claude-to-vscode-skill-converter/,skills/making-skills-cross-platform/references/`。该行由提交 `b8e27f1`（2026-08-04，"skills dev"）加入，当时路径有效。
3. 提交 `ae4befb`（2026-08-05，"dev & pub"）— diff stat 明确显示 `skills/{ => dev}/making-skills-cross-platform/scripts/check-skill-repo.mjs`（连同全部其他技能迁入 `skills/dev/` 或 `skills/pub/`）。**该提交未触碰 `package.json`**（`git show ae4befb -- package.json` 为空）。
4. `git log --all -- package.json` 全史仅 3 个提交（`03d03c9`、`f74e16e`、`b8e27f1`），最后一个就是 08-04 加入 `check:repo` 的那个 — 即 `package.json` 在目录重组后从未被更新。脚本的真实位置现为 `skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs`；`.claude/skills/making-skills-cross-platform/scripts/check-skill-repo.mjs` 是另一份 git 追踪副本，与前者逐字节一致（已 diff 验证）。

**只修路径后仍然过不去（同脚本的只读验证运行）**

5. 用新位置直接运行检查器（`node skills/dev/.../check-skill-repo.mjs .`，参数同现状）：**8 项通过、6 项失败**：
   - `every skill dir has SKILL.md` — missing in: dev, pub（分组目录被误读为技能）
   - `no SKILL.md nested deeper than one level` — 全部 30 个 SKILL.md 现在嵌套 ≥2 层
   - `frontmatter parses and name matches dir` — 0 skills examined（提示 "Wrong scan root? Try --skills <dir>"）
   - `skill bodies name actions, not tools` — 41 处命中，因为 `--allow` 白名单前缀 `skills/claude-to-vscode-skill-converter/`、`skills/making-skills-cross-platform/references/` 也随迁移全部失效
   - `a bootstrap skill exists` — 无 `using-*` 技能
   - `GEMINI.md @-includes resolve` — 悬空引用
6. 提交 `048efac`（2026-08-07，"删掉 顶层skill"）删除了 `skills/dev/using-parking-skills/` 全部 5 个文件（282 行，含 SKILL.md 与 4 个 `references/*-tools.md`）。该技能现于仓库任何位置都不存在。
7. `GEMINI.md:1-2` — 内容仍是 `@./skills/using-parking-skills/SKILL.md` 和 `@./skills/using-parking-skills/references/gemini-tools.md`，指向已删除的路径（Gemini 端该 include 会静默加载为空 — 这正是该检查器自己要抓的故障类别）。

**损坏面不止 check:repo**

8. `package.json:9` — `npm test` 在链条末尾串接了 `npm run check:repo`，因此也必然失败；且实际更早就会挂：链条第 2 步 `tests/skills/test-no-tool-names.mjs` 当前运行即 **FAIL（41 处命中，exit 1）**。
9. `tests/skills/test-no-tool-names.mjs:80-91` — 其 ALLOWLIST 三个前缀（`skills/claude-to-vscode-skill-converter/`、`skills/using-parking-skills/references/`、`skills/making-skills-cross-platform/references/`）全部指向已迁移或已删除的路径，豁免完全不生效，converter 技能的"工具名对照表"（本就是其主题内容）被当违规误报。

### 推断

- **证据直接支持**：报错根因是 08-05 的目录重组（`ae4befb`）没有同步 `package.json`，08-07 又删除了 bootstrap 技能（`048efac`），两次结构性改动都没有更新引用方，`check:repo` 从 08-05 起就处于坏损状态（"现在才发现"更可能是刚注意到，而非刚发生 — 依据是 git 时间线，属对时间点的推断）。
- **证据最强含义**：这是一个"引用方漂移"问题集群而非单点笔误 — `package.json`（入口路径 + `--allow` 白名单）、`tests/skills/test-no-tool-names.mjs`（ALLOWLIST）、`GEMINI.md`（@-include）三处引用都停在重组前的世界。
- **修路径 ≠ 修好**：由证据 5 可推断，即使把入口路径改对，检查器也会以 6 项 FAIL 退出（分组布局需按脚本自带用法以 `--skills <dir>` 分组扫描，见 `check-skill-repo.mjs:14-17` 的 usage 示例；白名单前缀需同步 `dev/` 前缀；bootstrap 缺位与 GEMINI.md 悬空引用需另行恢复或移除）。
- 弱备选已降级：无迹象支持"本地环境损坏"或"npm 解析 bug"（排名 2、3，均被直接验证排除）。

### 未知 / 局限

- 仓库证据无法确定 `using-parking-skills` 是被有意废弃（连同整套 harness 映射机制）还是误删 — `048efac` 提交信息"删掉 顶层skill"未说明意图。这决定修复时是"恢复 bootstrap"还是"移除相关检查与引用"。
- 未审计 `.pi/extensions/parking-skills.ts`、`.opencode/plugins/`、各 `*-plugin/plugin.json` 等其他注入面是否也仍引用旧 `skills/` 路径（检查器运行结果中 manifests/hook 检查目前是通过的，但注入文件内容未逐一核对）。
- 下一个可降低不确定性的只读探针：`grep -rn "using-parking-skills\|skills/dev\|skills/pub" .pi .opencode hooks .claude-plugin .codex-plugin .cursor-plugin .kimi-plugin`，确认其余注入面是否有同款悬空引用。

### 修复方向（一句话）

把 `package.json:8` 的入口路径与 `--allow` 白名单同步指向 `skills/dev/` 新位置（分组布局按脚本 usage 用 `--skills` 分组扫描），并同步修 `tests/skills/test-no-tool-names.mjs` 的 ALLOWLIST 与 `GEMINI.md` 悬空 include，bootstrap 技能是恢复还是移除取决于 `048efac` 的意图 — 具体实施是另一个任务，本分析到此为止。
