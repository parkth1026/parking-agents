# 技能 description 规范对照报告（.claude/skills）

- 考察对象：`G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\` 下所有含 `SKILL.md` 的技能，共 **23 个**（7 个 `*-workspace` 目录为工作数据目录、无 SKILL.md，不在考察范围；`best-practice-research-workspace` 下的评测产物已按要求排除）。
- 考察字段：frontmatter 的 `description` 字段。
- 官方依据：见文末「引用来源」。
- 生成日期：2026-08-16

## 一、官方对 description 的要求（对照基准）

来自 Anthropic 官方 Agent Skills 最佳实践文档与官方 skill-creator 技能，归纳为 5 条：

| # | 要求 | 官方原话（节选） | 性质 |
|---|------|------------------|------|
| 1 | **非空** | "`description`: Must be non-empty" | 硬性 |
| 2 | **≤ 1024 字符** | "Maximum 1,024 characters" | 硬性 |
| 3 | **不能含 XML 标签** | "Cannot contain XML tags" | 硬性 |
| 4 | **同时写"做什么 + 何时用"** | "should include both what the Skill does and when to use it"；"Be specific and include key terms. Include both what the Skill does and specific triggers/contexts for when to use it." | 内容核心要求 |
| 5 | **第三人称** | "Always write in third person. The description is injected into the system prompt, and inconsistent point-of-view can cause discovery problems." 好："Processes Excel files and generates reports"；坏："I can help you…" / "You can use this…" | 写法要求 |

补充要点：

- **具体性/反模式**：官方明确给出要避免的空泛写法："Helps with documents"、"Processes data"、"Does stuff with files"。description 是 Claude 在 100+ 技能中做选择的唯一依据（启动时只有 name + description 被预载入）。
- **"何时用"信息必须写在 description 里**（官方 skill-creator）："All 'when to use' info goes here, not in the body."
- **要写得"稍微 pushy"对抗漏触发**（官方 skill-creator）：Claude 有 undertrigger（该触发不触发）倾向，把用户可能的各种提法尽量列全，"even if they don't explicitly ask for a 'dashboard'"。
- **disable-model-invocation 的语境影响**（Claude Code 文档）：设为 `true` 时 "Description not in context, full skill loads when you invoke" —— description 完全不进模型上下文，只供人在 `/` 菜单里看。因此这类技能缺"何时用"不会导致触发失败，但仍然违反官方 checklist 字面要求、且影响用户在菜单里的辨识，建议照改，只是优先级可降。
- **多行写法**：官方所有示例均为单行字符串。用 YAML 块标量（`|` / `>`）写多行不违反硬性约束（解析后仍是合法字符串），但与官方示例风格不一致，个别宿主按单行渲染时会丢失排版，属"形式风险"而非违规。
- 注：`argument-hint`、`when_to_use` 是别的字段，不能替代 description 里的"何时用"。

## 二、硬性约束检查（要求 1–3 + 第三人称）：全部通过

- 23 个技能的 description 均**非空**；
- 字符数最长 534（karpathy-llm-wiki），全部 **< 1024**，无一超限；
- 均无 XML 标签（`**粗体**` Markdown 不算 XML）；
- 均无第一/第二人称问题：中文描述无"我/你可以…"，英文用的是祈使句 "Use when…"，这正是官方示例的写法。

**结论：本仓库的问题全部集中在要求 4（缺 when to use / 触发语境不足）和具体性上。**

各技能字符数（按解析后的字符串计）：

| 技能 | 字符 | | 技能 | 字符 |
|---|---|---|---|---|
| aes-goal-contract | 110 | | jenkins-pair-analyze | 179 |
| aes-grilling-web | 61 | | karpathy-llm-wiki | 534 |
| aes-interview | 98 | | making-skills-cross-platform | 366 |
| aes-prototype | 116 | | parking-skill-creator | 203 |
| aes-standardize-repo | 442 | | ps1-creator | 315 |
| analyze | 315 | | react-doctor | 240 |
| best-practice-research | 83 | | rust-workflow | 267 |
| claude-to-vscode-skill-converter | 155 | | rust-workflow-init | 96 |
| cpu-monitor | 347 | | simplify | 82 |
| dev-environment | 303 | | ue-error-solver | 211 |
| epic-ue-assistant | 474 | | workflow-interview | 156 |
| jenkins-log-auto-learning | 233 | | | |

## 三、不符合最佳实践的技能（建议逐个修）

### A 档：明确不符合（缺 when to use，4 个）

#### 1. best-practice-research —— 问题最多，优先修
- 现状：`[OMX] Bounded best-practice research wrapper using official/upstream evidence first`（83 字符）
- 问题：
  - 只有 what 且写得极简，**完全没有 when to use / 触发词**；
  - 开头 `[OMX]` 是对模型毫无意义的内部代号，挤占触发关键词空间，接近官方反例 "Processes data" 式的空泛；
  - 该技能**未设 disable-model-invocation**（模型可自动触发），触发全靠模型猜 → 实际危害最大。
- 建议改法（示意）：
  `Bounded best-practice research: find official/upstream docs first, cite sources, note uncertainty. Use when the user asks "best practice / 最佳实践 / best way / 该用哪个 / how should I…" about a technology, library, or engineering decision, or wants doc-backed answers instead of blog-level guesses.`

#### 2. aes-grilling-web
- 现状：`使用本地 Web Companion 对齐材料决定，并生成可直接交给执行 Agent 的轻量 Goal Contract。`（61 字符）
- 问题：只有 what，**零触发语境**——用户/模型看不出什么时候该用它；与同族技能（aes-interview 等）的区别也未体现。
- 缓解因素：已设 `disable-model-invocation: true`（description 不进模型上下文），不会造成误触发，只影响 `/` 菜单里的人工辨识。
- 建议改法（示意）：`在本地 Web Companion 网页界面上逐条对齐访谈材料与决定，产出可直接交给执行 Agent 的轻量 Goal Contract。用户要求"在网页上确认/过一遍材料决定"、或想用轻量版（而非完整 workflow-interview）敲定目标时使用。`

#### 3. rust-workflow-init
- 现状：`为当前 Rust 项目初始化双流开发工作流（Fast Flow + Full Flow），创建 CLAUDE.md、AGENTS.md、VS Code 配置、pre-commit hook 等`（96 字符）
- 问题：只有 what（产出物清单），**无 when to use**。frontmatter 里的 `argument-hint: "[rust最佳AI开发环境搭建]"` 是补全提示，不是触发条件，不能替代。
- 缓解因素：已设 `disable-model-invocation: true`。
- 建议改法（示意）：`为当前 Rust 项目初始化双流开发工作流（Fast Flow + Full Flow），创建 CLAUDE.md、AGENTS.md、VS Code 配置、pre-commit hook 等。用户想在 Rust 项目搭建/初始化 AI 开发环境、建立 fast/full flow 规范或提交前检查时使用。`

#### 4. simplify
- 现状：`Review changed code for reuse, quality, and efficiency, then fix any issues found.`（82 字符）
- 问题：只有 what，**无 when to use**——用户说"精简一下/去重/清理这段代码"时模型没有可匹配的触发词。
- 说明：这段文字与 Anthropic 官方自带同名技能一致（属"官方自带的也不完全守自家 checklist"），但按官方 checklist（"includes both what the Skill does and when to use it"）字面衡量确实缺项；且该技能**模型可自动触发**，建议照改。
- 建议改法（示意）：`Review changed code for reuse, quality, and efficiency, then fix any issues found. Use when the user says "simplify / clean up / 精简 / 去重 / 收敛" code, or wants changed code checked for reuse and quality before committing.`

### B 档：部分符合（有弱 when，建议补强，3 个）

均属同一模式：**what 写得很细，但"何时用"只写了编排关系（"通常由 workflow-interview 编排调用"），缺用户侧触发词**。这三个技能都未设 disable-model-invocation（模型可自动触发），单聊场景下模型缺少"用户说 X 就用我"的线索。

#### 5. aes-interview
- 现状：98 字符；when 只有"通常由 workflow-interview 编排调用；单独调用时它会自己建 issue 目录"。
- 问题：后半句是行为说明而非触发条件；缺用户侧触发词（"问需求/需求访谈/澄清歧义/锁定需求"）。
- 建议补：`用户要求澄清需求、逐条问清待定项、或在改动前锁定需求时使用`。

#### 6. aes-prototype
- 现状：116 字符；when 只有"通常由 workflow-interview 编排调用"。
- 问题：缺用户侧触发词（"出对照物/界面 mock/行为对照表/接口报文样例"）。
- 建议补：`用户要看改动会造成什么样子（界面/行为/报文）或要求逐处确认影响面时使用`。

#### 7. aes-goal-contract
- 现状：110 字符；when 只有"通常由 workflow-interview 编排调用"。
- 问题：缺用户侧触发词（"定验收标准/写 Goal Contract/验收条件"）；描述里的 `[A] 档冒烟` 是内部档位记号，对触发无帮助。
- 建议补：`用户要敲定验收条件或落盘 Goal Contract 时使用`，并可顺手把 `[A] 档冒烟` 换成可读说法。

## 四、符合最佳实践的技能（16 个）

### 可作本仓标杆（7 个）

这些完全满足官方要求（what + 明确触发语境 + 关键词具体），修其他的可直接照抄其结构：

| 技能 | 亮点 |
|---|---|
| **analyze** | what + "Use when a user says 'analyze', 'investigate', 'why does'…" 直接列出用户原话级触发词 |
| **cpu-monitor** | what + 5 个编号触发场景 + 明确反向排除（"不适用于 Linux/macOS"），第三人称 |
| **ps1-creator** | "Use when:" 触发词（含中文"脚本"）+ what + "DO NOT USE FOR:" 反向排除 |
| **jenkins-log-auto-learning** | what + 3 个场景 + **相似技能消歧**（"不适用于单次构建诊断——请用 ue-error-solver"），这是官方 skill-creator 推崇的写法 |
| **ue-error-solver** | what + "触发条件" 3 条，含用户口语（"构建挂了/红了"） |
| **karpathy-llm-wiki** | what + 4 条触发，把用户可能说的词全列上（"wiki", "knowledge base", "整理到wiki"）——正是官方"pushy"建议的落地 |
| **workflow-interview** | what + when（"仅在用户显式调用…时使用"）+ 防误触发反向条件（"普通需求讨论…不要自动触发"） |

### 合规、有小注（9 个）

| 技能 | 判定 | 小注（非违规，酌情处理） |
|---|---|---|
| aes-standardize-repo (442) | 符合 | what + "Use when…" 齐全。两处小瑕疵：① 把触发主体写成 "Use when **Codex** needs…"——本技能若同时被 Claude Code 等宿主使用，主体指名 Codex 语义错位，建议改成 "Use when the user (or any agent) needs…"；② 442 字符偏长，尚有余量但接近可读性极限 |
| claude-to-vscode-skill-converter (155) | 符合 | when 在前、what 在后；顺序无硬性要求 |
| dev-environment (303) | 符合 | what 偏隐式（"setting up or fixing…"）；关键词密集到文件名级（smart-dev.mjs 等），触发友好但人读略费劲，可不改 |
| epic-ue-assistant (474) | 符合 | 用了 YAML `|` 多行块标量（官方示例均单行），形式风险见下 |
| jenkins-log-auto-learning (233) | 符合（标杆） | 同上多行形式小注 |
| jenkins-pair-analyze (179) | 符合 | 有编排语境 + 用户点名触发语（"分析这个构建对 / fail=X fix=Y"）；多行形式小注 |
| karpathy-llm-wiki (534) | 符合（标杆） | 多行形式小注 |
| making-skills-cross-platform (366) | 符合 | what + 三个 "when…" 从句，关键词（各 harness 名）具体 |
| parking-skill-creator (203) | 符合 | 末句"全部脚本零外部依赖，纯 Node 内置模块"是实现细节，对触发无贡献，可删（非违规） |
| react-doctor (240) | 符合 | when + what 齐全 |
| rust-workflow (267) | 符合 | 用了 YAML `>` 折叠多行；内容合规 |

> **多行块标量统一小注**：`epic-ue-assistant`、`jenkins-log-auto-learning`、`jenkins-pair-analyze`、`karpathy-llm-wiki`、`ue-error-solver`（`|`）与 `rust-workflow`（`>`）共 6 个用了多行 YAML 写 description。解析后仍是合法单字符串，不违反 1024 字符/非空/无 XML 任何硬性约束，但官方所有示例均为单行，个别宿主按单行渲染时会丢失排版。可保持现状；若追求与官方风格完全一致可折成单行（用空格连接）。

## 五、修复优先级清单（按实际影响排序）

| 优先级 | 技能 | 一句话改法 |
|---|---|---|
| P0 | best-practice-research | 删 `[OMX]`，补 "Use when…" 触发词（模型可自动触发、当前几乎不可能被正确触发） |
| P0 | simplify | 补 "Use when the user says simplify / 精简 / 去重…"（模型可自动触发） |
| P1 | aes-interview / aes-prototype / aes-goal-contract | 各补一句用户侧触发词；goal-contract 顺手去掉 `[A]` 记号 |
| P2 | aes-grilling-web | 补触发场景（disable-model-invocation 已挡住自动触发，只影响菜单辨识） |
| P2 | rust-workflow-init | 补 "用户要初始化 Rust AI 开发环境时使用"（同上） |
| P3 | aes-standardize-repo | "Use when Codex needs" 改为以用户为主体的表述 |
| P3 | 6 个多行 description 技能 | 可选：折成单行，与官方示例风格对齐 |
| P3 | parking-skill-creator | 可选：删末句实现细节 |

## 六、总体结论

- **硬性规范（非空、≤1024、无 XML、第三人称）23/23 全部合格**，本仓库无任何"会报错/被拒载"的问题。
- **4 个技能明确不符合内容要求**（best-practice-research、aes-grilling-web、rust-workflow-init、simplify）：只有 what、缺 when to use，其中 best-practice-research 与 simplify 因可被模型自动触发而危害最大。
- **3 个技能部分符合**（aes-interview、aes-prototype、aes-goal-contract）：缺用户侧触发词，只有编排语境。
- 其余 16 个符合，其中 7 个（analyze、cpu-monitor、ps1-creator、jenkins-log-auto-learning、ue-error-solver、karpathy-llm-wiki、workflow-interview）写法可作为本仓标杆模板。
- 官方还有一个可操作建议（来自 skill-creator，本次未执行）：改完后用触发评测集（should-trigger / should-not-trigger 各若干条）跑迭代验证，防止改了描述反而不触发/误触发。

## 引用来源

1. Anthropic 官方文档 – Agent Skills 最佳实践（description 硬性限制、what+when、第三人称、好/坏示例、checklist）：
   https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
2. Anthropic 官方 skills 仓库 – skill-creator 技能（description 是首要触发机制、"when to use"全放 description、pushy 写法、触发评测流程）：
   https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md
3. Claude Code 官方文档 – Skills（frontmatter 字段参考、disable-model-invocation 语义"Description not in context"、技能列表 1536 字符截断）：
   https://code.claude.com/docs/en/skills
