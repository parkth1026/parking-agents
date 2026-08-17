# 行为对照表: 2026-08-13-cli-list-grouping

**确认版·锁定。** 执行 Agent 改的是产品，不是这份对照表。
用户确认：2026-08-13T00:25:00Z

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | `session.mjs list`（无 flag） | 一张摊平的表，按 slug 字母序，四列：slug / stage / status / 摘要 | 不变，字节级一致（见不变清单） |
| 2 | `session.mjs list --stage 2-prototype`，该 stage 下有 2 条 issue | 无此参数 | 打印一个分组标题 `== 2-prototype (2) ==`，紧跟这 2 条 issue 的表格行（列同现状），按 slug 字母序 |
| 3 | `session.mjs list --status in_progress`，跨多个 stage 都有命中 | 无此参数 | 按 STAGES 常量顺序（1-interview → 2-prototype → 3-contract）逐组打印 `== <stage> (<组内命中数>) ==`，组内只保留 `status === 'in_progress'` 的行；命中数是过滤后的数字，不是该 stage 的总数 |
| 4 | `session.mjs list --stage 3-contract --status in_progress`，没有任何 issue 同时满足 | 无此参数 | 不打印任何分组或表格，改打印一行：`没有匹配项（--stage=3-contract --status=in_progress）。` |
| 5 | `session.mjs list --stage 2-prototype`，该 stage 下 0 条 issue | 无此参数 | 同上，打印 `没有匹配项（--stage=2-prototype）。`（只带用户实际传的 flag） |

## 不变清单

- 不带任何 flag 时，`list` 的输出（列、列宽、列序、每行文本、排序）必须和现状字节级一致。用户有一个仓库外的 PowerShell 脚本靠固定列宽/列顺序解析这段输出，喂给他自己的提醒工具；这个脚本不在这个仓库里，改了它我们看不见它崩，只能靠「不改默认输出」这条线来保护它。
- `manifest.json` 的读取方式、字段含义不变；这次改动只动 `cmdList` 的展示逻辑，不碰 `stage`/`round`/`finalize` 等其它子命令。
- manifest 损坏时的现有降级行为（打印 `(manifest 损坏)` 那一行，不中断整个命令）保留。分组视图下，`m.stage` 读不出来的这类行归进单独一组 `(未知 stage)`，排在 STAGES 三组之后；这条不影响任何正常 issue 的分组结果，属于执行 Agent 可自行决定的实现细节。

## 配置差异

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| `--stage` | 不存在 | 新增，值必须是 `1-interview`/`2-prototype`/`3-contract` 之一，否则报错退出（复用 `cmdStage` 的校验风格），退出码 2 | 无需迁移，新增可选项 |
| `--status` | 不存在 | 新增，值对齐 `manifest.status`，取值 `in_progress`/`ready`，否则报错退出，退出码 2 | 无需迁移，新增可选项 |
