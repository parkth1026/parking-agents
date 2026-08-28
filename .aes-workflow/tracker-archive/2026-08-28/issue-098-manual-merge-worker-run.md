# Issue #98 — aes-worktree-board: 回路证明轮第一段——人工顶替 merge-worker 跑 1 Issue 端到端证伪协议
labels: ready-for-human, wayfinder:task  |  state: OPEN  |  assignee: piaotonghu  |  抢救时间: 2026-08-28

Part of #5

## Question

按 #70 裁定（混合三段串行）的第一段：在 #94（aes-merge-worker）落地**之前**，由人工顶替 merge-worker 角色，按 v7 prose 跑 1 个 Issue 的最小端到端管线（worker 循环轮 → simplify → commit → 最终轮 QaReceipt → READY_TO_MERGE 进 mergeQueue → 人工顶替消费 → review → gate → merge → 全量回归 → close），专门校验 **registry/mergeQueue 协议纸面与现实的偏差**。

### 产出

- 协议偏差清单：纸面（SKILL.md + references/design.md）与实跑不一致处，逐条记录（零偏差也要显式记「零」）；
- 该清单作为 #94 建设的实测证据输入——#94 带证据开工，不裸建。

### 边界

- 只跑 1 个 Issue，高机械度优先；不求覆盖并发态（那是第三段完整轮的事）；
- 人工顶替期间人也是 stall 检测器：任何 stall/wake 摩擦逐例记录（反哺 #35/#39，见 #70 resolution）。

### 血统

#70 resolution → 本票（证伪段）→ #94（落 merge-worker）→ #66（完整回路证明轮）。

（无评论）
