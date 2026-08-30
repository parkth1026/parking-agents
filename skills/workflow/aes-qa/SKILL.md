---
name: aes-qa
description: worker 闭环内唯一的验证角色，三种调用形态：循环轮逐轮验证实现（只出 finding）、最终轮为唯一 candidate commit 出具绑定 SHA 的 typed QaReceipt（按影响面决定自动/live/人工）、打回修复后回归重验。如实记录未执行项与人工债务，绝不把 NOT_RUN 说成 PASS。当 aes-issue-worker 在实现循环中逐轮验证、commit 后出具最终 receipt，或需要为一次交付产出可审计的 QA 证据时使用；实际执行 screenshot check 时按 AES GitLab terminal batch 发布并要求 VERIFIED，未跑截图不触发。
---

# AES QA

给一个 candidate commit 出具**可审计**的验证结论。本技能的价值不在于「跑测试」，
而在于**如实**：哪些验证真的跑了、哪些没跑、哪些只有人能做。

## 截图证据分支：实际跑了才触发

只有本 QA attempt **实际执行 screenshot check**，或截图实际参与规格、verdict / Finding，
才产生 GitLab 发布义务；Issue 有界面 AC 或代码改了 UI 都不自动触发。进入该分支前必须读
[GitLab 截图证据协议](references/screenshot-evidence.md)，按其中公共入口执行：capture 只写
stable local spool，完整 attempt terminal 后只冻结并发布一个 claim-complete batch，final
candidate 必须新 attempt 重跑。没有实际截图则 publisher、GitLab note 与空 marker 都是 0。

capture executor 不持远端写权限；owner session 的最小权限 publisher 是唯一 GitLab writer；
gate 只读 aggregate marker。默认 `A=3`、`R=2`，正常严格路径为 `2U+2` HTTP；首次成功
模型摘要≤512 UTF-8 bytes，异常/resume 与批次总预算见详细协议。

这是内部 GitLab 的 AES QA 协议，不适用于通用 artifacts、非 GitLab tracker、trace/video/
日志或 source-controlled visual baseline。

## 三种调用形态

aes-qa 是 worker 闭环里**唯一的验证角色**，三种调用是同一技能的不同形态：

| 形态 | 何时 | 输出 | SHA 绑定 |
| --- | --- | --- | --- |
| 循环轮 | 实现每轮产出后（工作树上） | 只出 finding，不出 receipt、不进 registry | 无 |
| 最终轮 | 唯一 candidate commit 登记后 | typed QaReceipt（本文档定义的结构） | 绑 commit SHA |
| 回归 | aes-merge-worker 打回、修复产生新 commit 后 | 重走循环轮收敛 + 最终轮出新 receipt | 绑新 SHA |

循环轮以 fresh-context 只读 subagent 运行，输入只有 AC + worktree 路径 + 命令，
不带实现者叙述——独立性来自上下文隔离。最终轮重跑自动档（覆盖 simplify 改动）
并按影响面补 live/manual 档；它与循环轮的唯一区别是输出格式与 SHA 绑定。
回归不是新机制：新 commit 使旧 receipt 因 `STALE_EVIDENCE` 作废，重走即可——
不存在拿旧绿顶新码的合法路径。

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
| 界面、交互、视觉 | `live` + 人工 | 若实际执行 screenshot，固定视口截图进入 GitLab 证据分支；人工确认仍由人完成 |
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
  "screenshotEvidence": { "required": false },
  "outcome": "PASS",
  "unexecuted": [],
  "manualDebt": []
}
```

新 receipt 明确写 `screenshotEvidence.required`。任何 `checks[].kind` 为
`screenshot|live-screenshot` 的 receipt 都必须是 `required:true`，并携带 VERIFIED
`aggregateMarker`；漏填或冲突 fail closed。无截图的旧 v1 receipt 继续兼容。wrapper、marker
字段和 candidate gate 只由 [截图证据协议](references/screenshot-evidence.md) 定义，不在这里复制。

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
