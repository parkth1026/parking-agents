<!-- draft v5 | published 2026-08-27
     用户意见：round7：步骤名改技能名、补 aes-qa 回归行、验收层与总管分离（integrator）
     状态：superseded by v6 -->
# 行为对照表: 2026-08-27-aes-issue-worker-流程重梳

**草稿 v5。** 确认后锁定；执行 Agent 改的是产品，不是这份对照表。

结构定稿路径：用户的 1解决↔2验证 / 3simplify+commit / 4review 归 merge 层结构，
经 oh-my-codex（autopilot 链、ultragoal final gate、ultraqa 循环、team 拓扑）与
机械门约束双向 steelman，round 4–6 三轮收敛。

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | solve（按 workflowRole 选方法论）每轮产出后 | 实现者自跑 self-test | **aes-qa 循环轮**（evaluator）：fresh-context 只读 subagent，自动档跑 AC 逐条核对 + 测试；输入仅 AC + worktree 路径 + 命令，不带实现者叙述；只出 finding 不出 receipt、不进 registry；FAIL 带 finding 回 solve，**1↔2 循环直到 PASS** |
| 2 | 循环轮 PASS 后；workflowRole=implement 且有实质代码改动 | 无此步骤 | **simplify**（3 并行 subagent + 窄范围修复），改动直接留在工作树；非 implement 单 / 纯文档 / 零改动跳过 |
| 3 | simplify 收尾 | 循环中多次 candidate commit | **单次 candidate commit**（happy path 全程唯一），`master.mjs candidate` 登记 |
| 4 | commit 登记后 | worker 内 review→QA 串行 | **aes-qa 最终轮**（同一 evaluator、同一 subagent 形态）：重跑自动档（顺带覆盖 simplify 改动）+ 按影响面补 live/manual 档，绑 commit SHA，产出 typed QaReceipt 并 `stage qa` 上报；FAIL 回 solve（烧 qaLoops）。与循环轮的唯一区别是输出格式与 SHA 绑定 |
| 5 | QaReceipt PASS，worker 发 READY_TO_MERGE terminal 后 | review 在 worker 内自派自报 | **review 移至 Master 验收层**：Master 对 ready-to-merge 的 job 派独立 code-review subagent（Standards+Spec 双轴；深度按 `resolveMergePolicy` 的 **effectiveRisk** 分档——含路径兜底，比工单自报档更准），review receipt 由 Master 侧 `stage review` 上报 |
| 6 | Master review MUST_FIX | worker 内直接修（不出 session） | **typed 打回**原 owner session（报文对见 api-mock v2；session 不可恢复则新 attempt 携带 finding）；**Master 记账烧 reviewLoops**；worker 走完行 1→4 产生新 commit、重新 READY |
| 7 | Master review PASS | — | 进入既有 v4 交付管线：gate 六项 → 串行 merge → post-merge verify → 幂等 close（零改动） |

## 不变清单

- **aes-qa 是唯一验证角色**：循环轮与最终轮是同一技能的两种调用；不存在独立的「终验」角色。
- **机械门等式不放松**：review / QA receipt 必绑 candidateCommit 精确相等；commit（行 3）先于一切 receipt 绑定；不开证据豁免通道。
- **GATE-review 无条件**（C2）：分档只调深度；机械门六项、串行 merge、post-merge verify、幂等 close 全部不动。
- **work-order schema 零改动**：Q1 的 declaredRisk 扩展撤销（分档依据在 Master 手里且更准）；schemaVersion 保持 v1；selftest-v4 既有断言天然全绿。
- 单 owner session 模型：solve 持 writer；循环轮 / 最终轮 / simplify / Master review 全部是 fresh-context 只读 subagent；多 agent 只存在于 Master 层并行多 Issue。
- worker 三条边界：永不 merge、永不直接写 GitHub、不清理用户现场。
- goal-terminal 六出口、DISCOVERED_WORK 四类、预算三分类闭集不变；reviewLoops 记账权移至 Master（qaLoops 仍 worker 侧自报，见残留风险）。

## 已废止的先前裁定

- C1（review→QA 顺序）：round 4 推翻。
- Q1（扩 work-order 带 declaredRisk）+ 行 7 缺字段按 high + 行 8 claim 拒收：round 5 连锁撤销；claim 侧 assertRiskProfile 降级为 board 可选加固，出本票范围（归 map #5）。
- round 2 / round 3 的 simplify 位置两轮裁定：被单 commit 结构吸收。
- v5 口头稿的「evaluator 与终验双角色」：round 6 取消，合并为 aes-qa 单角色。

## 残留风险（进契约）

- **QA receipt provenance 仍在 worker 侧**：最终轮由 worker 派生并上报，机械上无法证明 receipt 出自真实执行——与 review 移层前同款的洞，留给 aes-gate（map #47）的确定性检查补，本票不扩面。
- **打回通道的实现载体**（原 thread 消息 vs 新 attempt）依宿主能力而定，报文结构见 api-mock v2，实现细节归执行 Agent。

## 配置差异

无配置变化：不动 board.config.json、环境变量、CLI 选项。
