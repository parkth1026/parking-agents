# Goal Contract: 看板按负责人筛选卡片

- Status: Ready
- Target: team-board 仓库（public/ 前端、test/ 测试）
- Updated: 2026-08-07

## Goal

用户可以在 team-board 看板上按负责人筛选卡片：选定某负责人后，三列只显示该负责人的任务；筛选状态写入 URL 查询参数，刷新页面后筛选保持，把链接发给同事，对方打开看到同样的筛选结果。

## Why

- 看板卡片一多，每个人只想看自己负责的任务，目前只能靠肉眼扫。
- 可分享的筛选链接让同事打开即见相同视图，减少沟通成本。

## Read First

- docs/testing.md（仓库验证约定：npm test 与页面改动的人工验证方式）

## Scope

- In: 看板页面新增负责人单选筛选控件（选项来自当前任务数据的负责人集合，含「全部」默认项）、按负责人过滤三列卡片的渲染逻辑、筛选状态与 URL 查询参数同步、筛选结果为空时的空态提示、配套自动化断言。
- Out: 多选负责人、按状态或标签筛选、卡片详情改动、/api/tasks 后端行为与数据结构改动、引入视觉回归工具。

## Success Criteria

- AC-01: 看板页面提供负责人筛选控件，选项覆盖当前任务数据中出现的全部负责人，并含默认的「全部」项。
  - Verify: [C] `npm start` 后打开看板页，检查筛选控件选项等于任务数据负责人集合加「全部」，默认为「全部」
- AC-02: 选定某负责人后，三列均只显示该负责人的卡片；切回「全部」后恢复显示全部卡片。
  - Verify: [C] 选择 ayan 后三列仅剩 ayan 的 2 张种子卡片，切回「全部」后 4 张卡片全部可见
- AC-03: 筛选状态同步到 URL 查询参数：带参数刷新后筛选仍生效，在新的浏览器窗口打开同一链接得到相同筛选结果。
  - Verify: [C] 选择 ayan 后复制地址栏 URL，刷新与新窗口打开该 URL 均只显示 ayan 的卡片
- AC-04: 筛选结果为空时（例如 URL 指定的负责人当前没有任务），看板显示空态提示「没有匹配的任务」，而不是三列空白。
  - Verify: [C] 打开 /?assignee= 指向一个不存在的负责人 → 页面显示「没有匹配的任务」
- AC-05: 不带筛选参数打开看板时，默认行为与现状一致：三列合计显示全部 4 张种子卡片。
  - Verify: [C] 打开根路径不带参数 → 三列合计 4 张卡片，与改动前一致
- AC-06: 按负责人过滤任务的核心逻辑具有自动化测试断言，且全部测试通过。
  - Verify: [A] `npm test` → 退出码 0，输出包含新增的筛选逻辑断言

## Constraints

- 不修改 /api/tasks 的路径、响应结构与种子数据。
- 不带筛选参数时，看板三列布局与卡片展示行为和现状保持一致。
- 不引入构建工具或外部运行时依赖，保持纯静态前端加 Node 原生服务的现状。

## Agent Mandate

- May decide: 在 public/ 与 test/ 下修改代码与测试；筛选控件的具体形态与摆放位置、空态提示的样式实现、URL 参数的编码与解析细节、把过滤逻辑抽成可独立测试的模块等可逆实现细节。
- Must ask: 需要改动 Goal、Scope、Success Criteria 或 Constraints 时；需要修改 /api/tasks 行为、改动 package.json 脚本语义或引入外部依赖时。
- Must not: 执行 git push 或删除与本目标无关的文件；把范围扩大到多选或状态/标签筛选；停在分析阶段；询问可从仓库发现的事实；在没有每条 AC 新鲜证据时宣布完成。

## Iteration Strategy

先抽出并用断言覆盖过滤逻辑（AC-06 护栏），再接 UI 控件与 URL 同步，最后补空态并按 [C] 步骤逐条人工验证。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 行通过；[C] 步骤附可复现的操作与观察记录，[A] 命令输出来自当前 worktree。
- Quality: `npm test` 通过；无关既有问题不混入本次改动；最终 diff 已审阅并在不改行为的前提下简化。
- Final report: docs/goal-contracts/2026-08-07-board-assignee-filter-report.md：逐条映射 AC-01 至 AC-06 的 Verify 证据，列出改动文件与剩余风险。

## Blockers

- None.
