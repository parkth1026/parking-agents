# Goal Contract: session.mjs list 按 stage 分组展示，并支持按 stage/status 筛选

- Status: Ready
- Target: `.claude/skills/workflow-interview/scripts/session.mjs`（`cmdList`）
- Updated: 2026-08-13

## 原始请求

> session.mjs 的 list 命令现在把所有 issue 摊平打印成一张表，issue 一多就看不过来了。我想让它按 stage 分组显示，并且能加个筛选只看某个 stage 或者只看 in_progress 的。

## 目标

`session.mjs list` 能按 stage 分组展示 issue，并支持只看某个 stage 或只看 in_progress 的 issue；不加任何参数时行为逐字节保持不变。

## Why

- 用户是这套工具日常最重的使用者，issue 一多，现在摊平成一张长表就看不过来了，找不到自己该盯的那几个。
- 分组和筛选让他能快速定位「哪些还在哪个阶段」「哪些是自己正在推进的」。

## 范围

做：

- 新增 `--group`：按 `manifest.stage`（`1-interview` / `2-prototype` / `3-contract`）分组打印，
  组标题写明阶段名与该组条数，空组也打印标题。
- 新增 `--stage <阶段名>`：只保留匹配该阶段的 issue；传入非法阶段名报错退出。
- 新增 `--status in_progress`：只保留顶层 `manifest.status === 'in_progress'` 的 issue
  （排除 `ready`）。
- `--group` 与 `--stage`/`--status` 可以同时使用：先筛选再分组。
- 筛选（`--stage` 和/或 `--status`）命中 0 条时，显式打印一句提示，不能什么都不打印。

不做：

- 不改动 `list` 之外的任何子命令（`init`/`round`/`stage`/`verify`/`rebuild`/`finalize`）。
- 不新增排序方式，组内排序沿用现有的 slug 字典序。
- 不支持按阶段 gate 粒度（`stage_gates[stage].status`）筛选——`--status in_progress` 筛的是
  顶层 `manifest.status`，这两者字面同名但语义不同，本次只做前者（见「访谈记录」）。
- 不引入 JSON/TSV 等结构化输出模式，`list` 仍然是给人眼读的纯文本。
- 不新增 `--flat` 或其它「找回旧格式」的开关——因为不加参数的默认行为本来就没变，不需要
  找回的路径。

## 强约束

- **不加任何参数时，`list` 的输出必须和当前实现逐字节一致**：无表头、两空格分隔列、
  按 slug 字典序、列宽按当前批次数据动态对齐。用户本地有一个不在本仓库内的
  PowerShell 脚本靠这个固定格式 parse 输出，喂给他自己的一个提醒小工具——这个约束就是
  为了不动它。
- `2-prototype/behavior.md` 与 `2-prototype/example-run.md` 是确认版对照物，按其原文实现，
  不得在实现过程中改写这两份文件本身。
- `--stage` 的合法值只能是 `1-interview` / `2-prototype` / `3-contract`，与 `session.mjs`
  里已有的 `STAGES` 常量保持同一份真源，不得另起一套字符串。

## 自主边界

不用问，直接定：
- 具体 flag 解析方式（是否复用现有 `parseFlags`）、内部函数拆分、变量命名。
- 分组标题的具体文案措辞，只要清楚包含阶段名与条数即可（对照 `example-run.md` 的形态）。
- 「命中 0 条」提示语的具体措辞，只要清楚说明筛选条件产生了 0 条结果即可。

必须停下来问：
- 想再新增 `--status` 支持的取值（例如某个阶段的 gate 状态）——那是和本次「筛顶层
  manifest.status」不同语义的新功能，不在这份契约范围内。
- 想让默认（不加参数）输出发生任何变化——哪怕只是加一个空行或调整列宽算法，都要先确认
  用户本地脚本受不受影响。
- 想把 `list` 的输出改成结构化格式（JSON/TSV）——那会是新的对外契约，不是这次的范围。

## 读什么

- `../2-prototype/behavior.md`：变化行、不变清单、配置差异，逐条对应下面的验收条件。
- `../2-prototype/example-run.md`：每个场景的具体调用与期望输出，实现时按这份核对文本形态
  （分组标题格式、命中 0 条的提示语形态、非法值的报错文案形态）。

## 验收条件

- AC-001: 不加任何参数时，`list` 的输出和当前实现逐字节一致（无分组标题、无报错、三个
  已知 issue 全部列出）
  - Verify: [A] `node .claude/skills/workflow-interview/scripts/session.test.mjs` → 用例
    `list/AC-001 默认不加参数仍列出全部 3 个 issue` 与 `list/AC-001 默认不加参数没有分组标题行` 全绿
- AC-002: `--group` 按 stage 分组，组标题写明阶段名与条数，空组也打印标题
  - Verify: [A] `node .claude/skills/workflow-interview/scripts/session.test.mjs` → 用例
    `list/AC-002 --group 标题含阶段名与数量` 与 `list/AC-002 --group 空组仍打印标题` 全绿
- AC-003: `--stage <阶段名>` 只保留匹配该阶段的 issue，非法阶段名报错退出（非 0 退出码）
  - Verify: [A] `node .claude/skills/workflow-interview/scripts/session.test.mjs` → 用例
    `list/AC-003 --stage 只保留匹配阶段` 与 `list/AC-003 --stage 非法值报错退出非 0` 全绿
- AC-004: `--status in_progress` 只保留顶层 `manifest.status === 'in_progress'` 的 issue，
  排除 `ready`
  - Verify: [A] `node .claude/skills/workflow-interview/scripts/session.test.mjs` → 用例
    `list/AC-004 --status in_progress 排除已 ready 的 listC` 全绿
- AC-005: 筛选（`--stage`/`--status`）命中 0 条时，显式打印提示且退出码为 0
  - Verify: [A] `node .claude/skills/workflow-interview/scripts/session.test.mjs` → 用例
    `list/AC-005 命中 0 条时退出码为 0` 与 `list/AC-005 命中 0 条时显式打印提示` 全绿

## 访谈记录

### 第 1 轮（1-interview）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 「只看 in_progress」筛的是顶层 m.status 还是当前阶段 stage_gates[m.stage].status？ | A 筛顶层 status 55% / B 筛阶段 gate status 45% | A | A，按推荐 |
| 本仓库之外有没有别的工具依赖 list 当前的纯文本输出格式？ | A 没有 55% / B 有 45% | 无（纯事实调查） | B——用户本地有个不在仓库内的 PowerShell 脚本靠固定列宽/列序 parse 当前输出，喂给自己的提醒小工具 |
| 默认不加参数时的输出要不要保持完全一样？ | A 完全不变，新行为走新 flag 78% / B 默认切到分组、旧格式走 --flat 22% | A | A——就是为了不动那个本地脚本 |

没占提问、走默认区定下的条目：

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 分组维度用 manifest.stage | 默认 | manifest 里唯一的阶段字段，三值单选 | 未反对 |
| --stage 非法值报错退出而非静默忽略 | 默认 | 静默忽略会让用户误以为筛选生效了 | 未反对 |
| 组内排序沿用现有 slug 字典序 | 默认 | 复用现有行为，不引入新排序歧义 | 未反对 |

### 第 1 轮（2-prototype，对照物复核）

v1 草稿给用户看后，被翻掉两条默认写法：

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 分组标题必须显式写出阶段名与条数（如 `## 1-interview (2)`） | 确认 | v1 草稿已这么写，用户要求把它钉死成要求 | 确认，钉死 |
| 筛选命中 0 条必须显式打印提示，不能什么都不打印 | 确认 | v1 草稿场景 5 什么都不打印，用户认为会被误当成命令挂了 | 翻掉 v1 的写法，要求显式提示 |

v2 确认版（`behavior.md`、`example-run.md`）复核通过，无新意见。

## 设计取舍

本次无需取舍：`--group`/`--stage`/`--status` 是三个独立、局部可逆的新增 flag，彼此不冲突，
不存在需要二选一的实现路径。唯一的取舍点（默认行为要不要变）已经在访谈阶段问清并落进
「强约束」，不是留给实现阶段的开放选择。
