# aes-worktree-board 设计依据

## 意图与触发场景

把主仓 Orchestrator、Codex Desktop Task、既有 Git worktree、GitHub Issue 图和需求星图接到同一套可恢复控制面。脚本只负责事实采集、身份与租约、事件入箱、状态门禁、审计和渲染；任务选择、Desktop `create_thread`、独立 review、合并及 post-merge verification 仍由宿主主 agent 执行。

## 设计取舍

- `registry.json` 是判断真源，`status.json` 是渲染快照；全部可变写入共用 runtime 互斥与 tmp+rename。
- worker identity 以目标仓 `git worktree list` 为边界，短名和完整 basename 归一到同一租约 key。
- executor 持有 writer 租约；关联 reviewer 加入同一 generation，但保持只读且不能夺取或释放 writer 租约。
- Desktop Task 可以先记录 `clientThreadId`，随后原子附加真实 `threadId`；CLI fallback 必须保存用户授权原话。
- worker 工作周期以 executor Task 登记为起点：`createdAt` 保留首次登记审计时间，`startedAt` / `finishedAt` 记录当前工作周期；reviewer 不重置 worktree 计时，终态冻结，parked 显式恢复时开始新周期。
- inbox 同时校验 eventId 幂等与 thread→Task 归属。关联 reviewer thread 可以向 parent executor 提交 verdict，其他 foreign thread fail closed。
- 状态边和交付证据是两层门禁：合法转移不等于证据齐全；有效 verdict、commit、review 和 merge commit 缺一不可进入对应终态。
- stop 的读取、判断和写入与 Task 创建使用同一临界区，保证 `stopped` 与 active Task 不会并存。
- LIVE 页面由 server 注入 `/runtime/status.js`；collect 在目标 runtime 生成只读 `board.html + status.js` 快照，技能目录历史 runtime 不参与读取。
- 连续编排不靠自然语言猜测 worker 结果：executor final 使用 `aes.worktree-board.executor-final/v1`；无法校验的 final 保持 inbox pending，并投影为 `UNCLASSIFIED_FINAL`。
- 宿主动作由稳定 actionId 驱动，receipt 写回 registry。root 重启只重算同一 actionId；`HOST_MERGE` 在 post-merge verification 完成前独占 integration merge mutex。
- `committed → reviewing → approved → merge-ready → merged` 的所有公开入口共用一条证据链；旧 transition/verdict 不能旁路。reviewer、action/event、executor 三方 commit 必须相等。
- claim reservation 在 next-actions 物化时按 Issue 编号原子占位；active/pending/succeeded claim 与 Registry 中其他 worker 的未 merged executor Task 都会阻止重复 create。
- Git merge receipt 由 live repo 校验 worker HEAD、pre/post HEAD、integration branch，以及第二父精确为 reviewed commit 的真实双父 merge；post-merge 只接受脚本实际执行形成的 passed verificationRun。
- dead-letter 只处理已被较晚合法 replacement 取代的 reviewer commit 字符串绑定错误；原/replacement 必须解析到同一 Git object，并保存 authorization 与独立 append-only receipt。
- Goal 只能由显式 `goal start` 创建。Goal 是 root 的持久完成条件，不代替 Desktop `create_thread` / `wait_threads`，也不扩大 merge、dirty 或人工决策权限。

## Continuous orchestration loop

宿主在 Goal 活跃期间必须执行不可提前退出的循环：

```text
collect/reconcile fresh Git + Issue frontier
→ fan-in 所有 wait_threads wake/polls
→ drain pending inbox（无结构 final 保持 pending）
→ next-actions
→ 执行队首 typed host action 并写 action receipt
→ bounded WAIT_THREADS
→ reconcile
```

锁定 action 闭集为 `UNCLASSIFIED_FINAL / CREATE_REVIEWER / RETURN_TO_EXECUTOR /
EVALUATE_MERGE_GATE / HOST_MERGE / POST_MERGE_VERIFY / CLAIM_NEXT_ISSUE /
WAIT_THREADS / STOP`。除可重复的 `WAIT_THREADS` 外，同一事实组合产生稳定 actionId；相同
receipt 重放返回 `already-recorded`。多 worker 可同时执行与 review，但 `next-actions` 在任何时刻
只放出一个 `HOST_MERGE`，且该 merge 的 post-merge verification 完成前不放出下一项。

executor final schema 至少包含：`outcome=COMMITTED`、`commitSha`、`tests.summary`、
`tests.commands[{command,exitCode}]`、`unexecuted[{scope,reason}]`、
`manualTestDebt[{scope,reason}]`、`suggestedNextState=committed`。COMMITTED final 中任一已执行
测试非零会 fail closed。`needs-manual-test + runtime=NOT_RUN` 仅在 manual debt 显式存在时可过
merge gate，Task create 从 fresh Issue labels 自动推导该 interaction class；`runtime=FAIL|BLOCKED`
始终阻断。
- runtime 中已有快照必须与本次解析出的 `repo.root / issueRepo / mainBranch` 完全同源；任一字段错配都以 `REPO_MISMATCH`、exit 2 拒绝复用，不能从旧快照提取 Issue 或控制面事实。
- runtime identity 必须在 collect 的锁前快检和取得 runtime 锁后的最终快照上各校验一次；两个目标仓从同一空 runtime 并发 collect 时只能有一个写入，另一方必须 `REPO_MISMATCH`，不得 last-writer-wins。
- server API 使用专属 `aes-worktree-board/1` marker 与完整 status schema；端口冲突探测只有验证 v3、generatedAt、repo、graph（issues/edges/stats）与 worktrees 后才比较 identity。另一目标仓返回可诊断的 `REPO_MISMATCH`，同仓或 marker 正确但 status 不完整的服务返回 `PORT_CONFLICT`；任何冲突都拒绝把旧实例当成本次启动成功。
- 配置输入以目标仓为锚：环境覆盖优先，其次是 `<目标仓根>/.aes-worktree-board/board.config.json`，最后才是技能目录默认；collect、server、fixture capture 与 dispatch 共用这条解析链。
- Issue graph 保留 live GitHub 与完整离线 fixture 的 labels，并在缓存回退中承接已有 labels，使 `ready-for-agent` 不会因采集输入链被丢失而退出 eligible frontier。

## 验收条件

| AC | 条件 |
| --- | --- |
| AC-1 | 短名与完整 worktree basename 命中同一租约；不存在的 worker 被 CLI 拒绝。 |
| AC-2 | executor 到达 committed 后可登记同 generation reviewer；reviewer 不取得 writer 租约。 |
| AC-3 | 仅有 clientThreadId 的 queued Desktop Task 可登记，并可原子补齐 threadId/hostId/projectId。 |
| AC-4 | foreign thread 不能写入 Task 或覆盖 cursor；关联 reviewer APPROVE 可形成独立 review 证据。 |
| AC-5 | 分步写 verdict 不能绕过 runtime/code 门禁；commit/review/mergeCommit 证据不足时拒绝终态。 |
| AC-6 | stop eval 与 task create 并发时，不得出现 stopped 与 active Task/lease 并存。 |
| AC-7 | 已预登记的 fallback wrapper 在 agent 启动前失败时收敛为可审计、可重试 parked，并释放 writer 租约。 |
| AC-8 | assess 的失败路径释放 runtime 锁。 |
| AC-9 | 锁定 HTTP 报文使用 worker 与 500 message；旧 worktree 字段仅作兼容输入。 |
| AC-10 | collect 在目标 runtime 生成读取同目录 status.js 的快照页面；技能模板不读取历史 runtime。 |
| AC-11 | 旧七域、自带 orchestration 域、issue graph、真实浏览器 v3/v2 验收全部保持通过。 |
| AC-12 | registry 中最新 executor Task 是 worker 计时真源；活动时长持续增长，merged/parked/handoff-required 后冻结，reviewer 不重置，parked 恢复后开始新周期。 |
| AC-13 | executor typed final 通过真实 inbox 事件逐边推进到 committed 并产生 CREATE_REVIEWER；无结构 final 不 consumed、不推进 cursor。 |
| AC-14 | next-actions/action receipt 在 root 重启与重复事件下幂等；review BLOCK 返回原 executor，第三个新 commit BLOCK 才熔断。 |
| AC-15 | integration merge 严格串行；HOST_MERGE receipt 后必须 POST_MERGE_VERIFY 通过才进入 merged 并释放 writer 租约。 |
| AC-16 | merged worker 自动得到 CLAIM_NEXT_ISSUE；pending inbox、活动线路、merge/post-merge 或 eligible frontier 任一存在时 Goal/stop 不得 complete。 |
| AC-17 | 旧 transition/verdict set 不能绕过 executor-final、review、merge-gate、HOST_MERGE、post-merge receipt；旁路失败不得释放 lease。 |
| AC-18 | reviewer.reviewCommit、task.commitSha、action/event.commitSha 必须三方相等；旧 reviewer 回放 APPROVE/BLOCK 均拒绝。 |
| AC-19 | claim reservation 防止多 worker 在 root 重启及 stale snapshot 下重复领取同一 Issue。 |
| AC-20 | UNCLASSIFIED_FINAL 只有 replacement typed-final 或显式 parked/handoff-required 才能消费。 |
| AC-21 | fake SHA、非 live branch/head、octopus merge、任意 exitCode JSON 均不能形成 merge/post-merge receipt；只接受恰好双父 merge，CLI action verify 正向链必须真实执行。 |
| AC-22 | schema 校验先于 terminal-noop；late 到 merged 的 malformed final 仍为 pending UNCLASSIFIED，只有同 commit replacement typed-final 才收敛。 |
| AC-23 | UNCLASSIFIED 收敛同时重算 nextAction；Registry、collect、board 三层均不得残留 UNCLASSIFIED_FINAL。 |
| AC-24 | handoff 仅能由显式 authorization-id + 原文恢复同一 Task；恢复幂等、可审计、开启新熔断 epoch，并强制新 follow-up commit 后重新 review。 |
| AC-25 | fresh Issue label `needs-manual-test` 强制 interaction class；调用方不能用 autonomous 参数覆盖。 |
| AC-26 | active Goal 的 actions、pending、WAIT 与 merge queue 仅包含锁定 worker 范围；范围外 Task 不被该 Goal 调度。 |
| AC-27 | merge gate、HOST_MERGE started/succeeded 均重读 worker live HEAD；双父 merge 第二父必须精确等于 reviewed commit。 |
| AC-28 | handoff follow-up 必须是 blocked commit 的新 descendant、原 executor worktree live HEAD；RETURN_TO_EXECUTOR 绑定原 thread。 |
| AC-29 | 每次 transition/resolution/recovery/stop 原子刷新 task 与 orchestration 投影；APPROVE 后 nextAction 为 EVALUATE_MERGE_GATE。 |
| AC-30 | direct createTask 也按 Issue 检查跨 worker 未 merged executor Task，不能绕过 claim ledger。 |
| AC-31 | superseded reviewer binding 只能经授权、幂等、append-only dead-letter receipt 收敛；合法事件和任意 reason fail closed。 |
| AC-32 | 显式目标仓、runtime 旧快照和 server 监听端口形成同一 repo identity 边界；跨项目错配以 exit 2 fail closed，当前项目 API 的仓、Issue 图谱与 worktree 列表必须同源。 |
| AC-33 | 锁内二次 identity 校验阻止空 runtime 的双仓并发覆盖；repo-shaped 非 board JSON 或 marker 正确但缺 repo/graph/worktrees 的不完整 status 未通过完整 schema 时只能判为 `PORT_CONFLICT`。 |

## 迭代记录

| 日期 | 改动 | 验证 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-08-24 | 修复独立复核确认的租约、门禁、queued identity、stop TOCTOU、fallback settlement、snapshot、HTTP 与锁释放缺陷，并补 thread 归属和 worker canonicalization。 | 针对性红绿测试 + 全域回归 + 浏览器与双轴复审。 | 控制面原语仍集中在单一 Skill，暂不拆分。 |
| 2026-08-25 | 默认 collect 改用完整 Issue fixture，并把真实 GitHub 二次对账拆成显式 `collect-live` smoke，消除授权、网络及两次查询间 Issue 变化造成的 flaky。 | 无效 `issueRepo` 下 collect 绿、collect-live 红；八域 `run-tests.mjs` 8/8 通过。 | 这是测试证据分层，不新增技能职责，无需拆分。 |
| 2026-08-25 | 为 Desktop worker lane 增加可恢复的开始/结束时间投影，统一 registry、collect 与 web 面板的工作时长。 | lifecycle/storage/contract 回归、八域回归与真实浏览器活动/冻结计时验收。 | 复用既有 TaskRecord 与 schema v3，不引入后台计时服务。 |
| 2026-08-25 | Issue #43：增加显式 Goal、版本化 executor final、typed next-actions/action receipts、串行 merge queue、post-merge verification 与 next-Issue 连续闭环。 | `orchestration --scenario continuous` 四组 host-shaped 回归；默认八域回归。 | 继续保持宿主执行动作、脚本登记/校验事实的边界，不引入 daemon。 |
| 2026-08-25 | Issue #43 BLOCK 1/3：封闭旧入口、旧 reviewer、重复 claim、任意 final resolution 与伪造 merge/post-merge receipt 五类旁路。 | 临时真实 Git merge + CLI verification 正向链，以及对应负向 probes。 | receipt 控制面仍在 registry v3 additive 字段中，保持旧快照可读。 |
| 2026-08-25 | Issue #43 BLOCK 2/3：把 final schema 校验前移到 terminal-noop 之前，并把 merge commit 从“至少双父”收紧为“恰好双父”。 | late-merged malformed final 与真实 octopus merge 负向 probes。 | parked/handoff 仍是显式收敛态；merged 只能由同 commit replacement typed-final 清理 late malformed event。 |
| 2026-08-25 | Issue #43 人工解除熔断：修复 UNCLASSIFIED 收敛后的 nextAction 残留，并实现授权约束的同 Task handoff recovery。 | Registry/collect/board 投影断言；第三次 BLOCK→handoff→授权恢复→新 commit→reviewer APPROVE host-shaped 回归。 | generic transition 与新 fix Task 仍关闭；恢复只接受显式用户授权并保留审计 ledger。 |
| 2026-08-25 | Issue #43 恢复 epoch 1：绑定 reviewed/live Git HEAD、恢复 descendant、原 thread、原子投影与跨 worker create，并增加受限 dead-letter。 | 两组 live-HEAD 真实 Git 负测、真实 handoff recovery、direct create 与 short/full SHA replacement 回归。 | append-only inbox 不修改；dead-letter 是独立授权 receipt，不等同 consumed。 |
| 2026-08-25 | 锁定跨项目 repo identity：拒绝错误 runtime 快照，并在端口占用时区分另一仓 server 与普通冲突。 | repo-root 跨项目 runtime/port/API 回归 + 八域回归 + 真实 parking-agents API smoke。 | 沿用既有 `/api/status?fast=1`，不增加监听地址、路由或第三方依赖。 |
| 2026-08-25 | BLOCK 1/3 follow-up：目标仓 integration 配置落为 `dev`，collect 增加锁内 identity 复核，端口探测增加专属 board marker/schema。 | 双仓 barrier 并发回归、repo-shaped 伪服务回归、无 env 目标主仓 live API/Playwright。 | marker 是 additive v3 字段与响应头；页面仍可降级读取旧 v2/v3 快照。 |
| 2026-08-25 | Issue #24：固定环境覆盖 > 目标仓 `board.config.json` > 技能默认，并让完整 Issue labels 穿过 live、fixture 与缓存 collect 输入链。 | 完整 labels fixture、跨仓 `main`/`trunk` 配置回归、环境覆盖回归、八域回归与显式 `collect-live`。 | 保留现有 label 对象形状，不新增多仓聚合或 label 业务推导。 |
