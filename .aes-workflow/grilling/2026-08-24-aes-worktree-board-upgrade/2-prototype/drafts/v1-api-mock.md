<!-- draft v1 | published 2026-08-24T09:45:00Z
     用户意见：待收集
     状态：待确认 -->

# 接口报文对: 2026-08-24-aes-worktree-board-upgrade（草稿 v1）

报文结构只在本文件定义一次；example-run 只写用法并指回这里。

## 1. HTTP：POST /api/dispatch（#22 修复后）

### 成功（同源 + 带 token）

请求：
```http
POST /api/dispatch HTTP/1.1
Host: 127.0.0.1:8321
Origin: http://127.0.0.1:8321
X-Board-Token: btk_f3a91c…（server 本次启动生成，注入页面）
Content-Type: application/json

{"worker":"dev4","agent":"test","prompt":"…"}
```
响应：
```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{"ok":true,"taskId":"tk-dev4-17-g1","logPath":"…/runtime/tasks/tk-dev4-17-g1.log"}
```

### 业务失败：worktree 已有租约

```http
HTTP/1.1 409 Conflict

{"ok":false,"code":"LOCKED","worktree":"dev4","leaseOwner":"tk-dev4-17-g1","acquiredAt":"2026-08-24T09:12:00Z"}
```

### 用法错：缺 token / 跨源

```http
HTTP/1.1 401 Unauthorized
{"ok":false,"code":"MISSING_TOKEN"}
```
```http
HTTP/1.1 403 Forbidden
{"ok":false,"code":"FORBIDDEN_ORIGIN","origin":"https://evil.example"}
```

### 意外错误

```http
HTTP/1.1 500 Internal Server Error
{"ok":false,"code":"INTERNAL","message":"<单行摘要>"}
```

## 2. HTTP：GET /api/status（v3 骨架）

```json
{
  "schemaVersion": 3,
  "generatedAt": "2026-08-24T12:00:00Z",
  "repo": {"root":"G:/GIT/AI_WorkFlow/aes-agents-v2","mainBranch":"main","mainHead":"6d3713b9","issueRepo":"51world-ai-copilot/aes-agent"},
  "orchestration": {"state":"stopped","reason":"no-advanceable-lane","recordedAt":"2026-08-23T23:37:20Z","evaluatedAt":"2026-08-24T12:00:00Z"},
  "graph": {"issues":[…],"edges":[…],"stats":{…}},
  "worktrees": [ { "…v2 的 16 字段原样…": "…",
    "task": {"taskId":"tk-dev1-56-g1","threadId":"T-01H…","role":"executor","state":"handoff-required","phase":"awaiting-human","modelTier":"luna-max","blockCount":3,
             "verdict":{"code":"BLOCK","runtime":"NOT_RUN","delivery":"HANDOFF_REQUIRED"},
             "lastEventId":"E-9c21","lastProgressAt":"2026-08-23T22:58:11Z","nextAction":"人工交接，见 runtime/handoff/tk-dev1-56-g1.md"} } ]
}
```

## 3. 数据契约：registry.json

```json
{
  "schemaVersion": 3,
  "orchestration": {"state":"running|stopped","reason":null,"recordedAt":null,"evaluatedAt":"…"},
  "leases": { "dev4": {"owner":"tk-dev4-17-g1","generation":1,"acquiredAt":"…"} },
  "tasks": {
    "tk-dev4-17-g1": {
      "taskId":"tk-dev4-17-g1","taskKind":"desktop-thread|cli-fallback",
      "threadId":"T-01H…","clientThreadId":null,"hostId":null,"projectId":null,
      "issue":17,"worktree":"dev4","role":"executor|reviewer","parentTaskId":null,"generation":1,
      "state":"<15 态之一>","phase":"implementing|testing|committing|…","interactionClass":"autonomous|user-aligned",
      "modelTier":"luna-max|sol-high","routingReason":"…",
      "cursor":"…","lastEventId":"E-…","consumedEventIds":["E-…"],
      "headSha":"…","commitSha":"…","mergeCommit":null,
      "verdict":{"code":"PASS|BLOCK|null","runtime":"PASS|NOT_RUN|BLOCKED|FAIL|null","delivery":"MERGE_READY|PARKED|HANDOFF_REQUIRED|BLOCKED|null"},
      "blockCount":0,"blockLedger":[{"commit":"…","eventId":"…","at":"…"}],
      "lastProgressAt":"…","nextAction":"…","fallbackAuthorized":null,
      "createdAt":"…","updatedAt":"…"
    }
  }
}
```

## 4. 数据契约：transitions.jsonl（append-only，一行一条）

```json
{"ts":"2026-08-24T12:01:00Z","taskId":"tk-dev4-17-g1","from":"reviewing","to":"approved","eventId":"E-7f3a","actor":"orchestrator","reason":"reviewer APPROVE on 01c01b7","evidence":["thread:T-02R…"]}
```

## 5. 数据契约：inbox.jsonl（append-only，一行一条）

```json
{"eventId":"E-7f3a","threadId":"T-02R…","taskId":"tk-dev4-17-g1","kind":"final|commentary|verdict|progress","receivedAt":"…","payload":{"summary":"…","commitSha":"…","verdict":"APPROVE"}}
```

`eventId` 生成规则：宿主事件自带 id 用原 id；否则 `sha1(threadId + kind + payload 摘要)` 前 12 位——同一事件重复送达必然同 id。

## 6. CLI stdout 报文：orchestrate.mjs consume

成功 / 重复 / 用法错（结构见各行，退出码 0/0/2）：
```json
{"result":"consumed","eventId":"E-7f3a","taskId":"tk-dev4-17-g1","transition":{"from":"reviewing","to":"approved"},"nextAction":"merge-gate"}
{"result":"already-consumed","eventId":"E-7f3a"}
{"result":"error","code":"UNKNOWN_EVENT","eventId":"E-xxxx"}
```

## 7. 状态机（15 态，转移校验的闭集）

```text
discovered → classified → claimed → dispatching → executing → self-qa → committed
→ reviewing → (approved | fixing) ；fixing → executing（同 generation 内回环）
approved → merge-ready → merged
任何执行中状态 → parked / handoff-required（熔断或用户裁决）
全局：orchestration-stop（registry.orchestration，不是单 Task 状态）
终态/暂停态：merged、parked、handoff-required、orchestration-stop —— collect 不可改写，仅 transition 命令可解除 parked
```

## 已锁定的约定

- `schemaVersion` 始终存在；board 接受 2 与 3，collect 只写 3（q-C1）。
- verdict 三维是闭集，`runtime=NOT_RUN` 永不被改写为 `PASS`（复盘 P0.3；q1 范围裁决）。
- `already-consumed` 是成功形态（退出 0），不是错误——幂等由脚本强制（q3=B）。
- 401/403 的 code 是闭集 `MISSING_TOKEN|FORBIDDEN_ORIGIN`（#22；q2=A）。
- headless 真实派发必带 `fallbackAuthorized`（记录用户原话），`test` 假 agent 豁免（q2=A + 自检需要）。
- registry.json 是判断真源，status.json 是渲染快照——冲突时以 registry 为准（复盘 P2.2）。
