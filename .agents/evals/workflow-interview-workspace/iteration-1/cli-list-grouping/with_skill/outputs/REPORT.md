# REPORT: workflow-interview 实跑记录 — cli-list-grouping

## 基本信息

- **Issue slug**: `2026-08-11-session-list-grouping`
- **Issue 目录**（原始，位于 worktree 内）：
  `G:\GIT\AI_WorkFlow\parking-agents\.claude\worktrees\agent-adf2c45da2c7b6aed\.aes-workflow\grilling\2026-08-11-session-list-grouping`
- **本目录下的复制件**：`./issue/`（1-interview / 2-prototype / 3-contract / manifest.json 全量复制）
- **目标文件（真实改动对象）**：
  `G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\workflow-interview\scripts\session.mjs` 的 `cmdList` 函数
  （这份脚本是 workflow-interview 技能自带的，不随 issue 所在的 worktree 复制，因此契约里的
  Verify 命令用绝对路径指向它）
- **docs/goal-contracts/**：本次运行没有产物写到这个目录——workflow-interview 的约定是契约落在
  issue 自己的 `3-contract/contract.md` 下，不使用 `docs/goal-contracts/`（那是另一个技能
  `aes-grilling` 的约定）。因此 `./goal-contracts/` 目录本次为空。

## 最终状态

| Stage | 状态 |
| --- | --- |
| 1-interview | done（五个自评维度：意图/结果/边界/约束/现状 全部「已定」） |
| 2-prototype | done（产出 `behavior.md`、`example-run.md`，均为二次确认版） |
| 3-contract | done |

`manifest.status`: `ready`（三阶段全部关闭）。

## Contract.md 路径

`./issue/3-contract/contract.md`
（原路径：`...\.aes-workflow\grilling\2026-08-11-session-list-grouping\3-contract\contract.md`）

## Finalize 校验结果

```
AC_COUNT: 4
VALID: ...\3-contract\contract.md
```

- **结构校验**：`valid`（`validate-goal-contract.mjs` 退出码 0，无 ERROR，无 WARNING）
- **[A] 档冒烟**：绿 **0** / 红 **4** / 跑不起来 **0**
  - 四条 AC 的 Verify 命令都能真实执行（不是 UNRUNNABLE），且全部按预期返回失败——
    这是正确的结果：功能还没实现，冒烟应该全红，不是全绿，也不该是"跑不起来"。
  - 详见 `./issue/3-contract/verify.txt`。

`finalize` 命令本身以退出码 0 结束（结构有效 + 无 UNRUNNABLE + 交接指令未超字符上限）。

## 访谈总共问了几轮

按 `stage` 划分（都记在同一份 `1-interview/rounds.jsonl` 里，用 `stage` 字段区分）：

- **1-interview 阶段，第 1 轮**：8 条记录——5 条默认区（一行定，未反对）、1 条确认区
  （验证途径选 [A] 档直接跑 CLI）、**2 条提问区（Q1、Q2，同一轮内批量问出，不是挤牙膏）**。
- **2-prototype 阶段**：draft v1 展示给用户后，收到 2 条确认区意见（分组标题要带条数、
  0 条命中要有明确提示），改成 v2 后二次确认无新意见。
- **3-contract 阶段**：契约摘要展示后 1 条确认区记录（用户确认契约表达了共同理解）。

全程没有触发 `needs_reinterview`——两轮问题一次收口，没有回退。

## 每一轮问了什么关键问题

### 1-interview 第 1 轮

- **Q1（跨仓库边界，必问）**：分组要不要成为 `list` 的默认输出？会不会有仓库外的东西
  依赖现在这张摊平表的纯文本格式（列宽/列序）？
  候选：A 默认直接改分组 30% / B 默认不变+新 flag 25% / **C（推荐）默认改分组+`--flat`
  退回 45%**。
  **人设的回答直接被问出了藏着的事实**：用户想起自己本机有一个不在仓库里的 PowerShell
  脚本，靠固定列宽/列顺序解析 `session.mjs list` 的纯文本输出，喂给一个提醒小工具；
  明确要求"没加任何 flag 时，list 的默认输出不能变，除非双方明确谈好迁移"。
  最终用户选 **B**，推翻了访谈时给出的推荐项 C（`overturned_recommendation: true`，
  `cross_repo_boundary: true`，两个字段都写进了 `rounds.jsonl`）。

- **Q2**：「只看 in_progress」筛的是顶层 `manifest.status`，还是当前 stage 的
  `stage_gates[stage].status`？候选：A 顶层 20% / **B（推荐）当前 stage 门状态 55%** /
  C 并集 25%。用户选推荐项 B（未反对推荐）。

### 2-prototype（draft 审阅回流，记为确认区条目而非新提问区）

看完 draft v1 的 `behavior.md`/`example-run.md` 后，用户提出两条意见：
1. 分组标题必须同时标出 stage 名字**和条数**，不能只写 stage 名字；
2. 筛选命中 0 条**不能是空输出**，必须打印明确的"没有匹配项"提示。

改成 v2（分组标题变成 `2-prototype (1)` 这种格式；0 条命中打印"没有匹配项：<回显
筛选条件>"）后，用户二次确认无新意见。

### 3-contract

展示契约摘要（目标/范围/强约束/4 条 AC/挡着的事），用户确认"可以，这就是我要的"，
无异议，直接落盘并跑 `finalize`。

## 人设在什么问题下透露了什么信息（重点）

**有没有被问到"有没有别的东西依赖这个命令的输出格式"这类问题：有，而且是本次访谈
唯一一条跨仓库边界的必答题（Q1）。**

Q1 明确以"会不会有仓库外的东西依赖现在这张摊平表的纯文本格式（列宽/列序）？"作为
问题原文提出。已知事实部分诚实写明：仓库内 grep 不到任何消费者，但这只覆盖仓库内，
仓库外读不出来，必须问用户。

人设在这个问题被问到的**当下**才透露：本机有一个不在这个仓库里的 PowerShell 脚本，
靠固定列宽/列顺序解析 `session.mjs list` 的纯文本输出，喂给一个提醒小工具；不确定
要不要现在就迁移它，把决定权交给 Agent；但态度明确——"没加任何 flag 时，list 的
默认输出不能变，除非咱俩明确谈好要不要迁移"。

这条事实被完整写进：
- `1-interview/context.md`「术语冲突」「未知项（round 1 已收口）」两节；
- `1-interview/rounds.jsonl` 第 7 行（Q1 整条记录，含 `user_verbatim` 原话、
  `overturned_recommendation: true`、`cross_repo_boundary: true`）；
- `3-contract/contract.md` 的「强约束」第一条、「访谈记录」第 1 轮表格、
  「设计取舍」D-1。

这条事实直接决定了契约的核心强约束（默认输出逐字节不变）与设计取舍 D-1
（拒绝了访谈初期置信最高的推荐项 C），是这次跑通全程里唯一一条"如果没问出来，
契约会做错方向"的信息。

## behavior.md / example-run.md 改前改后对照要点

（完整内容见 `./issue/2-prototype/behavior.md` 与 `./issue/2-prototype/example-run.md`；
草稿版本在 `./issue/2-prototype/drafts/`）

- **不变**：不加任何 flag 时，输出与现状逐字节一致——同一张按 slug 字母序排的等宽表格，
  四列 slug/stage/status/goal 摘要，不分组、不过滤、不打印任何新提示语。这是给用户
  那个 PowerShell 脚本兜底的行为，两次审阅都没变过。
- **变化 1**：加 `--group-by-stage` 后按 `1-interview → 2-prototype → 3-contract`
  顺序分组打印；v2 起分组标题带条数，如 `2-prototype (1)`（v1 只有 stage 名，被用户
  打回）。
- **变化 2**：加 `--stage`（单个 stage 名）和/或 `--status`（当前 stage 的门状态值，
  非顶层 `manifest.status`）过滤，二者同给时取交集。
- **变化 3（边界值，v2 新增）**：过滤后命中 0 条时打印"没有匹配项：<回显生效的筛选
  条件>"，退出码仍为 0（是一次成功的空查询，不是错误）；与"目录里压根没有任何 issue"
  的提示语是两句不同的话，不共用。
- **变化 4（边界值）**：`--stage`/`--status` 给出非法取值时报错退出非 0，不静默当成
  0 条处理。

## Baseline 对比（供参考）

`.../cli-list-grouping/without_skill/outputs/` 下已有一份先前跑的 baseline
（无技能编排的直接实现产物），本次任务未要求逐项对比，未展开分析；仅供后续横向
评测时引用。
