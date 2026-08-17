<!-- draft v1 | published 2026-08-13T00:20:00Z
     用户意见：分组标题行要清楚标出 stage 名字和数量；筛选命中 0 条不能什么都不打印，
     必须明确提示「没有匹配项」
     状态：superseded by v2 -->

# 行为对照表: 2026-08-13-cli-list-grouping

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | `session.mjs list`（不加任何参数），3 个 issue | 摊平单表，逐行 `slug  stage  status  goal摘要`，按 slug 字典序 | 逐字节不变——和「现在的行为」完全一样 |
| 2 | `session.mjs list --group`，3 个 issue（2 个在 1-interview，1 个在 2-prototype） | （新参数，现在不存在） | 按 stage 分桶，每桶一个标题行，桶内保持 slug 字典序；三个 stage 里没有 issue 的桶不打印 |
| 3 | `session.mjs list --stage 1-interview` | （新参数，现在不存在） | 只保留 `manifest.stage === '1-interview'` 的行，摊平打印（不分组，除非同时加 `--group`） |
| 4 | `session.mjs list --stage bogus`（非法阶段名） | （新参数，现在不存在） | 报错退出，非 0 退出码，不打印任何 issue 行 |
| 5 | `session.mjs list --status in_progress` | （新参数，现在不存在） | 只保留顶层 `manifest.status === 'in_progress'` 的行；当前几乎所有未 ready 的 issue 都会命中 |
| 6 | `session.mjs list --stage 1-interview --status in_progress` | （新参数，现在不存在） | 两个筛选条件取交集（AND） |
| 7（边界） | `session.mjs list --stage 3-contract`，没有任何 issue 处于 3-contract | （新参数，现在不存在） | 命中 0 条：不打印任何 issue 行（沿用现在「没有任何 issue」时的提示風格） |

## 不变清单

- **不加任何参数时，输出必须和现在逐字节一样**：无表头、两空格分隔列、按 slug 字典序、
  列宽按当前批次数据动态对齐。这是用户本地一个不在本仓库内的 PowerShell 脚本在依赖的
  格式（固定列宽/列顺序去 parse 纯文本），不能碰。
- `list` 仍然是只读扫描，不改任何 `manifest.json`。
- `.aes-workflow/grilling/` 目录不存在时的提示语「... 还不存在，没有任何 issue。」不变。
- manifest 损坏的行仍然显示 `(manifest 损坏)` 占位，不因为分组/筛选而崩溃或被吞掉。

## 配置差异

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| `--group` | 不存在 | 新增 flag，无值，出现即按 stage 分组 | 不传即不分组，无需迁移 |
| `--stage <阶段名>` | 不存在 | 新增 flag，值域 `1-interview` / `2-prototype` / `3-contract`，非法值报错退出 | 不传即不筛，无需迁移 |
| `--status <值>` | 不存在 | 新增 flag，本次只接受 `in_progress`（筛顶层 `manifest.status`） | 不传即不筛，无需迁移 |
