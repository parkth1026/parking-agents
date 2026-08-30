<!-- draft v2 | published 2026-08-30T00:00:00+08:00
     用户意见：补齐实际运行时会调用哪些 Skill
     状态：保留路由例子；双 Host、Surface 与晋级输出由 v4-dual-host-example-run.md 取代 -->

# 编排运行示例：Skill 调用链如何落到一次 Story

**草稿，尚未锁定。** 这是 `v1-example-run.md` 的增量场景。

## 场景：冷启动后决定下一条调用链

```powershell
node skills/workflow-story-map/scripts/story.mjs resume `
  --story github:parkth1026/parking-agents#147 `
  --explain-route
```

候选输出：

```text
NOW   ACTIVE · NEEDS ATTENTION
WHY   requires-decision=1 · awaiting-human=1 · profile-degraded=1
NEXT  D17 确认 API 公共行为 · owner=story-owner · unlocks=4

RECONCILE
  GitHubTrackerAdapter      PASS  revision=82
  GitLabTrackerAdapter      PASS  revision=41
  MembershipReconciler      PASS
  ProfileRegistryLoader     DEGRADED  desktop/profile-abc unavailable
  ReceiptValidator          PASS  valid=9 stale=2 not-run=1
  StoryProjector            PASS  projection-revision=82

ROUTE
  selected workflow         Discovery Coordinator
  selected child workflow   workflow-interview
  selected atomic skill     aes-interview
  reason                    D17 changes public behavior and contract revision
  forbidden route           Delivery auto-continue

NO EXECUTION DISPATCHED
The decision must be answered before affected Delivery tickets can resume.
```

退出码：`30`，表示等待必需的人类决定；不是产品失败。

## 场景：Contract 已确认，创建下一 wave

```text
ROUTE
  workflow-story-map
    → Discovery Coordinator
    → TicketSlicer
    → RiskVerificationPlanner
    → Core proposal validation
    → GitHubTrackerAdapter / GitLabTrackerAdapter

PROPOSALS
  I52 implementation · desktop · risk=high · profile=implementation@3
  Q53 acceptance     · desktop · verifies=I52 · human-test.visual
  I54 implementation · backend · risk=medium · profile=implementation@3

No tracker state is written until every proposal passes Profile and DAG validation.
```

## 场景：执行一张实现票

```text
ROUTE
  workflow-story-map
    → Delivery Coordinator
    → Capability Router
    → BoardExecutionAdapter
    → aes-worktree-board
    → aes-issue-worker
       → tdd | diagnosing-bugs
       ⇄ aes-qa loop
       → simplify
       → aes-qa final receipt
    → aes-merge-worker
       → code-review
       → merge
       → full suite on exact integration SHA
    → ReceiptValidator
    → GateProjector
    → ChangeClassifier

The Core consumes typed events and receipts; no child workflow can write Story done.
```

## 场景：简单自动检查不创建 Agent

```text
ROLE REQUIREMENTS
  context isolation  none
  actor separation   none
  durable receipt    required
  user visibility    no

ROUTER
  selected carrier   deterministic harness
  rejected carrier   Desktop Task — unnecessary scheduling cost

CALL
  node skills/workflow-story-map/run-tests.mjs

RESULT
  receipt.harness PASS · subject=git:c3 · exit=0
```

这证明固定的是 capability 和 Receipt 合同，不是“所有节点一律开独立 Agent”。
