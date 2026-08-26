---
name: aes-qa
description: 为一个绑定精确 commit 的 candidate 选择 QA 档位并产出 typed QaReceipt：按影响面决定自动/live/人工，如实记录未执行项与人工债务，绝不把 NOT_RUN 说成 PASS。当 aes-issue-worker 需要在 review 通过后验证改动，或需要为一次交付产出可审计的 QA 证据时使用。
---

# AES QA

给一个 candidate commit 出具**可审计**的验证结论。本技能的价值不在于「跑测试」，
而在于**如实**：哪些验证真的跑了、哪些没跑、哪些只有人能做。

## 唯一硬约束

**`NOT_RUN` 永远不能被写成 `PASS`。**

历史上最贵的错误不是测试失败，是没跑的测试被当成跑过了。所以：

- 没执行的检查进 `unexecuted[]`，不进 `checks[]` 的 PASS；
- 只有人能确认的进 `humanChecklist[]`，`outcome` 是 `AWAITING_HUMAN`；
- `AWAITING_HUMAN` 永不因超时变成 `PASS`；
- Agent 不得代答人工验收。

Master 的机械门会检查这些：`checks[]` 里出现 `NOT_RUN`、或 `unexecuted[]` 非空时，
`GATE-qa` 直接判失败，candidate 不会被合并。

## 先定影响面，再定档位

按改动**实际触及**什么来选，不按改动大小：

| 影响面 | 档位 | 证据 |
| --- | --- | --- |
| 纯内部逻辑、有单测覆盖 | `automated` | 跑既有回归入口 |
| CLI / 报文 / 文件格式 | `automated` + 端到端 | 真实调用一次，比对输出 |
| GitHub identity、权限、外部 API | `live` | 真实环境验证正例与反例（错误账号必须 fail closed） |
| 界面、交互、视觉 | `live` + 人工 | 固定视口截图 + 人工确认 |
| 无法自动断言的判断（观感、措辞、业务正确性） | `manual` | `humanChecklist` |

选 `automated` 却改了 identity，等于没验。选 `manual` 却本可以自动断言，
等于把成本转嫁给用户。两边都算失职。

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
  "outcome": "PASS",
  "unexecuted": [],
  "manualDebt": []
}
```

失败时必须带 `failureClass`（`must-fix` / `retryable` / `environment`）。
环境污染与真实缺陷烧的是不同预算，混为一谈会让 owner 在还没修到点子上时
就先耗尽修复机会。

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

## secrets

任何报文里都不出现凭据本身，只出现 `identityDigest` 这类引用。
runner config 同理。
