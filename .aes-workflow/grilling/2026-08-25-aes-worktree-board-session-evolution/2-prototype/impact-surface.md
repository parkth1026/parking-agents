# 影响面扫描：aes-worktree-board session evolution

> 判据：改完之后，这个程序在哪些地方跑起来不一样了？每一处不一样，谁会看见、谁会受影响？

| 影响面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | 有 | 保持既有高保真需求星图为主画布，不另建 dashboard；runner/job/attempt、双层 Goal、review/QA、quarantine、awaiting-human、discovered-work 和 merge/close 增量进入节点信标、Workers 面板、详情面板与顶部编排状态。 | Master 操作者、人工验收者、排障者 | `mock.html`；基线 `docs/design/design_handoff_issue_starmap/` |
| 可观察行为 | 有 | runner 初始化、Issue claim、owner session、subagent review/QA、内部修复循环、Goal terminal、Master merge、Wayfinder 回流和 Issue close 都改变。 | Master、owner worker、reviewer、QA、Wayfinder、GitHub Issue 使用者 | `behavior.md` |
| 可运行输出 | 有 | 新增 init/validate/run/resume/status 类输出；错误必须区分 quarantine、contract conflict、budget exhaustion、awaiting-human。 | CLI/host 调用者、日志审计者 | `example-run.md` |
| 对外接口报文 | 有 | 新增 RunnerSlotConfig、IssueWorkOrder、StageResult、QaReceipt、DiscoveredWork、WorkerGoalTerminal、MasterDisposition 等 typed schema。 | Master/worker/subagent/Wayfinder 适配器、测试 fixture | `api-mock.md` |
| 用户配置 | 有 | 新增 Git 忽略的 `runner-slots.local.json`；模型语义档、预算、slot capabilities 与 repo identity 进入配置；动态 lease/job 不进入配置。 | 仓库维护者、Master 启动者 | `behavior.md` 配置差异 |
| 历史兼容性 | 有 | 现有 registry/status/inbox/transitions、旧两档模型名、旧 `board.config.json`、CLI 与 v3 board 必须明确迁移/只读兼容，不能静默混用。 | 已有 runtime、脚本调用方、历史 session/eval | `behavior.md` 不变与迁移清单 |
| 架构与依赖 | 有 | 依赖从 Master 直接编排 executor/reviewer，改为 Master→`aes-issue-worker`→专项 skill；新增 deterministic runner registry、双层 Goal、QA 与 Master→Wayfinder discovery adapter。 | 技能维护者、实现 Agent、reviewer、测试作者 | `diagram.html` |

## 扫描结论

七面全部有可观察变化，不能跳过 prototype。第一版对照物必须同时覆盖界面、行为、运行输出、报文、配置、兼容性和架构；任何一面未确认都不足以进入 Goal Contract。
