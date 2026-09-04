---
name: aes-issue-worker
description: 在一个 owner session 内把一张 typed IssueWorkOrder 跑成 typed 终局：tdd/diagnosing-bugs 实现 ⇄ aes-qa 循环轮验证，simplify 后单次 candidate commit，aes-qa 最终轮出绑定 SHA 的 QaReceipt，READY_TO_MERGE terminal 进 registry；code-review 与 merge 归 aes-merge-worker。当收到 aes-worktree-board 总管派发的 IssueWorkOrder，或需要在单个 worktree 内闭环消化一个 contract-complete 的 ready-for-agent Issue 时使用。本技能不 merge、不写 GitHub、不自行挑选 Issue。
---

# AES Issue Worker

总管（`aes-worktree-board`）派单，本技能在**一个 owner session 内**把这张单子跑完，
只向 registry 回 typed 报文。三条 worker lane——本技能（干活）、`aes-merge-worker`
（合并验收，待建）、人参与 lane——全部平级挂总管之下，**lane 之间零直连**：
一切交接经 registry（typed terminal / merge queue / 打回路由）。

本技能是**组合器**：实现方法论来自 `tdd` / `diagnosing-bugs` / `codebase-design`，
验证来自 `aes-qa`（闭环内唯一验证角色），清理来自 `simplify`。`code-review` 不由
本技能派生——它归 aes-merge-worker，理由见「READY 之后」一节。这里只负责阶段编排、
证据绑定与预算记账，不复制任何方法论。

## 边界（越过即失败，不是可商量的风格问题）

- **永不 merge integration branch。** merge 权独属 aes-merge-worker（经总管
  mergeQueue；worker 与合并方零直连）。
- **永不直接创建 GitHub Issue。** 发现的新问题走 `DISCOVERED_WORK` 回给总管。
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
tdd / diagnosing-bugs（按 workflowRole 路由）⇄ aes-qa 循环轮（直到 PASS）
→ simplify（条件触发）
→ 单次 candidate commit
→ aes-qa 最终轮（typed QaReceipt 绑 commit SHA）
→ READY_TO_MERGE terminal 进 registry
```

### aes-qa 循环轮

实现每轮产出后，以 **fresh-context 只读 subagent** 调用 aes-qa 跑自动档：AC 逐条
核对 + 测试执行。输入**只有 AC + worktree 路径 + 命令**，不带实现者的叙述——
独立性来自上下文隔离，评估者不能被「我觉得这样写没问题」的思路污染。

循环轮**只出 finding，不出 receipt、不进 registry**。FAIL 带 finding 回实现，
循环直到 PASS。这是「不信自报」哲学下沉到内循环：实现者自跑测试会合理化失败，
独立评估不会。

### simplify（条件触发）

循环轮 PASS 后，`workflowRole=implement` 且本轮有实质代码改动才跑 simplify
（3 并行 review subagent + 窄范围修复），改动直接留在工作树。diagnose / research /
design 单、纯文档或注释改动、零改动时跳过——这一步的 token 花在有清理空间的单上。

### 单次 candidate commit

simplify 收尾后产生**happy path 全程唯一**的 candidate commit，并立刻登记：

```bash
node .agents/skills/aes-worktree-board/scripts/master.mjs candidate --job <jobId> --commit <sha>
```

candidate 前进使旧 review/QA 证据作废是控制面不变量；单次 commit 让这条失效语义
在 happy path 上零触发——不在循环中反复 commit，就不反复作废证据。

### aes-qa 最终轮

commit 登记后调用 aes-qa 最终轮：重跑自动档（顺带覆盖 simplify 的改动）+ 按影响面
补 live/manual 档，**绑定 commit SHA** 产出 typed QaReceipt 并上报：

```bash
node .agents/skills/aes-worktree-board/scripts/master.mjs stage qa --job <jobId> --payload-file <qa-receipt.json>
```

最终轮与循环轮是**同一验证角色的两种调用**，唯一区别是输出格式与 SHA 绑定。
FAIL 回实现（烧 `qaLoops`），修完重走循环轮收敛再回到这里。

#### 实际截图分支

若本 attempt 实际执行 screenshot check，或 screenshot 被规格、verdict / Finding 引用，先读
[aes-qa GitLab 截图证据协议](../aes-qa/references/screenshot-evidence.md) 并在 owner session 内闭环：

1. capture executor 只落 stable local spool，GitLab HTTP=0；
2. 完整 attempt 得到 PASS/FAIL/BLOCKED terminal 后冻结一个 claim-complete batch；
3. 登记 final candidate 后用新 `{qaRoundId,attemptId}` 在该 candidate 运行态重跑最终截图，
   一次 publish 并严格回读到 VERIFIED；dirty/nonFinal 图片不能顶替；
4. QaReceipt 顶层写 `screenshotEvidence:{required:true,aggregateMarker}`。marker 未 VERIFIED、
   candidate 不一致或 claim 不完整时，不得发 READY terminal。

没有实际截图与引用时不调用 publisher、不写空 GitLab note；新 receipt 写
`screenshotEvidence.required=false`，旧无截图 v1 保持兼容。此分支只覆盖 AES QA 的内部
GitLab screenshot evidence，不扩成通用 artifact 发布。

### READY 之后：交付即结束

QaReceipt PASS（以及实际截图分支的 VERIFIED 子门）后发 `READY_TO_MERGE` terminal
（≈提一份本地 PR）——它写进
registry 的 mergeQueue，**worker 的工作到此结束**，不与任何合并方直连。

之后由 aes-merge-worker 从 queue 领取：派独立 `code-review` subagent
（Standards+Spec 双轴，深度按 effectiveRisk 分档）→ 机械门六项 → 串行 merge →
merge 后全量回归 → 幂等 close。review receipt 由 merge-worker 侧上报——**被审者
无法自报 review PASS**，这正是 review 移出本技能的理由（验收方雇佣审查者）。

## 打回处理

aes-merge-worker 的 review 给出 MUST_FIX 时，打回以
`aes.issue-worker.review-return/v1` 经总管路由回原 owner session（原 thread 消息
优先；session 不可恢复则新 attempt 携带 finding 兜底）。报文关键字段：
`jobId` / `attemptId` / `commitSha`（必须等于被审 candidate）、`findings[]`
（`axis` 闭集 `standards|spec`，`severity` 为 `must-fix`）、`budget.reviewLoops`。

收到打回后：修复 → **必须重走 aes-qa 回归**（循环轮收敛 + 最终轮绑新 commit 出
新 receipt）→ 重新 READY。旧 receipt 因新 commit 已被 `STALE_EVIDENCE` 语义作废，
不存在拿旧绿顶新码的合法路径；打回后的修复若不经回归，就是全流程唯一一段未经
验证的代码路径。同一打回单据以新 commit 闭合，不重复消费。

`reviewLoops` 由 aes-merge-worker 记账（每次打回递增），worker 不自报 review 轴
预算。普通 finding（非 must-fix）由 merge-worker 侧自行记录，不打回、不烦扰 worker。

## 失败必须分类

`aes-qa` 报文的失败一律带 `failureClass`：

| failureClass | 含义 | 烧哪本预算 |
| --- | --- | --- |
| `must-fix` | 真实缺陷，需要改实现 | `qaLoops`（review 轴的 `reviewLoops` 由 aes-merge-worker 打回时记账） |
| `retryable` | 偶发抖动，原样重试即可 | 不烧 |
| `environment` | 环境污染、超时、依赖缺失 | `environmentRetries` |

分错类的代价是具体的：把环境问题记成 `must-fix`，两次编码错误就吃掉了修实现的机会。
闭集之外的取值会被 registry 拒收（`UNCLASSIFIED_STAGE_FAILURE`）。

预算没有独立的查询命令，也不要为看余额去跑 `stage`——那是写操作，会多烧一轮
预算。每次 `stage` 登记的响应会回带 `budgetUsage`，以此对账；只读总览
（job 状态 / mergeQueue / 人工态数量）用：

```bash
node .agents/skills/aes-worktree-board/scripts/master.mjs status
```

## 输出：一个 typed 终局

`aes.issue-worker.goal-terminal/v1`，`outcome` 取自闭集：

| outcome | 什么时候 | 必带 |
| --- | --- | --- |
| `READY_TO_MERGE` | 全部 AC、循环轮、最终轮通过 | `contractDigest` / `baseCommit` / `candidateCommit` / `acceptance[]` / `contractExternal[]`（无契约外行为时为空数组） |
| `BUDGET_EXHAUSTED` | 某本预算耗尽 | `budget{kind,limit,used}` / `remainingBlockers` / `recommendedMasterActions` |
| `BLOCKED_DEPENDENCY` | 需要另一个 Issue 先落地 | 已回流的 `DISCOVERED_WORK` |
| `CONTRACT_CONFLICT` | AC 自相矛盾或需要改目标 | `humanRequest` |
| `AWAITING_HUMAN` | 需要人工验收或决策 | `humanRequest` |
| `BLOCKED_PERMISSION` | 缺权限或外部访问 | `humanRequest` |

`READY_TO_MERGE` **不等于已合并**。aes-merge-worker 会 fresh 重验 slot / commit /
integration / AC / review / QA，再按 effectiveRisk 分档决定是否合并。

### 契约外行为清单（规则 A，2026-09-04 owner 裁决）

实现超出契约文本的行为（同一不变量在契约未点名的实例上完备化）不算越线、不占
提问轮，但**披露是硬要求**：READY 回执与票面终局里必须单列「契约外行为清单」，
每条写清三点——做了什么行为、挂在哪条 AC/强约束的不变量下、由哪个测试锁定。
未列出的契约外行为被 merge review 的 Spec 轴（以契约为尺子逐项 diff）抓到时，
按 spec finding 处理：must-fix 打回，或 owner 裁决后补进契约归档。先例：
#104（INTERNAL_ERROR+operation 扩到 open/recover/status/heartbeat 路径）、
#158（队列报文 createdAt 对齐 AES admission 语义），归档见两票 contract.md 的
「实现扩面与 merge 裁决记录」节。

三个人工态终点必须带完整 `humanRequest{kind, prompt, requiredEvidence, resumeToken}`。
缺 `resumeToken` 的报文会被 schema 拒收且状态不推进——这是恢复能力的锚点，
不是可省的礼节。

## 人参与 lane（for-human 模式）

`executionPolicy=for-human` 的 Issue 走**同一条骨架**，人是另一种 executor：

- 干活步由人操作，agent 备料（复现步骤、上下文、diff 预览）并记录证据；
- aes-qa 自动档照跑可自动的部分，人工部分由 `humanChecklist` 承载——aes-qa 的
  `humanChecklist` / `candidateFrozen` / `writerLease` 字段在此 lane 获得消费方；
- 等待人是无上界的：以 `humanRequest{resumeToken}` typed 暂停并释放 writer lease，
  `actor:"human"` 的答复凭 resumeToken 恢复，agent 不得代答；
- simplify / commit / 最终轮 / READY 与 agent lane 完全相同。

该 lane 的实现不在当前交付范围：此处只锁定角色位与协议复用（round 9 裁定，
不建独立技能——独立技能的骨架 prose 复制会漂移）。

## 发现了范围外的问题

输出 `aes.issue-worker.discovered-work/v1`，四类关系二选一地填 `relationship`：

- `IN_CURRENT_SCOPE` — 属于当前 AC，自己顺手修，当前 job 继续；
- `NON_BLOCKING` — 独立问题，总管建新 Issue，当前 job 继续；
- `BLOCKING_DEPENDENCY` — 当前 AC 依赖它，总管建 blocking edge，当前 job 停；
- `CONTRACT_CONFLICT` — 目标本身有矛盾，升级给用户。

`dedupeHints` 必须非空：总管靠它做幂等去重，同一个问题重复上报不会重复建 Issue。

## 中断恢复

owner thread 断了，**优先恢复原 thread**。确认不可恢复后，总管会凭 handoff bundle
新建 attempt：`jobId` 不变，`attemptId` 换新，旧 attempt 与其证据全部保留。
新 attempt 继承 live worktree 上的 candidate commit，但**不继承证据**——证据要重新绑定。
