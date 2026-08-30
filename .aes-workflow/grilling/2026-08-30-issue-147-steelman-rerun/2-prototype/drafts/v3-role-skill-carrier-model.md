<!-- draft v3 | published 2026-08-30T00:00:00+08:00
     用户意见：重新区分主 Agent、subagent、多 Agent Role 与 Skill 调用
     状态：P5/P6 详细模型保留；顶层双 Host/Surface 归属由 v4-shared-workflow-module-model.md 取代 -->

# Role-first / Carrier-adaptive 调度模型

**草稿，尚未锁定。** 本版只保留 P5/P6 的 Role/Carrier/Skill 详细拓扑；P7～P9 的共享 Workflow Module、双 Host 与共用 Web Shell 见 v4 顶层模型。

## 一句话结论

“多 Agent 系统调用 Role，不调用 Skill”只对一半。准确模型是：

```text
Workflow 调度 RoleAssignment
  → Core/Router 用 RoleRequirements 选择 Carrier
  → Adapter 创建或恢复 AgentInstance / harness / human request
  → 若 Carrier 是 Agent，Agent 在 Role 授权内调用一个或多个 Skill
  → Adapter 回传 finding / event / receipt
  → Core 校验 authority、subject、policy 与 provenance，再投影 Gate
```

因此：**调度面 role-first，执行面 skill-enabled，正确性面 core-enforced。**

## 六个正交概念

| 概念 | 回答的问题 | 权威内容 | 不能冒充 |
| --- | --- | --- | --- |
| Role | 谁对哪个 subject 负责、有什么权力、交什么 terminal/receipt | objective、authority、mutation scope、actor separation、停止条件、receipt authority、禁区 | Skill 名、session 名、模型名 |
| Skill | Agent 用什么可复用方法完成局部工作 | instructions、脚本、局部输入输出、procedure version/digest | actor、lease、独立性、Gate 通过权 |
| Workflow | 哪些状态跨中断推进、何时重试/回退/终止 | Role DAG、attempt、budget、transition、reconcile | 固定 Skill 调用串或单个 Agent |
| Carrier | 这次实际在哪里执行 Role | main、subagent、独立 Task、team、harness、human | Role、权限或证据可信度 |
| AgentInstance | 这一次是谁在跑 | actor/session/thread、RoleAssignment、attempt、ContextProjection、SkillBinding | WorkTicket 的稳定业务身份 |
| Core / Adapter | 什么必须确定性裁决；怎样接外部系统 | Core：schema/digest/auth/Gate/reducer；Adapter：tracker/carrier/人工翻译 | LLM 或 transport 直接写 Gate |

### Host Agent role 与 Workflow role 不同

- Host role（如 architect、executor、reviewer）是宿主的模型/提示配置，只是 Carrier capability 的一部分。
- Workflow role（如 `TicketExecutor`、`QAValidator`、`IntegrationOwner`）是持久领域责任合同。
- Router 可以为 `QAValidator` 选择 host `code-reviewer`、普通 subagent 或独立 Task，但 host role 名不能自动取得 QaReceipt 权限。

## 两张图而不是一张混合链

### Domain / Accountability DAG

决定“Story 做完以前必须由谁负责什么”：

```text
StoryOrchestrator
├─ DiscoveryCoordinator
│  ├─ FactInvestigator
│  ├─ DecisionFacilitator
│  ├─ ContractAuthor
│  └─ TicketPlanner / RiskPlanner
├─ TicketExecutor ──────────────> CandidateReceipt
├─ QAValidator ──verifies───────> Candidate
├─ Reviewer ─────verifies───────> Candidate + Contract
├─ IntegrationOwner ────────────> IntegrationReceipt + FullSuiteReceipt
├─ AcceptanceObserver ──────────> Automated / Live evidence
├─ HumanTester / RiskApprover ──> Human / Waiver Receipt
└─ ScopeClassifier ─────────────> next-wave / requires-decision / uncertain
```

### Runtime / Invocation Graph

决定“这一次怎样执行某个 Role”：

```text
RoleAssignment(QAValidator)
├─ subject = candidate c3
├─ requirements = fresh + read-only + actor-separated + receipt-required
├─ selected carrier = subagent | desktop-task
├─ selected host role = verifier
├─ allowed procedure = aes-qa@<digest>
├─ allowed tools = test-harness + optional live adapter
├─ max delegation depth = 0
└─ output = finding | QaReceipt（由 mode/Profile 决定）
```

Story/Web 默认展示 Accountability DAG；只有调查执行细节时才展开 Invocation Graph。

## RoleAssignment 最小合同候选

```json
{
  "role_instance_id": "role:qa:job-52:attempt-2",
  "role_type": "QAValidator",
  "subject": {"kind": "git-commit", "digest": "abc123"},
  "requirements": {
    "context_isolation": "fresh",
    "actor_separation_from": ["role:executor:job-52:attempt-2"],
    "mutation_scope": "read-only",
    "durability": "receipt-required",
    "visibility": "internal-ok",
    "recovery": "new-carrier-new-attempt"
  },
  "procedure_policy": {
    "required_workflow": null,
    "allowed_skills": ["aes-qa@sha256:..."],
    "allowed_tools": ["test-harness", "browser-live"],
    "max_delegation_depth": 0
  },
  "receipt_authority": ["QaReceipt"],
  "forbidden_authority": ["GateVerdict", "AcceptanceReceipt", "WaiverReceipt"]
}
```

Core 校验 RoleAssignment 和 Receipt；Skill 使用记录属于 procedure provenance，不能直接变成 GateVerdict。

## 默认 Role → Carrier → Skill 矩阵

| Role | 默认 Carrier | 何时升档/改路由 | Agent 内允许的 Skill / 方法 | 禁区 |
| --- | --- | --- | --- | --- |
| StoryOrchestrator | main Agent + deterministic Core | 主会话不可恢复时由新 main 从持久真源接管 | `workflow-story-map` | 不实现、不自审、不 merge、不直接写 Gate |
| DiscoveryCoordinator | main Agent | 跨会话、跨票、长时独立阶段才升持久 Task | `workflow-interview` | 不把用户裁决委托给 subagent |
| FactInvestigator | bounded subagent team | 单事实不并行；长时/跨票才升 Task | `research`、`best-practice-research`、`analyze` | 只写独立事实分片，不决策、不写真源 |
| TicketPlanner / RiskPlanner | internal agent module + Core validation | 计划规模过大时可用 subagent proposals；持久写仍由 Core | tracer-bullet/risk planning runbook | 不直接建票、不能降低验证下限 |
| TicketExecutor | 独立 Desktop Task / Agent | 只有短小、无恢复、无 writer lease 的内部工作才可由 main | `aes-issue-worker`，内部 `tdd` 或 `diagnosing-bugs`、`simplify` | 不 merge、不签自身 review/QA、不得改 Contract |
| QAValidator（loop） | fresh-context subagent + harness | 需要 durable receipt、独立 retry、live 环境或用户可见时升 Task | `aes-qa` loop mode | 只出 finding；NOT_RUN 不得 PASS |
| QAValidator（final） | Profile 决定：受控 subagent 或独立 Task；命令走 harness | high/critical、跨票、长时、强 actor separation 默认 Task | `aes-qa` final mode | executor 不能自签；旧 subject receipt stale |
| Reviewer | low/medium：merge owner 派 subagent team；high/critical：独立 Task | 跨票、长时、需独立 retry/用户跟进则 Task | `code-review`（Standards/Spec 双轴） | 只读 fixed subject；被审 executor 不能上报 PASS |
| IntegrationOwner | 独立长寿命 Integration Task；Git/test 走 harness | 每个 RepoLane 一条串行 integration lease | `aes-merge-worker` workflow；内部可派 reviewer | merge authority 不下放、不并行写 integration |
| AcceptanceObserver | deterministic harness；短时材料整理可 subagent | 跨票/独立 retry 才升 Acceptance Task | live/checklist preparation | 自动证据不能签 Human/Acceptance/Waiver |
| HumanTester / RiskApprover | human | 不降级为 Agent | Agent 只能生成 checklist 与环境说明 | 必须按 Receipt 类型授权，Agent 不得代签 |
| ScopeClassifier | 规则部分 Core/harness；语义部分 clean subagent | `uncertain` 或改变承诺必须回 main + human | classification runbook | 不得修改 Contract 或自行扩 Scope |
| CarrierSelector | deterministic Router/Core | 无满足 carrier、capability 冲突或需要新成本时才问 human | 无长 prompt Skill | 不执行领域工作，不另建 Agent |

## Subagent 到底能不能调用 Skill

**能。** 但前提是先拿到一个明确 RoleAssignment。Skill 可用性只表示它能遵循方法，不表示它自动拥有：

- tracker/registry 写权；
- writer 或 integration lease；
- authoritative receipt 权；
- 用户可见、持久身份或跨会话恢复；
- 安全沙箱或 actor separation。

正确例子：`FactInvestigator` subagent 调 `research`，只写 facts；`Reviewer` subagent 调 `code-review`，只回 findings，由 merge lane 按 policy 上报 receipt。

错误例子：executor 自己 spawn “QA subagent”，没有独立 actor/subject binding，却让它直接把 Gate 写成 passed。

## 一个 Agent 能不能承担多个 Role

可以顺序承担不冲突的 Role，但每次 role activation 必须有独立 `roleInstanceId`、authority、输入输出与开始/结束边界。

默认禁止：

- executor + 自己 candidate 的 authoritative QA/review；
- executor + IntegrationOwner；
- 任意 Agent + HumanTester/BusinessAcceptor/RiskApprover；
- 同一 Agent 同时持有两个会写同一 repo/integration target 的 lease。

换一个 Skill 名不能解除冲突；必须换 carrier，或建立 Core 能验证的新 actor/隔离域。

## 一个 Role 能不能调用多个 Skill

这是常态。Role 定 outcome/authority，Skill 定 procedure：

- `TicketExecutor` 可按问题选择 `tdd` 或 `diagnosing-bugs`，之后 `simplify`；
- `Reviewer` 用 `code-review`，该 Skill 内部还可分 Standards/Spec 子角色；
- `QAValidator` 用 `aes-qa`，但 loop/final/regression mode 的 receipt authority 不同。

边界是：**允许动态选方法，不允许动态改治理。** Risk 下限、receipt schema、actor separation、manual/non-waivable Gate、side-effect scope 与 integration target 必须来自 Profile/Contract/Core。

## Multi-agent team 的边界

Team 是复合 Carrier，不是 Role，也不是 Skill。只有以下条件全满足才允许：

1. 至少两个 RoleAssignment 真正可并行；
2. 写面不重叠；
3. 每个 child 有独立 subject/output；
4. 存在 typed fan-in owner 与聚合规则；
5. delegation depth、并发与预算有上限。

适合：互不依赖的 facts、Standards/Spec 双轴 review、互不重叠的 RepoLane 实现。

不适合：串行 merge、单一用户裁决、Waiver 权限、同一文件并发写入。

## 对 v2 Skill 图的处置

`v2-skill-chain.md` 不应继续作为唯一调用链事实源。它保留“哪些能力存在”的 inventory 价值，但以下箭头必须拆分：

- 同一 Agent 内 procedure 调用；
- 创建新 RoleAssignment；
- Router 选择 Carrier；
- Adapter dispatch；
- Receipt 回 Core；
- deterministic state transition。

任何箭头若不能回答“是否产生新 actor、权限/lease 是否变化、输出是 finding 还是 authoritative receipt、怎样恢复”，就还不能交给实现 Agent。

## P5 已裁决：Role-first，Carrier 按风险晚绑定

用户确认：同一个逻辑 Role（例如 `QAValidator`）允许在不同 Profile/风险下，由 harness、fresh subagent 或独立 Desktop Task 分别承担，同时保持相同的 Receipt 契约与 Gate 规则。

- 小而低风险：执行会话完成实现后，另派 fresh subagent 原地做 QA。
- 改动广、高风险、长时或要求更强隔离/恢复：派独立 Desktop Task/专职 Agent 做严格 QA。
- Router 不只看改动行数；它还必须考虑 blast radius、跨仓/跨票范围、测试强度、执行时长、actor separation、live/manual 环境与恢复要求。
- 低风险只允许降低 Carrier 成本，不允许降低 Profile 的验证下限；实现者仍不得以同一 actor 身份签发要求独立性的最终 QaReceipt。

由于并行 Web 原型 session 已占用 P3/P4，该裁决以 `round: 40`、`q_id: P5` 持久化。

## P6 已裁决：unknown 三分流，不做递归“最强 Task”升级

用户接受：Router 必须先判断“不确定的是什么”，再选择能够真正消除该不确定性的恢复路径。

| unknown 类型 | 固定处理 | 明确禁止 |
| --- | --- | --- |
| Contract/scope/公共行为/数据或权限边界语义未知 | `requires-decision`，暂停受影响线路并回流 Discovery | 用更多测试或更强 Agent 代替用户承诺裁决 |
| Capability、live 环境、授权 human、producer proof 未证明或缺失 | 未证明即不具备；排除该 Carrier。无满足者时进入 `BLOCKED_NO_CARRIER` / degraded，并写恢复条件 | 相信 Carrier/Skill/host role 自报，或递归创建 Task |
| Contract 明确，但 risk/impact 上界未知 | 取可信上界，单调增加 `effectiveRequirements`；从满足全部 hard requirements 的候选中选择最小充分 Carrier | 把 unknown 重写成 low，或删除规划验证下限 |
| 多个 Carrier 都满足，仅成本/速度不同 | 按版本化 deterministic tie-break 自动选择并持久化淘汰理由 | 占用用户决策问题或由模型自由漂移 |
| 满足者超出已授权预算 | 排队或等待资源授权 | 因预算改用不满足 requirements 的 Carrier |

Carrier 不是单轴强度梯子：`harness`、`fresh subagent`、`Desktop Task`、`team` 与 `human` 分别提供不同 capability。Router 先做 hard requirement filter，再在合格集合中按最小 authority/副作用、机械工作优先 harness、恢复已有 owner、启动成本与稳定 ID 做确定性择优。

RouteDecision 必须持久化 canonical inputs、Profile/Role/policy digest、subject、capability proofs、rejected candidates 与原因、selected Carrier、preflight digest 和预算快照。模型可提出风险 trigger 或 advisory reason，但不能降档、改 authority 或直接写 Gate。

由于并行 Web 线程先追加了 `WEB-P5 round:41` 与 `WEB-P6 round:42`，P6 的物理追加记录保留为第 46 行 `round:41 / q_id:P6`；不得直接重写 `rounds.jsonl`。
