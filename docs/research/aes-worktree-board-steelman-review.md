# AES Worktree Board：Steelman 复审与最佳实践结论

> 目标：重新审视 `aes-worktree-board` 的产品定位、控制边界与参考架构，区分哪些是已核验事实、哪些是合理推论、哪些只是可选策略，并明确最值得完整参考的核心仓库。

---

## 1. 最终结论

上一版方案的主方向成立，但不能直接称为“已经证明的最佳实践”。经过 steelman 复审后，结论应收敛为：

1. `aes-worktree-board` 最适合定位为 **Issue 驱动的 Agent Delivery Control Plane**。
2. 它当前更准确的形态是 **宿主驱动的编排协议 + 确定性控制账本**，而不是一个已经独立运行的持久化 daemon。
3. **Issue 才是交付单位，Session、Thread、Worktree 和 PR 都只是执行资源或阶段性产物。**
4. Worker 可以提交实现结果和证据，但不能拥有最终完成、质量和合并权威。
5. Master 必须是唯一的调度状态写入者，但不要求所有逻辑都塞进一个 Skill 文件。
6. 自动合并只能是按风险配置的策略，不能被视为所有任务的默认行业最佳实践。
7. Human-required 不应被实现为一组不断膨胀的主状态，而应由独立、可恢复的 `HumanRequest` 实体表达。
8. 当前方案最值得保留的差异化能力，是从 Worker 结果到合并后验证的精确证据链。

一句话定义：

> **Wayfinder 把未知变成可执行 Issue；AES Worktree Board 通过持续 Reconciliation，把 Issue 推进为可验证、可审查、可合并或明确移交的交付结果。**

---

## 2. 核心参考仓库：最终选择

如果只能选择一个仓库作为整体控制思想的核心参考，应该选择：

## OpenAI Symphony

建议完整参考的是 Symphony 的架构语义与 `SPEC.md`，不是完整 Fork 它的具体实现。

它与目标系统最重要的共同点是：

```text
Issue Tracker
→ 发现可执行任务
→ 为 Issue 分配隔离 Workspace
→ 启动 Agent Attempt
→ 持续 Reconcile
→ 处理退出、失败、重试和停滞
→ 推进到 Review、Handoff 或交付
```

Symphony 最值得直接吸收的十条原则：

1. **Issue 是交付单位，Session 不是。**
2. Issue、Run、Attempt、Session 必须分层建模。
3. Workspace 可以跨多个 Attempt 保留。
4. Orchestrator 是调度状态的唯一写入者。
5. 每轮应先 Reconcile 外部事实，再决定 Dispatch。
6. Agent 正常退出不等于 Issue 完成。
7. Crash、Stall、Continuation 和 Retry 应分别处理。
8. Workflow Policy 应进入仓库版本管理。
9. 一个合法终点可以是 Human Review，而不必伪装成 Done。
10. Issue Tracker 管业务意图，内部 Registry 管运行事实，两者通过 Reconciliation 保持一致。

### 为什么不能完整照搬 Symphony

Symphony 仍不能直接替代你的系统，因为它并没有完整覆盖：

- 你当前的精确 Commit 证据链；
- Merge Receipt 和真实 Merge Commit 校验；
- Post-merge 实际命令验证；
- Windows Desktop Task 和可见 Session 运行模式；
- 多 Provider 的统一 Executor Contract；
- 你需要的 `workflow-interview`、`aes-qa` 和人工验收流程；
- 复杂风险条件下的自动合并策略。

因此正确策略是：

> **采用 Symphony 的控制骨架，不照搬它的实现边界。**

---

## 3. 第二与第三参考仓库

### 3.1 Untrivial AI Agent Orchestrator：运行时工程参考

它更适合作为以下部分的第一实现参考：

- Windows 桌面端；
- 多 Agent Provider；
- Session 生命周期；
- Worktree 与 PR 管理；
- 本地 daemon；
- SQLite 持久事实；
- UI 与后台状态同步；
- Observer、Action、Port、Adapter 的工程边界。

它最重要的架构原则是：

```text
OBSERVE external facts
→ UPDATE durable facts
→ DERIVE status and action
```

应吸收：

- 只持久化最小事实，不持久化全部 UI 派生状态；
- Observer 与 Action 分离；
- Core 依赖 Port，Adapter 位于边界；
- 探测失败不直接等价于进程死亡；
- 不在存在未提交内容时强制删除 Workspace。

但它不适合作为完整 Issue 消化流程的唯一参考，因为其强项仍是 Session、Worktree、PR 和 Agent 监督，而不是完整的 Issue DAG 到交付闭环。

### 3.2 Issue-Orchestrator：质量治理参考

它适合参考：

- Agent 输出被视为不可信输入；
- Coder、Reviewer、Rework 角色分离；
- Review 绑定精确 Commit；
- 有界 Rework；
- Orchestrator 拥有最终质量状态；
- 人类或受保护策略拥有最终合并权。

但它不应再被称为总体核心参考仓库。其价值在于质量协议，而不是完整产品和运行时架构。

### 3.3 AionUi / AionCore：Team 与人机交互参考

适合参考：

- Leader / Teammate；
- Team MCP；
- Agent Slot Identity；
- 异步 Mailbox；
- 动态创建或关闭成员；
- Permission Bridge；
- 用户查看并干预 Agent。

不应照搬：

- 多个写入型 Agent 共用一个可写目录；
- 以 Team 内存状态作为全局事实源；
- 将消息“读过”直接等价为可靠消费。

### 3.4 Claude Dynamic Workflows：单个 Worker 内部的微编排参考

正确层级是：

```text
AES Worktree Board
└── IssueRun / Attempt
    └── Worker Session
        └── Dynamic Workflow
            ├── Research
            ├── Implementation
            ├── Test
            ├── Adversarial Review
            └── Bounded Repair
```

它可以增强一个 Worker Session 内部的并行和交叉验证，但不能替代跨 Issue、跨 Session、可恢复的 Board 控制器。

---

## 4. 经得起 steelman 的核心判断

## 4.1 必须有唯一调度状态写入者

真正的不变量是：

> **Claim、Lease、Retry、Scheduling Transition 和 Merge Queue 只能由一个控制核心写入。**

这不等于只能存在一个 Skill 文件。

推荐关系：

```text
aes-worktree-board
= 主入口、策略、看板和操作界面

orchestrate-worktree-loop
= 兼容入口或一种 Delivery Policy

Orchestrator Core / Reducer
= 唯一状态写入核心
```

因此，不必武断删除 `orchestrate-worktree-loop`，但必须消除其与 Board 各自维护生命周期状态的可能性。

---

## 4.2 Worker 自报完成不能等于完成

正确语义应固定为：

```text
WorkerResult
→ Candidate Result

Deterministic Checks + Independent Review + Acceptance Evidence
→ Merge Candidate

Merge + Post-merge Verification
→ Integrated Completion
```

Worker 可以提交：

- Commit SHA；
- 变更摘要；
- 测试结果；
- 未决风险；
- 建议 Verdict；
- Handoff 原因。

但 Worker 不能自行决定：

- Issue 已完成；
- 质量门已通过；
- 可以合并；
- 可以忽略阻塞；
- 可以扩大任务范围。

---

## 4.3 独立 Reviewer 是必要 Gate，但不是真理机器

独立 Reviewer 可以降低实现者自我确认偏差，但仍可能共享模型偏差、错误需求假设和不充分测试。

可靠质量链应为：

```text
Deterministic checks
+ Acceptance evidence
+ Independent reviewer
+ Runtime or manual evidence when required
+ Protected merge policy
```

Reviewer 是 Gate 之一，不是唯一 Gate。

---

## 4.4 Autonomous 与 Human-required 必须分离

方向成立，但不应为每一种人工交互增加主状态。

推荐创建正交实体：

```yaml
humanRequest:
  id: hr-123
  kind: manual_validation
  status: open
  requestedByRun: run-17
  prompt: "请验证窗口缩放时右侧面板是否遮挡主编辑区"
  requiredEvidence:
    - user_verdict
    - optional_screenshot
  resolution: null
```

`kind` 可以是：

```text
decision
manual_validation
permission
external_access
risk_approval
```

UI 可以根据未解决的 `HumanRequest` 推导 `Needs Human`，而不是让主生命周期出现大量组合状态。

---

## 5. 上一版必须修正的结论

## 5.1 一个 Issue 不应绑定一个物理 Session

“尽量在当前 Session 完成闭环”可以作为执行偏好，但不能成为架构不变量。

推荐模型：

```text
Issue
└── IssueRun
    ├── Attempt 1
    │   └── Session 1
    ├── Attempt 2
    │   └── Session 2
    └── Attempt N
        └── Session N
```

可能需要多个 Attempt 的原因：

- 上下文耗尽；
- Agent 崩溃；
- 模型升级；
- Provider 切换；
- 等待人工后恢复；
- Reviewer 退回；
- 环境在后续恢复；
- 同一个 Issue 涉及多个连续阶段。

正确目标是：

> **单个 Attempt 尽量闭环；任何 Session 结束时都必须产生 Typed Result 或 Typed Handoff，使下一个 Attempt 能可靠续跑。**

---

## 5.2 Registry 不是所有事实的统一真相源

推荐权威划分：

| 事实类别 | 权威来源 |
|---|---|
| Issue 目标、优先级、依赖、业务状态 | GitHub/GitLab Issue Tracker |
| Branch、Commit、Dirty、Merge、HEAD | Git |
| Thread、Session、进程活动状态 | Agent Runtime / Desktop Host |
| Claim、Lease、Attempt、Receipt、Circuit Epoch | Board Registry |
| 测试、Review、Runtime 验收 | Commit-pinned Evidence |
| Needs Human、Merge Ready、UI 看板位置 | 从以上事实推导 |

因此更准确的表述是：

> **Registry 是编排控制事实源，而不是整个系统的唯一事实源。**

系统必须持续 Reconcile：

```text
Registry says running
但 Session 已不存在
→ 重建或进入 Retry

Registry says merged
但 Git 没有对应 Merge Commit
→ 不能视为完成

Issue says blocked
但 Board 准备继续派发
→ 停止 Dispatch 并更新运行状态
```

---

## 5.3 一个 Issue 不一定必须有一个 Worktree

对于写代码任务，正确不变量是：

> **同一个 Workspace 在同一时刻只能有一个有效写租约。**

以下工作可以没有 Worktree：

- Research；
- Interview；
- 架构评审；
- Issue 拆分；
- 手工验收；
- 只读 Code Review。

跨仓任务还可能需要：

```text
IssueRun
└── WorkspaceSet
    ├── repository A / branch A / PR A
    └── repository B / branch B / PR B
```

因此推荐模型是：

```text
IssueRun
├── zero or more WorkspaceLease
└── each writable Workspace has one writer lease
```

---

## 5.4 自动合并不是普遍默认最佳实践

Master 可以拥有自动合并能力，但不能拥有无条件合并权力。

推荐策略：

```yaml
mergePolicy:
  low:
    mode: automatic
  medium:
    mode: automatic_after_protected_gates
  high:
    mode: human_approval
  critical:
    mode: pr_only
```

通常应要求人工批准的范围：

- 权限与认证；
- 数据迁移；
- 破坏性 Schema 变化；
- 安全边界；
- 计费和资金逻辑；
- 公共 API 兼容性；
- 无法自动完成的人工验收；
- 风险豁免。

---

## 5.5 固定三次 BLOCK 和固定模型名不是行业标准

`luna-max / sol-high` 可以作为当前 Provider 的配置，但内部协议不应写死模型名。

推荐抽象：

```yaml
capabilityTier: fast | standard | deep
```

再由 Adapter 映射：

```yaml
codex:
  fast: gpt-5.6-luna-max
  deep: gpt-5.6-sol-high
```

熔断应综合：

```text
failure fingerprint
repository progress
commit delta
same rejection reason
cost budget
elapsed time
risk severity
```

正确策略不是简单计数，而是判断是否仍在收敛。

---

## 6. Skill-only 架构的边界

必须明确两个不同目标。

### 目标 A：当前 Master 会话存活期间完成自动闭环

可以使用：

```text
Master Skill
+ Desktop Host Tools
+ Registry / Inbox / Receipts
```

### 目标 B：关闭会话、重启应用或机器后仍持续推进

需要：

```text
Persistent Local Controller / Daemon
├── poll
├── reconcile
├── dispatch
├── heartbeat
├── retry
├── session launch
├── event fan-in
└── recovery
```

因此必须接受：

> **Skill 是策略与协议，不是进程监督器。**

`aes-worktree-board` 可以继续作为 Master Skill，但真正的无人值守能力最终需要宿主或本地 daemon 承担 Liveness。

---

## 7. 修正后的领域模型

```text
Issue
├── business intent
├── dependency graph
├── priority
└── acceptance contract

IssueRun
├── workflowProfile
├── interactionPolicy
├── verificationProfile
├── riskProfile
├── mergePolicy
├── Attempt[]
├── WorkspaceLease[]
├── EvidenceBundle[]
├── HumanRequest[]
└── DeliveryDecision

Attempt
├── executor adapter
├── capability tier
├── session/thread id
├── started/ended timestamps
├── Typed Result or Handoff
└── failure fingerprint
```

推荐四个正交策略字段：

```yaml
workflowProfile: implement
interactionPolicy: autonomous
verificationProfile: code_change_standard
riskProfile: high
```

### `workflowProfile`

```text
research
diagnose
implement
interview
manual_acceptance
review
```

### `interactionPolicy`

```text
autonomous
decision_required
manual_validation
permission_required
external_access_required
```

### `verificationProfile`

```text
research_evidence
code_standard
ui_runtime
security_critical
manual_acceptance
```

### `riskProfile`

```text
low
medium
high
critical
```

---

## 8. 修正后的总体架构

```text
GitHub / GitLab Issue Tracker
│
│ 业务目标、依赖、优先级、Handoff 状态
▼
┌──────────────────────────────────────────┐
│ Orchestrator Core                        │
│ 唯一 Scheduling State Writer             │
│                                          │
│ poll / reconcile / claim / retry         │
│ concurrency / workspace lease            │
│ human request / merge queue              │
│ receipts / recovery                      │
└──────────────────────────────────────────┘
           │
           ├── IssueRun
           │   ├── Attempt 1 → Session 1
           │   ├── Attempt 2 → Session 2
           │   └── Attempt N
           │
           ├── WorkspaceLease[]
           ├── EvidenceBundle[]
           ├── HumanRequest[]
           └── DeliveryDecision
                    │
                    ▼
┌──────────────────────────────────────────┐
│ aes-worktree-board                       │
│ Master Policy / Operator Skill / UI      │
│                                          │
│ Workflow 路由                            │
│ 模型能力档位                             │
│ 验证档位                                 │
│ 合并策略                                 │
└──────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────┐
│ Executor Adapters                        │
│ Codex / Claude / Pi / Gemini / Aion ACP  │
│ Desktop Thread / CLI / App Server        │
└──────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────┐
│ Existing Workflow Skills                 │
│ wayfinder / research / diagnose          │
│ implement / tdd / code-review            │
│ workflow-interview / goal / aes-qa       │
└──────────────────────────────────────────┘
```

---

## 9. Worker Skill 应该有多薄

可以存在：

```text
aes-worktree-worker
```

但它只应负责：

1. 读取 `WorkerEnvelope`；
2. 确认 IssueRun、Attempt、Workspace 和权限；
3. 加载指定 Workflow Skill；
4. 遵守范围和预算；
5. 输出 Typed Final 或 Typed Handoff。

它不应负责：

- 全局 Claim；
- 全局生命周期；
- Merge；
- 无限 Repair；
- 自行判定最终 Done；
- 任意改变 Issue 业务状态。

推荐协议：

```yaml
workerEnvelope:
  issueRunId: run-17
  attemptId: att-2
  workflowProfile: implement
  interactionPolicy: autonomous
  verificationProfile: code_change_standard
  riskProfile: high
  workspace:
    path: ../repo-wt-17
    writeLease: lease-abc
  budget:
    maxTurns: 40
    maxCost: optional
    deadline: optional
```

返回：

```yaml
workerResult:
  status: candidate_ready | blocked | handoff
  commitSha: abc123
  summary: "..."
  evidenceManifest: evidence-17.json
  unresolvedRisks: []
  humanRequests: []
  suggestedNextAction: review
```

---

## 10. 当前最值得保留的独特能力

与外部参考仓库相比，当前 `aes-worktree-board` 最值得保留的是这条链：

```text
Typed Executor Final
→ Commit-pinned Evidence
→ Independent Review
→ Merge Gate Receipt
→ Real Merge Commit Verification
→ Post-merge Command Execution
```

它解决的是一个关键问题：

> Agent、Reviewer、Registry 和 UI 中的“完成声明”，必须能够被 Git 与真实运行结果重新验证。

这应成为系统的核心差异化，而不是在迁移到 Symphony 式架构时被弱化。

---

## 11. 实施优先级

### P0：冻结概念边界

1. 将 `Issue / IssueRun / Attempt / Session` 分层；
2. 确立唯一 Scheduling State Writer；
3. 把 Registry 定义为编排事实源，而不是所有事实的统一真相源；
4. 冻结 `WorkerEnvelope / WorkerResult / EvidenceManifest / HumanRequest`；
5. 取消“一个 Issue 必须一个 Session 完成”的硬约束；
6. 将自动合并改为 `mergePolicy`；
7. 将 Provider 模型名改为能力档位映射。

### P1：统一两个 Master 语义层

1. `aes-worktree-board` 保持主入口；
2. `orchestrate-worktree-loop` 改为兼容入口或 Policy；
3. 所有状态转换进入同一个 Reducer / Core；
4. 禁止 Skill 各自维护不同的 Claim、Retry 和 Merge 状态。

### P2：引入持久 Controller

1. Poll / Reconcile；
2. Session launch / recovery；
3. Lease / heartbeat；
4. Retry / failure fingerprint；
5. HumanRequest 恢复；
6. Merge queue；
7. 应用重启后的状态重建。

### P3：吸收外部实现

- Symphony：Issue 驱动与持续 Reconciliation；
- AO：Windows daemon、Session、Worktree、Ports/Adapters；
- Issue-Orchestrator：严格质量门与有界 Rework；
- AionUi/AionCore：Team MCP、身份、权限和人工介入；
- Claude Dynamic Workflows：单 Attempt 内部多 Agent 微编排。

---

## 12. 最终决策记录

### 核心参考仓库

> **OpenAI Symphony。**

完整参考其：

```text
Issue-driven delivery
Session decoupling
IssueRun / Attempt semantics
Single scheduling authority
Continuous reconciliation
Retry and continuation separation
Human review as a valid terminal handoff
Repository-versioned workflow policy
```

不完整照搬其：

```text
Elixir runtime
Codex/Linear coupling
in-memory scheduling assumptions
workspace cleanup policy
lack of strict commit evidence chain
lack of Windows Desktop integration
```

### 工程实现参考

> **Untrivial AI Agent Orchestrator。**

### 质量协议参考

> **Issue-Orchestrator。**

### Team 与 Human Interaction 参考

> **AionUi / AionCore。**

### 单 Worker 内部多 Agent 参考

> **Claude Dynamic Workflows。**

---

## 13. 最终判断

严格地说，当前方案不是“把某个成熟开源仓库完整复刻一遍”，也不存在一个公开项目能直接替代你的全部目标。

最合理的路线是：

```text
Symphony 的控制流程骨架
+ AO 的持久运行时和 Windows 工程
+ 现有 Board 的精确证据链
+ Issue-Orchestrator 的质量治理
+ AionUi 的 Team 与人工交互
+ Dynamic Workflows 的 Session 内微编排
```

最终产品应被定义为：

> **一个以 Issue 为交付单位、以持续 Reconciliation 为运行机制、以 Typed Evidence 为完成依据、同时支持 Autonomous Delivery 与 Human Gate 的本地多 Agent 交付控制平面。**

---

## 参考资料

- OpenAI Symphony：<https://github.com/openai/symphony>
- Symphony SPEC：<https://github.com/openai/symphony/blob/main/SPEC.md>
- OpenAI Symphony 介绍：<https://openai.com/index/open-source-codex-orchestration-symphony/>
- Untrivial AI Agent Orchestrator：<https://github.com/Untrivial-ai/agent-orchestrator>
- AO Architecture：<https://github.com/Untrivial-ai/agent-orchestrator/blob/main/docs/architecture.md>
- AO Status：<https://github.com/Untrivial-ai/agent-orchestrator/blob/main/docs/STATUS.md>
- Issue-Orchestrator：<https://github.com/issue-orchestrator/issue-orchestrator>
- AionUi：<https://github.com/iOfficeAI/AionUi>
- AionCore：<https://github.com/iOfficeAI/AionCore>
- Claude Dynamic Workflows：<https://code.claude.com/docs/en/workflows>
- Parking Agents：<https://github.com/parkth1026/parking-agents>
