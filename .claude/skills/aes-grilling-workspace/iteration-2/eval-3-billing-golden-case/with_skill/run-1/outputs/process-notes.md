# Process Notes（aes-grilling / eval-3 billing golden case / run-1）

## 提问与确认轮数

共 3 轮用户交互：1 轮批量提问 + 2 轮确认（AC 定稿、Contract 候选确认）。AskUserQuestion 不可用，全程走降级路径（编号文本写入 questions.md，按 PERSONA.md 立场作答）。

- 第 1 轮（批量提问，4 个互不依赖歧义，附完整推荐候选作为靶子）：
  1. 「给老板看的那份」格式以什么为权威（仓库无样例）；
  2. 交付形态与调用方式（就地改 summarize.mjs / 写文件 / 新脚本）；
  3. 汇总口径细节（分类排序、小数位、总计行）；
  4. 验收方式——仓库无验证基建，「怎么算过」升级为用户决定（[B] 黄金用例 vs [C] 手工步骤），并一次问全 [B] 附属决定（数据在哪、能否脱敏、期望输出以何为准、fixture 放哪）。
  回答要点：用户直接给出格式要点与手工核对的 07 月期望数字（权威）；选 [B] 用真实数据 `data/bill-2026-07.csv`，fixture 放 `tests/fixtures/`；补充 Out：不要 GUI / 数据库 / 多币种。未追加第二轮提问：回答只解锁了 fixture 措辞级细节，归入第 3 步 AC 裁决，不构成改变执行的新材料歧义。
- 第 2 轮（AC 对齐）：AC-01（真实数据黄金用例，含期望 fixture 逐行内容供确认）、AC-02（通用性合成用例）、AC-03（README 更新）。用户全部接受，未改动、未删除、未新增，AC 定稿 3 条。
- 第 3 轮（Contract 候选确认）：展示完整候选与 Goal / In / Out / AC / Blocker 摘要，用户确认后落盘。

## 维度自评（第 1 轮回答后，收口审计通过）

- Intent：已定（手工汇总费时易错；老板只认固定格式的表）。
- Outcome：已定（stdout 输出分类汇总 CSV；07 月输出与手工核对数字逐字节一致，可判定）。
- Boundary：已定（In：改 summarize.mjs 单月分类汇总 + fixture + README；Out：GUI / 数据库 / 多币种 / 多月对比 / 自动发送）。
- Constraints：已定（schema 不变、不改 data/ 原始账单、不引入运行时依赖、UTF-8 输出）。
- Context：已定（仓库仅 3 文件全部查清；无 package.json / 测试 / CI 的事实促成验收方式升级为用户决定）。

## 校验结果

- 校验器：validate-goal-contract.ps1 → VALID / FORMAT: AES Goal Contract B / STATUS: Ready / AC_COUNT: 3 / LINE_COUNT: 65 / 无 WARNING / 退出码 0（完整输出见 validation.txt）。

## 最终状态

- Status: Ready（无 Blocker）。
- Contract: G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-2\eval-3-billing-golden-case\with_skill\run-1\workdir\docs\goal-contracts\2026-08-07-monthly-billing-summary.md

## 启动指令全文（handoff-prompt.md 变体一：会话式执行 Agent）

```text
按 G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-2\eval-3-billing-golden-case\with_skill\run-1\workdir\docs\goal-contracts\2026-08-07-monthly-billing-summary.md 执行。

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
