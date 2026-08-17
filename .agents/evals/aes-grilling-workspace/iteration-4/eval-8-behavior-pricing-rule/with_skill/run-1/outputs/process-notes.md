# 流程记录（process-notes.md）

技能：aes-grilling（G:\GIT\AI_WorkFlow\aes-workflow\skills\productivity\aes-grilling\SKILL.md，只读遵循）。
目标仓库：run-1\workdir（shop-pricing）。用户不可达，回答按 PERSONA.md 模拟，未覆盖取推荐项。

## 阶段执行与判定

### 第 1 步 调查事实 — 执行（0 轮提问）

- 固定事实一（验证基建）：存在。`npm test` → node test/run-tests.mjs，退出码 0 为过；docs/testing.md 约定金额精确断言、价格改动必须补边界断言。→ 第 4 步 Verify 默认档 [A] 可用。
- 固定分类判定：改变现有可观察行为（结算金额今昔差异），无界面改动 → 只出行为对照表，跳过界面 mock。分类可从请求直接读出（「优惠规则要调整」），不占提问轮次。
- 其余事实：现行规则满 300 减 40（src/pricing.mjs）；member 字段存在于测试数据但未参与计算；现有 3 条精确断言中 3 条在新规则下金额都会变（属执行 Agent 可自行发现，不预写入 Contract）。
- 归类：规则参数/旧规则处置/会员参与方式/金额精度 = User decision；浮点实现细节 = Agent-owned；无 Blocked 项。
- subagent：未派遣。仓库仅 5 个小文件，不存在两个以上互不依赖且值得并行的事实问题。

### 第 2 步 批量问清歧义 — 执行，1 轮

- 先给完整推荐候选（Goal/In/Out/AC 方向），再一次列 4 个互不依赖歧义（宿主无 AskUserQuestion，退化为编号文本，范围不变），每题带证据、2-4 互斥选项、推荐项与真实代价。
- 特别把「整体替换后合计 300 元订单实付从 260 变 270」这一真实代价摆给用户裁决（Q2）。
- 1 轮后五维度全部「已定」，收口审计通过（再问只会改措辞），未追加轮次。

### 第 3 步 对齐对照物 — 执行（行为对照表），2 轮展示

- 第 1 版草稿放临时目录（scratchpad\behavior-draft-v1.md），未占正式路径。
- 第 1 次展示 → 用户两条意见（先减后折白纸黑字+按此算会员金额；补恰好 200 边界行）。意见属表达与场景补充，未构成新材料歧义，无需回第 2 步。
- 第 2 版落实后第 2 次展示 → 确认通过。确认版落盘 workdir\docs\goal-contracts\2026-08-07-pricing-200-30-member95-behavior.md，含变化行、边界行、算式标注与不变清单，写入 Contract 的 Read First 并声明只读。

### 第 4 步 对齐验收标准 — 执行，1 轮

- 起草 3 条 AC 一次全列，逐条交裁决并提示可一次回复完；用户全部接受。
- Verify 来源：默认档（仓库基建 [A] `npm test` 精确断言），输入与期望输出全部取自确认版对照表，未另行发明。升级条件逐项核对均未命中：基建存在；纯合成金额场景不涉真实数据/外部系统；AC 中数字是规则参数而非测量门槛。故 Verify 由执行方起草，不占用户裁决。
- 对照物落进 AC：变化行 → AC-01/AC-02 断言；边界行 → AC-01/AC-02 中 200 元组；不变清单 → Constraints；对照表只读 → Must not。

### 第 5 步 形成并确认 Contract — 执行，1 轮

- 严格按 references/goal-contract-template.md 生成；Success Criteria 直用第 4 步定稿。
- Read First：确认版对照表 + docs/testing.md（第 1 步实际依赖的证据）。Deliverables 省略（无 [B] 档 fixture，AC 已点名全部产物）。
- 展示完整候选与摘要，用户确认后落盘：workdir\docs\goal-contracts\2026-08-07-pricing-200-30-member95.md，Status: Ready（歧义判据满足、AC 定稿、无 Blocker）。

### 第 6 步 校验与交接 — 执行

- validate-goal-contract.ps1 → VALID / FORMAT: AES Goal Contract B / STATUS: Ready / AC_COUNT: 3 / LINE_COUNT: 61 / 无 WARNING / exit 0（完整输出见 validation.txt）。
- 未实现需求代码、未做 git 提交（本次仅需求对齐）。

## 最终报告要素

- Contract：Ready，G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-4\eval-8-behavior-pricing-rule\with_skill\run-1\workdir\docs\goal-contracts\2026-08-07-pricing-200-30-member95.md
- Goal：优惠由「满 300 减 40」整体替换为「满 200 减 30」（恰好 200 命中），会员先减后折 95 折，未满 200（含会员）一分不变。
- In：finalPrice 优惠计算 + 配套断言 + README 规则描述。Out：无其它优惠/结构/界面/测试约定改动。
- AC 数：3；校验：VALID，exit 0；Blocker：无。
- 启动指令（按 references/handoff-prompt.md 变体一）：

```text
按 G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling-workspace\iteration-4\eval-8-behavior-pricing-rule\with_skill\run-1\workdir\docs\goal-contracts\2026-08-07-pricing-200-30-member95.md 执行。

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
