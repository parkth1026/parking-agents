# QA 回执与人工续接

命令以 aes-qa 技能目录为基准。

按当前任务采用的版本读取。v1/v2 历史语义保持兼容；v3/v4 的字段和证据要求不能通过换版本规避。

## 输出：QaReceipt

`aes.qa.receipt/v1`，必须绑定 `jobId` / `attemptId` / `commitSha`。
`commitSha` 与当前 candidate 不一致时 Master 会以 `STALE_EVIDENCE` 拒收 —— 
candidate 前进后必须重跑，不能拿旧结论顶。

```json
{
  "schemaVersion": "aes.qa.receipt/v1",
  "jobId": "job-45-4d2a91",
  "attemptId": "attempt-1",
  "commitSha": "a929590",
  "environment": { "kind": "local-live", "identityDigest": "sha256:env-45" },
  "impactClasses": ["cli", "github-identity"],
  "checks": [
    { "id": "QA-1", "kind": "automated", "outcome": "PASS", "command": "node run-tests.mjs" },
    { "id": "QA-2", "kind": "live", "outcome": "PASS", "summary": "错误账号 fail closed" }
  ],
  "screenshotEvidence": { "required": false },
  "outcome": "PASS",
  "unexecuted": [],
  "manualDebt": []
}
```

新 receipt 明确写 `screenshotEvidence.required`。任何 `checks[].kind` 为
`screenshot|live-screenshot` 的 receipt 都必须是 `required:true`，并携带 VERIFIED
`aggregateMarker`；漏填或冲突 fail closed。无截图的旧 v1 receipt 继续兼容。wrapper、marker
字段和 candidate gate 只由 [截图证据协议](screenshot-evidence.md) 定义，不在这里复制。

失败时必须带 `failureClass`（`must-fix` / `retryable` / `environment`）。
环境污染与真实缺陷烧的是不同预算，混为一谈会让 owner 在还没修到点子上时
就先耗尽修复机会。

## repository gate level：`aes.qa.receipt/v3`

需要声明仓库门强度的最终轮使用 v3（标准所有权在 aes-gate 的 `AES-QG/1`，规范见
`../../aes-gate/references/aes-qg.md`）。v3 = v2 全部义务（`baseCommit` 强制）＋ repository
gate 原子引用：

```json
{
  "schemaVersion": "aes.qa.receipt/v3",
  "jobId": "job-58", "attemptId": "attempt-2",
  "commitSha": "7d9c0b4…", "baseCommit": "211aa90…",
  "requiredRepositoryGate": "AES-QG-L3",
  "repositoryGate": {
    "standardVersion": "AES-QG/1",
    "achievedLevel": "AES-QG-L3",
    "gateReceiptDigest": "sha256:<GateReceipt canonical JSON 的 sha256>",
    "candidateCommitSha": "7d9c0b4…",
    "outcome": "PASS"
  },
  "checks": [ { "id": "QA-1", "kind": "automated", "outcome": "PASS", "command": "./run gate.l3" } ],
  "unexecuted": [], "outcome": "PASS"
}
```

- `repositoryGate` 必须原子引用**同一 candidate** 的 `aes.gate.receipt/v1`：digest 取引擎
  canonical JSON 的 sha256（跑 `node ../aes-gate/scripts/aes-qg.mjs --repo <repo> gate.l3`
  拿 receipt，不手抄等级结论）。缺级、旧证据、NOT_RUN、裸 `Lx`、candidate 不符，
  GATE-qa 一律 fail closed。
- `requiredRepositoryGate="none"` 只用于 tracker-only 工作：`trackerOnly:true` +
  `repositoryGateReason`（记录用途，不是绕过）+ candidate 无 product bytes 变化；GATE-qa
  按默认拒绝的 tracker-only 路径白名单机械复核，不得伪造 L0 PASS。
- v1/v2 历史语义永久冻结：无 repository gate 义务，GATE-qa 豁免该子门；v3 缺字段
  fail closed，不降级成旧 receipt 处理。
- 等级与发布资格正交：`AES-QG L5 PASS` 不等于 release-qualified，正交证据另由
  release profile 裁决。

## `aes.qa.receipt/v4`：等级三态 + agent-live + 伴随证据

v4 = v2 全部义务（`baseCommit` 强制）＋等级栏三态强制＋agent-live 托底断言＋截图
伴随保留。普通轮（非 v3 opt-in）也用 v4 收口等级语言：

```json
{
  "schemaVersion": "aes.qa.receipt/v4",
  "jobId": "job-2026-09-12-171", "attemptId": "att-3",
  "commitSha": "7d9c0b4…", "baseCommit": "c1d2e3f…",
  "repositoryGate": {
    "status": "referenced", "standardVersion": "AES-QG/1",
    "requiredLevel": "AES-QG-L3", "achievedLevel": "AES-QG-L3",
    "gateReceiptDigest": "sha256:<引擎收据 canonical JSON 摘要>",
    "candidateCommitSha": "7d9c0b4…", "outcome": "PASS"
  },
  "checks": [
    { "id": "agent-journey-login", "kind": "agent-live", "outcome": "PASS",
      "driver": { "model": "glm-5.3", "capabilitySkill": "browser-use:control-browser" },
      "assertions": [
        { "claim": "名单内模型真实 spawn", "backing": { "layer": "sidecar-session", "pointer": "…log", "digest": "sha256:<被指工件摘要>" } }
      ] }
  ],
  "screenshotEvidence": { "required": false },
  "outcome": "PASS", "unexecuted": [], "manualDebt": [], "failureClass": null
}
```

- **等级栏三态**（`repositoryGate.status` 闭集，缺字段 fail closed）：
  `referenced`——引擎同源原子引用（digest 内容寻址 + 同 candidate 双绑定，跑
  `node ../aes-gate/scripts/aes-qg.mjs --repo <repo> gate.l3` 拿收据，不手抄）；
  `not-onboarded`——非空 `reason` + `trackerOnly` 布尔，验收单有效（v3 的 `"none"`
  语义冻结在 v3，v4 用此态表达；治理=计量+复盘不设硬门，消费侧对账 `gate-policy.toml`
  存在性，仓有 policy 而自称未接入即拒收）。
- **gate-shortfall**：声明 `requiredLevel` 且引擎实跑未达时，`outcome=FAIL` +
  `failureClass=gate-shortfall`（新枚举，仅此场景）——门级不够≠功能缺陷，打回回
  引擎重跑；未声明 `requiredLevel` 时 achieved 即结论，无此失败语义。
- **agent-live**：`driver{model, capabilitySkill}` 仅该 kind 允许；进 receipt 的断言
  `backing` 必含 `layer`（四值闭集 dom-assertion/server-trace/read-model/
  sidecar-session）+ `pointer` + `digest`（`sha256:<64hex>` 内容寻址）。无 digest
  视同无托底，整条降档 humanChecklist（`AWAITING_HUMAN` + `demotedFrom`/
  `demotionReason`，用 `scripts/v4-receipt.mjs` 的降档工具，agent 不得代答）。
  操作配方见 [业务真实验收](business-acceptance.md)。
- **伴随截图保留**：`screenshotEvidence.required=true` 的最终轮 VERIFIED 后跑
  `scripts/companion-freeze.mjs` 冻结伴随目录（`shots/` + `shots-manifest.json` +
  `qa-report.html` 出票必产），`companionShots` 块进 receipt；`secretsScan` 对象化
  （CLEAR=已声明 scope 内未检出，像素盲区显式声明），BLOCKED 则 receipt FAIL、不入库；
  candidate 变更后旧伴随目录同批作废。详见
  [截图证据协议·伴随目录冻结](screenshot-evidence.md)。
- **qa-report.html**：一等伴随产物，双击即可人类可读消费全部结果与截图（单文件、
  零外链、断网可开、图片 `shots/` 相对引用）；只落本地，不发布 tracker。
- 出票前用 `validateQaReceiptV4`（`scripts/v4-receipt.mjs`）自校验；消费侧
  GATE-qa 对 v4 走全套机械复算（版本白名单、三态、对账、companionShots 完整性）。

## 需要人的时候

```json
{
  "outcome": "AWAITING_HUMAN",
  "candidateFrozen": true,
  "writerLease": "RELEASED",
  "environmentLease": "env-lease-board-1",
  "humanChecklist": [
    { "id": "H-1", "step": "在 700×1000 下确认一跳展开", "expected": "#60 真实出现，不是淡出别人" }
  ],
  "resumeToken": "qa-resume-job-ui-7"
}
```

- `candidateFrozen`：冻结当前 candidate 与环境证据，人回来时看到的还是同一份现场；
- `writerLease: RELEASED`：让出 writer slot，别让一个等人的 job 占着 runner；
- `environmentLease`：确实需要保活的测试环境走独立 lease，不占 writer；
- `resumeToken`：人工答复凭它找回本 job。缺了它整个报文会被拒收。

`humanChecklist` 的每一条都要能被一个不了解上下文的人执行：写清楚**做什么**和
**期望看到什么**，不要写「检查一下是否正常」。
