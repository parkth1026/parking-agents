# 流程记录（aes-grilling skill-snapshot-v2 / eval-6 / old_skill / run-1）

执行方式：完整读取 SKILL.md、references/goal-contract-template.md、references/goal-contract-example.md、references/handoff-prompt.md、scripts/validate-goal-contract.ps1 后按阶段执行。技能文件全程只读。用户交互全部按 PERSONA.md 模拟，未覆盖项选推荐项，逐轮追记于 questions.md。

## 阶段 1：调查事实 —— 执行（1 轮，无用户交互）

- 仓库仅 7 个文件，直接全部读取（README.md、package.json、src/consumer.mjs、src/handler.mjs、test/run-tests.mjs、docs/testing.md、data/events.jsonl）。
- 判定：不存在两个以上互不依赖的事实问题，不派 subagent，宿主自行调查。
- 固定必查项（验证基建）：存在。`npm test` → `node test/run-tests.mjs`，退出码 0 为过；docs/testing.md 约定消费链路改动需补失败路径断言、用本地 jsonl 数据验证、无集成环境。结论：第 3 步默认档 [A] 可用，「怎么算过」不必然升级为用户决定。
- 事实归类：
  - Fact：验证基建、丢事件现状（consumer.mjs catch 后仅 console.error）、错误无分类（校验错误与网络抖动同通道）、台账格式 `{ id, ok: true }`、样例数据 2 条。
  - User decision：失败处理策略（Q1）、最终失败去向与格式（Q2/Q6）、错误是否分类重试（Q3）、范围边界（Q4）、重试计数语义（Q5）、失败是否写台账（Q7）。
  - Agent-owned：重试间隔具体数值与延迟注入方式、handler 可注入性重构、死信附加元数据字段。
  - Blocked：无。
- 词义冲突检查：用户词「丢了」与仓库注释「直接丢弃」一致，无一词多义需裁决。

## 阶段 2：批量问清歧义 —— 执行（2 轮）

- 第 1 轮：先给完整推荐候选（Goal 一句、In/Out 各一句、AC 方向），再批量问 4 个独立歧义（Q1–Q4）。独立歧义 ≤ 4；本环境无 AskUserQuestion 工具，按技能规定退化为编号文本一次发全，实际由 PERSONA 模拟作答。每题含证据摘要、2–3 个互斥选项、推荐项与真实代价。
  - 轮后自评：Intent 已定 / Outcome 部分 / Boundary 已定 / Constraints 已定 / Context 已定。
- 第 2 轮（追加，有明确解锁理由）：Q1 答案解锁 Q5（「重试 3 次」计数语义），Q2 答案解锁 Q6（死信记录形态）与 Q7（失败是否写台账）。三者均改变可观察行为，符合「追加要有理由」。PERSONA 未覆盖，均按人设取推荐项。
  - 轮后自评：五维度全部已定。收口审计通过：剩余问题只改措辞不改执行。停止提问。

## 阶段 3：对齐验收标准 —— 执行（1 轮）

- 一次列出 AC-01..AC-05（结果陈述 + Verify 行），明确可一次回复完，不逐条往返。
- Verify 来源：默认档（仓库基建 `npm test` + docs/testing.md 失败路径断言约定），且用户明示「跟着仓库测试约定走，你推荐什么就是什么」。全部 [A] 档。
- 升级条件逐项检查：基建存在（不触发）；目标不涉及真实外部系统，docs/testing.md 明示用本地 jsonl 数据（不触发）；AC-02 数字门槛「3 次」由用户在 Q1 亲自给出、尺子为测试断言、非优化型目标无需锁测量脚本（不触发独立提问）。
- 无 [B] 档，无 fixture Deliverables 需求。起草中未暴露新的材料歧义，未回退阶段 2。
- 用户（PERSONA）一次回复：五条全部接受。AC 定稿。

## 阶段 4：形成并确认 Contract —— 执行（1 轮）

- 读取 goal-contract-template.md 严格按其生成；读取 goal-contract-example.md 校准信息密度。
- 落盘路径按默认约定（相对 workdir）：docs/goal-contracts/2026-08-07-order-consumer-retry-dead-letter.md。
- Success Criteria 直接采用阶段 3 定稿；Read First 指向 docs/testing.md（阶段 1 实际依赖的证据来源）；可选节 Deliverables 省略（无 [B] fixture，AC 已点名全部产物）；Iteration Strategy 一句话。
- 向用户展示完整候选与摘要，PERSONA 确认后落盘。状态判定：Ready（歧义判据满足、AC 定稿、无 Blocker、无访谈上下文的执行 Agent 可持续执行到全部 AC 满足）。

## 阶段 5：校验与交接 —— 执行

- 运行 scripts/validate-goal-contract.ps1：VALID，STATUS Ready，AC_COUNT 5，LINE_COUNT 64，无 WARNING，exit 0。完整输出见 outputs/validation.txt。
- Ready 状态，启动指令按 references/handoff-prompt.md 变体一生成（见下）；按本次评测约束不启动实现、不改产品代码、不做 git 提交。

启动指令（变体一，contract 路径已替换为绝对路径）：

```text
按 G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-3\eval-6-backend-queue-retry\old_skill\run-1\workdir\docs\goal-contracts\2026-08-07-order-consumer-retry-dead-letter.md 执行。

这份 Goal Contract 是本次需求的唯一权威。先完整读它。其中 Agent Mandate 一节写明了你
可以自己决定什么、必须回来问什么、不能做什么，按它执行。

仓库里查得到的事实自己查，不要回来问我。

完成实现，逐条跑通 Success Criteria 里的 Verify，review 最终 diff，在不改变行为的前提下
simplify。然后按 Completion 的 Final report 要求落盘报告：每条 AC 的 Verify 证据、改动的
文件和剩余风险。

全部 AC 满足之前不要停，也不要只交一份计划。

某条 AC 确实做不到时，把其余部分做完，然后单独说明是哪条、卡在哪里、需要什么才能解开。
不要因为一条卡住就停下整件事，也不要悄悄降低那条的标准。
```

## 轮次汇总

- 阶段 1（事实调查）：1 轮，无用户交互，事实以通报形式写入 questions.md。
- 阶段 2（歧义提问）：2 轮（4 题 + 3 题追加，追加有解锁理由）。
- 阶段 3（AC 裁决）：1 轮。
- 阶段 4（Contract 确认）：1 轮。
- 阶段 5（校验）：1 次，一次通过，未降低规则。
- 跳过项：subagent 并行调查（仓库过小，不满足派遣条件）；[B]/[C]/[D] 档 Verify（基建存在且用户选默认档）；Deliverables 可选节（无落盘 fixture 需求）；aes-grilling-web（用户未要求 Web 工作台）；实现与 git 提交（评测约束 + 技能本身不实现 Contract 目标）。
