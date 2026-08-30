# Analysis candidate: 多 Agent、Agent 角色与 Skill 的责任边界

- 派遣问题：对命题“多 Agent 系统应该调用 Agent 角色，而不是调用 Skill”做双向最强论证与反例审计；覆盖事实探索、实现、QA、review、merge、human acceptance、deterministic harness、恢复/重试，以及一 Agent 多角色、一角色多 Skill、角色内动态选 Skill、subagent 调 Skill。
- 完成：2026-08-30T17:36:00+08:00
- 性质：只读架构分析候选；不替用户裁决，不修改已确认语义或 v2 原型。

## 先拆开四个经常被混成一个的概念

| 概念 | 回答的问题 | 必须承载 | 不能据此推断 |
| --- | --- | --- | --- |
| **Role / 角色位** | 谁对哪一段结果负责、拥有什么权限、不得兼任什么 | objective、输入/输出、权限、mutation scope、independence/actor separation、lease、终止条件、可签 receipt 类型 | 使用哪个模型、在哪个 session、一定调用哪个 Skill |
| **Carrier / 运行载体** | 这次由什么实际执行角色位 | main Agent、subagent、独立 Desktop Task、human、deterministic harness；具体 actor/session/process identity | 仅凭“subagent”就有只读、安全沙箱、持久性或独立审查资格 |
| **Skill / 能力程序** | 承担角色的 Agent 用什么可复用方法做事 | procedure、工具使用方法、局部输入输出、停止条件；可有版本/digest | actor 身份、工作项所有权、lease、授权、Gate 通过权 |
| **Workflow / Durable Core** | 跨步骤、跨中断怎样推进与重建 | Role DAG、attempt ledger、typed messages、receipt validation、reducer/reconcile | prompt 或对话记忆可以替代状态真源 |

因此“调用角色”和“调用 Skill”不是同一层的替代品。更精确的候选表达是：

> **编排边界分派 RoleAssignment；RoleAssignment 选择满足要求的 carrier；若 carrier 是 Agent，它在授权范围内调用一个或多个 Skill/工具；若 carrier 是 human 或 deterministic harness，则根本不必调用 Skill。**

这与已经记录的 Q27 并不冲突：现有决定要求 DAG 声明上下文隔离、actor separation、持久性、可见性、重试范围与 receipt capability，再由 Router 选择 harness/subagent/独立 Agent/Task/human carrier；不能从载体名字推断保证（`1-interview/context.md:22,122,160`）。本轮新增的问题是：选中 Agent carrier 后，Skill 如何被授权、组合、动态选择并留下可重建 provenance。

## 支持命题的最强论证：总控必须“派角色”，不能裸调 Skill

对 `workflow-story-map` 这种多票、多 RepoLane、可恢复系统，外层若直接表达 `call aes-qa`、`call code-review`，只描述了方法，没有描述谁在什么隔离边界下做、能改什么、能签什么、失败后由谁恢复。具体会出现四类结构性漏洞：

1. **权限混乱**：同一 owner Agent 已有 writer lease，再调用 `code-review`，并不会自动失去写权限；Skill 名字不是 capability sandbox。
2. **自证**：executor 在本 session 调 `aes-qa` 或 `code-review`，即使输出格式正确，也没有证明 actor separation。现有 `aes-issue-worker` 特意用 fresh-context 只读 subagent 跑 QA（`skills/workflow/aes-issue-worker/SKILL.md:52-58`），board 又要求 review receipt 从 merge-worker 侧上报，不能由被审 worker 自报 PASS（`skills/workflow/aes-worktree-board/SKILL.md:453-480`）。
3. **恢复不可判**：Skill 调用失败后，没有稳定 role instance、attempt、carrier identity、lease 和 receipt authority，无法判断是继续原 session、重试本步骤，还是新建 attempt。
4. **审计不可重建**：只记“调用了 aes-qa”不能证明用的是哪个版本、拿了哪个 subject、跑了哪些 harness，也不能解释为何选 subagent 而非独立 Task。

在这类系统里，外层应该持久化“分配 `QA-validator` 角色，要求 fresh context、read-only、subject=commit X、可发布 QaReceipt、不能发布 GateVerdict”，而不是只持久化“调用 aes-qa”。Skill 是该角色的默认实现方法，不是角色本身。

## 反对命题的最强论证：把“只调用角色”绝对化同样错误

角色只是责任和授权槽，不能告诉执行者怎样把事做好。若总控只创建“实现 Agent”“审查 Agent”，却不把经过验证的 Skill、Profile 和输入输出合同交给它们，会把过程重新交给模型临场发挥：

1. **同角色需要多个方法**：实现角色常按问题性质选择 `tdd` 或 `diagnosing-bugs`，之后调用 `simplify`；review 角色调用 `code-review`，而该 Skill 内部又把 Standards 与 Spec 分成两个 fresh subagent（`skills/matt-skills/engineering/code-review/SKILL.md:3,11,58`）。一个角色不等于一个 Skill。
2. **同 Skill 可服务不同角色或阶段**：`aes-qa` 同时有循环 finding、最终 SHA-bound receipt、打回后回归三种形态（`skills/workflow/aes-qa/SKILL.md:13-25`）；它不能仅凭名字决定本次有没有 receipt authority。
3. **不是所有 DAG 节点都应创建 Agent**：v2 已举出简单自动检查直接走 deterministic harness、不创建 Agent 的场景（`2-prototype/drafts/v2-orchestration-example.md:89-104`）；HumanTest/Acceptance/Waiver 的最终 actor 又必须是 human，Agent 只能备料，不能代答（`skills/workflow/aes-qa/SKILL.md:29-38`；`skills/workflow/aes-worktree-board/SKILL.md:500-503`）。
4. **为每个小能力都建角色 Agent 会制造上下文与编排爆炸**：`simplify` 自身还会并行三个 review subagent；`code-review` 会再开两个。如果外层再把每个 Skill 固定包装成独立 Agent，会形成无上限嵌套、并发预算争抢和 provenance 树膨胀。

所以“多 Agent 系统不调用 Skill，只调用 Agent 角色”若被理解为“Skill 不再是一等能力合同”或“每个角色对应一个固定 Agent 包”，会丢失复用、评测、版本约束和低成本本地调用。

## Crux 与可翻转变量

**Crux 候选：Gate 相关的权限、独立性、生命周期和 receipt provenance，能否仅由 Skill 调用可靠表达并由 Core 机械验证？**

- 若能：Skill-first + 强元数据可以成立，单独的 RoleAssignment 层可能只是重复抽象。
- 若不能：外层必须 role-first；Skill 只能作为角色内部、受约束且可替换的 procedure。

当前仓库证据明显显示“不能仅靠 Skill 名称”：`aes-worktree-board` 同时存在独立 reviewer Desktop Task 与 review subagent 两种 carrier，而真正防自证的是 owner/context/provenance 规则；仓库也明确没有通用 subagent 的持久身份、安全沙箱或恢复保证（`1-interview/facts/agent-isolation.md`）。但这只支持“role-first 外层”，不支持“角色内部不再调用 Skill”。

最可能翻转具体拓扑的变量：

1. **该节点是否能发布 Gate-relevant receipt**：能 → 必须有 RoleAssignment、actor 与 subject binding；只出临时 finding → 可使用轻量 subagent。
2. **是否需要 actor separation / context isolation**：需要 → 不能由同一 active role 通过换 Skill 名字伪装独立；需要新 carrier 或可机械证明的隔离域。
3. **是否持有 mutation/merge/secret 权限**：越高 → 越需要独立 role、least privilege、lease 和可恢复 Task；不能只靠 prompt 说“只读”。
4. **执行是否超过主回合寿命、是否需要用户可见/可追踪**：是 → 独立 Task/Agent 更合适；一次性事实分片或内部 finding → subagent 更合适。
5. **步骤是否同输入同输出且无需语义判断**：是 → harness/Core，不创建 Agent，也不需要 Skill 扮演 actor。
6. **Skill 选择是否改变 receipt schema、测试下限或 Gate policy**：改变 → 必须在 Profile/RolePlan 中提前锁定；不改变 → 角色内可动态选择并记录理由。

## 九类场景反例审计

| 场景 | 外层应分派什么 | 合理 carrier | 角色内部 Skill/工具 | 关键禁区 |
| --- | --- | --- | --- | --- |
| **事实探索** | `FactInvestigator`，限定一个问题、只读范围、事实 artifact | 两个以上独立问题时可用 bounded subagent；主 Agent 同时保留聚合与提问权 | `research` / `best-practice-research` / `analyze` 或直接只读工具 | subagent 不替用户裁决、不改 tracker/context；研究结论不是用户决定；不能把 prompt 泄漏当独立证据 |
| **实现** | `IssueExecutor`，持 typed WorkOrder、writer lease、exact checkout、AC、预算 | 通常独立 Task/Agent；短小且无需恢复的内部模块才可能由主 Agent 承担 | `tdd` 或 `diagnosing-bugs`，按需 `codebase-design`，末尾 `simplify` | executor 不得 merge、签 review PASS、签 Human Receipt 或改 Contract；Skill 动态选择不能扩大 side effects |
| **QA** | `QAValidator`，明确 loop/final/regression mode、subject、independence 和可签 receipt | loop finding 可 fresh subagent；最终 durable QA 若要求可追踪/恢复，应用独立 Task，或至少有稳定 actor/attempt identity 的受控 subagent | `aes-qa` + harness/live adapters | 同一 executor session 调用 Skill 不能自动获得独立 QA 身份；`NOT_RUN` 永不 PASS；人工项不能由 Agent 完成 |
| **Code review** | `Reviewer`，只读、固定 base/head、Standards/Spec axes、receipt/finding 权限 | 可是 fresh subagent，也可是独立 reviewer Task；由 Profile 的独立性、持久性和用户可见性决定 | `code-review`；其内部可再分 Standards/Spec 子角色 | 被审 executor 不能上报权威 review PASS；避免外层 reviewer + Skill 内双 subagent 无预算嵌套；reviewer 不修改候选 |
| **Merge / integration** | `IntegrationOwner` / `MergeWorker`，独占 integration lease、串行 merge、exact-SHA full suite、打回权 | 专职独立 Agent/Task 最自然；主 Agent 只有在明确承担该角色且从未兼任被审 executor 时才是候选 | `aes-merge-worker` workflow（待建）+ `code-review` 子角色 + deterministic git/test harness | 不并行写 integration；不能把 review/QA stale receipt 结转；merge transport 成功不等于 integration Gate PASS |
| **Human acceptance** | `HumanTester` / `BusinessAcceptor` / `RiskApprover`，按 Receipt 类型分别授权 | human；Web/adapter 只是输入载体 | Agent 可用 Skill 生成 checklist/环境说明，但不能替人签 | tracker 写权限不等于验收/waiver 权；不得让主 Agent 或 subagent 冒充 actor=human；撤销追加 receipt，不删历史 |
| **Deterministic harness** | 不是 Agent 角色，宜建 `HarnessExecution` capability step；若需要审计可有 machine actor | process/module/CI runner | 命令、测试 runner、schema validator；通常不“调用 Skill” | LLM 不解释 exit code 为 PASS；必须记录 command、exit、environment、subject；harness 也不能自行写 Story done |
| **恢复 / 重试** | Core 恢复稳定 role instance/job，重试产生新 role attempt；重新路由 carrier | 原 carrier 可恢复则继续；否则新 Agent/Task 接新 attempt | 重新装载绑定版本的 role policy/Skill bundle；旧 receipt 保留且按 subject 判 stale | 不以对话记忆为真源；不原地覆盖旧 attempt；不能因换 carrier 继承未经重验的证据 |
| **主 Agent / 总控** | `StoryOrchestrator`，只负责 reconcile、frontier、RoleAssignment、fan-out/fan-in、用户交互 | 主 Agent + deterministic Core | `workflow-story-map` orchestration Skill；不得吸收深实现 Skill | 主 Agent 若同时实现、QA、review、merge，会成为万能 actor，破坏最小权限、独立性和上下文预算 |

## 组合关系的具体答案候选

### 1. 一个 Agent 能否承担多个角色？

**可以，但不能把 Agent identity 与 Role identity 合并。** 同一 Agent 可以顺序承担多个不冲突、低权限或非 Gate 角色，例如主 Agent 先做事实聚合，再做用户问题呈现；也可以在一个 issue owner session 内承担 implementer 和局部 coordinator。必须为每次 role activation 记录 `roleInstanceId`、允许能力、输出类型和开始/结束边界。

以下组合应默认禁止或要求 Profile 明示：

- executor + 其自身 candidate 的 authoritative QA/review；
- executor + integration merge owner；
- 任意 Agent + HumanTest/Acceptance/Waiver actor；
- 同时持有两个会写同一 repo/integration target 的 role lease。

“换一个 Skill”不能解除这些冲突；需要换 carrier，或至少建立可机械验证的新隔离/actor 域。

### 2. 一个角色能否调用多个 Skills？

**这是常态。** Role 定义 outcome/authority，Skill 定义 procedure。`IssueExecutor` 已经是 `tdd|diagnosing-bugs → aes-qa loop → simplify → aes-qa final` 的组合器（`skills/workflow/aes-issue-worker/SKILL.md:40-86`）；因此“一个角色 = 一个 Skill”会与现有真实流程冲突。

但要区分两类调用：

- **同角色内部 procedure**：如 executor 在 `tdd` 与 `diagnosing-bugs` 之间选择；不会生成新 actor，不改变权限。
- **向新角色委派**：如 executor 请求 fresh `QAValidator`、merge-worker 请求 `Reviewer`；这不是普通函数调用，必须新建 RoleAssignment/child role attempt，并记录 provenance。

### 3. 角色内能否动态选择 Skill？

可采用“**允许动态选方法，不允许动态改治理**”的边界：

- 可动态：在 declared allowlist 中选择 `tdd` 或 `diagnosing-bugs`、选择局部搜索工具、选择等价的测试 runner；记录 skill id/version/digest 与 routing reason。
- 不可动态：改变风险下限、receipt 类型、actor separation、manual/non-waivable Gate、side-effect scope、integration target；这些必须来自 Profile/Contract/Core。
- 若 Skill 会再 spawn 子 agent（例如 `code-review`、`simplify`），它必须声明 delegation shape、最大深度、并发/预算和 child output 类型，不能把隐藏的 subagent 树当内部实现细节。

### 4. Subagent 能否调用 Skill？

**技术上和架构上都可以，但必须先被分配一个明确角色位。** “subagent 能看到 Skill”只代表 procedure 可用，不代表它有：

- 写 tracker/registry 的权力；
- writer 或 integration lease；
- 发布 authoritative receipt 的权力；
- 用户可见、持久身份、跨会话恢复；
- 安全沙箱或 actor separation。

合理例子：`FactInvestigator` subagent 调 `research` 后只写事实分片；`Reviewer` subagent 调 `code-review` 后只返回 findings，由 merge-worker 侧上报 receipt。危险例子：executor 自己 spawn 一个“QA subagent”，不给独立 actor/subject binding，却让它直接把 Gate 写成 passed。

## v2 调用链当前会误导执行者的地方

`v2-skill-chain.md` 已正确分出 workflow、Skill、Core/adapters，但“完整调用链”仍把它们画成同一种调用关系，例如 `Capability Router → Board → aes-issue-worker → aes-qa/simplify → aes-merge-worker → code-review`（`2-prototype/drafts/v2-skill-chain.md:19-68`）。执行者仍需猜：

1. 哪些箭头是同一 Agent 内部调用，哪些是新 RoleAssignment；
2. 哪些节点需要 fresh context、独立 actor、持久 Task、用户可见或 writer/integration lease；
3. 哪个主体能上报哪种 receipt，谁只返回 finding；
4. Skill 内部再 spawn subagent 时如何限制 delegation depth、并发和权限继承；
5. 恢复时复用的是 role instance、carrier session 还是 Skill invocation。

这不是字段名小缺口，而是需要把一张图拆成两张相互引用的图：

```text
Domain / Accountability DAG
  WorkTicket
    ├─ role: IssueExecutor ──produces──> CandidateReceipt
    ├─ role: QAValidator ────verifies──> Candidate
    ├─ role: Reviewer ───────verifies──> Candidate + Spec
    ├─ role: IntegrationOwner ─────────> IntegrationReceipt
    └─ role: HumanAcceptor ────────────> AcceptanceReceipt

Runtime / Invocation Graph for one attempt
  RoleAssignment(QAValidator)
    ├─ carrier = subagent | desktop-task
    ├─ policy = read-only + fresh-context + no tracker write
    ├─ procedure = aes-qa@<digest>
    ├─ tools = test harness + optional live adapter
    └─ output = finding | QaReceipt (由 mode/profile 决定)
```

第一张图决定“必须有哪些责任与 Gate”；第二张图解释“这一次怎么执行”。Map/Web 默认展示第一张，人类排查时再展开第二张。这样才不会把 Skill 调用树误当 Story 状态树。

## 最小协议候选（供后续原型，不是已裁决字段）

```json
{
  "roleAssignment": {
    "roleInstanceId": "role:qa:job-52:attempt-2",
    "roleType": "QAValidator",
    "subject": { "kind": "git-commit", "digest": "abc123" },
    "requirements": {
      "contextIsolation": "fresh",
      "actorSeparationFrom": ["role:executor:job-52:attempt-2"],
      "mutationScope": "read-only",
      "durability": "receipt-required",
      "visibility": "internal-ok",
      "recovery": "new-carrier-new-attempt"
    },
    "procedurePolicy": {
      "allowedSkills": ["aes-qa@sha256:..."],
      "allowedTools": ["test-harness", "browser-live"],
      "maxDelegationDepth": 0
    },
    "receiptAuthority": ["QaReceipt"],
    "forbiddenAuthority": ["GateVerdict", "AcceptanceReceipt", "WaiverReceipt"]
  }
}
```

Core 要校验的是 RoleAssignment 与 receipt envelope；Agent 是否实际用了某个 Skill 是 provenance 和 procedure compliance，不能直接成为 GateVerdict。

## 失败预演：最可能把系统做坏的五条路

1. **万能主 Agent**：总控为省事亲自实现、验证、review、merge，最后聚合自己的 receipts。表面上下文少，实际上权限、自证和 context explosion 全部集中到一个不可恢复会话。
2. **一个 Skill 一个 Agent**：每次 `tdd`、`aes-qa`、`simplify`、Standards、Spec 都创建 Task；嵌套并发与 handoff 数量超过真正工作量，parent/child provenance 难重放。
3. **只按 carrier 名称授权**：把 `subagent` 当 fresh/read-only、把 Desktop Task 当 durable/independent；实际上仓库只证明了部分语义，权限与恢复不能从名称推断。
4. **角色内无限动态 Skill**：Agent 为了过 Gate 自选更宽松 QA/旧 Profile/targeted tests；若只记录最终 receipt，新会话无法解释测试为何足够。
5. **Skill 直接写 Gate/Tracker**：adapter/Skill 既产 evidence 又改 passed/closed，Core 无法从 immutable evidence 重建，同一失败重试可能覆盖旧 attempt。

建议止损检查（仍是分析候选）：任何链路图中的箭头若无法回答“是否产生新 actor、是否改变权限/lease、输出是 finding 还是 authoritative receipt、如何恢复”，该箭头尚不具备实现可操作性。

## 可供用户继续比较的三个架构候选（不裁决）

### A. Role-first 双层图

- 总控只创建 RoleAssignment；Router 选 carrier。
- Agent carrier 在 role policy 内调用一个或多个允许的 Skill；harness/human 不走 Skill。
- Skill 可替换，Role/Gate 语义稳定。
- 代价：新增 role/assignment/procedure provenance schema，并要画两张图。

### B. Skill-first + 强 invocation envelope

- 总控仍调用 Skill，但每次调用必须携带等价于 RoleAssignment 的 actor、权限、隔离、subject、receipt authority、retry policy。
- 好处：保留现有 Skill 编排直觉。
- 代价：所谓 invocation envelope 实际已经重新发明角色层；容易在普通 Skill 调用时漏填治理字段。

### C. 固定 Agent Role Package

- 每个角色定义固定 Agent 类型与 Skill bundle，例如 `IssueExecutorAgent=[tdd,diagnose,simplify]`、`ReviewerAgent=[code-review]`。
- 好处：部署和认知最直接。
- 代价：角色与模型/session/Skill 版本强耦合；无法自然覆盖 deterministic harness、human carrier、同角色不同风险拓扑，也容易把 Skill 内 subagent 隐藏成不可控嵌套。

## 一个最高信息增益问题候选

如果后续仍需要用户裁决，最能翻转 A/B/C 的不是“subagent 能不能调用 Skill”，而是：

> **你是否要求同一个逻辑角色（例如 QAValidator）可以在不同风险/Profile 下分别由 deterministic harness、fresh subagent 或独立 Desktop Task 承担，同时保持完全相同的 Gate 语义？**

若要求，A 的 role-first / carrier-late-binding 几乎成为必要条件；若不要求，且每个角色永远固定一种 Agent + Skill bundle，C 的复杂度更低。B 只有在宿主原生 Skill invocation envelope 已经能机械承载全部角色治理字段时才有独立价值。

