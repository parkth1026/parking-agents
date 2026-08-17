# Goal Contract: 满 200 减 30 加会员 95 折取代满 300 减 40

- Status: Ready
- Target: shop-pricing（src/pricing.mjs，test/run-tests.mjs）
- Updated: 2026-08-07

## Goal

购物车结算按新的优惠规则出价：合计达到 200 元（含）先立减 30 元，会员再对减后金额享 95 折，合计不足 200 元的订单金额与今天逐分一致；原「满 300 减 40」整档取消。

## Why

- 满 300 减 40 门槛过高，大量 200 多元的订单不愿凑单直接流失，转化率明显下滑。
- 降门槛到 200 元并让会员身份真正参与计价后，200 元档订单可直接成交，member 字段不再是死字段。

## Read First

- docs/goal-contracts/2026-08-07-shop-pricing-discount-rule-behavior.md：用户逐行确认的行为对照表，11 条场景的输入与期望金额、计价顺序和不变清单都在里面，只读。
- docs/testing.md：仓库测试约定（`npm test` 退出码 0 为过；价格改动必须补边界值断言，金额精确断言）。

## Scope

- In: `finalPrice(cart)` 的优惠计算——新门槛与减免额、会员折扣及其叠加顺序、金额取整，以及 test/run-tests.mjs 中对应的断言更新。
- Out: 合计计算方式（数量乘单价）、`finalPrice` 的签名与返回类型、任何新增优惠形式（券、包邮、阶梯档位）、会员体系本身、结算以外的模块与界面。

## Success Criteria

- AC-01: 合计低于 200 元的订单最终金额与改动前逐分一致，会员身份不影响该结果（180 非会员为 180；199 非会员为 199；199 会员为 199）。
  - Verify: [A] `npm test` → 退出码 0，且 test/run-tests.mjs 含这三条精确金额断言
- AC-02: 合计达到 200 元的非会员订单立减 30 元，恰好 200 元即触发（200 为 170；250 为 220；300 为 270）。
  - Verify: [A] `npm test` → 退出码 0，且 test/run-tests.mjs 含 200 与 199 这对边界断言
- AC-03: 合计达到 200 元的会员订单先减 30 元再按 95 折计价，顺序为先减后折（200 为 161.50；250 为 209.00；300 为 256.50；100 元 2 件为 161.50）。
  - Verify: [A] `npm test` → 退出码 0，且 test/run-tests.mjs 含这四条精确金额断言
- AC-04: 最终金额四舍五入到分，两位小数（合计 210.03 的会员订单为 171.03，不是 171.0285）。
  - Verify: [A] `npm test` → 退出码 0，且 test/run-tests.mjs 含该取整断言
- AC-05: test/run-tests.mjs 覆盖行为对照表全部 11 行场景，每行一条精确金额断言，无范围判断、无被删除的旧断言残留。
  - Verify: [D] `test/run-tests.mjs` 逐行比对 `docs/goal-contracts/2026-08-07-shop-pricing-discount-rule-behavior.md` 的 11 行场景，输入与期望金额一一对应

## Constraints

- 合计计算方式 Σ(price × qty) 保持不变。
- 合计低于 200 元的订单价格一分不许变，会员身份对这类订单无影响。
- 不引入除「满 200 减 30」与「会员 95 折」以外的任何新优惠，也不保留「满 300 减 40」做择优或并存。
- `finalPrice(cart)` 的函数签名与 number 返回类型不变。
- 确认版行为对照表为只读输入，期望金额以它为准，不得为迁就实现改写。

## Agent Mandate

- May decide: 修改 src/pricing.mjs 的实现结构、在 src/ 下拆分或新增模块、增补与重排 test/run-tests.mjs 的断言、创建工作分支。
- Must ask: 需要改动 Goal、Scope、Success Criteria、Constraints，或发现对照表某行金额自相矛盾时；以及任何需要推送、改 CI、动凭据或触及生产的动作。
- Must not: 修改或重算确认版行为对照表 docs/goal-contracts/2026-08-07-shop-pricing-discount-rule-behavior.md；改动 package.json 的 test 脚本或 docs/testing.md 的约定；删除既有断言而不用新期望值替换；停在分析或计划；就仓库里查得到的事实回头提问；悄悄扩大范围；在没有每条 AC 的新鲜证据前宣称完成。

## Iteration Strategy

先落实价格规则并让对照表的 11 行断言全绿，再回看实现是否可以简化。

## Completion

- Evidence: All Success Criteria are satisfied; every Verify line passes with fresh, reproducible evidence from the current worktree.
- Quality: Relevant tests and repository checks pass; unrelated pre-existing failures are separated; the final diff is reviewed and simplified where safe.
- Final report: docs/goal-contracts/2026-08-07-shop-pricing-discount-rule-report.md：逐条列出 AC 与其 Verify 证据、改动文件清单和剩余风险。

## Blockers

- None.
