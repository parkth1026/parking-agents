# 行为对照表: 2026-08-13-cli-list-grouping

**确认版·锁定。** 执行 Agent 改的是产品，不是这份对照表。
用户确认：2026-08-13T00:40:00Z

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | `session.mjs list`（不加任何参数），3 个 issue | 摊平单表，逐行 `slug  stage  status  goal摘要`，按 slug 字典序 | 逐字节不变——和「现在的行为」完全一样 |
| 2 | `session.mjs list --group`，3 个 issue（2 个在 1-interview，1 个在 2-prototype，0 个在 3-contract） | （新参数，现在不存在） | 按 stage 分桶，每桶一个标题行**必须写出 stage 名字与该组条数**（如 `## 1-interview (2)`），桶内保持 slug 字典序；没有 issue 的桶仍打印标题行加 `(0)`，不隐藏空桶——用户要能一眼看出「这个阶段现在空着」而不是被漏了 |
| 3 | `session.mjs list --stage 1-interview` | （新参数，现在不存在） | 只保留 `manifest.stage === '1-interview'` 的行，摊平打印（不分组，除非同时加 `--group`） |
| 4 | `session.mjs list --stage bogus`（非法阶段名） | （新参数，现在不存在） | 报错退出，非 0 退出码，不打印任何 issue 行 |
| 5 | `session.mjs list --status in_progress` | （新参数，现在不存在） | 只保留顶层 `manifest.status === 'in_progress'` 的行；当前几乎所有未 ready 的 issue 都会命中 |
| 6 | `session.mjs list --stage 1-interview --status in_progress` | （新参数，现在不存在） | 两个筛选条件取交集（AND） |
| 7（边界） | `session.mjs list --stage 3-contract`，没有任何 issue 处于 3-contract | （新参数，现在不存在） | 命中 0 条：**必须显式打印一句提示**（形如 `没有匹配项（--stage 3-contract）`），不能什么都不打印——用户会把「无输出」误当成命令挂了或参数打错 |
| 8（边界） | `session.mjs list --group --stage 1-interview`（分组与筛选同时使用） | （新参数，现在不存在） | 先筛选再分组：只有命中筛选条件的 issue 才会出现在分组视图里；某个 stage 桶因筛选而空时仍按 #2 打印 `(0)` 标题行 |

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
| `--group` | 不存在 | 新增 flag，无值，出现即按 stage 分组，空 stage 也打印标题行 | 不传即不分组，无需迁移 |
| `--stage <阶段名>` | 不存在 | 新增 flag，值域 `1-interview` / `2-prototype` / `3-contract`，非法值报错退出 | 不传即不筛，无需迁移 |
| `--status <值>` | 不存在 | 新增 flag，本次只接受 `in_progress`（筛顶层 `manifest.status`，不是阶段 gate 的 status） | 不传即不筛，无需迁移 |
