# 冲突分析：session-start hook 到底服务哪些平台？

> 分析方式：只读仓库分析（$analyze 方法论）。所有结论按 Evidence / Inference / Unknown 分层标注。分析基准：工作区 = HEAD `f1da45d`（2026-08-16），`hooks/`、`docs/install-layout.md`、README 自 2026-08-04 起无改动。

---

### Question

`docs/install-layout.md` 说 `hooks/session-start` 服务 Claude Code / Cursor / Copilot CLI / Antigravity 四个平台；`hooks/session-start` 里的注释说"目前只有 Claude Code 是受支持的目标"。现在到底哪些平台真的在用这个 hook？文档和代码哪个说的是事实？

---

### Ranked synthesis

| Rank | 解释 | Confidence | Basis |
|------|------|------------|-------|
| 1 | **两句话说的不是同一件事，各对一半**：文档陈述的是"接线范围"（哪些平台的安装路径指向这个 hook）——这是事实，4 个平台的接线在 HEAD 真实存在且自洽；脚本注释陈述的是"支持/验证状态"（按本仓库自己的词汇表 = 是否跑过端到端验收测试）——这也是事实，只有 Claude Code 是 ✅ 已验证，其余三家全部 ⚠️ 仅 doc-contract。**且注释的字面措辞已经过时**：它写于 Cursor 接线落地前一天，次日 Cursor 的配置文件就提交了，注释从未同步 | High | git 历史时间线 + README/porting 文档的 ✅/⚠️ 词汇表 + 两份 hook 配置实测存在 |
| 2 | **更深层的事实（提问未直接覆盖）：截至当前 HEAD，没有任何平台能"成功"用上这个 hook**——hook 要注入的 bootstrap 文件 `skills/using-parking-skills/SKILL.md` 已于 2026-08-07（`048efac`）被删除，今天实测三种平台环境下 hook 输出的注入内容全部是 `cat: ... No such file or directory` 错误文本，契约测试 `tests/hooks/test-session-start.mjs` 实跑 FAIL（9 项断言）。"真的在用且正常工作"的平台数当前为 0 | High | 直接运行 hook + 运行测试得到的一手结果 |
| 3 | 当前对本仓库的 Claude Code 实际消费走的是项目级 `.claude/skills/`（749 个 tracked 文件）+ `.claude/evals/`，而非插件 hook 机制；整套插件装置（hooks/、各 manifest、install-layout.md、README 安装章节）自 8 月 4 日冻结后，仓库重心已转向 dev/pub 技能分裂 | Medium | 仓库结构现状（tracked 文件分布）+ hook 自 8/4 无改动 + skills 目录 8/5–8/9 重构；未见运行时使用日志，属合理推断 |

---

### Evidence

**冲突双方原文**

- `docs/install-layout.md:19` — "`hooks/session-start` | Claude Code / Cursor / Copilot CLI / Antigravity | 由 `run-hook.cmd` 调起，同一份脚本用环境变量分出三种 JSON 形状"
- `docs/install-layout.md:46` — "`hooks/hooks.json` | Claude Code / Copilot CLI / Antigravity | Claude Code 系的 hook schema（PascalCase `SessionStart` + `matcher`）"
- `docs/install-layout.md:88-96` — 三分支嗅探表：Cursor → `additional_context`；Claude Code / Antigravity → `hookSpecificOutput.additionalContext`；Copilot CLI / 未知 → `additionalContext`（Antigravity 与 Claude Code 共用同一分支、同一份 `hooks.json`）
- `hooks/session-start:43-44` — "Only Claude Code is a supported target today; the other branches are kept so adding Cursor / Copilot CLI later is a README change, not a rewrite."
- `hooks/session-start:15-17` — **同一脚本内部自相矛盾**：上方注释写 "the harnesses on this code path (**Claude Code / Cursor / Copilot CLI**) already expose a tool for every action"，与 43-44 行的"只有 Claude Code"直接冲突
- `hooks/session-start:48-57` — 三个平台分支的实际代码（`CURSOR_PLUGIN_ROOT` / `CLAUDE_PLUGIN_ROOT`+非`COPILOT_CLI` / 其余）

**接线真实存在（支撑文档的"4 平台"）**

- `hooks/hooks.json:9` — Claude Code 系配置：`"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" session-start"`（Claude Code 靠目录约定发现，`.claude-plugin/plugin.json` 确实不声明 hooks）
- `hooks/hooks-cursor.json:6` — Cursor 专属配置：`"./hooks/run-hook.cmd session-start"`
- `.cursor-plugin/plugin.json:24` — Cursor manifest 显式声明 `"hooks": "./hooks/hooks-cursor.json"`
- `tests/hooks/test-session-start.mjs:68-116` — 契约测试分别断言 Claude Code / Cursor / Copilot CLI 三种环境变量组合下，hook 各输出恰好一个正确字段
- `tests/harnesses/test-harness-manifests.mjs:29-49` — 断言 Cursor manifest 指向 hooks-cursor.json 且两套 schema 不串

**"只有 Claude Code 被验证"的真实依据（支撑注释的语义）**

- `README.md:46` — 图例定义："✅ 表示跑过验收测试（干净会话里技能能自动触发）；⚠️ 表示集成已写好、契约测试覆盖，但没做端到端验证"
- `README.md:48` — Claude Code 为 ✅；`README.md:73` — Cursor 为 ⚠️；`README.md:99-101` — Copilot CLI / Antigravity 为 ⚠️
- `docs/porting-to-a-new-harness.md:258-268`（附录 A 集成索引表）— 验证列：Claude Code "✅ 已端到端验证"；Cursor / Copilot CLI / Antigravity 全部 "⚠️ 仅 doc-contract"
- `docs/porting-to-a-new-harness.md:256` — "doc-contract 测试证明的是契约没烂，不是端到端能跑通"

**git 时间线（判定谁先谁后、谁过时的关键）**

- `03d03c9`（2026-08-03）— hook 首次创建，**三分支逻辑和 "Only Claude Code is a supported target today" 注释即已同时存在**；该提交主题为"支持 Claude Code / Codex / Pi"，当时尚无任何 Cursor 配置文件。`git log -S "Only Claude Code is a supported target"` 全历史仅命中此一提交——注释此后从未被修改
- `f74e16e`（2026-08-04）— **次日**：新增 `hooks/hooks-cursor.json`、`.cursor-plugin/plugin.json`，README 增加 Cursor 和 Copilot CLI / Antigravity 安装章节，hook 改动 12 行（去掉 mapping 拼接），但 43-44 行注释原样保留
- `b8e27f1`（2026-08-04）— 新建 `docs/install-layout.md`，写下"4 平台"说法（此时 4 平台接线已全部落地）
- `048efac`（2026-08-07）— "删掉 顶层skill"：删除 `skills/dev/using-parking-skills/`（SKILL.md + antigravity/codex/gemini/pi 四份 references），hook / hook 配置 / install-layout.md / README / 测试均未随之更新
- `git status` — 工作区对 `hooks/`、`docs/install-layout.md`、README 无未提交改动（工作区 = HEAD）

**运行时实测（2026-08-16，本次分析直接执行）**

- 三种环境变量组合下 hook 均输出结构正确的单一字段（`hookSpecificOutput` / `additional_context` / `additionalContext`）——三分支机制本身仍按文档工作
- 但三种组合的注入正文全部是 `cat: /g/GIT/AI_WorkFlow/parking-agents/skills/using-parking-skills/SKILL.md: No such file or directory` —— bootstrap 载荷已坏
- `node tests/hooks/test-session-start.mjs` → **FAIL — 9 problem(s)**：三个平台各缺 "action-vocabulary declaration"、"subagent dispatch template"、"Platform Adaptation pointer list" 三项内容断言（根因即上述文件缺失）

---

### Inference

1. **"哪个说的是事实"的准确答案：两个都对，但描述的维度不同，且各自都有过时成分。**
   - 文档（install-layout.md:19）描述**接线范围**：它写于 4 平台接线全部落地之后（b8e27f1，8/4），所述内容在 HEAD 仍然成立——两份 hook 配置、Cursor manifest 声明、三分支输出形状全部真实存在并有测试锁定。就"哪些平台的安装路径会调起这个 hook"而言，文档是事实。
   - 脚本注释（session-start:43-44）描述**支持/验证状态**：按本仓库自己在 README:46 和 porting 附录 A 定义的词汇，"supported"对应"跑过端到端验收测试"——只有 Claude Code 满足。就"哪些平台被验证真的能用"而言，注释是事实。
2. **注释的字面措辞是陈旧遗留（stale leftover），这是冲突的真正来源。** 它写于 8/3（03d03c9），当天三分支是"预埋代码"；8/4（f74e16e）作者恰好做了注释里预言的事——"adding Cursor / Copilot CLI later is a README change"——提交了 Cursor 配置和 README 章节，却没有回头删这句注释。同文件 15-17 行的注释已经改口称"Claude Code / Cursor / Copilot CLI 在这条代码路径上"，与 43-44 行自相矛盾，进一步佐证 43-44 是漏改的旧注释，而非对现状的刻意声明。
3. **为什么弱解释被降级：**
   - "文档是错的、hook 只服务 Claude Code"——被降级，因为 Cursor 的配置文件（hooks-cursor.json + .cursor-plugin/plugin.json）是已提交的真实接线，且有契约测试锁定，不是设想。
   - "注释是错的、4 平台都在正常使用"——被降级，因为 README/porting 附录 A 明确标注 Cursor / Copilot CLI / Antigravity 仅 doc-contract、未做端到端验证；没有任何仓库证据表明这三家被真实运行过。
4. **Rank 2 是比"文档 vs 注释"更重要的事实：hook 当前对所有平台都是坏的。** 8/7 删除 bootstrap 技能后，任何平台调起这个 hook 注入的都是 cat 的报错文本；契约测试实跑失败。文档和注释争辩的"哪些平台在用"，在当前 HEAD 的实际答案趋近于"没有任何平台在正常使用"——整套插件装置是 8/4 冻结的遗产，仓库已转向 skills/dev+pub 分裂 + `.claude/skills/` 项目级技能（749 个 tracked 文件）的新形态。

---

### Unknowns / limits

- **仓库证据无法回答"用户机器上实际发生过什么"**：Cursor / Copilot CLI / Antigravity 是否曾被某人在本机装过并触发过 hook，属于仓库外事实。仓库内最强证据止步于"接线存在 + 契约测试覆盖 + 明确标注未做端到端验证"。
- **`hooks.json` 与 Claude Code 的目录约定发现**：install-layout.md:38 称 hooks 靠目录约定自动发现（plugin.json 不声明），这一发现机制的行为本身无法在仓库内验证，只能采信文档与上游约定。
- **`references/antigravity-tools.md` 已随 8/7 的删除消失**，而 README:101、install-layout.md:144、porting 附录 A 仍引用它——与 bootstrap 缺失同源的文档漂移，本次未展开。
- **降低不确定性的后续只读探针**（如需）：在干净 checkout 上运行完整 `npm test`，确认失败面是否如推断所示全部源于 `using-parking-skills` 缺失；或查 `parking-agents-dev` 仓库（README:108 提及的 junction 目标）是否才是仍在维护插件形态的真源。

---

### 一句话结论

**文档说的是"接线"（4 个平台的安装路径确实都指向这个 hook，文件和测试都在，这半边是事实）；脚本注释说的是"验证过的支持"（只有 Claude Code 跑过端到端验收，这半边也是事实），但注释的字面措辞（"Cursor / Copilot CLI 以后再加"）在写完第二天就被仓库自己超越、之后一直漏改——冲突源于注释过时，而非文档造假。而最深一层的事实是：自 2026-08-07 bootstrap 技能被删后，这个 hook 对任何平台注入的都是报错文本，当前真正"在用且正常工作"的平台数为 0。**
