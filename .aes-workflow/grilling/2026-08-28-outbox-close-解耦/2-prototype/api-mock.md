# 接口报文对: aes-merge-worker 落地（#126）

**确认版·锁定。** 执行 Agent 改的是产品，不是这份报文对。
用户确认：2026-08-28（P1–P4 见 rounds.jsonl；P2 采纳 acknowledge 修改）

定报文结构（字段名、类型、有没有、错误形态）。每种结局给一对具体报文。

## 1. 出站条目 `aes.worktree-board.outbox-entry/v1`

落盘于 `<runtime-v4>/outbox.jsonl`，append-only；状态推进以**追加新行**表达，读取时按
`entryId` 取最后一行为准（与 `transitions.jsonl` 同款）。

`state` 闭集：`pending` / `succeeded` / `abandoned` / `acknowledged`。

### 1a. `close` 入队时写入（pending）

```json
{
  "schemaVersion": "aes.worktree-board.outbox-entry/v1",
  "entryId": "ob-job-69-111801-9f3a2c",
  "kind": "issue-close",
  "jobId": "job-69-111801",
  "issue": 69,
  "repo": "parkth1026/parking-agents",
  "commentDigest": "sha256:4b1d…",
  "payload": {
    "comment": "已交付：job-69-111801\ncandidate: cf6b12a…\nmerge: 9004b5f… → dev\npost-merge verification: PASS",
    "closeIssue": true
  },
  "state": "pending",
  "attempts": [],
  "createdAt": "2026-08-28T11:18:04.221Z"
}
```

### 1b. flush 成功后追加（succeeded）

```json
{
  "schemaVersion": "aes.worktree-board.outbox-entry/v1",
  "entryId": "ob-job-69-111801-9f3a2c",
  "kind": "issue-close",
  "jobId": "job-69-111801",
  "issue": 69,
  "commentDigest": "sha256:4b1d…",
  "state": "succeeded",
  "attempts": [ { "at": "2026-08-28T11:22:31.004Z", "outcome": "SUCCEEDED", "error": null } ],
  "settledAt": "2026-08-28T11:22:31.004Z"
}
```

### 1c. 三次失败转 abandoned（本次 job-69 实况）

```json
{
  "schemaVersion": "aes.worktree-board.outbox-entry/v1",
  "entryId": "ob-job-69-111801-9f3a2c",
  "kind": "issue-close",
  "jobId": "job-69-111801",
  "issue": 69,
  "state": "abandoned",
  "abandonReason": "ISSUE_UNREACHABLE",
  "attempts": [
    { "at": "…:22:31Z", "outcome": "FAILED", "error": { "code": "GH_COMMAND_FAILED", "stderr": "Could not resolve to an Issue with the number of 69." } },
    { "at": "…:24:02Z", "outcome": "FAILED", "error": { "code": "GH_COMMAND_FAILED", "stderr": "Could not resolve…" } },
    { "at": "…:26:10Z", "outcome": "FAILED", "error": { "code": "GH_COMMAND_FAILED", "stderr": "Could not resolve…" } }
  ],
  "settledAt": "2026-08-28T11:26:10.880Z"
}
```

### 1d. 人工签收后追加（acknowledged）

```json
{
  "schemaVersion": "aes.worktree-board.outbox-entry/v1",
  "entryId": "ob-job-69-111801-9f3a2c",
  "kind": "issue-close",
  "jobId": "job-69-111801",
  "issue": 69,
  "state": "acknowledged",
  "abandonReason": "ISSUE_UNREACHABLE",
  "acknowledgedAt": "2026-08-28T12:04:19.117Z",
  "acknowledgedBy": "parkth1026",
  "reason": "原 #69 随 piaotonghu 账号封禁永久 404；交付已落 dev 9004b5f，重建票 #130 已单独关闭"
}
```

**条目从不物理删除**：`abandoned` 与 `acknowledged` 都留在文件里，签收改的是**告警噪音**，
不是留档（不变清单 K11）。

## 2. `close` 返回报文对

### 2a. 成功（GitHub 是否可用都是这个形状）

```json
{
  "ok": true,
  "outcome": "CLOSED",
  "jobId": "job-69-111801",
  "issue": 69,
  "commentDigest": "sha256:4b1d…",
  "delivery": {
    "issueClose": { "outcome": "LOCAL_CLOSED", "commentDigest": "sha256:4b1d…", "closedAt": "…" },
    "runnerRelease": { "slotId": "worker-1", "outcome": "BASELINE_PENDING" }
  },
  "outbox": { "entryId": "ob-job-69-111801-9f3a2c", "state": "pending", "enqueued": true }
}
```

### 2b. 幂等重入（已 LOCAL_CLOSED）

```json
{
  "ok": true,
  "outcome": "ALREADY_SUCCEEDED",
  "jobId": "job-69-111801",
  "issue": 69,
  "commentDigest": "sha256:4b1d…",
  "outbox": { "entryId": "ob-job-69-111801-9f3a2c", "state": "pending", "enqueued": false }
}
```

### 2c. 用法错：verify 未 PASS（既有行为，形状不变）

```json
{ "ok": false, "code": "VERIFICATION_NOT_PASSED", "jobId": "job-69-111801", "issueClosed": false }
```

## 3. `outbox flush` 报文对

### 3a. 有积压且全部成功

```json
{
  "ok": true,
  "flushed": 2, "skipped": 0, "failed": 0, "abandoned": 0, "remaining": 0,
  "entries": [
    { "entryId": "ob-job-70-…", "issue": 70, "outcome": "SUCCEEDED" },
    { "entryId": "ob-job-71-…", "issue": 71, "outcome": "SUCCEEDED" }
  ]
}
```

### 3b. 业务失败：可重试（积压不是失败，`ok` 仍为 true，退出码 0）

```json
{
  "ok": true,
  "flushed": 0, "skipped": 0, "failed": 1, "abandoned": 0, "remaining": 1,
  "entries": [
    { "entryId": "ob-job-69-…", "issue": 69, "outcome": "FAILED", "attempt": 1,
      "error": { "code": "GH_COMMAND_FAILED", "stderr": "HTTP 503" } }
  ]
}
```

### 3c. 永久失败转 abandoned

```json
{
  "ok": true,
  "flushed": 0, "skipped": 0, "failed": 0, "abandoned": 1, "remaining": 0,
  "entries": [
    { "entryId": "ob-job-69-…", "issue": 69, "outcome": "ABANDONED",
      "abandonReason": "ISSUE_UNREACHABLE", "attempts": 3 }
  ]
}
```

### 3d. 队列为空

```json
{ "ok": true, "flushed": 0, "skipped": 0, "failed": 0, "abandoned": 0, "remaining": 0, "entries": [] }
```

## 4. `outbox acknowledge` 报文对

### 4a. 成功

```json
{
  "ok": true, "outcome": "ACKNOWLEDGED",
  "entryId": "ob-job-69-111801-9f3a2c", "issue": 69,
  "acknowledgedBy": "parkth1026", "acknowledgedAt": "2026-08-28T12:04:19.117Z"
}
```

### 4b. 幂等重入

```json
{ "ok": true, "outcome": "ALREADY_ACKNOWLEDGED", "entryId": "ob-job-69-111801-9f3a2c" }
```

### 4c. 业务失败：条目不是 abandoned

```json
{ "ok": false, "code": "NOT_ABANDONED", "entryId": "ob-job-70-…", "state": "pending" }
```

### 4d. 用法错：缺理由

```json
{ "ok": false, "code": "REASON_REQUIRED", "entryId": "ob-job-69-111801-9f3a2c" }
```

## 5. `gate` 结果新增的警告段

### 5a. 有未签收积压

```json
{
  "ok": true, "jobId": "job-83-…",
  "policy": { "declaredRisk": "low", "effectiveRisk": "low", "mergePolicy": "AUTO_MERGE", "depthTier": "light" },
  "mechanical": { "…": "六门原样不变" },
  "decision": { "decision": "AUTO_MERGE", "mayMerge": true },
  "outboxWarning": { "pending": 1, "oldestAgeMs": 486000 }
}
```

### 5b. 无积压（含只剩 acknowledged 的情况）

```json
{ "…": "同上", "outboxWarning": null }
```

**`outboxWarning` 不参与 `mayMerge` 判定**——它是可观测性，不是第七道门（P4 裁定）。

## 6. `resolveMergePolicy` 结果新增 `depthTier`

```json
{
  "declaredRisk": "medium", "effectiveRisk": "high", "escalated": true,
  "triggeredRules": [ { "id": "ESC-public-api", "minimum": "high", "reason": "公共 API 契约", "paths": ["…/server.mjs"] } ],
  "mergePolicy": "HUMAN_GATE", "autoMergeAllowed": false, "requiresHumanGate": true, "prOnly": false,
  "depthTier": "deep",
  "waiver": null
}
```

`depthTier` 由 `effectiveRisk` 机械查表（**不是**由 declaredRisk）：

| effectiveRisk | depthTier |
| --- | --- |
| `low` | `light` |
| `medium` | `standard` |
| `high` | `deep` |
| `critical` | `deep` |

critical 与 high 同档是刻意的（P1 裁定）：critical 走 `PR_ONLY`，review 深度不是它的主要防线。

## 7. `review-return` 消费的报文（协议 #83 已定，本票只做路由）

### 7a. 入参 `aes.issue-worker.review-return/v1`

```json
{
  "schemaVersion": "aes.issue-worker.review-return/v1",
  "jobId": "job-83-a1b2c3",
  "attemptId": "att-2",
  "commitSha": "fb392983…",
  "verdict": "MUST_FIX",
  "findings": [
    { "axis": "spec", "severity": "must-fix", "summary": "AC-2 未覆盖七小节全集", "location": "issue-contract.mjs:120" }
  ],
  "budget": { "reviewLoops": 1 }
}
```

### 7b. 成功路由

```json
{ "ok": true, "jobId": "job-83-a1b2c3", "state": "review-returned", "reviewLoops": 2,
  "routedTo": { "kind": "inbox", "eventId": "ev-…" } }
```

### 7c. 预算耗尽

```json
{ "ok": false, "code": "REVIEW_BUDGET_EXHAUSTED", "jobId": "job-83-a1b2c3", "reviewLoops": 3, "limit": 3,
  "humanRequest": { "kind": "budget_decision", "resumeToken": "hr-…" } }
```

### 7d. 用法错：commit 不匹配

```json
{ "ok": false, "code": "CANDIDATE_MISMATCH", "expected": "fb392983…", "actual": "b63c1d7e…", "consumed": false }
```

## 已锁定的约定

| 约定 | 出处 |
| --- | --- |
| `close` 的成功**不取决于** GitHub 可达性；registry 是权威，GitHub 是出站副作用 | Q1 选 A（完整解耦），推翻 70% 推荐档 |
| 出站队列**基建通用**（`kind` 是开放枚举），但本票只接 `issue-close` 一个生产者 | Q4 选 A |
| flush 只由**显式子命令**触发（轮起点 + 落盘时各一次），`gate` 侧 pending 警告兜底；不做惰性自动 flush | Q5 选 A |
| flush 遇失败**退出码恒 0**，不提供 `--fail-on-pending`：积压的可见性单点归 `gate` 的 `outboxWarning` | P3 裁定 |
| 条目**永不物理删除**；`acknowledge` 只降告警噪音，且**必须带 reason**（无理由签收等于静默删除） | P2 裁定 |
| `outboxWarning` 不参与 `mayMerge`，机械门恒为六项 | P4 裁定 |
| `depthTier` 由 **effectiveRisk** 查表，critical 与 high 同为 `deep` | P1 裁定；design.md「分档依据本来就在 merge gate 侧」 |
| `review-return` 的 `verdict` 闭集仅 `MUST_FIX`；`axis` 闭集 standards / spec | design.md:61-63（#83 定稿） |
| 未知 schemaVersion、缺字段、非闭集值一律 **fail closed** | 产品既有口径 |
