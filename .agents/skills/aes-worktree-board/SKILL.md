---
name: aes-worktree-board
description: 在主仓巡检并编排本仓既有 worktree（同级或嵌套在子目录里）：采集全仓 Issue Map/List 与队员坐标，用 Desktop create_thread 派发可见 Task，以 registry/inbox/三维 verdict/熔断/全局停止协议恢复和审计执行，并启动需求星图看板。用户要查看所有 worktree、Issue frontier、调度实现与独立 review、判断并执行受门禁保护的合并、恢复中断编排或打开看板时使用。
---

# AES Worktree Board

把主仓对话作为 Orchestrator，把 Desktop Task 作为正常执行单元，把看板作为同一份事实的可视入口。宿主工具负责 `create_thread`、`wait_threads` 与合并动作；脚本不模拟宿主工具，只把每次宿主动作登记为可恢复、幂等、可审计的控制面事实。（此为 v3 lane 语义；v4 角色分化后，merge 权归 aes-merge-worker lane，见「v4 无人值守控制面」。）

脚本只负责 collect/record/lock/validate/render；脚本不负责自主调度、任务选择或替代宿主的 Desktop Task 生命周期。

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

GitHub 身份是 live Issue 操作的独立边界：配置可用 `githubAccount` 与
`githubHost`，也可用嵌套的 `github.account` / `github.host`；环境覆盖为
`AES_WORKTREE_BOARD_GITHUB_ACCOUNT` / `AES_WORKTREE_BOARD_GITHUB_HOST`。
同一 host 检测到多个 `gh auth status --json hosts` 账号而未声明目标账号时，
collect、fixture capture、Issue 读写和 fallback 必须以 `IDENTITY_REQUIRED`
fail closed。执行前绑定 `gh api user` 的 viewer 与目标仓库
`viewerPermission`；身份不匹配、权限不足、仓库 404、网络失败分别保持
`IDENTITY_MISMATCH`、`PERMISSION_DENIED`、`REPO_NOT_FOUND`、
`NETWORK_FAILURE`，不能依赖 remote URL 用户名或 gh 默认 active account。
凭据只由宿主在当前进程/子进程注入 `GH_TOKEN`（GHES 使用
`GH_ENTERPRISE_TOKEN`）；不得切换全局账号，或把 token 写入 argv、prompt、
日志、fixture、runtime JSON、配置和 Task 记录。worker/reviewer prompt 只能
带无密钥的 host/account/repository identity 要求。

`collect.mjs`、`server.mjs`、`capture-issues-fixture.mjs` 与 `dispatch.mjs` 必须共用 `loadConfig()` 这条解析链，不得各自回读技能目录配置或把目标仓配置当成运行时产物。

collect preflight 必须验证目标仓存在 `mainBranch`；真实 GitHub 采集还必须验证 `issueRepo` 可访问，错配退出 2 并点名字段。

runtime 选址链保持不变：`AES_WORKTREE_BOARD_RUNTIME_DIR` 优先，否则 `<目标仓根>/.aes-worktree-board/runtime/`。已有 `status.json` 的 `repo.root / issueRepo / mainBranch` 必须与本次目标 identity 一致，否则以 `REPO_MISMATCH`、exit 2 拒绝复用，不能沿用其中的 Issue 或控制面事实。collect 在锁前快检一次、取得 runtime 锁并重读最终快照后再校验一次，阻止两个目标仓从同一空 runtime 并发写成 last-writer-wins。目标仓应忽略这个目录。技能目录历史 `runtime/`（含 03:21 快照与 `orchestration-stop.json`）只是只读归档证据：不得删除、移动或由脚本继续读写。

## 不可越过的边界

- 只操作 `git worktree list` 中归属本仓的既有 worktree —— 归属以 `git rev-parse --git-common-dir` 判定，同级、嵌套一层或多层都采集，主仓自身与 Temp 下的一次性 worktree 除外；`task create` 会把短名与完整 basename 规范化为同一 worker identity，并拒绝不存在的 worktree；不创建、不删除 worktree；`test` worktree 不参与自动调度。
- dirty worktree 必须先复述修改数与未跟踪数；用户确认后才可继续，确认不能越过 registry 租约。
- 正常派发只用 Desktop `create_thread`。真实 CLI fallback（`cli-fallback`）必须保留用户授权原话；`test` 假 agent 仅供 selftest 豁免。
- 新建 executor、reviewer 与 master/subagent Task 统一使用 `luna-max`；每个 TaskRecord 必须记录 `modelTier` 与 `routingReason`。历史 registry 中已有的 `sol-high` 只作为不可篡改的审计事实保留，不得复用或新建。
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

1. 在目标主仓运行 `node "$skillDir/scripts/collect.mjs"`。若 integration branch 不是技能默认的 `main`，必须显式设置 `AES_WORKTREE_BOARD_MAIN_BRANCH`（例如 `dev`）；只有明确沿用快照时才加 `--no-gh`。
2. 读取 `runtime/status.json`，以 registry 派生的 `worktree.task` 与 `orchestration` 为控制事实，再检查 Git ahead/behind、dirty、mergeCheck、Issue 依赖和测试证据。
3. 仍用 `assess.mjs` 写每个节点的业务判断：

   `node "$skillDir/scripts/assess.mjs" $worker --merge not-yet --done unknown --task "待确认任务" --reason "证据不足"`

4. 输出每个 worker 的位置、Task state、三维 verdict、BLOCK 次数、完成度和下一动作；另列 frontier 与空闲 worker。

collect 的 `graph.issues[].labels` 必须保留 GitHub/fixture 输入的 labels（包括 `ready-for-agent`）；live 查询与完整离线 fixture 使用同一字段，快照回退也承接已有 labels，不能用空数组覆盖真实标签。

`recommend`/`MERGE_READY` 需要 code/spec 门禁通过、交付条件闭环、Git 可合并和证据诚实。autonomous 类 Issue 可在 `runtime=NOT_RUN` 时进入 MERGE_READY；明确要求真机的 Issue 不可。合并是宿主主 agent 的受门禁动作（v3 lane 语义；v4 下 merge 权归 aes-merge-worker，见「v4 无人值守控制面」）：合并前重新核对 registry 与 Git，合并后登记 `merged` 和 merge commit，并在 main 复验。

## Desktop create_thread 正常路径

1. 先用宿主 `list_projects` 找到既有 worktree 对应的 saved project，使用 `environment: local`；不得为已登记 worktree 创建额外 worktree。
2. 根据 Issue、AC、风险与模型档组织自包含 prompt。
3. 调用宿主 `create_thread` 创建侧边栏可见 Task；记录返回的真实 `threadId`（或排队时的 `clientThreadId`，拿到真实 id 后补齐）。
4. 立刻原子登记 Task 与 worktree 租约：

```powershell
node "$skillDir/scripts/orchestrate.mjs" task create --issue 17 --worktree dev4 --role executor --thread-id T-01HXYZ --model luna-max --routing-reason "单包 AC 明确，自动测试可覆盖"
```

Task create 与租约占用是同一笔 registry 原子更新。相同 worktree 的竞争者必须退出 2 `LOCKED`，不得靠 PID 判活后再占锁。长执行可用：

```powershell
node "$skillDir/scripts/orchestrate.mjs" task heartbeat --task tk-dev4-17-g1
```

宿主用 `wait_threads` fan-in 事件；每个返回的 Task 由 `read_thread` 核对最终消息、阶段与交付证据。reviewer 的 finding、修复要求和后续指令通过 `send_message_to_thread` 返回原 executor Task；不要让脚本或页面猜测 Task 结果，也不要默认创建新的 fix Task。

排队创建只拿到 `clientThreadId` 时仍登记为 `desktop-thread`；拿到真实 id 后原子补齐：

```powershell
node "$skillDir/scripts/orchestrate.mjs" task attach-thread --task tk-dev4-17-g1 --thread-id T-01HXYZ --host-id H-01 --project-id P-01
```

executor 到达 `committed` 后，独立 reviewer 以 `--parent-task-id` 加入同一 generation。reviewer 是只读 Task，不取得或释放 writer 租约；它的 thread 事件只有在明确关联该 executor 时才能写入父 Task：

```powershell
node "$skillDir/scripts/orchestrate.mjs" task create --issue 17 --worktree dev4 --role reviewer --parent-task-id tk-dev4-17-g1 --thread-id T-02R --model luna-max --routing-reason "独立 code/spec review"
```

旧候选因 master 接管、冲突停放后，不能让 parked Task 永久占住 writer lease。确认该 executor
对应 worktree clean、没有活跃关联 reviewer 后，使用带人工授权的 lane release 释放旧 lane；它只
释放租约并保留完整旧 Task/commit 审计，不改变旧候选的 review 结论，也不把它改成 merge-ready：

```powershell
node "$skillDir/scripts/orchestrate.mjs" task release --task tk-dev4-17-g1 `
  --authorization-id issue-17-lane-reuse-1 `
  --authorization "用户明确授权回收已停放候选并继续领取新 Issue" `
  --reason "旧候选已由 master 接管，clean lane 可复用"
```

release 是幂等且 append-only 的控制面动作；脏 worktree、缺失 writer lease、活跃关联 Task 或不同
授权原文都会 fail closed。释放后 `next-actions` 才会为该 worker 生成 `CLAIM_NEXT_ISSUE`，新 Task
必须使用更高 generation 和 `luna-max`；不得手改 registry/lease，也不得直接把旧 parked Task
改写成新 Issue。

## 事件 fan-in 与幂等消费

`wait_threads` 一次返回的 wake 与所有 polls 必须全部入箱，不能只处理第一个唤醒项：

```powershell
node "$skillDir/scripts/orchestrate.mjs" inbox put --thread T-02R --task tk-dev4-17-g1 --kind final --payload-file poll.json
node "$skillDir/scripts/orchestrate.mjs" consume --event-id E-7f3a
```

宿主事件有 id 就沿用；否则 eventId 为 thread/kind/payload 摘要的稳定 SHA-1 前 12 位。入箱与消费都校验 thread→Task 直接归属或 reviewer→parent 关联；foreign thread 必须退出 2 `THREAD_TASK_MISMATCH`，不得覆盖 cursor 或 verdict。`approved` 只接受 reviewer `final|verdict` 的显式 `APPROVE|PASS`；普通 commentary/progress 的 `payload.to` 不能冒充裁决。reviewer `final|verdict` 入箱时，`--thread` 必须是 reviewer thread，而 `--task` 必须是它的父 executor Task；不能把 verdict 入到 reviewer 自身 Task。reviewer `BLOCK` consume 在同一 registry 原子更新内完成 commit 校验、去重、计数与 `fixing|handoff-required` 转移，继续返回锁定的 `result=consumed`；显式 `block record` 复用同一逻辑。同一 eventId 再次消费必须返回 `already-consumed`、退出 0、零状态变化。合法 late event 可以落箱和消费但不得复活终态；malformed executor final 例外，必须保持 pending `UNCLASSIFIED_FINAL`。

最终 reviewer `APPROVE|BLOCK` 被父 executor Task 消费时，控制面必须在同一 registry 更新中把事件来源 reviewer 收口为 `parked`、`phase=qa-complete`，记录 reviewer verdict evidence 和 `finishedAt`；不能只推进父 Task 而遗留 `executing` reviewer。历史 registry 若因旧版本留下这种可由父 Task 证据证明的活跃 reviewer，使用证据约束的恢复命令，不得手改 JSON：

```powershell
node "$skillDir/scripts/orchestrate.mjs" task reconcile-reviewer --task tk-dev4-17-g1-review-1
```

该命令只接受父 Task 已消费且精确绑定 reviewer thread、最终 verdict 和 `reviewCommit` 的证据；缺证据、父 Task 状态不匹配或 commit 不一致都会 fail closed，已收口的 reviewer 重放则幂等返回。

`collect` 的 worker `head` 允许是展示用短 SHA；控制面在 `next-actions`、merge gate 和 receipt 绑定中必须把 observed/registered 值解析为同一 worktree 的完整 Git commit object 后再比较，不能直接比较短字符串与完整 SHA。通过 Windows junction 调用脚本时，CLI 主模块判断必须按 realpath 归一化；命令不能出现“exit 0 但没有写入/输出”的静默 no-op。

`assessment` 是主 agent 的人工判断，不是 collect 自动推断的事实；当 `stale=true` 时，文本 collect 只显示过期提示，不得把旧 reason 当作当前 merge 结论。必须先用 fresh collect 与 registry/Git 证据重评，再通过 `assess.mjs` 写入新的 assessment。

## 显式 Goal 与连续编排闭环

只有用户明确要求“持续自动编排直到无可推进任务”时，root 才创建 Goal；状态巡检、打开看板、
导出快照等 one-shot 操作不得调用 `goal start`。先运行 fresh collect，再锁定 worker 范围：

```powershell
node "$skillDir/scripts/orchestrate.mjs" goal start --workers dev1,dev2,dev3 --execution-mode one-task-per-worker --manual-test-policy "needs-manual-test + explicit debt permits runtime=NOT_RUN"
```

`execution-mode` 默认为 `continuous`；用户要求每个 worker 只消化当前一张单时，使用
`one-task-per-worker`，或对已有 active Goal 用受审计命令切换：

```powershell
node "$skillDir/scripts/orchestrate.mjs" goal set-mode --mode one-task-per-worker `
  --authorization-id one-task-qa-only-1 `
  --authorization "每个 worker 完成一次任务即可，不需要循环；只做好执行与 QA 流程" `
  --reason "完成当前任务后不再自动领取下一 Issue"
```

该模式不会取消正在执行的 Task；只取消尚未创建 executor 的 pending claim reservation，保留历史
审计，并在当前 Task 收口后不再生成下一 Issue。`CREATE_REVIEWER` 在该模式下仅表示独立
`aes-qa` 验证，不能派发 code-review；`simplify` 由用户策略明确免除。

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

`CREATE_REVIEWER` receipt 与 reviewer verdict 必须同时满足（one-task 模式下 reviewer 只执行
独立 QA，不执行 code-review）：
`reviewer.reviewCommit === task.commitSha === action/event.commitSha`。`EVALUATE_MERGE_GATE`
receipt 必须绑定 live worktree HEAD、integration HEAD、integration branch，并由脚本实时运行
`git merge-tree`。`HOST_MERGE started/succeeded` 分别绑定 live preHead 与 postHead；succeeded
会再次读取 worker live HEAD，并只接受恰好两个 parent、第一父为 preHead、第二父精确等于已 review
commit 的真实 Git merge commit；worker 前进到未审 commit、octopus merge 均明确拒绝。若 master
session 已在控制面之外完成了该真实 merge，可用同一 `HOST_MERGE` action 的 `status=observed`
回填；它仍会现场验证 branch、worker HEAD、pre/post HEAD 与两父关系，不能注入任意 merge SHA，
且回填后仍必须执行 `POST_MERGE_VERIFY` 才进入 `merged`。

`POST_MERGE_VERIFY` 不接受宿主自报的 `exitCode=0` JSON。先把 executable/args 写入 commands file，
由脚本在 integration repo root 实际执行：

```powershell
node "$skillDir/scripts/orchestrate.mjs" action verify --action-id A-... --commands-file post-merge-commands.json
```

脚本生成与 action/mergeCommit/live HEAD 绑定的 `verificationRun`，全部真实命令 exit 0 且 HEAD
未变化后，才原子写 POST receipt、进入 `merged`、释放 lease。`CLAIM_NEXT_ISSUE` 在 action 生成时
即按 Issue 编号写 claim reservation；active/pending/succeeded claim 都从 stale frontier 排除，
直接 `task create` 还会扫描 Registry 内其他 worker 的未 merged executor Task，不能绕过
reservation 重复认领；receipt 必须绑定同 reservation/worktree 的新 executor Task。多 worker 可并行
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

## 状态机、三维 verdict 与 BLOCK 熔断

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
该 commit 必须是可解析的 Git object、等于原 executor worktree live HEAD，且是 blocked commit 的
新 descendant；`RETURN_TO_EXECUTOR` receipt 也必须绑定原 executor thread。
授权恢复可把已停止 orchestration 重新置为 running，但不扩大 merge、dirty 或 worktree 权限。

已入箱但因 full/short SHA 字符串绑定不一致而无效、且已有同 reviewer/thread/verdict 的较晚合法
replacement 被消费时，可用受审计 dead-letter 命令收敛；它不写 `consumedEventIds`，也不接受任意
reason 或合法事件：

```powershell
node "$skillDir/scripts/orchestrate.mjs" inbox reject --event-id E-old --reason SUPERSEDED_REVIEW_BINDING --replacement-event-id E-new --authorization-id decision-1 --authorization "<用户授权原文>"
```

## 全局停止

只有全部非 test 线路都在 `merged`、`parked` 或 `handoff-required` 时才可写停止：

```powershell
node "$skillDir/scripts/orchestrate.mjs" stop eval --write
```

仍有 pending inbox、typed action、merge/post-merge、eligible frontier 或未收敛 lane 时退出 1 并点名；只有完整 Goal 完成条件成立才写入 `stopped/goal-completion-conditions-satisfied`。stop 的读取、重算、复核与写入和 `task create` 共用同一临界区，不能产生 `stopped + active Task`。停止后不再创建 Task、派 Issue 或 merge，也不强杀、reset 或删除现场。collect 重跑必须保留停止记录。

## CLI fallback（`cli-fallback`，只在明确授权时）

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
- Issue 读写：`node "$skillDir/scripts/github-issue.mjs" --repo owner/name --account target-login -- issue view 45 --comments`。

看板 v3 只在既有控制面挂点显示信息：全局编排胶囊、Workers Task/工作时长徽章、详情 Task/时间/transition 区、fallback 授权提示、v2 降级条、Map/List 文案。页面不自行推导业务状态，工作时长只用 status 投影的 registry executor 时间；旧 CLI activeTask 仅在没有 registry Task 时兼容显示。server API 响应携带专属 `aes-worktree-board/1` marker；监听端口已被占用时只有 marker、v3、generatedAt、repo、graph（issues/edges/stats）与 worktrees 完整通过 schema 校验后才比较既有 `/api/status?fast=1` identity。另一目标仓返回 `REPO_MISMATCH`，同仓、repo-shaped 非 board 或 marker 正确但 status 不完整的进程返回 `PORT_CONFLICT`，均 exit 2，且不得把既有实例输出成当前启动成功。

`POST /api/dispatch` 的锁定字段名是 `worker`；server 为旧调用方兼容接收 `worktree`，但页面与新调用方统一发送 `worker`。500 报文使用 `message`。

## v4 无人值守控制面（目标 A）

在既有 v3 Task 编排之外，`master.mjs` 提供 runner / job / attempt 分层的无人值守控制面。
v3 runtime 被**只读封存**：只记录路径与 hash 引用，绝不反向推导 job/attempt。

### runner slot

本机 slot allowlist 是 Git 忽略的 `<目标仓根>/.aes-worktree-board/runner-slots.local.json`
（schema `aes.worktree-board.runner-slots/v1`），由确定性脚本生成，LLM 只能消费。
重复生成是幂等 NOOP；改配置必须显式 update。

slot 有四类不可领取状态，每类都带原因与恢复命令：

| 状态 | 触发 | 处置 |
| --- | --- | --- |
| `QUARANTINED_CONFIG_DRIFT` | 路径指向别的仓 | 只有显式 `runner update/init` 能修 |
| `QUARANTINED_DIRTY` | 有 dirty/untracked | **绝不** reset/clean；其余 slot 继续调度 |
| `QUARANTINED_MISSING` | 路径不存在 | 确认 worktree 后 update |
| `idle` + `needsBaselineSync` | 未同步到 integration HEAD | `master.mjs release --slot <id>` |

slot allowlist 为空时 Master Goal **拒绝启动**并非零退出，不由 LLM 自动补 slot。

### 一个 job 的完整路径

```bash
node "$skillDir/scripts/master.mjs" start
node "$skillDir/scripts/master.mjs" claim --issue-file <issue.json>
node "$skillDir/scripts/master.mjs" candidate --job <jobId> --commit <sha>
node "$skillDir/scripts/master.mjs" stage review --job <jobId> --payload-file <stage-result.json>
node "$skillDir/scripts/master.mjs" stage qa --job <jobId> --payload-file <qa-receipt.json>
node "$skillDir/scripts/master.mjs" terminal --payload-file <goal-terminal.json>
node "$skillDir/scripts/master.mjs" gate --job <jobId>
node "$skillDir/scripts/master.mjs" merge --job <jobId>
node "$skillDir/scripts/master.mjs" verify --job <jobId> --commands-file <commands.json>
node "$skillDir/scripts/master.mjs" close --job <jobId>
node "$skillDir/scripts/master.mjs" release --job <jobId> --slot <slotId>
```

`jobId` 跨 attempt 稳定；`attemptId` 每次尝试唯一。旧 attempt 与证据永不覆盖。

### 分档 merge gate

`riskProfile` 由 Issue 自报，而**自报环节正是不可信处**，所以 Master 按改动路径兜底校验：
触及 identity、权限、密钥、安全边界、schema/迁移、公共 API、CI 的改动会被强制升档，
并在 `triggeredRules` 里指名是哪条规则。

| 生效档 | 行为 |
| --- | --- |
| `low` / `medium` | 机械门全绿即自动 merge |
| `high` | 机械门全绿**仍**停在 humanGate 等人工批准 |
| `critical` | 拒绝直接 merge，只走 PR；waiver 也不能覆盖 |

机械门六项固定顺序：slot → commit → integration → acceptance → review → QA。
其中 review/QA receipt 的 `commitSha` 必须与当前 candidate commit **精确相等**——
旧 commit 的证据不能给新 commit 背书；QA 含 `NOT_RUN` 或 `unexecuted` 非空一律判失败。
commit 前进只能走 `candidate` 命令（那里作废旧证据）；terminal 报文里的
`candidateCommit` 与 registry 不一致时拒收（`CANDIDATE_MISMATCH`），不推进状态。

### aes-merge-worker（合并验收 worker，待建）

v4 的角色分工是 **hub-and-spoke**：总管只管 claim / 派单 / slot / queue / 打回与
人工态路由，**不亲自执行合并**；合并验收是挂在总管之下的专职 worker lane
（`aes-merge-worker`），与 aes-issue-worker 平级、零直连——一切交接经 registry。

merge-worker 消化 mergeQueue 的完整职责：

1. 从 queue 领取 ready-to-merge 的 job；
2. 派独立 `code-review` subagent（Standards+Spec 双轴；深度按 `resolveMergePolicy`
   的 **effectiveRisk** 分档——含路径兜底，比工单自报档更准），review receipt 由
   merge-worker 侧 `stage review` 上报——**被审的 worker 无法自报 review PASS**；
3. review PASS → gate 六项 → 串行 merge → **merge 后全量回归**（commands file 跑
   全量套件，非 targeted）→ 幂等 close → release slot；
4. review MUST_FIX → 以 `aes.issue-worker.review-return/v1` 经总管打回原 owner
   session（原 thread 优先、新 attempt 兜底）：报文含 `jobId`/`attemptId`/
   `commitSha`（必须等于被审 candidate）、`findings[]`（`axis` 闭集
   `standards|spec`）、`budget.reviewLoops`。同一打回单据以新 commit 闭合，不重复
   消费；worker 修复后必须重走 aes-qa 回归再重新 READY；
5. **reviewLoops 由 merge-worker 记账**（每次打回递增）；耗尽后回
   `REVIEW_BUDGET_EXHAUSTED`，由总管决策（`NEW_ATTEMPT_FRONTIER_MODEL` /
   `AWAITING_HUMAN`）。普通 finding（非 must-fix）merge-worker 侧自行记录，
   不打回、不烦扰 worker。

本节先锁协议，实现另票（载体形态——独立 session 占 host worktree 还是总管兼任——
依宿主能力定）。机械上 merge-worker 与总管调用同一套 `master.mjs` CLI 操作同一
registry，零 schema 改动。

### 中断恢复

Master 死亡后人工重启，只凭 registry / inbox / receipts + Git 恢复：

```bash
node "$skillDir/scripts/master.mjs" reconcile
```

**判定 merge 是否真的发生，问 Git 不问状态位。** merge 前先落 `mergeIntent`，
reconcile 用 `git merge-base --is-ancestor` 核实 candidate 是否已在 integration 中：
在则认领既有 merge，不在则退回队列重排。这是「无重复 merge / 无丢失 job / 无假完成」
的实际依据 —— 进程可能在写状态位之前就死了，Git 不会。

reconcile 输出对每个 job 与每个 slot 都给可解释状态；`unexplainedJobs` /
`unexplainedSlots` 必须为 0。

### 人工态

`awaiting-human` / `blocked-permission` / `contract-conflict` 三个终点必须携带
`humanRequest{kind, prompt, requiredEvidence, resumeToken}`。缺 `resumeToken` 的报文
schema 拒收且**不推进状态**。人工答复必须 `actor: "human"`，Agent 不得代答；
`WAIVED` 需要结构化 `waiver{reason, loweredCriteria, authorizedBy}`。

### 700×1000 竖屏工作台

产品在 `(max-width: 900px) and (orientation: portrait)` 下切换到竖屏工作台，
渲染在 shadow root 内，与桌面全屏星图完全隔离（桌面层 id 与样式互不可见）。
该区段由 `scripts/build-portrait.mjs` 从确认版对照物 `mock.html` 机械生成并记录其
sha256；`board-ui` 域会核对生成物与真源同步，以及产品与 mock 的**逐像素**一致。
改视觉走「改 mock → 重跑 build-portrait.mjs」，不要手改 board.html 的生成区段。

### 真实宿主门（离线门代替不了的证据）

```powershell
node "$skillDir/scripts/live-gate.mjs" desktop --repo <目标仓根>
node "$skillDir/scripts/live-gate.mjs" worktrees --repo <目标仓根> --branch <integration> --paths <p1,p2,...>
node "$skillDir/scripts/live-gate.mjs" live-receipt --repo <目标仓根> --host <host worktree> --branch <integration> --issue-repo <owner/name>
```

`worktrees` 是**纯只读**校验：它比对每个 worktree 前后的完整指纹（HEAD / branch /
status / stash / reflog），前后不一致即判定「只读校验产生了写副作用」。只读如果不被
机械证明，就只是一句承诺。

receipt 一律落在 Git 忽略的 `<目标仓根>/.aes-worktree-board/receipts/`，不进版本库：
写进受版本控制的目录会让每次跑门禁都把 worktree 弄脏，slot 随即被 `QUARANTINED_DIRTY`，
交付循环在释放 slot 那一步就死锁了。

真实宿主门证明的是离线门结构上看不到的东西。已经抓到的两类：只在**第二份检出**上
存在的换行耦合（真源 SHA 绑定工作区字节、生成器锚点吃不掉 CRLF），以及只在**复用真实
slot** 时才走到的自我污染路径。离线 fixture 每次用全新临时仓，这两类永远碰不到。

## 自检

```powershell
node "$skillDir/scripts/selftest.mjs" orchestration
node "$skillDir/scripts/selftest.mjs" orchestration --scenario runner-lifecycle
node "$skillDir/scripts/selftest.mjs" orchestration --scenario recovery
node "$skillDir/scripts/selftest.mjs" orchestration --scenario trajectory-replay
node "$skillDir/scripts/selftest.mjs" orchestration --scenario discovered-work
node "$skillDir/scripts/selftest.mjs" orchestration --scenario delivery-merge
node "$skillDir/scripts/selftest.mjs" board-ui --baseline 700x1000
node "$skillDir/scripts/selftest.mjs" orchestration --scenario storage
node "$skillDir/scripts/selftest.mjs" orchestration --scenario lifecycle
node "$skillDir/scripts/selftest.mjs" orchestration --scenario governance
node "$skillDir/scripts/selftest.mjs" orchestration --scenario continuous
node "$skillDir/scripts/selftest.mjs" orchestration --scenario boundary
node "$skillDir/scripts/selftest.mjs" orchestration --scenario contract
```

默认 `run-tests.mjs` 的 `collect / fixture / dispatch / server / repo-root / layout / windows-hide / orchestration / identity / board-ui` 全部使用本机或离线 fixture，必须稳定全绿。真实 GitHub 巡检另跑 `node "$skillDir/scripts/selftest.mjs" collect-live`；它是受授权、网络和实时 Issue 变化影响的 live smoke，不进入默认门禁。所有新增 child_process 启动点仍使用 `HEADLESS_CHILD_OPTIONS`。页面视觉与交互必须用真实浏览器逐处对照锁定 mock；自动自检不能替代人工 UI AC。

发布或升级前运行技能根的标准回归入口：

```powershell
node "$skillDir/run-tests.mjs"
```

身份隔离专项回归也可单独运行：

```powershell
node "$skillDir/scripts/selftest.mjs" identity
```

设计意图、AC 与本轮修复记录见 `references/design.md`；改契约时先更新该文件，再同步 SKILL 与回归断言。
