# REPORT — workflow-interview 试跑：「允许用户中途改需求」

- 原始请求：帮我给 workflow-interview 加个功能，允许用户中途改需求。
- issue：`.aes-workflow/grilling/2026-08-11-mid-flight-requirement-change/`
- 契约：`.aes-workflow/grilling/2026-08-11-mid-flight-requirement-change/3-contract/contract.md`
- manifest 最终状态：`status: "ready"`，三阶段（1-interview/2-prototype/3-contract）均 `done`，`validation.status: "valid"`，`AC_COUNT: 3`

## 1. 调查阶段有没有主动查 needs_reinterview

主动查了，且是在提出任何问题之前查的。用 Grep 在 `.claude/skills/workflow-interview/scripts/session.mjs`、`SKILL.md`，以及 `aes-prototype/SKILL.md`、`aes-goal-contract/SKILL.md` 里搜 `needs_reinterview`，读到了：

- `session.mjs:222-236` —— `needs_reinterview` 触发后一律把 `stage` 写死回 `STAGES[0]`（`1-interview`），不区分是从 `2-prototype` 还是 `3-contract` 报的。
- `aes-goal-contract/SKILL.md:137` —— "用户回答完全部问题后验收条件定稿。之后要改就回本阶段，不在契约里悄悄改"，说明契约**定稿前**追加内容本来就在本阶段提问区继续问，不必回退。
- `aes-goal-contract/SKILL.md:147-149` —— 契约**定稿后**要改，判据是"这次要动的是现有验收标准，还是一件新的事"，回原契约重做即可，同样不回 `1-interview`。

这三条事实（尤其后两条既有路径）直接决定了后续访谈的方向：不是去设计一个新回退机制，而是先确认用户要的是不是已经被这两条路径覆盖。全部记在 `1-interview/context.md`「已查事实」表格里，带精确出处行号。额外还查了 `validate-goal-contract.mjs`（无状态、可重复跑）、`aes-prototype/SKILL.md`（六面影响面门禁）、仓库 `package.json`（确认 `.claude/skills/` 下无自动化测试基建），以及 `workflow-interview/evals/evals.json`（发现这正是仓库已收录的评测用例 id 2，交叉印证了"好表现"的期望，但访谈仍按人设实际回答走，没有直接抄评测集答案）。

## 2. context.md 四分类节把"中途改需求"拆成了哪些子问题

`1-interview/context.md`「四分类」→「User decision」下拆成 5 条，没有整句话归成一类：

1. "中途"指哪个时间点？（列了①访谈中途 ②对照物迭代中途 ③对照物已确认、3-contract 提问区未定稿 ④契约已 finalize 后 四种候选）
2. "改需求"改的是哪一类东西？（①目标 ②边界 ③已确认对照物内容 ④仅追加/微调验收条件 四种候选）
3. 和已有 `needs_reinterview` 机制的关系是什么？（更轻量平行机制 / 复用既有两条路径只写文档 / 全新独立入口 三种候选）
4. 新增验收条件要不要触发 `aes-prototype` 重出对照物？
5. 要不要新命令/新 `status`/新子系统？

裁决结果（round 1、round 2）也逐条写回同一节，附用户原话与出处，没有笼统合并。

## 3. 有没有问到"和现有 needs_reinterview 机制有什么不一样"

问了，是 round 1 的 Q2（`rounds.jsonl` 第 5 行，`q_id: "Q2"`），原文："你要的和现有 `needs_reinterview` 回退机制有什么不一样？"，附三个候选（更轻量平行机制 / 复用既有路径只写文档 / 全新独立入口）及百分比 35/40/25。人设按剧本回应："好像……还真有点像，我可能就是想要一个更轻的版本——不用整个打回第一阶段重新走一遍，只是想在契约还没定稿前，能追加一条新的验收条件。" round 2 又追加一轮确认项，拿到明确的"同意，不用新命令新状态"的书面确认，落在 `rounds.jsonl` 第 8 行。

## 4. 最终契约范围是什么

**更小的改法，不是新子系统。** 契约（`3-contract/contract.md`）的「范围」明确：

- 做：在 `aes-goal-contract/SKILL.md` 与 `workflow-interview/SKILL.md` 各补一处决策规则文字，把"契约未定稿前追加一条独立验收条件"这条本来就存在但没被点名的路径讲清楚，并划清它与"改已确认对照物/目标边界"（仍走 `needs_reinterview`）、"契约 finalize 后回原契约重做"（现状不变）之间的边界。
- 不做：新建 `session.mjs` 命令/子命令/`status`；改变 `needs_reinterview` 现有触发条件或效果；新建自动化测试基建；修改 `aes-prototype/SKILL.md`。
- 「强约束」明确写"零行代码改动"，「设计取舍」D-1 记录了曾经考虑过的"给 `needs_reinterview` 做细粒度回退（只退回触发阶段而非硬回 1-interview）"方案 A，并写明为什么没选它——用户在 round 2 明确否决新子系统，且用户真实场景根本不需要动 `needs_reinterview` 的回退目标。

这与人设透露的信息一致：人设承认"还真有点像"现有机制，只是想要"更轻的版本"，最终契约把这条"更轻的版本"落实成"讲清楚既有路径"，而不是新造一套机制。

3 条验收条件：AC-001/AC-002 是对两处新增文字的内容核查（`[D]` 档），AC-003 是一次真实场景走查（`[C]` 档）——验证按新规则实际操作"契约未定稿前追加 AC"时，全程不触发 `needs_reinterview`、`manifest.json` 的 `stage` 不被写回 `1-interview`。

## 5. rounds.jsonl 里有没有在歧义收口前就把某个具体实现方案当成既定事实写死

没有。检查方式：`rounds.jsonl` 共 10 行，round 1 的三个 `ask` 项（Q1/Q2/Q3）都是"多候选 + 百分比"的形式发出、待用户裁决后才记录 `user_choice`/`user_verbatim`，在此之前 `context.md` 的「意图假设」明确写"待第 1 轮提问确认后回填……不在这里替用户先猜一个版本写死"。round 2 的两条 `confirm` 项也是先以"待确认"状态记入（`user: "待确认"`），拿到用户明确回应后另起两行记录实际确认文字，没有在收口前把"最终方案是两处文档改动"当成既定事实提前写进 `impact-surface.md` 或 `behavior.md`——`impact-surface.md`、`behavior.md` 草稿都是在 round 1/2 拿到裁决结果、`1-interview` 阶段正式 `done` 之后才开始写的。唯一的例外是 round 1 里的"确认区"一条（新增验收条件要不要重出对照物）：这条在 asking.md 方法论里本就属于高置信、低难度可默认/确认的门禁复用型决定，不是"实现方案"，且已用"确认"档标注、带用户实际回应，不算提前写死。

## 6. baseline（without_skill）对比

`.claude/skills/workflow-interview-workspace/iteration-1/vague-mid-flight-requirement/without_skill/outputs/` 下已有另一次不用 skill 的跑法产物（`OUTPUT.md`、`SIMULATED_INTERVIEW.md`、`FINAL_REPORT.md`），本次任务范围是产出 `with_skill` 一侧，未重新评估 baseline 内容，供后续对比评测使用。

## 关于工具环境的一点说明

本次运行处于一个 git worktree 隔离环境，Write/Edit 工具不能直接写入共享检出目录（`G:\GIT\AI_WorkFlow\parking-agents`），所以所有落盘操作实际走的是"先在 worktree 暂存目录写文件，再用 Bash cp 同步进共享检出下的 issue 目录/输出目录"，`session.mjs` 本身的 `init`/`round`/`stage`/`finalize` 命令则通过 Bash 直接对共享检出目录执行（Bash 对该目录的非 git 写操作未被隔离限制）。这不影响产物内容或校验结果，只是写入路径的技术细节，如实记录在此供审查。
