<!-- draft v2 | published 2026-08-27
     用户意见：round 9 全部确认（1.确认 2.aes-merge-worker 3.for-human 模式）
     状态：confirmed -->
# 接口报文对: review 打回通道（work-order 零改动）

v1 的 work-order declaredRisk 报文对已随 Q1 撤销作废：**work-order/v1 一个字节不改**。
本版定义的是 review 移至 Master 验收层后新出现的唯一新报文：**review 打回**。

## 报文对 1：Master review MUST_FIX 打回 worker

Master 侧 review subagent 产出 MUST_FIX 后，Master 发往原 owner session（或新 attempt 的
work-order 附件）：

```json
{
  "schemaVersion": "aes.issue-worker.review-return/v1",
  "jobId": "job-83-4d2a91",
  "attemptId": "job-83-4d2a91#attempt-1",
  "commitSha": "a929590",
  "verdict": "MUST_FIX",
  "findings": [
    {
      "id": "RF-1",
      "axis": "standards",
      "severity": "must-fix",
      "location": "scripts/foo.mjs:42",
      "finding": "重复实现了 runtime-store 已有的原子写",
      "requiredAction": "改用 writeJsonAtomic"
    }
  ],
  "budget": { "reviewLoops": { "used": 1, "limit": 3 } }
}
```

worker 收到后走完 行 1→4（solve⇄循环轮 → simplify → 新 commit → 最终轮）重新 READY。

## 报文对 2：review PASS（Master 侧内部上报，不发给 worker）

Master 用既有入口上报，与现行 stage receipt 同形：

```bash
node master.mjs stage review --job job-83-4d2a91 --payload-file review-pass.json
```

```json
{
  "schemaVersion": "aes.issue-worker.stage-result/v1",
  "jobId": "job-83-4d2a91",
  "attemptId": "job-83-4d2a91#attempt-1",
  "commitSha": "a929590",
  "outcome": "PASS",
  "axes": { "standards": "PASS", "spec": "PASS" },
  "depthTier": "light",
  "effectiveRisk": "medium"
}
```

## 报文对 3：打回预算耗尽（第 3 次 MUST_FIX 后 Master 侧决策）

```json
{
  "ok": false,
  "code": "REVIEW_BUDGET_EXHAUSTED",
  "jobId": "job-83-4d2a91",
  "budget": { "kind": "reviewLoops", "limit": 3, "used": 3 },
  "recommendedMasterActions": ["NEW_ATTEMPT_FRONTIER_MODEL", "AWAITING_HUMAN"]
}
```

## 已锁定的约定

- **work-order/v1 零改动**：不加 declaredRisk，不 bump schemaVersion——round 5 撤销 Q1。
- **review receipt 的 provenance 在 Master 侧**：`stage review` 由 Master 调用，worker 无法自报 review PASS（这是本次移层的核心收益）。
- **reviewLoops 记账权在 Master**：每次 MUST_FIX 打回时由 Master 递增；worker 不再自报 review 轴预算。
- `review-return/v1` 的 `verdict` 闭集 `MUST_FIX`（PASS 不打回、不产生此报文）；`findings[].axis` 闭集 `standards|spec`；`severity` 沿用 `must-fix`（普通 finding 不打回，Master 侧自行记录不烦扰 worker——v4 消噪原则保持）。
- 打回报文的 `commitSha` 必须等于被审的 candidateCommit；worker 收到后产生的新 commit 使该打回单据闭合，同一打回不重复消费。
- QA 侧（`aes.qa.receipt/v1`）报文结构不变；最终轮与循环轮共用 aes-qa 技能，仅最终轮出 receipt。
