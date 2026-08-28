# Goal Contract: 把 close 与 GitHub 出站动作解耦，交付不再被出网副作用阻断

- Status: Ready
- Target: `.agents/skills/aes-worktree-board/`（`scripts/master.mjs`、新增出站模块、`scripts/selftest-v4.mjs`、`SKILL.md`）
- Updated: 2026-08-28

## 原始请求

> 我们开始走这个路线 。W2（#94 落地后）：#66 真实闭环证明（刻意触发 high 档 humanGate + token 成本锚点）；for-human lane 开票评估。

> 选 A 请继续

> Q1-A、Q2-B（不是 A——理由是它同时解掉 worker-1 卡死这个真实现场，而完整 happy path 正好可以留给 #114 那轮一起跑，避免同一条链路验两遍）、Q3-A。

> A. 按上面拆（推荐） — 我建新票、把 5 条 outbox AC 落成它的契约、本轮就跑 finalize；#126 的契约随后另写。

（本票由 #126 契约阶段拆分而来，GitHub Issue #142。）

## 目标

`master.mjs close` 落账即成功，GitHub 侧的 comment/close 改由通用出站队列承载：
GitHub 不可达时交付照常落地、slot 照常释放，出站动作留在队列里择机送达或带理由放弃。

## Why

- `masterClose` 在写 registry **之前** `await gh(...)`（`master.mjs:930-932`），gh 一失败整条命令 fail closed；
- 此刻仓库里就卡着一个：`job-69-111801` 已 merge `9004b5f`、post-merge verify 全域 PASS，
  只差 close，因原 #69 随账号封禁永久 404，job 卡 `merged`、`worker-1` 至今 `leased` 无法释放；
- 做到之后，交付链路的成败不再取决于一个出网副作用——registry 记意图、Git 记事实，
  GitHub 两者都不是。

## 范围

**做**：出站条目 schema 与 `outbox.jsonl` 落盘；`close` 改 registry-first 且命令内不调 gh；
`outbox flush` / `outbox status` / `outbox acknowledge` 三个子命令；`gate` 增加 `outboxWarning`。

**不做**：
- 不接 `issue-close` 以外的生产者（队列基建通用，但本票只接一个）;
- 不做惰性自动 flush，只由显式子命令触发；
- 不提供 `--fail-on-pending`；
- 不动机械门六项的 ids、顺序与判据，`outboxWarning` 不参与 `mayMerge`；
- merge-worker lane 本体（SKILL.md prose、血统校验、depthTier、review-return 路由）归 #126；
- 完整 happy path 的 live 轮归 #114 那轮，本票只验解卡链路。

## 强约束

- **机械门恒为八项**：ids 与顺序 `slot → commit → integration → acceptance → review → review-base → qa → qa-base`
  一字不改，判据不变；`outboxWarning` 只是可观测性字段，不进门。
  （`GATE-review-base` / `GATE-qa-base` 是 #62 交付的 integration-base 新鲜度检查，
  随 2026-08-27 恢复线回到代码里；SKILL.md 仍写「六项」是恢复未同步文档，本票顺手改正。）
- **`masterClose` 函数体内不得出现任何 gh 调用**——这是本票的拓扑断言，不是靠 try/catch 兜。
- **`options.gh` 注入点保留且可注入**（改由 flush 路径消费），既有 4 处 selftest 桩
  （`selftest-v4.mjs:563/1000/1006/1127`）不需重写调用形状。
- **出站条目永不物理删除**：`abandoned` 与 `acknowledged` 都留在 `outbox.jsonl` 里；
  `acknowledge` 降的是告警噪音，不是留档。
- **`deliveries[].issueClose` 的 `commentDigest` / `closedAt` 保留原名原义**（trajectory replay 依赖）。
- `close` 幂等语义不变：同 `commentDigest` 重复调用不产生第二次副作用，且**不重复入队**。
- 未知 schemaVersion、缺字段、非闭集值一律 **fail closed**。
- `2-prototype/` 下四份确认版对照物**不可修改**：执行 Agent 改的是产品，不是对照物。
- 脚本一律 `.mjs`、Node 内置模块、零依赖（仓库既有约定）。
- **新增子命令必须同步进 `master.mjs` 的用法串**（`outbox flush` / `outbox status` /
  `outbox acknowledge` 三条），否则等于加了没人知道的命令。

## 自主边界

不用问，直接定：
- `entryId` 的生成规则与字符集；
- 出站模块的文件拆分、内部数据结构与函数命名；
- `outbox status` 的具体排版与措辞；
- selftest 场景命名、断言风格与 fixture 组织；
- 互斥锁的复用方式（沿用 registry 同款即可）。

必须停下来问：
- 改机械门 ids、顺序或任何一门的判据；
- 改 `work-order/v1`、`stage-result`、`qa-receipt`、`goal-terminal` 任一 schema；
- 给出站队列接入 `issue-close` 之外的第二个生产者；
- 引入新依赖或新配置项；
- 删除既有子命令或改其参数形状。

## 读什么

- `../2-prototype/behavior.md`——17 条变化行、8 条边界值、11 条不变清单（确认版，锁定）
- `../2-prototype/api-mock.md`——出站条目四态 schema、close/flush/acknowledge/gate 报文对（确认版，锁定）
- `../2-prototype/example-run.md`——六个场景的调用方式、退出码与观感（确认版，锁定）
- `../2-prototype/diagram.html`——架构视图与流程视图，含 fidelity ledger（确认版，锁定）
- `.agents/skills/aes-worktree-board/scripts/master.mjs`——`masterClose` 现状与 `defaultGh`
- `.agents/skills/aes-worktree-board/scripts/selftest-v4.mjs`——v4 场景与既有 gh 桩
- GitHub Issue #131 的关票评论——偏差 9 的原始记录

## 要落盘的东西

- D-01: `.aes-worktree-board/receipts/outbox-unblock-job-69.json`：AC-005 解卡轮的
  live receipt，含解卡前后的 job state、slot state、出站条目四态流转与签收记录。

## 验收条件

- AC-001: `close` 在 gh 完全不可用时仍返回 `CLOSED`、把 job 推进到 `closed`、释放 slot，
  并产出一条 `pending` 出站条目；gh 可用与不可用两种情形下 `close` 的返回结构逐字段相同。
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario outbox-close` → 退出码 0
    （三个断言：① 注入抛错 gh 桩，close 仍 CLOSED + slot released + job closed + 条目入队；
    ② 注入「一旦被调用即抛」的 gh 桩，断言 close 全程**调用次数为 0**——钉死「拓扑保证而非
    try/catch 兜」的意图，且不锁实现（同款先例见 `selftest-v4.mjs:1006`）；
    ③ gh 可用与不可用两次 close 的返回结构逐字段相同）

- AC-002: `outbox flush` 的五种结局各自正确——成功送达、可重试失败留 `pending`、
  **跨 flush 调用累计第 3 次失败**转 `abandoned`、已 `succeeded` 幂等跳过、空队列不报错；
  五种结局**退出码一律 0**。
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario outbox-flush` → 退出码 0
    （五个结局各一断言；门槛尺子 = `attempts` 数组长度达 3，锁进断言）

- AC-003: `outbox acknowledge` 只对 `abandoned` 条目生效（否则 `NOT_ABANDONED`）、
  缺 `--reason` 拒收（`REASON_REQUIRED`）、重复签收幂等（`ALREADY_ACKNOWLEDGED`），
  且签收后条目仍在 `outbox.jsonl` 中可读。
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario outbox-ack` → 退出码 0
    （四个断言：两个负向拒收 + 幂等 + 条目仍存在）

- AC-004: `gate` 在有未签收 `pending` 条目时输出 `outboxWarning{pending, oldestAgeMs}`，
  队列为空或只剩 `acknowledged` 时为 `null`；两种情形下八门的 ids、顺序、各门 outcome
  与 `decision.mayMerge` 与改动前逐字段相同。
  - Verify: [A] `node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario outbox-gate && node .agents/skills/aes-worktree-board/scripts/selftest.mjs orchestration --scenario delivery-merge` → 退出码 0
    （outbox-gate 场景比对有/无积压两例的八门 ids 顺序与 mayMerge；delivery-merge 场景保持全绿证明四档语义未被触碰）

- AC-005: 真实解卡轮——对现场卡死的 `job-69-111801` 跑通
  `close → 入队 → flush ×3 → abandoned → acknowledge`，结束时 job 为 `closed`、
  `worker-1` 不再 `leased`、出站条目为 `acknowledged` 且仍可读。
  - Verify: [C] 在 `G:/GIT/AI_WorkFlow/parking-agents` 依次执行：
    ① `node .agents/skills/aes-worktree-board/scripts/master.mjs close --job job-69-111801`；
    ② `... outbox flush` 连跑三次；
    ③ `... outbox acknowledge --entry ` 加上第 ① 步返回的 `outbox.entryId`，
    并给出 `--reason`——文案由签收人当场判断，但**须写明两件事**：交付已落地的 merge SHA，
    以及该 Issue 不可达的原因；
    ④ `... master.mjs status`。
    可观察结果：`jobs["job-69-111801"].state` 为 `closed`、
    `runners["worker-1"].state` 不再是 `leased`、该条目 `state` 为 `acknowledged` 且仍可读；
    四步输出落 D-01 receipt

## 挡着的事

- None。**但有一条现场脆性需当面说清**：`orchestration` 域的 `storage` 与 `lifecycle`
  两个场景**隐式依赖实时 worktree 台账**（取 `collectStatus(...).worktrees[0]`），
  台账被并发增删时会随机红——同一份代码 09:51 红、10:5x 连跑三次绿，实证见 #143。
  它与本票无关，因此本票的 `[A]` 档 Verify **收窄到 `--scenario` 粒度**：
  这样每条 AC 的绿红只取决于自己的场景，不被别处的现场脆性带偏。
  #143 修掉隐式选取后可把 Verify 放宽回整域。

## 残留风险

- **AC-005 只覆盖解卡链路，不覆盖完整 happy path**（queue 领取 / review 派生 / gate / merge
  四段未经本票 live 验证）——错了会怎样：出站语义在「刚 merge 完就 close」的正常路径上
  可能有本票没触到的时序问题，要等 #114 那轮才暴露。这是用户在 C2 明确推翻推荐档做出的
  取舍，理由是避免同一条链路验两遍。
- **11 条 AC 的另 6 条随 #126 走，本票落地后 #126 契约另写**——错了会怎样：若 #126 迟迟不
  开工，depthTier 与血统校验会长期缺位，#114 的分档 live 验证面仍是残缺的。
- **`outboxWarning` 不设上限告警升级**——错了会怎样：长期无人 flush 时警告常亮而无人处理，
  退化成背景噪音；缓解手段是 `acknowledge` 必须带理由，逼人当面处理而不是静默清空。

- **`[A]` 档 Verify 收窄到场景粒度而非整域**——错了会怎样：本票的新代码若破坏了
  自身场景之外的其它场景，四个 `outbox-*` 场景与 `--scenario delivery-merge`
  未必抓得到；缓解手段是执行 Agent 在 commit 前额外逐场景跑一遍全域，
  确认红面**没有新增**（注意 `storage` / `lifecycle` 的绿红本身就会随 worktree 台账
  漂移，判「新增」时要把它们排除在外——见 #143）。
  本轮该守则已实际生效：它抓到了 `recovery` 与 `delivery-merge` 两个场景因
  「断言写在 close 上」而被本票改动打断，两处守卫已随出站动作迁移到 flush。

## 访谈记录

### 第 1 轮（1-interview，范围边界）

| 问题 | 候选（当时百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 偏差 9（close 与 GitHub 解耦）以什么档位进 | A 完整解耦 12% / B 独立建票带伤上线 18% / C 最小降级并入 70% | C | **A**。推翻推荐档——本票因此存在 |
| 解耦的覆盖面 | A 队列基建通用、只接 close 60% / B 只做 close 内部解耦 25% / C 全部 GitHub 写操作 15% | A | A |
| pending 积压谁消化 | A 显式 flush 子命令 55% / B 惰性自动 flush 30% / C 两者都做 15% | A | A |
| live 验证轮留本票还是拆 | A 全留 22% / B 全拆 23% / C 分层 55% | C | C |
| 载体形态 prose 怎么写 | A 写死总管兼任 15% / B 独立 session 15% / C 载体无关 70% | C | C（归 #126） |

默认区（未占提问、用户未反对）：偏差 4 REPO_ROOT prose 并入 #126 只做文档；
偏差 8 基线红表达位不并入、转 #125；偏差 7 分支 ref 对账独立建票（#134）；
陈旧现场清理不入票；close 契约变更在 map #100 登记。

### 第 2 轮（2-prototype，对照物质疑）

| 问题 | 候选（当时百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| P1 depthTier：critical 与 high 同档？ | A 同为 deep 70% / B critical 另立 exhaustive 30% | A | A（归 #126） |
| P2 abandoned 永不删除会否变噪音 | A 保持永远显示 35% / B 加 --acknowledge 签收降噪 65% | B | **B**——v1 草案被改，签收机制因此进范围 |
| P3 flush 退出码要不要能红 | A 恒 0 不加开关 70% / B 加 --fail-on-pending 30% | A | A |
| P4 outboxWarning 升第七道门？ | A 只做可观测性 75% / B 升为第七道门 25% | A | A |

对照物迭代：v1 四份 → 用户仅要求 P2 一处修改 → 确认版落 `2-prototype/`，
`diagram.html` 流程视图因此新增 `acknowledged` 节点，accent 预算取舍已在 fidelity ledger 申报。

### 第 3 轮（3-contract，验收口径）

| 问题 | 候选（当时百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| C1 flush 重试上限与计数单位 | A 跨调用累计 3 次 55% / B 单次 flush 内 3 次 15% / C 24h 时间窗 25% / D 只人工 5% | A | A |
| C2 live 一轮拿什么跑 | A 挑高机械度票走完整 happy path 50% / B 用现成 job-69 验解卡链路 35% / C 两者都做 15% | A | **B**。推翻推荐档，原话见「原始请求」 |
| C3 prose 用什么档位验 | A grep 锚点断言 60% / B 人工语义对照 30% / C 两者都做 10% | A | A（该条随 #126 走） |
| 11 条 AC 是否拆票 | A 拆两张 / B 不拆记残留风险 / C 换个切法 | A | A |

## 设计取舍

### D-1 出站失败时，registry 要不要回滚

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 回滚 | gh 失败则撤销 registry 的 close 与 slot 释放 | 需要补偿事务；且 append-only 的 transitions 无法真正撤销 | 它把「GitHub 是权威」这个错误前提又请了回来 |
| B（选定）不回滚 | registry 落账即终局，出站失败只体现在队列条目上 | 存在「本地已 closed 但 GitHub 上仍 open」的中间态窗口 | 无 |
| 什么都不做 | 保持现状 | job 与 slot 继续被出网故障扣住 | 现场已经卡了一个 job-69，代价已经发生 |

选定 B。理由：这套控制面早就把「意图」和「事实」分开记了——registry 记意图、Git 记事实。
GitHub 在这个二分里没有位置，它只是一个把结果广播出去的副作用面。让副作用失败去回滚
主账本，等于把广播提升为权威。中间态窗口是真实存在的代价，但它可被观测（`outbox status`）、
可被收敛（`flush`）、可被审计（`acknowledged` 带理由留档），而 slot 被永久扣住不可收敛。

落进契约的形态：`强约束` 写「`masterClose` 函数体内不得出现任何 gh 调用」。
写成约束而不是步骤——约束不会过时，步骤会。
