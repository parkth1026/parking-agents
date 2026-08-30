<!-- draft v4 | published 2026-08-30T11:07:25Z
     用户意见：P8/P9 原则已确认；字段与晋级方式待整套 logic artifact 确认
     状态：superseded by P10 independent Skill+Web Runtime direction -->

# 双 Host Surface 协议：具体报文对

**已被 P10 推翻，仅保留历史。** 其中 revision、idempotency、SurfaceDocument 与分层回执可作为独立 Runtime 的事实候选；AesAgentHost、双 Host 协商与 promotion 语义不得进入当前确认版。

## 1. 协商：先证明双方理解同一份 Module 与页面说明书

Client → Host：

```json
{
  "type": "surface.negotiate",
  "client_kind": "web",
  "protocol_ranges": ["1.x"],
  "supported_document_schemas": ["aes.workflow-surface/document/v1"],
  "supported_blocks": [
    "status/v1",
    "attention/v1",
    "collection/v1",
    "graph/v1",
    "interaction/v1",
    "action/v1",
    "artifact/v1"
  ],
  "resume": {"host_epoch": "dev-7", "cursor": 81}
}
```

Host → Client：

```json
{
  "ok": true,
  "selected_protocol": "1.0",
  "host": {
    "kind": "skill-dev",
    "instance_id": "host-local-4",
    "epoch": "dev-8",
    "durability": "restart-local"
  },
  "workflow": {
    "id": "workflow-story-map",
    "version": "0.1.0-dev",
    "module_digest": "sha256:module-abc"
  },
  "selected_document_schema": "aes.workflow-surface/document/v1",
  "required_blocks": ["status/v1", "attention/v1", "graph/v1", "action/v1"],
  "granted_commands": ["story.answer-decision/v1", "story.pause/v1"],
  "revision": 82,
  "cursor": 82,
  "resync_required": true
}
```

`host_epoch` 变化后必须重新读取 snapshot。客户端不得把旧 delta 直接套到新 Host。

协商失败：

```json
{
  "ok": false,
  "error": {
    "code": "CAPABILITY_MISSING",
    "phase": "negotiate",
    "required": "graph/v1",
    "canonical_changed": false,
    "retryable": false
  }
}
```

## 2. 读取 SurfaceDocument

```json
{
  "type": "surface.snapshot.get",
  "run_id": "story-run-147",
  "expected_module_digest": "sha256:module-abc"
}
```

```json
{
  "ok": true,
  "document": {
    "schema": "aes.workflow-surface/document/v1",
    "workflow": {
      "id": "workflow-story-map",
      "version": "0.1.0-dev",
      "module_digest": "sha256:module-abc"
    },
    "run_id": "story-run-147",
    "revision": 82,
    "state_digest": "sha256:state-82",
    "cursor": 82,
    "freshness": {
      "mode": "captured",
      "sources": [
        {"kind": "issue", "status": "fresh", "revision": "github:#147@captured"},
        {"kind": "repo", "status": "not-connected", "revision": null}
      ]
    },
    "blocks": [
      {
        "kind": "status/v1",
        "id": "story-pulse",
        "title": "2-PROTOTYPE PENDING",
        "tone": "attention",
        "facts": ["Web artifact not confirmed", "Repo runtime not connected"]
      },
      {
        "kind": "attention/v1",
        "id": "next-action",
        "owner": "story-owner",
        "why": "The Web baseline still needs confirmation.",
        "next": "Answer WEB-P9.",
        "allowed_actions": []
      },
      {
        "kind": "graph/v1",
        "id": "issue-membership",
        "graph_ref": "artifact:sha256:membership-147",
        "fallback_text": "Issue #147 has 12 native child relationships and no native blocker edges."
      }
    ],
    "continuation": {
      "stage": "consumed",
      "next_user_action": "none"
    }
  }
}
```

规则：`SurfaceDocument` 是可重建投影，不是 Tracker/Repo/Workflow 真源。SkillDevHost 与 AesAgentHost 对相同 Module state 必须产生语义相同的 document；Host ID、连接方式和诚实的 capability 差异允许不同。

## 3. Web 提交 typed action

```json
{
  "type": "surface.command.submit",
  "command_id": "cmd-01J9",
  "idempotency_key": "story-147:decision-D17:rev-82",
  "run_id": "story-run-147",
  "expected_revision": 82,
  "target": {
    "id": "decision-D17",
    "revision": 3
  },
  "actor": {
    "kind": "human",
    "identity": "github:user:parkth1026",
    "grants": ["story.answer-decision"]
  },
  "command": {
    "kind": "story.answer-decision/v1",
    "payload": {"choice": "keep-read-only"}
  }
}
```

Host durable commit 后的第一份回执：

```json
{
  "ok": true,
  "outcome": "committed",
  "command_id": "cmd-01J9",
  "committed_revision": 83,
  "state_digest": "sha256:state-83",
  "event_ids": ["event-083"],
  "continuation": {
    "stage": "persisted",
    "mode": "manual-followup",
    "next_user_action": "return-to-current-task-and-continue"
  }
}
```

这份回执不证明 Agent 已恢复，也不证明 Workflow 已消费答案。

同 key、同 payload 重试：

```json
{
  "ok": true,
  "outcome": "duplicate",
  "original_command_id": "cmd-01J9",
  "committed_revision": 83,
  "state_digest": "sha256:state-83"
}
```

同 key、不同 payload：

```json
{
  "ok": false,
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "phase": "commit",
    "canonical_changed": false,
    "retryable": false,
    "original_payload_digest": "sha256:payload-one"
  }
}
```

## 4. continuation 分层帧

Host 已取得精确 owner：

```json
{
  "type": "surface.continuation.changed",
  "run_id": "story-run-147",
  "continuation_id": "cont-event-083",
  "generation": 4,
  "stage": "agent-resumed",
  "owner": {"kind": "agent", "ref": "opaque:role-attempt-52"},
  "recovery_payload_digest": "sha256:recovery-083",
  "cursor": 84
}
```

WorkflowModule 已吸收答案：

```json
{
  "type": "surface.continuation.changed",
  "run_id": "story-run-147",
  "continuation_id": "cont-event-083",
  "generation": 4,
  "stage": "consumed",
  "consumed_event_ids": ["event-083"],
  "resulting_revision": 85,
  "state_digest": "sha256:state-85",
  "cursor": 85
}
```

自动恢复不可用：

```json
{
  "type": "surface.continuation.changed",
  "continuation_id": "cont-event-083",
  "generation": 4,
  "stage": "manual-required",
  "reason": "HOST_CAPABILITY_UNAVAILABLE",
  "persisted_input_retained": true,
  "next_user_action": "return-to-current-task-and-continue"
}
```

## 5. stale revision

```json
{
  "ok": false,
  "error": {
    "code": "REVISION_CONFLICT",
    "phase": "validate",
    "expected_revision": 82,
    "current_revision": 85,
    "canonical_changed": false,
    "retryable": true,
    "recovery": "read-current-snapshot-and-rebuild-command"
  }
}
```

旧答案不得自动套用到新 interaction revision。

## 6. Artifact 读取

```json
{
  "type": "surface.artifact.read",
  "run_id": "story-run-147",
  "artifact": {
    "id": "membership-147",
    "revision": 1,
    "digest": "sha256:membership-147"
  }
}
```

Host 必须先在 authoritative projection 中找到精确 ref，再读取并校验 bytes。`SurfaceDocument` 不内联无限大的日志、截图或 evidence。

## 7. 未知 block 的安全 fallback

```json
{
  "kind": "extension/v1",
  "schema": "workflow-story-map/quorum-review/v1",
  "required": false,
  "payload": {"artifact_ref": "artifact:quorum-review-9"},
  "fallback": {
    "title": "Quorum review requires a newer renderer",
    "text": "Two authorized actors must sign before this action can proceed.",
    "allowed_actions": []
  }
}
```

required block 不支持时整个 mutation surface fail closed；optional block 只能显示无副作用 fallback，不能猜字段或执行任意脚本。

## 已锁定的约定

- Module identity、revision、state digest、command idempotency 与 continuation stage 必须跨两个 Host 保持同一语义（P8）。
- Web Shell 只渲染版本化页面说明书并提交 typed action；第一版不加载任意 Workflow React/JavaScript（P9）。
- `persisted`、`agent-resumed`、`consumed` 是三个不同事实；后者不能由 HTTP/WS transport ack 推断。
- Story-specific Tracker ack、Receipt/Gate 与 `NOT_COMMITTED` 继续由共享 Workflow Module 的业务规则裁决，不由 Surface transport 替代。
- 本文件字段名与 block catalog 仍是可逐处质疑的候选；整套 logic artifact 未确认前不得成为实现契约。
