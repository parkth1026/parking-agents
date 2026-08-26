---
name: aes-issue-worker
description: 在一个 owner session 内把一张 typed IssueWorkOrder 跑成 typed 终局：实现 → 只读 review → 修复 → QA → READY_TO_MERGE 或明确的人工态。当收到 aes-worktree-board Master 派发的 IssueWorkOrder，或需要在单个 worktree 内闭环消化一个 contract-complete 的 ready-for-agent Issue 时使用。本技能不 merge、不写 GitHub、不自行挑选 Issue。
---

# AES Issue Worker

Master（`aes-worktree-board`）派单，本技能在**一个 owner session 内**把这张单子跑完，
只向 Master 回一个 typed 终局报文。

本技能是**组合器**：实现方法论来自 `tdd` / `diagnosing-bugs` / `codebase-design`，
复审来自 `code-review`，QA 来自 `aes-qa`。这里只负责阶段编排、证据绑定与预算记账，
不复制任何方法论。

## 边界（越过即失败，不是可商量的风格问题）

- **永不 merge integration branch。** merge 只属于 Master host。
- **永不直接创建 GitHub Issue。** 发现的新问题走 `DISCOVERED_WORK` 回给 Master。
- **不清理用户现场。** 不 `reset --hard`、不 `clean`、不删 worktree。
- **不自行放宽 AC。** AC 自相矛盾时输出 `CONTRACT_CONFLICT`，等用户裁决。
- **不代答人工验收。** 需要人验的事输出 `AWAITING_HUMAN`，附完整 `humanRequest`。

## 输入：IssueWorkOrder

`aes.issue-worker.work-order/v1`。关键字段：`jobId`（跨 attempt 稳定）、`attemptId`
（本次尝试唯一）、`issue.contractDigest`、`issue.acceptanceCriteria`、
`issue.allowedSideEffects`、`runner.worktreePath`、`runner.baseCommit`、
`routing.modelTier`（只有 `economy`/`standard`/`frontier` 三个语义档）、`budgets`。

收到工单先做三件事，任一不成立就直接回 typed 失败，不要开工：

1. `runner.worktreePath` 是干净的、HEAD 等于 `runner.baseCommit`；
2. `issue.allowedSideEffects` 覆盖你接下来要做的每一类动作；
3. `issue.acceptanceCriteria` 非空且每条都有 `evidenceClass`。

## 阶段闭环

```
implement → commit(candidate) → review(只读 subagent) → [fix → 新 candidate → 重新 review]*
          → qa(aes-qa) → [fix]* → READY_TO_MERGE
```

每次产生新 candidate commit 后，**立刻**告知 Master：

```bash
node .agents/skills/aes-worktree-board/scripts/master.mjs candidate --job <jobId> --commit <sha>
```

这一步会使绑定旧 commit 的 review/QA 证据全部失效。这是不变量，不是优化：
证据必须绑定精确 commit，candidate 前进使旧证据作废。

### review 阶段

启动**只读** review subagent，绑定 `contractDigest` + `baseCommit` + `candidateCommit`，
返回 `aes.issue-worker.stage-result/v1`，两个轴分别给结论：

- Standards：是否符合本仓既有写法与文档化约定；
- Spec：是否满足 Issue Contract 的每一条 AC。

review 返回 `MUST_FIX` 时，**在本 session 内修**：改代码、提交新 commit、重新 review。
普通 finding 不通知用户，也不通知 Master —— 这正是历史上「三次机械 BLOCK 就转人工」
要消除的噪声。

### 失败必须分类

`stage-result` 的失败一律带 `failureClass`：

| failureClass | 含义 | 烧哪本预算 |
| --- | --- | --- |
| `must-fix` | 真实缺陷，需要改实现 | `reviewLoops` / `qaLoops` |
| `retryable` | 偶发抖动，原样重试即可 | 不烧 |
| `environment` | 环境污染、超时、依赖缺失 | `environmentRetries` |

分错类的代价是具体的：把环境问题记成 `must-fix`，两次编码错误就吃掉了修实现的机会。
闭集之外的取值会被 Master 拒收（`UNCLASSIFIED_STAGE_FAILURE`）。

查预算：

```bash
node .agents/skills/aes-worktree-board/scripts/master.mjs stage review --job <jobId> --payload-file <file>
```

## 输出：一个 typed 终局

`aes.issue-worker.goal-terminal/v1`，`outcome` 取自闭集：

| outcome | 什么时候 | 必带 |
| --- | --- | --- |
| `READY_TO_MERGE` | 全部 AC、review、所需 QA 通过 | `contractDigest` / `baseCommit` / `candidateCommit` / `acceptance[]` |
| `BUDGET_EXHAUSTED` | 某本预算耗尽 | `budget{kind,limit,used}` / `remainingBlockers` / `recommendedMasterActions` |
| `BLOCKED_DEPENDENCY` | 需要另一个 Issue 先落地 | 已回流的 `DISCOVERED_WORK` |
| `CONTRACT_CONFLICT` | AC 自相矛盾或需要改目标 | `humanRequest` |
| `AWAITING_HUMAN` | 需要人工验收或决策 | `humanRequest` |
| `BLOCKED_PERMISSION` | 缺权限或外部访问 | `humanRequest` |

`READY_TO_MERGE` **不等于已合并**。Master 会 fresh 重验 slot / commit / integration /
AC / review / QA，再按 `riskProfile` 分档决定是否合并。

三个人工态终点必须带完整 `humanRequest{kind, prompt, requiredEvidence, resumeToken}`。
缺 `resumeToken` 的报文会被 schema 拒收且状态不推进 —— 这是恢复能力的锚点，
不是可省的礼节。

## 发现了范围外的问题

输出 `aes.issue-worker.discovered-work/v1`，四类关系二选一地填 `relationship`：

- `IN_CURRENT_SCOPE` — 属于当前 AC，自己顺手修，当前 job 继续；
- `NON_BLOCKING` — 独立问题，Master 建新 Issue，当前 job 继续；
- `BLOCKING_DEPENDENCY` — 当前 AC 依赖它，Master 建 blocking edge，当前 job 停；
- `CONTRACT_CONFLICT` — 目标本身有矛盾，升级给用户。

`dedupeHints` 必须非空：Master 靠它做幂等去重，同一个问题重复上报不会重复建 Issue。

## 中断恢复

owner thread 断了，**优先恢复原 thread**。确认不可恢复后，Master 会凭 handoff bundle
新建 attempt：`jobId` 不变，`attemptId` 换新，旧 attempt 与其证据全部保留。
新 attempt 继承 live worktree 上的 candidate commit，但**不继承证据** —— 证据要重新绑定。
