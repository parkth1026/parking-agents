<!-- draft v1 | published 2026-08-30T00:00:00+08:00
     用户意见：待确认
     状态：awaiting confirmation -->

# 接口报文对: workflow-story-map typed protocol

**草稿，尚未锁定。** 这里锁报文结构和失败语义，不锁具体语言或传输协议。

## 1. Story 投影

请求：

```json
{
  "type": "story.get",
  "story_ref": "github:parkth1026/parking-agents#147",
  "expand": ["repo_lanes", "frontiers", "gates"]
}
```

成功响应：

```json
{
  "ok": true,
  "story": {
    "story_id": "story-147",
    "contract_revision": 4,
    "contract_digest": "sha256:contract-v4",
    "lifecycle": "active",
    "control": "unclaimed",
    "gate": "pending",
    "repo_lanes": [
      {
        "lane_id": "desktop",
        "required": true,
        "repo": "github:parkth1026/aes-agent",
        "tracker": "github",
        "checkout_subject": "git:509ea05b",
        "integration_target": "refs/heads/dev",
        "integration_subject": null,
        "local_done": false
      },
      {
        "lane_id": "backend",
        "required": true,
        "repo": "gitlab:neon/TWE/aes-agent",
        "tracker": "gitlab",
        "checkout_subject": "git:7a31c2de",
        "integration_target": "refs/heads/dev",
        "integration_subject": "git:91b0aa10",
        "local_done": true
      }
    ],
    "frontiers": {
      "discovery": ["ticket-D17"],
      "delivery": ["ticket-I42", "ticket-Q43"]
    },
    "gate_summary": {
      "passed": 7,
      "pending": 2,
      "failed": 0,
      "needs_human": 1,
      "waived": 0
    }
  }
}
```

业务失败：成员关系对账不一致。

```json
{
  "ok": false,
  "error": {
    "code": "STORY_MEMBERSHIP_DEGRADED",
    "message": "Map root lists ticket-I42, but the child back-reference points to story-139.",
    "retryable": false,
    "canonical_changed": false,
    "details": {
      "story_id": "story-147",
      "ticket_id": "ticket-I42",
      "allowed_actions": ["read", "diagnose", "repair-membership"]
    }
  }
}
```

## 2. Web typed command

请求：

```json
{
  "type": "command.submit",
  "command_id": "cmd-01J8Y8N3",
  "idempotency_key": "retry:ticket-I42:attempt-3",
  "actor": {
    "identity": "github:user:parkth1026",
    "session_id": "web-session-88"
  },
  "subject": {
    "story_id": "story-147",
    "lane_id": "desktop",
    "ticket_id": "ticket-I42",
    "attempt_id": "attempt-3",
    "expected_revision": 17
  },
  "command": {
    "kind": "retry",
    "reason": "candidate c1 failed targeted QA"
  }
}
```

Tracker ack 后成功：

```json
{
  "ok": true,
  "status": "COMMITTED",
  "canonical_changed": true,
  "tracker_event": "github:comment:318811",
  "new_revision": 18,
  "result": {
    "attempt_id": "attempt-4",
    "lifecycle": "active",
    "control": "claimed",
    "gate": "pending"
  }
}
```

Tracker 断连：

```json
{
  "ok": false,
  "status": "NOT_COMMITTED",
  "canonical_changed": false,
  "error": {
    "code": "TRACKER_UNAVAILABLE",
    "message": "The tracker did not acknowledge the command.",
    "retryable": true
  }
}
```

用法错：命令不在 Web v1 白名单。

```json
{
  "ok": false,
  "status": "REJECTED",
  "canonical_changed": false,
  "error": {
    "code": "COMMAND_NOT_ALLOWED",
    "message": "rewire-dependency is not a Web v1 command.",
    "retryable": false,
    "allowed_kinds": [
      "human-answer",
      "human-accept",
      "human-reject",
      "claim",
      "release",
      "pause",
      "retry",
      "cancel",
      "withdraw"
    ]
  }
}
```

幂等冲突：

```json
{
  "ok": false,
  "status": "REJECTED",
  "canonical_changed": false,
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "The key was already committed with a different payload.",
    "retryable": false,
    "committed_command_id": "cmd-01J8Y8N3"
  }
}
```

## 3. ExecutionAdapter 事件

Core 发出的 dispatch：

```json
{
  "type": "execution.dispatch.requested",
  "request_id": "dispatch-44",
  "story_id": "story-147",
  "lane_id": "desktop",
  "ticket_id": "ticket-I42",
  "attempt_id": "attempt-4",
  "profile": {
    "id": "implementation",
    "schema_version": 3,
    "digest": "sha256:profile-abc"
  },
  "contract": {
    "revision": 4,
    "digest": "sha256:contract-v4"
  },
  "required_capabilities": {
    "context_isolation": "fresh",
    "actor_separation": "not-owner",
    "durable_receipt": true,
    "user_visibility": false,
    "retry_scope": "attempt"
  }
}
```

Adapter 回传开始事件：

```json
{
  "type": "execution.attempt.started",
  "request_id": "dispatch-44",
  "attempt_id": "attempt-4",
  "adapter": "aes-worktree-board",
  "carrier": {
    "kind": "desktop-task",
    "identity": "codex-thread:019d...",
    "capabilities_digest": "sha256:caps-77"
  },
  "selection_reason": "durable receipt and independent retry are required",
  "occurred_at": "2026-08-30T03:00:00Z"
}
```

意外错误：Adapter 发布未知事件类型。

```json
{
  "ok": false,
  "error": {
    "code": "UNSUPPORTED_EXECUTION_EVENT",
    "message": "execution.gate.force_pass is not part of the adapter protocol.",
    "retryable": false,
    "canonical_changed": false
  }
}
```

## 4. Evidence Receipt 与 Gate 投影

自动 QA Receipt：

```json
{
  "type": "receipt.qa",
  "receipt_id": "receipt-QA-900",
  "producer": {
    "actor": "codex-thread:reviewer-7",
    "capability": "qa.independent"
  },
  "subject": {
    "kind": "candidate",
    "digest": "git:c2",
    "attempt_id": "attempt-4",
    "profile_digest": "sha256:profile-abc",
    "contract_digest": "sha256:contract-v4"
  },
  "outcome": "PASS",
  "evidence": [
    {
      "kind": "command",
      "command": "node skills/workflow-story-map/run-tests.mjs",
      "exit_code": 0,
      "artifact": "repo:.aes-workflow/evidence/qa-900.json"
    }
  ],
  "issued_at": "2026-08-30T03:30:00Z"
}
```

Subject 已变化时的 Gate 投影：

```json
{
  "type": "gate.projected",
  "gate_id": "GATE-ticket-I42-qa",
  "status": "pending",
  "current_subject": "git:c3",
  "accepted_receipts": [],
  "stale_receipts": [
    {
      "receipt_id": "receipt-QA-900",
      "reason": "SUBJECT_CHANGED",
      "bound_subject": "git:c2"
    }
  ]
}
```

## 5. Human、Waiver 与撤销

逐项 HumanTestReceipt：

```json
{
  "type": "receipt.human-test",
  "receipt_id": "receipt-H-71",
  "actor": {
    "identity": "github:user:visual-tester",
    "resolved_role": "visual_qa"
  },
  "authorization": {
    "policy_digest": "sha256:human-policy-3",
    "capability": "human-test.visual"
  },
  "subject": {
    "kind": "integration",
    "digest": "git:509ea05b"
  },
  "checklist": [
    {"case_id": "VIS-1", "outcome": "PASS", "evidence": "artifact:screenshot-1"},
    {"case_id": "VIS-2", "outcome": "PASS", "evidence": "artifact:screenshot-2"},
    {"case_id": "VIS-3", "outcome": "PASS", "evidence": "artifact:recording-1"}
  ],
  "revision": 1
}
```

WaiverReceipt：

```json
{
  "type": "receipt.waiver",
  "receipt_id": "receipt-W-12",
  "actor": {
    "identity": "gitlab:user:risk-owner",
    "resolved_role": "release_risk_owner"
  },
  "authorization": {
    "policy_digest": "sha256:waiver-policy-2",
    "capability": "waive.final-regression"
  },
  "subject": {
    "gate_id": "GATE-backend-full-regression",
    "digest": "git:91b0aa10"
  },
  "reason": "Known baseline failure reproduced on base and current integration subjects.",
  "risk": "Search export remains unavailable for tenant X.",
  "owner": "team-backend",
  "expires_at": "2026-09-15T00:00:00Z",
  "follow_up": "gitlab:neon/TWE/aes-agent#801",
  "revision": 1
}
```

撤销：

```json
{
  "type": "receipt.revocation",
  "receipt_id": "receipt-R-13",
  "revokes": "receipt-W-12",
  "actor": {
    "identity": "gitlab:user:risk-owner",
    "resolved_role": "release_risk_owner"
  },
  "authorization": {
    "policy_digest": "sha256:waiver-policy-2",
    "capability": "revoke.final-regression-waiver"
  },
  "reason": "The accepted risk expanded after a new regression.",
  "revision": 2
}
```

## 6. Registry degraded

```json
{
  "ok": false,
  "status": "DEGRADED_PROFILE_UNAVAILABLE",
  "canonical_changed": false,
  "error": {
    "code": "PROFILE_DIGEST_MISMATCH",
    "expected": "sha256:profile-abc",
    "actual": "sha256:profile-def",
    "allowed_actions": ["read", "diagnose", "pause", "cancel", "release"],
    "blocked_actions": ["claim", "dispatch", "retry", "publish-evidence", "close", "story-done"],
    "recovery": ["restore-exact-registry", "return-to-discovery-and-create-replacement"]
  }
}
```

## 已锁定的约定

- 所有会改变 canonical 状态的 Web 命令都必须携带 idempotency key，并在 tracker ack 后才返回 `COMMITTED`（Q19）。
- `canonical_changed` 在失败报文中始终存在；断连、权限失败、用法错和意外错误均不得伪装成功（Q19）。
- Adapter 只能发布 typed execution events 与 receipts，不能发布“强制 Gate 通过”事件（Q20、Q25）。
- Receipt 必须绑定 subject、attempt、profile digest 与 contract digest；任一 subject 变化后旧 receipt 无条件 stale（Q29）。
- PASS、FAIL、NOT_RUN、BLOCKED、WAIVED 是不同结局；Waiver 不得改写成 PASS（Q30）。
- HumanTest、Acceptance、Waiver 分别校验 Profile/Gate 授权策略；tracker 写权限本身不是授权（Q34）。
- Profile digest 无法精确重建时 fail-closed；同名最新版不能自动迁移（Q35）。
- 本草稿中的字段名与枚举是供逐处质疑的候选；用户确认后才成为设计输入。
