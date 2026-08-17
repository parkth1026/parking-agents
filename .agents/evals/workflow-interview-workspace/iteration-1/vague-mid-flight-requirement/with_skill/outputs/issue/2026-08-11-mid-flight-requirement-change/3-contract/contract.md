# Goal Contract: 给 workflow-interview 补一条"契约未定稿前追加验收条件"的既有路径说明

- Status: Ready
- Target: `.claude/skills/aes-goal-contract/SKILL.md`, `.claude/skills/workflow-interview/SKILL.md`
- Updated: 2026-08-11

## 原始请求

> 帮我给 workflow-interview 加个功能，允许用户中途改需求。

## 目标

契约还没 `finalize` 定稿时用户想追加一条新验收条件，SKILL.md 能明确指导执行 Agent 留在 `3-contract` 继续追问，不再误判成材料歧义去触发 `needs_reinterview` 整体回退。

## Why

- 仓库已有 `needs_reinterview` 机制，但它的效果是硬回退到 `1-interview`
  （`session.mjs:222-236`），不区分是"真正的材料歧义"还是"契约定稿前想追加一条
  独立验收条件"这种局部动作。
- `aes-goal-contract/SKILL.md:137` 其实已经允许"契约未定稿前继续在提问区追问"，
  `aes-goal-contract/SKILL.md:147-149` 也已经允许"契约定稿后回原契约重做"，两条路径
  技术上都已覆盖用户的诉求，只是没有被点名，执行者读到"想加一条新东西"时容易联想到
  `needs_reinterview` 而误用它。
- 把这两条既有路径讲清楚，用户就能得到"更轻的版本"，且不需要新造一个命令或子系统。

## 范围

做：在 `aes-goal-contract/SKILL.md` 与 `workflow-interview/SKILL.md` 各补一处决策
规则文字，讲清"契约未定稿前追加一条独立验收条件"这条既有路径，并划清它与"改已确认
对照物或目标/边界"（仍走 `needs_reinterview`）、"契约 `finalize` 后才想加"（仍走
"回原契约重做"）之间的边界。

不做：新建任何 `session.mjs` 命令、子命令或 `status`；改变 `needs_reinterview` 现有
触发条件或效果；让"改已确认对照物内容"或"改目标/边界"也走这条更轻的新路径（那些
明确仍归 `needs_reinterview`）；新建任何自动化测试基建；修改 `aes-prototype/SKILL.md`
的六面影响面门禁规则。

## 强约束

- 零行代码改动：不新增、不修改 `.claude/skills/workflow-interview/scripts/session.mjs`
  的任何子命令、`STATUSES`、`STAGES` 或函数签名。
- 不修改 `.claude/skills/aes-prototype/SKILL.md`。
- `needs_reinterview` 现有触发条件与效果（触发后 `stage` 一律重置为 `STAGES[0]`）
  保持不变，这次不引入"只退回触发它的那个中间阶段"这类新能力。
- 不新增 `rounds.jsonl`、`manifest.json` 的字段，schema 保持不变。
- 确认版对照物 `2-prototype/behavior.md` 不得修改，执行 Agent 改的是 SKILL.md 正文。

## 读什么

- `../2-prototype/behavior.md`，确认版行为对照表，4 行变化 + 不变清单是这两处
  SKILL.md 新增文字的直接依据。
- `.claude/skills/workflow-interview/scripts/session.mjs` 第 222-236 行，
  `needs_reinterview` 现有实现，新增文字不得与它矛盾。
- `.claude/skills/aes-goal-contract/SKILL.md` 第 137 行与第 147-149 行，"契约定稿前
  继续追问"与"定稿后回原契约重做"这两条已有路径目前的措辞位置。

## 验收条件

- AC-001: `aes-goal-contract/SKILL.md` 里新增的规则文字，明确说明"对照物已确认、
  进入 `3-contract` 提问区、契约还未 `finalize` 时，用户追加一条不涉及目标/边界/
  已确认对照物的新验收条件"属于本阶段提问区继续追问，不触发 `needs_reinterview`。
  - Verify: [D] 读 `.claude/skills/aes-goal-contract/SKILL.md`，确认能找到明确覆盖
    上述场景、并给出"不触发 needs_reinterview、留在本阶段继续问"这一结论的文字。
- AC-002: `workflow-interview/SKILL.md` 补充判据，帮助分辨三种情境各自该走哪条路：
  ①契约定稿前追加一条独立 AC（走 AC-001 的新规则）；②改已确认对照物或目标/边界
  （仍走 `needs_reinterview`，回 `1-interview`，现状不变）；③契约已 `finalize` 后
  才想加（回原契约重做，重新 `finalize`，现状不变）。
  - Verify: [D] 读 `.claude/skills/workflow-interview/SKILL.md`，确认"回退"节或紧邻
    处能找到覆盖上述三档判据的文字，且②③两档的描述与现状（`session.mjs:222-236`、
    `aes-goal-contract/SKILL.md:147-149`）一致，未引入新状态或新命令的措辞。
- AC-003: 按新规则实际走一遍"契约未定稿前追加 AC"的场景，执行 Agent 全程不调用
  `needs_reinterview`，`manifest.json` 的 `stage` 不被重置为 `1-interview`。
  - Verify: [C] 在任意测试 issue（或本次这个 issue 自身）的 `3-contract` 阶段，于
    `finalize` 通过之前追加一条新的 AC 候选并按 `session.mjs round` 记入
    `rounds.jsonl`（`"stage":"3-contract"`）；全程不出现对该 issue 目录调用
    `session.mjs stage` 且状态参数为 `needs_reinterview` 的记录，`manifest.json`
    的 `stage` 全程不被写回 `1-interview`。

## 挡着的事

- None.

## 访谈记录

### 第 1 轮（1-interview）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| "中途"具体指哪个阶段/情境？ | A 访谈/对照物阶段中途 20% / B 对照物已确认、3-contract 提问区、未定稿 40% / C 契约已 finalize、执行未开始 25% / D 执行已开始后 15% | B | B（倾向）。原话：「访谈已经问完、对照物也确认过了，进入到 3-contract 阶段快收尾时，我才突然想加一条新的验收条件——这算不算中途改需求，我自己也没细分过」 |
| 和现有 `needs_reinterview` 有什么不一样？ | A 更轻量的平行机制，只退回触发阶段 35% / B 不新增机制，归入既有两条路径只写清楚 40% / C 全新的随时可打断的入口/命令 25% | B | 倾向 B。原话：「好像……还真有点像，我可能就是想要一个更轻的版本——不用整个打回第一阶段重新走一遍，只是想在契约还没定稿前，能追加一条新的验收条件」 |
| "改需求"实际想覆盖多大范围？ | A 仅追加/微调一条 AC 45% / B 也含改已确认对照物 30% / C 也含改目标/边界 25% | A | A（选推荐项） |

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 新增验收条件要不要触发 `aes-prototype` 重出对照物 | 确认 | 现有六面影响面门禁已能回答"是否有可观察差异" | 未反对，补充：「看情况，涉及界面/行为变化就要，纯文字性质的就不用，按现有门禁规则判断」 |

### 第 2 轮（1-interview，收敛确认）

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 最终方案不新增 `session.mjs` 任何命令/状态位，只补两处 SKILL.md 文字 | 确认 | 用户自己表述的"更轻版本"本质就是把既有路径写清楚 | 未反对，原话：「同意——不用新命令新状态，就是把契约没定稿前能加一条这件事讲清楚就行」 |
| 三档决策规则（定稿前追加AC / 改对照物或目标边界走needs_reinterview / 定稿后回原契约重做） | 确认 | 对应 Q3(A) 与已查明的两条既有路径 | 未反对，原话：「三档划分对，改对照物或改目标那种还是走原来的 needs_reinterview 没问题，我要的从来不是那种大改」 |

### 第 3 轮（2-prototype，对照物确认）

| 对照物 | 用户意见 |
| --- | --- |
| `behavior.md` draft v1（4 行变化 + 不变清单） | 一次通过，无修改。原话：「这个对得上，就是我想要的效果——追加一条 AC 不用被打回第一阶段，改对照物/改目标那种还是老样子。没有别的意见，通过」 |

没有条目被用户翻掉推荐项；本次访谈的三个提问全部落在推荐项或用户明确倾向的选项上，
没有出现"给低了却被选中"的情况。

## 设计取舍

### D-1 要不要给 `needs_reinterview` 做一个更细粒度的"只退回触发阶段"版本

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 新增细粒度回退：`session.mjs stage` 支持指定回退目标阶段而非写死 `STAGES[0]` | 改 `cmdStage` 的回退分支，允许 `--reinterview-target 2-prototype` 之类的参数 | 要改代码、要扩展 `STATUSES`/回退语义，且用户已明确表示"不想要一个全新的子系统或新命令" | 用户在 round 2 明确否决，且用户真实场景（对照物已确认、3-contract 提问区）根本不需要动到 `needs_reinterview` 的回退目标，走"继续追问"这条既有路径就够 |
| B（选定）不新增机制，把诉求归入已有两条路径，只写清楚决策规则 | 只改两份 SKILL.md 的文字 | 覆盖面比 A 窄：如果以后真的出现"改对照物"也想要一个更轻的回退，这次不覆盖 | 无（用户明确认可这条覆盖面，round 2 原话见上） |
| 什么都不做 | 保持现状 | 执行者继续容易把"契约定稿前追加 AC"和"materials歧义"混淆，误触发 `needs_reinterview` | 正是这次要解决的问题 |

选定 B。理由：调查阶段发现用户描述的诉求已经被 `aes-goal-contract/SKILL.md:137` 和
`:147-149` 两条既有路径覆盖，缺的只是"点名"和"划清边界"，不是能力缺口；用户本人
确认不想要新子系统，选 B 是覆盖诉求的最小改动。落进契约的形态：`范围` 明确写"不做"
清单排除 A 方案的可能性，`强约束` 写死"零行代码改动"。

## 交付时的落盘方式

<!-- 非模板标准节，用来提醒执行 Agent：这份契约的"代码"就是两处 Markdown 文字，
     不涉及可执行代码，AC-001/AC-002 的判定依据是新增文字的语义是否覆盖到位，
     不是逐字匹配某句话。 -->

两条新增文字建议各自落在对应文件里"回退"相关小节的邻近位置（`aes-goal-contract/
SKILL.md` 靠近第 137 行"用户回答完全部问题后验收条件定稿"一句；`workflow-interview/
SKILL.md` 靠近"### 回退"小节），具体段落结构、标题措辞由执行 Agent 自行决定，只要
AC-001/AC-002 描述的语义都能被读到。
