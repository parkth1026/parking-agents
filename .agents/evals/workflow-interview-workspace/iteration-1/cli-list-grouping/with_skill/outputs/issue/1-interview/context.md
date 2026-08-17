# Context Snapshot: 2026-08-11-session-list-grouping

- 创建：2026-08-11T00:00:00Z
- 分片来源：无，宿主直接调查（改动面小，未派 subagent）

## 任务陈述
session.mjs 的 list 命令现在把所有 issue 摊平打印成一张表，issue 一多就看不过来了。我想让它按 stage 分组显示，并且能加个筛选只看某个 stage 或者只看 in_progress 的。

## 用户提出的方案
- 按 stage 分组显示
- 加筛选：只看某个 stage，或者只看 in_progress 的

未提出具体的 CLI 参数形态（flag 名、是否默认开启分组）。

## 意图假设
issue 目录一多之后，`list` 摊平成一张长表，用户扫描一个特定 stage 或者只关心正在
推进（in_progress）的 issue 时要在噪音里找目标行。真正要解决的是「按当前关心的
维度快速定位」，不是单纯的排版美化——分组本身、筛选本身都是达到这个目的的手段，
不是目的。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| `cmdList()` 现状：扫 `.aes-workflow/grilling/` 下每个含 `manifest.json` 的子目录，取 `slug/stage/status/goal_oneline或original_request前40字`，按 slug 字母序排序后打印等宽表 | `scripts/session.mjs:431-458` | Fact |
| `manifest.stage` 取值恰为三个阶段之一：`1-interview`/`2-prototype`/`3-contract`（`STAGES` 常量） | `scripts/session.mjs:25` | Fact |
| `manifest.stage_gates[stage].status` 取值集合：`pending`/`in_progress`/`done`/`skipped`/`needs_reinterview`（`STATUSES` 常量）；顶层 `manifest.status` 另有 `in_progress`/`ready` | `scripts/session.mjs:26,109,233` | Fact |
| 顶层打印用的 `status` 列实际读的是 `manifest.status`（整个 issue 的总状态：`in_progress`/`ready`），不是某个 stage_gate 的状态；用户说的「只看 in_progress 的」在现有数据模型里可能指顶层 `status`，也可能指当前 `stage` 对应 `stage_gates[stage].status` | `scripts/session.mjs:443` | Fact，与「决定边界未知项」有关 |
| `list` 是唯一的跨 issue 全局视图，"现扫不落盘"（`workflow-interview` SKILL.md 明确写明） | `SKILL.md:66-70`（workflow-interview） | Fact |
| 本仓库（`.claude/skills/workflow-interview` 及其脚本）目前没有任何自动化测试文件、没有 package.json，`evals/evals.json` 是这个技能自己的 eval 场景库，不是单元测试 | 目录扫描 `scripts/`、`evals/` | Fact |
| 仓库顶层（另一个不相关的 `parking-skills` 项目，位于 worktree 根 `package.json`）有 `npm test`，但它跑的是 `tests/` 下针对 `skills/`、`hooks/`、`.pi/` 的检查，跟 `.claude/skills/workflow-interview/scripts/session.mjs` 完全不搭界，不适用 | `package.json:9`（worktree 根） | Fact |
| `session.mjs verify`/`finalize` 已经是这个仓库对「验证途径」的既有惯例：从 contract.md 的 `[A]` 档 Verify 抽反引号命令，`spawnSync` 真跑一遍，按退出码判定 green/red/unrunnable | `scripts/session.mjs:246-324` | Fact |
| 仓库内（`.claude/skills/**`）没有找到任何脚本调用 `session.mjs list` 并解析其输出（grep 全仓库只命中文档/说明性引用，没有消费者代码） | grep `session\.mjs list\|cmdList` | Fact（**仅覆盖仓库内**，仓库外是否有消费者读不出来，见「未知项」） |

## 验证基建候选池

这个脚本本身就是「验证基建」的实现者（`session.mjs verify` 靠反引号命令真跑 CLI），
但它自己没有被别的测试框架覆盖。可选途径：

1. **直接跑 CLI 命令断言 stdout/exit code**（`[A]` 档，反引号命令）——代价：需要
   在验证时机造出几个不同 stage/status 的 issue 目录作为夹具（fixture），或者复用
   本次访谈自己产生的 issue 目录本身当活体夹具；仓库里已有先例（`session.mjs verify`
   自己就是这么验证 contract 的），跟这个脚本的既有风格一致，代价最低。
2. **新建单元测试框架**（如 node:test）——代价：这个脚本目录至今没有引入任何测试
   框架，新增等于给一个 300 行小工具脚本另起一套基建，成本明显超过收益。
3. **用户手动跑一遍肉眼看**——代价：不可重复，不能进 CI/finalize 冒烟。

结论倾向途径 1，与 `aes-goal-contract` 阶段的 `[A]` 档惯例天然吻合。

## 术语冲突

用户说的「in_progress」在数据模型里可能对应两处不同字段：
- `manifest.status`（整个 issue 的总状态，目前只有 `in_progress`/`ready` 两个值，
  `list` 现在打印的就是这个）
- `manifest.stage_gates['<某 stage>'].status`（该 stage 的门状态，值域更大：
  `pending`/`in_progress`/`done`/`skipped`/`needs_reinterview`）

两者都存在名为 `in_progress` 的状态，但含义不同（前者是"这个 issue 整体还没
ready"，后者是"这个具体 stage 正在推进中"）。这个歧义会改变筛选逻辑该读哪个
字段，必须问清楚，已列入决定边界未知项 / 提问区。

## 四分类

- **Fact**：现有 `cmdList` 实现、`STAGES`/`STATUSES` 常量、`list` 是现扫不落盘、
  仓库内没有已知消费者代码、既有验证途径惯例。
- **User decision**：
  1. 分组显示是否作为默认行为直接改变现有输出，还是需要新 flag 开启、保留旧默认
     以防外部消费者依赖现有纯文本格式（跨仓库边界，读不出来，见未知项）。
  2. 「只看 in_progress」筛选的语义读 `manifest.status` 还是 `stage_gates[stage].status`。
  3. 筛选是否泛化为 `--status <任意值>`，还是严格只做用户点名的 in_progress 这一种。
- **Agent-owned**：分组内排序（沿用现有字母序）、分组顺序（沿用 `STAGES` 常量顺序）、
  空分组是否打印标题、CLI flag 的具体命名（如 `--stage`/`--status`）、列宽计算方式、
  --stage 与 --status 同时给出时是否取交集（AND，这是唯一合理语义，无需占用提问）。
- **Blocked**：无。

## 决定边界未知项

- 「只看 in_progress」到底筛的是 `manifest.status` 还是当前 stage 的
  `stage_gates[stage].status`——已在 round 1 Q2 问清，用户选 B：
  筛 `stage_gates[当前 stage].status`。

## 未知项（round 1 已收口）

- 仓库外是否有别的工具/脚本依赖 `list` 现有的纯文本输出格式（列宽、列顺序、
  分隔符）去解析。round 1 Q1 问出：用户本机有一个不在本仓库内的 PowerShell
  脚本，靠固定列宽/列顺序解析 `session.mjs list` 纯文本输出，喂给一个提醒
  小工具。用户明确要求：**没加任何 flag 时，list 的默认输出行为不能变**，
  除非双方明确谈好迁移。round 1 采纳用户选择 B（默认不变，新增
  `--group-by-stage` 类 flag 才切到分组视图），推翻了访谈时给出的推荐项 C
  （45%，默认改为分组 + `--flat` 退回）——这是一条典型的「仓库外证据，
  高置信度不可信」案例，写进这里供下次改这份契约的人参考。

## 收口结论

两轮问题（Q1 跨仓库边界的输出兼容性、Q2 状态字段语义）都已由用户裁决，
五个自评维度（意图/结果/边界/约束/现状）均为「已定」，进入 `aes-prototype`。
