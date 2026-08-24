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

## 迭代记录

| 日期 | 改动 | 验证 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-08-24 | 修复独立复核确认的租约、门禁、queued identity、stop TOCTOU、fallback settlement、snapshot、HTTP 与锁释放缺陷，并补 thread 归属和 worker canonicalization。 | 针对性红绿测试 + 全域回归 + 浏览器与双轴复审。 | 控制面原语仍集中在单一 Skill，暂不拆分。 |
| 2026-08-25 | 默认 collect 改用完整 Issue fixture，并把真实 GitHub 二次对账拆成显式 `collect-live` smoke，消除授权、网络及两次查询间 Issue 变化造成的 flaky。 | 无效 `issueRepo` 下 collect 绿、collect-live 红；八域 `run-tests.mjs` 8/8 通过。 | 这是测试证据分层，不新增技能职责，无需拆分。 |
| 2026-08-25 | 为 Desktop worker lane 增加可恢复的开始/结束时间投影，统一 registry、collect 与 web 面板的工作时长。 | lifecycle/storage/contract 回归、八域回归与真实浏览器活动/冻结计时验收。 | 复用既有 TaskRecord 与 schema v3，不引入后台计时服务。 |
| 2026-08-25 | Issue #43：增加显式 Goal、版本化 executor final、typed next-actions/action receipts、串行 merge queue、post-merge verification 与 next-Issue 连续闭环。 | `orchestration --scenario continuous` 四组 host-shaped 回归；默认八域回归。 | 继续保持宿主执行动作、脚本登记/校验事实的边界，不引入 daemon。 |
