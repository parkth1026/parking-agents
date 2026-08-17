# 行为对照表: 2026-08-11-session-list-grouping

**确认版·锁定。** 执行 Agent 改的是产品，不是这份对照表。
用户确认：2026-08-11T11:50:00Z

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | `session.mjs list --group-by-stage`，issue 分布在 3 个不同 stage | 不支持该 flag，直接报「用法：session.mjs list」并原样跑现有平铺表（未知 flag 目前被忽略） | 按 `1-interview → 2-prototype → 3-contract` 顺序分组打印；**每组标题行同时标出 stage 名字和该组条数**，如 `2-prototype (3)`；组内沿用原来的字母序 |
| 2 | `session.mjs list --stage 2-prototype`，该 stage 有 2 条 issue | 不支持 | 只打印 `manifest.stage === '2-prototype'` 的 issue，单一 stage 不需要再分组，标题行仍标 `2-prototype (2)` |
| 3 | `session.mjs list --status in_progress` | 不支持 | 只打印 `stage_gates[当前 stage].status === 'in_progress'` 的 issue |
| 4 | `session.mjs list --stage 1-interview --status needs_reinterview` | 不支持 | 交集：同时满足两个条件的 issue |
| 5（边界值） | `session.mjs list --status done`，当前没有任何 issue 处于该状态 | 不支持 | **不再是空输出**：打印一行明确提示「没有匹配项：--status done」，退出码仍为 0（这是一次成功的空查询，不是错误） |
| 6（边界值） | `session.mjs list --stage 2-prototype --status needs_reinterview`，两个条件的交集为空 | 不支持 | 同上，提示「没有匹配项：--stage 2-prototype --status needs_reinterview」，把实际生效的筛选条件回显出来，不是一句通用的「没有匹配项」 |
| 7（边界值） | `session.mjs list --stage not-a-real-stage`（非法值） | 不支持 | 报错退出（非 0），提示合法取值集合，不是静默当成 0 条匹配 |

## 不变清单

- **不加任何 flag 时，`session.mjs list` 的输出与现状逐字节一致**：同一张按 slug
  字母序排序的等宽表格，四列 `slug / stage / status / goal 摘要`，不分组、不过滤、
  不打印任何"没有匹配项"提示（这条提示只在显式加了 `--stage`/`--status` 且结果为空
  时才出现，不加 flag 的默认路径完全不受影响）。用户本机有依赖这个纯文本格式的
  PowerShell 脚本（仓库外，round 1 Q1 确认），这是这条不变清单存在的直接原因。
- `.aes-workflow/grilling/` 不存在时的提示语不变。
- 目录存在但一个 issue 都没有时的提示语不变（这与「筛选后 0 条」是两种不同的空——
  前者是「压根没有数据」，后者是「有数据但筛没了」，提示语分开写，不能共用一句话）。

## 配置差异

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| `--group-by-stage` | 不存在 | 新增，布尔 flag，按 stage 分组显示，分组标题带条数 | 无需迁移，opt-in，不影响默认路径 |
| `--stage <name>` | 不存在 | 新增，取值须是 `1-interview`/`2-prototype`/`3-contract` 之一，非法值报错退出 | 无需迁移，opt-in |
| `--status <value>` | 不存在 | 新增，取值须是 `pending`/`in_progress`/`done`/`skipped`/`needs_reinterview` 之一，非法值报错退出 | 无需迁移，opt-in |
