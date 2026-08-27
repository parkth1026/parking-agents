# Context Snapshot: 2026-08-28-issue70-loop-first-ruling

- 创建：2026-08-28T00:00:00+08:00
- 分片来源：无，宿主直接调查（gh CLI 实查 issue 状态）

## 任务陈述
#70 裁定（需要你参与的 grilling）：是否采纳「先证明回路，再加装甲」的投入排序改写

## 用户提出的方案
未提出（#70 票面本身给出五条「若采纳」的裁定内容，为 2026-08-26 建票时的候选方案）

## 意图假设
任务陈述是「裁定 #70」，但真正要解决的问题是：**aes-worktree-board 下一轮的投入往哪投**——
是继续预建防御性硬化，还是先在真实宿主把完整交付回路跑通拿到命中证据。#70 只是这个
方向性决策的载体票。裁定同时决定 #66/#94/#35/#39/#37 一串票的排序与提级。

## 已查事实
| 事实 | 出处 | 分类 |
| --- | --- | --- |
| #70 票面五条裁定内容中第 3 条（#65 reviewer 独立性）已被交付吸收：stage-result v2 强制 reviewerSessionId + reviewerIndependence 机械推导 | #70 2026-08-28 状态更新；#65 CLOSED | Fact |
| 第 5 条「硬化票后置」清单（#38/#62/#64）已清空：#62/#64 交付关票，#38 关票并入 #94 | gh 实查：#38 CLOSED；map #5 Decisions 2026-08-28 条 | Fact |
| v7 拓扑（#83，CLOSED）后回路多一段：merge-worker lane（#94，OPEN，未建），worker READY 进 mergeQueue 后无消费方，回路断在合并验收 | #70 2026-08-28 状态更新；gh 实查 #94 OPEN | Fact |
| #66（真实宿主验证 high/critical 分档）仍 OPEN needs-triage | gh 实查 | Fact |
| #35（stall 协议）仍 OPEN backlog，phase 枚举须按 v7 闭环词汇重写才可做 | gh 实查；map #5 Not yet specified | Fact |
| #39（listener automation）仍 OPEN backlog | gh 实查 | Fact |
| #37（模型路由）仍 OPEN backlog，模型档位前提须按宿主现状重确认 | gh 实查；map #5 Not yet specified | Fact |
| 支持改序证据：momo5502 MW2 复盘（4 agent 薄控制面周级连跑 ~7000 commits）；本仓 high/critical merge gate 真实宿主一档未触发；AC-007 三次复审 same-session 零 finding | #70 票面证据节 | Fact |
| 反对减重证据：本仓契约改动连锁（SKILL.md ↔ design.md ↔ 回归断言 ↔ 发布树）；实录事故：并发会话 dev 上 rebase/reset --hard 抹掉未提交现场 | #70 票面钢人两面 | Fact |
| momo 成本锚点参照 ≈35M token/函数（含全部试错与审查开销） | #70 票面 | Fact |
| 是否采纳、采纳后回路证明轮形状、行为防御处置 | — | User decision |
| resolution 落盘措辞、票面刷新的具体编辑 | — | Agent-owned |

## 验证基建候选池
本裁定为方向性决策票，非代码改动。验收途径（#70 票面验收节既有）：
- resolution comment 给出采纳/不采纳/修改后采纳 + 理由 — 代价：无
- 同步改写地图子图排序与受影响票 label/priority — 代价：逐票编辑，约 4-6 张
- 若采纳，本票成为下一轮（真实闭环轮）的入口票 — 代价：#66/#94 票面需按裁定刷新

## 四分类
- **Fact**：上表 10 条已查事实
- **User decision**：Q1 根裁定（采纳/修改后采纳/不采纳）；Q2 回路证明轮前置形状（#94 先行/人工顶替/混合）；Q3 行为防御包处置（预建提级/实测反哺）；确认区 1 条（硬化后置降为立票门槛原则）
- **Agent-owned**：resolution comment 措辞；受影响票的具体编辑文字；map Decisions so far 追加行
- **Blocked**：无

## 决定边界未知项
无——歧义已全部进入分诊。

## 未知项
- 本仓自己的 token/Issue 成本锚点不存在（从未在真实宿主完整跑过一轮），只能在回路证明轮中采集。
