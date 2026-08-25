---
name: aes-worktree-board
description: 在主仓巡检并编排同级既有 worktree：采集全仓 Issue Map/List 与队员坐标，用 Desktop create_thread 派发可见 Task，以 registry/inbox/三维 verdict/熔断/全局停止协议恢复和审计执行，并启动需求星图看板。用户要查看所有 worktree、Issue frontier、调度实现与独立 review、判断并执行受门禁保护的合并、恢复中断编排或打开看板时使用。
---

# AES Worktree Board

把主仓对话作为 Orchestrator，把 Desktop Task 作为正常执行单元，把看板作为同一份事实的可视入口。宿主工具负责 `create_thread`、`wait_threads` 与合并动作；脚本不模拟宿主工具，只把每次宿主动作登记为可恢复、幂等、可审计的控制面事实。

开发侧活跃真源是 `.agents/skills/aes-worktree-board/`。PowerShell 中先解析用户级 junction；未安装 junction 时把 `$skillDir` 换成活跃真源绝对路径：

```powershell
$skillDir = "$HOME/.agents/skills/aes-worktree-board"
$worker = "dev1"
```

## 目标仓、配置与 runtime

目标仓根按单一 contract 解析：`AES_WORKTREE_BOARD_REPO_ROOT` 优先，否则用调用进程当前目录；技能安装目录不参与判定。server 启动 fallback 子进程时必须继续传递已解析的目标仓根。

配置按以下优先级合并：

1. 环境覆盖：`AES_WORKTREE_BOARD_CONFIG`（JSON 文件路径或 JSON 字符串），以及 `AES_WORKTREE_BOARD_MAIN_BRANCH`、`AES_WORKTREE_BOARD_ISSUE_REPO`、`AES_WORKTREE_BOARD_PORT`、`AES_WORKTREE_BOARD_DEFAULT_AGENT`；
2. `<目标仓根>/.aes-worktree-board/board.config.json`；
3. 技能目录 `board.config.json` 默认值。

collect preflight 必须验证目标仓存在 `mainBranch`；真实 GitHub 采集还必须验证 `issueRepo` 可访问，错配退出 2 并点名字段。

runtime 选址链保持不变：`AES_WORKTREE_BOARD_RUNTIME_DIR` 优先，否则 `<目标仓根>/.aes-worktree-board/runtime/`。目标仓应忽略这个目录。技能目录历史 `runtime/`（含 03:21 快照与 `orchestration-stop.json`）只是只读归档证据：不得删除、移动或由脚本继续读写。

## 不可越过的边界

- 只操作 `git worktree list` 中与主仓同级的既有 worktree；`task create` 会把短名与完整 basename 规范化为同一 worker identity，并拒绝不存在的 worktree；不创建、不删除 worktree；`test` worktree 不参与自动调度。
- dirty worktree 必须先复述修改数与未跟踪数；用户确认后才可继续，确认不能越过 registry 租约。
- 正常派发只用 Desktop `create_thread`。真实 CLI fallback 必须保留用户授权原话；`test` 假 agent 仅供 selftest 豁免。
- 模型只用 `luna-max` / `sol-high` 两档；每个 TaskRecord 必须记录 `modelTier` 与 `routingReason`。
- 不把 `runtime=NOT_RUN` 改写为 `PASS`；不把 handoff/park/stop 伪装成 BLOCK；不重复消费同一 eventId。
- 不清理、reset、强杀或覆盖用户现场。连续三次有效 BLOCK 后停止该线路的 Task/reviewer 自动创建，等待人工交接。
- 星图设计语言保持 `docs/design/design_handoff_issue_starmap/` 的颜色、半径、光晕、名牌旗、图例与交互；控制面只占六个确认挂点，双视图文案为 `Map / List`。

## 恢复入口与判断真源

每个新回合先运行：

```powershell
node "$skillDir/scripts/orchestrate.mjs" inbox pending
```

逐条消费 pending 后才继续 `wait_threads`。`registry.json` 是判断真源，`status.json` 只是 schema v3 渲染快照；二者冲突时以 registry 为准。`transitions.jsonl` 与 `inbox.jsonl` 是 append-only 审计历史。全部可变写入共用 runtime 互斥并经 tmp+rename 原子替换。executor Task 的 `createdAt` 保留首次登记时间，`startedAt` / `finishedAt` 记录当前 worker 工作周期；终态冻结计时，parked 显式恢复时开始新周期，关联 reviewer 不重置计时。

collect 只写 schemaVersion 3，承接既有 assessment、终态和全局停止状态；board 可降级读取 v2，并明确显示“旧快照”，不得报错拒渲。

## 巡检

1. 在目标主仓运行 `node "$skillDir/scripts/collect.mjs"`。只有明确沿用快照时才加 `--no-gh`。
2. 读取 `runtime/status.json`，以 registry 派生的 `worktree.task` 与 `orchestration` 为控制事实，再检查 Git ahead/behind、dirty、mergeCheck、Issue 依赖和测试证据。
3. 仍用 `assess.mjs` 写每个节点的业务判断：

   `node "$skillDir/scripts/assess.mjs" $worker --merge not-yet --done unknown --task "待确认任务" --reason "证据不足"`

4. 输出每个 worker 的位置、Task state、三维 verdict、BLOCK 次数、完成度和下一动作；另列 frontier 与空闲 worker。

`recommend`/`MERGE_READY` 需要 code/spec 门禁通过、交付条件闭环、Git 可合并和证据诚实。autonomous 类 Issue 可在 `runtime=NOT_RUN` 时进入 MERGE_READY；明确要求真机的 Issue 不可。合并是宿主主 agent 的受门禁动作：合并前重新核对 registry 与 Git，合并后登记 `merged` 和 merge commit，并在 main 复验。

## Desktop create_thread 正常路径

1. 根据 Issue、AC、风险与模型档组织自包含 prompt。
2. 调用宿主 `create_thread` 创建侧边栏可见 Task；记录返回的真实 `threadId`（或排队时的 `clientThreadId`，拿到真实 id 后补齐）。
3. 立刻原子登记 Task 与 worktree 租约：

```powershell
node "$skillDir/scripts/orchestrate.mjs" task create --issue 17 --worktree dev4 --role executor --thread-id T-01HXYZ --model luna-max --routing-reason "单包 AC 明确，自动测试可覆盖"
```

Task create 与租约占用是同一笔 registry 原子更新。相同 worktree 的竞争者必须退出 2 `LOCKED`，不得靠 PID 判活后再占锁。长执行可用：

```powershell
node "$skillDir/scripts/orchestrate.mjs" task heartbeat --task tk-dev4-17-g1
```

排队创建只拿到 `clientThreadId` 时仍登记为 `desktop-thread`；拿到真实 id 后原子补齐：

```powershell
node "$skillDir/scripts/orchestrate.mjs" task attach-thread --task tk-dev4-17-g1 --thread-id T-01HXYZ --host-id H-01 --project-id P-01
```

executor 到达 `committed` 后，独立 reviewer 以 `--parent-task-id` 加入同一 generation。reviewer 是只读 Task，不取得或释放 writer 租约；它的 thread 事件只有在明确关联该 executor 时才能写入父 Task：

```powershell
node "$skillDir/scripts/orchestrate.mjs" task create --issue 17 --worktree dev4 --role reviewer --parent-task-id tk-dev4-17-g1 --thread-id T-02R --model sol-high --routing-reason "独立 code/spec review"
```

## 事件 fan-in 与幂等消费

`wait_threads` 一次返回的 wake 与所有 polls 必须全部入箱，不能只处理第一个唤醒项：

```powershell
node "$skillDir/scripts/orchestrate.mjs" inbox put --thread T-02R --task tk-dev4-17-g1 --kind final --payload-file poll.json
node "$skillDir/scripts/orchestrate.mjs" consume --event-id E-7f3a
```

宿主事件有 id 就沿用；否则 eventId 为 thread/kind/payload 摘要的稳定 SHA-1 前 12 位。入箱与消费都校验 thread→Task 直接归属或 reviewer→parent 关联；foreign thread 必须退出 2 `THREAD_TASK_MISMATCH`，不得覆盖 cursor 或 verdict。`approved` 只接受 reviewer `final|verdict` 的显式 `APPROVE|PASS`；普通 commentary/progress 的 `payload.to` 不能冒充裁决。reviewer `BLOCK` consume 在同一 registry 原子更新内完成 commit 校验、去重、计数与 `fixing|handoff-required` 转移，继续返回锁定的 `result=consumed`；显式 `block record` 复用同一逻辑。同一 eventId 再次消费必须返回 `already-consumed`、退出 0、零状态变化。合法 late event 可以落箱和消费但不得复活终态；malformed executor final 例外，必须保持 pending `UNCLASSIFIED_FINAL`。

## 显式 Goal 与连续编排闭环

只有用户明确要求“持续自动编排直到无可推进任务”时，root 才创建 Goal；状态巡检、打开看板、
导出快照等 one-shot 操作不得调用 `goal start`。先运行 fresh collect，再锁定 worker 范围：

```powershell
node "$skillDir/scripts/orchestrate.mjs" goal start --workers dev1,dev2,dev3 --manual-test-policy "needs-manual-test + explicit debt permits runtime=NOT_RUN"
```

脚本生成的 Goal 固定目标仓、integration branch、Issue repo、worker、人工验收政策、权限边界，
并包含可验证的 Outcome / Constraints / Verification。Goal 不扩大权限，也不替代宿主
`create_thread`、`wait_threads` 或 root 串行 merge。

Goal 活跃时，root 必须持续执行：`reconcile → fan-in all events → drain pending inbox →
drain typed next-actions → bounded wait → reconcile`。单个 worker 等待、长测、review 或 BLOCK
不是全局完成/blocked；其他 lane 仍须推进。每轮先查询：

```powershell
node "$skillDir/scripts/orchestrate.mjs" next-actions
```

返回 action schema 是 `aes.worktree-board.next-action/v1`，类型闭集为
`UNCLASSIFIED_FINAL`、`CREATE_REVIEWER`、`RETURN_TO_EXECUTOR`、`EVALUATE_MERGE_GATE`、
`HOST_MERGE`、`POST_MERGE_VERIFY`、`CLAIM_NEXT_ISSUE`、`WAIT_THREADS`、`STOP`。
actionId 从事实组合稳定派生；宿主完成动作后用 payload file 写幂等 receipt：

```powershell
node "$skillDir/scripts/orchestrate.mjs" action receipt --action-id A-... --status succeeded --payload-file receipt.json
```

`CREATE_REVIEWER` receipt 与 reviewer verdict 必须同时满足
`reviewer.reviewCommit === task.commitSha === action/event.commitSha`。`EVALUATE_MERGE_GATE`
receipt 必须绑定 live worktree HEAD、integration HEAD、integration branch，并由脚本实时运行
`git merge-tree`。`HOST_MERGE started/succeeded` 分别绑定 live preHead 与 postHead；succeeded
只接受恰好两个 parent、第一父提交为 preHead、且包含 executor commit 的真实 Git merge commit；
octopus merge 明确拒绝。

`POST_MERGE_VERIFY` 不接受宿主自报的 `exitCode=0` JSON。先把 executable/args 写入 commands file，
由脚本在 integration repo root 实际执行：

```powershell
node "$skillDir/scripts/orchestrate.mjs" action verify --action-id A-... --commands-file post-merge-commands.json
```

脚本生成与 action/mergeCommit/live HEAD 绑定的 `verificationRun`，全部真实命令 exit 0 且 HEAD
未变化后，才原子写 POST receipt、进入 `merged`、释放 lease。`CLAIM_NEXT_ISSUE` 在 action 生成时
即按 Issue 编号写 claim reservation；active/pending/succeeded claim 都从 stale frontier 排除，
receipt 必须绑定同 reservation/worktree 的新 executor Task。多 worker 可并行
执行/review，但只放出一个 `HOST_MERGE`；post-merge verification 前不会放出队列下一项。

Goal/stop 只有在 fresh registry + inbox + Git + Issue frontier 同时证明 pending 为空、无 active /
reviewing / fixing / merge-ready / post-merge 线路、无 eligible autonomous Issue、全部 lane 均为
`merged | parked | handoff-required` 时才可 complete。
active Goal 的 action derivation、pending inbox、merge queue 与 WAIT targets 只读取 Goal 锁定的
worker 集合；范围外 active/merge-ready Task 不得被该 Goal 恢复、review、merge、claim 或阻止完成。

### executor final v1

executor final 必须直接发送如下结构，不从自然语言正则猜 commit 或 verdict：

```json
{
  "schemaVersion": "aes.worktree-board.executor-final/v1",
  "outcome": "COMMITTED",
  "commitSha": "abc123",
  "tests": { "summary": "targeted tests passed", "commands": [{ "command": "node test.mjs", "exitCode": 0 }] },
  "unexecuted": [],
  "manualTestDebt": [{ "scope": "Desktop visual acceptance", "reason": "deferred by integration policy" }],
  "suggestedNextState": "committed"
}
```

缺字段、测试非零或无法分类的 executor final 返回可见 `UNCLASSIFIED_FINAL`，保持 inbox pending，
不写 consumedEventIds、不推进 cursor、不改变 Task state。Git HEAD 相对登记 head 已变化但没有 typed
final 时，`next-actions` 也会以 `GIT_HEAD_ADVANCED_WITHOUT_TYPED_FINAL` 暴露，不猜测提交含义。
UNCLASSIFIED action 的任意 `resolution` 不会消费事件；只有合法 replacement typed-final，或 lane
显式进入 `parked | handoff-required` 后才会把原事件标为 resolved/consumed。
schema 校验先于 terminal-noop：malformed final 即使 late 到 `merged` 也保持 pending
`UNCLASSIFIED_FINAL`；同 commit 的合法 replacement typed-final 才能收敛。
收敛必须同步重算 `task.nextAction`：committed→`CREATE_REVIEWER`、merged→`CLAIM_NEXT_ISSUE`、
parked→`PARKED`、handoff-required→`HANDOFF_REQUIRED`，Registry、collect 与 board 不得继续显示
`UNCLASSIFIED_FINAL`。
Task create 会从 fresh Issue labels 自动推导 `needs-manual-test` interaction class；宿主漏传
`--interaction-class` 也不能绕过 manual debt；显式传入冲突的 `autonomous` 会 fail closed 为
`INTERACTION_CLASS_CONFLICT`。`runtime=FAIL|BLOCKED` 始终阻断 merge gate。

## 状态机、三维 verdict 与熔断

Task 状态按锁定闭集转移：

```text
discovered → classified → claimed → dispatching → executing → self-qa → committed
→ reviewing → (approved | fixing)；fixing → executing
approved → merge-ready → merged
活动态 → parked / handoff-required；parked 只能由显式 transition 恢复
全局控制态：orchestration-stop（不写入 Task.state）
```

非法转移退出 2 且 registry 不变。三维 verdict 分别记录：

- `code`: `PASS | BLOCK`
- `runtime`: `PASS | NOT_RUN | BLOCKED | FAIL`
- `delivery`: `MERGE_READY | PARKED | HANDOFF_REQUIRED | BLOCKED`

```powershell
node "$skillDir/scripts/orchestrate.mjs" verdict set --task tk-dev4-17-g1 --runtime NOT_RUN
```

旧入口只可预登记真实 runtime evidence；`code=PASS` 来自 reviewer APPROVE，
`delivery=MERGE_READY` 只由 EVALUATE_MERGE_GATE succeeded receipt 原子写入。门禁按合并后的
有效 verdict 校验，分多次写字段也不能绕过：`MERGE_READY` 要求 `code=PASS` 与显式 runtime
evidence；要求真机时只能是 `runtime=PASS`。`committed` 必须带 `commitSha`；`approved` 必须来自
关联 reviewer thread 的最终 `APPROVE` 事件，且 payload `commitSha` 等于 executor 当前 commit；
`merged` 必须带 `mergeCommit`。只登记 reviewer Task 不算 review 已完成，证据不齐不得释放租约
或写成终态。

所有公开入口共用同一证据链：`executorFinalEvidence → CREATE_REVIEWER receipt + review evidence →
EVALUATE_MERGE_GATE receipt → HOST_MERGE receipt → passed verificationRun + POST_MERGE_VERIFY receipt`。
旧 `transition` 不能注入 commit/mergeCommit 绕过任一层；旧 `verdict set` 不再接受
`delivery=MERGE_READY`，且 Task 到达 `approved | merge-ready | merged` 后 verdict 完全冻结；
只能由 merge-gate succeeded receipt 原子写入。

只有独立 reviewer 对新 follow-up commit 的最终 BLOCK 计数；同 commit 同 verdict 去重：

```powershell
node "$skillDir/scripts/orchestrate.mjs" block record --task tk-dev1-56-g1 --commit a1b2c3 --event-id E-b3 --finding-file review3.md
```

第三次有效 BLOCK 自动进入 `handoff-required`，生成 `runtime/handoff/<taskId>.md`，保留 Issue、HEAD、finding、未执行证据与恢复条件，并封锁该线路后续派发。

`handoff-required` 不开放 generic transition，也不允许创建新 fix Task。只有用户明确授权处置后，
root 才能恢复原 executor Task：

```powershell
node "$skillDir/scripts/orchestrate.mjs" handoff recover --task tk-dev1-56-g1 --authorization-id issue-56-user-decision-1 --authorization "<用户授权原文>"
```

恢复与 writer lease、authorization-id、授权原文 digest、熔断 epoch 和 append-only transition 绑定；
相同 authorization-id + 原文重放返回 `already-recovered` 且零状态变化，同 id 不同原文 fail closed。
恢复会开启新 circuit epoch、清除旧 commit 的交付证据并回到同一 Task/thread 的 `executing`；原
executor 必须提交不同于第三次 BLOCK commit 的新 follow-up commit，之后重新创建独立 reviewer。
授权恢复可把已停止 orchestration 重新置为 running，但不扩大 merge、dirty 或 worktree 权限。

## 全局停止

只有全部非 test 线路都在 `merged`、`parked` 或 `handoff-required` 时才可写停止：

```powershell
node "$skillDir/scripts/orchestrate.mjs" stop eval --write
```

仍有 pending inbox、typed action、merge/post-merge、eligible frontier 或未收敛 lane 时退出 1 并点名；只有完整 Goal 完成条件成立才写入 `stopped/goal-completion-conditions-satisfied`。stop 的读取、重算、复核与写入和 `task create` 共用同一临界区，不能产生 `stopped + active Task`。停止后不再创建 Task、派 Issue 或 merge，也不强杀、reset 或删除现场。collect 重跑必须保留停止记录。

## CLI fallback（只在明确授权时）

兼容入口 `dispatch.mjs` 只作显式 fallback；真实 agent 缺授权原话必须退出 2：

```powershell
node "$skillDir/scripts/dispatch.mjs" $worker --agent claude --fallback-authorized "<用户授权原话>" "实现已确认的 issue"
```

dirty 现场仍需另加 `--confirm-dirty`。server 看板的 fallback POST 还要求本次启动注入的 `X-Board-Token` 和同源 Origin；缺 token 返回 401 `MISSING_TOKEN`，跨源返回 403 `FORBIDDEN_ORIGIN`。server 固定绑定 `127.0.0.1:8321`，不增加外部监听或新路由。

## 看板与 fixture

- LIVE：`node "$skillDir/scripts/server.mjs"`，打开 `http://127.0.0.1:8321/`。
- 快照：先 collect，再打开 `<目标仓根>/.aes-worktree-board/runtime/board.html`；它只读同目录 `status.js`，派发区降级为只读提示。技能目录的 `board.html` 是 server 模板，不再读取历史 runtime。
- fixture 刷新：`node "$skillDir/scripts/capture-issues-fixture.mjs"`。
- 离线生成：`node "$skillDir/scripts/collect.mjs" --no-gh --issues-fixture "$skillDir/fixtures/aes-agent-issues.json"`。

看板 v3 只在既有控制面挂点显示信息：全局编排胶囊、Workers Task/工作时长徽章、详情 Task/时间/transition 区、fallback 授权提示、v2 降级条、Map/List 文案。页面不自行推导业务状态，工作时长只用 status 投影的 registry executor 时间；旧 CLI activeTask 仅在没有 registry Task 时兼容显示。

`POST /api/dispatch` 的锁定字段名是 `worker`；server 为旧调用方兼容接收 `worktree`，但页面与新调用方统一发送 `worker`。500 报文使用 `message`。

## 自检

```powershell
node "$skillDir/scripts/selftest.mjs" orchestration
node "$skillDir/scripts/selftest.mjs" orchestration --scenario storage
node "$skillDir/scripts/selftest.mjs" orchestration --scenario lifecycle
node "$skillDir/scripts/selftest.mjs" orchestration --scenario governance
node "$skillDir/scripts/selftest.mjs" orchestration --scenario continuous
node "$skillDir/scripts/selftest.mjs" orchestration --scenario boundary
node "$skillDir/scripts/selftest.mjs" orchestration --scenario contract
```

默认 `run-tests.mjs` 的 `collect / fixture / dispatch / server / repo-root / layout / windows-hide / orchestration` 全部使用本机或离线 fixture，必须稳定全绿。真实 GitHub 巡检另跑 `node "$skillDir/scripts/selftest.mjs" collect-live`；它是受授权、网络和实时 Issue 变化影响的 live smoke，不进入默认门禁。所有新增 child_process 启动点仍使用 `HEADLESS_CHILD_OPTIONS`。页面视觉与交互必须用真实浏览器逐处对照锁定 mock；自动自检不能替代人工 UI AC。

发布或升级前运行技能根的标准回归入口：

```powershell
node "$skillDir/run-tests.mjs"
```

设计意图、AC 与本轮修复记录见 `references/design.md`；改契约时先更新该文件，再同步 SKILL 与回归断言。
