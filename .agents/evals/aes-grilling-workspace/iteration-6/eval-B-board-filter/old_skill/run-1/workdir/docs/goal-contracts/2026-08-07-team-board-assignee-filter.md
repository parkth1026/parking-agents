# Goal Contract: team-board 按负责人筛选任务

- Status: Ready
- Target: team-board（`public/`、`src/server.mjs`、`test/`）
- Updated: 2026-08-07

## Goal

在团队看板上，用户可以按负责人筛选任务卡片；筛选结果在刷新页面后保留，把当前地址分享给
同事打开后看到相同的筛选结果。

## Why

- 看板卡片变多后，每个人只能靠肉眼在三列里扫，找不到自己负责的任务。
- 按负责人筛选后再刷新或分享链接给同事，双方看到的都是同一份已筛选视图，减少来回沟通。

## Read First

- `docs/goal-contracts/2026-08-07-team-board-assignee-filter-mock.html`：访谈中用户已确认的
  界面 mock（结构、负责人下拉位置、清除筛选按钮、空态文案、三种关键状态演示）。
- `docs/testing.md`：仓库测试与页面验证约定。

## Scope

- In: 顶部工具栏新增负责人筛选下拉（单选，选项来自当前已加载任务数据去重）；筛选状态编码进当前页面 URL，使其在刷新后保留、通过分享链接打开后一致；提供「清除筛选」按钮恢复显示全部任务；筛选后无匹配任务时显示空态文案「没有匹配的任务」。
- Out: 不支持多选负责人；不新增按状态或标签筛选；不改动卡片详情展示；不修改 `/api/tasks` 的响应结构或新增查询参数（筛选在前端对已加载数据完成）；不处理 assignee 为空/未指派的任务（当前数据与代码都不存在这种任务，出现时如何展示不在本次范围内）。

## Success Criteria

- AC-01: 不选择任何负责人时，看板三列展示的任务与当前版本一致，不因本次改动产生变化。
  - Verify: [C] 本地 `npm start` 后浏览器打开首页（不带筛选）→ 待办/进行中/已完成三列合计
    仍显示 4 张任务卡片，分组与现状一致
- AC-02: 从负责人下拉选择一人后，页面只展示该负责人的任务，其余负责人的任务从三列中消失。
  - Verify: [A] `npm test` → 退出码 0，新增的按负责人过滤逻辑断言全部通过
- AC-03: 选择负责人后刷新当前页面，筛选状态保持不变（仍只显示该负责人任务，下拉框停留在
  该负责人）。
  - Verify: [C] 本地 `npm start` 后在浏览器选择「ayan」并刷新页面 → 页面仍只显示 ayan 的
    任务，下拉框显示「ayan」
- AC-04: 复制筛选后的当前页面地址在新标签页打开，看到与原页面一致的筛选结果（模拟把链接
  分享给同事）。
  - Verify: [C] 选择「ayan」后复制地址栏 URL 并在新标签页打开该 URL → 新标签页只显示 ayan
    的任务
- AC-05: 点击「清除筛选」按钮后，恢复展示全部任务，下拉框回到「全部负责人」。
  - Verify: [C] 筛选出「ayan」后点击「清除筛选」按钮 → 三列恢复显示全部 4 张任务卡片，
    下拉框显示「全部负责人」
- AC-06: 选择一个当前没有任务的负责人时，三列不展示任何卡片，并显示文案「没有匹配的任务」。
  - Verify: [C] 在下拉框选择一个当前无对应任务的负责人 → 三列为空，页面显示「没有匹配的
    任务」
- AC-07: 交付的筛选界面与确认版 mock 在结构、控件位置与关键交互上对照一致，不做像素级还原。
  - Verify: [C] 对照 `docs/goal-contracts/2026-08-07-team-board-assignee-filter-mock.html`
    逐项核对：筛选控件位于顶部工具栏右侧、清除筛选按钮存在且行为一致、空态文案一致

## Constraints

- 仅支持单选负责人，不支持多选。
- 不新增按状态或标签筛选。
- 不改动卡片详情或卡片以外的信息展示。
- 保持 `/api/tasks` 现有响应结构不变；筛选在前端对已加载数据完成，不要求后端新增查询参数
  支持。
- 视觉细节（颜色、字体等）不要求与 mock 一致，仅结构和关键交互需要对照一致，不接受像素级
  比对要求。
- `docs/goal-contracts/2026-08-07-team-board-assignee-filter-mock.html` 是访谈确认产物，
  只读，不得被执行 Agent 修改。

## Agent Mandate

- May decide: 创建分支；在 `public/`、`src/server.mjs`、`test/` 下增删改代码与测试；决定用 URL query 参数还是 hash 存储筛选状态等具体实现细节（只要满足刷新保留与分享一致）；决定负责人下拉选项的具体生成方式（从当前任务数据去重）；运行 `npm test` 与本地 `npm start` 做验证。
- Must ask: 需要修改 `/api/tasks` 接口契约、需要支持多选负责人、需要新增独立的人员管理接口，或任何会突破本 Scope 或 Success Criteria 的改动时。
- Must not: push；修改 `package.json` 依赖或 CI 配置；修改确认版 mock 文件；停在计划阶段就宣称完成；未对每条 AC 取得新鲜证据就宣称完成；擅自扩大到状态/标签筛选或多选负责人。

## Iteration Strategy

先做负责人下拉与前端过滤（AC-01/AC-02），再接入 URL 状态持久化（AC-03/AC-04），然后补
清除筛选与空态（AC-05/AC-06），最后对照 mock 收尾（AC-07）。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 行通过，证据来自当前 worktree 可复跑的命令输出或可复现的手动步骤。
- Quality: `npm test` 与仓库既有检查通过，无关的既有失败已分离说明；最终 diff 已完成 review 并在不改变行为的前提下 simplify。
- Final report: `docs/goal-contracts/team-board-assignee-filter-report.md`，逐条映射 AC-01 至 AC-07 的 Verify 证据，列出改动文件与剩余风险。

## Blockers

- None.
