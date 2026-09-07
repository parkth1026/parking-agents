<!-- confirmed v1 | confirmed 2026-09-05 | 用户意见：全部按 A，继续 -->

# 可执行示例：请求、达到、阻塞与迁移

报文结构只以 `v1-api-mock.md` 为准；本文件只展示调用与人类可见输出。

## 场景 1：直接请求标准等级

```powershell
.\run.cmd gate.l3
```

```text
[AES-QG/1] requested=AES-QG-L3 candidate=7d9c0b4
[AES-QG L0] PASS reused receipt=sha256:10...
[AES-QG L1] PASS reused receipt=sha256:11...
[AES-QG L2] PASS executed run=run-102
[AES-QG L3] PASS executed run=run-103
AES-QG L3 PASS: achieved=L3; release-qualified=false
GateReceipt: .aes-gate/runs/run-103/gate-receipt.json
```

退出码 `0`。

## 场景 2：使用仓库 profile

```powershell
.\run.cmd gate.mid
```

```text
[gate profile] id=mid target=AES-QG-L3 policy=sha256:aa01...
AES-QG L3 PASS: profile=mid; achieved=L3; release-qualified=false
```

profile 名本身不是证据；最终结论必须展开成标准等级。

## 场景 3：裸 gate 拒绝歧义

```powershell
.\run.cmd gate
```

```text
ERROR [AES-QG] ambiguous gate action
Choose an objective level: gate.l0 ... gate.l5
Or choose a declared profile: gate.quick / gate.mid / gate.full
No gate was executed.
```

退出码 `64`。

## 场景 4：仓库能力不足

```powershell
.\run.cmd gate.l4
```

```text
BLOCKED_CAPABILITY: requested=AES-QG-L4 supportedThrough=AES-QG-L3
No AES-QG L4 PASS claim was emitted.
```

退出码 `2`。

## 场景 5：证据失效

```text
[AES-QG L0] STALE_EVIDENCE policyDigest changed aa01... -> bb02...
[AES-QG L0] re-executing
```

只有五项 identity 全匹配时输出 `reused`；TTL 不参与正确性判定。

## 场景 6：发布资格

```powershell
.\run.cmd gate.l5
```

```text
AES-QG L5 PASS
release profile desktop-release: BLOCKED
missing orthogonal evidence: security, live
release-qualified=false
```

L5 通过但发布仍阻塞是合法且必须可表达的状态。

## 场景 7：旧仓迁移

```powershell
node skills/workflow/aes-gate/scripts/collect.mjs --repo D:\GIT\LegacyRepo
```

```text
legacy gate discovered: action=gate status=green classification=legacy-unqualified
mapping candidate: gate -> AES-QG-L4 (UNCONFIRMED)
no AES-QG achievedLevel emitted until gate-policy.toml is confirmed
```

## 场景 8：保持不变的现有用法

```powershell
.\run.cmd test.regression
```

普通 `kind=test` action 的 argv、退出码和用途保持不变；只有它被 gate policy 引用时才新增
`classifiedAt` 元数据，不自动改名为 gate。
