# Fact: Role / Skill / Workflow / Carrier 调度拓扑候选

- 派遣问题：在 Q1～Q35 已定边界下，重新区分责任合同、能力包、状态机与运行载体，并为 `workflow-story-map` 给出 skill-centric、role-centric、hybrid 三种完整候选；不替用户裁决。
- 完成：2026-08-30T17:45:00+08:00
- 调查性质：只读证据调查与候选架构推演。本文只新增候选，不修改已确认决定、manifest、rounds、context 或产品代码。

## 一句话澄清

“多 Agent 系统应该调用 Role 而不是 Skill”只对了一半。更精确的运行句子是：

```text
Workflow 调度 RoleAssignment
  -> Core/Router 校验角色所需保证并选择 Carrier
  -> Adapter 在该 Carrier 上创建或恢复 AgentInstance / harness / human request
  -> AgentInstance 在 Role 授权范围内调用 Skill
  -> Adapter 回传 event / receipt
  -> Core 校验并确定性投影 Gate 与下一状态
```

因此，**Role 是“由谁负责、有什么权力、必须交什么”的合同；Skill 是该执行者“怎么做”的方法包**。Role 不是可直接运行的函数，Skill 也不能凭自身名称获得独立身份、merge 权或 Acceptance/Waiver 授权。现有仓库已经证明 carrier 名称本身不等于保证：fresh-context QA subagent 只有上下文隔离且循环轮不产 durable receipt；Desktop Task 才有侧边栏、thread、租约与 registry 身份；durable receipt 又绑定 job/attempt/subject，而不是 Agent 名称。见 `1-interview/facts/agent-isolation.md:10-26`。

## 六个必须正交的概念

| 概念 | 回答的问题 | 应持有 | 不应被误当成 |
| --- | --- | --- | --- |
| **Role** | 谁对哪个 subject 负责，拥有什么 authority，交什么 terminal/receipt？ | charter、输入上下文、允许副作用、actor-separation、停止条件、receipt schema、禁区 | Skill 名称或 session 名称 |
| **Skill** | Agent 用什么可复用方法完成局部工作？ | instructions、引用、脚本、局部输入输出与方法论 | 持久身份、授权、租约或全局 lifecycle |
| **Workflow** | 哪些状态可恢复推进，何时重试/回退/终止？ | state machine、attempt、budget、transition、stage gate、reconcile | 一串固定 Skill 调用或一个 Agent |
| **Carrier** | 工作实际跑在哪里？ | `main`、`subagent`、独立 Desktop `Task`、多 Agent `team`、deterministic `harness`、`human` | Role 或证据可信度 |
| **AgentInstance** | 这次是谁在跑？ | session/thread/actor identity、role assignment、subject、attempt、允许 Skill、context projection | 跨尝试稳定的 WorkTicket 身份 |
| **Core / Adapter** | 什么必须确定性判定；怎样接外部系统？ | Core 做 schema/digest/auth/reducer/Gate；Adapter 做 tracker/board/carrier/人工翻译 | 让 LLM/transport 直接写 Gate |

分类依据不是文档长度，而是“谁拥有状态推进”：现有调查已经把用户入口 workflow、阶段 workflow、原子能力、adapter 与 deterministic core 分开，见 `1-interview/facts/skill-composition-chain.md:36-46`。`workflow-interview` 自己只编排阶段，不产文件；阶段 Skill 才产物，且 manifest 只由脚本推进，见 `skills/workflow/workflow-interview/SKILL.md:11-20,35-55`。

### Team 不是新的 Role

`team` 是复合 Carrier：多个 AgentInstance 各自带 RoleAssignment，由一个显式 fan-in owner 聚合。它只适合“同一固定 subject 上有两个以上可并行、写面不冲突、结果有 typed fan-in”的工作，例如：

- Discovery 的互不依赖事实分片；现有 `aes-interview` 要求每个 subagent 只写独立 facts 文件并由宿主汇总，见 `skills/workflow/aes-interview/SKILL.md:32-39`；
- code review 的 Standards / Spec 双轴；现有 `code-review` 明确用两个并行 subagent、分轴聚合且不互相重排，见 `skills/matt-skills/engineering/code-review/SKILL.md:3-11,58-78`。

不能把一个 team 整体授予 merge 或 waiver 权；权力仍落到具体 RoleAssignment/actor。串行 integration 写入、单一用户裁决、同一文件并发修改都不应路由为 team。

## 已定边界对三候选的共同约束

1. `workflow-story-map` 仍是薄的用户入口 workflow；Core 只经 typed `ExecutionAdapter` 交换 dispatch/control 与 attempt/evidence 事件，见 `1-interview/context.md:100-112`。
2. Delivery DAG 声明的是角色所需的 context isolation、actor separation、durability、visibility、retry 与 receipt capability；Router 选择并持久记录 carrier 和理由，不能按 `subagent`/`Task` 名字猜保证，见 `1-interview/context.md:118-123` 与 `1-interview/rounds.jsonl:29`（Q27）。
3. Gate 由 Core 从 Profile + typed receipts 重算；Agent、Skill、Adapter 和人只能发布 receipt，不能直接写 Gate，见 `1-interview/context.md:116-125`。
4. Review/Acceptance 默认是 Gate；只有具备独立 owner/context/blocking/retry 或跨票覆盖时才晋升 WorkTicket/Workflow，见 `1-interview/context.md:112-115`。
5. candidate/integration/contract/artifact subject 变化后旧 receipt stale；最终代码交付必须在目标 integration SHA 运行 full suite，见 `1-interview/context.md:123-125`。
6. 主 Agent 的对话不是恢复真源。现有 board 只凭 registry/inbox/receipts/Git reconcile，见 `skills/workflow/aes-worktree-board/SKILL.md:482-496`。

## 候选一：Skill-centric Orchestrator

### 结构

```text
main Agent + workflow-story-map Skill
  -> 根据阶段直接调用 workflow/atomic Skill
  -> 需要隔离或并行时临时 spawn subagent / team
  -> 需要长时可见执行时创建 Task
  -> harness 跑命令，main 汇总结果并调用 Core
```

Role 只作为 Skill 调用时的 prompt 标签和 receipt 字段；主 Agent 掌握大部分路由与 fan-in。它最接近当前 `v2-skill-chain` 的直观“Skill 调用链”。

### 角色—载体矩阵

| DAG 节点 | Role 合同 | 主要 Skill / Workflow | Carrier 与 AgentInstance |
| --- | --- | --- | --- |
| Discovery | DiscoveryCoordinator；用户裁决、阶段门禁 | `workflow-interview` → `aes-interview` / `aes-prototype` / `aes-goal-contract` | **main**；互不依赖事实用短时 **subagent team** |
| Delivery | TicketOwner；一票一 attempt，不能 merge/改 AC | `aes-issue-worker` → `tdd`/`diagnosing-bugs`/`aes-qa`/`simplify` | 长任务为独立 **Task**；小任务可由 main 直接调用 |
| QA | Validator；如实覆盖、不能自证或代答人工 | `aes-qa` + tests | fresh-context **subagent** 解释；**harness** 执行命令；human item 交 **human** |
| Review | Standards/Spec Reviewer；只读 fixed subject | `code-review` | 两轴 **subagent team**，main 或 merge caller 聚合 |
| Merge | IntegrationOwner；串行 merge、full suite、close | 待建 `aes-merge-worker` | **main** 持 merge 权，调用 Git/test **harness**；当前缺 Skill 时会退化为 prose |
| Acceptance | AcceptanceObserver / authorized Approver | checklist / live runner；无单一现有 Skill | 可自动项走 **harness**；主观/授权项走 **human**，由 main 收取 |
| ChangeClassifier | ScopeClassifier；只输出 closed-set classification | 待建 `ChangeClassifier` Skill | **main** 调用；事实不清时可派 **subagent**，无法分类交 human |
| Router | CarrierSelector；解释 capability match | 待建 Router 模块 | **main** 做语义选择，**harness/Core** 校验 capability 声明与落账 |

### 适用判据

- 同时活跃 WorkTicket 少、Story 短；
- 用户希望一个主会话保持全部交互；
- 大多数节点是短时、只读、可重算工作；
- 对侧边栏可见、独立重试和 actor separation 的要求少；
- 首要目标是最低调度开销和复用现有 Skill。

### 主要失败模式

1. **Skill 名称冒充 Role/authority。** `aes-qa` 被调用了不等于 producer 独立；`code-review` 被调用了也不证明 reviewer 与 executor actor 分离。
2. **main 重新上下文爆炸。** 所有 dispatch、fan-in、ChangeClassifier、Merge 与用户交互都汇入一个会话，违背本 Story 首要目标。
3. **恢复弱。** subagent 不具备仓库定义的持久 identity/lease/recovery；main 回合结束后 `wait_threads` 也不持续，见 `docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md:218-251`。
4. **merge provenance 过度集中。** main 同时路由、解释 QA、聚合 review、执行 merge，容易形成事实上的万能 actor。
5. **fixed chain 过跑。** 若把 Skill 链写死，每张票都会被迫跑不需要的 research/prototype/review，而 Profile DAG 本应只声明必需角色；现有调查已指出不能把所有 Skill 串成固定线性链，见 `1-interview/facts/skill-composition-chain.md:185-189`。

## 候选二：Role-centric Multi-Agent System

### 结构

```text
Story Workflow
  -> 为每个重要 DAG node 创建 RoleAssignment
  -> 默认分配独立 AgentInstance / Task
  -> 每个 Role 自主选择其 allowlist Skill
  -> Role terminal / receipt 进入 registry
  -> Core fan-in，再调下一个 Role
```

Skill 被降为 Role 内部实现细节；调度器只认识 Role、subject、authority、terminal schema 和 carrier guarantee。这个候选把 “Multi-Agent = 调度角色”贯彻得最彻底。

### 角色—载体矩阵

| DAG 节点 | Role 合同 | 主要 Skill / Workflow | Carrier 与 AgentInstance |
| --- | --- | --- | --- |
| Discovery | DiscoveryLead + FactInvestigator + DecisionFacilitator + ContractAuthor | `workflow-interview` 家族、research/grilling | **main** 只作 human liaison；持久 **DiscoveryLead Task** 管阶段；事实为 **subagent/team** |
| Delivery | TicketOwner / Executor；独占 worktree writer lease | `aes-issue-worker` | 每票独立可见 **Task**；一 Task 一 issue/worktree loop |
| QA | Validator；必须与 executor actor 分离并签 typed receipt | `aes-qa` | 最终 QA 默认独立 **Task**；内部命令由 **harness**；局部循环也可开独立 QA AgentInstance |
| Review | StandardsReviewer + SpecReviewer；只读 | `code-review` | 两个独立 reviewer **Task/team**，ReviewLead fan-in |
| Merge | IntegrationOwner；唯一 integration writer、串行队列 | 待建 `aes-merge-worker` | 长寿命独立 **Integration Task** + Git/full-suite **harness** |
| Acceptance | AcceptanceVerifier；自动事实与业务授权分离 | live/checklist methods | 自动部分独立 Acceptance **Task**；授权结论必须由 **human** actor |
| ChangeClassifier | ScopeClassifier；不得改 Contract | 待建 classifier capability | 每个新发现独立短时 **Task**；uncertain terminal 回 main/human |
| Router | Orchestrator / CarrierBroker；不执行领域工作 | capability registry + matcher | 持久独立 **Orchestrator Task**，并调用 deterministic **harness/Core** |

### 适用判据

- 多 RepoLane、长时运行、频繁中断恢复；
- 每个角色都要求用户可见、可单独跟进与重试；
- 高风险/合规场景要求强 actor separation 和细 provenance；
- Task/agent 调度成本不是主要约束；
- 已具备完整 RoleRegistry、receipt envelope、inbox/fan-in 和 lease 系统。

### 主要失败模式

1. **Task 爆炸。** 简单 QA、低风险 review、一次分类也产生可见 Task，Web frontier 噪声和调度成本迅速增长；这与 Q21 的 Gate-first 决定存在张力。
2. **Role 变成大而全 Agent。** 若 allowlist、输入投影和停止条件不严，Agent 仍可能在 Role 内任意选 Skill、扩 scope 或直接改状态。
3. **Agent 间直接聊天形成第二真源。** 现有 owner/merge lane 要求零直连、一切经 registry，见 `skills/workflow/aes-issue-worker/SKILL.md:8-16`；role-centric 若允许 peer-to-peer 协商，会破坏重建。
4. **Task 名称冒充隔离。** 仓库当前只能记录 reviewer `same-session|independent|unknown`，还没有机械把独立性设为 gate；QA receipt 也缺统一 producer identity，见 `1-interview/facts/verification-topology.md:21-25`。
5. **事件 fan-in 漏消费。** 现有复盘已发生多个 Task 完成但 Orchestrator 只消费一个 wake 的事故，见 `docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md:222-234`。
6. **昂贵的失败恢复。** 每次短 finding 都跨 Task 传递，schema/receipt/重试预算不全时会比同 session 内闭环更脆。

## 候选三：Role-first / Carrier-adaptive Hybrid

### 结构

```text
Story / Stage Workflow owns durable lifecycle
  -> Profile expands each Gate into RoleRequirements
  -> deterministic Router matches required guarantees to CarrierCapabilities
  -> CarrierAdapter creates/resumes AgentInstance, harness run, or human request
  -> AgentInstance receives RoleAssignment + minimal ContextProjection + allowed Skills
  -> typed result/receipt returns through registry
  -> Core validates authority/subject/profile/revision and projects Gate
```

调度面 role-centric，执行面 skill-centric，正确性面 core-centric。是否使用 main、subagent、Task、team、harness 或 human 是每次 attempt 的路由结果，不写死在 Skill 名称里。

### 角色—载体矩阵

| DAG 节点 | Role 合同 | 主要 Skill / Workflow | 默认 Carrier；升档条件 |
| --- | --- | --- | --- |
| Discovery | DiscoveryCoordinator 持用户裁决和阶段门；FactInvestigator 只交事实 | `workflow-interview` 家族；research/grilling | **main** 保持 human dialogue；独立事实为 **subagent team**；跨会话/跨票/长时调查才升独立 **Task** |
| Delivery | TicketOwner 对一个 job/attempt/worktree 闭环负责，不能 merge | `aes-issue-worker` | 默认独立可见 **Task**；AgentInstance 内可调用 Skill 与短时 subagent；写 side effect 必须有 writer lease |
| QA | Validator 选择与影响面匹配的证据，不能把 NOT_RUN 写 PASS | `aes-qa` | 命令永远由 **harness**；工作树循环 finding 用 fresh **subagent**；Profile 要求 durable receipt/actor separation、live 环境或独立重试时升独立 **Task**；视觉不可替代项转 **human** |
| Review | Reviewer 只读固定 candidate/base，Standards 与 Spec 分轴 | `code-review` | low/medium 且短时用 merge owner 派的 **subagent team**；high/critical、跨票或长时复核升独立 reviewer **Task**；receipt 必须从 merge lane 上报 |
| Merge | IntegrationOwner 独占串行 integration writer，绑定 exact SHA/full suite | 待建 `aes-merge-worker` workflow | 独立长寿命 **Integration Task**；Git merge 与 full-suite 只走 **harness**；review 可派 subagent/Task，但 merge authority 不下放 |
| Acceptance | AcceptanceObserver 证明结果；AcceptanceApprover/HumanTester 按 Profile 授权 | checklist/live adapter | 自动可判部分走 **harness**；短时证据整理可用 **subagent**；跨票/独立 retry 才升 Acceptance **Task**；主观确认、Acceptance/Waiver 签发走 **human** |
| ChangeClassifier | ScopeClassifier 只输出 `in-current-scope/next-wave/requires-decision/uncertain` | 待建 atomic classifier | 规则可判部分由 **Core/harness**；需要语义判断时用 clean-context **subagent**；任何 `uncertain` 或改变承诺的结果回 **main + human**，不自动改 Contract |
| Router | CarrierSelector 只匹配 requirements/capabilities 并记录理由，不执行领域工作 | deterministic matcher，不应是长 prompt Skill | 正常路径为 **Core/harness**；无满足 carrier、capability 声明冲突或需要付出新外部成本时，才交 **main/human** 裁决；Router 本身不另建 Agent |

### 适用判据

- 同时存在短时事实调查、长时交付、强独立验证、确定性测试和人工授权；
- 希望保持 Q27 的“DAG 声明保证、Router 选 carrier”，又不为每个 Gate 创建 Task；
- 能为每个 RoleAssignment 固化 minimal context、subject、authority、allowed skills、expected receipt 和 retry scope；
- Core/Adapter 边界能先于具体 Agent 产品稳定下来；
- 愿意承担 Router capability registry 与 receipt 等价校验的实现成本。

### 主要失败模式

1. **Router 规则漂移。** 如果 carrier capabilities 由 prompt 自报而不是版本化声明 + preflight，系统会把不满足独立性/持久性的 subagent 错配给高风险 Role。
2. **同一 Role 多 carrier 的 receipt 不等价。** subagent、Task、harness 的 producer identity、环境和 evidence 字段必须映射到同一 envelope；当前仓库尚无统一 `producerAgentId`，见 `1-interview/facts/agent-isolation.md:21-26`。
3. **双重 owner。** `aes-worktree-board` 已是执行控制 workflow；若 Story Core 或 BoardAdapter 同时拥有 job/attempt/merge 状态，会出现两个 lifecycle 写入者。现有组合调查明确要求 Board 只能在 ExecutionAdapter 后，见 `1-interview/facts/skill-composition-chain.md:113-121`。
4. **Role/Skill allowlist 过硬或过松。** 过硬会阻止执行 Agent 选择更合适方法；过松会让 QA/Review/Classifier 越权实施或修改 Contract。
5. **Gate-first 与 Task 升档竞态。** Review/Acceptance 从 Gate 晋升 WorkTicket 时必须先冻结来源 Gate/subject，再创建 typed edge；否则同一责任可能同时由内嵌 Gate 和独立 Task 执行。
6. **Core 还不够机械。** 当前 effectiveRisk 只升 review/merge 深度，不能生成 QA 最小测试集；full suite 也只校验命令非空和 exit 0，见 `1-interview/facts/verification-topology.md:14-18,25-26`。没有补齐 GateCatalog/Profile 之前，hybrid 只能是拓扑，不是已证明正确的实现。

## 三候选横向判据

| 判据 | Skill-centric | Role-centric | Hybrid |
| --- | --- | --- | --- |
| 最少调度开销 | 强 | 弱 | 中 |
| 主窗口上下文保护 | 弱到中 | 强 | 强 |
| 用户可见独立 Task | 只在少数长任务 | 几乎所有角色 | 按 Profile/风险升档 |
| actor separation 可表达性 | 弱，易靠 prompt | 强，但 Task 名称仍需 Core 验证 | 强，RoleRequirement + carrier proof |
| 中断恢复 | main/Skill 链弱 | Task/registry 强 | 工作流/registry 强，短时节点可重算 |
| 简单 Gate 噪声 | 低 | 高 | 低到中 |
| deterministic harness 利用 | 辅助 | Role 的下属执行器 | 一等 Carrier，纯机械节点不创建 Agent |
| 多 RepoLane 扩展 | main 易成瓶颈 | Task 数量膨胀 | lane owner + adaptive carrier |
| 对现有 Skill 的复用 | 最高 | 需包进 Role runtime | 保留复用，但不让 Skill 决定 authority |
| 首要新增基础设施 | Skill router + receipts | RoleRegistry + Task lifecycle + fan-in | RoleRequirements + CapabilityRegistry + CarrierAdapters + receipts |

## Router 的选择判据（候选共有，权重未裁决）

Router 不应问“这个节点叫 QA，所以用 subagent 还是 Task”，而应匹配下面的可验证要求：

1. **authority**：是否要写 worktree、merge integration、签 Acceptance/Waiver；
2. **actor separation**：只需 clean context，还是必须不同 session / thread / human identity；
3. **durability**：结果能否丢失后重算，还是必须跨 main 会话恢复；
4. **visibility**：用户是否必须在侧边栏看见并直接跟进；
5. **duration / retry scope**：秒级单次、ticket 内循环，还是跨票/长时独立重试；
6. **context projection**：只需 AC+subject，还是需要整个 Story/RepoLane；
7. **side-effect lease**：只读、单 worktree writer、串行 integration writer；
8. **receipt capability**：能否产出 Profile 要求的 producer identity、subject digest、environment、checks、unexecuted 与授权字段；
9. **fan-in**：是否有 typed 聚合规则；没有就不能路由为 team；
10. **human boundary**：无法自动断言、不可逆动作或授权 receipt 必须路由 human，Agent 不得代答。

现有 Desktop Task 证据说明 Carrier 选择是产品语义而非命令细节：`create_thread`、subagent、headless 和脚本 dispatch 的可见性、所有权、生命周期与可追踪性不同，见 `docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md:101-117,197-215`。

## 仍需用户裁决或后续契约化的点

- 是否把 Role 定为 ProfileRegistry 的一等声明，还是另建 RoleRegistry；
- 哪些 Role 必须强制独立 actor，哪些只需 clean-context；当前仓库能记录 review 独立性但不阻断 Gate；
- final QA 在何种风险档必须独立 Task，何时 subagent + host provenance 足够；
- high/critical review 是一个独立 reviewer Task，还是 Standards/Spec 两个 Task 的 team；
- Merge 使用“每个 merge 一个 Task”还是“一条 RepoLane 一个长寿命 Integration Task”；
- Router 是完全确定性匹配，还是允许模型在多个等价 carrier 中按成本择优；
- `TicketSlicer`、`RiskVerificationPlanner`、`ChangeClassifier` 是 Skill、Role 内模块还是 deterministic core；现有调查只确认这一点尚未裁定，见 `1-interview/facts/skill-composition-chain.md:191-198`；
- `aes-merge-worker` 目前只有 charter、没有独立 `SKILL.md`，因此三候选中的 Merge 都只是设计位置，不是现有可调用能力，见 `1-interview/facts/skill-composition-chain.md:127-133,191-195`。

## 没查的

- 未验证宿主对 subagent 的隐藏持久身份、安全沙箱或跨会话恢复能力；仓库没有这些保证，不能推断。
- 未实现 RoleRegistry、CapabilityRegistry、CarrierAdapter、Router、统一 receipt 或 `aes-merge-worker`。
- 未替用户选择三种候选，也未决定任何 Router 权重、字段名或默认 carrier。
