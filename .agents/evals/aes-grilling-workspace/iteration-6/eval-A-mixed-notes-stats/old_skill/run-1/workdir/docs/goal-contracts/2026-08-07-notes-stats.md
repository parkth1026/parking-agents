# Goal Contract: notes-tool 分类与近 7 天统计

- Status: Ready
- Target: `notes-tool`（`src/cli.mjs`、`src/web/server.mjs`、`src/web/public/`）
- Updated: 2026-08-07

## Goal

用户可以在 notes-tool 的网页统计页看到每个分类的笔记数量和「近 7 天新增」总数，也可以用 CLI 一条命令看到同样的简版文本统计，网页和 CLI 的数字始终一致。

## Why

- 笔记已积累到几百条，用户想知道精力都花在哪些分类上，现有 CLI/网页都只能看到原始列表，看不出汇总。
- 「近 7 天新增了多少」是判断近期投入的直接信号，目前完全没有入口。

## Read First

- `docs/goal-contracts/2026-08-07-notes-stats-mock.html`：用户确认版网页统计页 mock，结构与关键交互以此为准。
- `docs/testing.md`：仓库测试约定（`npm test`，无截图/视觉回归工具）。

## Scope

- In: 新增网页统计页（按分类计数 + 顶部「近 7 天新增」数字卡片，分类用横向长条+数字呈现）；新增 CLI `notes stats` 命令输出同口径简版文本；保证两端数字来自同一份计算逻辑。
- Out: 按标签统计、导出统计文件、引入任何图表库、历史趋势图、按其他维度（如时间范围可调）筛选统计、修改现有 `add`/`list` 行为或 `/api/notes` 报文格式。

## Deliverables

- D-01: `test/fixtures/notes-stats/input-notes.jsonl`: 覆盖多分类、含「正好 7 天前」边界样例的黄金用例输入笔记数据，对应 AC-02、AC-03。
- D-02: `test/fixtures/notes-stats/expected-stats.json`: 与 D-01 对应的期望输出，含 `byCategory` 与 `recentWeekCount` 字段，对应 AC-02、AC-03。

## Success Criteria

- AC-01: 网页统计页在结构、信息与关键交互（顶部「近 7 天新增」卡片 + 每分类横向长条带数字）上与确认版 mock 一致，未额外引入图表库。
  - Verify: [C] 打开 `docs/goal-contracts/2026-08-07-notes-stats-mock.html` 与本地 `npm run web` 起的统计页逐处对照，结构与交互一致视为通过
- AC-02: 网页统计页顶部数字卡片展示的是过去 7×24 小时内新增的笔记总数（跨全部分类汇总），含「正好 7 天前」边界样例的黄金用例验证。
  - Verify: [B] `test/fixtures/notes-stats/input-notes.jsonl` 跑统计计算 → 与 `test/fixtures/notes-stats/expected-stats.json` 中的 `recentWeekCount` 字段一致
- AC-03: 每个分类的笔记计数与实际笔记数据一致，不遗漏、不重复计数；笔记缺失或空分类统一归入「未分类」。
  - Verify: [B] `test/fixtures/notes-stats/input-notes.jsonl` 跑统计计算 → 与 `test/fixtures/notes-stats/expected-stats.json` 中的 `byCategory` 字段一致
- AC-04: CLI `node src/cli.mjs stats` 输出各分类计数与近 7 天新增数的简版文本，且与同一时刻网页统计页 API 返回的数值完全一致。
  - Verify: [A] `npm test` → 新增用例断言 CLI 输出与统计 API 共用同一份计算函数、对同一份数据返回相同数值，退出码 0
- AC-05: 现有 `add`/`list` CLI 命令行为与 `/api/notes` 接口报文格式保持不变。
  - Verify: [A] `npm test` → `test/run-tests.mjs` 现有断言（笔记条数与字段校验）继续通过，退出码 0

## Constraints

- 网页统计页不接入任何图表库（保持纯 HTML/CSS，长条用 CSS 实现）。
- 视觉细节不要求像素级还原，结构和信息以确认版 mock 为准。
- CLI 与网页的统计数字必须始终一致，不允许各自维护一套计算口径。
- 不得修改 `docs/goal-contracts/2026-08-07-notes-stats-mock.html`（确认版对照物只读）。

## Agent Mandate

- May decide: 在 `src/`、`test/`、`data/`（如需新增 fixture）下新增代码与测试；确定统计计算函数的内部实现、模块划分、路由路径等可逆实现细节；运行 `npm test` 与 `npm run web` 自查。
- Must ask: 需要变更 Goal、Scope、Success Criteria 或 Constraints 时；需要修改 `add`/`list` 现有行为或 `/api/notes` 报文格式时；需要引入图表库或新增外部依赖时。
- Must not: push 代码；修改确认版 mock `docs/goal-contracts/2026-08-07-notes-stats-mock.html`；引入图表库；停在计划阶段；询问可从仓库直接发现的事实；在没有每条 AC 新鲜验证证据时宣布完成。

## Iteration Strategy

先落地共用的统计计算逻辑（分类计数 + 近 7 天计数）并配黄金用例测试，再分别接出网页统计页与 CLI `stats` 命令，最后核对两端与 mock 的一致性。

## Completion

- Evidence: 全部 Success Criteria 的 Verify 行通过，证据来自当前 worktree 可复跑的命令输出或可复现的手动步骤。
- Quality: `npm test` 与相关人工核对全部通过，无关既有失败已分离；最终 diff 已完成 review 和 simplify。
- Final report: `docs/goal-contracts/2026-08-07-notes-stats-report.md`：逐条映射 AC-01 至 AC-05 的 Verify 证据，说明改动文件和剩余风险。

## Blockers

- None.
