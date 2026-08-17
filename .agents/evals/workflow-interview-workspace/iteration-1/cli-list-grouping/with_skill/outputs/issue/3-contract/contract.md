# Goal Contract: session.mjs list 命令按 stage 分组并支持过滤

- Status: Ready
- Target: `.claude/skills/workflow-interview/scripts/session.mjs` 的 `cmdList` 函数（本仓库固定路径：`G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/workflow-interview/scripts/session.mjs`，这是 workflow-interview 技能自带的脚本，不随每个 issue 所在的 worktree 复制）
- Updated: 2026-08-11

## 原始请求

> session.mjs 的 list 命令现在把所有 issue 摊平打印成一张表，issue 一多就看不过来了。我想让它按 stage 分组显示，并且能加个筛选只看某个 stage 或者只看 in_progress 的。

## 目标

`session.mjs list` 能按 stage 分组展示、支持按 stage 或按当前阶段状态过滤，同时不加任何 flag 时的默认输出与现状完全一致。

## Why

- issue 一多，现有摊平表让人扫描不出重点，找不到自己此刻关心的那个 stage 或那批正在推进的 issue。
- 用户本机有一个仓库外的 PowerShell 脚本靠固定列宽/列顺序解析当前纯文本输出，喂给一个提醒工具——这是「不加 flag 时默认输出不能变」这条强约束的直接来源。

## 范围

做：为 `list` 命令新增三个可选 flag——`--group-by-stage`（按 stage 分组打印，分组标题带 stage 名与条数）、`--stage`（跟一个 stage 名称，只保留该 stage 的 issue）、`--status`（跟一个状态值，按当前 stage 的门状态过滤）；`--stage` 与 `--status` 可以同时给，取交集；过滤后命中 0 条时打印明确的「没有匹配项」提示并回显生效的筛选条件，退出码仍为 0；给出非法的 `--stage`/`--status` 取值时报错退出非 0。

不做：改变不加任何 flag 时的默认输出；新增 `--flat` 或任何「先改默认再提供退回」的方案（用户已明确要求默认不变，不是待权衡的取舍）；改动 slug/stage/status/goal 摘要之外的列或列宽；修改用户本机那个 PowerShell 脚本本身（不在本仓库内，不归这次改动管，是否要迁移它留给用户自己决定）；新建测试框架。

## 强约束

- 不加任何 flag 时，`session.mjs list` 的 stdout 必须与当前实现逐字节一致：同一张按 slug 字母序排序的等宽表格，四列 slug / stage / status / goal 摘要，不打印任何分组标题或「没有匹配项」提示。用户本机有一个仓库外、读不到源码的 PowerShell 脚本依赖这份格式（round 1 问出，见访谈记录）。仓库内没有自动化回归可以引用（这个脚本目录至今没有测试基建），执行 Agent 交付前必须手工核对：分别在改动前后各跑一次不带任何 flag 的 `node session.mjs list`，逐字节 diff 为空。
- `--stage` 与 `--status` 同时给出时取交集（AND）语义，不支持 OR。
- `--status` 读的是 `manifest.stage_gates` 里当前所在 stage 对应的门状态，不是顶层 `manifest.status`。
- 分组顺序固定为脚本里 `STAGES` 常量的顺序（`1-interview` → `2-prototype` → `3-contract`），组内保持现有的 slug 字母序。
- 空分组（该 stage 当前没有任何 issue）不打印分组标题。
- 确认版对照物 `../2-prototype/behavior.md`、`../2-prototype/example-run.md` 不得修改，执行 Agent 改的是 `session.mjs`，不是这两份对照表。

## 读什么

- `../2-prototype/behavior.md`：确认版行为对照表，含不变清单与配置差异，字段级裁决以它为准。
- `../2-prototype/example-run.md`：确认版可执行示例，命令怎么用、终端上看到什么以它为准。
- `scripts/session.mjs` 现有 `cmdList`（431-458 行）、`STAGES`/`STATUSES` 常量（25-26 行）、`blankManifest`（89-111 行，`stage_gates` 结构），改动前先读懂现有结构，不要另起一套解析。

## 验收条件

- AC-001: 加 `--group-by-stage` 时，`list` 按 stage 分组打印，分组标题同时标出 stage 名字与该组条数，分组顺序固定为 `1-interview → 2-prototype → 3-contract`，组内保持原有的 slug 字母序。
  - Verify: [A] `node "G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/workflow-interview/scripts/session.mjs" list --group-by-stage | findstr /R "^3-contract (1)$"` → 退出码 0（基于 `.aes-workflow/grilling/` 下当前唯一一个 issue 正处于 `3-contract` 阶段这一实际状态；命令能在改动前跑起来但找不到匹配，属预期的红）
- AC-002: 加 `--stage`（跟一个 stage 名称）时，只保留 `manifest.stage` 等于该值的 issue；过滤后命中 0 条时打印明确的「没有匹配项」提示并回显筛选条件，不是空输出。
  - Verify: [A] `node "G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/workflow-interview/scripts/session.mjs" list --stage 1-interview | findstr /C:"没有匹配项"` → 退出码 0（当前唯一 issue 处于 `3-contract`，不在 `1-interview`，应命中 0 条并打印提示）
- AC-003: 加 `--status`（跟一个状态值）时，按当前所在 stage 的 `stage_gates[该 stage].status` 过滤，不是顶层 `manifest.status`；过滤后命中 0 条时同样打印明确的「没有匹配项」提示。
  - Verify: [A] `node "G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/workflow-interview/scripts/session.mjs" list --status done | findstr /C:"没有匹配项"` → 退出码 0（当前唯一 issue 的 `stage_gates['3-contract'].status` 是 `in_progress`，不是 `done`，应命中 0 条并打印提示）
- AC-004: `--stage` 或 `--status` 给出不在合法取值集合里的值时，报错退出非 0，不静默当成 0 条处理。
  - Verify: [A] `node "G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/workflow-interview/scripts/session.mjs" list --stage not-a-real-stage & if errorlevel 1 (exit 0) else (exit 1)` → 退出码 0（外层复合命令仅在内层 `node` 命令确实以非零码报错时才成功，验证的是「报错」这个动作本身）

## 挡着的事

- None.

## 访谈记录

### 第 1 轮（1-interview）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 分组要不要成为默认输出？会不会有仓库外的东西依赖现在这张摊平表的格式？ | A 默认直接改为分组 30% / B 默认不变+新flag 25% / C 默认改分组+`--flat`退回 45% | C | **B**。用户当场想起本机有个不在仓库里的 PowerShell 脚本按固定列宽解析当前输出，喂一个提醒工具；明确要求「没加任何 flag 时默认输出不能变」 |
| 「只看 in_progress」筛的是顶层 `manifest.status` 还是当前 stage 的 `stage_gates[stage].status`？ | A 顶层 status 20% / B 当前 stage 门状态 55% / C 两者并集 25% | B | B（未反对推荐） |

被翻掉的第一条是**跨仓库边界的事**（仓库外有没有别的东西在消费这份输出），置信天然不可靠——下次改这份契约的人靠这行知道该重新验证什么：真去问了，答案确实和默认给的推荐不一样。

### 第 2 轮（2-prototype，draft 审阅回流）

| 轮次 | 用户意见 | 处理 |
| --- | --- | --- |
| draft v1 → v2 | 分组标题必须同时标出 stage 名字和条数，不能只写 stage 名字 | `behavior.md`/`example-run.md` 改为 `2-prototype (1)` 这种带条数的格式，已并入 AC-001 |
| draft v1 → v2 | 筛选命中 0 条不能是空输出，必须明确提示「没有匹配项」 | `behavior.md`/`example-run.md` 加回显筛选条件的提示语，已并入 AC-002/AC-003 |

这两条都是需求阶段问不出来的：用户看见具体的空表格草稿之前，不会意识到「什么都不打印」本身也是一种需要裁决的行为。draft v2 二次确认无新意见。

### 没占提问的条目

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 分组顺序沿用 `STAGES` 常量顺序 | 默认 | 仓库已定义好这个顺序，是自然的流程顺序 | 未反对 |
| 空分组不打印标题 | 默认 | 避免空表头制造噪音，纯展示层决定 | 未反对 |
| `--stage` 与 `--status` 取交集 | 默认 | 唯一直觉一致的组合语义 | 未反对 |
| 保留现有四列不变 | 默认 | 用户只要求分组和筛选，没要求改列 | 未反对 |
| `--status` 泛化为接受状态机任意值，不写死只认 `in_progress` | 默认 | 泛化几乎零成本，且不削弱用户点名要的用例 | 未反对 |
| 验证途径选 [A] 档：直接跑 CLI 断言 stdout/exit code，不新建测试框架 | 确认 | 这个脚本目录至今没有测试基建，跟仓库已有的验证惯例（`session.mjs verify` 自身）风格一致，成本最低 | 未反对 |

## 设计取舍

### D-1 分组要不要成为默认输出

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 默认直接改为分组 | 不加 flag 也分组 | 仓库外那个 PowerShell 脚本会直接解析失败，且是执行完才暴露 | 用户明确要求默认不变 |
| B（选定）默认不变，新增 `--group-by-stage` | 分组变成 opt-in | 日常要多记一个 flag | 无 |
| C 默认改分组但加 `--flat` 退回 | 两套渲染都留着 | 多维护一条渲染路径，而且本质上还是「改了默认」 | 用户的原话是「没加任何 flag 时默认输出不能变」，C 不满足这条硬性要求，不是可以用「留个退回选项」来打折的取舍 |

选定 B。理由：仓库外有一个读不到源码的 PowerShell 脚本依赖当前纯文本格式，这是访谈问出来之后才知道的事实，属于跨仓库边界、置信天然不可靠的那类决定，用户裁决之后就不再是可以事后靠灵活性挽回的工程取舍。落进契约的形态：`强约束` 写「不加任何 flag 时输出必须逐字节一致」。

### D-2 `--status` 过滤读哪个状态字段

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 读顶层 `manifest.status` | 实现最简单，字段现成 | 值域只有 `in_progress`/`ready` 两档，信息量少 | 用户在推荐项之间选了信息量更丰富的一个 |
| B（选定）读 `stage_gates[当前 stage].status` | 字段路径深一层 | 实现多几行 | 无 |

选定 B。理由：和「按 stage 分组」这个需求本身契合，同一份数据两处复用，信息量更丰富（`pending`/`in_progress`/`done`/`skipped`/`needs_reinterview` 五档，而不是顶层的两档）。落进契约的形态：`强约束` 写「`--status` 读 `stage_gates[当前 stage].status`，不是顶层 `manifest.status`」。
