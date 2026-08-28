# Context Snapshot: outbox-close-解耦（GitHub Issue #142）

- 创建：2026-08-28
- 分片来源：`2026-08-28-aes-merge-worker-落地`（#126）契约阶段拆分而来

## 任务陈述

把 `master.mjs close` 与 GitHub 出站动作完全解耦：registry 落账即成功，GitHub 侧
comment/close 走通用出站队列，显式 flush 送达，永久失败转 abandoned 并可人工带理由签收。

## 为什么是独立一票

原为 #126 范围的一部分。契约阶段从四份确认版对照物聚类聚出 **11 条 AC**，触发
`goal-contract-shape.md` 的「六条以上说明目标太大，拆成能独立交付的任务，不要把条数
压回去」规则。切缝落在「通用基建 vs 单一消费方」：访谈 Q4 已裁定出站队列是通用基建
（`kind` 开放枚举），不属于 merge-worker lane 这一个消费方。

顺序上本票在前：落地即解开 `worker-1` 的卡死租约，而 #126 落地时需要一个可用 slot。

## 用户提出的方案

访谈 Q1 用户推翻 70% 的「最小降级」推荐档，选 **A 完整解耦（降级 + 重试 + 补偿审计）**；
Q4 选 A「队列基建通用设计，本票只接 close 一个生产者」；Q5 选 A「显式 flush 子命令」。
契约阶段 C2 用户再次推翻推荐档，选 **B 用现成 job-69-111801 验解卡链路**，理由原话：
「它同时解掉 worker-1 卡死这个真实现场，而完整 happy path 正好可以留给 #114 那轮一起跑，
避免同一条链路验两遍」。拆票本身由用户在契约阶段选 A 拍板。

## 意图假设

任务陈述是「把 close 与 GitHub 解耦」，真正要解决的是：**交付的成败不该由一个出网副作用
决定**。GitHub 既不是意图真源（registry 是）也不是事实真源（Git 是），它凭什么有权阻断
交付并扣住 slot。因此判据不是「gh 失败时要重试几次」，而是「gh 在不在，交付路径都应逐字节
相同」——这决定了 close 必须 registry-first 且命令内根本不调 gh，而不是包一层 try/catch。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| `masterClose` 在写 registry **之前** `await gh(...)`，gh 抛错则整条命令 fail closed | `master.mjs:930-932` | Fact |
| `job-69-111801` 现卡 `merged`：已 merge `9004b5f`、verify 十域 PASS，只差 close | `master.mjs status` 实跑 | Fact |
| `worker-1`（parking-agents-manual2）`state: leased`，`reason: 已租给 job-69-111801` | 同上 | Fact |
| 原 #69 随 piaotonghu 账号封禁永久 404，close 的 gh 段无法送达 | GitHub 实查 | Fact |
| `options.gh` 注入点已存在且被 4 处 selftest 桩依赖 | `selftest-v4.mjs:563/1000/1006/1127` | Fact |
| `defaultGh` 失败抛 `GH_COMMAND_FAILED`，含截断 stderr | `master.mjs:960-972` | Fact |
| runtime-v4 目录已有 append-only 同款：`inbox.jsonl` / `transitions.jsonl` / `receipts.jsonl` | 目录实存 | Fact |
| 机械门六项 ids 与顺序有断言保护 | `selftest-v4.mjs:919` | Fact |
| v4 域场景挂 `selftest.mjs orchestration`（导入 `selftest-v4.mjs`） | `selftest.mjs:31` | Fact |
| 全量回归入口 `run-tests.mjs`，11 域串行，`board-ui` 需 `--baseline 700x1000` | `run-tests.mjs:9-14` | Fact |
| 偏差 9 的原始记录与 momo「GitHub 不稳定」类比 | GitHub #131 关票评论 | Fact |

## 验证基建候选池

- `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration`——v4 场景域，
  新场景落这里；代价：`AES_WORKTREE_BOARD_REPO_ROOT` 不得泄漏进来（会破坏 fixture 场景）。
- `node .agents/skills/aes-worktree-board/run-tests.mjs`——11 域全量；代价：耗时最长，
  且 fixture/server 时序与 board-ui SHA 属已知 flaky 面。
- 真实 `job-69-111801` 解卡轮——现成现场，零额外造场成本；代价：只覆盖解卡链路，
  不含 queue 领取/review/gate/merge（完整 happy path 归 #114 那轮）。
- grep 断言——用于「`master.mjs` 不再直接调 gh」这类依赖边消失的拓扑断言。

## 四分类

- **Fact**：上表全部。
- **User decision**：已裁定完毕（访谈 Q1/Q4/Q5 + 契约 P2/P3/P4 + C1/C2/C3，见 `rounds.jsonl`）。
- **Agent-owned**：`entryId` 生成规则、出站模块的文件拆分与内部数据结构、
  `outbox status` 的具体排版、selftest 场景命名与断言风格。
- **Blocked**：无。

## 未知项

- 无。本票的全部歧义已在上游访谈与契约阶段收口。
