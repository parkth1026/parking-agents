---
schema_version: 1
protocol: 1.3.0
id: wi_01K2Q7XH9M3TN5V8B4RJD6WCFA
short_id: q7xh9m3t
home_repository: "notes-tool"
kind: feature
title: "笔记按分类统计 + 近 7 天新增统计"
status: proposed
created_at: 2026-08-07T13:30:00Z
branch_or_pr: "feature/notes-category-stats"
---

# 笔记按分类统计 + 近 7 天新增统计

## 原始请求

> notes-tool 想加个统计功能，能看到每个分类下有多少条笔记、最近一周新增了多少。
> 帮我理清需求写一份 goal contract，先别写代码。

## 目标

用户能在网页统计页和 CLI 里，看到一致的「各分类历史笔记数」和「近 7 天新增笔记数」。

## 范围

做：新增网页统计页（各分类历史笔记数横向长条对比 + 顶部「近 7 天新增」数字卡片）；
新增 CLI `notes stats` 简版文本命令，输出与网页相同口径的两组数字；
category 为空或缺失的笔记归并计入「未分类」参与统计。

不做：按标签统计、导出统计文件、引入任何图表库、改动现有 `list`/`add` 命令行为、
改动现有 `/api/notes` 接口和只读笔记列表页、按自然周或本地时区分组统计。

## 强约束

- 不引入任何图表库；分类对比用纯 CSS/HTML 长条实现。
- 网页统计页与 CLI `notes stats` 必须共用同一份统计计算逻辑，不允许两套口径分别实现。
- 现有行为不变：CLI `add`/`list` 的输出和退出码、`/api/notes` 的响应内容、
  只读笔记列表页 `src/web/public/index.html` 的展示，均保持原样。
  `node test/run-tests.mjs` 现有断言零改动仍应通过即为证据。
- 「近 7 天新增」统计口径固定为：以查看时刻为基准，往前 7×24 小时、含边界，
  不做自然周或时区换算。

## 读什么

- `docs/testing.md`：本仓库的测试与验证约定（`npm test`、无截图对比/视觉回归工具）。
- `data/notes.jsonl`：现有笔记数据的真实字段形态（`category`、`text`、`created`）。
- `workflow/notes-category-stats/mock.html`：已确认的网页统计页结构对照物。
- `workflow/notes-category-stats/interview.md`：访谈记录，统计口径、排序、
  「未分类」处理等决定的由来都在这里。

## 要落盘的东西

- D-01: `test/fixtures/notes-stats/input-notes.jsonl`：含多分类与「近 7 天」窗口边界笔记的输入 fixture，对应 AC-002、AC-003。
- D-02: `test/fixtures/notes-stats/expected-stats.json`：D-01 对应的期望统计结果（分类计数、`recentCount`、`asOf` 参照时刻），对应 AC-002、AC-003。
- D-03: `test/fixtures/notes-stats/input-notes-with-blank-category.jsonl`：含空字符串与缺失 `category` 字段的输入 fixture，对应 AC-004。
- D-04: `test/fixtures/notes-stats/expected-stats-blank-category.json`：D-03 对应的期望统计结果（含「未分类」桶），对应 AC-004。

## 验收条件

- AC-001: 网页统计页对每个分类显示该分类下的历史笔记总数（不限时间），按数量从高到低排序，每行以横向长条搭配具体数字呈现。
  - Verify: [C] 运行 `npm run web` 打开统计页，页面的分类清单、排序、长条+数字呈现方式与已确认的 `workflow/notes-category-stats/mock.html` 一致（人工比对；仓库目前无截图对比/视觉回归工具，见 `docs/testing.md`）
- AC-002: 页面顶部卡片显示「近 7 天新增」及对应数字，口径为以查看时刻为基准往前 7×24 小时（含边界）内 `created` 的笔记数，不按分类拆分。
  - Verify: [B] `test/fixtures/notes-stats/input-notes.jsonl` → 与 `test/fixtures/notes-stats/expected-stats.json` 的 `recentCount` 字段一致
- AC-003: CLI `notes stats` 命令以纯文本输出各分类计数与「近 7 天新增」数字，且与网页展示的数字完全一致。
  - Verify: [A] `node test/run-tests.mjs` → 新增的 stats 断言全绿，验证 CLI 与网页共用的统计函数对同一份 `test/fixtures/notes-stats/input-notes.jsonl` 产出的分类计数、`recentCount` 与 `test/fixtures/notes-stats/expected-stats.json` 一致
- AC-004: `category` 为空字符串或缺失该字段的笔记，统一归并计入「未分类」一档参与分类计数展示，不报错、不被静默丢弃。
  - Verify: [B] `test/fixtures/notes-stats/input-notes-with-blank-category.jsonl` → 统计结果与 `test/fixtures/notes-stats/expected-stats-blank-category.json` 一致（含「未分类」分类及其计数）
