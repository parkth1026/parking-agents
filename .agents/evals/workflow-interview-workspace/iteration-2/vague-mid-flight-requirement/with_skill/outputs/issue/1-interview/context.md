# Context Snapshot: 2026-08-13-mid-flight-requirement-change

- 创建：2026-08-13T00:00:00Z
- 分片来源：无，宿主直接调查

## 任务陈述
帮我给 workflow-interview 加个功能，允许用户中途改需求。

## 用户提出的方案
未提出（用户只给了一句目标性描述，没有带具体设计）。

## 意图假设
用户是 workflow-interview 技能的作者本人。第一轮追问后确认：他脑子里的具体场景是
「访谈已问完、对照物已确认，进入 3-contract 阶段快收尾时，突然想追加一条新的验收
条件」——这比字面上的「中途改需求」窄得多。他自己也没有事先区分过「中途」指哪个
阶段、「改需求」是改哪一类东西。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 现有唯一的「回退」机制是 `needs_reinterview`：任何子技能报它时，`session.mjs` 无条件把 `manifest.stage` 与 `stage_gates['1-interview'].status` 重置为 `1-interview` / `in_progress`，不论调用方当时处于 `2-prototype` 还是 `3-contract` | `scripts/session.mjs:420-427` | Fact |
| `stage <dir> <stage> done` 的闸门不是一次性快照，是「现场重新校验」：每次调用都重新读盘上的 `contract.md`/`context.md`/`rounds.jsonl` 跑结构校验 | `scripts/session.mjs:266-303` | Fact |
| `3-contract done` 唯一要求：`manifest.validation.status === 'valid'` 且 `contract.md` 的 mtime 不晚于上次 `finalize` 的 `ran_at`。没有「只能跑一次」「done 之后不能再改」的限制——机制上可以在 `done` 之后继续编辑 `contract.md`、重跑 `finalize`、再跑一次 `stage 3-contract done`，闸门会照样通过 | `scripts/session.mjs:292-303, 386-392, 428-431` | Fact |
| `skipped` 只能用在 `2-prototype`；`1-interview`、`3-contract` 报 `skipped` 直接拒收 | `scripts/session.mjs:396-399` | Fact |
| `validate-goal-contract.mjs` 限制验收条件最多 7 条，超过直接 `ERROR` | `scripts/validate-goal-contract.mjs:130-132` | Fact |
| `aes-prototype` 自己的「迭代中暴露新材料歧义」流程，走的也是 `needs_reinterview` 打回 `aes-interview`——哪怕只是对照物层面的分歧，也没有「只回 2-prototype、不回 1-interview」这条更轻的路径 | `aes-prototype/SKILL.md:145-155` | Fact |
| `session.mjs` 没有除 `init/round/stage/verify/rebuild/finalize/list` 之外的子命令，没有「amend」「reopen」之类的命令 | `scripts/session.mjs:742-751` | Fact |
| `manifest.json` 的 `stage_gates[stage].status` 只有 5 个合法值（pending/in_progress/done/skipped/needs_reinterview），没有「已定稿锁定」这类独立字段区分「done 过一次」和「随时可再改」 | `scripts/session.mjs:26` | Fact |

## 验证基建候选池

- `node scripts/validate-goal-contract.mjs <contract.md>` — 现成，仓库既有结构校验器，退出码 0/1，跑一次几毫秒。代价：只验结构，不验语义。
- `node scripts/session.mjs finalize <issue-dir>` — 现成，结构校验 + `[A]` 档冒烟 + 交接闸门一次跑完。代价同上，且冒烟部分依赖契约里的 `[A]` 档命令是否可执行。
- `node scripts/session.test.mjs` — 现成，黑盒回归测试，`spawnSync` 真实调用 `session.mjs` 子命令断言退出码与盘上文件，是这个仓库验证 `session.mjs` 行为变更的既有方式。代价：新增用例要跟着它「只走进程边界」的约定写，不能 import 内部函数。
- 用户本人真实操作 — 没有除了这三个之外的用户可用测试基建；这次改动如果只是文档/流程说明，落不到自动化命令上的部分只能靠人读。

## 四分类

- **Fact**：现有 `needs_reinterview` 的行为与限制（无条件回退到 `1-interview`，且是唯一的回退机制）；`session.mjs` 的 `done` 闸门是现场重新校验而非一次性锁定，机制上已经允许「`3-contract done` 之后继续编辑并重跑」；`validate-goal-contract.mjs` 的 7 条 AC 上限。
- **User decision**：「中途」具体指哪个/哪些阶段的时点；「改需求」具体覆盖哪类动作（只是追加一条新 AC / 也包括改动或删除已定的 AC / 也包括改目标或范围本身）；新机制和现有 `needs_reinterview` 是什么关系（保留 `needs_reinterview` 不变、新增一条专门给「契约还没定稿时追加 AC」的更窄路径，还是这件事机制上已经够用、只欠文档把它写清楚）；新增/变更的 AC 涉及界面或行为差异时，要不要总是走（更重的）`needs_reinterview`，还是允许一个只回 `2-prototype`、不回 `1-interview` 的中间态。
- **Agent-owned**：文档写在哪个文件的哪一节、具体措辞、举不举例子——局部、可逆、不改变任何外部行为。
- **Blocked**：无。

## 决定边界未知项

用户是否接受「这件事机制上已经够用，只是没写清楚」这个结论，还是坚持要一个新的、显式的、专门为「3-contract 内追加一条 AC」设计的更窄状态（区别于现有只会退回 1-interview 的 `needs_reinterview`）。这一条决定契约最终范围里到底有没有代码改动。

## 未知项

- 用户是否真的用过、或设想过「新增 AC 涉及界面/行为差异，需要重新出对照物」这个子场景的具体触发频率——这跨出仓库边界，属于「必须问」。
