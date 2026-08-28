# Issue #82 — aes-issue-worker: owner session 闭环技能持续维护
label: wayfinder:map  |  state: OPEN  |  抢救时间: 2026-08-28

一技能一 map。`aes-issue-worker` 的所有 Issue 作为原生 sub-issue 挂在本票下。

## 技能定位

在一个 owner session 内把一张 typed IssueWorkOrder 跑成 typed 终局：
tdd/diagnosing ⇄ aes-qa 循环轮 → simplify（条件触发）→ 单次 candidate commit
→ aes-qa 最终轮（receipt 绑 SHA）→ READY_TO_MERGE terminal 进 registry，或明确人工态。
组合器技能：方法论来自 tdd / diagnosing-bugs / codebase-design，验证来自 aes-qa，
清理来自 simplify（code-review 归 aes-merge-worker，#83 移层），
自己只做阶段编排、证据绑定、预算记账。不 merge、不写 GitHub、不自行挑选 Issue。

## 与其他 map 的边界

- #5 aes-worktree-board：Master 控制面（master.mjs、registry、merge gate）归 #5；
  worker owner session 内的流程与 SKILL.md 归本 map。
- #15 aes-qa / #47 aes-gate：QA 档位与 gate 检测各归各票；本技能只消费它们。

## Decisions so far

- 2026-08-27 round 1–9（#83）：worker 闭环重写为 hub-and-spoke 三 lane 架构——
  aes-issue-worker（干活）/ aes-merge-worker（合并验收，待建）/ 人参与 lane
  （aes-issue-worker 的 for-human 模式）全部平级挂总管下，lane 间零直连。
- worker 闭环：tdd/diagnosing ⇄ aes-qa 循环轮 → simplify（条件触发）→ 单次
  candidate commit → aes-qa 最终轮（typed receipt 绑 SHA）→ READY terminal 进 registry。
- code-review 移出 worker：由 aes-merge-worker 派生（effectiveRisk 分档），
  reviewLoops 记账权归 merge-worker；打回报文 aes.issue-worker.review-return/v1。
- aes-qa 单一验证角色（循环轮/最终轮/回归三种调用）；落地面纯 prose、
  work-order/v1 零字节改动（Q1 撤销）。
- session 断点只落在 typed 状态边界（人工态 / BUDGET_EXHAUSTED / 意外中断），
  不预先规划双 session。

## 任务列表

- [x] #83 流程重梳（已交付合入 dev：prose 修订 `1126794`、#86 修正 `0e4ec20`；剩余验收面 = AC-001~004 人工语义对照，对照物锁定于 `.aes-workflow/grilling/2026-08-27-aes-issue-worker-流程重梳/2-prototype/`，完成后关票）
- [x] #86 「查预算」段把写操作 stage 标成只读查询（修复已合入 dev `0e4ec20`，已关票）
- [ ] #89 缺「验收既有候选分支」入口，前置检查与单次 candidate 不变量在该场景下自相矛盾（needs-triage）
- [ ] #96 registry 控制面脚本不存在时无降级路径，SKILL.md 的三处 master.mjs 调用会静默落空（needs-triage）
- [ ] #97 READY_TO_MERGE 不要求区分「本次引入的冲突」与「接手前既有的冲突」（needs-triage）
- [ ] #94 aes-merge-worker 合并验收 lane 落地（挂 #5；code-review 移层的消费方、review-return/v1 打回协议的产生方）
- [ ] for-human lane 实现票——待开（角色位与协议复用已由 #83 锁定，本票不实现；建议 #94 落地后再评估开票）
