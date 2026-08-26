<!-- 确认版·锁定 | confirmed 2026-08-25
     用户确认：好的，请继续
     执行 Agent 改的是产品，不是这份对照物。 -->

# 可运行示例：从 runner 初始化到 Issue 自动关闭

示例命令和输出用于确认用户体验；报文字段以 `api-mock.md` 为唯一来源。

## 场景 1：一次性初始化 5 个 runner slots

```powershell
node .agents/skills/aes-worktree-board/scripts/orchestrate.mjs runner init `
  --slots worker-1,worker-2,worker-3,worker-4,worker-5
```

```text
RUNNER_INIT_OK repo=parkth1026/parking-agents integration=dev
config=G:/GIT/AI_WorkFlow/parking-agents/.aes-worktree-board/runner-slots.local.json
slots=5 enabled=5 quarantined=0
  worker-1  clean  branch=worker-1  head=81afa92  capabilities=code,test,browser
  worker-2  clean  branch=worker-2  head=81afa92  capabilities=code,test,browser
  worker-3  clean  branch=worker-3  head=81afa92  capabilities=code,test,browser
  worker-4  clean  branch=worker-4  head=81afa92  capabilities=code,test,browser
  worker-5  clean  branch=worker-5  head=81afa92  capabilities=code,test,browser
```

重复运行：

```text
RUNNER_INIT_NOOP config unchanged digest=sha256:slots-a17c
```

## 场景 2：启动 Master Goal

```powershell
node .agents/skills/aes-worktree-board/scripts/orchestrate.mjs master start
```

```text
MASTER_GOAL_STARTED goal=master-20260825-01
queue eligible=3 rejected-contract=1 awaiting-human=2
dispatch worker-1 -> issue #45 job=job-45-4d2a91 model=standard
dispatch worker-2 -> issue #47 job=job-47-91ab20 model=economy
dispatch worker-3 -> issue #49 job=job-49-fb1202 model=frontier
idle worker-4 reason=no eligible contract-complete issue
idle worker-5 reason=no eligible contract-complete issue
```

## 场景 3：一个 Issue 在同一 owner session 内收敛

```text
[job-45 attempt-1 owner] Worker Goal started: Issue #45 / contract sha256:contract45
[job-45 owner] implement -> commit 6c59e3a
[job-45 review-1 subagent] MUST_FIX F-1: error path bypasses repo binding
[job-45 owner] fixing F-1 in same session
[job-45 owner] follow-up commit a929590; invalidated review/QA for 6c59e3a
[job-45 review-2 subagent] PASS Standards; PASS Spec
[job-45 qa-1 subagent] PASS automated=9 live=2 manual=0
[job-45 owner] READY_TO_MERGE candidate=a929590
[master] merge gate PASS candidate=a929590 integration-pre=4c22f01
[master] HOST_MERGE succeeded merge=81afa92
[master] POST_MERGE_VERIFY PASS run=verify-81afa92
[master] ISSUE_CLOSE #45 comment=sha256:close-evidence-45
[master] runner worker-1 baseline=81afa92 lease=released
```

这条路径不向用户提问。第一次 review BLOCK 是 owner 内部反馈，不是 Master/Goal BLOCK。

## 场景 4：发现非阻塞题外问题

```text
[job-47 owner] DISCOVERED_WORK dw-812f relationship=NON_BLOCKING
[master] dedupe: no existing Issue
[master -> wayfinder] create native Issue + classify workflow=diagnose
[wayfinder] ISSUE_CREATED #52 blockingEdge=false
[master] current job-47 disposition=CONTINUE
[job-47 owner] current AC execution continues
```

## 场景 5：发现 blocking dependency

```text
[job-49 owner] DISCOVERED_WORK dw-9001 relationship=BLOCKING_DEPENDENCY
[master -> wayfinder] ISSUE_CREATED #53; edge #49 blocked-by #53
[job-49 owner] Worker Goal terminal=BLOCKED_DEPENDENCY dependency=#53
[master] release writer lease; keep job resumable
[master] dispatch worker-4 -> issue #53 job=job-53-baa72c
```

只要 #53 也是完整的 `ready-for-agent`，Master 不请求用户；依赖完成后恢复 #49。

## 场景 6：owner session 不可恢复

```text
[master] owner heartbeat stale job=job-47 attempt=attempt-1
[master] resume thread failed code=THREAD_UNAVAILABLE
[master] handoff bundle written digest=sha256:handoff-47
[master] attempt-1 -> TERMINAL_UNRECOVERABLE
[master] create attempt-2 on worker-2 from live head=91ab20
[job-47 attempt-2 owner] resumed AC=4 completed=2 pending=2
```

jobId 不变；旧 attempt 和证据保留。candidate commit 改变时旧 review/QA 自动失效。

## 场景 7：dirty runner 不打断其他 lane

```text
RUNNER_QUARANTINED slot=worker-3 code=DIRTY_WORKTREE tracked=2 untracked=1
dispatch continues available=worker-1,worker-2,worker-4,worker-5
MASTER_ATTENTION reason=runner-quarantine only-if-capacity-exhausted
```

禁止行为：自动 `reset --hard`、自动 clean、覆盖文件、把 dirty 当成 job failure。

## 场景 8：Worker Goal 预算耗尽

```text
[job-58 owner] review loops used=3/3; model upgrades used=1/1
[job-58 owner] Worker Goal terminal=BUDGET_EXHAUSTED blockers=F-7
[master] disposition=NEW_ATTEMPT_FRONTIER_MODEL allowed=false reason=model-budget-exhausted
[master] disposition=AWAITING_HUMAN
```

只有此时才出现用户交互；此前 test/review/QA 失败全部在 owner 内处理。

## 场景 9：人工 QA 暂停与恢复

```text
[job-ui-7 qa] AWAITING_HUMAN url=http://127.0.0.1:8321 checks=3
[master] job state=awaiting-human candidateFrozen=true writerLease=released environmentLease=env-board-1
```

用户完成后：

```text
HUMAN_RECEIPT job=job-ui-7 outcome=PASS checks=3 actor=user
[master] immutable candidate still valid -> READY_TO_MERGE
```

不回复时永不自动 PASS。若人工结果为 FAIL，Master 为同一 job 分配可用 slot 并创建恢复 attempt；不会要求已被复用的旧 runner 回到过去状态。

## 场景 9B：旧 v3 runtime 封存

```text
LEGACY_ARCHIVE_CREATED schema=v3 mode=read-only digest=sha256:legacy-81afa92
NEW_REGISTRY_STARTED schema=aes.worktree-board.registry/v2 jobs=0 attempts=0
SESSION_EVIDENCE_LINK legacyArchive=sha256:legacy-81afa92 rawSessions=referenced
```

不把旧 executor/reviewer Task 猜成新 job/attempt，也不删除任何旧 transition/inbox/session 证据。

## 场景 10：最终停止

```text
MASTER_STATUS
  runners total=5 ready=5 busy=0 quarantined=0
  jobs active=0 awaiting-human=0 blocked=0 merge-queue=0
  inbox pending=0 discovered-work=0
  frontier eligible=0 contract-rejected=0
  git integration=dev head=9ae120f clean=true
MASTER_GOAL_COMPLETE reason=no-authorized-advanceable-work
```

## 必须保持不变的现有用法

```powershell
node .agents/skills/aes-worktree-board/run-tests.mjs
```

改完后仍是发布/升级前的单一回归入口；新增 runner/job/worker/QA 域进入其内部，但调用形式和成功退出码保持不变。
