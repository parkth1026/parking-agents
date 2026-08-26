<!-- 确认版·锁定 | confirmed 2026-08-25
     用户确认：好的，请继续
     执行 Agent 改的是产品，不是这份对照物。 -->

# 接口报文对：Master / Worker / Wayfinder / QA

本文件只锁字段和结局，不锁具体函数名或文件拆分。

## 1. Runner slot 本地配置

```json
{
  "schemaVersion": "aes.worktree-board.runner-slots/v1",
  "repoIdentity": {
    "root": "G:/GIT/AI_WorkFlow/parking-agents",
    "integrationBranch": "dev",
    "issueRepo": "parkth1026/parking-agents"
  },
  "slots": [
    {
      "slotId": "worker-1",
      "worktreePath": "G:/GIT/AI_WorkFlow/parking-agents-worker/parking-agents-worker-1",
      "projectId": "project-worker-1",
      "branch": "worker-1",
      "enabled": true,
      "concurrency": 1,
      "capabilities": ["code", "test", "browser"]
    }
  ]
}
```

错误：

```json
{
  "ok": false,
  "code": "RUNNER_IDENTITY_MISMATCH",
  "slotId": "worker-1",
  "expectedRepoRoot": "G:/GIT/AI_WorkFlow/parking-agents",
  "actualRepoRoot": "G:/GIT/AI_WorkFlow/another-repo",
  "disposition": "QUARANTINE",
  "retryable": false
}
```

## 2. Master → Owner：IssueWorkOrder

```json
{
  "schemaVersion": "aes.issue-worker.work-order/v1",
  "jobId": "job-45-4d2a91",
  "attemptId": "attempt-1",
  "issue": {
    "repo": "parkth1026/parking-agents",
    "number": 45,
    "url": "https://github.com/parkth1026/parking-agents/issues/45",
    "title": "GitHub identity must bind repo and account",
    "contractDigest": "sha256:contract45",
    "workflowRole": "implement",
    "executionPolicy": "for-agent",
    "acceptanceCriteria": [
      {"id": "AC-1", "text": "Wrong account fails closed", "evidenceClass": "automated"},
      {"id": "AC-2", "text": "Correct account and repo pass", "evidenceClass": "live"}
    ],
    "dependencies": [],
    "allowedSideEffects": ["edit-worktree", "run-tests", "create-commit"],
    "humanGates": []
  },
  "runner": {
    "slotId": "worker-2",
    "worktreePath": "G:/GIT/AI_WorkFlow/parking-agents-worker/parking-agents-worker-2",
    "baseCommit": "81afa92c392d537ca4233be8c2daafede620cbc8"
  },
  "routing": {
    "modelTier": "standard",
    "reason": "跨 CLI 与 identity，但 AC 可自动验证",
    "upgradeAllowed": true
  },
  "budgets": {
    "wallClockSeconds": 7200,
    "reviewLoops": 3,
    "qaLoops": 3,
    "environmentRetries": 2,
    "modelUpgrades": 1
  }
}
```

合同拒绝：

```json
{
  "schemaVersion": "aes.issue-worker.work-order-rejection/v1",
  "jobId": null,
  "issue": 46,
  "code": "ISSUE_CONTRACT_INCOMPLETE",
  "missing": ["acceptanceCriteria", "allowedSideEffects"],
  "disposition": "NEEDS_INFO",
  "ownerSessionCreated": false
}
```

## 3. Subagent → Owner：StageResult

Review 通过：

```json
{
  "schemaVersion": "aes.issue-worker.stage-result/v1",
  "jobId": "job-45-4d2a91",
  "attemptId": "attempt-1",
  "stage": "code-review",
  "commitSha": "a929590",
  "outcome": "PASS",
  "findings": [],
  "evidence": [
    {"kind": "standards", "result": "PASS"},
    {"kind": "spec", "result": "PASS", "contractDigest": "sha256:contract45"}
  ],
  "mayAdvance": true
}
```

Review 必修：

```json
{
  "schemaVersion": "aes.issue-worker.stage-result/v1",
  "jobId": "job-45-4d2a91",
  "attemptId": "attempt-1",
  "stage": "code-review",
  "commitSha": "6c59e3a",
  "outcome": "MUST_FIX",
  "findings": [
    {
      "id": "F-1",
      "axis": "Spec",
      "priority": "P1",
      "summary": "error path bypasses repo binding",
      "evidence": "github-identity.mjs error branch",
      "recoveryCondition": "all paths bind account+repo before dispatch"
    }
  ],
  "mayAdvance": false
}
```

未知报文：

```json
{
  "ok": false,
  "code": "UNCLASSIFIED_STAGE_RESULT",
  "stage": "code-review",
  "eventId": "event-review-9",
  "consumed": false,
  "requiredReplacementSchema": "aes.issue-worker.stage-result/v1"
}
```

## 4. QA → Owner：QaReceipt

```json
{
  "schemaVersion": "aes.qa.receipt/v1",
  "jobId": "job-45-4d2a91",
  "attemptId": "attempt-1",
  "commitSha": "a929590",
  "environment": {
    "kind": "local-live",
    "identityDigest": "sha256:env-45",
    "repoRoot": "G:/GIT/AI_WorkFlow/parking-agents-worker/parking-agents-worker-2"
  },
  "impactClasses": ["cli", "github-identity", "external-api"],
  "checks": [
    {"id": "QA-1", "kind": "automated", "outcome": "PASS", "command": "node run-tests.mjs"},
    {"id": "QA-2", "kind": "live", "outcome": "PASS", "summary": "wrong account fails closed"}
  ],
  "outcome": "PASS",
  "unexecuted": [],
  "manualDebt": []
}
```

需要人工：

```json
{
  "schemaVersion": "aes.qa.receipt/v1",
  "jobId": "job-ui-7",
  "attemptId": "attempt-1",
  "commitSha": "f00ba47",
  "environment": {
    "kind": "desktop",
    "url": "http://127.0.0.1:8321/",
    "identityDigest": "sha256:board-env"
  },
  "checks": [],
  "outcome": "AWAITING_HUMAN",
  "candidateFrozen": true,
  "writerLease": "RELEASED",
  "environmentLease": "env-lease-board-1",
  "humanChecklist": [
    {"id": "H-1", "step": "确认页面显示 parking-agents", "expected": "repo badge 与 Issue repo 正确"}
  ],
  "resumeToken": "qa-resume-job-ui-7"
}
```

## 5. Owner → Master：DiscoveredWork

```json
{
  "schemaVersion": "aes.issue-worker.discovered-work/v1",
  "discoveryId": "dw-sha256-812f",
  "jobId": "job-45-4d2a91",
  "attemptId": "attempt-1",
  "currentIssue": 45,
  "relationship": "NON_BLOCKING",
  "title": "runner config still carries stale issueRepo",
  "problem": "board.config.json points to another repository",
  "evidence": [".agents/skills/aes-worktree-board/board.config.json"],
  "suggestedWorkflow": "diagnose",
  "dedupeHints": ["board.config.json", "issueRepo", "repo identity"],
  "currentJobMayContinue": true
}
```

Master disposition：

```json
{
  "schemaVersion": "aes.worktree-board.discovery-disposition/v1",
  "discoveryId": "dw-sha256-812f",
  "outcome": "ISSUE_CREATED",
  "wayfinderActionId": "wf-action-91",
  "issue": 52,
  "blockingEdgeCreated": false,
  "currentJobDisposition": "CONTINUE"
}
```

## 6. Owner → Master：WorkerGoalTerminal

成功：

```json
{
  "schemaVersion": "aes.issue-worker.goal-terminal/v1",
  "jobId": "job-45-4d2a91",
  "attemptId": "attempt-1",
  "outcome": "READY_TO_MERGE",
  "issue": 45,
  "contractDigest": "sha256:contract45",
  "baseCommit": "81afa92",
  "candidateCommit": "a929590",
  "acceptance": [
    {"id": "AC-1", "outcome": "PASS", "evidenceRefs": ["review:R-2", "qa:QA-1"]},
    {"id": "AC-2", "outcome": "PASS", "evidenceRefs": ["qa:QA-2"]}
  ],
  "reviewReceipt": "review-R-2",
  "qaReceipt": "qa-Q-2",
  "unresolvedMustFix": [],
  "unexecutedRequiredChecks": []
}
```

预算耗尽：

```json
{
  "schemaVersion": "aes.issue-worker.goal-terminal/v1",
  "jobId": "job-45-4d2a91",
  "attemptId": "attempt-1",
  "outcome": "BUDGET_EXHAUSTED",
  "issue": 45,
  "candidateCommit": "deadbee",
  "budget": {"kind": "reviewLoops", "limit": 3, "used": 3},
  "remainingBlockers": ["F-7"],
  "recommendedMasterActions": ["NEW_ATTEMPT_FRONTIER_MODEL", "AWAITING_HUMAN"]
}
```

## 7. Master merge/close receipt

```json
{
  "schemaVersion": "aes.worktree-board.delivery-receipt/v1",
  "jobId": "job-45-4d2a91",
  "issue": 45,
  "candidateCommit": "a929590",
  "mergeCommit": "81afa92",
  "integrationBranch": "dev",
  "postMergeVerification": {
    "outcome": "PASS",
    "runId": "verify-81afa92"
  },
  "issueClose": {
    "outcome": "CLOSED",
    "commentDigest": "sha256:close-evidence-45"
  },
  "runnerRelease": {
    "slotId": "worker-2",
    "outcome": "BASELINE_READY",
    "head": "81afa92"
  }
}
```

## 已锁定的约定

- `jobId` 跨 attempt 稳定；`attemptId` 每次 owner session 尝试唯一。
- 所有 review/QA/terminal receipt 都必须带 `candidateCommit`；commit 改变即失效。
- `DISCOVERED_WORK` 不得直接创建 Issue；只有 Master→Wayfinder disposition 能产生外部写入。
- `READY_TO_MERGE` 不等于 merged；Master receipt 才证明 merge、post-merge verify 和 Issue close。
- 未知 schema、缺字段、非闭集值必须 pending/fail closed，不从自然语言补猜。
- secrets 只允许引用 secret identity，不进入任一报文或 runner config。
- `AWAITING_HUMAN` 永不因超时变成 PASS。
- `AWAITING_HUMAN` 释放 writer slot；需保活现场时使用独立 environment lease。人工 FAIL 后同 job 分配新 slot/attempt，不复活已被复用的旧 worktree 状态。
- v3 legacy runtime 只读封存；新 schema 不从旧 Task 猜测 job/attempt，只保存引用与 hash。
