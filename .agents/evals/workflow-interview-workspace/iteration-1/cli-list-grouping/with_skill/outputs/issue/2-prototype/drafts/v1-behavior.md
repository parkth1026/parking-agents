<!-- draft v1 | published 2026-08-11T11:40:00Z
     用户意见：待收集
     状态：superseded by v2 -->

# 行为对照表: 2026-08-11-session-list-grouping (draft v1)

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | `session.mjs list --group-by-stage`，issue 分布在 3 个不同 stage | 不支持该 flag，报错退出 | 按 `1-interview → 2-prototype → 3-contract` 顺序分组打印，每组内沿用原来的字母序 |
| 2 | `session.mjs list --stage 2-prototype` | 不支持 | 只打印 `manifest.stage === '2-prototype'` 的 issue，不分组（单一 stage 无需分组） |
| 3 | `session.mjs list --status in_progress` | 不支持 | 只打印 `stage_gates[当前 stage].status === 'in_progress'` 的 issue |
| 4 | `session.mjs list --stage 1-interview --status needs_reinterview` | 不支持 | 交集：同时满足两个条件的 issue |
| 5 | `session.mjs list --status done`（某个 stage 全是 pending，过滤后 0 条） | 不支持 | 不打印任何行（空输出） |

## 不变清单

- 不加任何 flag 时，`session.mjs list` 的输出与现状逐字节一致：同一张按 slug
  字母序排序的等宽表格，四列 `slug / stage / status / goal 摘要`，不分组、不过滤。
  用户本机有依赖这个纯文本格式的 PowerShell 脚本（仓库外，round 1 Q1 确认）。
- `.aes-workflow/grilling/` 不存在时的提示语不变。
- 没有任何 issue 时的提示语不变。

## 配置差异

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| `--group-by-stage` | 不存在 | 新增，布尔 flag，按 stage 分组显示 | 无需迁移，opt-in |
| `--stage <name>` | 不存在 | 新增，取值须是 `1-interview`/`2-prototype`/`3-contract` 之一 | 无需迁移，opt-in |
| `--status <value>` | 不存在 | 新增，取值须是 `pending`/`in_progress`/`done`/`skipped`/`needs_reinterview` 之一 | 无需迁移，opt-in |
