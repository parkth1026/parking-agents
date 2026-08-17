# Goal Contract: 看板支持按负责人筛选任务

- Status: Ready
- Target: `team-board`（public/index.html、public/app.js、public/style.css、test/run-tests.mjs）
- Updated: 2026-08-07

## Goal

打开团队看板的人可以在顶部工具栏选择一位负责人，看板只显示该负责人的卡片；这个筛选状态跟着 URL 走，刷新后仍在，把链接发给同事后对方打开看到的是同样的筛选结果。

## Why

- 卡片变多后，每个人只想看自己负责的任务，现在只能靠肉眼在三列里逐张扫。
- 筛选结果能通过链接直接传达，同事不必再被口头告知「看板上找你自己的那几张」。

## Read First

- docs/goal-contracts/2026-08-07-board-assignee-filter-mock.html：用户确认版界面 mock，交付界面按它对照（只对结构、信息与关键交互，不对像素）。
- docs/testing.md：本仓库测试与页面验证约定。

## Scope

- In: 看板顶部工具栏的负责人单选筛选（含「全部」与「清除筛选」）、筛选后的卡片渲染与空态、筛选状态写入并还原 URL 查询参数、覆盖筛选逻辑的自动化断言。
- Out: 多选负责人、按状态或标签筛选、卡片详情与卡片内容改动、负责人显示名映射或头像、后端筛选接口与 /api/tasks 响应结构变更、登录态或个人偏好存储。

## Success Criteria

- AC-01: 顶部工具栏右侧有「负责人」单选下拉，选项为「全部」加当前 /api/tasks 数据中出现过的负责人（当前为 ayan、bo、chen），默认选中「全部」。
  - Verify: [C] `npm start` 后打开 http://localhost:4173/ → 顶栏右侧出现负责人下拉，展开后为「全部 / ayan / bo / chen」，初始为「全部」
- AC-02: 选中某位负责人后，看板只显示该负责人的卡片，待办 / 进行中 / 已完成三列结构保留，空列只是没有卡片。
  - Verify: [C] 选中 ayan → 页面只剩「整理季度目标」（待办）与「发布说明草稿」（进行中）两张卡片，三列列头仍在，已完成列为空
- AC-03: 「清除筛选」按钮一键回到全部任务，并把筛选参数从 URL 中移除。
  - Verify: [C] 在 http://localhost:4173/?assignee=ayan 状态下点「清除筛选」→ 4 张卡片全部回来，地址栏回到 http://localhost:4173/ 且不带 assignee 参数
- AC-04: 筛选结果写入 URL 查询参数并可从 URL 还原：刷新后筛选仍在，同一链接在另一个浏览器窗口打开得到相同结果。
  - Verify: [C] 选中 bo → 地址栏出现 ?assignee=bo；刷新后仍只显示「客户回访记录」；把该链接粘贴到新开的无痕窗口打开，结果一致
- AC-05: 当前筛选下一张卡片都不匹配时，界面显示空态文案「没有匹配的任务」，三列列头仍在。
  - Verify: [C] 直接访问 http://localhost:4173/?assignee=dora → 页面显示「没有匹配的任务」，三列列头仍在且没有卡片
- AC-06: 按负责人筛选任务的逻辑被自动化断言覆盖，至少包含选中某位负责人、选「全部」、以及无任何匹配三种情形。
  - Verify: [A] `npm test` → 退出码 0，输出包含新增的筛选断言
- AC-07: 交付界面与确认版 mock 在结构与关键交互上一致：筛选控件位于顶栏右侧、有清除筛选按钮、空态文案一致、三列结构保留；颜色与字体不做像素级对照。
  - Verify: [C] 并排打开 docs/goal-contracts/2026-08-07-board-assignee-filter-mock.html 与运行中的页面 → 上述四处逐一对应（mock 中标注为「演示开关」的部分不属于交付界面）

## Constraints

- 未使用筛选时（URL 不带 assignee 参数）看板行为与现状一致：三列渲染全部卡片。
- /api/tasks 的请求方式与响应结构保持不变，筛选在前端完成，不新增后端筛选参数。
- 保持仓库现有的无构建步骤形态：原生 HTML / CSS / 浏览器 ES 模块，不引入前端框架或运行时依赖。
- 卡片文案格式（标题加负责人）与三列状态划分保持原样。
- 视觉不做像素级还原；确认版 mock 对齐的是结构、信息与关键交互。

## Agent Mandate

- May decide: 创建分支；修改 public/index.html、public/app.js、public/style.css；在 test/run-tests.mjs 增加断言并按需拆出可测试的筛选函数；运行 `npm test` 与 `npm start`；自行决定 DOM 结构、CSS 类名、URL 参数读写与历史记录方式等实现细节。
- Must ask: 需要改动 Goal、Scope、Success Criteria 或 Constraints 时；需要改 /api/tasks 响应结构或引入新依赖时；需要破坏性、凭据相关或生产环境操作时。
- Must not: push；删除文件；改 CI 或 package.json 依赖；修改确认版 mock 文件 docs/goal-contracts/2026-08-07-board-assignee-filter-mock.html；停在分析或计划阶段；询问仓库里查得到的事实；悄悄扩大范围；在没有每条 AC 新鲜证据时宣布完成。

## Iteration Strategy

先做筛选逻辑与自动化断言，再按 mock 补齐工具栏控件、空态与 URL 还原，每条 AC 验证通过后再进下一条。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 行通过，证据来自当前 worktree 可复跑的命令输出与浏览器操作记录。
- Quality: `npm test` 通过，无关既有失败已分离；最终 diff 已完成 review 并在不改变行为的前提下 simplify。
- Final report: docs/goal-contracts/2026-08-07-board-assignee-filter-report.md：逐条映射 AC-01 至 AC-07 的 Verify 证据，列出改动文件与剩余风险。

## Blockers

- None.
