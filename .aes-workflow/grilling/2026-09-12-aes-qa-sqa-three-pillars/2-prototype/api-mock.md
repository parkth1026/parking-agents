# 接口报文对: aes.qa.receipt/v4 与 GATE-qa verdict

**确认版·锁定。** 用户确认：2026-09-12

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
- `not-onboarded` 必须带非空 `reason`；`trackerOnly` 布尔仅该状态下出现（吸收 v3 none 白名单场景，round 2 裁决 A）
- `checks[].kind` 新增 `agent-live`（既有 kind 不变）；`driver{model, capabilitySkill}` 仅 agent-live 必填、其他 kind 禁止
- `assertions[].backing.layer` 闭集 `{dom-assertion, server-trace, read-model, sidecar-session}`——UI 可见性断言必须有四层之一托底，无托底整条降档 humanChecklist（行为行 4）
- `companionShots` 仅 `screenshotEvidence.required=true` 时出现；`manifestSha256` 必填；`secretsScan ∈ {CLEAR, BLOCKED}`，BLOCKED → receipt FAIL
- `failureClass` 闭集扩为 `{must-fix, retryable, environment, gate-shortfall}`；gate-shortfall 仅当 repositoryGate.outcome=FAILED（round 2 裁决 A）
- 降档标注 `demotedFrom/demotionReason` 仅 manual 档降档项出现
- 以上由 1-interview round 1 的 Q1/Q2/Q3/Q4、钢人裁决与 2-prototype round 2 定下

## v2 修订（钢人回炉，2026-09-12，round 4 用户「全案推荐」批准）

本节与上文冲突处以本节为准（上文为 v1 锁定快照，保留不删）：

1. **backing 内容寻址**：`assertions[].backing` 增必填 `digest`（被指工件 canonical sha256，格式 `sha256:<64hex>`）——**仅对进 receipt 的断言强制**；循环轮 finding 不要求（round 4 决策 4A）。无 digest 视同无托底，整条降档 humanChecklist。消费侧校验 digest 格式；契约 case 内抽样核验「digest 与被指文件实际内容一致」。
2. **not-onboarded 对账义务**：消费侧必须核对目标仓 `gate-policy.toml` 存在性——仓存在 policy 而 receipt 声称 not-onboarded → fail closed 拒收（防伪，无条件）。
3. **not-onboarded 代价形态=计量+复盘，不设硬门**：2026-09-12 盘点实证全域仅 1/N 仓接入（AntAgent_v2-manager），硬门（HUMAN_GATE）即变相强制接入、违背渐进双使命；治理=not-onboarded 单独可统计（现扫 receipts）+定期复盘；接入率显著变化后复议升级，重开条件写进 reference。
4. **消费侧复算三义务**（无论 receipt 自称什么）：①声明了 requiredLevel 即机械比较 achieved；②requiredLevel 与目标仓 gate-policy 声明目标级对账；③`outcome` / `repositoryGate.outcome` / `failureClass` 三裁决位一致性校验，互相矛盾拒收。
5. **secretsScan 语义诚实化**：由二值枚举改为对象 `{ result: "CLEAR"|"BLOCKED", scope: ["filename","metadata","extractable-text"], ocr: false }`——`CLEAR` 语义缩窄为「已声明 scope 内未检出」；像素内渲染内容为已声明盲区（零依赖约束下不做 OCR）；盲区说明随 reference 落盘。
