# Goal Contract: 满减改为满 200 减 30 并叠加会员 95 折

- Status: Ready
- Target: `shop-pricing`（`src/pricing.mjs` 的 `finalPrice`）
- Updated: 2026-08-07

## Goal

结算金额按新的优惠规则计算：合计满 200 元（含）减 30 元，会员在满减之后再享 95 折，最终金额四舍五入到分；未满 200 元的订单金额与改动前完全一致。

## Why

- 现行满 300 减 40 的门槛过高，200 多元的订单不凑单就直接流失，转化率明显下滑。
- 门槛降到 200 并给会员额外折扣后，原本流失的中等金额订单可以直接成交。

## Read First

- `docs/goal-contracts/2026-08-07-shop-pricing-discount-rule-behavior.md`：用户已确认的行为对照表，含叠加顺序规则说明、13 个逐场景金额和不变清单。本次全部金额判据以该表为准。
- `docs/testing.md`：本仓库测试约定（金额精确断言、价格改动必须补边界值断言）。

## Scope

- In: 修改 `finalPrice` 的优惠计算——满减门槛与减额、会员 95 折的叠加、金额舍入；并按仓库测试约定补齐对应断言。
- Out: 不新增满减与会员 95 折以外的任何优惠（优惠券、阶梯满减、会员专属门槛均不做）；不改 `finalPrice` 的签名与返回类型；不引入配置化规则表、日志或埋点；不动结算以外的模块。

## Success Criteria

- AC-01: 非会员订单按「合计满 200 含等于 200 减 30，未满 200 不减」结算，行为对照表第 2 至 7 行的金额逐个精确成立（199→199、200→170、250→220、299→269、300→270、320→290）。
  - Verify: [A] `npm test` → 上述六个金额的精确相等断言全部通过，退出码 0
- AC-02: 会员订单按「先减后折」结算，即先对合计做满减、再对满减后的金额乘 0.95，行为对照表第 10 至 13 行的金额逐个精确成立（200→161.50、250→209、299→255.55、320→275.50）。
  - Verify: [A] `npm test` → 上述四个金额的精确相等断言通过，且含一条反例断言证明 250 元会员单不等于先折后减的 207.50，退出码 0
- AC-03: 返回金额四舍五入到分，不带浮点尾数：会员 299 元单返回严格等于 255.55（而非 255.54999999999998），会员 250 元单返回严格等于 209（而非 209.00000000000003）。
  - Verify: [A] `npm test` → 这两个值用 `assert.equal` 严格相等断言通过（不使用容差或范围判断），退出码 0

## Constraints

- 合计未满 200 元的订单返回金额与改动前一分不差，会员单同样如此：未触发满减就不打 95 折（对照表第 1、8、9 行：非会员 180→180、会员 180→180、会员 199→199）。
- 合计逻辑保持不变，仍为各商品单价乘数量的累加。
- `finalPrice(cart)` 的签名与返回类型（number）不变，现有调用方无需改动。
- `test/run-tests.mjs` 中不受本次规则影响的既有断言继续成立（`299` 非会员仍返回 `299`）。
- 金额一律精确断言，不得为了让测试通过而改成范围判断或容差比较。

## Agent Mandate

- May decide: 创建分支；修改 `src/pricing.mjs` 的计算实现与舍入写法；在 `test/run-tests.mjs` 增补断言；更新 `README.md` 中描述优惠规则的那句话；运行 `npm test`。
- Must ask: 需要改动 Goal、Scope、Success Criteria 或 Constraints 时；对照表某一行的期望金额与实现无法同时成立时；需要新增依赖或执行破坏性、需凭据、涉生产的操作时。
- Must not: 修改或重写已确认的行为对照表 `docs/goal-contracts/2026-08-07-shop-pricing-discount-rule-behavior.md`；删除或放宽既有测试断言；改 `package.json` 依赖；push；停在分析或计划阶段；询问可从仓库查到的事实；悄悄扩大范围；在没有每条 AC 新鲜证据时宣布完成。

## Iteration Strategy

先把行为对照表的 13 行全部写成断言并让它们红，再改 `finalPrice` 让断言逐条转绿，最后处理舍入。

## Completion

- Evidence: 三条 Success Criteria 的 Verify 全部通过，证据取自当前 worktree 可复跑的 `npm test` 输出。
- Quality: `npm test` 全绿，无关既有失败已分离；最终 diff 已 review，并在不改变行为的前提下 simplify。
- Final report: `docs/goal-contracts/2026-08-07-shop-pricing-discount-rule-report.md`：逐条映射 AC-01 至 AC-03 的 Verify 证据，列出改动文件和剩余风险。

## Blockers

- None.
