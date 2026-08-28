# Issue #94 — aes-worktree-board: aes-merge-worker 合并验收 lane 落地（queue 领取 → review → gate → merge → 全量回归 → close）
labels: needs-triage, wayfinder:task  |  state: OPEN  |  blocked_by: #98  |  抢救时间: 2026-08-28

Part of #5

## Question

落地 #83（v7 流程重梳，dev `1126794`）定稿的合并验收 lane `aes-merge-worker`：消化总管 mergeQueue——queue 领取 → 派 code-review subagent（深度按 effectiveRisk 分档）→ gate 六项 → 串行 merge → merge 后全量回归 → 幂等 close → release slot。

角色契约已写入真源（本票是执行侧落地，prose 不重议）：

- `.agents/skills/aes-worktree-board/SKILL.md` 与 `references/design.md`（§aes-merge-worker，2026-08-27 定稿）：验收方雇佣审查者——review receipt 由 merge-worker 侧 `stage review` 上报（堵「被审者雇佣审查者」provenance 洞，W-2 同款）；reviewLoops 记账权在 merge-worker。
- 打回协议 `aes.issue-worker.review-return/v1`：MUST_FIX 经总管路由至原 owner session（三对报文见 `.aes-workflow/grilling/2026-08-27-aes-issue-worker-流程重梳/2-prototype/api-mock.md`）；session 不可恢复则新 attempt 携带 finding；打回修复后 worker 必须重走 aes-qa 回归（循环轮收敛 + 最终轮绑新 commit）再重新 READY。
- 不变量：merge 权独属 aes-merge-worker（worker 永不 merge）；hub-and-spoke lane 零直连，一切交接经 registry。

## 待裁（#83 契约残留风险留位，实现时裁定）

- 载体形态：独立 session 占 host worktree vs 总管兼任——依宿主能力定，若与 prose 协议不匹配回 #83 契约修订。
- 打回通道实现载体：原 thread 消息优先、新 attempt 兜底（两者都支持，实测后收敛）。

## 范围

- 技能目录 `.agents/skills/aes-merge-worker/`（SKILL.md；如需脚本一律 `.mjs` 零依赖）。
- 执行管线：queue 领取、code-review 派生与分档（depthTier）、`stage review` 上报、gate 调用、串行 merge、merge 后全量回归（commands file 全量套件）、幂等 close、slot 释放、reviewLoops 记账、review-return/v1 打回路由与 `REVIEW_BUDGET_EXHAUSTED` 处置。
- 机械检查项（ancestry/冲突、无 unrelated changes、mergeCommit 写回 registry、刷新其他 worktree behind/ahead）与 #38 协调：机械落 `master.mjs`，编排归本 lane（#38 已按 v7 改写归属）。
- live 验证：至少一轮真实 mergeQueue 消化，含一次 MUST_FIX 打回 → worker 回归 → 重新 READY → 再次消费的全链路。

## 不做什么

- 不动人参与 lane（aes-issue-worker for-human 模式，另票）。
- 不改 `aes.issue-worker.work-order/v1` schema；机械门语义变更走 map #5 裁定。
- QA receipt provenance 的确定性检查归 aes-gate（map #47）。

## 关联

- #82（aes-issue-worker map）：打回协议的 worker 侧消费方。
- #66：high/critical 分档与 review depthTier 的 live 验证面（本票落地后由真实管线承载）。

---

## 评论 1 — piaotonghu, 2026-08-27T17:02:33Z

2026-08-28 收编登记（issue 全量梳理裁定）：#38 已按「机械项并入本票管线」关闭——其 2026-08-28 改写节即本票 gate 部分的检查清单；#77 问题二（gate 缺 commit 血统 / unrelated changes 校验）的实现落点同样收敛到本票（机械落 master.mjs，编排归本 lane）。merge 门禁血统检查单点落地，勿在 #77 内重复实现。map #5 的 Decisions so far 已登记。

## 评论 2 — piaotonghu, 2026-08-27T17:41:16Z

#70 裁定（2026-08-28）：本票 blocked by #98（人工顶替证伪段）——**带实测证据开工，不裸建**：#98 产出的 registry/mergeQueue 协议偏差清单是本票的设计输入。血统：#98 → 本票 → #66（完整回路证明轮）。
