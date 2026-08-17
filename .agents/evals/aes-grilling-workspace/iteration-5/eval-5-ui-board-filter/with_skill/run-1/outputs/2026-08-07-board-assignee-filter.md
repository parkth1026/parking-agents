# Goal Contract: 看板可按负责人筛选任务，且筛选状态随刷新与分享链接保留

- Status: Ready
- Target: team-board 仓库前端（public/index.html、public/app.js、public/style.css）
- Updated: 2026-08-07

## Goal

打开团队看板的人可以在顶部工具栏选择一个负责人，三列只呈现该负责人的卡片；该筛选状态写在页面 URL 上，刷新页面或把链接发给同事打开时，看到的是同一份筛选结果；一键清除筛选可回到全部任务，筛选后无匹配时看板显示空态文案。

## Why

- 看板卡片变多后，每个人只关心自己负责的任务，现在只能靠肉眼在三列里扫，容易看漏。
- 筛选结果能通过链接直接传达，同事无需口头描述「你看进行中那列里我那两张」。

## Read First

- docs/goal-contracts/2026-08-07-board-assignee-filter-mock.html：用户确认版界面 mock，含三个关键状态（无筛选 / 筛选中 / 无匹配空态）与交互说明，是本次结构与交互的对齐基准。
- docs/testing.md：仓库测试约定与「页面改动如何验证」的现状说明。

## Scope

- In: 看板页面的单选负责人筛选控件、筛选结果渲染、URL 参数同步与还原、清除筛选、无匹配空态。
- Out: 不做多选负责人，不做按状态或标签筛选，不改卡片详情与卡片内容，不改 /api/tasks 的报文与服务端逻辑，不做筛选项的搜索框或分页。

## Success Criteria

- AC-01: 顶部工具栏右侧存在负责人筛选下拉；选中某个负责人后，三列只保留该负责人的卡片，三列的列结构与列标题保持不变。
  - Verify: [C] `npm start` 后打开 http://localhost:4173/ ，下拉选择 ayan，待办列只剩「整理季度目标 — ayan」、进行中列只剩「发布说明草稿 — ayan」、已完成列为空且列标题仍在；与 mock 的 S2 状态结构一致。
- AC-02: 下拉选项为「全部负责人」加上 /api/tasks 当前数据中出现过的负责人去重列表，不写死名单。
  - Verify: [C] 展开下拉，选项为「全部负责人」/ ayan / bo / chen 共四项；临时在 src/server.mjs 的 TASKS 里加一条新负责人的任务并重启服务，下拉自动多出该负责人，验证后还原该文件。
- AC-03: 选中负责人后 URL 带上 assignee 参数；刷新页面或在另一个浏览器窗口打开同一 URL，下拉回显该负责人且看板呈现同样的筛选结果。
  - Verify: [C] 选择 bo，地址栏变为 http://localhost:4173/?assignee=bo ；按 F5 刷新，再把该 URL 粘贴到新开的无痕窗口，两次都只显示「客户回访记录 — bo」且下拉显示 bo。
- AC-04: 筛选生效时出现「清除筛选」按钮，点击后回到全部任务，URL 上的 assignee 参数被移除，按钮随之消失。
  - Verify: [C] 选择 chen 后点击「清除筛选」，四张卡片按原状态回到三列，地址栏回到 http://localhost:4173/ ，「清除筛选」按钮不再显示。
- AC-05: 当前筛选没有任何匹配卡片时，看板显示空态文案「没有匹配的任务」，且筛选值不被静默改写为「全部」。
  - Verify: [C] 直接访问 http://localhost:4173/?assignee=dana ，页面显示「没有匹配的任务」，下拉仍回显 dana，URL 参数保留；与 mock 的 S3 状态一致。

## Constraints

- /api/tasks 的路由、请求方式与响应报文保持现状：不新增查询参数、不改 id / title / assignee / status 字段，筛选完全在前端完成。
- 无筛选状态下的看板与现状逐处一致：三列「待办 / 进行中 / 已完成」、卡片文案格式「标题 — 负责人」、现有 data-status 结构与 .card 类名保持可用。
- 仅支持单选一个负责人；不引入构建工具、打包器或第三方运行时依赖（package.json 目前没有 dependencies，前端是原生 ES module）。
- 视觉不作像素级还原要求：颜色、字号、间距沿用现有 style.css 风格即可，结构与交互按确认版 mock。
- 确认版 mock 是对齐产物，不是可改的产品文件。

## Agent Mandate

- May decide: 创建分支；修改 public/index.html、public/app.js、public/style.css；在 test/run-tests.mjs 中增补可脱离浏览器运行的断言；在 docs/goal-contracts/ 下写最终报告。
- Must ask: 需要改动 Goal、Scope、Success Criteria 或 Constraints 时；需要修改 /api/tasks 报文、引入运行时依赖、或永久改动 src/server.mjs 的任务数据时（AC-02 的临时验证改动必须在验证后还原）。
- Must not: 修改 docs/goal-contracts/2026-08-07-board-assignee-filter-mock.html；修改 docs/testing.md 的测试约定；push 或改动 CI 配置；停在分析或只交一份计划；回来询问仓库里查得到的事实；静默扩大范围；在没有逐条新鲜证据前宣称完成。

## Iteration Strategy

先做下拉与前端筛选渲染，再接 URL 参数的写入与进入页面时的还原，最后补清除按钮与空态。

## Completion

- Evidence: 全部 Success Criteria 满足；每条 Verify 都在当前工作区跑出新鲜、可复现的证据。
- Quality: `npm test` 退出码为 0；无关的既有失败单独说明；最终 diff 已 review 并在不改变行为的前提下简化。
- Final report: docs/goal-contracts/2026-08-07-board-assignee-filter-report.md：逐条 AC 对应其 Verify 证据、列出改动文件与剩余风险。聊天里的总结不算交付。

## Blockers

- None.
