<!-- draft v1 | published 2026-08-27
     用户意见：Q1 撤销，declaredRisk 报文对作废
     状态：superseded by v2 -->
# 接口报文对: work-order/v1 增加 declaredRisk

## 报文对 1：正常 claim（改前 → 改后）

改前（现行 buildWorkOrder 产出，节选 issue 节）：

```json
{
  "schemaVersion": "aes.issue-worker.work-order/v1",
  "issue": {
    "number": 83,
    "contractDigest": "sha256:…",
    "workflowRole": "implement",
    "acceptanceCriteria": [{ "id": "AC-1", "evidenceClass": "automated", "text": "…" }],
    "allowedSideEffects": ["edit-worktree", "run-tests", "create-commit"]
  }
}
```

改后（新增一行，其余逐字节不变）：

```json
{
  "schemaVersion": "aes.issue-worker.work-order/v1",
  "issue": {
    "number": 83,
    "contractDigest": "sha256:…",
    "workflowRole": "implement",
    "declaredRisk": "medium",
    "acceptanceCriteria": [{ "id": "AC-1", "evidenceClass": "automated", "text": "…" }],
    "allowedSideEffects": ["edit-worktree", "run-tests", "create-commit"]
  }
}
```

## 报文对 2：非闭集 risk 注入（新增错误形态）

结构化 contract 直接注入 `riskProfile: "extreme"` 时，claim 当场拒收（现行为：透传到 merge gate 才炸）：

```json
{
  "ok": false,
  "code": "BAD_RISK_PROFILE",
  "message": "riskProfile 非闭集取值: extreme",
  "details": { "allowed": ["low", "medium", "high", "critical"] }
}
```

exit 2，不创建 job、不占 slot lease。

## 已锁定的约定

- `issue.declaredRisk` **始终存在**：契约六节 riskProfile 必填（缺则 ISSUE_CONTRACT_INCOMPLETE 回流 needs-info，本就不发工单）+ buildWorkOrder 增加 `assertRiskProfile` 兜底 —— 来自 Q1 裁定。
- 取值为四档**闭集** `low|medium|high|critical`，复用 merge-policy.mjs 的 RISK_PROFILES 常量，不另立副本。
- worker **只消费不重算**：declaredRisk 是 Issue 自报档，路径兜底升档（effectiveRisk）仍只在 Master merge gate 时计算；worker 的 review 深度按 declaredRisk 定 —— 来自 Q1 选项 A 的边界。
- schemaVersion **保持 v1**：additive 字段沿用本仓 registry v3 additive 惯例，不 bump；变更记入 board 的 references/design.md。
- 消费端容错：缺字段按 high 档深度处理（behavior.md 边界行 6），worker 不因缺字段拒单。
