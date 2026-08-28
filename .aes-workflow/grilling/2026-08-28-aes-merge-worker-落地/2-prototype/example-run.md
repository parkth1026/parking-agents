# 可执行示例: aes-merge-worker 落地（#126）

**确认版·锁定。** 执行 Agent 改的是产品，不是这份示例。
用户确认：2026-08-28（P1–P4 见 rounds.jsonl；P2 采纳 acknowledge 修改）

定「怎么调用、管道怎么接、退出码怎么用、人看到什么」。
**报文结构只在 `api-mock.md` 里定义一次**，本文件只写用法与观感，字段含义指回去。

约定：`$SKILL = .agents/skills/aes-worktree-board/scripts`，输出为写死示例。

---

## 场景 1：happy path — merge-worker 消化一条 mergeQueue（本票 AC 的 live 轮）

```bash
# 轮起点：先把上一轮的出站积压清掉（Q5 显式 flush，第 1 次）
node "$SKILL/master.mjs" outbox flush
```
```json
{"ok":true,"flushed":0,"skipped":0,"failed":0,"abandoned":0,"remaining":0,"entries":[]}
```

```bash
# 领取队首 job（队列读自 status 的 mergeQueue）
node "$SKILL/master.mjs" status
```
```json
{"ok":true,"mergeQueue":["job-83-a1b2c3"],"…":"…"}
```

```bash
# 派 code-review subagent 前，先问分档要多深
node "$SKILL/master.mjs" gate --job job-83-a1b2c3
```
```json
{"ok":true,"jobId":"job-83-a1b2c3",
 "policy":{"effectiveRisk":"low","mergePolicy":"AUTO_MERGE","depthTier":"light"},
 "mechanical":{"outcomes":{"GATE-slot":"PASS","GATE-commit":"PASS","GATE-integration":"PASS","GATE-acceptance":"PASS","GATE-review":"NOT_RUN","GATE-qa":"PASS"}},
 "decision":{"decision":"BLOCKED_MECHANICAL","mayMerge":false},"outboxWarning":null}
```
> `depthTier: light` → review subagent 走轻档。`GATE-review: NOT_RUN` 是预期的：
> review receipt 还没上报，这正是 merge-worker 接下来要做的事。

```bash
# 派独立 code-review subagent（Standards+Spec 双轴），拿到 PASS 后由 merge-worker 侧上报
node "$SKILL/master.mjs" stage review --job job-83-a1b2c3 --payload-file review-receipt.json
```
```json
{"ok":true,"stage":"review","jobId":"job-83-a1b2c3","consumed":true}
```

```bash
node "$SKILL/master.mjs" merge --job job-83-a1b2c3
```
```json
{"ok":true,"jobId":"job-83-a1b2c3","outcome":"MERGED","mergeCommit":"7c2e1a9…",
 "integrationBranch":"dev","lineage":{"baseIsAncestor":true,"alreadyMerged":false}}
```

```bash
node "$SKILL/master.mjs" verify --job job-83-a1b2c3 --commands-file full-suite.json
```
```json
{"ok":true,"outcome":"PASS","runs":[{"command":"node scripts/run-tests.mjs","outcome":"PASS"}]}
```

```bash
node "$SKILL/master.mjs" close --job job-83-a1b2c3
```
```json
{"ok":true,"outcome":"CLOSED","jobId":"job-83-a1b2c3","issue":83,
 "outbox":{"entryId":"ob-job-83-a1b2c3-7e11","state":"pending","enqueued":true}}
```
> **注意**：这一步没有联网。slot 已释放，job 已 `closed`。
> GitHub 上的评论与关票还没发生，它在队列里。

```bash
# 落盘时：第 2 次显式 flush
node "$SKILL/master.mjs" outbox flush
```
```json
{"ok":true,"flushed":1,"skipped":0,"failed":0,"abandoned":0,"remaining":0,
 "entries":[{"entryId":"ob-job-83-a1b2c3-7e11","issue":83,"outcome":"SUCCEEDED"}]}
```

**退出码**：全程 0。

---

## 场景 2：GitHub 不可用 — 交付照常落地（偏差 9 的正面兑现）

```bash
node "$SKILL/master.mjs" close --job job-83-a1b2c3
```
```json
{"ok":true,"outcome":"CLOSED","jobId":"job-83-a1b2c3","issue":83,
 "outbox":{"entryId":"ob-job-83-a1b2c3-7e11","state":"pending","enqueued":true}}
```
> 与场景 1 **逐字节相同** — close 不知道 GitHub 死没死，也不需要知道。

```bash
node "$SKILL/master.mjs" outbox flush
```
```json
{"ok":true,"flushed":0,"skipped":0,"failed":1,"abandoned":0,"remaining":1,
 "entries":[{"entryId":"ob-job-83-a1b2c3-7e11","issue":83,"outcome":"FAILED","attempt":1,
             "error":{"code":"GH_COMMAND_FAILED","stderr":"Sorry. Your account was suspended"}}]}
```
> **退出码 0**：积压不是失败（P3 裁定，不提供 `--fail-on-pending`）。
> job 已交付、slot 已释放、lane 可以领下一张。

```bash
# 下一轮起点自动重试
node "$SKILL/master.mjs" outbox flush
```
```json
{"ok":true,"flushed":1,"skipped":0,"failed":0,"abandoned":0,"remaining":0,
 "entries":[{"entryId":"ob-job-83-a1b2c3-7e11","issue":83,"outcome":"SUCCEEDED"}]}
```

对比**改前**同一情形：

```
{"ok":false,"code":"GH_COMMAND_FAILED","message":"gh issue comment 失败",
 "stderr":"Sorry. Your account was suspended"}
→ 退出码 1，job 卡 merged，slot worker-1 永久 leased，lane 停摆
```

---

## 场景 3：解开 `job-69-111801` — 目标 Issue 永久 404，并人工签收

真实积压现场：原 #69 因作者账号 suspended 永久不可达，`close` 被硬阻断至今。

```bash
node "$SKILL/master.mjs" close --job job-69-111801
```
```json
{"ok":true,"outcome":"CLOSED","jobId":"job-69-111801","issue":69,
 "outbox":{"entryId":"ob-job-69-111801-9f3a2c","state":"pending","enqueued":true}}
```
> **卡死解除**：job 从 `merged` 转 `closed`，slot `worker-1` 释放。

```bash
node "$SKILL/master.mjs" outbox flush   # 第 1、2、3 次
```
```json
{"ok":true,"flushed":0,"failed":0,"abandoned":1,"remaining":0,
 "entries":[{"entryId":"ob-job-69-111801-9f3a2c","issue":69,"outcome":"ABANDONED",
             "abandonReason":"ISSUE_UNREACHABLE","attempts":3}]}
```

```bash
node "$SKILL/master.mjs" outbox status
```
```
outbox: 0 pending / 0 failed / 1 abandoned(未签收)
  ! ob-job-69-111801-9f3a2c  issue #69  ABANDONED(ISSUE_UNREACHABLE)  3 attempts  settled 2026-08-28T11:26:10Z
      交付已落地（merge 9004b5f），GitHub 侧关票动作永久无法送达
```

```bash
# 人工签收：必须带理由，否则 REASON_REQUIRED
node "$SKILL/master.mjs" outbox acknowledge \
  --entry ob-job-69-111801-9f3a2c \
  --reason "原 #69 随账号封禁永久 404；交付已落 dev 9004b5f，重建票 #130 已单独关闭"
```
```json
{"ok":true,"outcome":"ACKNOWLEDGED","entryId":"ob-job-69-111801-9f3a2c","issue":69,
 "acknowledgedBy":"parkth1026","acknowledgedAt":"2026-08-28T12:04:19.117Z"}
```

```bash
node "$SKILL/master.mjs" outbox status
```
```
outbox: 0 pending / 0 failed / 0 abandoned(未签收)
已签收（留档，不再告警）：
  ob-job-69-111801-9f3a2c  issue #69  ACKNOWLEDGED by parkth1026 @2026-08-28T12:04:19Z
      原 #69 随账号封禁永久 404；交付已落 dev 9004b5f，重建票 #130 已单独关闭
```
> 条目**没有被删除**，只是不再计入告警计数（P2 裁定）。
> 补偿审计仍在：谁签的、什么时候、为什么，逐字留在 `outbox.jsonl` 里。

---

## 场景 4：MUST_FIX 打回（本票只做机械路由，全链路 live 拆 live 票）

```bash
node "$SKILL/master.mjs" review-return --job job-83-a1b2c3 --payload-file review-return.json
```
```json
{"ok":true,"jobId":"job-83-a1b2c3","state":"review-returned","reviewLoops":2,
 "routedTo":{"kind":"inbox","eventId":"ev-7f2a"}}
```

预算耗尽时：
```json
{"ok":false,"code":"REVIEW_BUDGET_EXHAUSTED","reviewLoops":3,"limit":3,
 "humanRequest":{"kind":"budget_decision","resumeToken":"hr-job-83-…"}}
```
> 退出码 1。总管据此决策 `NEW_ATTEMPT_FRONTIER_MODEL` 或 `AWAITING_HUMAN`。

---

## 场景 5【不变用法】：这条现在能跑，改完之后必须逐字节一样能跑

```bash
node "$SKILL/run-tests.mjs"
```
```
domains: 10/10 PASS
  contract  registry  inbox  orchestration  merge-policy  repo-root  fixture  server  board-ui  trajectory
```

```bash
node "$SKILL/master.mjs" gate --job job-67-59a9c1
```
```
六门顺序与判据一字不改：slot → commit → integration → acceptance → review → QA
high 档机械门全绿仍 AWAITING_HUMAN_GATE，mayMerge:false
```
> 唯一差异：结果里多了 `depthTier` 与 `outboxWarning` 两个**新增字段**，
> 既有字段与判定**逐字节不变**（对应 `behavior.md` K1/K2/K3）。

---

## 场景 6【环境边界】：REPO_ROOT 的两个方向（偏差 4）

```bash
# 正向：worker 侧必须显式设置，否则在 worker worktree 静默孵化平行 registry
AES_WORKTREE_BOARD_REPO_ROOT=G:/GIT/AI_WorkFlow/parking-agents \
  node "$SKILL/master.mjs" stage qa --job job-83-a1b2c3 --payload-file qa.json
```

```bash
# 反向：selftest 不得继承该 env，否则 fixture 场景被真实仓污染
env -u AES_WORKTREE_BOARD_REPO_ROOT node "$SKILL/run-tests.mjs"
```
> 两个方向都要写进 SKILL.md，这是偏差 4 的全部内容——本票只做文档，
> 机械防呆留 #128。
