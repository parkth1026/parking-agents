<!-- draft v1 | published 2026-08-13T00:10:00Z
     用户意见：待收集
     状态：superseded by v2 -->

# 行为对照表: 2026-08-13-cli-list-grouping (draft v1)

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | `session.mjs list`（无 flag），issue 目录下有多个不同 stage 的 issue | 一张摊平的表，按 slug 字母序，四列：slug / stage / status / 摘要 | 不变（见下方不变清单） |
| 2 | `session.mjs list --stage 2-prototype` | 无此参数，报「用法：...」 | 按 stage 分组打印，只输出 `2-prototype` 这一组 |
| 3 | `session.mjs list --status in_progress` | 无此参数 | 按 stage 分组打印，每组内只保留 `manifest.status === 'in_progress'` 的 issue |
| 4 | `session.mjs list --stage 3-contract --status in_progress`，但没有任何 issue 同时满足 | 无此参数 | 提示没有匹配项，不打印任何表格 |
| 5 | `session.mjs list`（无 flag），issue 目录下全部 issue 都在同一个 stage | 一张摊平的表 | 分组仍按 stage 分，只是此时只会出现一组 |

## 不变清单

- 不带任何 flag 时，`list` 的输出（列、列宽、列序、每行文本、排序）必须和现状字节级一致。用户有一个仓库外的 PowerShell 脚本靠固定列宽/列顺序解析这段输出，喂给他自己的提醒工具；这个脚本不在这个仓库里，改了它我们看不见它崩，只能靠不改默认输出这条线来保护它。
- `manifest.json` 的读取方式、字段含义不变；这次改动只动 `cmdList` 的展示逻辑，不碰 `stage`/`round`/`finalize` 等其它子命令。
- manifest 损坏时的现有降级行为（打印 `(manifest 损坏)` 那一行，不中断整个命令）保留。

## 配置差异

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| `--stage` | 不存在 | 新增，值必须是 `1-interview`/`2-prototype`/`3-contract` 之一，否则报错退出（复用 `cmdStage` 的校验风格） | 无需迁移，新增可选项 |
| `--status` | 不存在 | 新增，值对齐 `manifest.status`，取值 `in_progress`/`ready`，否则报错退出 | 无需迁移，新增可选项 |
