# Goal Contract: 看板支持按负责人筛选任务

- Status: Ready
- Target: team-board 仓库（public/ 前端与 test/，必要时 src/server.mjs）
- Updated: 2026-08-07

## Goal

用户在 team-board 看板顶部工具栏右侧用单选下拉按负责人筛选卡片：选中后三列只显示该负责人的任务，筛选状态写入 URL 查询参数（刷新保持、链接分享给同事打开可见相同结果），可一键清除回到全部任务。

## Why

- 看板卡片一多，每个人只想看自己负责的任务，目前只能靠肉眼扫。
- 筛选状态可分享后，同一视图可以直接发给同事对齐。

## Read First

- docs/testing.md（仓库验证约定：npm test 为自动化门，页面改动本地浏览器人工验证）
- docs/goal-contracts/2026-08-07-board-assignee-filter-mock.html（用户确认版 mock，结构与关键交互的对照物，只读）

## Scope

- In: 看板页新增单选负责人筛选控件（选项来自任务数据去重）及其过滤、URL 持久化与分享、清除、列级空态行为。
- Out: 多选负责人、按状态或标签筛选、卡片详情的任何改动、任务数据结构变更。

## Success Criteria

- AC-01: 看板顶部工具栏右侧出现负责人筛选下拉，选项含「全部」与当前任务数据去重后的每个负责人，默认「全部」。
  - Verify: [C] `npm start` 后打开 http://localhost:4173 → 工具栏右侧可见下拉，当前数据下选项为「全部/ayan/bo/chen」。
- AC-02: 选中某负责人后，三列只显示该负责人的卡片，其余卡片不显示；切回「全部」恢复全部卡片。
  - Verify: [C] 选中 ayan → 仅剩 ayan 的两张卡片；切回「全部」→ 4 张卡片全部可见。
- AC-03: 筛选状态写入 URL 查询参数：刷新页面后筛选保持；将带参数链接在新窗口打开，看到相同筛选结果。
  - Verify: [C] 选中 bo → 刷新 → 仍只显示 bo；复制地址栏 URL 到新窗口打开 → 同样只显示 bo。
- AC-04: 「清除筛选」按钮一键回到全部任务，URL 中的筛选参数同时清除。
  - Verify: [C] 在任一筛选态点「清除筛选」→ 全部卡片可见，且地址栏不再含筛选参数。
- AC-05: 筛选后某列没有任何匹配卡片时，该列显示空态文案「没有匹配的任务」。
  - Verify: [C] 选中 chen（当前数据仅已完成列有其任务）→ 待办与进行中两列均显示「没有匹配的任务」。
- AC-06: 按负责人过滤任务的逻辑有自动化断言覆盖（选中某人、全部、无匹配三种情况），现有与新增测试全部通过。
  - Verify: [A] `npm test` → 退出码 0。
- AC-07: 交付界面与确认版 mock 在结构与关键交互上对照一致（非像素级）。
  - Verify: [C] `npm start` 后与 docs/goal-contracts/2026-08-07-board-assignee-filter-mock.html 逐屏对照 → 筛选控件位置、清除按钮、空态文案、三列结构与交互一致。

## Constraints

- 默认「全部」且无 URL 参数时，看板行为与现状一致：三列结构、卡片内容与展示方式不变。
- /api/tasks 现有响应结构与字段保持兼容。
- Mock 对照只要求结构与关键交互一致，不做像素级还原（用户明确不要求颜色、字体一致）。
- 不引入新的 npm 依赖或构建工具，保持仓库零依赖现状。

## Agent Mandate

- May decide: 创建分支；修改 public/ 下的 index.html、app.js、style.css，必要时调整 src/server.mjs 静态服务逻辑；在 test/run-tests.mjs 增补断言；URL 参数名、下拉实现方式等可逆实现细节。
- Must ask: 实现中发现必须改变 Goal、Scope、Success Criteria 或 Constraints 时；需要新增依赖、改变 /api/tasks 响应结构，或任何破坏性、未授权操作时。
- Must not: push；修改确认版 mock（docs/goal-contracts/2026-08-07-board-assignee-filter-mock.html）；修改本契约文件；停在分析阶段；询问仓库内可查的事实；悄悄扩大范围；在没有每条 AC 新鲜证据时宣布完成。

## Iteration Strategy

先以 AC-06 立起过滤逻辑与测试护栏，再按确认版 mock 完成界面、URL 与空态行为，逐条跑通 Verify 后收尾对照 AC-07。

## Completion

- Evidence: 全部 Success Criteria 满足，每条 Verify 以当前 worktree 的新鲜、可复现证据通过。
- Quality: `npm test` 与仓库检查通过，无关既有失败单独说明；最终 diff 经过 review 并在安全前提下 simplify。
- Final report: docs/goal-contracts/2026-08-07-board-assignee-filter-report.md：逐条映射 AC-01 至 AC-07 的 Verify 证据，列出改动文件与剩余风险。

## Blockers

- None.
