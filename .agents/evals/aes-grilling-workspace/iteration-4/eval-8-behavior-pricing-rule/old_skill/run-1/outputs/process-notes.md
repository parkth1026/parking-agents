# 流程记录（process-notes.md）

技能版本：skill-snapshot-v3（aes-grilling，纯文本变体）。技能文件只读，未修改。
目标仓库：old_skill/run-1/workdir（shop-pricing）。未做 git 提交，未实现需求代码。

## 阶段执行总览

| 阶段 | 执行情况 | 轮次 |
| --- | --- | --- |
| 1 调查事实 | 执行 | 0（不占提问轮次） |
| 2 批量问清歧义 | 执行 | 2（默认 1 轮 + 1 追加轮） |
| 3 界面 Mock | 跳过（判定为纯后端） | 0 |
| 4 对齐验收标准 | 执行 | 2（草案 v1 + 修订 v2 确认） |
| 5 形成并确认 Contract | 执行 | 1（候选展示即确认） |
| 6 校验与交接 | 执行 | 0（脚本校验，exit 0） |

## 阶段 1：调查事实

- 仓库仅 5 个小文件，直接读取即可覆盖全部事实，不满足「两个以上互不依赖且值得并行」的 subagent 派遣条件，未派遣 subagent。
- Fact：现行规则 `src/pricing.mjs` 为 `total >= 300 ? total - 40 : total`（满 300 减 40）；member 字段存在但不参与计算。
- Fact（固定必查项——验证基建）：`npm test` = `node test/run-tests.mjs`，退出码 0 为过；`docs/testing.md` 约定价格改动补边界值断言、金额一律精确断言。→ 第 4 步默认档 [A] 可用，「怎么算过」无需升级为用户决定。
- Fact（固定必判项——界面分类）：仓库无任何界面代码，请求为定价行为调整，无歧义地判定为纯后端 → 阶段 3 跳过，该判定不占提问轮次。
- User decision 清单：新档位数值、member 是否参与、门槛边界语义、必须保持的行为；后续追加：会员折扣舍入规则。
- Agent-owned：具体实现方式、测试文件内断言组织方式。
- Blocked：无。

## 阶段 2：批量问清（2 轮）

- 第 1 轮：先给完整推荐候选（Goal 一句话、In/Out、AC 方向）作靶子，再一次列出 4 个独立歧义（Q1 档位数值、Q2 会员参与、Q3 边界语义、Q4 不变项），每题带证据摘要、互斥选项、推荐项与代价。宿主无 AskUserQuestion 工具，按技能规定退化为编号文本，提问范围不变。
- 第 1 轮后维度自评：Intent/Boundary/Constraints/Context 已定，Outcome 部分——Q2 的「会员满减后 95 折」回答解锁了舍入歧义（仓库约定精确断言，舍入直接改变可观察金额），符合「回答解锁新的会改变执行的歧义」的追加条件。
- 第 2 轮（追加，有明确解锁理由）：Q5 舍入规则。PERSONA 未覆盖，按约定取推荐项（四舍五入到分）。
- 第 2 轮后维度自评全部已定；收口审计通过（剩余问题只改措辞不改执行）→ 停止提问。

## 阶段 3：界面 Mock

- 跳过。依据阶段 1 的 Fact 判定：纯后端定价行为调整，仓库无界面代码。

## 阶段 4：对齐验收标准（2 轮）

- 第 1 轮：一次全列 AC 草案 v1（4 条），附前后行为对照示例金额；Verify 全部走默认档 [A]（基建存在且判据无歧义，不占提问轮次；PERSONA 亦声明「跟着仓库测试约定走」）。无数字门槛升级条件、无外部数据、[A] 可用，故「怎么算过」未升级为独立问题。
- 模拟用户第一次看行为对照材料，按 PERSONA 提出两条意见：(1) 会员叠加顺序须白纸黑字写「先减后折」，会员金额按先减 30 再 95 折算；(2) 恰好 200 元也算满减需单独成行。
- 第 2 轮：修订为 v2（5 条）——AC-03 显式写明「先减后折」并标注（合计 − 30）× 0.95 计算过程；新增独立边界条 AC-02。模拟用户第二次查看，确认通过，AC 定稿。
- 起草过程未暴露新的材料歧义，无需回阶段 2。

## 阶段 5：形成并确认 Contract（1 轮）

- 按 references/goal-contract-template.md 生成；Success Criteria 直接使用阶段 4 定稿，未重新发明。
- Read First 指向阶段 1 实际依赖的 docs/testing.md 与 README.md；无 mock（纯后端）、无 [B] fixture，故省略 Deliverables 节。
- 向模拟用户展示完整候选与 Goal/In-Out/AC/Blocker 摘要；PERSONA 未覆盖整体确认场景，按约定取推荐项（确认）。确认后落盘：
  workdir/docs/goal-contracts/2026-08-07-pricing-rule-200-30.md
- 状态判定 Ready：歧义判据满足、AC 定稿、无 Blocker，无访谈上下文的执行 Agent 可持续执行到满足全部 AC。

## 阶段 6：校验与交接

- 运行 validate-goal-contract.ps1：VALID / FORMAT: AES Goal Contract B / STATUS: Ready / AC_COUNT: 5 / LINE_COUNT: 65 / 无 WARNING，exit 0。完整输出见 validation.txt。
- 状态为 Ready，启动指令可按 references/handoff-prompt.md 变体一生成（指向契约绝对路径）；本次评测约定不启动实现，未派遣执行 Agent。

## 关键判定小结

- 界面/后端分类：纯后端（Fact，无需占提问轮次）→ 跳过 Mock 阶段。
- 验证基建存在 → Verify 默认档 [A]，未升级「怎么算过」为用户问题。
- 追加提问轮的唯一理由：会员 95 折解锁舍入歧义。
- 旧规则废止导致 300 元订单应付由 260 变 270，已作为对照示例明确展示给用户并获确认（AC-01）。
- 未满 200 不变、合计逻辑不变、无其它新优惠，全部进入 Constraints。
