<!-- confirmed P14 | 2026-08-31
     用户确认：好的请继续；仅业务基线，不含 Web 或实现授权
     确认版·锁定不可修改；执行 Agent 改产品，不改本对照物 -->

# 可运行输出：Story Projection v6 候选

**确认版·锁定。** 用户确认：P14（2026-08-31）。 本文件只定义怎么调用、看到什么和退出码；报文结构唯一来源是 `api-mock.md`。

## 场景 1：恢复当前真实 #147

```powershell
node skills/workflow-story-map/scripts/story.mjs project `
  --story github:parkth1026/parking-agents#147
```

```text
STORY github:parkth1026/parking-agents#147
projection  fresh · revision=58 · READ_ONLY

Discovery revisions
  historical  DISC-HISTORICAL-159  #148-#159 · 12 members · 7 native dependencies · CLOSED
  current     DISC-CURRENT-DOSSIER  1-interview DONE · 2-prototype PENDING · 3-contract PENDING

Delivery
  runtime     NOT_CONNECTED
  RepoLanes   0 verified
  WorkTickets 0 verified
  Receipts    0 verified

NEXT  confirm current business prototypes; do not infer Delivery state
exit 0
```

关键点：旧 #147 图仍可审计，但不能冒充本轮 current Discovery revision。

## 场景 2：观察完整 SIM Story，不污染真实 #147

```powershell
node skills/workflow-story-map/scripts/story.mjs project `
  --fixture SIM-STORY-900 `
  --explain-terminal
```

```text
SIMULATED GAP · SIM-STORY-900 · contract@2

RepoLane               Repo / tracker                                  Candidate           Integration       Local Gate
SIM-LANE-SKILL         parking-agents-manual / github                   SIM-SKILL-C3        —                 PENDING
SIM-LANE-RUNTIME       parking-agents / github                          SIM-RUNTIME-C2      SIM-RUNTIME-I7    PASSED

Workstream is not RepoLane:
  SIM-LANE-SKILL/web
  SIM-LANE-SKILL/workflow-core
  SIM-LANE-RUNTIME/projection-runtime

WHY NOT DONE
  1. SIM-LANE-SKILL integration subject missing
  2. SIM-LANE-SKILL FinalFullSuiteReceipt missing

FRONTIER 2
  SIM-WT-SKILL-QA       Role=QAValidator     actor=SIM-ACTOR-QA-7
  SIM-WT-RUNTIME-DOCS   Role=Documenter      actor=unclaimed

exit 0
```

关键点：Frontier 不包含 Story reducer、Gate 或 locked 节点。

## 场景 3：candidate PASS 后 merge 到 integration

```powershell
node skills/workflow-story-map/scripts/story.mjs project `
  --fixture SIM-STORY-900 `
  --after-event SIM-MERGE-SKILL-I8
```

```text
EVENT  integration subject advanced: — -> git:SIM-SKILL-I8

Receipt                                    Bound subject       Current contribution
SIM-RCPT-SKILL-QA-C3                       SIM-SKILL-C3        STALE · audit only
SIM-RCPT-SKILL-FULL-SUITE-I8               SIM-SKILL-I8        MISSING

SIM-GATE-SKILL-CANDIDATE    PASSED
SIM-GATE-SKILL-INTEGRATION  PENDING
SIM-LANE-SKILL              NOT TERMINAL
SIM-STORY-900               NOT DONE

NEXT  run final full suite on git:SIM-SKILL-I8
exit 0
```

关键点：candidate 绿灯不等于 integration 绿灯。

## 场景 4：Role-first Router 解释

```powershell
node skills/workflow-story-map/scripts/story.mjs explain-route `
  --fixture SIM-STORY-900 `
  --ticket SIM-WT-SKILL-42
```

```text
ROLE  QAValidator
requires
  fresh_context=true
  actor_separation=not-implementation-owner
  browser_live=true
  durable_receipt=true

rejected carriers
  harness             missing browser_live, actor_separation
  owner-subagent      missing actor_separation

selected
  independent-task    actor=SIM-ACTOR-QA-7
  reason=smallest carrier satisfying every hard requirement

Skill suggestion is downstream of Role assignment; calling aes-qa does not itself grant QA authority.
exit 0
```

## 场景 5：Contract 不变，自动进入下一 wave

```text
FINDING  SIM-FINDING-COMPAT-2
classification  contract-unchanged
contract        sha256:SIM-CONTRACT-2 (unchanged)
action          create next Delivery wave=3
user decision   not required
exit 0
```

## 场景 6：公共行为变化，回流 Discovery

```text
FINDING  SIM-FINDING-PUBLIC-BEHAVIOR
classification  requires-decision
reason          public behavior / acceptance baseline would change

Delivery
  affected ticket  SIM-WT-SKILL-42 -> PAUSED
  old receipts     remain visible; no longer satisfy revised subject

Discovery
  target ticket    SIM-WT-DECISION-18
  next             obtain user decision and publish contract@3

RETURN CONTEXT
  delivery / SIM-WT-SKILL-42 / filter=frontier / finding anchor preserved
exit 0
```

## 场景 7：Registry digest 缺失

```powershell
node skills/workflow-story-map/scripts/story.mjs project `
  --fixture SIM-STORY-900 `
  --simulate-profile-mismatch
```

```text
DEGRADED_PROFILE_UNAVAILABLE
expected  sha256:SIM-PROFILE-WEB-3
actual    sha256:SIM-PROFILE-WEB-4

allowed  read, diagnose, pause, cancel, release
blocked  claim, dispatch, retry, publish-evidence, project-pass, close, story-done
recovery restore exact Registry definition OR return to Discovery and create replacement ticket
exit 3
```

## 场景 8：Projection Runtime 只同步，不调动 Agent

```powershell
node skills/workflow-story-map/scripts/projection-runtime.mjs watch `
  --story github:parkth1026/parking-agents#147
```

```text
PROJECTION_RUNTIME  listening · READ_ONLY · source revision=58
SYNC  tracker index unchanged
SYNC  dossier digest changed -> rebuild revision=59
PUBLISH  SurfaceDocument revision=59
AGENT  start/resume/stop unsupported by this runtime
WEB COMMAND CHANNEL  absent
```

关键点：运行时只读取、校验、重建与广播；不保活模型 turn，不管理 Provider/Task/lease。

## 场景 9：Web 尝试 claim

```text
REQUEST  web domain command: claim SIM-WT-SKILL-42
REJECTED READ_ONLY_SURFACE
canonical_changed=false
allowed view actions=search,filter,select,history,diff,evidence,export,local-bookmark
exit 2
```

## 场景 10：P13 required-only 收口与 optional debt

对应 `api-mock.md` §2A 的后续快照；不表示当前真实 #147 已交付。

```powershell
node skills/workflow-story-map/scripts/story.mjs project `
  --fixture SIM-STORY-900-P13-DONE `
  --explain-terminal
```

```text
SIMULATED GAP · SIM-STORY-900 · contract@2
REQUIRED LANES  2/2 satisfied
  SIM-LANE-SKILL    integration=SIM-SKILL-I8    final full suite=PASS
  SIM-LANE-RUNTIME  integration=SIM-RUNTIME-I7  final full suite=PASS
GLOBAL REQUIRED OBLIGATIONS  none pending
STORY TERMINAL  done

OPTIONAL DEBT  1 (does not change required Gate results)
  lane      SIM-LANE-REPORTS
  state     active / blocked / pending   (unchanged)
  owner     SIM-ACTOR-REPORTS-OWNER
  reason    optional demo environment unavailable
  impact    optional demo unavailable; required deliverables unaffected
  recovery  Workflow/Skill repairs environment and resumes this Lane
  web       read-only explanation; no resume command

exit 0
```

边界对照：

```text
required final suite MISSING + optional PASS   -> NOT DONE
required valid Waiver + optional BLOCKED      -> done-with-waiver + optional debt
required dependency missing in optional Lane  -> NOT DONE (required Gate still blocked)
change required to optional in same Contract  -> REJECTED; return to Discovery
```

这些是合成结果，不是将 optional Lane 强制关闭或标绿。

## 必须保持的旧用法边界

- `workflow-interview` 仍由自己的 `session.mjs` 管理 manifest/rounds/stage；Projection Runtime 不写这些文件。
- `aes-worktree-board` 仍管理 worktree/Task/merge runtime；Story Projection 不伪造 board terminal。
- `wayfinder` 仍处理 planning-only 路线未知问题；它的 frontier 语法可参考，但不被嵌入为第二 Story 控制器。
- 当前脚本和输出均为对照物，不代表实现已存在；真实运行证明仍为 `NOT_CONNECTED`。

