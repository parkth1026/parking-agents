# 流程记录：按 aes-grilling SKILL.md 执行

## 走过的步骤

### 第 1 步 调查事实 — 执行

读了 `README.md`、`package.json`、`docs/testing.md`、`src/pricing.mjs`、`test/run-tests.mjs`，并实测了浮点算式。

- 现行规则：`total = Σ(price×qty)`；`total >= 300 ? total - 40 : total`。
- `cart.member` 字段存在但**从不参与计算**（测试里已有 `member: true` 用例）。这是 Fact，直接写进上下文并告知用户，不占提问轮次；但「本次要不要启用它」是 User decision，进了轮次 1。
- 固定查清的验证基建：`npm test` → `node test/run-tests.mjs`，退出码 0；`docs/testing.md` 要求补边界值断言、金额精确断言。→ Verify 默认档 `[A]` 可用，「怎么算过」**没有**升级为用户决定。
- 固定判定的对照物分类：仓库是纯计算模块，无任何用户可见界面 → 属「改变现有可观察行为」→ **只出行为对照表，不出界面 mock**。这一判定读得出来，故未占提问轮次。
- 实测浮点隐患：`(299-30)*0.95 = 255.54999999999998`、`220*0.95 = 209.00000000000003`，直接支撑了轮次 1 的问题 3 和 AC-03。

未派遣 subagent：事实面很小（5 个文件），并行调查的协调成本高于收益。

分类结果：
- `Fact`：现行算法、`member` 悬空、测试基建与约定、无界面、浮点尾数。
- `User decision`：新门槛与减额、是否启用会员折扣及叠加方式、舍入策略、本次边界与不变清单、4 条 AC 判定口径。
- `Agent-owned`：舍入的具体写法、断言组织方式、是否抽取内部小函数。
- `Blocked`：无。

### 第 2 步 批量问清歧义 — 执行（1 轮，4 题）

宿主无 `AskUserQuestion`，按 SKILL.md 退化为编号文本一次全列，提问范围不变。提问前先给了完整推荐候选（Goal 一句话 + In/Out + AC 方向）作靶子。
每题带证据摘要、3-4 个互斥选项、推荐项和真实代价（例如问题 1 明确写出「300 元以上订单减额从 40 降到 30，用户要多付 10 元」这一副作用）。

**未追加轮次**：问题 2 的回答解锁了「未满 200 的会员单是否单独打折」，但同轮问题 4 的不变清单第 1 条已把它答掉。追加要有理由，不是流程的一部分。

五个维度自评全部「已定」，收口审计通过 → 进第 3 步。

### 第 3 步 对齐对照物 — 执行（行为对照表，2 版迭代）

- **跳过界面 mock**：仓库无用户可见界面，第 1 步已判定。
- v1（10 行 + 不变清单）落在临时目录，未占最终路径。
- 用户第 1 次评审提 2 条意见：叠加顺序要白纸黑字写「先减后折」；补恰好 200 元的边界行。
- v2 补「规则说明」一节（含先折后减的反例金额 207.50 对比）+ 3 个边界行（非会员 200、会员 200、会员 199），13 行。
- 用户第 2 次评审确认通过 → 落盘到与 Contract 同目录同 slug：
  `docs/goal-contracts/2026-08-07-shop-pricing-discount-rule-behavior.md`

### 第 4 步 对齐验收标准 — 执行

- **4a 收集判定例子**：走过第 3 步，例子已在手（对照表 10 个变化行），**不重新问一遍**。
- **分流**：不变清单 + 3 个不变行 → Constraints；`npm test` 全绿 / diff review → Completion 的 Quality 行；只有本次独有的可观察结果进 AC。
- **聚类**：10 个变化行聚成 3 簇（非会员满减规则含边界 / 会员先减后折 / 舍入到分）→ **AC 条数 3 条，是数出来的**。未贴校验器 7 条红线。
- **Verify 档位**：仓库基建存在、判据无歧义、无数字门槛、无真实数据依赖 → 全部 `[A]`，**未升级为独立提问**。
- **4b**：4 条带候选的问题一次发全（3 条 AC 的判定口径 + 1 条不变量归属确认），每个候选写明真实代价，附推荐项。用户全取推荐项。

### 第 5 步 形成并确认 Contract — 执行

按 `references/goal-contract-template.md` 生成，展示完整候选并取得确认后才落盘。
- 可选节 `Read First`：确认版行为对照表 + `docs/testing.md`（指路，不预写结论）。
- 可选节 `Iteration Strategy`：一句话攻击顺序。
- **未使用 `Deliverables` 节**：无 `[B]` 档 fixture，Success Criteria 已点名全部产物。
- 对照物按规定进 `Read First` 而非 `Deliverables`，并在 `Agent Mandate` 的 Must not 中写明**不得修改已确认的行为对照表**。

### 第 6 步 校验与交接 — 执行

`pwsh -NoProfile -File .../validate-goal-contract.ps1 -Path <contract>` → **VALID，退出码 0**，AC_COUNT 3，LINE_COUNT 62，零 WARNING。完整输出见 `validation.txt`。
按任务要求**不启动实现**，仅在最终报告中给出可复制的启动指令（`references/handoff-prompt.md` 变体一）。

## 跳过的步骤及原因

| 跳过项 | 原因 |
|---|---|
| 界面 mock HTML | 第 1 步判定：`shop-pricing` 是纯计算模块，无任何用户可见界面，不属界面向改动。SKILL.md 第 3 步规定混合请求才两者各出。 |
| 派遣 subagent 并行调查 | 事实面仅 5 个文件，宿主直接读完更快；SKILL.md 允许「无法或不必使用 subagent 时自行完成调查」。 |
| 第 2 步追加轮次 | 唯一被解锁的新歧义已被同轮回答，追加不会改变执行。 |
| 「怎么算过」升级为独立问题 | 三个升级条件均未命中：仓库有 `npm test` 基建、无真实数据/外部系统依赖、AC 不含数字门槛。 |
| 4a 重新收集例子 | 走过第 3 步，对照表的变化行直接就是例子，SKILL.md 明确要求「直接用，不重新问一遍」。 |
| `Deliverables` 节 | 无 `[B]` 档 fixture；模板规定该节仅在必要时出现。 |
| 单独立一条「整体对照」AC | 3 条逐点 AC 已覆盖对照表全部变化行，再立一条是同一件事判两遍。 |
| 实现代码改动 | 任务明确要求「先别改代码」；SKILL.md 也声明本 Skill 不实现 Contract 中的目标。`workdir/src`、`workdir/test`、`workdir/package.json` 未被修改。 |

## 对 workdir 的写入清单

仅新增两份文档，未触碰任何产品代码：

- `workdir/docs/goal-contracts/2026-08-07-shop-pricing-discount-rule.md`（Goal Contract）
- `workdir/docs/goal-contracts/2026-08-07-shop-pricing-discount-rule-behavior.md`（确认版行为对照表）
