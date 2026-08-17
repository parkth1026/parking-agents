# Impact Surface: 2026-08-13-workflow-interview-mid-flight-requirement-change

判据：改完之后，这个程序在哪些地方跑起来不一样了？每一处不一样，谁会看见、谁会受影响？

这次改动的落点是三份 SKILL.md 文档（`workflow-interview/SKILL.md`、
`aes-goal-contract/SKILL.md`，视写作情况可能加一份 `references/` 说明），**不改
`session.mjs` 任何代码**——这是 1-interview 阶段用户在提问区 Q1/Q2 选定的边界（复用
现有命令，不新增脚本子命令）。

| 影响面 | 有/无 | 差异 | 谁受影响 | 出什么 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | 无 | 没有任何 GUI/HTML；SKILL.md 是给 Agent 读的编排文字，不是用户界面 | — | 不出 `mock.html` |
| 可观察行为 | **有** | 编排 Agent（读 workflow-interview/aes-goal-contract 的那个 Agent）在「用户中途提出新验收条件」这个场景下，行为路径从「未定义/可能误用 needs_reinterview 整体回退」变成「按覆盖窗口分流：finalize 前直接在 3-contract 内迭代，finalize 后用现有 `session.mjs stage` 命令重开该阶段，都不碰 1-interview」 | 使用 workflow-interview 的所有后续调用者（包括未来的我自己） | `behavior.md` |
| 可运行输出 | **有**（附属于行为差异） | `session.mjs stage <dir> 3-contract in_progress` 这条命令本身不是新命令，但被赋予了一个新的合法用法（把已 `done` 的阶段重开），终端输出会显示 `3-contract → in_progress；当前阶段 3-contract` | 直接跑该命令的人/Agent | `example-run.md` |
| 对外接口报文 | 无 | 没有 HTTP/RPC 接口，`session.mjs` 是本地 CLI，不涉及网络报文 | — | 不出 `api-mock.md` |
| 用户配置 | 无 | 不新增命令行参数、环境变量或配置文件字段；`manifest.json` schema 不变（`schema_version` 仍是 1） | — | 写进 `behavior.md` 的不变清单 |
| 历史兼容性 | 无变化（需明确保留） | 现有 `needs_reinterview` 语义、`session.mjs` 全部子命令、`validate-goal-contract.mjs` 校验规则、既有 issue 目录的 `rounds.jsonl`/`context.md`/`contract.md` 格式都不受影响——这次只加文字说明和一种「已经合法但没被文档提到」的用法 | 所有已经在跑的 issue 目录 | 写进 `behavior.md` 的不变清单 |

## 结论

六面里「可观察行为」为「有」，「可运行输出」作为它的附属证据一起出。其余四面「无」，
其中「历史兼容性」的「无变化」本身就是一条要向用户/执行 Agent 保证的不变量，写进
`behavior.md` 不变清单而不是略过。

只出 `behavior.md` 与 `example-run.md` 两份确认版对照物，不出 `mock.html` / `api-mock.md`。
