# 影响面扫描：AES-QG 客观等级标准

| 影响面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | 有 | aes-gate board 增加标准版本、supported/required/achieved、level receipt identity | 维护者、QA、发布负责人 | `drafts/v1-mock.html` |
| 可观察行为 | 有 | 裸 gate 最终 fail closed；gate.l0...l5 累计执行；旧 L 标为 legacy-unqualified | 所有调用 gate 的人和 agent | `drafts/v1-behavior.md` |
| 可运行输出 | 有 | PASS 必须输出完整 AES-QG Level、candidate/artifact/policy identity 与 executed/reused | CLI、CI、日志消费者 | `drafts/v1-example-run.md` |
| 对外接口报文 | 有 | 新增 gate-policy 与 GateReceipt；QaReceipt vNext 引用 repository gate receipt | aes-gate、aes-qa、AES Master | `drafts/v1-api-mock.md` |
| 用户配置 | 有 | 新增版本化 `gate-policy.toml`，以 run action id 为外键 | 各仓维护者 | `drafts/v1-behavior.md` 配置差异 |
| 历史兼容性 | 有 | 旧 action/report/receipt 保留但不获得新 L；分阶段迁移后裸 gate 拒绝 | 旧仓库、历史审计、自动化调用方 | `drafts/v1-behavior.md` 不变清单 |
| 架构与依赖 | 有 | aes-gate 成为 level/policy/receipt 标准所有者；aes-qa 消费；GATE-qa fail closed | AES 技能族与各仓 | `drafts/v1-diagram.html` |

七面均已扫描，无跳过项。
