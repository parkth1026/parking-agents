# 分析报告：`npm run check:repo` 报 `Cannot find module`

- 分析对象：`G:/GIT/AI_WorkFlow/parking-agents`（只读分析，未改动任何仓库文件）
- 分析日期：2026-08-16
- 复现环境：Node v24.19.0，Windows（Git Bash），复现退出码 1

## Question（问题重述）

为什么 `npm run check:repo` 现在报 `Error: Cannot find module ... check-skill-repo.mjs`，这个故障最可能的成因是什么，以及修复方向是什么。

## 结论速览

`package.json` 里的 `check:repo` 脚本仍指向 `skills/making-skills-cross-platform/scripts/check-skill-repo.mjs`，而 2026-08-05 的提交 `ae4befb`（"dev & pub"）把整个 `skills/` 树重组为 `skills/dev/` 与 `skills/pub/` 两组，该脚本文件被原样移动到了 `skills/dev/...` 下，`package.json` 从未随之更新。Node 无法解析入口脚本本身，故报 `MODULE_NOT_FOUND`（`requireStack: []`）。这与依赖安装/node_modules 无关。

但需注意：**仅把路径改对并不能让 check:repo 变绿**。重组后的分组布局违反了该检查器强制的"一层扁平布局"不变量，且 `--allow` 前缀、bootstrap skill、GEMINI.md 引用全部失效——重新指向后检查器会报 6 项 FAIL（下文有实测输出）。同时 `npm run test` 链条在到达 check:repo 之前就已在前两步失败。

## Ranked synthesis（按支持度排序的解释）

| 排名 | 解释 | 置信度 | 依据 |
|------|------|--------|------|
| 1 | `skills/` 目录重组（`ae4befb` 及后续提交）把技能目录迁入 `skills/dev/`、`skills/pub/`，`package.json` 的 `check:repo` 入口路径未随之更新，Node 解析不到入口脚本 | 高 | git rename 记录（100% 相似度移动）+ `package.json:8` 现文 + `skills/` 现目录结构 + 复现报错 |
| 2 | 同一轮重组还破坏了检查器及其配套测试所依赖的全部前提（扁平一层布局、`--allow` 前缀、bootstrap skill `using-parking-skills` 的存在、GEMINI.md 引用），因此路径修复后 check:repo 仍会结构性失败 | 高 | 用迁移后的脚本实测：6 FAIL（含脚本自带的 "Wrong scan root? Try --skills <dir>" 提示）；两个配套测试实测 FAIL（41 hits / 34 problems） |
| 3 | （已排除的备选）依赖损坏 / node_modules 缺失 / npm 安装问题 | 低（可排除） | `requireStack: []` 表明缺的是入口模块本身；脚本只 import `node:fs`/`node:path`（check-skill-repo.mjs:22-23）；package.json 无 dependencies |

## Evidence（证据）

### 直接成因：入口路径失效

- `package.json:8` — 脚本现为：
  `node skills/making-skills-cross-platform/scripts/check-skill-repo.mjs . --allow skills/claude-to-vscode-skill-converter/,skills/making-skills-cross-platform/references/`
- 复现输出 — `Error: Cannot find module 'G:\GIT\AI_WorkFlow\parking-agents\skills\making-skills-cross-platform\scripts\check-skill-repo.mjs'`，`code: 'MODULE_NOT_FOUND'`，`requireStack: []`（失败的是入口脚本本身，不是某个依赖）。
- `skills/` 现状 — 根目录下只有 `dev/` 与 `pub/` 两个子目录，不存在 `making-skills-cross-platform/`。
- git 提交 `ae4befb`（"dev & pub"，2026-08-05）— rename 记录：`skills/{ => dev}/making-skills-cross-platform/scripts/check-skill-repo.mjs (100%)`，同时所有其他技能目录整体迁入 `skills/{ => dev}/…` 或 `skills/{ => pub}/…`。
- `package.json` 的 git 历史 — 该文件最后一次相关改动是 `b8e27f1`（"skills dev"，2026-08-04，早于重组一天），当时的 `check:repo` 字符串与现在完全一致；即重组之后从未更新过。

### 脚本本体仍然存在（内容未损坏）

- `skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs` — 迁移后的正本，git 追踪中，由旧路径 100% rename 而来。
- `.claude/skills/making-skills-cross-platform/scripts/check-skill-repo.mjs` — 另一份 git 追踪副本，与上述文件 `diff` 逐字节一致。
- `check-skill-repo.mjs:22-23` — 仅 `import ... from "node:fs"` 与 `"node:path"`，无任何第三方依赖。

### 路径修复后仍会失败的深层问题（实测）

从新位置运行 `node skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs .`，结果 8 passed / **6 failed**：

- `✗ every skill dir has SKILL.md — missing in: dev, pub`
- `✗ no SKILL.md nested deeper than one level`（31 个 SKILL.md 被判嵌套过深，含 `skills/pub/matt/<name>/SKILL.md` 这一层三级的组）
- `✗ frontmatter parses and name matches dir — 0 skills examined … Wrong scan root? Try --skills <dir>`（脚本自带的诊断提示）
- `✗ skill bodies name actions, not tools — 41 hit(s)`（`--allow` 旧前缀在 `skills/dev|pub` 下匹配不到任何相对路径）
- `✗ a bootstrap skill exists — no skills/using-* found`
- `✗ GEMINI.md @-includes resolve — skills/using-parking-skills/… loads empty, silently`

相关代码依据：

- `check-skill-repo.mjs:119-121` — 检查器的不变量声明："Every harness scans skills/<name>/SKILL.md exactly ONE level deep. A skill at skills/category/name/SKILL.md loads nowhere, and nothing reports it."
- `check-skill-repo.mjs:43-47` — 脚本知道分组布局的存在，但 `--skills` 一次只接受**一个**扫描根，且无排除机制。
- `check-skill-repo.mjs:214` — `--allow` 按相对路径前缀 `r.startsWith(p)` 匹配，旧前缀 `skills/claude-to-vscode-skill-converter/` 对新路径 `skills/dev/claude-to-vscode-skill-converter/…` 不再命中。

### 同轮重组造成的连带失联（多文件独立佐证）

- git 提交 `048efac`（"删掉 顶层skill"）— 删除了 `skills/dev/using-parking-skills/SKILL.md`（bootstrap 技能）。
- `GEMINI.md` — 两条 `@-includes` 指向已不存在的 `./skills/using-parking-skills/…`。
- `hooks/session-start:10` — `BOOTSTRAP_SKILL="${PLUGIN_ROOT}/skills/using-parking-skills/SKILL.md"`，读取会失败。
- `.pi/extensions/parking-skills.ts:15-16`、`.opencode/plugins/parking-skills.js:19-20` — 同样解析已删除的 `skills/using-parking-skills/SKILL.md`，并把扫描根注册为 `skills/`。
- `.codex-plugin/plugin.json:22` — `"skills": "./skills/"`。
- `tests/skills/test-no-tool-names.mjs:80-91` — ALLOWLIST 仍是旧扁平前缀；实测运行 FAIL（41 个 tool-name 命中）。
- `tests/skills/test-skill-discovery.mjs` — 实测运行 FAIL（34 个问题：`skills/dev/SKILL.md missing`、全部技能 "nested too deep"）。
- `package.json:9` — `npm test` 链条共 8 步，`check:repo` 是最后一步；其中第 1、2 步（上述两个测试）现在就已失败。

## Inference（推断）

- **最强国结论**：这不是文件损坏或依赖问题，而是一次"目录树重组了、引用方没跟上"的失联。2026-08-05 至 08-13 间的多个提交（`ae4befb` → `048efac` → `e5c4baf` 等）持续把 `skills/` 改造成 `dev/pub` 分组并删除顶层 bootstrap，但 `package.json` 脚本、两个配套测试、GEMINI.md、session-start 钩子、Pi/OpenCode 注入器仍全部编码着重组前的扁平布局假设。多个独立文件指向同一结论，符合"消费者集体过时"的模式。
- **为什么弱解释被降级**：node_modules/依赖说的排除是硬性的——脚本零第三方依赖且 `requireStack: []`；"文件被误删"说也不成立——git rename 证明文件是被完整移动的，且两个副本内容一致。
- **为什么日常使用可能没暴露**（弱推断，标注为试探性）：`.claude/skills/` 下存在一份扁平镜像（30+ 技能，含检查器副本），若 Claude Code 的日常消费走的是该镜像，则 `skills/dev|pub` 树上的断链不会在会话中报错，只有跑 `npm run check:repo`/`npm test` 这类工具链时才炸出来。仓库中没有找到任何同步镜像的脚本（`scripts/` 下仅 `bump-version.mjs`），故该镜像的维护方式无法由仓库证据确立。
- **修复不是一行的事**：路径重指后暴露的 6 个 FAIL 说明，真正待决的是**布局裁决**（扁平 vs 分组），而不是一个路径 typo。当前树有 `skills/dev`、`skills/pub`（顶层技能）、`skills/pub/matt`（二层嵌套组）三个扫描组，而检查器一次只支持一个 `--skills` 根且无法排除子组——`--skills skills/pub` 仍会因 `matt` 组嵌套而 FAIL。

## Unknowns / limits（未知与边界）

- dev/pub 分组是"最终布局"还是"过渡状态"：提交信息（"dev & pub"、"删掉 顶层skill"）未表达意图，仓库证据无法裁决。
- 各 harness（Pi/OpenCode/Codex/Claude Code）**实际**是否递归扫描 `skills/`：本仓库自己的检查器与两个测试都断言"只扫一层"，但这属于仓库内声明，不是对 harness 实际行为的证据。
- `.claude/skills/` 镜像如何与 `skills/dev|pub` 保持同步（手动复制还是有未追踪的机制）：仓库内无同步脚本，无法确立。
- `using-parking-skills` 的删除是有意废弃 bootstrap 还是误删：`hooks/session-start:10` 与两个注入器仍引用它，倾向"配套未清理"，但意图层面证据缺失。
- 降低不确定性的只读探针（如需）：逐 harness 查证技能扫描深度语义；或在旧提交 `b8e27f1` 上运行 `npm run check:repo` 验证"重组前是绿的"这一隐含前提（本分析未执行历史回溯运行）。

## 修复方向（应要求附带；仅为方向，非实施计划）

按改动范围从小到大，三选一（互斥），外加一项必做的联动清理：

1. **最小解堵（仅让 MODULE_NOT_FOUND 消失，检查仍会红）**：把 `package.json:8` 的入口改为 `skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs`，并把 `--allow` 前缀改为 `skills/dev/claude-to-vscode-skill-converter/,skills/dev/making-skills-cross-platform/references/`。注意：这只把错误从"找不到模块"变成"6 项结构 FAIL"。
2. **保留分组布局，则需改造工具**：检查器（`check-skill-repo.mjs:47` 的单根 `--skills`）与 `tests/skills/test-skill-discovery.mjs`、`test-no-tool-names.mjs` 需支持多扫描根/递归分组；同时逐组传根（dev、pub 顶层、pub/matt），allowlist 同步加 `dev/`、`pub/` 前缀。`test-no-tool-names.mjs:78-79` 的注释本身就要求与 `package.json` 的 `--allow` 保持同步。
3. **回到扁平布局**（`skills/<name>/SKILL.md` 一层）：这是检查器、两个测试、`.codex-plugin/plugin.json`、两个注入器共同假设的形态，一次性让全部消费者恢复一致，代价是撤销 dev/pub 分组。
4. **无论选哪条，都绕不开的裁决**：`using-parking-skills` 已删但 `hooks/session-start:10`、`.pi/extensions/parking-skills.ts:16`、`.opencode/plugins/parking-skills.js:20`、`GEMINI.md` 仍引用它——需要决定恢复该技能还是重写这些注入点；否则 `npm test` 链条在 check:repo 之前的第 1、2 步仍会失败。
