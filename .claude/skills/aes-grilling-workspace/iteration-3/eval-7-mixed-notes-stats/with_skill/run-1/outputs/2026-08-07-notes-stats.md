# Goal Contract: 笔记分类统计在网页与 CLI 双端可见

- Status: Ready
- Target: notes-tool 仓库（run-1/workdir 根目录）
- Updated: 2026-08-07

## Goal

用户在网页统计页和 CLI stats 子命令中都能看到每个分类的笔记数量与近 7 天新增笔记总数，两端基于同一份 data/notes.jsonl 且数字一致，现有笔记功能不受影响。

## Why

- 笔记已积累数百条，现有 CLI list 与网页列表只能逐条浏览，用户无法看到精力分布在哪些分类上。
- 分类计数与近 7 天新增让用户能直接观察记录习惯与近期活跃度。

## Read First

- docs/testing.md（仓库测试与网页人工检查约定）
- docs/goal-contracts/2026-08-07-notes-stats-mock.html（用户确认版统计页 mock，结构与关键内容的对照物，只读）

## Scope

- In: 统计口径实现（按 category 计数、近 7 天滚动窗口新增总数）；网页新增统计页；CLI 新增 stats 子命令输出简版文本；两端数字一致。
- Out: 按标签统计、导出文件、引入图表库、按任意时间范围筛选、改动现有 add/list 行为与现有笔记列表页。

## Success Criteria

- AC-01: 分类计数按 data/notes.jsonl 中每条笔记的 category 字段统计；「近 7 天新增」为 created 时间落在当前时刻往前 7×24 小时窗口内的笔记总数（跨分类合计）。
  - Verify: [A] `npm test` → 退出码 0，测试含对分类计数与近 7 天新增口径的断言
- AC-02: CLI 运行 `node src/cli.mjs stats` 输出纯文本统计：每个分类一行（分类名与数量），另有一行近 7 天新增总数。
  - Verify: [A] `npm test` → 退出码 0，测试含对 stats 子命令输出内容的断言
- AC-03: 网页新增统计页（路径 /stats），顶部为「近 7 天新增」数字卡片，其下每个分类一条带数字的横向长条，与确认版 mock 在结构与关键内容上对照一致。
  - Verify: [C] `npm run web` 后浏览器打开 http://localhost:4174/stats，与 docs/goal-contracts/2026-08-07-notes-stats-mock.html 逐处对照 → 卡片文案「近 7 天新增」、分类长条与数字的结构一致（不要求像素级）
- AC-04: 同一份 data/notes.jsonl 下，统计页与 CLI stats 输出的各分类数量与近 7 天新增总数完全相同。
  - Verify: [C] 依次运行 `node src/cli.mjs stats` 并打开 /stats 页 → 两端数字逐项相同
- AC-05: 现有行为保持：add/list 子命令与现有笔记列表页行为不变。
  - Verify: [A] `npm test` → 退出码 0，既有断言零失败

## Constraints

- 不引入任何图表库或新增 npm 依赖（dependencies 与 devDependencies 均保持为空）。
- 不改变 data/notes.jsonl 的存储格式与现有字段。
- 确认版 mock（docs/goal-contracts/2026-08-07-notes-stats-mock.html）是对照物，不得修改。
- 视觉细节不要求与 mock 像素级一致，结构与关键内容以确认版 mock 为准。

## Agent Mandate

- May decide: 在 src/ 与 test/ 下改代码补测试；统计计算的内部实现与代码组织；统计页样式细节（在 mock 结构约束内）；CLI 文本的具体排版。
- Must ask: 需要改变 Goal、Scope、Success Criteria 或 Constraints 时；需要修改 data/notes.jsonl 存储格式或引入新依赖时。
- Must not: 修改确认版 mock HTML；引入图表库；git 提交或推送；改动现有 add/list 与笔记列表页行为；停在分析阶段；询问可从仓库发现的事实；在没有每条 AC 新鲜证据时宣布完成。

## Iteration Strategy

先实现并用测试锁定统计口径，再接 CLI stats，最后做统计页并与确认版 mock 对照。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 通过，证据来自当前工作区可复跑的命令输出与页面对照。
- Quality: `npm test` 全绿；无关既有失败单独说明；最终 diff 经 review 并在不改变行为的前提下简化。
- Final report: docs/goal-contracts/2026-08-07-notes-stats-report.md：逐条映射 AC-01 至 AC-05 的 Verify 证据，列出改动文件与剩余风险。

## Blockers

- None.
