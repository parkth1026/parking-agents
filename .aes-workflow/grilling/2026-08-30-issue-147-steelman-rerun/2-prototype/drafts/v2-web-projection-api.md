<!-- draft v2 | published 2026-08-30T00:00:00+08:00
     用户意见：Web 不应只展示 Map，要让人快速获得当前状态
     状态：仅保留 Story-specific read model；共用 Shell 的 Surface envelope 由 v4-surface-protocol.md 取代 -->

# Web 状态工作台 Read Model

**草稿，尚未锁定。** 这是 `v1-api-mock.md` 的增量修订；命令与 Receipt 报文仍沿用 v1。

## 请求

```json
{
  "type": "story.workspace.get",
  "story_id": "story-147",
  "expected_projection_revision": 81,
  "include": ["attention", "repo_lanes", "queues", "selected_peek", "recent_changes"]
}
```

## 成功响应

```json
{
  "ok": true,
  "projection_revision": 82,
  "projected_at": "2026-08-30T08:34:12Z",
  "freshness": {
    "mode": "live-auto",
    "age_seconds": 12,
    "sources": {
      "github": "fresh",
      "gitlab": "fresh",
      "repo_desktop": "degraded",
      "repo_backend": "fresh"
    }
  },
  "now": {
    "story_status": "active-needs-attention",
    "required_lanes": 2,
    "passed_required_lanes": 1,
    "attention_count": 3,
    "evidence": {"valid": 9, "stale": 2, "not_run": 1}
  },
  "why_not_done": [
    {"kind": "requires-decision", "count": 1},
    {"kind": "awaiting-human", "count": 1},
    {"kind": "profile-degraded", "count": 1}
  ],
  "next": {
    "attention_id": "attention-D17",
    "label": "确认 API 公共行为",
    "owner": "story-owner",
    "unlocks": ["ticket-I42", "ticket-I48", "ticket-Q43", "story-delivery-wave-3"]
  },
  "attention": [
    {
      "attention_id": "attention-D17",
      "priority": "P0",
      "kind": "requires-decision",
      "subject": "ticket-D17",
      "owner": "story-owner",
      "why": "Acceptance discovered a public write behavior outside contract revision 4.",
      "next": "Keep the API read-only or return to Discovery and revise the contract.",
      "unlocks_count": 4,
      "allowed_actions": ["answer-decision", "open-ticket"]
    },
    {
      "attention_id": "attention-I42",
      "priority": "P0",
      "kind": "profile-degraded",
      "subject": "ticket-I42",
      "owner": "repo-lane:desktop",
      "why": "Expected profile-abc but the exact checkout contains profile-def.",
      "next": "Restore the exact Registry definition or create a replacement ticket through Discovery.",
      "unlocks_count": 3,
      "allowed_actions": ["diagnose", "pause", "cancel", "release", "open-ticket"]
    },
    {
      "attention_id": "attention-VIS",
      "priority": "P1",
      "kind": "awaiting-human",
      "subject": "gate-desktop-visual",
      "owner": "capability:human-test.visual",
      "why": "The visual behavior cannot be fully asserted by automated evidence.",
      "next": "Complete VIS-1 through VIS-3 and attach one evidence reference per case.",
      "unlocks_count": 2,
      "allowed_actions": ["start-checklist", "open-ticket"]
    }
  ],
  "repo_lane_beacons": [
    {
      "lane_id": "desktop",
      "required": true,
      "status": "degraded",
      "checkout_subject": "git:c3",
      "integration_subject": null,
      "active_work": "ticket-I42/attempt-4",
      "gate": {"passed": 7, "required": 9, "stale": 1, "not_run": 1},
      "why": "PROFILE_DIGEST_MISMATCH",
      "next": "restore-registry-or-replace-ticket"
    },
    {
      "lane_id": "backend",
      "required": true,
      "status": "passed",
      "checkout_subject": "git:7a31c2de",
      "integration_subject": "git:91b0aa10",
      "active_work": null,
      "gate": {"passed": 8, "required": 8, "stale": 0, "not_run": 0},
      "why": null,
      "next": "wait-for-required-lanes"
    }
  ],
  "queues": {
    "awaiting_human": ["gate-desktop-visual"],
    "blocked_or_decision": ["ticket-D17"],
    "degraded": ["ticket-I42"],
    "startable": ["ticket-I48"],
    "completed": ["ticket-I41"]
  },
  "recent_changes": [
    {"age_seconds": 12, "text": "backend integration full suite PASS"},
    {"age_seconds": 240, "text": "ticket-I42 entered profile degraded"},
    {"age_seconds": 540, "text": "acceptance opened requires-decision ticket-D17"}
  ]
}
```

## 一致性与排序规则

- `now`、`why_not_done`、`next`、Action Center、RepoLane beacons、List、Map 和 peek 必须来自同一个 `projection_revision`；不能各自请求后拼出混合快照。
- Action Center 只收“需要人或 Agent 改变下一步”的项，不收普通完成历史。
- 候选排序键：阻断 Story/required lane 优先，其次不可逆风险、人工等待、解锁数量、等待时长；排序结果必须带可解释理由，不能只给分数。
- `stale`、`NOT_RUN`、`BLOCKED`、`degraded`、`unclassified` 必须常显，不能被绿色总状态吞掉。
- `frontier` 与 `startable` 分开：有开放依赖的 frontier 不能被展示成 Agent 现在可领取。
- Peek 只回答 Now/Why/Next 与一跳依赖；Receipt、transition、日志进入“完整证据”。
- `live-auto` 是候选行为：若任一源无法自动刷新，必须显示 source freshness；不能继续展示全局 LIVE 假象。
