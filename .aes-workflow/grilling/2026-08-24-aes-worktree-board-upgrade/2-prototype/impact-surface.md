# Impact Surface: 2026-08-24-aes-worktree-board-upgrade

- 判据：改完之后，这个程序在哪些地方跑起来不一样了？每一处不一样，谁会看见、谁会受影响？
- 扫描：2026-08-24，基于 1-interview/context.md 与四分片 facts/

| 影响面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | **有** | board.html（既有星图，设计语言锁定于 docs/design/design_handoff_issue_starmap，不动）接受 schemaVersion 3，控制面新信息增量挂进既有构件：工具条加编排状态胶囊、Workers 停靠面板行加状态机/verdict/blockCount/模型徽章、详情面板加任务区与转移历史、派发框加授权提示、v2 旧快照降级渲染（原为硬报错） | 打开看板的用户 | `mock.html` |
| 可观察行为 | **有** | 新增 registry/inbox/状态机/停止评估器行为：事件幂等消费、非法转移拒绝、blockCount 熔断、collect 不再覆盖终态与 assessment、锁竞争判定改租约制（#23）、原子写（#25） | Orchestrator agent、后续巡检会话 | `behavior.md` |
| 可运行输出 | **有** | 新 CLI `orchestrate.mjs`（task/inbox/transition/verdict/block/stop-eval/preflight 子命令）的 stdout JSON 与退出码；selftest 新增 `orchestration` 域 | 调用脚本的 agent 与 selftest | `example-run.md` |
| 对外接口报文 | **有** | server：POST /api/dispatch 新增 Origin+token 门（403/401 新报文，#22）；GET /api/status 返回 v3 结构；新增数据契约：registry.json / TaskRecord / transitions.jsonl / inbox.jsonl | board.html、任何本机 HTTP 调用方 | `api-mock.md` |
| 用户配置 | **有** | board.config.json 支持目标仓根覆盖并在 collect preflight 校验 issueRepo/mainBranch（#24）；cli-fallback 需显式授权参数；无新增环境变量 | 配置多目标仓的用户 | `behavior.md` 配置差异节 |
| 历史兼容性 | **有** | v2 status.json 可读（board+collect 承接）；现有七个 selftest 域必须仍绿；collect/assess/dispatch/server 现有命令行用法不变；技能目录旧 runtime 归档不删；orchestration-stop 旧手写账本只读归档，新停止状态并入 registry 同源 | 现有 fixture、旧快照、上一轮留下的现场 | `behavior.md` 不变清单 |
| 架构与依赖 | **有** | 新模块 `orchestrate.mjs` 与 runtime v3 存储（registry/inbox/transitions）；server/board 改读 v3；dispatch 降为显式 fallback 并改用租约；单一事实源关系重排（SKILL.md 规范源 → runtime schema → board 展示；#5 治理载体）；GitHub 侧新增 wayfinder 依赖图（#5 转父节点） | 全部脚本、#5、后续 agent | `diagram.html`（架构视图+流程视图） |

七面全「有」。无 skipped。
