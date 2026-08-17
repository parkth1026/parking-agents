# 过程记录 — 走了哪几步、跳过了什么

依据：`skill-snapshot-v4/SKILL.md`（六步）。

## 第 1 步 调查事实 — 走了

读了 `README.md`、`package.json`、`src/pricing.mjs`、`test/run-tests.mjs`、`docs/testing.md`（仓库共 5 个文件）。

固定查清的两项：

1. **验证基建**：`npm test` → `node test/run-tests.mjs`，退出码 0 为过；`docs/testing.md` 要求价格改动补边界值断言、金额精确断言。基建存在 → 验收默认档 `[A]` 可用，「怎么算过」不必升级为用户决定。
2. **对照物分类**：改的是现有可观察行为（同一购物车前后金额不同），仓库无任何界面代码 → **只出行为对照表，跳过界面 mock**。

**跳过 subagent 并行调查**：SKILL 的条件是「存在两个以上互不依赖的事实问题」。本仓库 5 个文件、事实高度集中在一个函数上，派遣 subagent 的开销大于收益，宿主直接查完。

分类结果：新门槛/减免额/会员折扣率/叠加顺序/边界含不含等于/旧档去留/取整口径 = `User decision`；现行计算逻辑、测试基建、现有断言 = `Fact`；用什么写法实现取整、是否拆函数 = `Agent-owned`；`Blocked` 无。

## 第 2 步 批量问清歧义 — 走了 1 轮

先给推荐候选靶子（Goal 一句话 + In/Out + AC 方向），再一次性列 6 个独立歧义。独立歧义 6 > 4，按 SKILL 改用**编号文本一次全列**而非 `AskUserQuestion`。每题带证据摘要、互斥选项、推荐项和真实代价。

**未追加第二轮**：用户回答没有解锁新的、会改变执行的歧义（五维度自评全部「已定」，收口审计通过）。SKILL 明示「默认就一轮，追加要有理由」。

## 第 3 步 对齐对照物 — 走了，只出行为对照表

- v1 草稿（8 行场景）放临时目录，**不占用** `docs/goal-contracts/` 下的正式路径。
- 用户第一次看提两条意见：会员叠加顺序要明文写「先减后折」；补「恰好 200 元也算满减」的边界行。
- v2 补上明文计价顺序小节、两行 200 元边界场景、取整示例行、旧档明确作废小节，场景由 8 行增至 11 行。
- 用户第二次看确认通过 → 确认版落盘 `docs/goal-contracts/2026-08-07-shop-pricing-discount-rule-behavior.md`，声明只读。

**跳过界面 mock**：本次不新增也不改动任何用户可见界面，仓库无前端代码。

## 第 4 步 对齐验收标准 — 走了

起草 5 条 AC 一次全列，逐条交裁决，并明说可以一次回复完。用户全部接受。

Verify 来源走**默认档**（第 1 步查到的基建），不占提问轮次——四条升级条件（无基建 / 需真实数据或外部系统 / 含数字门槛需用户定尺子 / 用户裁量）均未命中：门槛值 200 和 30 是需求本身，不是待定的测量阈值。

对照物按 SKILL 落进 AC：11 行确认例子转成 `[A]` 精确断言（有测试基建，故不用 `[B]` 黄金用例落盘 fixture），AC-05 用 `[D]` 锁「覆盖全部 11 行」，不变清单写进 Constraints，确认版对照表在 Agent Mandate 的 Must not 中声明不可修改。

## 第 5 步 形成并确认 Contract — 走了

严格按 `references/goal-contract-template.md` 生成。**未读** `goal-contract-example.md`——信息密度无需校准。

- 可选节 `Read First`：指向确认版行为对照表与 `docs/testing.md`，只指路不预写结论。
- 可选节 `Deliverables`：**省略**——没有 `[B]` 档 fixture，AC-05 已具名 `test/run-tests.mjs`。
- 可选节 `Iteration Strategy`：一句话保留。
- 展示完整候选并取得用户确认后才落盘。Status = `Ready`，Blockers = None。

## 第 6 步 校验与交接 — 走了校验

`validate-goal-contract.ps1` 通过：exit 0，STATUS Ready，AC_COUNT 5，LINE_COUNT 66，无 WARNING。完整输出见 `validation.txt`。

**未启动实现**：用户明确「先别改代码」，`workdir` 内产品代码与测试一字未动，只新增了 `docs/goal-contracts/` 两份文档。启动指令按 `references/handoff-prompt.md` 变体一生成，仅在最终报告中给出，未执行。
