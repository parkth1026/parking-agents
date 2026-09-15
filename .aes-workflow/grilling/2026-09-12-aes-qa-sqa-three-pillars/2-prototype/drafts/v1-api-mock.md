<!-- draft v1 | published 2026-09-12T09:00:00Z
     用户意见：待质疑
     状态：draft -->
# 接口报文对: aes.qa.receipt/v4 与 GATE-qa verdict

## 对 1：成功 · 已接入门禁（等级栏 referenced）

```json
{
  "schemaVersion": "aes.qa.receipt/v4",
  "jobId": "job-2026-09-12-171",
  "attemptId": "att-3",
  "commitSha": "7d9c0b4a1e9f33c2b8d6a5f4e3d2c1b0a9988776",
  "baseCommit": "c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0",
  "environment": { "kind": "worker", "identityDigest": "sha256:9f8e…9988" },
  "impactClasses": ["cli", "identity"],
  "repositoryGate": {
    "status": "referenced",
    "standardVersion": "AES-QG/1",
    "requiredLevel": "AES-QG-L3",
    "achievedLevel": "AES-QG-L3",
    "gateReceiptDigest": "sha256:ab12…ef90",
    "candidateCommitSha": "7d9c0b4a1e9f33c2b8d6a5f4e3d2c1b0a9988776",
    "outcome": "PASS"
  },
  "checks": [
    { "id": "regression-suite", "kind": "automated", "outcome": "PASS", "command": "node run-tests.mjs" },
    {
      "id": "agent-journey-login", "kind": "agent-live", "outcome": "PASS",
      "driver": { "model": "glm-5.3", "capabilitySkill": "browser-use:control-browser" },
      "assertions": [
        { "claim": "名单内模型真实 spawn，CLI banner 为证", "backing": { "layer": "sidecar-session", "pointer": "codex/sessions/2026-09-12T08-11.log" } },
        { "claim": "工作台出现会话卡片", "backing": { "layer": "read-model", "pointer": "sqlite:sessions/row-88" } }
      ],
      "summary": "正例 spawn + 反例 WS patch 被拒，双向闭环"
    },
    {
      "id": "visual-polish", "kind": "manual", "outcome": "AWAITING_HUMAN",
      "summary": "确认设置页配色观感", "demotedFrom": "agent-live", "demotionReason": "断言无四层托底证据"
    }
  ],
  "humanChecklist": [
    { "id": "hc-1", "what": "打开设置页查看配色", "expect": "无刺眼对比", "outcome": "AWAITING_HUMAN" }
  ],
  "screenshotEvidence": {
    "required": true,
    "aggregateMarker": { "schemaVersion": "aes.screenshot-evidence-marker/v1", "status": "VERIFIED", "candidateSha": "7d9c0b4a…" },
    "companionShots": {
      "dir": "shots/", "manifest": "shots-manifest.json",
      "manifestSha256": "sha256:3344…7788", "count": 4, "secretsScan": "CLEAR"
    }
  },
  "outcome": "PASS",
  "unexecuted": [],
  "manualDebt": [],
  "failureClass": null
}
```

## 对 2：成功 · 未接入门禁（not-onboarded）

```json
{
  "schemaVersion": "aes.qa.receipt/v4",
  "jobId": "job-2026-09-12-172",
  "attemptId": "att-1",
  "commitSha": "8877…ab",
  "baseCommit": "6655…cd",
  "repositoryGate": {
    "status": "not-onboarded",
    "reason": "仓库未做门禁建设，run.toml 无已注册 gate",
    "trackerOnly": false
  },
  "checks": [ { "id": "regression-suite", "kind": "automated", "outcome": "PASS", "command": "npm test" } ],
  "screenshotEvidence": { "required": false },
  "outcome": "PASS",
  "unexecuted": [], "manualDebt": [], "failureClass": null
}
```

## 对 3：业务失败 · 未达声明门级（gate-shortfall）

```json
{
  "schemaVersion": "aes.qa.receipt/v4",
  "jobId": "job-2026-09-12-171", "attemptId": "att-3",
  "commitSha": "7d9c0b4a1e9f33c2b8d6a5f4e3d2c1b0a9988776",
  "repositoryGate": {
    "status": "referenced", "standardVersion": "AES-QG/1",
    "requiredLevel": "AES-QG-L3", "achievedLevel": "AES-QG-L1",
    "gateReceiptDigest": "sha256:ab12…ef90",
    "candidateCommitSha": "7d9c0b4a1e9f33c2b8d6a5f4e3d2c1b0a9988776",
    "outcome": "FAILED"
  },
  "checks": [ { "id": "regression-suite", "kind": "automated", "outcome": "PASS", "command": "node run-tests.mjs" } ],
  "outcome": "FAIL",
  "failureClass": "gate-shortfall"
}
```

## 对 4：用法错 · GATE-qa 拒收（fail closed）

receipt 侧错误输入（三例同判拒收）：status 不在闭集 / 等级写裸 "L3" / 缺 repositoryGate：

```json
{
  "gate": "GATE-qa",
  "schemaVersion": "aes.qa.gate-verdict/v1",
  "result": "FAIL",
  "reasons": ["repositoryGate.status 不在闭集 {referenced, not-onboarded}"]
}
```

## 对 5：兼容 · 旧 v3 receipt 照旧豁免

```json
{ "schemaVersion": "aes.qa.receipt/v3", "jobId": "…", "requiredRepositoryGate": "AES-QG-L3", "repositoryGate": { "…": "v3 既有字段原样" } }
```

GATE-qa verdict：`{ "gate": "GATE-qa", "result": "PASS", "legacy": true }`（v4 判别上线后 v3 依旧走豁免分支，逐字节等价于现状）

## 已锁定的约定

- `repositoryGate.status` 闭集 `{referenced, not-onboarded}`；v4 必填，缺字段 fail closed 不降级
- `requiredLevel` 可空：未声明目标级时 achieved 即结论，无「未达」失败语义（Q2 裁决）
- 等级值必须全称 `AES-QG-L<k>`，裸 `Lx` 拒收（v3 先例沿用）
- `not-onboarded` 必须带非空 `reason`；`trackerOnly` 布尔仅该状态下出现（吸收 v3 none 白名单场景）
- `checks[].kind` 新增 `agent-live`（既有 kind 不变）；`driver{model, capabilitySkill}` 仅 agent-live 必填、其他 kind 禁止
- `assertions[].backing.layer` 闭集 `{dom-assertion, server-trace, read-model, sidecar-session}`——UI 可见性断言必须有四层之一托底，无托底整条降档 humanChecklist（行为行 4）
- `companionShots` 仅 `screenshotEvidence.required=true` 时出现；`manifestSha256` 必填；`secretsScan ∈ {CLEAR, BLOCKED}`，BLOCKED → receipt FAIL
- `failureClass` 闭集扩为 `{must-fix, retryable, environment, gate-shortfall}`；gate-shortfall 仅当 repositoryGate.outcome=FAILED（Q-a 待用户裁决）
- 降档标注 `demotedFrom/demotionReason` 仅 manual 档降档项出现
- 以上由 1-interview round 1 的 Q1/Q2/Q3/Q4 与钢人裁决定下
