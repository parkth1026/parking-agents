# Worker 工单与回报协议

本页保留接单、candidate、回执、预算与恢复的机器协议。具体实现与验证取舍见技能正文；原有任务的已确认要求不因正文精简失效。

## 输入：IssueWorkOrder

`aes.issue-worker.work-order/v1`。关键字段：`jobId`（跨 attempt 稳定）、`attemptId`
（本次尝试唯一）、`issue.contractDigest`、`issue.goal`、`issue.acceptanceCriteria`、
`issue.allowedSideEffects`、`runner.worktreePath`、`runner.baseCommit`、
`routing.modelTier`（只有 `economy`/`standard`/`frontier` 三个语义档）、`budgets`。

收到工单先做三件事，任一不成立就直接回 typed 失败，不要开工：

1. `runner.worktreePath` 是干净的、HEAD 等于 `runner.baseCommit`；
2. `issue.allowedSideEffects` 覆盖你接下来要做的每一类动作；
3. `issue.acceptanceCriteria` 非空且每条都有 `evidenceClass`。

新工单携带已绑定摘要的 goal，已有 Issue 正文通过可选 `issue.sourceBody` 原样携带。
新工单摘要同时绑定该正文快照，避免范围或强约束变化却沿用旧证据；这不表示正文中
每句建议都升级为已确认要求。旧已存工单、job 和回执不自动迁移或重算；
重新生成工单时按新的契约摘要处理，不把它当作旧工单的无差别续跑。
同一 Issue 仍有活跃旧 job 时，claim 不新建第二个 owner；沿原 job 恢复，
契约修订与重派走既有生命周期。
理解背景、范围和必要期望例子时读取该正文、已有契约或工单来源，
不靠标题或 AC 清单猜测；旧工单缺 goal 字段时回查权威来源，不重写旧工单或追加白名单。

### 单次 candidate commit

实现与必要清理完成后产生**happy path 全程唯一**的 candidate commit，并立刻登记。
以下 `master.mjs` 命令沿用控制面环境边界：显式设置 `AES_WORKTREE_BOARD_REPO_ROOT` 为目标仓根，避免在 worker worktree 中创建平行 registry；运行测试时不继承该变量。

```bash
node .agents/skills/aes-worktree-board/scripts/master.mjs candidate --job <jobId> --commit <sha>
```

candidate 前进使旧 review/QA 证据作废是控制面不变量；单次 commit 让这条失效语义
在 happy path 上零触发——不在循环中反复 commit，就不反复作废证据。

### aes-qa 最终轮

commit 登记后调用 aes-qa 最终轮：重跑应由当前 candidate 支持的自动验证（覆盖必要清理
的改动），按目标与实际影响补充必要证据，**绑定 commit SHA** 产出 typed QaReceipt 并上报：

```bash
node .agents/skills/aes-worktree-board/scripts/master.mjs stage qa --job <jobId> --payload-file <qa-receipt.json>
```

最终轮与循环轮是**同一验证角色的两种调用**，唯一区别是输出格式与 SHA 绑定。
FAIL 回实现（烧 `qaLoops`），修完重走循环轮收敛再回到这里。

实际执行截图或引用截图参与判定时，按 [QA 截图证据协议](../../aes-qa/references/screenshot-evidence.md) 处理；没有截图不发布空 note。

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
- 必要清理 / commit / 最终轮 / READY 与 agent lane 完全相同。

该 lane 的实现不在当前交付范围：此处只锁定角色位与协议复用（round 9 裁定，
不建独立技能——独立技能的骨架 prose 复制会漂移）。

## 发现了范围外的问题

输出 `aes.issue-worker.discovered-work/v1`，四类关系二选一地填 `relationship`：

- `IN_CURRENT_SCOPE` — 属于已确认目标、范围、约束或 AC，且无需新增用户承诺，当前 job 继续；
- `NON_BLOCKING` — 独立问题，总管建新 Issue，当前 job 继续；
- `BLOCKING_DEPENDENCY` — 当前已确认交付依赖它，总管建 blocking edge，当前 job 停；
- `CONTRACT_CONFLICT` — 目标本身有矛盾，升级给用户。

`dedupeHints` 必须非空：总管靠它做幂等去重，同一个问题重复上报不会重复建 Issue。

## 中断恢复

owner thread 断了，**优先恢复原 thread**。确认不可恢复后，总管会凭 handoff bundle
新建 attempt：`jobId` 不变，`attemptId` 换新，旧 attempt 与其证据全部保留。
新 attempt 继承 live worktree 上的 candidate commit，但**不继承证据**——证据要重新绑定。
