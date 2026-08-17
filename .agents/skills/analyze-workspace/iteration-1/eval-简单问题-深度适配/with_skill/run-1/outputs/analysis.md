# npm test 都跑了哪些测试？大概怎么组织的？

## 问题

`npm test` 实际执行哪些测试，这些测试大致如何组织？

## 结论（按重要性排序）

| Rank | 结论 | 置信度 | 依据 |
|------|------|--------|------|
| 1 | `npm test` 是 **8 个步骤用 `&&` 串联**的一条命令：5 个测试文件（3 个自包含断言脚本 + 2 个 `node:test` 文件）+ 3 个仓库卫生检查（版本一致性 `--check`、版本登记审计 `--audit`、`check:repo` 结构检查） | 高 | `package.json:9` 原文 |
| 2 | 测试**按被测对象分目录**：`tests/skills/`（技能内容不变量）、`tests/hooks/`（SessionStart 钩子契约）、`tests/pi/`（pi 扩展行为）、`tests/harnesses/`（各 harness 清单/文档契约）；全程**零第三方依赖**，只用 Node 内置能力 | 高 | `tests/` 目录结构 + 各文件 import |
| 3 | **当前 `npm test` 跑不过**：第 1 步 `test-skill-discovery` 报 34 个失败即中断，2–8 步未执行。原因是 `skills/` 已重组为 `dev/`、`pub/` 两层分组（已提交状态），而测试仍断言旧的一层布局；`check:repo` 引用的脚本路径也已失效 | 高（实测验证） | 实际运行输出 + 目录/路径对比 + `git status` 干净 |

## npm test 的 8 个步骤（`package.json:9`）

按执行顺序，`&&` 串联、fail-fast（前一步失败后面全不跑）：

1. **`node tests/skills/test-skill-discovery.mjs`** — skills/ 目录结构断言：每个直接子目录必须有 `SKILL.md`、只允许一层嵌套、frontmatter 可解析且 `name`/`description` 齐全（`name` 须与目录名一致）、`agents/` 下的 Codex 配置必须叫 `openai.yaml`、引导技能 `using-parking-skills` 的 4 个 references 文件必须存在。
2. **`node tests/skills/test-no-tool-names.mjs`** — 遍历 skills/ 全部 `.md`（剥离 frontmatter、3 个路径前缀豁免），禁止出现任何 harness 专属工具名（VS Code Copilot / Claude Code / 其他三组词表）。规则：技能正文只描述"动作"，工具名映射只出现在 `references/<harness>-tools.md`。
3. **`node tests/hooks/test-session-start.mjs`** — 用 bash 实际执行 `hooks/session-start`，以 Claude Code / Cursor / Copilot CLI 三组环境变量各跑一次，断言每种平台**只**输出唯一正确的 JSON 字段（`hookSpecificOutput` / `additional_context` / `additionalContext`）且引导文案包含关键要点。
4. **`node --test tests/pi/test-pi-extension.mjs`** — 6 个 `node:test` 用例：package.json 的 pi 字段声明；扩展注册 5 个生命周期事件；`resources_discover` 返回 skills 目录；启动引导注入为 user 消息、不重复注入、`agent_end` 后清除；`session_compact` 后在摘要之后重新注入；`pi-tools.md` 参考文档与扩展内联映射保持同步。
5. **`node --test tests/harnesses/test-harness-manifests.mjs`** — 10 个 `node:test` 用例的"文档契约"测试：Cursor 清单与 hooks schema；Gemini 扩展与 `GEMINI.md` 的 `@` include 指向真实文件；gemini/antigravity 工具映射文档内容；Kimi 清单的 sessionStart 与内联映射；OpenCode 插件实际行为（注册 skills 路径、幂等、消息注入、去重）；`.agents` marketplace 条目；所有带 version 的清单都登记在 `.version-bump.json`。
6. **`node scripts/bump-version.mjs --check`** — 检查 `.version-bump.json` 登记的各平台清单版本是否一致（防止某个平台 ship 旧版本）。
7. **`node scripts/bump-version.mjs --audit`** — 反向审计：找出带 version 字段但未登记的文件。
8. **`npm run check:repo`** — 调 `check-skill-repo.mjs`（跨平台技能仓库结构检查器）对整仓再做一轮结构校验，带两个 `--allow` 豁免。

## 组织方式

- **两种测试风格并存**：
  - 步骤 1–3 是"plain Node 脚本"风格：手工收集 failures，结尾统一打印 `PASS/FAIL — N problem(s)` 摘要，用 exit code 1 表示失败；
  - 步骤 4–5 用 Node 内置 `node:test` + `assert/strict`（TAP 输出）。
  - 没有任何第三方测试框架（无 jest/vitest，无 devDependencies），与 `scripts/bump-version.mjs` 头注释里"Windows 优先、Git Bash 里没有 jq，所以全用 .mjs"的工具链取向一致。
- **目录按被测子系统划分**，与仓库顶层结构一一对应：`skills/` → `tests/skills/`，`hooks/` → `tests/hooks/`，`.pi/extensions/` → `tests/pi/`，各 harness 清单（`.cursor-plugin/`、`gemini-extension.json`、`.kimi-plugin/`、`.opencode/` 等）→ `tests/harnesses/`。
- **共同设计主题**（各文件头注释明确写出）：被测的失败模式在真实平台上全部是"静默"的——技能不加载、注入重复、清单指错文件都不会报任何错，所以用测试把这些静默失败变成显式失败。
- 后 3 步不是单元测试，而是**仓库卫生检查**（版本管理 + 结构合规），混在同一条链里。

## 证据

- `package.json:9` — `test` 脚本原文：8 个命令 `&&` 串联；`package.json:8` — `check:repo` 定义及其引用的脚本路径
- `tests/skills/test-skill-discovery.mjs:23-160` — 五类结构断言（一层嵌套、frontmatter、openai.yaml、引导技能 references）
- `tests/skills/test-no-tool-names.mjs:27-91` — DENIED 工具名词表与 ALLOWLIST 豁免
- `tests/hooks/test-session-start.mjs:68-116` — 三种平台的 JSON 输出形状断言
- `tests/pi/test-pi-extension.mjs:43-180` — 6 个 node:test 用例
- `tests/harnesses/test-harness-manifests.mjs:29-209` — 10 个 node:test 用例（各 harness 文档契约）
- `scripts/bump-version.mjs:1-14` — 头注释说明 `--check`（报告漂移）与 `--audit`（找未登记文件）的用途
- 实测（2026-08-16）：`npm test` 第 1 步输出 `FAIL — 34 problem(s)`，含 `skills/dev/SKILL.md missing`、`skills/pub/SKILL.md missing`、32 项 `nested too deep`、`skills/using-parking-skills/ missing`，链在此中断
- 路径核对：`skills/making-skills-cross-platform/scripts/check-skill-repo.mjs` 不存在，实际位于 `skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs`
- `git status`：工作树除 docs 外干净，即 dev/pub 重组为已提交状态，非未提交的临时改动

## 推断

- 测试套件是围绕"**一层 skills 布局 + `using-parking-skills` 引导技能**"的旧仓库结构编写的；当前已提交的 dev/pub 两层重组布局与测试（及 `check:repo` 的脚本路径、`test-no-tool-names.mjs` 的 ALLOWLIST 前缀）未同步。此结论由实测失败与路径核对直接支持，推断成分很低。
- 轻度推断：作者刻意保持零依赖（Windows 优先的工具链约束），`node:test` 是唯一使用的"框架"且为 Node 内置——依据是 bump-version.mjs 头注释与 package.json 无依赖的事实组合。

## 未知 / 局限

- 第 2–8 步在当前树上单独运行是否通过**未验证**（`&&` 链在第 1 步中断）。如需确认，可逐条单独执行各命令。
- dev/pub 重组是"有意的新布局但测试待更新"，还是"测试被有意废弃"，仅凭仓库现有证据无法判定（需要 git 历史演进细节或作者确认；最近提交信息未直接说明测试处置计划）。
