# 分析报告：session-start hook 到底服务哪些平台 —— 文档与代码注释谁在说真话

## 一句话结论

**文档（docs/install-layout.md）描述的是配置接线的真实状态；hook 脚本里的 "Only Claude Code is a supported target today" 注释是一条过时的化石注释**——它在诞生时（2026-08-03 的首个跨平台提交）是真的，次日上午的提交把 Cursor 等平台真正接线后就不再为真，但删注释这件事被漏掉了。不过两边都各自漏掉了第三个事实：**由于 2026-08-05 的 skills 目录改造删掉了 bootstrap 源文件，这个 hook 今天对所有平台输出的都是错误占位文本**，契约测试当前处于 FAIL 状态。

---

## 1. 冲突双方原文

**文档方** `docs/install-layout.md`（第 19 行、第 88-96 行、第 147-150 行）：

> `hooks/session-start` | Claude Code / Cursor / Copilot CLI / Antigravity | 由 `run-hook.cmd` 调起，同一份脚本用环境变量分出三种 JSON 形状

并给出完整的分支表：Cursor 嗅探 `CURSOR_PLUGIN_ROOT` → `additional_context`；Claude Code / Antigravity 嗅探 `CLAUDE_PLUGIN_ROOT` 且无 `COPILOT_CLI` → `hookSpecificOutput.additionalContext`；Copilot CLI / 未知 → 顶层 `additionalContext`。

**代码方** `hooks/session-start`（第 43-44 行）：

> Only Claude Code is a supported target today; the other branches are kept so
> adding Cursor / Copilot CLI later is a README change, not a rewrite.

---

## 2. 谁在说真话：接线层面文档是对的，注释是过时的

### 2.1 配置接线证据（支持文档方）

四平台的 hook 接线在仓库里**真实存在**，不是文档空想：

| 平台 | 接线证据 | 文件 |
|---|---|---|
| Claude Code | 目录约定自动发现 `hooks/hooks.json`（PascalCase `SessionStart` schema）→ 调 `run-hook.cmd session-start` | `hooks/hooks.json` |
| Cursor | manifest **显式声明** `"hooks": "./hooks/hooks-cursor.json"`（camelCase `sessionStart` + 顶层 `version` 的 Cursor 专属 schema） | `.cursor-plugin/plugin.json` 第 18 行、`hooks/hooks-cursor.json` |
| Copilot CLI | 复用 Claude Code 路径，靠 `COPILOT_CLI` 环境变量走 hook 第三分支 | `hooks/session-start` 第 54-56 行 |
| Antigravity | 完全复用 Claude Code 插件路径，与 Claude Code 同一输出形状 | README 第 99-101 行 |

### 2.2 测试证据（支持文档方）

`tests/hooks/test-session-start.mjs` 对**全部三种 JSON 形状**逐一断言（Claude Code / Cursor / Copilot CLI 各一个用例），末行输出是 "PASS — session-start emits the correct single field for all 3 platform shapes"。`tests/harnesses/test-harness-manifests.mjs` 另外断言两份 hook 配置 schema 不串。测试把三平台形状当作**受契约保护的既成设计**，而非"将来可能加的分支"。

### 2.3 git 时间线（证明注释是化石）

| 提交 | 日期 | 内容 | 对冲突的影响 |
|---|---|---|---|
| `03d03c9` | 2026-08-03 | "skills 改造为跨平台插件，支持 Claude Code / Codex / Pi"。hook 脚本从参考实现 obra/superpowers 移植而来，带上了 Cursor / Copilot CLI 的休眠分支 | **"Only Claude Code is a supported target today" 注释在此诞生，当时为真**（那时只有 Claude Code 有 hook 接线） |
| `f74e16e` | 2026-08-04 11:05 | 加入 `.cursor-plugin/plugin.json`（显式声明 hooks）、`hooks/hooks-cursor.json`、Kimi、OpenCode、Gemini，README 更新为 9-harness 表 | **注释从这一刻起变为假**。此提交改了同文件的其他注释（第 14-16 行改成 "the harnesses on this code path (Claude Code / Cursor / Copilot CLI)"），却**漏删了 30 行之下那条旧注释** |
| `b8e27f1` | 2026-08-04 20:51 | 新增 `docs/install-layout.md`（即本次争议文档），同时补 `references/antigravity-tools.md` | 文档描述的四平台接线与当时的仓库状态**一致** |
| `ae4befb` | 2026-08-05 | skills 改造为 `dev/` + `pub/` 两层，`using-parking-skills` 挪到 `skills/dev/` 下 | hook 硬编码的 `skills/using-parking-skills/SKILL.md` 路径**开始失配** |
| `048efac` | 其后 | "删掉 顶层skill"，`skills/dev/using-parking-skills/SKILL.md` 被删除 | bootstrap 源文件彻底消失 |

关键事实：`hooks/` 目录自 `f74e16e` 之后**再无任何提交**，`docs/install-layout.md` 自 `b8e27f1` 之后也再无提交。也就是说，**冲突的两句话是在相邻两天的两个提交里各自写下的，之后都没人再碰过**。

### 2.4 脚本内部自相矛盾（注释过时的直接铁证）

同一个 `hooks/session-start` 文件里，`f74e16e` 新写的注释（第 14-16 行）承认：

> the harnesses on this code path (**Claude Code / Cursor / Copilot CLI**) already expose a tool for every action

而 30 行之下（第 43-44 行）仍留着 "Only Claude Code is a supported target today"。**同一文件前后两条注释互相打架**，后者未随 `f74e16e` 的接线变更同步删除——这是典型的"注释漂移"，而非对现状的刻意声明。

---

## 3. "真的在用"的三层答案

这个问题取决于"在用"的定义，三层答案各不相同：

1. **配置接线层（manifest 指向它、契约测试覆盖它的形状）——4 个平台**：Claude Code、Cursor、Copilot CLI、Antigravity。文档说的就是这一层，为真。
2. **验收层（README 定义："✅ 表示跑过验收测试，干净会话里技能能自动触发"）——只有 1 个平台**：Claude Code（README 第 48 行 ✅）。Cursor / Copilot CLI / Antigravity 均标 ⚠️："集成已写好、契约测试覆盖，但没做端到端验证"。`docs/porting-to-a-new-harness.md` 第 261-268 行的移植表同样把这三家标为 "⚠️ 仅 doc-contract"。**脚本注释虽然字面过时，但它"只有 Claude Code 是验证过的目标"这一层意思与 README/移植文档完全一致。**
3. **当下实际工作层——0 个平台**。实测执行 `bash hooks/session-start`（模拟 Claude Code 环境），输出为：

   ```
   "additionalContext": "...cat: /g/.../skills/using-parking-skills/SKILL.md: No such file or directory\nError reading using-parking-skills skill..."
   ```

   即 hook 的"注入内容"是一段错误文本。`node tests/hooks/test-session-start.mjs` 当前 **FAIL（9 项）**，三个平台形状全部缺少 bootstrap 应有的内容。原因是第 5 节所述的 skills 目录改造，文档和 hook 脚本都没跟上。

---

## 4. 最终裁定

- **文档 vs 注释谁对：文档对。** 四平台的 hook 接线（两份 hook 配置 + manifest 声明 + 环境变量分支 + 三形状契约测试）在仓库里客观存在；"只有 Claude Code" 的注释描述的是 2026-08-03 的历史状态，次日即失效，属于未清理的过时注释，且与同文件上方较新的注释自相矛盾。
- **但注释并非全错：** 它隐含的"只有 Claude Code 经过端到端验收"至今仍然成立（README ✅/⚠️ 分层为证）。准确的说法是：**接线 4 家，验收 1 家，当下能正常工作的 0 家。**
- 两边共同的盲区：2026-08-05 之后 `skills/using-parking-skills/SKILL.md` 已不存在，hook 在所有平台上注入的都是错误占位文本，且 `npm test` 应处于失败状态——这一点文档没写，注释也没写，因为两者都停在 8 月 4 日。

---

## 5. 附带发现（分析过程中发现的相关漂移，均未修改）

1. **hook 的 bootstrap 源文件已不存在**：`hooks/session-start` 第 10 行仍硬编码 `${PLUGIN_ROOT}/skills/using-parking-skills/SKILL.md`，该路径（及其 `skills/dev/` 变体）在工作树中均无。`cat ... || echo` 的容错让 hook 退出码仍为 0，失败完全静默。
2. **文档的"一层扁平"约束也已过时**：install-layout.md 第 27 行称 `skills/<name>/SKILL.md` 禁止更深嵌套且有 `npm test` 兜底，但现在 skills 已是 `skills/dev/` + `skills/pub/` 两层结构。
3. **文档引用的 `references/` 路径已失效**：`skills/using-parking-skills/references/`（含 antigravity-tools.md、gemini-tools.md 等）随 `048efac` 一并消失，README 第 101 行 "Antigravity 的工具差异见 references/antigravity-tools.md" 成为死链接。
4. **同一提交时间窗内的注释双标**：`f74e16e` 更新了 hook 上半部分的注释以反映三平台，却漏掉下半部分——说明该注释是"漏删"而非"有意保留的现状声明"。

## 6. 若要修复（建议，本次未实施）

- 删除或改写 `hooks/session-start` 第 43-44 行的化石注释，改为与 README 一致的分层表述（接线 4 家 / 验收 1 家），或直接指向 README 的 ✅/⚠️ 表。
- 修 hook 的 `BOOTSTRAP_SKILL` 路径（指向现存文件或恢复该技能），否则讨论"哪些平台在用"意义有限——现在 4 家拿到的都是错误文本。
- 同步更新 `docs/install-layout.md` 的 skills 布局与 references 相关段落，使其反映 dev/pub 改造后的现状。

---

### 证据文件清单（绝对路径）

- 冲突文本：`G:/GIT/AI_WorkFlow/parking-agents/hooks/session-start`（第 10、14-16、43-44 行）、`G:/GIT/AI_WorkFlow/parking-agents/docs/install-layout.md`（第 19、46、88-96 行）
- 接线证据：`G:/GIT/AI_WorkFlow/parking-agents/hooks/hooks.json`、`G:/GIT/AI_WorkFlow/parking-agents/hooks/hooks-cursor.json`、`G:/GIT/AI_WorkFlow/parking-agents/.cursor-plugin/plugin.json`（hooks 声明）、`G:/GIT/AI_WorkFlow/parking-agents/.codex-plugin/plugin.json`（`"hooks": {}` 抑制开关反证共享目录确有多平台消费者）
- 测试证据：`G:/GIT/AI_WorkFlow/parking-agents/tests/hooks/test-session-start.mjs`、`G:/GIT/AI_WorkFlow/parking-agents/tests/harnesses/test-harness-manifests.mjs`
- 验收分层：`G:/GIT/AI_WorkFlow/parking-agents/README.md`（第 46-101 行）、`G:/GIT/AI_WorkFlow/parking-agents/docs/porting-to-a-new-harness.md`（第 261-268 行移植表）
- git 证据：`03d03c9`（注释诞生）→ `f74e16e`（Cursor 接线、注释漏删）→ `b8e27f1`（文档写下）→ `ae4befb` + `048efac`（bootstrap 文件消失）
