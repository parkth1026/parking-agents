<!-- draft v3 | published 2026-08-27
     用户意见：用户参照 oh-my-codex 提出 solve↔evaluator 循环结构，本表串行形态过时
     状态：superseded by v4 -->
# 行为对照表: 2026-08-27-aes-issue-worker-流程重梳

**草稿 v3。** 确认后锁定；执行 Agent 改的是产品，不是这份对照表。

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | review PASS 之后、QA 之前；workflowRole=implement；实现含实质代码改动 | 无此步骤 | 跑 simplify（3 并行 review subagent + 窄范围修复），改动折为终局 candidate commit；随后一次轻量复审只看 simplify diff、绑新 commit；QA 全程仅此后一跑 |
| 2 | review PASS 后；workflowRole=diagnose/research/design，或改动仅文档/注释/格式，或 simplify 跑完零改动 | 无此步骤 | 不产生新 commit，原 candidate 直接进 QA（零成本路径） |
| 3 | implement 收尾；自测命令有非零退出码 | SKILL.md 未显式禁止先 commit（executor final 层才 fail closed） | 显式门：自测全绿才准首次 candidate commit；非零先修，不产生 candidate |
| 4 | review 阶段；工单 declaredRisk=low 或 medium | 统一深度 review | 轻量档：Standards+Spec 双轴单遍，不加专项面 |
| 5 | review 阶段；工单 declaredRisk=high 或 critical | 统一深度 review | 深度档：双轴之外加查安全/边界/迁移面（具体清单由执行 Agent 按改动面组织） |
| 6 | 边界：工单缺 declaredRisk 字段（旧 Master 发出的在途工单） | 字段不存在，无此分支 | 按 high 档深度处理（保守向上），不拒单、不 fail closed |
| 7 | 边界：declaredRisk 为非四档闭集值 | 无此分支 | 不会到达 worker：buildWorkOrder 在 claim 时 assertRiskProfile 抛 BAD_RISK_PROFILE（见 api-mock 报文对） |

## 不变清单

- **review → QA 顺序不变**（C1 裁定）：QA 只在 review PASS、代码稳定后跑一次——simplify 插入两者之间，不改变该顺序，QA 仍全程仅一跑且绑定终局 commit。
- **机械门等式不放松**：simplify 产生的新 commit 必须经轻量复审重新绑定 review 证据；不为 simplify commit 开证据豁免通道（那会重开 W-1 的洞）。
- **GATE-review 无条件**（C2 裁定）：分档只调深度，任何档位都必须有 review；机械门六项固定顺序不动。
- goal-terminal 六个 outcome 闭集不变；executor final schema 不变。
- DISCOVERED_WORK 四类 relationship 闭集不变；单子分类异议走 CONTRACT_CONFLICT。
- 单 owner session 模型不变；双 session 仍只是三类 typed 边界的事件驱动出口。
- 证据绑定与作废语义不变：candidate 前进作废 review/QA；contractDigest 变化作废 spec 轴证据。
- work-order 既有字段全部不变（additive）；schemaVersion 保持 `aes.issue-worker.work-order/v1`。
- selftest-v4 既有断言必须保持全绿（`:91,976,1086` 消费 workOrder 字段处不受影响）。
- worker 三条边界不变：永不 merge、永不直接写 GitHub、不清理用户现场。

## 配置差异

无配置变化，整节省略依据：不动 board.config.json、环境变量、CLI 选项。
