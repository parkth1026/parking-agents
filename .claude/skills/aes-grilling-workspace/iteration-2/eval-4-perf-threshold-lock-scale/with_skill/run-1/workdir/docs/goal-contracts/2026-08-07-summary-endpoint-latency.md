# Goal Contract: /summary 接口 p95 延迟降至 200ms 以下

- Status: Ready
- Target: webapi（`server.mjs`，监听 :3000）
- Updated: 2026-08-07

## Goal

首页聚合接口 /summary 在锁定基准脚本 scripts/bench.mjs（连续请求 50 次、统计 p50/p95）的实测下，p95 延迟低于 200ms（当前三段串行聚合约 490ms），且响应内容与其余路由行为保持不变。

## Why

- 前端首屏渲染依赖 /summary，当前约 490ms，产品要求「秒开」而首页明显超过半秒。
- 达标后首屏等待显著缩短，且 bench.mjs 沉淀为该仓库首个可复现的性能量尺。

## Read First

- README.md（服务定位、启动方式，以及「仓库暂无测试或基准工具」的现状）

## Scope

- In: 优化 server.mjs 中 /summary 三段聚合的编排方式；新增基准脚本 scripts/bench.mjs 并将其作为锁定量尺。
- Out: 缩短三段模拟查询各自的延迟数值（180/160/150ms）；引入缓存中间件（Redis 之类）或进程内跨请求结果复用；改动响应 JSON 内容或其余路由行为；改动端口与部署方式；修改已定稿的 bench.mjs。

## Deliverables

- D-01: scripts/bench.mjs: 对 http://localhost:3000/summary 连续请求 50 次，输出 p50/p95（毫秒）；p95 低于 200ms 时退出码 0，否则非 0；次数 50 与门槛 200 硬编码在脚本内。

## Success Criteria

- AC-01: 基准脚本实测 /summary 连续 50 次请求的 p95 延迟低于 200ms。
  - Verify: [A] 先 `node server.mjs` 启动服务，再运行 `node scripts/bench.mjs` → 退出码 0，并打印 p50/p95
- AC-02: /summary 响应体与优化前逐字节一致，其余路径行为不变。
  - Verify: [C] 启动服务后 `curl http://localhost:3000/summary` 输出恰为 {"items":12,"total":3200}；`curl http://localhost:3000/other` 输出恰为 ok
- AC-03: 三段模拟查询各自的延迟数值保持不变，且未引入任何缓存或跨请求结果复用。
  - Verify: [D] 检查 server.mjs：180、160、150 三个延迟值原样存在；无缓存中间件引用，也无存储响应结果的模块级状态
- AC-04: 基准脚本按 D-01 要求落盘，测量口径硬编码，作为定稿后不可修改的锁定量尺。
  - Verify: [D] 检查 scripts/bench.mjs 存在，含 50 次采样与 200 门槛常量并输出 p50/p95

## Constraints

- 响应内容不变：items 与 total 的值必须与现状一致（{"items":12,"total":3200}）。
- scripts/bench.mjs 是锁定量尺：定稿后优化过程中不得修改，改尺子等于作弊。
- 三段模拟慢查询的延迟数值代表真实查询耗时，不得缩短或删除。
- 不引入新的运行时依赖或缓存中间件；不改监听端口与部署方式（仍为 node server.mjs 启动、:3000）。

## Agent Mandate

- May decide: 创建本地分支；编辑 server.mjs 中 /summary 处理器的编排实现（如并行发起三段聚合）；创建并定稿 scripts/bench.mjs；本地运行服务与基准脚本取证。
- Must ask: 需要改 Goal、Scope、Success Criteria 或 Constraints 时；发现门槛在不越过 Out 边界的前提下无法达成时；需要任何破坏性、凭据或部署相关操作时。
- Must not: 修改已定稿的 scripts/bench.mjs；缩短 180/160/150 延迟数值；引入任何缓存或跨请求结果复用；改动其余路由行为；push；停在分析阶段；询问可从仓库发现的事实；在没有每条 AC 新鲜证据时宣布完成。

## Iteration Strategy

先落盘 bench.mjs 拿到约 490ms 的基线，再并行化三段聚合，复测直到 p95 达标。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 行通过，证据来自当前 worktree 可复跑的命令输出。
- Quality: 仓库无既有测试基建，以 bench.mjs 与逐条 Verify 作为质量门；最终 diff 已完成 review 并在不改变行为的前提下 simplify。
- Final report: docs/goal-contracts/2026-08-07-summary-endpoint-latency-report.md：逐条映射 AC-01 至 AC-04 的 Verify 证据（含实测 p50/p95 数值）、改动文件清单与剩余风险。

## Blockers

- None.
