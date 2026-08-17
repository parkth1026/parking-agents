# Goal Contract: /summary 接口本机 p95 延迟降至 200ms 以内

- Status: Ready
- Target: webapi 仓库（server.mjs 及新增 scripts/bench.mjs）
- Updated: 2026-08-07

## Goal

首页聚合接口 /summary 在本机测量下延迟从当前约 490ms 降至 p95 < 200ms：以 `node server.mjs` 启动服务后，运行仓库内新增的基准脚本 `scripts/bench.mjs`（对 :3000 的 /summary 连续请求 50 次，输出 p50/p95）测得 p95 < 200ms，且响应体中 `items` 与 `total` 的值与优化前完全一致。

## Why

- 前端首屏渲染依赖 /summary，当前三段串行聚合合计约 490ms，产品要求「秒开」而现状明显超过半秒，用户感知为首页白屏。
- 达成后首屏等待显著缩短，且仓库首次具备可重复的延迟测量手段，后续性能回归可直接复用同一把尺子。

## Scope

- In: server.mjs 中 /summary 的聚合逻辑优化，以及新增 scripts/bench.mjs 基准脚本（对本机 :3000 的 /summary 连续请求 50 次并输出 p50/p95，单位毫秒）。
- Out: 其他路由与兜底响应、部署与启动方式、前端代码；不引入缓存中间件（如 Redis）或任何新的运行时依赖；不上压测平台。

## Success Criteria

- AC-01: 仓库存在 scripts/bench.mjs；对本机 :3000 的 /summary 连续发起 50 次请求，运行结束时输出 p50 与 p95 延迟（毫秒）。
- AC-02: 以 `node server.mjs` 启动服务后运行 `node scripts/bench.mjs`，输出的 p95 < 200ms。
- AC-03: 优化后 /summary 响应体中 `items` 与 `total` 的值与优化前一致（当前为 items=12、total=3200）。
- AC-04: scripts/bench.mjs 自定稿之后的所有优化改动均未修改该文件（以 git 历史或 diff 为证）。
- AC-05: 本次改动仅限 server.mjs 中 /summary 的聚合逻辑与新增的 scripts/bench.mjs；未引入缓存中间件，未新增运行时依赖，未改变启动方式（仍为 `node server.mjs` 监听 :3000）。

## Constraints

- /summary 响应体中 `items` 与 `total` 的值必须与优化前一致（当前 items=12、total=3200）。
- scripts/bench.mjs 一经定稿即锁定：后续优化改动不得再修改该脚本，测量口径不得变化。
- 不引入缓存中间件或新增运行时依赖；启动方式保持 `node server.mjs` 监听 :3000 不变。

## Agent Mandate

- May decide: 查阅仓库、选择可逆的实现细节（如三段聚合的并行化方式）、在满足「50 次连续请求并输出 p50/p95」口径的前提下决定 bench 脚本的实现写法、review 最终 diff 并在不改变行为的前提下简化。
- Must ask: 仅当 Goal、Scope、Success Criteria 或 Constraints 需要改变（例如不引入缓存便无法达到 p95 < 200ms），或需要破坏性、涉及凭据、生产环境等未经授权的操作时。
- Must not: 停在分析或计划、向用户询问仓库内可查明的事实、悄悄扩大范围、在 bench 脚本定稿后修改它，或在没有对每条 AC 的新鲜证据时宣称完成。

## Completion

- Evidence: 每条 AC 均有新鲜、可复现的证据（bench 运行输出、优化前后响应体对比、diff 范围核对）。
- Quality: 仓库暂无测试，以 bench 脚本运行结果与响应体核对为质量门槛；最终 diff 经过 review 并在安全前提下简化。
- Final report: 逐条 AC 对应证据，列出改动文件与剩余风险。

## Blockers

- None.
