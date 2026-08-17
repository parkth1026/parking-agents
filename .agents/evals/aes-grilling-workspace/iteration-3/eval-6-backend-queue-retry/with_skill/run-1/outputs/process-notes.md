# 流程记录（process-notes.md）

- 技能：aes-grilling（G:\GIT\AI_WorkFlow\aes-workflow\skills\productivity\aes-grilling\SKILL.md），只读遵循，未修改任何技能文件。
- 目标仓库：...\run-1\workdir（订单事件消费者 order-consumer）。
- 用户原始请求：「order-consumer 这个消费者，订单事件处理失败就直接丢了，帮我把改进需求理清楚，写份 goal contract。先不要动代码。」
- 模拟用户：run-1\PERSONA.md；未覆盖项一律取执行方推荐项。未做任何需求实现代码改动，未做 git 提交。

## 阶段执行情况

### 阶段 1：调查事实（执行，0 轮用户交互）

直接读取 workdir 全部 7 个文件（README、package.json、src/consumer.mjs、src/handler.mjs、test/run-tests.mjs、docs/testing.md、data/events.jsonl）。事实量小且互相关联，未派遣 subagent（不满足「两个以上互不依赖的事实问题」的并行价值）。

判定结果：

- Fact｜验证基建（固定必查项）：`npm test` = node test/run-tests.mjs，退出码 0 为过；docs/testing.md 约定消费链路改动需补失败路径断言、无集成环境、用本地 jsonl 验证。→ 第 4 步默认档 [A] 可用。
- Fact｜界面/后端分类（固定必判项）：纯后端。请求本身可直接读出（消费者失败处理，仓库无任何界面成分），不占提问轮次。→ 第 3 步跳过。
- Fact｜现状行为:consumer 逐条消费 events.jsonl，成功写 ledger.jsonl（{"id":...,"ok":true}），失败仅 console.error 后丢弃并继续下一条；handler 对非法 amount 抛永久性错误，另有网络抖动类临时错误。
- User decision｜失败处理策略、留痕位置与格式、错误类型是否区分、范围边界（界面/监控/告警/中间件）、兼容性底线 → 共 5 个，进入阶段 2。
- Agent-owned｜重试间隔具体数值序列、死信行内部字段命名、重试实现方式 → 写入 Contract 的 May decide。
- Blocked｜无。

### 阶段 2：批量问清歧义（执行，1 轮）

- 先给完整推荐候选（Goal 一句、In/Out 各一句、AC 方向）作为靶子。
- 独立歧义 5 个 > 4，按技能约定改用编号文本一次全列（未拆轮次）；每题附证据摘要、2-3 个互斥选项、推荐项与真实代价。
- PERSONA 覆盖 Q1、Q2、Q4、Q5；Q3（是否区分永久/临时错误）未覆盖，取推荐项（统一重试）。
- 回答后逐维度自评：Intent/Outcome/Boundary/Constraints/Context 全部「已定」；收口审计通过（剩余问题均为 Agent-owned，不同答案不改变执行）。默认一轮结束，无追加轮次。

### 阶段 3：界面 Mock（跳过）

阶段 1 判定为纯后端，按技能规定跳过，未产出 mock。

### 阶段 4：对齐验收标准（执行，1 轮）

- 起草 5 条 AC 一次全列，邀请一次回复完逐条裁决。
- Verify 全部默认档 [A]（`npm test`）：基建存在且判据无歧义，按技能自动采用，不占提问轮次；升级条件逐一核对——[A] 可用（不命中）、不涉真实外部系统（docs/testing.md 明确本地 jsonl 验证，不命中）、数字门槛（重试 3 次）值来自用户第 1 轮回答、尺子为 npm test 断言（已在展示中说明，PERSONA「你推荐什么就是什么」接受）。
- 非优化型目标，无测量脚本锁定需求；纯后端无 mock 对照 AC。
- PERSONA：验收跟仓库测试约定走 → 5 条全部接受，AC 定稿。无新材料歧义暴露，未回流阶段 2。

### 阶段 5：形成并确认 Contract（执行，1 轮）

- 读取 references/goal-contract-template.md 严格按模板生成；读取 goal-contract-example.md 校准信息密度。
- Success Criteria 直接采用阶段 4 定稿；Read First 指向实际依赖的 docs/testing.md；无 [B] 档 fixture，Deliverables 节省略；无 mock。
- 向模拟用户展示完整候选与 Goal/In-Out/AC/Blocker 摘要；PERSONA 各项均已体现 → 确认。
- 落盘：workdir/docs/goal-contracts/2026-08-07-order-consumer-retry-dead-letter.md，Status: Ready（歧义判据满足、AC 定稿、无 Blocker、可独立交接）。

### 阶段 6：校验与交接（执行，0 轮用户交互）

- 运行 scripts/validate-goal-contract.ps1 → VALID，STATUS Ready，AC_COUNT 5，LINE_COUNT 64，退出码 0，无 WARNING（完整输出见 validation.txt）。
- 校验一次通过，未发生「校验失败-修正」循环。

## 轮次汇总

| 阶段 | 执行/跳过 | 用户交互轮次 |
|------|-----------|--------------|
| 1 调查事实 | 执行 | 0 |
| 2 批量问清歧义 | 执行 | 1 |
| 3 界面 Mock | 跳过（纯后端） | 0 |
| 4 对齐验收标准 | 执行 | 1 |
| 5 形成并确认 Contract | 执行 | 1 |
| 6 校验与交接 | 执行 | 0 |
| 合计 | — | 3 |

## 最终报告（按技能阶段 6 要求）

- 状态：Ready
- 绝对路径：G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-3\eval-6-backend-queue-retry\with_skill\run-1\workdir\docs\goal-contracts\2026-08-07-order-consumer-retry-dead-letter.md
- Goal：失败事件自动重试最多 3 次（间隔递增），耗尽后以可人工回放格式落 data/dead-letter.jsonl（含原始事件与失败原因），成功路径与 ledger.jsonl 格式不变。
- In：消费链路失败处理（重试 + 死信落盘 + 失败路径测试）。Out：界面/监控/告警、换队列/引中间件、死信自动回放工具、handler 校验规则调整。
- AC 数量：5（全部 [A] 档 `npm test`）。
- 校验结果：VALID，退出码 0，无 WARNING。
- 启动指令（按 references/handoff-prompt.md 变体一生成，本次评测仅对齐需求、不启动实现）：

```text
按 G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-3\eval-6-backend-queue-retry\with_skill\run-1\workdir\docs\goal-contracts\2026-08-07-order-consumer-retry-dead-letter.md 执行。

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
