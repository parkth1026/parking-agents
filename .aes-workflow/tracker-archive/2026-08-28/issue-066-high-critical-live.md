# Issue #66 — aes-worktree-board: high/critical 分档未经真实宿主验证
labels: needs-triage, wayfinder:task  |  state: OPEN  |  blocked_by: #70(closed), #94(open)  |  抢救时间: 2026-08-28
（W2 目标票。以下正文完整；评论 3 尾部在会话读取时被截断，已标注。）

## 问题

契约 AC-005 与强约束定义了四档 merge gate：low/medium 机械门全绿即自动 merge；high 机械门全绿**仍**停在 humanGate；critical 拒绝直接 merge，只走 PR。

离线 `delivery-merge` scenario 覆盖了全部四档，包括路径兜底升档（`ESC-identity` / `ESC-secrets` / `ESC-schema` 等七条规则）与 waiver 拒绝逻辑。

**但 AC-007 真实宿主门一档都没触发到 high 以上。**

## 实际数据

本轮 live 门的三个 Issue：#51 自报 low / 未命中 / low / AUTO_MERGE；#52 medium / 未命中 / medium / AUTO_MERGE；#53 low / 未命中 / low / AUTO_MERGE。`humanRequests: 0` —— 全程没有任何人工态终点被触发。

## 为什么这是证据链上的缺口

`high` 档那条「机械门全绿仍必须停下」是四档设计里**唯一反直觉**的一条，也是外部评审 5.4 论证、用户在 ACQ-008 明确选 A 才进契约的。它在离线门里成立，但从没在真实宿主上、面对真实 Issue、真实 slot、真实 merge 的情况下被执行过一次。

同理 `critical` 的 PR-only：产品目前只会**拒绝直接 merge**，但「走 PR」这条路径本身在真实环境下从未跑通过 —— 甚至没有创建 PR 的代码。

## 建议的补法

挑一个**真的触及 identity/权限/schema** 的 Issue 跑一轮 live：自报 `low`，让 `ESC-identity` 或 `ESC-schema` 把它升到 `high`；验证机械门全绿后确实停在 humanGate，且 `humanRequest` 载荷完整可用；人工批准后能正确续跑到 merge+close。

`critical` 档需要先决定「走 PR」到底是什么意思（产品目前只有拒绝，没有创建 PR），可能是独立一条。

## 关联

- 本条与 aes-worktree-board#65（reviewer 独立性缺乏机械判据）同属「离线门证明了、真实宿主没验过」这一类

## 2026-08-28 范围扩充（#83 v7 之后）

- effectiveRisk 分档新增第二个消费方：**review 深度分档**（`depthTier`，由 aes-merge-worker 派生 code-review subagent 时采用，behavior.md 变化行 6）。live 验证范围从「merge gate 四档」扩为「merge gate 四档 + review depthTier 分档」。
- 票面「人工批准后能正确续跑到 merge+close」的路径现归 aes-merge-worker 交付管线（#94）；#94 落地前，live 验证可按新 prose 由人工/hybrid 执行该管线段。

---

## 评论 1 — piaotonghu, 2026-08-26T16:10:23Z（要点摘录）

真实宿主上首次触发 `high` 档（部分兑现）。job `job-67-59a9c1`（真实 Issue #67，真实 slot worker-4），candidate `b63c1d7e49355e140aa6ab3bfe531b1bf42c5dea`，自报 `declaredRisk: medium` → `effectiveRisk: high`，`escalated: true`，命中 `ESC-public-api`（路径 `.agents/skills/aes-worktree-board/scripts/server.mjs`），结果 `mergePolicy: HUMAN_GATE` / `autoMergeAllowed: false`。

未兑现部分：同一次 gate 里 `GATE-qa` FAIL（outcome=PASS 但 unexecuted=4），流程停在 `BLOCKED_MECHANICAL` 而非 humanGate，所以「机械门全绿仍停下」本次没走到。

顺带确认 `GATE-qa` 的价值：receipt 的 `outcome` 写的是 `PASS`，机械门依然判 FAIL，理由是 `unexecuted=4`。**门禁不采信报文自己给的结论。** 如果它信 `outcome`，这个 job 已经合进 dev 了。

仍完全未验证：`critical` 档的「走 PR」——产品只有「拒绝直接 merge」，没有创建 PR 的代码。

## 评论 2 — piaotonghu, 2026-08-26T16:21:29Z（MW2 复盘钢人反思补充）

最小闭环设计：2 个 worker × 2~3 个高机械度 Issue，跑一次完整连续 Goal 循环（reconcile → fan-in → drain → next-actions）；**刻意选一个自评 critical 的 Issue**，让 high 档 humanGate 真实触发一次；同步采集 **token/Issue 成本**，momo 侧参照锚点 ≈ 35M token/函数（199.8B / 5588，含全部试错、审查与协作开销）。

同时测两个未测变量：① 真实宿主多 worktree 并行的合并冲突率/任务正交度（若实测 ≈0，「轻拓扑快车道」才值得重新评估）；② 行为失败 vs 门禁命中的发生比（momo 侧为 5 类行为失败 : 0 次门禁逃逸）。

## 评论 3 — piaotonghu（时间未记录）：high 档 humanGate 已完整兑现【尾部截断】

补掉造成 `unexecuted` 的覆盖缺口后（follow-up commit `fb39298`），同一 job 重走了一遍：

```
GATE-slot PASS / GATE-commit PASS (candidate==terminal==fb39298) / GATE-integration PASS (dev=dc2f675)
GATE-acceptance PASS 6/6 / GATE-review PASS / GATE-qa PASS unexecuted=0  → allGreen: true
decision: AWAITING_HUMAN_GATE   mayMerge: false
reason: "effectiveRisk=high：机械门全绿仍需人工批准"   escalated: true
```

humanRequest 载荷：`schemaVersion: aes.worktree-board.human-request/v1`、`kind: risk_approval`、`state: awaiting-human`、`resumeToken: hr-job-67…`【此处会话读取截断，后续内容未抢救到】

## 评论 4 — piaotonghu, 2026-08-28（本会话所发，评论 id 5442985440）

W2 路线确认登记：完整回路证明轮（merge gate 四档 + review depthTier）、刻意触发 high 档 humanGate、token/Issue 成本锚点自采；同属 W2 的 for-human lane 开票评估。前序现状：#98 未开工，#94 blocked by #98，路线入口在 #98。
