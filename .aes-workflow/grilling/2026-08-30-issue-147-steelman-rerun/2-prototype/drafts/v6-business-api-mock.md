<!-- draft v6-business | published 2026-08-30T14:40:00Z
     用户意见：先锁业务逻辑对照物，再定向构建 v6
     状态：awaiting business confirmation · transport and field names are prototype candidates -->

# 接口报文对：Story Projection v6 候选

**草稿，尚未锁定。** 这里锁定报文可观察语义，不选择 HTTP、SSE、WebSocket 或具体语言实现。

## 1. 当前真实 #147 投影

请求：

```json
{
  "type": "projection.snapshot.get",
  "story_ref": "github:parkth1026/parking-agents#147",
  "lens": "story-work-graph",
  "expected_schema": "aes.story-projection/v1"
}
```

成功响应：

```json
{
  "ok": true,
  "schema": "aes.story-projection/v1",
  "projection_revision": 58,
  "freshness": "fresh",
  "story": {
    "story_id": "github:parkth1026/parking-agents#147",
    "truth_class": "MIXED_WITH_PROVENANCE",
    "terminal": null,
    "discovery": {
      "current_revision_id": "DISC-CURRENT-DOSSIER",
      "revisions": [
        {
          "revision_id": "DISC-HISTORICAL-159",
          "status": "historical",
          "source": "github:parkth1026/parking-agents#147..#159",
          "members": 12,
          "native_dependencies": 7,
          "result": "design-v1-closed"
        },
        {
          "revision_id": "DISC-CURRENT-DOSSIER",
          "status": "current-in-progress",
          "source": "repo:.aes-workflow/grilling/2026-08-30-issue-147-steelman-rerun",
          "stage": "2-prototype",
          "contract_digest": null,
          "revisits": "DISC-HISTORICAL-159",
          "supersedes": null
        }
      ],
      "frontier": []
    },
    "delivery": {
      "runtime": "NOT_CONNECTED",
      "verified_nodes": 0,
      "repo_lanes": [],
      "frontier": []
    }
  },
  "surface": {
    "document_schema": "aes.surface-document/v1",
    "primary_views": ["discovery-graph", "delivery-graph"],
    "allowed_view_actions": ["search", "filter", "select", "focus-one-hop", "history", "diff", "evidence", "export", "local-bookmark"],
    "domain_commands": []
  }
}
```

## 2. 完整模拟 Story 的 RepoLane 投影

上节 current dossier 只是正在重访的设计版本；`revisits` 保留历史来源，`supersedes=null` 不伪造整套新版 Contract 已被确认或发布。

```json
{
  "story_id": "SIM-STORY-900",
  "truth_class": "SIMULATED_GAP",
  "contract": {
    "revision": 2,
    "digest": "sha256:SIM-CONTRACT-2"
  },
  "repo_lanes": [
    {
      "lane_id": "SIM-LANE-SKILL",
      "required": true,
      "repo_identity": "github:parkth1026/parking-agents-manual",
      "tracker": "github",
      "exact_checkout": "git:SIM-SKILL-BASE-2",
      "integration_target": "refs/heads/dev",
      "current_candidate": "git:SIM-SKILL-C3",
      "integration_subject": null,
      "workstreams": ["web", "workflow-core"],
      "terminal": null,
      "why_not_done": ["integration subject missing", "final full-suite receipt missing"]
    },
    {
      "lane_id": "SIM-LANE-RUNTIME",
      "required": true,
      "repo_identity": "github:parkth1026/parking-agents",
      "tracker": "github",
      "exact_checkout": "git:SIM-RUNTIME-BASE-4",
      "integration_target": "refs/heads/dev",
      "current_candidate": "git:SIM-RUNTIME-C2",
      "integration_subject": "git:SIM-RUNTIME-I7",
      "workstreams": ["projection-runtime"],
      "terminal": "passed",
      "why_not_done": []
    }
  ],
  "story_reducer": {
    "terminal": null,
    "why_not_done": [
      "SIM-LANE-SKILL integration subject missing",
      "SIM-LANE-SKILL final full-suite receipt missing"
    ]
  }
}
```

## 2A. P13：required 已满足，optional 仍 blocked

这是 `SIM-STORY-900` 在两个 required Lane 后续全部通过后的独立时间点，不覆盖上一节尚未完成的快照。新增的 reports repo、checkout、Registry、Receipt 和 actor 均为明确模拟，不是已存在的部署。

请求：

```json
{
  "type": "projection.snapshot.get",
  "fixture": "SIM-STORY-900-P13-DONE",
  "lens": "story-work-graph"
}
```

响应：

```json
{
  "ok": true,
  "story_id": "SIM-STORY-900",
  "truth_class": "SIMULATED_GAP",
  "contract": {
    "revision": 2,
    "digest": "sha256:SIM-CONTRACT-2",
    "required_lane_ids": ["SIM-LANE-SKILL", "SIM-LANE-RUNTIME"],
    "optional_lane_ids": ["SIM-LANE-REPORTS"]
  },
  "required_lane_results": [
    {
      "lane_id": "SIM-LANE-SKILL",
      "integration_subject": "git:SIM-SKILL-I8",
      "final_full_suite_receipt": "SIM-RCPT-SKILL-FULL-SUITE-I8",
      "gate": "passed",
      "pending_required_human_cases": []
    },
    {
      "lane_id": "SIM-LANE-RUNTIME",
      "integration_subject": "git:SIM-RUNTIME-I7",
      "final_full_suite_receipt": "SIM-RCPT-RUNTIME-FULL-SUITE-I7",
      "gate": "passed",
      "pending_required_human_cases": []
    }
  ],
  "optional_lane": {
    "lane_id": "SIM-LANE-REPORTS",
    "required": false,
    "repo_identity": "github:sim-org/story-reports",
    "tracker": "github",
    "exact_checkout": "git:SIM-REPORTS-BASE-1",
    "integration_target": "refs/heads/dev",
    "integration_subject": null,
    "profile_digest": "sha256:SIM-REPORTS-PROFILE-1",
    "gate_catalog_digest": "sha256:SIM-REPORTS-CATALOG-1",
    "state": {"lifecycle": "active", "control": "blocked", "gate": "pending"},
    "terminal": null
  },
  "story_reducer": {
    "terminal": "done",
    "why_not_done": [],
    "pending_global_required_obligations": [],
    "waiver_receipt_ids": [],
    "optional_debt": [
      {
        "lane_id": "SIM-LANE-REPORTS",
        "owner": "SIM-ACTOR-REPORTS-OWNER",
        "reason": "optional demo environment unavailable",
        "impact": "optional report demo unavailable; required deliverables unaffected",
        "recovery_ref": "story:SIM-STORY-900/lane:SIM-LANE-REPORTS",
        "recovery_action": "在 Workflow/Skill 通道修复环境后恢复该 Lane；Web 仅查看恢复说明"
      }
    ]
  }
}
```

`optional_debt` 是只读派生集合，必须保留 owner、原因、影响和恢复入口；它既不使 optional Gate 变 PASS，也不自动生成 Waiver。若 required Gate 或全局必需义务仍缺失，`terminal` 不得为 done；required 使用有效授权 Waiver 时仍输出 `done-with-waiver`。

## 3. WorkTicket、三轴状态与 Role/Carrier

```json
{
  "ticket_id": "SIM-WT-SKILL-42",
  "lane_id": "SIM-LANE-SKILL",
  "workstream": "web",
  "profile": {
    "profile_id": "implementation.web",
    "schema_version": 3,
    "digest": "sha256:SIM-PROFILE-WEB-3"
  },
  "state": {
    "lifecycle": "active",
    "control": "running",
    "gate": "pending",
    "display_projection": "QA RUNNING"
  },
  "current_attempt": {
    "attempt_id": "SIM-ATTEMPT-4",
    "candidate_subject": "git:SIM-SKILL-C3",
    "role_assignment": {
      "role": "QAValidator",
      "authorized_receipts": ["QaReceipt"],
      "requires": {
        "fresh_context": true,
        "actor_separation": "not-implementation-owner",
        "browser_live": true,
        "durable_receipt": true
      }
    },
    "carrier": {
      "kind": "independent-task",
      "actor_id": "SIM-ACTOR-QA-7",
      "capability_digest": "sha256:SIM-CAPS-77",
      "selection_reason": "smallest carrier satisfying all hard requirements"
    }
  }
}
```

## 4. Receipt 与 Gate 投影

候选 QA Receipt：

```json
{
  "type": "receipt.qa",
  "receipt_id": "SIM-RCPT-SKILL-QA-C3",
  "actor_id": "SIM-ACTOR-QA-7",
  "subject": {
    "kind": "candidate",
    "digest": "git:SIM-SKILL-C3",
    "attempt_id": "SIM-ATTEMPT-4",
    "contract_digest": "sha256:SIM-CONTRACT-2",
    "profile_digest": "sha256:SIM-PROFILE-WEB-3",
    "policy_digest": "sha256:SIM-QA-POLICY-5"
  },
  "outcome": "PASS",
  "evidence": [
    {
      "kind": "browser-journey",
      "result": "PASS",
      "artifact_ref": "repo:evidence/SIM-QA-C3.json"
    }
  ]
}
```

Candidate Gate：

```json
{
  "type": "gate.projected",
  "gate_id": "SIM-GATE-SKILL-CANDIDATE",
  "subject": {"kind": "candidate", "digest": "git:SIM-SKILL-C3"},
  "status": "passed",
  "predicate_digest": "sha256:SIM-QA-POLICY-5",
  "accepted_receipts": ["SIM-RCPT-SKILL-QA-C3"],
  "stale_receipts": []
}
```

Merge 后的 Integration Gate：

```json
{
  "type": "gate.projected",
  "gate_id": "SIM-GATE-SKILL-INTEGRATION",
  "subject": {"kind": "integration", "digest": "git:SIM-SKILL-I8"},
  "status": "pending",
  "accepted_receipts": [],
  "stale_receipts": [
    {
      "receipt_id": "SIM-RCPT-SKILL-QA-C3",
      "reason": "SUBJECT_CHANGED",
      "bound_subject": "git:SIM-SKILL-C3"
    }
  ],
  "missing": ["FinalFullSuiteReceipt", "HumanTestReceipt:visual-if-required"]
}
```

## 5. 跨图 trace

```json
{
  "trace_id": "SIM-TRACE-RETURN-1",
  "source": {
    "map": "delivery",
    "ticket_id": "SIM-WT-SKILL-42",
    "finding_id": "SIM-FINDING-PUBLIC-BEHAVIOR"
  },
  "classification": "requires-decision",
  "target": {
    "map": "discovery",
    "ticket_id": "SIM-WT-DECISION-18",
    "contract_revision": 3
  },
  "resume": {
    "return_map": "delivery",
    "return_ticket_id": "SIM-WT-SKILL-42",
    "return_filter": "frontier",
    "return_scroll_anchor": "SIM-FINDING-PUBLIC-BEHAVIOR"
  },
  "effects": {
    "new_wave": 3,
    "stale_receipt_ids": ["SIM-RCPT-SKILL-QA-C3"]
  }
}
```

## 6. 业务失败：Registry 无法精确重建

```json
{
  "ok": false,
  "status": "DEGRADED_PROFILE_UNAVAILABLE",
  "canonical_changed": false,
  "error": {
    "code": "PROFILE_DIGEST_MISMATCH",
    "expected": "sha256:SIM-PROFILE-WEB-3",
    "actual": "sha256:SIM-PROFILE-WEB-4",
    "allowed_actions": ["read", "diagnose", "pause", "cancel", "release"],
    "blocked_actions": ["claim", "dispatch", "retry", "publish-evidence", "project-pass", "close", "story-done"],
    "recovery": ["restore-exact-registry", "return-to-discovery-and-create-replacement-ticket"]
  }
}
```

## 7. 用法错：Web 尝试领域命令

```json
{
  "ok": false,
  "status": "REJECTED",
  "canonical_changed": false,
  "error": {
    "code": "READ_ONLY_SURFACE",
    "message": "Story Atlas v1 does not expose a Web domain-command channel.",
    "allowed_view_actions": ["search", "filter", "select", "history", "diff", "evidence", "export", "local-bookmark"]
  }
}
```

## 8. 意外错误：来源不完整

```json
{
  "ok": false,
  "status": "DEGRADED_SOURCE_UNREADABLE",
  "canonical_changed": false,
  "error": {
    "code": "PROJECTION_SOURCE_UNREADABLE",
    "source_ref": "repo:receipts/integration/SIM-SKILL-I8.json",
    "retryable": true,
    "projection_behavior": "serve-last-known-with-stale-banner-and-block-gate-contribution"
  }
}
```

## 已锁定候选约定

- `truth_class` 与字段 provenance 不得只存在于页面文案；投影报文必须携带。
- Discovery revision 与 WorkTicket membership 是不同集合。
- RepoLane identity 字段缺失时不得称为 RepoLane。
- `lifecycle/control/gate` 始终同时存在；`display_projection` 只能派生。
- Receipt 必须绑定 actor、typed subject、attempt、contract/profile/policy digest；subject 变化无条件 stale。
- Gate status 只能由 predicate + accepted/stale/missing Receipt 派生。
- Frontier 只返回可启动 WorkTicket，不返回 StoryRoot、Gate 或 reducer。
- Web Surface 的 `domain_commands` 固定为空；视图状态不得写回 Story 正本。
- P13：Contract 冻结 required/optional 分类；Story reducer 只合成 required Lane，optional debt 独立展示，不修改 Lane Gate 或伪造 Waiver。`optional_debt` 无条目时仍明确返回 `[]`。
- 字段名仍是 prototype 候选；语义确认后，具体 schema 命名可由实现 Agent 在不改变行为的前提下收敛。
