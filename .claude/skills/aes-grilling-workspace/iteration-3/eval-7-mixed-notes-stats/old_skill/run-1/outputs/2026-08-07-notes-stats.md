# Goal Contract: notes-tool 分类统计与近 7 天新增可见

- Status: Ready
- Target: notes-tool（仓库根目录）
- Updated: 2026-08-07

## Goal

用户可以在网页统计页和 CLI stats 子命令中看到每个分类下的笔记条数，以及最近 7 天（自查看时刻往前 168 小时、按 created 字段计）新增的笔记总数；数据不变时两个入口显示的数字一致。

## Why

- 笔记已积累数百条，现有 CLI 和网页只能罗列笔记，用户无法看到精力分布在哪些分类上。
- 近 7 天新增总数能帮助用户观察最近的记录习惯。

## Read First

- README.md（工具形态：CLI + 只读网页 + data/notes.jsonl 数据文件）
- docs/testing.md（测试约定：`npm test` 退出码 0 为过；网页改动靠 `npm run web` 人工查看，仓库无视觉回归工具）

## Scope

- In: 基于 data/notes.jsonl 的只读统计——每个分类的笔记条数、近 7 天（滚动 168 小时）新增总数；网页新增统计页；CLI 新增 stats 子命令输出简版文本。
- Out: 不做按标签统计、不做导出文件、不引入图表库或任何新依赖；不改变现有 add/list 子命令、笔记列表页与 /api/notes 的行为。

## Success Criteria

- AC-01: 运行 `node src/cli.mjs stats` 输出每个分类的笔记条数和近 7 天新增总数，口径为 data/notes.jsonl 中 created 落在执行时刻往前 168 小时内的笔记。
  - Verify: [A] `npm test` → 退出码 0，套件包含对分类计数与近 7 天新增计算的断言
- AC-02: 网页提供统计页，展示每个分类的笔记条数和近 7 天新增总数。
  - Verify: [C] `npm run web` 后在浏览器打开统计页，能看到全部分类各自的条数与近 7 天新增数字
- AC-03: 数据不变时，CLI stats 输出与统计页展示的每一项数字一致。
  - Verify: [C] 依次运行 `node src/cli.mjs stats` 并刷新统计页，逐项对比分类条数与近 7 天新增，全部相同
- AC-04: 现有行为保持：add、list 子命令输出、笔记列表页与 /api/notes 响应不因本改动变化。
  - Verify: [A] `npm test` → 退出码 0，现有断言未被删改且全部通过

## Constraints

- 保持零外部依赖：不新增 package.json 依赖，不引入图表库。
- data/notes.jsonl 的格式与既有字段（category、text、created）保持不变；统计为只读，不改写数据文件。
- 现有 CLI 子命令与网页笔记列表行为保持兼容。

## Agent Mandate

- May decide: 在 src/ 下新增或修改代码；统计页的路由、页面结构与视觉呈现；stats 文本输出的具体排版；在 test/run-tests.mjs 中补充统计断言；空数据等边界情况的合理处理方式。
- Must ask: 需要改变 Goal、Scope、Success Criteria 或 Constraints 时；需要新增依赖、改动数据文件格式或执行破坏性、未授权操作时。
- Must not: 实现按标签统计或导出功能；引入图表库或新依赖；修改 data/notes.jsonl 内容；git push 或改 CI 配置；停在分析阶段；询问可从仓库发现的事实；在没有每条 AC 新鲜证据时宣布完成。

## Iteration Strategy

先在共享模块落地统计计算并用测试锁住口径，再接 CLI 与统计页两个展示端。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 通过，证据来自当前工作区可复跑的命令输出与页面核对。
- Quality: `npm test` 通过；无关既有失败（如有）单独说明；最终 diff 经过 review 并在不改行为的前提下简化。
- Final report: docs/goal-contracts/2026-08-07-notes-stats-report.md：逐条映射 AC-01 至 AC-04 的 Verify 证据，列出改动文件与剩余风险。

## Blockers

- None.
