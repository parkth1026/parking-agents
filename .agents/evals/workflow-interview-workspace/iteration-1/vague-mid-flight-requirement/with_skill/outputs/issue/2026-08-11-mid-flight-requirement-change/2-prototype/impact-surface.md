# Impact Surface: 2026-08-11-mid-flight-requirement-change

判据：改完之后，这个程序在哪些地方跑起来不一样了？每一处不一样，谁会看见、谁会受影响？

范围（继承自 1-interview 收口结果）：只在 `aes-goal-contract/SKILL.md` 与
`workflow-interview/SKILL.md` 补两处决策规则文字，说明"契约未定稿前追加验收条件"
这条既有路径，划清它和 `needs_reinterview`、"契约定稿后回原契约重做"之间的边界。
不新增 `session.mjs` 命令、子命令或 `status`，不改任何可执行代码。

| 影响面 | 有/无 | 具体差异 | 谁受影响 | 出什么对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | 无 | 改动的是两份 SKILL.md 的正文说明，不是任何程序界面；没有 mock.html、终端 UI、网页要出 | — | 无需 `mock.html` |
| 可观察行为 | **有** | 同样"契约还没定稿、用户想追加一条新验收条件"这个输入场景，**编排/子技能读到的指导文字变了**：改前这条路径虽然技术上已被 `aes-goal-contract/SKILL.md:137` 覆盖，但没有被点名，容易被误当成材料歧义走 `needs_reinterview`（整体回退到 `1-interview`）；改后 SKILL.md 会显式给出三档决策规则，明确这种情况留在 `3-contract` 当前提问区继续问，不触发回退。这是"给执行 Agent 看的指导文字"层面的可观察行为差异，用 `behavior.md` 的对照表记录 | 后续所有调用 `workflow-interview`/`aes-goal-contract` 的 Agent（包括未来重跑本次这类场景的自己） | `behavior.md` |
| 可运行输出 | 无 | `session.mjs` 任何子命令的终端输出格式、退出码、日志内容都不变（没有改代码） | — | 无需 `example-run.md` |
| 对外接口报文 | 无 | 没有 HTTP/RPC 接口，`session.mjs` 也不是被改动对象 | — | 无需 `api-mock.md` |
| 用户配置 | 无 | 不涉及配置文件、环境变量、命令行参数的新增或改动 | — | 并入 `behavior.md` 的"配置差异"节，整节省略 |
| 历史兼容性 | 无（但是本次的核心不变量） | `needs_reinterview` 现有语义（触发后一律回退到 `1-interview`）不变；`session.mjs` 的 `STATUSES`/`STAGES`/所有子命令签名不变；`rounds.jsonl`、`manifest.json` 的 schema 不变；"改已确认对照物"或"改目标/边界"仍然按现状走 `needs_reinterview`，本次不动 | 依赖这些既有行为的其它 issue、其它子技能 | 并入 `behavior.md` 的"不变清单"节 |

## 结论

六面里五面为"无"，一面（可观察行为）为"有"。这不是"六面全否需要报
`needs_reinterview`"的情况：确实存在一处可观察差异（Agent 在特定场景下的决策路径），
只是差异体现在"指导文字"而非"可执行产品"层面。出一份 `behavior.md`，用对照表记录
"同一场景，改前 vs 改后 Agent 应该怎么做"，并把"哪些现状必须保持不变"写进不变清单。

不出 `mock.html`（无界面）、`api-mock.md`（无接口）、`example-run.md`
（`session.mjs` 本身运行时输出不变，不需要单独的可执行示例——`behavior.md` 的对照表
已经把"输入场景 → 期望响应"讲清楚，另出一份会和 behavior.md 重复同一件事）。
