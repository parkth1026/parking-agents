<!-- draft v7 | published 2026-08-27
     用户意见：round 9 全部确认（1.确认 2.aes-merge-worker 3.for-human 模式）
     状态：confirmed -->
# 行为对照表: 2026-08-27-aes-issue-worker-流程重梳

**草稿 v7。** 确认后锁定；执行 Agent 改的是产品，不是这份对照表。

## 拓扑总则（round 8）

**hub-and-spoke，不是流水线**：三类 worker lane 全部挂在 aes-worktree-board（总管）
之下，彼此**没有直连通道**——一切交接经 registry（typed terminal / merge queue /
打回路由）。这不是新设计，是机械事实：`masterTerminal` 写的就是 registry 的
mergeQueue，worker 与 integrator 之间本来就没有通道。

| 角色 | 名字 | 状态 |
| --- | --- | --- |
| 总管（claim / 派单 / slot / queue / 打回与人工态路由） | aes-worktree-board | 既有 |
| 干活 workflow（agent 自主解决 Issue） | aes-issue-worker | 既有，本票修订 |
| 合并验收 workflow（消化 merge queue：review → merge → 全量回归） | **aes-integrator**（拟名待定） | **待建，挂总管下** |
| 人参与的干活 workflow（for-human / manual AC） | 形态待裁（见「人参与 worker」节） | **待建，挂总管下** |
| 实现方法论 | tdd / diagnosing-bugs（codebase-design 辅助） | 既有，按 workflowRole 路由 |
| 验证（循环轮 + 最终轮 + 回归，单一角色） | aes-qa | 既有，issue-worker 与 human lane 共用 |
| 清理 | simplify | 既有 |
| 代码审查 | code-review | 既有，由 integrator 派生 |

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | tdd / diagnosing-bugs 每轮产出后 | 实现者自跑 self-test | **aes-qa 循环轮**：fresh-context 只读 subagent，自动档跑 AC 逐条核对 + 测试；输入仅 AC + worktree 路径 + 命令；只出 finding 不出 receipt、不进 registry；FAIL 带 finding 回实现，**循环直到 PASS** |
| 2 | 循环轮 PASS 后；workflowRole=implement 且有实质代码改动 | 无此步骤 | **simplify**（3 并行 subagent + 窄范围修复）；非 implement 单 / 纯文档 / 零改动跳过 |
| 3 | simplify 收尾 | 循环中多次 candidate commit | **单次 candidate commit**（happy path 全程唯一），`master.mjs candidate` 登记 |
| 4 | commit 登记后 | worker 内 review→QA 串行 | **aes-qa 最终轮**（同一角色）：重跑自动档 + 按影响面补 live/manual 档，绑 commit SHA，产出 typed QaReceipt 并 `stage qa` 上报；FAIL 回实现（烧 qaLoops） |
| 5 | QaReceipt PASS 后 | READY_TO_MERGE 被视为直达合并方 | **READY_TO_MERGE terminal 进 registry**（总管 mergeQueue）；worker 交付即结束，**不与任何合并方直连** |
| 6 | mergeQueue 非空 | 「Master host」兼任合并 | **aes-integrator 从 queue 领取**，派独立 code-review subagent（双轴；深度按 effectiveRisk 分档——含路径兜底），review receipt 由 integrator 侧 `stage review` 上报 |
| 7 | integrator review MUST_FIX | worker 内直接修 | typed 打回**经总管路由**至原 owner session（报文见 api-mock v2；session 不可恢复则新 attempt 携带 finding）；**修复后必须重走 aes-qa 回归**（循环轮收敛 + 最终轮绑新 commit）再重新 READY；**reviewLoops 由 integrator 记账** |
| 8 | integrator review PASS | targeted verify | **integrator 执行交付管线**：gate 六项 → 串行 merge → **merge 后全量回归**（commands file 跑全量套件）→ 幂等 close → release slot |
| 9 | Issue 为 for-human / 含 manual AC | 无结构化人参与形态 | **人参与 worker lane**（形态待裁）：同一骨架（干活 ⇄ aes-qa → simplify → commit → 最终轮 → READY），人工步以 humanRequest{resumeToken} typed 暂停 + `actor:"human"` 答复恢复；aes-qa 的 humanChecklist / candidateFrozen / writerLease 字段在此 lane 获得消费方（W-4 闭环） |

## 不变清单

- **hub-and-spoke**：lane 之间零直连；typed terminal / queue / 打回全部经 registry——总管是唯一路由。
- **aes-qa 是唯一验证角色**：循环轮 / 最终轮 / 回归 / humanChecklist 是同一技能的调用形态；只有最终轮出 typed receipt。
- **机械门等式不放松**；**GATE-review 无条件**（C2）；机械门六项、串行 merge、幂等 close 不动。
- **work-order schema 零改动**（Q1 撤销）；registry / terminal / DISCOVERED_WORK / 六出口不动；selftest-v4 既有断言天然全绿。
- 单 owner session 模型；worker 三条边界（不 merge / 不写 GitHub / 不清现场）——merge 权独属 integrator lane。
- 人工答复协议不变：`actor:"human"`、resumeToken 找回、WAIVED 需结构化 waiver——人参与 lane 复用，不新造。

## 已废止的先前裁定

- C1（round 4）；Q1 + 缺字段/闭集边界行（round 5）；simplify 位置 round 2/3（单 commit 吸收）；
  evaluator/终验双角色（round 6）；「Master 验收层」表述（round 7）；
  **worker→integrator 直连拓扑（round 8 修正为 hub-and-spoke）**。

## 残留风险（进契约）

- QA receipt provenance 仍在 worker 侧（aes-gate #47 补）。
- aes-integrator 载体形态（独立 session 占 host worktree vs 总管兼任）与打回通道实现依宿主能力定；治理位进契约交接指令。
- 人参与 worker 的形态（aes-issue-worker 的 executionPolicy=for-human 模式 vs 独立技能）为**待裁项**，本票只锁角色位与协议复用，不实现该 lane。
- 全量回归耗时进入串行 merge 临界区（既有结论，不新增）。

## 配置差异

无配置变化。
