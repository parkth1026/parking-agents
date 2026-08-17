# Context Snapshot: 2026-08-11-mid-flight-requirement-change

- 创建：2026-08-11T00:00:00Z
- 分片来源：无，宿主直接调查（问题集中、单线程即可查清，未派 subagent）

## 任务陈述
帮我给 workflow-interview 加个功能，允许用户中途改需求。

## 用户提出的方案
未提出。用户只给了目标（"允许中途改需求"），没有带来具体的实现方案（没说是新命令、
新 stage、新 status，还是改文档规则）。

## 意图假设
经 Round 1/2 澄清：用户真正想要的不是一个新的"随时改需求"入口或子系统，而是一件更
具体的小事——契约（`3-contract`）走到快收尾、还没 `finalize`/未定稿的阶段时，临时
想加一条新的验收条件，希望这件事不要被当成"材料歧义"整个打回 `1-interview` 重问一遍
（`needs_reinterview` 现在的效果）。这条诉求的大部分其实已经被仓库既有规则覆盖
（`aes-goal-contract/SKILL.md:137`），只是没有被明确点名、容易被误判成要走
`needs_reinterview`。意图收窄为：**把这条已有但没写清楚的路径写清楚，并划清它和
`needs_reinterview`、"契约定稿后回原契约重做"之间的边界**，不新增代码机制。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 仓库已有 `needs_reinterview` 回退机制：任一子技能报它，`session.mjs` 一律把 `stage` 重置为 `STAGES[0]`（即 `1-interview`），并把该阶段状态设为 `in_progress`，不区分是从 `2-prototype` 还是 `3-contract` 报的 | `.claude/skills/workflow-interview/scripts/session.mjs:222-236` | Fact |
| `needs_reinterview` 面向的是"材料歧义"（撞出双方都没想到的新信息，可能改变意图/边界/约束），不是"追加一条独立验收条件"这种局部动作。三份子技能 SKILL.md 都把它定位为"回 aes-interview 问清"，而不是"回本阶段小修" | `aes-prototype/SKILL.md:58-65,146-154`；`aes-goal-contract/SKILL.md:44-45,121`；`workflow-interview/SKILL.md:61-65` | Fact |
| `aes-goal-contract` 已经内建了两条与"中途改需求"字面相关、且比 `needs_reinterview` 轻得多的既有路径：(a) 契约"定稿"之前——即 `finalize` 通过、用户确认之前——本来就在"逐条带候选，批量提问"的提问区里，追加一条候选/AC 就是继续这轮提问，不必回 1-interview；(b) 契约定稿之后要改验收标准，走"回原契约重做"：判据是"这次要动的是现有验收标准还是一件新的事"，同一 issue 内编辑 `contract.md` 重新 `finalize` 即可，同样不必回 1-interview | `aes-goal-contract/SKILL.md:137`（"用户回答完全部问题后验收条件定稿。之后要改就回本阶段，不在契约里悄悄改。"）；`aes-goal-contract/SKILL.md:147-149`（"判据只有一条：这次要动的是现有验收标准，还是一件新的事……都回原契约重做"） | Fact |
| `validate-goal-contract.mjs` 是无状态的纯校验脚本：每次读取 `contract.md` 当前内容重新判定，不锁定"已生成过一次就不能再改"；`session.mjs finalize` 同理，可重复对同一份契约调用 | `.claude/skills/workflow-interview/scripts/validate-goal-contract.mjs:1-23,262-270`；`session.mjs:380-427` | Fact |
| `session.mjs` 的 `stage` 命令目前只有一种"回退"落点：写死 `STAGES[0]`（`1-interview`），没有"退回到某个中间阶段"或"仅在当前阶段追加一轮"这种更细粒度的状态迁移 | `session.mjs:222-229` | Fact |
| `aes-prototype` 判断"新变化要不要出新对照物"已有现成门禁：六面影响面扫描表（界面/行为/输出/接口/配置/历史兼容性），逐面判"有/无"，"无"也要写明理由 | `aes-prototype/SKILL.md:27-49` | Fact |
| `rounds.jsonl` 的 `triggered_by` 字段就是为了记录"这次回流的问题是被哪份阶段草稿撞出来的"，`overturned_recommendation`/`cross_repo_boundary` 是可 grep 的偏差信号字段 | `workflow-interview/references/asking.md:145-149`；`aes-prototype/SKILL.md:150-152` | Fact |
| 仓库没有针对 `.claude/skills/workflow-interview` 这套编排脚本本身的单元测试或 CI 门；根 `package.json` 的 `npm test` 覆盖的是 `skills/`（另一套 pi 包）而非 `.claude/skills/`。可用的验证途径只有：`node session.mjs finalize <dir>`（结构校验 + `[A]` 档命令冒烟）与直接跑 `validate-goal-contract.mjs` | `package.json:7-10`；未找到 `.claude/skills/workflow-interview/**/*.test.*` | Fact |

## 验证基建候选池

- **`node <workflow-interview>/scripts/session.mjs finalize <issue-dir>`**：跑 `validate-goal-contract.mjs` 结构校验 + 全部 `[A]` 档 Verify 命令冒烟，是这套编排脚本自身仅有的、现成的、可重复执行的验证入口。代价：只验证契约结构和命令可跑，不验证"改需求"这件事的语义效果本身（因为这次改的多半是 SKILL.md 文档规则，不是可断言的产品代码）。
- **直接跑 `node validate-goal-contract.mjs <contract.md>`**：更细粒度，用于单独校验某份契约文件格式。代价同上。
- **人工走查（用真实 issue 触发一次"契约定稿前追加 AC"和"报 needs_reinterview"两条路径，对照 SKILL.md 新规则是否被正确执行）**：仓库没有自动化 harness 能"跑一遍 Agent 读 SKILL.md 后的行为"，这类验证目前只能人工走查。代价含先手动构造一个小 issue 目录跑一遍全流程，成本中等但可行。
- **新建自动化基建（比如给 session.mjs 加单元测试）**：仓库目前完全没有，代价含从零搭测试框架，只有当契约范围涉及给 `session.mjs` 加新的可执行分支（新 status、新子命令）时才值得考虑；如果范围收窄成纯文档规则改动，这条不适用。

## 四分类

### Fact
（已在"已查事实"表格列出，此处不重复。）

### User decision（把"中途改需求"拆开的子问题，逐条裁决结果——见 rounds.jsonl round 1/2）

1. **"中途"指哪个时间点？** 已裁决：用户举的具体场景是③对照物已确认、进了 3-contract
   提问区、契约还没 `finalize`/未定稿（round 1 Q1，用户原话见 rounds.jsonl）。用户
   同时承认自己此前没有细分过①②④这几种，不强行覆盖，本次范围只锁③这一种；
   ①②（访谈/对照物阶段中途反悔）现状已由"回到该阶段继续问/迭代"覆盖，不算新诉求；
   ④（`finalize` 后才想加）现状已由"回原契约重做"覆盖，round 2 已确认沿用不新增。
2. **"改需求"改的是哪一类东西？** 已裁决：round 1 Q3 选 A——仅限"追加/微调一条独立
   验收条件"，不动目标、边界，也不动已确认对照物内容。②③④（改目标/边界/已确认
   对照物）明确排除在本次范围外，round 2 用户原话确认"改对照物或改目标那种还是走
   原来的 needs_reinterview 没问题，我要的从来不是那种大改"。
3. **和已有 `needs_reinterview` 机制的关系是什么？** 已裁决：round 1 Q2 用户原话
   "好像……还真有点像，我可能就是想要一个更轻的版本——不用整个打回第一阶段重新走
   一遍，只是想在契约还没定稿前，能追加一条新的验收条件"；round 2 进一步确认落到
   选项 B——不新增平行机制，把诉求归入"契约未定稿前继续在 3-contract 提问区追问"这条
   既有路径，只需要把这条路径在文档里写清楚、划清和 `needs_reinterview` 的边界。
4. **新增的验收条件要不要触发 `aes-prototype` 重新出一次对照物？** 已裁决（round 1
   confirm 项）：按现有六面影响面门禁自行判断，涉及界面/行为变化才重出对照物，纯
   文字性质不用，不新增强制步骤，也不改 `aes-prototype/SKILL.md`。
5. **要不要新命令 / 新 `status` / 新子系统？** 已裁决（round 2 confirm 项，用户原话
   "不用新命令新状态，就是把契约没定稿前能加一条这件事讲清楚就行"）：不碰
   `session.mjs` 状态机，不新增 `status`、不新增子命令，只在 SKILL.md 层面写清规则。

**收敛后的三档决策规则**（round 2 已用户确认，作为本次改动的核心内容）：
- ① 契约未定稿前追加/微调一条独立 AC → 留在 `3-contract` 当前提问区继续问，不算
  回退，不触发 `needs_reinterview`（现状已支持，本次只是写清楚）。
- ② 要改已确认对照物内容，或改目标/边界 → 仍是材料歧义，走既有 `needs_reinterview`，
  回 `1-interview`（现状不变，本次不动）。
- ③ 契约已 `finalize` 通过后才想加 → 按既有"回原契约重做"规则，编辑 `contract.md`
  重新 `finalize`，不回 `1-interview`（现状已支持，本次只是写清楚）。

### Agent-owned（局部、可逆、不改公共契约，交给执行 Agent 自行决定）

- 新增文档规则在 SKILL.md 里落在哪个具体段落、用什么小节标题表达（只要不新增用户没同意过的命令/状态位，纯文档结构属于可逆的实现细节）。
- 如果最终范围包含给 `rounds.jsonl` 补充字段说明（例如强调 `triggered_by` 在"改需求"场景下怎么填），字段已经存在，只是补文档，不算新契约。

### Blocked
（无）

## 决定边界未知项
（round 1/2 已收口，无遗留。）

## 未知项
（无跨出仓库边界、读不出来的项；五条子问题均已在仓库能力范围内被用户回答收口。）
