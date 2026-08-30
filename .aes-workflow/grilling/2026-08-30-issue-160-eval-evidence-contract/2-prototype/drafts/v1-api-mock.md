<!-- draft v3 | independence/context revision 2026-08-30T20:13:50+08:00
     用户意见：Creator 独立；上下文选择主文件与创建分支双零增长
     状态：confirmed basis for Goal Contract -->

# 接口报文对: Creator 外部证据评测与持续质量门

## 1. Eval 定义：用户题面与 harness 分离

### `eval_metadata.json` / `output-evals.json.evals[]`

```json
{
  "name": "eval-升降桌小房间调研",
  "prompt": "我想买一张电动升降桌……",
  "assertions": [
    {"name": "销量代理一手口径", "type": "manual", "ac": "AC-3"}
  ],
  "quality": {
    "hypotheses": [
      {
        "id": "QH-01",
        "lever": "completion_criteria",
        "risk": "Agent 完成检索与计算，但没有把关键证据成组带入最终报告",
        "expected_behavior": "报告在同一证据表中呈现来源、时间、口径与约束结论",
        "assertions": ["AC-3"],
        "gates": ["with_skill", "old_skill"]
      }
    ],
    "policy": {
      "stability_runs": 3,
      "required_comparators": ["old_skill"],
      "cost_budget": {"tokens_ratio_vs_old_max": 1.25}
    }
  },
  "evidence": {
    "schema_version": 1,
    "mode": "replay",
    "provider": "external-evidence-v1",
    "manifest": "eval-fixtures/eval-升降桌小房间调研/epoch-1/evidence-pack.json",
    "manifest_sha256": "sha256:3e6c...f19a",
    "epoch": 1,
    "miss_policy": "fail",
    "live_policy": {
      "trigger": "manual_or_stale",
      "concurrency": 1,
      "max_calls": 16
    }
  }
}
```

旧条目可以没有 `evidence`；正规化投影为：

```json
{"mode":"unmanaged","audit":"unknown","compatibility":"legacy"}
```

## 2. Evidence manifest：最小、脱敏、内容寻址

```json
{
  "schema_version": 1,
  "kind": "eval-evidence-manifest",
  "eval": "eval-升降桌小房间调研",
  "epoch": 1,
  "captured_at": "2026-09-10T10:30:00+08:00",
  "sanitization": {
    "status": "passed",
    "ruleset": "external-evidence-v1"
  },
  "entries": [
    {
      "id": "desk-industry-metrics",
      "intent": "电动升降桌核心行业指标与安全标准",
      "query": "电动升降桌 行业标准 核心指标 稳定性 承重",
      "payload": "payloads/desk-industry-metrics.json",
      "sha256": "sha256:a1b2...c3d4",
      "source_count": 8
    },
    {
      "id": "desk-current-skus",
      "intent": "预算内当前在售型号、价格与评论数",
      "query": "电动升降桌 3000 以内 在售 型号 评论数",
      "payload": "payloads/desk-current-skus.json",
      "sha256": "sha256:9f8e...7d6c",
      "source_count": 12
    }
  ],
  "manifest_sha256": "sha256:3e6c...f19a"
}
```

禁止进入持久 manifest/payload 的字段：本机会话 id、用户目录绝对路径、凭据、cookie、完整请求头、与本 eval 无关的历史 query。

## 3. Materialize 成功报文

```json
{
  "ok": true,
  "kind": "evidence-materialized",
  "mode": "replay",
  "eval": "eval-升降桌小房间调研",
  "epoch": 1,
  "evidence_digest": "sha256:3e6c...f19a",
  "target": ".../with_skill/run-1/inputs/evidence-pack",
  "entries": 2,
  "hits": 2,
  "misses": 0,
  "live_calls": 0,
  "network_isolation": "verified"
}
```

同一 eval 的每个 gate 返回的 `evidence_digest` 必须逐字相同。

## 4. 失败与阻塞报文

### 预检缺 payload：环境/证据前置不足

```json
{
  "ok": false,
  "status": "BLOCKED",
  "code": "BLOCKED_EVIDENCE_UNAVAILABLE",
  "eval": "eval-升降桌小房间调研",
  "entry_id": "desk-current-skus",
  "expected_sha256": "sha256:9f8e...7d6c",
  "live_calls": 0,
  "next_safe_action": "显式运行 record/live 补齐新 epoch；当前 replay 不自动联网"
}
```

### 运行中请求未声明 query：被测行为偏离固定输入

```json
{
  "ok": false,
  "status": "FAIL",
  "code": "REPLAY_QUERY_MISS",
  "eval": "eval-升降桌小房间调研",
  "intent": "补查某品牌 2026 年投诉",
  "query_sha256": "sha256:77aa...88bb",
  "live_calls": 0,
  "next_safe_action": "终止本 run；由独立 record 流程裁定是否扩 manifest"
}
```

### 摘要不匹配：证据损坏或被改写

```json
{
  "ok": false,
  "status": "FAIL",
  "code": "EVIDENCE_INTEGRITY_MISMATCH",
  "entry_id": "desk-current-skus",
  "expected_sha256": "sha256:9f8e...7d6c",
  "actual_sha256": "sha256:0000...1111",
  "live_calls": 0,
  "next_safe_action": "保留旧文件供审计；不得自动覆盖或重签摘要"
}
```

### Host 无法隔离 live 工具

```json
{
  "ok": false,
  "status": "BLOCKED",
  "code": "BLOCKED_NETWORK_ISOLATION_UNAVAILABLE",
  "host": "current-agent-host",
  "required_capability": "disable_or_audit_external_tools",
  "next_safe_action": "换用可隔离 host；或只作 exploratory 运行且不计入主 benchmark"
}
```

### Live 预算耗尽

```json
{
  "ok": false,
  "status": "BLOCKED",
  "code": "LIVE_BUDGET_EXHAUSTED",
  "eval": "eval-升降桌小房间调研",
  "max_calls": 16,
  "completed_calls": 16,
  "remaining_entries": 2,
  "epoch_promoted": false
}
```

## 5. Benchmark / history 审计

```json
{
  "eval": "eval-升降桌小房间调研",
  "evidence_audit": {
    "mode": "replay",
    "provider": "external-evidence-v1",
    "evidence_epoch": 1,
    "evidence_digest": "sha256:3e6c...f19a",
    "harness_digest": "sha256:55dd...66ee",
    "hits": 2,
    "misses": 0,
    "live_calls": 0,
    "network_isolation": "verified",
    "gate_digest_consistent": true
  },
  "configs": {
    "with_skill": {"pass_rate": 1},
    "without_skill": {"pass_rate": 0.5}
  },
  "quality_audit": {
    "hypotheses_total": 1,
    "hypotheses_covered": 1,
    "required_runs": 3,
    "completed_runs": {"with_skill": 3, "old_skill": 3},
    "assertion_delta": {"AC-3": 0.3333},
    "cost_budget_status": "within_budget",
    "comparison_epoch_consistent": true
  },
  "quality_verdict": {
    "status": "SUPPORTED",
    "reasons": ["QH-01 在同一 evidence/harness epoch 下稳定优于 old_skill"]
  }
}
```

跨 digest/epoch：

```json
{
  "vs_previous": null,
  "comparison_status": "incomparable",
  "reason": "evidence_or_harness_epoch_changed",
  "current_best": "reset_within_epoch"
}
```

## 6. 质量假设与无区分度终态

### 静态 Agent 文档审查只产 finding，不直接 PASS

```json
{
  "kind": "agent-document-review",
  "source": "parking-skill-creator/references/writing-guide.md",
  "findings": [
    {
      "id": "QH-01",
      "lever": "completion_criteria",
      "evidence": "脚本已产出目标数据，但当前报告模板没有要求把它带入最终产物",
      "risk": "执行步骤完成，用户仍看不到关键结果",
      "required_follow_up": "绑定行为断言与 old/with 对照"
    }
  ],
  "not_applicable": ["leading_words"],
  "verdict": "FINDINGS_RECORDED_NOT_PROVEN"
}
```

`not_applicable` 必须带基于当前技能的理由；不能为凑 checklist 人造 finding。

### Creator 独立性与上下文预算审计

```json
{
  "kind": "creator-context-audit",
  "independence": {
    "external_skill_dependencies": [],
    "forbidden_reference": "writing-for-agents",
    "package_standalone": true
  },
  "always_loaded": {
    "files": ["SKILL.md"],
    "utf8_bytes": 31415,
    "max_utf8_bytes": 31415,
    "lines": 312,
    "max_lines": 312,
    "status": "PASS"
  },
  "create_or_edit_branch": {
    "files": ["SKILL.md", "references/writing-guide.md"],
    "utf8_bytes": 40364,
    "max_utf8_bytes": 40364,
    "lines": 475,
    "max_lines": 475,
    "status": "PASS"
  }
}
```

任一 bytes/lines 超限，或 package/SKILL/script/eval 出现对外部 skill 的运行引用，审计即 FAIL。基线数字固定为 2026-08-30 用户确认值，执行时不得重算成更大的新基线。

### 所有 gate 高分但没有证明增益

```json
{
  "quality_verdict": {
    "status": "INCONCLUSIVE",
    "reasons": [
      "with_skill 与 without_skill 三个断言全部平手",
      "当前题面不能区分 Creator 介入与强模型默认能力",
      "with_skill token 成本为 without_skill 的 3.31 倍"
    ],
    "forbidden_claims": [
      "parking-skill-creator 已被证明能持续产出更好技能",
      "绝对 pass_rate=100% 等价于相对增益"
    ],
    "next_safe_action": "先增强用户结果断言或增加定向消融；不要为了让当前题变绿继续堆 SKILL.md 规则"
  }
}
```

### 关键行为回归

```json
{
  "quality_verdict": {
    "status": "REGRESSED",
    "reasons": ["AC-10 在 with_skill 为 2/3，old_skill 为 3/3"],
    "candidate_promoted": false
  }
}
```

## 已锁定的约定

- `prompt` 始终是用户任务原话；harness 私有信息只进 `evidence`。
- `mode` 闭集：`replay | record | live | unmanaged`。
- replay 成功报文始终含 `evidence_digest/hits/misses/live_calls/network_isolation`。
- replay miss 不 fallback；`live_calls` 仍为 0。
- 预检缺证据与 host 隔离不足是 `BLOCKED`；运行中未声明 query 与摘要不匹配是 `FAIL`。
- record/live 必须显式授权、串行且有 `max_calls`；不完整 record 不晋级 epoch。
- 旧记录缺新字段时显示 unknown/unmanaged，不回填、不伪造。
- `writing-for-agents` 只作为本轮设计调研来源；Creator 产品只使用自己已有的 `references/writing-guide.md`，不得读取、调用或要求安装外部 skill。
- Agent 文档静态审查只产 finding；`quality_verdict` 由断言覆盖、相关 comparator、stability runs、成本预算与 evidence/harness 可比性共同得出。
- run 的 PASS/FAIL 与聚合的 `SUPPORTED/INCONCLUSIVE/REGRESSED/BLOCKED` 分离；绝对高分不能自动升级为质量证明。
- Creator `SKILL.md` 与创建/改写分支分别受 31,415 bytes/312 行、40,364 bytes/475 行双硬上限；不新增第二 writing reference/pointer。
