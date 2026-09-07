<!-- confirmed v1 | confirmed 2026-09-05 | 用户意见：全部按 A，继续 -->

# 报文对照：AES-QG policy、receipt 与 QA 联动

## 1. `gate-policy.toml`

```toml
schema = "aes-gate-policy/v1"
standard = "AES-QG/1"
supported_through = "AES-QG-L5"

[[levels]]
level = "AES-QG-L0"
action = "gate.l0"
subject = "source"
environment_class = "hermetic"
network_policy = "none"
size_class = "small"

[[levels]]
level = "AES-QG-L1"
action = "gate.l1"
subject = "component"
environment_class = "hermetic"
network_policy = "none"
size_class = "medium"

[[levels]]
level = "AES-QG-L2"
action = "gate.l2"
subject = "component-integration"
environment_class = "controlled"
network_policy = "loopback-only"
size_class = "medium"

[[levels]]
level = "AES-QG-L3"
action = "gate.l3"
subject = "assembled-candidate"
environment_class = "controlled"
network_policy = "loopback-only"
size_class = "large"

[[levels]]
level = "AES-QG-L4"
action = "gate.l4"
subject = "release-candidate-artifact"
environment_class = "representative-controlled"
network_policy = "declared-endpoints"
size_class = "large"

[[levels]]
level = "AES-QG-L5"
action = "gate.l5"
subject = "installed-distributable-artifact"
environment_class = "representative-controlled"
network_policy = "declared-endpoints"
size_class = "enormous"

[[profiles]]
id = "quick"
action = "gate.quick"
target_level = "AES-QG-L1"

[[profiles]]
id = "mid"
action = "gate.mid"
target_level = "AES-QG-L3"

[[profiles]]
id = "full"
action = "gate.full"
target_level = "AES-QG-L4"

[[release_profiles]]
id = "desktop-release"
required_level = "AES-QG-L5"
required_quality_attributes = ["functional", "security", "compatibility"]
required_evidence_modes = ["automated", "live"]
require_provenance = true
```

约束：`levels[].action` 与 `profiles[].action` 必须在 `run.toml` 存在且 `kind="gate"`；
level 必须从 L0 连续到 `supported_through`，不能跳级。

`environment_class`、`network_policy`、`size_class` 是该仓 action 的可审计运行 policy，以上取值仅为
桌面应用示例；它们不参与 AES-QG 判级。`quick/mid/full` 到 L1/L3/L4 的映射同样只是本仓示例，
不是跨仓固定映射。

## 2. GateReceipt：成功

```json
{
  "schemaVersion": "aes.gate.receipt/v1",
  "standardVersion": "AES-QG/1",
  "requestedLevel": "AES-QG-L4",
  "achievedLevel": "AES-QG-L4",
  "outcome": "PASS",
  "candidate": {
    "commitSha": "7d9c0b4...",
    "worktreeDirty": false,
    "artifactDigest": "sha256:5f9c..."
  },
  "identity": {
    "policyDigest": "sha256:aa01...",
    "gateDefinitionDigest": "sha256:b811...",
    "environmentDigest": "sha256:c922..."
  },
  "levels": [
    {"level":"AES-QG-L0","disposition":"reused","receiptDigest":"sha256:10...","outcome":"PASS"},
    {"level":"AES-QG-L1","disposition":"reused","receiptDigest":"sha256:11...","outcome":"PASS"},
    {"level":"AES-QG-L2","disposition":"executed","runId":"run-102","outcome":"PASS"},
    {"level":"AES-QG-L3","disposition":"executed","runId":"run-103","outcome":"PASS"},
    {"level":"AES-QG-L4","disposition":"executed","runId":"run-104","outcome":"PASS"}
  ],
  "qualifiesForRelease": false,
  "releasePolicy": null
}
```

## 3. GateReceipt：能力不足

```json
{
  "schemaVersion": "aes.gate.receipt/v1",
  "standardVersion": "AES-QG/1",
  "requestedLevel": "AES-QG-L4",
  "achievedLevel": "AES-QG-L3",
  "outcome": "BLOCKED",
  "failureClass": "BLOCKED_CAPABILITY",
  "detail": "policy supportedThrough=AES-QG-L3; requested=AES-QG-L4",
  "unexecuted": ["AES-QG-L4"]
}
```

## 4. GateReceipt：测试失败

```json
{
  "schemaVersion": "aes.gate.receipt/v1",
  "standardVersion": "AES-QG/1",
  "requestedLevel": "AES-QG-L4",
  "achievedLevel": "AES-QG-L2",
  "outcome": "FAILED",
  "failureClass": "ASSERTION_FAILED",
  "failedAt": "AES-QG-L3",
  "levels": [
    {"level":"AES-QG-L0","outcome":"PASS"},
    {"level":"AES-QG-L1","outcome":"PASS"},
    {"level":"AES-QG-L2","outcome":"PASS"},
    {"level":"AES-QG-L3","outcome":"FAILED","runId":"run-203"},
    {"level":"AES-QG-L4","outcome":"NOT_REACHED"}
  ]
}
```

## 5. QaReceipt vNext 联动

```json
{
  "schemaVersion": "aes.qa.receipt/vNext",
  "jobId": "job-58",
  "attemptId": "attempt-2",
  "commitSha": "7d9c0b4...",
  "baseCommit": "211aa90...",
  "requiredRepositoryGate": "AES-QG-L3",
  "repositoryGate": {
    "standardVersion": "AES-QG/1",
    "achievedLevel": "AES-QG-L3",
    "gateReceiptDigest": "sha256:98bc...",
    "candidateCommitSha": "7d9c0b4...",
    "outcome": "PASS"
  },
  "checks": [
    {"id":"QA-1","kind":"automated","outcome":"PASS","command":"./run gate.l3"}
  ],
  "unexecuted": [],
  "outcome": "PASS"
}
```

`GATE-qa` 内部增加 level sub-gate：required/achieved 可比较、GateReceipt digest 合法、
candidate 一致、缺级/旧证据/NOT_RUN 均 fail closed。它不新增顶层第九道机械门。

## 6. tracker-only 结局

```json
{
  "schemaVersion": "aes.qa.receipt/vNext",
  "requiredRepositoryGate": "none",
  "repositoryGate": null,
  "repositoryGateReason": "tracker-only change; no product bytes changed",
  "checks": [{"id":"QA-tracker","kind":"live","outcome":"PASS"}],
  "unexecuted": [],
  "outcome": "PASS"
}
```

## 已锁定约定

- `achievedLevel` 是同 candidate 的最高连续 PASS，不是本轮最后执行的单项等级。
- `classifiedAt` 属于 gate/check 定义；`achievedLevel` 属于累计运行结果。
- `outcome` 闭集为 `PASS|BLOCKED|FAILED`；未执行用 `NOT_REACHED`，不能写 PASS。
- `qualifiesForRelease` 由 release profile 决定；L5 本身不自动赋 true。
- 新必填字段必须使用新 schemaVersion；v1/v2 历史 QaReceipt 不回溯加严。
