# Goal Contract: order-consumer 失败事件自动重试与可回放死信留痕

- Status: Ready
- Target: order-consumer（src/consumer.mjs 消费链路）
- Updated: 2026-08-07

## Goal

order-consumer 消费订单事件失败时不再丢事件：处理抛错后自动重试（首次失败后最多再重试 3 次、间隔递增），仍失败的事件连同原始内容与失败原因追加进 data/dead-letter.jsonl 死信文件、可直接人工回放；成功路径行为与 data/ledger.jsonl 台账格式保持不变。

## Why

- 消费失败的事件目前仅 console.error 后直接丢弃，上个月因此丢了两单，只能人工补数据，代价很高。
- 瞬时网络抖动类失败可通过重试自愈；不可自愈的失败留痕后可人工回放，不再丢单。

## Read First

- docs/testing.md（测试约定：`npm test` 退出码 0 为过；消费链路改动需补失败路径断言；无集成环境，用本地 jsonl 数据验证）

## Scope

- In: src/consumer.mjs 消费链路的失败处理——按次数上限与递增间隔自动重试、最终失败事件落盘 data/dead-letter.jsonl，以及配套的失败路径测试。
- Out: 不做管理界面、监控面板、告警通知；不更换队列、不引入任何中间件或第三方依赖；不改变事件来源与 handler 的业务校验规则。

## Success Criteria

- AC-01: 成功路径行为保持不变：可处理事件仍逐条写入 data/ledger.jsonl，记录格式与现有 `{ id, ok: true }` 一致，现有测试断言无修改地保持通过。
  - Verify: [A] `npm test` → 退出码 0，现有 2 条断言不改动仍通过
- AC-02: 事件处理抛错后自动重试：首次失败后最多再重试 3 次（共 4 次尝试），重试间隔严格递增；任一次尝试成功则该事件按成功路径落账且不进入死信文件。
  - Verify: [A] `npm test` → 新增断言：注入前 2 次失败、第 3 次成功的 handler 时共尝试 3 次、事件落账、死信文件无该事件；记录到的重试间隔序列严格递增
- AC-03: 4 次尝试全部失败的事件被追加写入 data/dead-letter.jsonl：每行一个可独立解析的 JSON 记录，包含逐字段完整的原始事件和最后一次失败原因。
  - Verify: [A] `npm test` → 新增断言：注入持续失败的 handler 后，死信行可被 JSON.parse，其原始事件字段与输入事件深度相等，失败原因等于最后一次错误信息
- AC-04: 死信记录可直接人工回放：从死信行中提取的原始事件不经任何修改写回 data/events.jsonl 后，重跑消费即可被正常处理并落账。
  - Verify: [A] `npm test` → 新增断言：提取死信记录中的原始事件重新消费，成功写入台账
- AC-05: 任何输入事件都不再被静默丢弃：一批消费结束后，每个事件要么在 data/ledger.jsonl 有成功记录，要么在 data/dead-letter.jsonl 有死信记录，两者必居其一。
  - Verify: [A] `npm test` → 新增断言：混合批次（成功、瞬时失败后恢复、持续失败）消费后，台账成功记录数加死信记录数等于事件总数

## Constraints

- data/ledger.jsonl 台账格式保持不变：仍只包含成功记录，每行 `{ id, ok: true }`，不新增失败记录行或新字段。
- 成功路径既有行为（逐条处理顺序、落账时机）保持不变。
- 不区分永久性校验错误与瞬时错误：所有失败统一走同一套重试与死信流程。
- 纯后端改动：不新增服务、界面、告警通道；package.json 不新增任何依赖。

## Agent Mandate

- May decide: 在 src/ 与 test/ 下修改代码与测试；重试间隔的具体数值与延迟注入方式；死信记录中除原始事件、失败原因外的附加元数据字段（如失败时间戳）；为可测试性所做的内部重构（如 handler 可注入）。
- Must ask: 需要改变 Goal、Scope、Success Criteria 或 Constraints 时；需要修改 ledger 既有格式、更换队列、引入中间件或依赖等越界动作时；需要破坏性或未授权操作时。
- Must not: 修改 docs/testing.md 的测试约定；git push 或产生无关改动；停在分析或计划阶段；询问可从仓库自行发现的事实；在没有每条 AC 新鲜证据时宣布完成。

## Iteration Strategy

先立 AC-01 的成功路径兼容护栏，再按 AC-02 到 AC-05 逐条推进，每条 Verify 通过后再动下一条。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 行通过，证据来自当前 worktree 可复跑的 `npm test` 输出。
- Quality: 相关测试与仓库检查通过，无关既有失败已分离；最终 diff 已完成 review，并在不改变行为的前提下简化。
- Final report: docs/goal-contracts/order-consumer-retry-dead-letter-report.md：逐条映射 AC-01 至 AC-05 的 Verify 证据，列出改动文件与剩余风险。

## Blockers

- None.
