# Impact Surface: 2026-08-11-session-list-grouping

判据：改完之后，`session.mjs list` 在哪些地方跑起来不一样了？每一处不一样，谁会看见、谁会受影响？

| 影响面 | 有/无 | 差异 | 谁受影响 | 出什么 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | 无 | 这是纯 CLI 工具，没有 GUI/HTML 界面；终端输出本身归入「可运行输出」一面 | — | 不出 mock.html |
| 可观察行为 | 有 | 同样的 issue 数据集，加不加 `--group-by-stage`/`--stage`/`--status`/`--flat`，`list` 的过滤与分组逻辑不同；边界情况（无匹配、空目录、损坏 manifest）的行为需要锁定 | 用户本人（日常用 list 巡检 issue） | `behavior.md` |
| 可运行输出 | 有 | 终端里打印的文本内容、分组标题、过滤后的行数都会不一样 | 用户本人（终端直接看） | `example-run.md` |
| 对外接口报文 | 无 | `list` 不对外提供 HTTP/RPC 接口，只有 stdout 文本，没有结构化报文（JSON 等）需要锁定 | — | 不出 api-mock.md |
| 用户配置 | 有 | 新增 CLI flag（`--group-by-stage`、`--stage <name>`、`--status <value>`、`--flat`），没有配置文件层面的变化；这几个新参数的语义并入 `behavior.md` 的「配置差异」节 | 用户本人（记这几个新 flag 怎么用） | `behavior.md` 的配置差异节 |
| 历史兼容性 | 有，且是这次改动风险最高的一面 | round 1 已锁定：**不加任何 flag 时，输出必须与现状逐字节一致**——用户本机有一个仓库外的 PowerShell 脚本按固定列宽/列顺序解析这份纯文本输出。这条必须在 `behavior.md` 的不变清单里单独成行，并在 `example-run.md` 里给一个「现在能跑、改完之后必须逐字节一样能跑」的场景 | 用户本人电脑上的 PowerShell 脚本（仓库外，读不到源码，只能靠行为约束保证） | `behavior.md` 的不变清单 + `example-run.md` 的兼容性场景 |

## 结论

六面里三面「有」、三面「无」。不是六面全否，不触发 `needs_reinterview`。
出 `behavior.md`（含配置差异节、不变清单）与 `example-run.md`，不出 `mock.html` 与
`api-mock.md`——这两份缺席本身也是记录：确认过这次改动没有界面、没有对外报文。
