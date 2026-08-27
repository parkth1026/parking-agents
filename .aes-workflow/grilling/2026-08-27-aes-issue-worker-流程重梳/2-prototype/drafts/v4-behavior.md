<!-- draft v4 | published 2026-08-27
     用户意见：round5/6：review 移 Master 层、aes-qa 单角色，本表结构过时
     状态：superseded by v5 -->
# 行为对照表: 2026-08-27-aes-issue-worker-流程重梳

**草稿 v4。** 确认后锁定；执行 Agent 改的是产品，不是这份对照表。

结构来源：用户提出的 1解决↔2验证 / 3审查与simplify / 4commit 结构，经 oh-my-codex
（ultragoal final gate、ultraqa 5 轮循环）与机械门约束双向 steelman 后落地。

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | solve（implement/diagnose）每轮产出后 | 实现者自跑 self-test | **独立 evaluator**：aes-qa 以 fresh-context 只读 subagent 跑自动档（AC 逐条核对 + 测试执行），输入只有 AC + worktree 路径 + 命令，不带实现者叙述；FAIL 带 finding 回 solve；**1↔2 循环直到 PASS** |
| 2 | evaluator PASS 后；workflowRole=implement 且有实质代码改动 | 无此步骤 | **simplify**（3 并行 subagent + 窄范围修复）；有改动则**重跑一次自动验证**（oh-my-codex deslop 后 rerun verification 同款）；非 implement 单 / 纯文档 / 零改动跳过 |
| 3 | simplify 收尾、自动验证绿 | 循环中多次 candidate commit | **单次 candidate commit**（happy path 全程唯一），`master.mjs candidate` 登记 |
| 4 | commit 登记后 | review 先于 QA 串行 | **终局并行双验**（两个只读 subagent，绑同一 commit SHA）：code-review（Standards+Spec 双轴）∥ aes-qa 终验（typed QaReceipt，按影响面含 live/manual 档） |
| 5 | 终局双验任一 MUST_FIX / FAIL | fixing 状态回 implement | 带 finding 回 solve 循环 → 走完 1→4 → 新 commit → 重跑双验（「审查与 commit 只发生一次」是 happy path，不是不变量） |
| 6 | review 深度；工单 declaredRisk=low/medium vs high/critical | 统一深度 | low/medium 轻量双轴单遍；high/critical 加查安全/边界/迁移面（沿用 Q1 + C2 裁定） |
| 7 | 边界：工单缺 declaredRisk（旧 Master 在途工单） | 无此分支 | 按 high 档保守处理，不拒单 |
| 8 | 边界：declaredRisk 非四档闭集 | 透传到 merge gate 才炸 | claim 时拒收 `BAD_RISK_PROFILE`（buildWorkOrder 加 assertRiskProfile，见 api-mock） |

## 不变清单

- **机械门等式不放松**：review / QA receipt 必须绑定 candidateCommit 精确相等——这就是 commit（行 3）必须发生在终局双验（行 4）之前的原因；不为任何 commit 开证据豁免通道（W-1 不复辟）。
- **内循环 evaluator 不产生 gate receipt**：typed QaReceipt 只由终局 QA 出具并绑定 commit SHA；内循环产物是 finding 反馈，不进 registry。
- **GATE-review 无条件**（C2）：任何档位必有 review；分档只调深度。
- Master 侧协议零改动（除 Q1 的 declaredRisk additive 字段）：`recordStageResult` 本就不强制 review/QA 先后，并行双验天然兼容；gate、terminal、六出口、DISCOVERED_WORK 四类均不动。
- 单 owner session 模型不变：solve 在 session 内持有 writer；evaluator / review / 终验 QA 全部是 fresh-context 只读 subagent；多 agent（多 session）只用于 Master 层并行多 Issue，不用于单 Issue 的 pipeline 阶段。
- worker 三条边界不变：永不 merge、永不直接写 GitHub、不清理用户现场。
- work-order 既有字段逐字节不变；schemaVersion 保持 v1；selftest-v4 既有断言全绿。

## 已废止的先前裁定

- C1「review→QA 顺序维持」：**推翻**。新形态为 QA（evaluator）循环在前、review 在终局、双验并行——与 oh-my-codex ultragoal final gate（verification → deslop → rerun → 独立 review → complete）同构。
- round 2「simplify 每次 commit 前」与 round 3「simplify 在 review PASS 后 QA 前」：被 v4 的单 commit 结构吸收——simplify 固定发生在唯一 commit 之前，两轮讨论的诉求（终局代码必然 simplify 过 + 不重复跑昂贵验证）均满足。

## 配置差异

无配置变化：不动 board.config.json、环境变量、CLI 选项。
