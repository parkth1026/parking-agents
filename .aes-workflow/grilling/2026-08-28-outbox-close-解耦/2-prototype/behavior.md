# 行为对照表: aes-merge-worker 落地（#126）

**确认版·锁定。** 执行 Agent 改的是产品，不是这份对照表。
用户确认：2026-08-28（P1–P4 四问见 rounds.jsonl；P2 采纳修改，其余保持 v1）

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| B1 | `close --job J`，verify PASS，GitHub 正常 | 先 `gh issue comment` + `gh issue close`，成功后才写 registry；返回 `outcome: CLOSED` | 先写 registry（`issueClose.outcome: LOCAL_CLOSED`）并释放 slot，再把 GitHub 动作**入队**；返回 `outcome: CLOSED` + `outbox: {entryId, state: "pending"}`。gh **不在此命令内调用** |
| B2 | `close --job J`，GitHub 故障（账号 suspended / 网络断） | 整条命令 fail closed：job 卡 `merged`、slot 不释放、无降级路径 | **不受影响**：registry 照常 close、slot 照常释放；出站条目留在 outbox 等 flush |
| B3 | `outbox flush`，队列有 1 条 pending，gh 正常 | 无此命令 | 逐条调 gh comment + close，成功记 `succeeded`，追加 `attempts[]` 一条；报文 `{flushed:1, failed:0, remaining:0}` |
| B4 | `outbox flush`，gh 报可重试错误（网络 / 5xx） | 无此命令 | 条目留 `pending`，`attempts[]` 追加一条含 `error.code` 与截断 stderr；报文 `{flushed:0, failed:1, remaining:1}`，**退出码 0**（积压不是失败） |
| B5 | `outbox flush`，目标 Issue 永久 404（本次 job-69 实况） | 无此命令 | 第 3 次尝试后转 `abandoned`，`abandonReason: "ISSUE_UNREACHABLE"`，条目**保留在 outbox 不删除**（补偿审计）；报文含 `abandoned:1` |
| B6 | `outbox acknowledge --entry E --reason R` | 无此命令 | 仅对 `abandoned` 条目生效：转 `acknowledged`，记 `acknowledgedBy` / `acknowledgedAt` / `reason`；条目**仍不删除**，但 `outbox status` 不再计入告警计数 |
| B7 | `outbox status`，队列含 1 条 abandoned（未签收）+ 1 条 acknowledged | 无此命令 | 告警行只念未签收那条：`0 pending / 0 failed / 1 abandoned(未签收)`；已签收条目折到「已签收」小节，仍逐条可见 |
| B8 | `outbox flush` 重复执行，条目已 `succeeded` | 无此命令 | 幂等跳过：同 `commentDigest` 不再调 gh；报文 `{flushed:0, skipped:1}` |
| B9 | `gate --job J`，outbox 有 pending 条目 | 只输出六门与 decision | 六门与 decision **不变**，额外输出 `outboxWarning: {pending:N, oldestAgeMs:M}`；**不影响 mayMerge** |
| B10 | `gate --job J`，outbox 为空或只剩 acknowledged | 同上 | `outboxWarning: null` |
| B11 | `resolveMergePolicy({declaredRisk:"low", changedPaths:[]})` | 返回 `{effectiveRisk:"low", mergePolicy:"AUTO_MERGE", …}` | 同结构，**新增** `depthTier: "light"` |
| B12 | `resolveMergePolicy` 命中 `ESC-public-api` 升到 high | 返回 `effectiveRisk:"high"`、`requiresHumanGate:true` | 同上，**新增** `depthTier: "deep"` |
| B13 | `merge --job J`，candidate 的 `baseCommit` 不是 candidate 的祖先 | 无此校验，直接进 merge | 血统校验拦下：`{ok:false, code:"LINEAGE_BROKEN", expectedBase, candidate}`，不落 mergeIntent |
| B14 | `merge --job J`，candidate 已是 integration 的祖先（重复 merge） | 依赖 reconcile 事后发现 | merge 时点即拦：`{ok:false, code:"ALREADY_MERGED", mergeBase}`，提示走 reconcile 认领 |
| B15 | `review-return --job J --payload <review-return/v1>` | 无此命令 | 校验 `commitSha` 等于当前 candidate、`verdict==="MUST_FIX"`、`findings[].axis` 属闭集；通过则 `reviewLoops += 1`、job 转 `review-returned`、findings 入 inbox 供 owner 消费 |
| B16 | `review-return`，`reviewLoops` 已达上限 3 | 无此命令 | 不递增，返回 `{ok:false, code:"REVIEW_BUDGET_EXHAUSTED", reviewLoops:3}`，job 转人工态由总管决策 |
| B17 | `review-return`，`commitSha` 不等于当前 candidate | 无此命令 | 拒收 `{ok:false, code:"CANDIDATE_MISMATCH"}`，**不推进状态、不记账**（与 terminal 同款守卫） |

### 边界值

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| E1 | `outbox flush`，队列为空 | 无此命令 | `{flushed:0, skipped:0, remaining:0}`，退出码 0，不报错 |
| E2 | `outbox flush` 并发两个进程 | 无此命令 | 走 registry 同款互斥锁；后到者要么等锁要么空跑，**同一条目不得被 flush 两次** |
| E3 | `close` 时 outbox 文件不存在 | — | 首次写自动创建，与 `inbox.jsonl` 同款 append-only 语义 |
| E4 | `close` 已 `LOCAL_CLOSED`，再次调用 | 幂等返回 `ALREADY_SUCCEEDED` | 保持幂等：**不重复入队**（同 `commentDigest` 已在 outbox 即跳过） |
| E5 | `review-return` 的 `findings` 为空数组 | — | 拒收 `{ok:false, code:"EMPTY_FINDINGS"}`——MUST_FIX 必须给出至少一条 finding |
| E6 | `outbox acknowledge` 指向 `pending` 或 `succeeded` 条目 | — | 拒收 `{ok:false, code:"NOT_ABANDONED", state:"pending"}`——签收只对已放弃的条目有意义 |
| E7 | `outbox acknowledge` 缺 `--reason` | — | 拒收 `{ok:false, code:"REASON_REQUIRED"}`——无理由的签收等于静默删除，是本设计要防的那件事 |
| E8 | `outbox acknowledge` 重复签收同一条目 | — | 幂等返回 `{ok:true, outcome:"ALREADY_ACKNOWLEDGED"}`，不追加第二条签收记录 |

## 不变清单

逐条列出必须保持原样的现有行为，写明谁在依赖它。

| # | 必须不变的行为 | 谁在依赖 |
| --- | --- | --- |
| K1 | 机械门**六项**及其固定顺序 slot → commit → integration → acceptance → review → QA，判据一字不改；`outboxWarning` 不参与 `mayMerge`（P4 裁定） | `selftest-v4.mjs:919` 的 ids 断言；#131 已在真实宿主验证的门禁语义 |
| K2 | `GATE-review` / `GATE-qa` 要求 receipt 的 `commitSha` 与 candidate **精确相等**；QA 含 `NOT_RUN` 或 `unexecuted` 非空一律 FAIL | #84 封闭的证据绑定旁路；`selftest-v4.mjs:1010-1011` |
| K3 | 四档 merge policy 的 `mergePolicy` / `autoMergeAllowed` / `requiresHumanGate` / `prOnly` 取值与语义 | #114 待验证的分档 live 面；既有 delivery-merge scenario |
| K4 | `deliveries[].issueClose` 字段可读性：`commentDigest` 与 `closedAt` 保留原名原义 | trajectory replay；既有 registry 数据 |
| K5 | `masterClose` 的 `options.gh` 注入点**继续存在且可注入**（改为被 outbox flush 消费），selftest 桩不需重写调用形状 | `selftest-v4.mjs:563/1000/1006/1127` |
| K6 | `close` 幂等语义：同 `commentDigest` 重复调用不产生第二次副作用 | `selftest-v4.mjs:1006`「幂等 close 不得再次调用 gh」 |
| K7 | merge 串行不变量（`MERGE_NOT_SERIAL`）与 mergeIntent 先落盘、reconcile 用 `git merge-base --is-ancestor` 问 Git | 目标 A 收口判据「registry 记意图、Git 记事实」 |
| K8 | `stage review` / `stage qa` 的 v1/v2 双版本并存与 `baseCommit`、`reviewerSessionId` 强制校验 | 恢复回来的 #62/#65 交付；历史夹具零改动 |
| K9 | worker **永不 merge**；merge 权独属 merge-worker lane | v7 hub-and-spoke 不变量 |
| K10 | `work-order/v1` schema 零字节改动 | #83 定稿；worker lane 消费方 |
| K11 | 出站条目**永不物理删除**——`abandoned` 与 `acknowledged` 都留在 `outbox.jsonl` 里 | 补偿审计（P2 裁定：签收改的是告警噪音，不是留档本身） |

## 配置差异

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| `AES_WORKTREE_BOARD_REPO_ROOT` | 已存在（`job-store.mjs` 取 env 否则 cwd），但**无文档** | 行为不变，**双向边界写进 prose**：worker 侧必须显式设置（否则在 worker worktree 静默孵化平行 registry）；selftest 调用**不得**继承（否则破坏 fixture 场景） | 无需迁移，纯文档补齐（偏差 4） |
| outbox 落盘位置 | 不存在 | `<runtime-v4>/outbox.jsonl`，与 `inbox.jsonl` 同目录同 append-only 语义 | 首次自动创建；**不新增配置项** |
| `AES_WORKTREE_BOARD_GH_COMMAND` | 已存在，`defaultGh` 读取 | 语义不变，改由 flush 路径消费 | 无 |

旧的 `board.config.json` 与 runner slots 配置**原样可用**，本票不动其结构。

## 本票不做（外置，见 impact-surface）

- 基线红表达位（偏差 8）→ #125；prose 只写 workaround 指引。
- 分支 ref 层事后对账（偏差 7）→ #134，blocked by 本票。
- 陈旧现场机械自检（偏差 1/2）→ 不入本票；prose 写「lane 启动前置：现场自检」一节。
- MUST_FIX 打回全链路 live 轮 → 拆 live 票；本票 AC 只留 happy path 一轮。
