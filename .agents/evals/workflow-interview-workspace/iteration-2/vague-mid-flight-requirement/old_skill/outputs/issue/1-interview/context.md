# Context Snapshot: 2026-08-13-workflow-interview-mid-flight-requirement-change

- 创建：2026-08-13T00:00:00Z
- 分片来源：`facts/existing-mechanisms.md`

## 任务陈述
帮我给 workflow-interview 加个功能，允许用户中途改需求。

## 用户提出的方案
未提出。用户只给了一句目标性的话，没有带具体设计。

## 意图假设
用户是 workflow-interview 的作者。第一轮追问后确认：他脑子里的真实场景是——访谈已经
问完、对照物也确认过了，进入 `3-contract` 阶段快收尾时，突然想加一条新的验收条件。
他自己承认这算不算「中途改需求」没细分过，且这个场景和仓库里已有的 `needs_reinterview`
回退机制「好像还真有点像」，他想要的其实是一个更轻的版本——不用把整个流程打回
`1-interview` 重新走一遍，只是想在契约还没定稿前追加一条验收条件。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| `needs_reinterview` 是目前唯一的「回退改需求」路径，触发后强制把 `manifest.stage` 打回 `1-interview` | `session.mjs:222-229` | Fact |
| `session.mjs stage` 不限制状态转换方向，任何阶段都能被设回 `in_progress`，无守卫代码 | `session.mjs:188-242` | Fact |
| `manifest.json` 没有版本号或变更历史字段 | `session.mjs:89-111` | Fact |
| `aes-goal-contract` 已经写明「任务已经存在时改它的契约文件，不新建」，AC 编号规则允许追加 | `goal-contract-shape.md:11-13, 198-202` | Fact |
| `3-contract` 定稿前本就是迭代过程（逐条带候选、批量提问、改哪就改哪），不算回退 | `aes-goal-contract/SKILL.md:50-121` | Fact |
| `aes-prototype` 已有六面影响面判断表，用来决定新变化要不要出对照物 | `aes-prototype/SKILL.md:33-49` | Fact |
| `finalize` 的残留风险对账只覆盖「访谈时主动跳过」，不覆盖「契约定稿后又改」 | `session.mjs:452-463` | Fact |
| workflow-interview 完全不掌握「执行 Agent 是否已经开始按交接指令跑」 | 无对应代码/字段 | Fact（负向：查不到） |

## 验证基建候选池

这次改动落在三份 SKILL.md 文档 + 可能一份 references 文档，不改 `session.mjs` 代码
（详见下方「四分类」的 Agent-owned 项与用户在提问区的选择）。因此验收途径的候选：

- **`node .claude/skills/workflow-interview/scripts/validate-goal-contract.mjs <contract路径>`**：
  仓库现成的结构校验脚本，能验证任何示范性 `contract.md` 追加 AC 后仍然合法（编号连续、
  Verify 档位齐全等）。代价：只验证契约结构，验不出 SKILL.md 文字指导是否真的把「中途
  改需求」这条路径讲清楚了——那部分只能靠人读。
- **`node .claude/skills/workflow-interview/scripts/session.mjs finalize <issue-dir>`**：
  端到端跑一遍校验+冒烟+交接闸门，用来验证「重开 3-contract 后再 finalize」这条路径本身
  可执行。代价：需要一个真实或示范性 issue 目录当 fixture。
- **人工读 SKILL.md 逐段核对**：因为这次的交付物主要是给 Agent 读的编排文字，没有可
  自动断言的「语义正确」标准，这条代价是「验不出遗漏，只能靠人过一遍」。

## 术语冲突

- 用户说的「中途改需求」在仓库里最接近的既有词是 `needs_reinterview`（回退重新访谈）。
  但用户澄清后确认自己指的不是这个，而是「契约定稿前追加一条验收条件」——一词多义，
  已在提问区第一题里让用户明确裁决覆盖范围（见下方「四分类」与 `rounds.jsonl`）。

## 四分类

- **Fact**：见上表全部条目；另加「六面影响面表本身的判据（有无可观察差异）不必重新
  发明，直接套用到『新增/修改的验收条件要不要触发 aes-prototype』这个判断上」——这是
  从仓库现有规则直接推出的，不需要用户裁决。
- **User decision**：
  1. 「中途」覆盖的时间窗口——只到契约 `finalize` 前，还是也覆盖 `finalize` 完成后
     （`ready`）但还没执行，还是也覆盖执行 Agent 已经按交接指令开始跑之后。这个决定
     会改变要不要引入「重开阶段」这个动作，边界一旦选窄了，后续「已经 ready 又要加」
     的场景就没有路径可走；选宽了又要处理仓库完全查不到的「执行 Agent 进度」，属于
     跨仓库边界、必须问。
  2. 「中途改需求」是否只包含「追加新 AC」，还是也包含「修改/删除已确认的 AC」——
     两种答案对应不同的收尾流程（前者可以只补一条，后者要处理『已经做的工作可能作废』
     这类不可逆代价）。
  3. 新增/修改的验收条件是否要求先回 `2-prototype` 出新对照物——虽然仓库已有六面判据
     可以直接套用，但要不要把这条路径正式写进「中途改需求」的流程说明里，需要用户
     确认这条判断规则确实是他想要的（确认区，非提问区，因为判据已经现成）。
- **Agent-owned**：
  - 具体在哪几份 SKILL.md 文件、哪个小节落笔这条新流程说明，属于局部、可逆、不改变
    外部契约的写作选择，执行 Agent（也就是这次任务的我）自行决定。
  - 是否新增一份独立的 `references/amend.md` 还是直接写进 `workflow-interview/SKILL.md`
    正文，同理交给执行者判断，只要不引入新脚本命令。
- **Blocked**：无。

## 决定边界未知项

无——上面三条 User decision 已经在下一节的提问里问清。

## 未知项

- 执行 Agent（codex `/goal` 侧）拿到「契约变了」之后会不会主动重新读取最新 `contract.md`，
  这件事跨出本仓库，读不出来，因此在提问区把「是否要覆盖执行开始之后」的场景单独列出，
  并写明查不到这一层事实。
