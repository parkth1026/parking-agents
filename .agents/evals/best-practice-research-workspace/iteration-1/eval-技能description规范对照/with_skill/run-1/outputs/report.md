# 技能 description 规范对照报告

## Best-Practice Research: `.claude/skills/` 下各技能的 description 写法是否符合 Anthropic 官方 Agent Skills 要求

> 考察对象：各 SKILL.md frontmatter 的 `description` 字段（`best-practice-research-workspace/` 下评测产物已排除；`aes-grilling-workspace/` 下 8 个历史快照一并考察、归组汇报）。
> 生成日期：2026-08-16。

---

### Direct Recommendation（总结论）

**硬性约束全部通过，问题全部集中在"内容与写法"层。** 31 个 SKILL.md 的 description 均非空、均 ≤1024 字符（最长 518）、均不含 XML 标签，也全部使用第三人称（含无人称中文句式），无一条踩中官方反例里的第一/第二人称写法。

需要修的是 **4 个"不符合"**（缺 when-to-use 或形同占位符）和 **7 个"部分符合/可改进"**（when 偏弱、单句过长、含 markdown 噪音等）：

| 分级 | 技能 | 核心问题 |
|---|---|---|
| ❌ 不符合 | `best-practice-research` | 只有 what 没有 when；`[OMX]` 前缀对触发无价值。该技能未设 `disable-model-invocation`，依赖自动触发，影响最大，**优先修** |
| ❌ 不符合 | `aes-grilling-workspace/skill-snapshot-v7` | description 就是技能名 `aes-grilling`（12 字符），官方反例级空泛 |
| ❌ 不符合（轻） | `aes-grilling-web` | 只有 what 没有 when（61 字符即止） |
| ❌ 不符合（轻） | `rust-workflow-init` | 只有 what 没有 when；另 `argument-hint: "[rust最佳AI开发环境搭建]"` 疑似模板残留 |
| ⚠️ 部分 | `aes-goal-contract` | when 仅有"由 workflow-interview 编排调用"，缺用户侧触发词 |
| ⚠️ 部分 | `aes-prototype` | 同上 |
| ⚠️ 部分 | `aes-interview` | when 比上两者完整（编排 + 单独调用），仍缺用户自然语言触发场景 |
| ⚠️ 部分 | `simplify` | 有 what 无显式 when（时机仅隐含在 "Review changed code" 里） |
| ⚠️ 部分 | `dev-environment` | "Use when" 很强，但"做什么"淹没在 303 字符超长单句中，可读性差 |
| ⚠️ 部分 | `aes-standardize-repo` | 442 字符单句过密；when 写成 "Use when **Codex** needs…"，面向其它宿主措辞，不利 Claude 侧匹配 |
| ⚠️ 部分（风格） | `epic-ue-assistant`、`jenkins-log-auto-learning`、`karpathy-llm-wiki`、`ue-error-solver` | description 内使用 `**加粗**` markdown——不违反 XML 禁令，但注入 system prompt 后星号是纯噪音，建议去掉 |

其余 16 个（含 `analyze`、`cpu-monitor`、`workflow-interview`、`ps1-creator`、`parking-skill-creator`、`jenkins-pair-analyze`、`react-doctor`、`rust-workflow`、`claude-to-vscode-skill-converter`、`making-skills-cross-platform`，以及快照 v1–v6）**符合官方最佳实践**，多数可作为本仓库的范本。

---

### 官方对照基准（Evidence 摘要）

来自 Anthropic 官方两份文档，共提炼 8 条判据：

**硬性约束（schema 层，来自 Agent Skills 作者最佳实践页）**
1. **非空**："Must be non-empty"。
2. **≤1024 字符**："Maximum 1,024 characters"。
3. **不含 XML 标签**："Cannot contain XML tags"。

**内容与写法（最佳实践层，同页）**
4. **同时说明"做什么 + 何时用"**："Should describe what the Skill does and when to use it"。官方好例：`Processes Excel files and generates reports`。
5. **第三人称**："Always write in third person"——description 会注入 system prompt，人称不一致会造成发现/触发问题。避免 `I can help you...` / `You can use this...`。
6. **具体、含关键触发词**："Be specific and include key terms"，覆盖技能功能与应触发的上下文。官方反例（空泛）：`Helps with documents`、`Processes data`、`Does stuff with files`。
7. **选择压力**：Claude 依据 name + description 从可能 100+ 个技能中挑选，两者都要讲清 what/when。

**Claude Code 宿主补充（来自 Claude Code Skills 文档页）**
8. **description 是唯一"推荐"frontmatter 字段**（"Only `description` is recommended so Claude knows when to use the skill"）；技能列表中 description 合计在 1536 字符截断，**关键用例要放前面**；不触发时应检查"是否包含用户自然会说的关键词"，误触发时应"写得更具体"；`disable-model-invocation: true` 会使 description 不进入上下文（只显式调用）——此时 description 主要影响列表展示与人工挑选，自动触发不受其影响。

---

### Repo-Local Context：硬性约束核验（全部通过）

字符数按 Unicode 码点计（`[dmi:true]` = 设有 `disable-model-invocation: true`）：

| 技能 | 字符数 | | 技能 | 字符数 |
|---|---|---|---|---|
| analyze | 315 | | jenkins-log-auto-learning | 219 |
| aes-goal-contract | 110 | | jenkins-pair-analyze | 171 |
| aes-grilling-web | 61 `[dmi]` | | karpathy-llm-wiki | **518（最长）** |
| aes-interview | 98 | | making-skills-cross-platform | 366 `[dmi]` |
| aes-prototype | 116 | | parking-skill-creator | 203 |
| aes-standardize-repo | 442 `[dmi]` | | ps1-creator | 315 `[dmi]` |
| best-practice-research | 83 | | react-doctor | 240 `[dmi]` |
| claude-to-vscode-skill-converter | 155 `[dmi]` | | rust-workflow | 259 `[dmi]` |
| cpu-monitor | 347 `[dmi]` | | rust-workflow-init | 96 `[dmi]` |
| dev-environment | 303 `[dmi]` | | simplify | 82 |
| epic-ue-assistant | 460 | | ue-error-solver | 199 |
| workflow-interview | 156 | | 快照 v1/v2=178, v3=212, v4=221, v5/v6=281, v7=12 `[dmi]` | |

- 非空：31/31 通过；≤1024：31/31 通过（全部也低于 1536 截断线）；XML 标签：未发现。
- 第三人称：31/31 通过——中文描述均为无人称或"它/用户"句式，无一条"I/you/我帮你"式写法。

---

### 逐技能对照表（内容层）

#### ❌ 不符合（建议逐个修）

**1. `best-practice-research`（当前 83 字符，无 dmi，靠自动触发 → 影响最大）**
> `"[OMX] Bounded best-practice-research wrapper using official/upstream evidence first"`

- 有 what（wrapper、official/upstream 优先），**无 when**；`[OMX]` 内部代号对发现零贡献。
- 讽刺点：该 SKILL.md 正文里有完整的 "Activate When / Do Not Activate When" 清单，却没提炼进 description。
- 建议改写（what+when 两段式）：
  `Researches current best practices, official recommendations, and version-aware guidance from official/upstream sources, and returns a cited recommendation. Use when the user asks for best practices, a recommended approach, current official behavior or standards, or when planning needs up-to-date external evidence before implementation.`

**2. `aes-grilling-workspace/skill-snapshot-v7`（12 字符，dmi:true）**
> `aes-grilling`

- description 仅重复技能名，比官方反例 `Does stuff with files` 信息量还低；无 what、无 when。
- 属历史快照：若仅存档可不动；若仍被评测引用，建议回填 v5/v6 版本的那段完整描述。

**3. `aes-grilling-web`（61 字符，dmi:true）**
> `"使用本地 Web Companion 对齐材料决定，并生成可直接交给执行 Agent 的轻量 Goal Contract。"`

- 有 what，**无 when**。dmi:true 使其不参与自动触发，但列表展示同样需要辨识度。
- 建议补 when，如：`……轻量 Goal Contract。当用户想通过本地网页界面对齐需求或评审界面 mock、点名 Web Companion / 网页访谈时使用；纯命令行问答走文本访谈流程。`

**4. `rust-workflow-init`（96 字符，dmi:true）**
> `为当前 Rust 项目初始化双流开发工作流（Fast Flow + Full Flow），创建 CLAUDE.md、AGENTS.md、VS Code 配置、pre-commit hook 等`

- 有 what，**无 when**；顺带发现 `argument-hint: "[rust最佳AI开发环境搭建]"` 是带方括号的中文短语，疑似模板残留值。
- 建议补 when：`……pre-commit hook 等。首次为 Rust 项目搭建 AI 开发工作流，或用户要求初始化/重建双流工作流时使用；已初始化项目的日常开发用 rust-workflow。`

#### ⚠️ 部分符合（可改进）

**5–7. `aes-goal-contract` / `aes-prototype` / `aes-interview`**（均无 dmi，参与自动触发）
- 三者 what 都写得很实，但 when 只写了编排关系（"通常由 workflow-interview 编排调用"）。按官方判据 6，缺"用户自然会说的关键词"，独立场景下不易被选中。
- 建议：各补一句用户侧触发词，如 aes-goal-contract 补"用户要求锁定验收条件 / 生成 Goal Contract / 确认完成标准时使用"；aes-interview 已写"单独调用时它会自己建 issue 目录"，相对最好，优先级最低。

**8. `simplify`（82 字符，无 dmi）**
> `Review changed code for reuse, quality, and efficiency, then fix any issues found.`

- 有 what，无显式 when（时机仅隐含）。官方 Claude Code 文档示例均采用 what + "Use when…" 配对。
- 建议补：`Use after finishing a change, before committing, or when the user asks to simplify or clean up changed code.`

**9. `dev-environment`（303 字符单句，dmi:true）**
- "Use when…" 触发面很全（含具体文件名，好），但 what 被压进一个超长单句，人不读三遍抓不住重点；违反"关键用例前置"的可读性精神。
- 建议：拆成"一句 what + Use when 列表"两段。

**10. `aes-standardize-repo`（442 字符单句，dmi:true）**
- what+when 齐且具体，长度合规；问题：单句过密，且 when 写作 "Use when **Codex** needs…"——面向 Codex 宿主的措辞在 Claude 侧既不利语义匹配也易困惑。
- 建议：拆句；把 `Codex needs` 改为宿主中立表述（如 `the agent needs` 或直接列 `run/build/check/test/gate` 等操作动词）。

**11. markdown 加粗噪音：`epic-ue-assistant`、`jenkins-log-auto-learning`、`karpathy-llm-wiki`、`ue-error-solver`**
- 四者结构都是官方推荐的 what + "Use/触发条件" 列表式，质量本身高；唯一瑕疵是 description 里用了 `**...**` 加粗。YAML 里合法、非 XML 标签（不违反硬约束 3），但 description 是注入 system prompt 的纯文本，星号是噪音。
- 建议：去掉 `**`，保留 `(1)(2)(3)` 编号即可。

#### ✅ 符合（16 个，可作范本）

| 技能 | 亮点 |
|---|---|
| `analyze` | 教科书式：what + `Use when a user says 'analyze', 'investigate', 'why does'...` 用户原话触发词 |
| `cpu-monitor` | what + 五个编号触发场景 + 明确排除范围（"不适用于 Linux/macOS"） |
| `jenkins-log-auto-learning` | what + 使用场景 + 反向排除并路由到 `ue-error-solver` |
| `jenkins-pair-analyze` | what + "编排调用 / 用户点名时独立可用" 双 when |
| `karpathy-llm-wiki` | what + 4 条 Use when，中英混合触发词（含"整理到wiki"） |
| `parking-skill-creator` | what + "用户想建技能、改技能、跑技能评测……时使用" |
| `ps1-creator` | Use when + 触发词（含中文"脚本"）+ what + `DO NOT USE FOR` 反向范围 |
| `react-doctor` | Use when（含时机型触发：before committing）+ what（Checks for… / Covers…） |
| `rust-workflow` | what + `Use when writing, checking, testing, or committing Rust code` |
| `workflow-interview` | what + 显式 when + 反触发声明（"普通需求讨论……不要自动触发"），边界意识最好 |
| `claude-to-vscode-skill-converter` | Use when + Handles… 两段式，短而完整 |
| `making-skills-cross-platform` | what + 三个并列 Use when |
| 快照 `skill-snapshot`(=v2) / v3 / v4 | what + "当用户提出……说……时使用，即使用户没有明说要契约" 触发原话枚举 |
| 快照 v5（=v6） | 平实话风：when（动手之前先问清）+ what + 反触发与路由（"已经有认可的设计……不用它"） |

---

### Evidence Used

- 官方（判据 1–7 主要来源）：[Skill authoring best practices – Claude Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) — description 的非空 / ≤1024 字符 / 禁 XML 标签 / what+when / 第三人称 / "Be specific and include key terms" / 好坏示例（`Processes Excel files and generates reports` vs `Helps with documents`、`Processes data`、`Does stuff with files`）。
- 官方（判据 8 与宿主行为）：[Agent Skills – Claude Code Docs](https://code.claude.com/docs/en/skills) — "Only `description` is recommended so Claude knows when to use the skill"；description+when_to_use 在技能列表 1536 字符截断、关键用例前置；省略时用正文首段；不触发→补"用户自然会说的关键词"、误触发→"Make the description more specific"；`disable-model-invocation: true` 时 description 不进上下文。
- 补充（非官方、仅佐证，未用于判据）：社区对官方最佳实践的转载（obra/superpowers `anthropic-best-practices.md`）。

### Version / Date Context

- 两份官方页面均为在线最新版（页面本身不带日期），于 2026-08-16 抓取核验；1024 字符上限与第三人称要求为当前生效表述。
- 本仓库快照 v1–v7 为 `aes-grilling` 技能的历史版本（v1==v2、v5==v6 已 diff 证实），现行生效技能为 `aes-grilling-web`。
- 字符数用 Node 按码点统计（中文 1 字符），与"characters"口径一致；若宿主按字节截断，中文描述余量会小于表面值——当前最长 518（karpathy-llm-wiki），均有较大安全边际。

### Boundaries / Non-goals

- 只评估 frontmatter `description` 的写法合规性；SKILL.md 正文质量、`name` 命名规范、`allowed-tools`、目录结构均不在本次范围（`name` 仅顺带看过，全部为小写-连字符合规）。
- 未验证各技能实际触发率；结论是"写法 vs 官方要求"的静态对照，不等于线上触发实测。
- `aes-grilling-workspace` 快照是否要修取决于它们是否仍被评测流程引用，本次只给结论不改文件。

### Handoff

- 修复路径建议：先修 4 个"不符合"（`best-practice-research` 优先，因它靠自动触发）；再按需处理 ⚠️ 组。每个技能的 `description` 都是单行/单块 YAML 改动，可直接进入实现。
- 本技能（best-practice-research）到研究为止：未改动任何仓库源文件；仅按任务指定写入了评测产物（本报告与 transcript），全部位于 `best-practice-research-workspace/iteration-1/eval-技能description规范对照/with_skill/run-1/`。如需批量改写各 SKILL.md，请切换到规划（`$ralplan`）或执行工作流。
