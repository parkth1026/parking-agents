# Goal Contract: order-consumer 失败事件自动重试并落死信可回放

- Status: Ready
- Target: order-consumer 仓库 src/consumer.mjs 消费链路
- Updated: 2026-08-07

## Goal

订单事件消费失败不再被静默丢弃：处理失败的事件自动重试最多 3 次且间隔递增，重试耗尽仍失败的事件以可直接人工回放的格式追加写入 data/dead-letter.jsonl（保留完整原始事件与失败原因），成功路径行为与现有 ledger.jsonl 台账格式保持不变。

## Why

- 现状：src/consumer.mjs 中 handle 抛错的事件被直接丢弃，只留一行 console.error；上个月因此丢了两单，人工补数据非常痛苦。
- 价值：临时性失败（如网络抖动）可自动恢复；最终失败的事件有完整留痕并可人工回放，不再丢单。

## Read First

- docs/testing.md（仓库测试约定与失败路径断言要求）

## Scope

- In: src/consumer.mjs 消费链路的失败处理——失败自动重试（最多 3 次、间隔递增、统一策略不区分错误类型）、重试耗尽后死信落盘 data/dead-letter.jsonl、为失败路径补充测试断言。
- Out: 管理界面、监控面板、告警通知；更换队列或引入消息中间件；死信自动回放工具；handler 业务校验规则的调整。

## Success Criteria

- AC-01: 单条事件处理失败时自动重试，首次尝试后最多追加 3 次重试（合计最多 4 次尝试），重试间隔递增；重试期间任一次成功则该事件照常写入 data/ledger.jsonl 且不进死信。
  - Verify: [A] `npm test` → 退出码 0，含失败路径断言：前 2 次尝试抛错、第 3 次成功的事件最终写入 ledger.jsonl、dead-letter.jsonl 中无该事件，且记录的重试间隔严格递增
- AC-02: 重试耗尽仍失败的事件被追加写入 data/dead-letter.jsonl，每行一个 JSON 对象，包含完整原始事件与最后一次失败原因。
  - Verify: [A] `npm test` → 退出码 0，含断言：持续抛错的事件在 4 次尝试后写入 dead-letter.jsonl，该行可解析出原始事件全部字段与失败原因
- AC-03: 死信可人工回放：从 dead-letter.jsonl 任一行中取出的原始事件与 data/events.jsonl 的行格式一致，重新投喂后可被正常消费。
  - Verify: [A] `npm test` → 退出码 0，含回放断言：从死信行提取的原始事件重新消费成功后写入 ledger.jsonl
- AC-04: 成功路径行为保持不变：正常事件一次尝试即处理完成，ledger.jsonl 行格式仍为 {"id":...,"ok":true}。
  - Verify: [A] `npm test` → 退出码 0，现有断言全部保持通过，且新增断言校验成功事件仅尝试 1 次、ledger 行格式不变
- AC-05: 单条事件最终失败不阻塞其余事件：死信事件之后的事件仍被正常消费并写入台账。
  - Verify: [A] `npm test` → 退出码 0，含断言：一条持续失败事件加一条正常事件的输入，正常事件仍写入 ledger.jsonl

## Constraints

- data/ledger.jsonl 现有行格式与成功路径行为保持不变。
- 不更换队列、不引入消息中间件或新的运行时依赖（纯后端改动，不新增界面、监控或告警）。
- 单条事件的失败处理不得中断整体消费流程，保持现有逐条继续消费的行为。
- 遵循 docs/testing.md 约定：消费链路改动补失败路径断言，用本地 jsonl 数据验证，不依赖集成环境。

## Agent Mandate

- May decide: 创建分支；修改 src/ 下消费与处理代码；在 test/ 下新增或调整测试与本地 jsonl 测试数据；确定重试间隔的具体数值序列、死信行内部字段命名等可逆实现细节。
- Must ask: 需要改变 Goal、Scope、Success Criteria 或 Constraints 时；需要引入新的运行时依赖、消息中间件，或执行破坏性、凭据类、未授权操作时。
- Must not: push 或改动远程与 CI 配置；改变 data/ledger.jsonl 现有行格式；引入消息队列等外部中间件；新增管理界面、监控或告警；停在分析阶段；询问可从仓库发现的事实；在没有每条 AC 新鲜证据时宣布完成。

## Iteration Strategy

先以测试锁住 AC-04 的成功路径兼容护栏，再实现重试与死信落盘，按 AC 顺序逐条让 Verify 变绿后再推进下一条。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 行通过，证据来自当前 worktree 可复跑的 `npm test` 输出。
- Quality: 相关测试与仓库检查通过，无关既有失败已分离；最终 diff 已 review 并在不改变行为的前提下 simplify。
- Final report: docs/goal-contracts/2026-08-07-order-consumer-retry-dead-letter-report.md：逐条映射 AC-01 至 AC-05 的 Verify 证据，列出改动文件与剩余风险。

## Blockers

- None.
