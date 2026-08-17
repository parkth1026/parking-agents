# 行为对照表: 2026-08-13-workflow-interview-mid-flight-requirement-change

**确认版·锁定。** 执行 Agent 改的是产品（这里是 SKILL.md 文档），不是这份对照表。
用户确认：2026-08-13T00:30:00Z

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | 用户在 `3-contract` 阶段、`contract.md` 还未 `finalize`（`stage_gates['3-contract'].status` 是 `pending` 或 `in_progress`）时提出想加一条新验收条件 | `workflow-interview/SKILL.md` 只有「回退」一节讲 `needs_reinterview`，编排 Agent 容易把这当成唯一的「改需求」入口，误判要打回 `1-interview` | 编排 Agent 按新文档直接留在 `aes-goal-contract` 的第 2 步继续迭代：把新条件当一条新的候选 AC，走「逐条带候选、批量提问」流程，`round` 追加进 `rounds.jsonl`，不触发 `needs_reinterview`，也不碰 `1-interview` |
| 2 | 用户在 `contract.md` 已经 `finalize` 通过（`manifest.status = ready`，`stage_gates['3-contract'].status = done`）、且尚未把交接指令发给执行 Agent 时，提出想加一条新验收条件 | 无文档路径；`session.mjs stage` 命令本身允许把 `done` 的阶段重设为 `in_progress`，但没有任何 SKILL.md 提到这个用法，编排 Agent 大概率会犹豫要不要新开一个 issue | 编排 Agent 按新文档执行：`node session.mjs stage <issue-dir> 3-contract in_progress` 把阶段重开，回到 `aes-goal-contract` 改 `contract.md`（同一份文件，不新建），改完重新跑 `node session.mjs finalize <issue-dir>` |
| 3 | 中途提出的诉求是「修改」或「删除」一条已确认的 AC，而不是单纯「追加」 | 无区分说明 | 与「追加」走同一条路径：都是回改 `contract.md` 再 `finalize`；删除某条 AC 时编号不补位（`goal-contract-shape.md` 既有规则），修改时编号不变、只改内容 |
| 4 | 中途新增的验收条件涉及可观察差异（界面/行为/接口报文/可运行输出/配置/兼容性任一项） | 无文档路径，容易被跳过对照物这一步直接写进契约 | 编排 Agent 先回 `aes-prototype`，只对**这一条新增内容**套用既有的六面影响面判据出增量对照物（不必重新走全部对照物），确认后再回 `aes-goal-contract` 把它聚成 AC；六面判据全为「无」（纯文字性质，例如补一句边界说明）时不触发这一步，直接在 `aes-goal-contract` 里问清并落盘 |

## 不变清单

- `needs_reinterview` 的触发条件与语义不变：仍然只用于「子技能撞出新歧义、需要重新问」的场景，不被这次新增的「中途改需求」路径取代或覆盖。
- `session.mjs` 的子命令集合不变：`init` / `round` / `stage` / `verify` / `rebuild` / `finalize` / `list` 七个，不新增第八个。
- `manifest.json` 的 `schema_version`（当前为 `1`）与既有字段不变，不新增版本号或变更历史字段。
- `validate-goal-contract.mjs` 的全部校验规则不变，包括 AC 编号连续性规则（新增 AC 只能追加到末尾编号，删除不补位）。
- 已经在跑的其它 issue 目录（`rounds.jsonl` / `context.md` / `contract.md` 既有内容）不受这次文档改动影响，不需要迁移。
