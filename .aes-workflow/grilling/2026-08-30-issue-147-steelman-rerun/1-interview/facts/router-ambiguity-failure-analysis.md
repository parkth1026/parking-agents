# Fact: Router 歧义、升档与失败终态对抗审计

- 派遣问题：对当前候选“按风险晚绑定 Carrier；无法分类默认升档”做对抗性只读审计，重点检查 Task 爆炸、无限成本、死锁、主 Agent 裁量可审计性、要求冲突、无满足 Carrier 时的终态，以及如何防止模型通过改标签降档。
- 完成：2026-08-30T15:20:00+08:00
- 调查性质：事实核对、失败路径模拟与候选比较。本文不替用户选择，不修改既有决定、manifest、rounds、context、prototype 或产品代码。

## 审计结论（不构成用户裁决）

`Role-first + Carrier 晚绑定` 原则本身可以保留，但“无法分类默认升档”目前**还不是可执行规则**。它混合了三种完全不同的未知：

1. **影响/风险无法分类**：可能意味着 Contract、公共行为或权限边界发生变化；依据 Q32，应 `requires-decision`，不能只靠创建更强 Agent 消除语义未知。
2. **要求已知，但当前没有 Carrier 满足**：这是能力或外部前置条件缺失；不能把“不存在”解释成继续升级，应该进入有原因、有恢复条件的 `BLOCKED`，或在需要新增成本/改策略时进入 `requires-decision`。
3. **多个 Carrier 都满足，只是不知道选哪个更划算**：这是可由确定性成本策略或有界 tie-break 处理的路由问题，不应打断用户，也不应无上限创建 Task。

若把三者都实现成 `unknown -> higher -> higher ...`，Router 会把不确定性转化为 Task 数、人工等待和重复测试，而不增加证据确定性。当前候选需要把“升档”改写成：**对有限、版本化的 requirement 向量做单调收紧；Carrier 只在满足全部硬要求的有限候选集中选择；没有匹配时进入显式终态。**

## 已确认的仓库事实

| 事实 | 证据出处 |
| --- | --- |
| Q25 已锁定 Gate 由 Core 从 typed receipts 确定性推导；adapter/capability 只能发布 receipt，不能直接改 Gate。Router 或主 Agent 的自报结论不能成为通过依据。 | `1-interview/context.md:19`；`1-interview/rounds.jsonl:27` |
| Q26 已锁定“规划冻结验证下限，执行期只能按真实影响升档、不能由 executor 降档”；最终 Story 仍需全量回归。 | `1-interview/context.md:21`；`1-interview/rounds.jsonl:28` |
| Q27 已锁定 DAG 声明 context isolation、actor separation、durability、visibility、retry、receipt capability，Router 选 Carrier 且理由需可解释、持久记录。 | `1-interview/context.md:22`；`1-interview/rounds.jsonl:29` |
| Q32 已锁定：无法判断新发现是否改变 goal、范围、公共行为、AC、数据/权限、Profile 或 integration target 时，必须 `requires-decision` 回流 Discovery。 | `1-interview/context.md:27`；`1-interview/rounds.jsonl:34` |
| P5 只锁定同一 Role 可按 Profile/风险晚绑定 subagent、Task、harness 或 human，并保持同 Receipt/Gate 语义；它没有锁定 Router 算法或“所有未知一律创建 Task”。 | `1-interview/context.md:217-224`；`1-interview/rounds.jsonl:43` |
| 现有 `effectiveRisk` 是 `declaredRisk` 与 changed-path 规则的最大值，能留下 `triggeredRules` 且不允许路径规则把风险降级；但它只机械影响 review 深度与 merge 策略。 | `skills/workflow/aes-worktree-board/scripts/merge-policy.mjs:13-79`；`skills/workflow/aes-worktree-board/scripts/master.mjs:598-622` |
| 当前 `IssueWorkOrder` 没有传完整 `riskProfile`、test intensity、验证下限或升档触发条件，现状不能直接承载完整 Router 决策。 | `skills/workflow/aes-worktree-board/scripts/issue-contract.mjs:266-297`；`1-interview/facts/verification-topology.md:14-18` |
| 当前 QA Gate 主要校验 receipt PASS、candidate/base 绑定、NOT_RUN 与 unexecuted；尚不能把实际 diff、AC evidence class 和已执行 automated/live/manual 逐项对账。 | `skills/workflow/aes-worktree-board/scripts/merge-policy.mjs:140-175`；`1-interview/facts/verification-topology.md:19-24` |
| subagent 的优势是 fresh context 与短时隔离，但仓库没有证明其持久恢复、侧边栏可见、OS/凭据沙箱或统一 producer identity；Desktop Task 提供 thread/registry/lease/可见性，但仍不自动具备 human/live 权限。 | `1-interview/facts/agent-isolation.md:10-26` |
| `wait_threads` 不是永久监听器；独立 Task 仍依赖 registry/inbox/reconcile 才能恢复。单纯多建 Task 不能修复控制面恢复问题。 | `1-interview/facts/agent-isolation.md:27-33` |

## “更强 Carrier”不是一条总排序

Carrier 能力是向量，不是 `subagent < Task < human` 的单轴等级：

| 维度 | 可能的要求 | 反例 |
| --- | --- | --- |
| actor separation | clean context / different session / different authorized human | Desktop Task 可以提供独立 thread，但不证明不同 OS、凭据或人员身份。 |
| durability / recovery | 可重算 / receipt 持久 / 跨会话恢复 | harness 的结果可持久重放；它不必比 Agent“弱”。 |
| live/manual | 自动环境 / 真实 live 环境 / 人类观察与授权 | 独立 Task 不能替代不存在的真实环境，也不能签 Human/Waiver Receipt。 |
| authority / lease | 只读 / worktree writer / integration writer / human approval | 更高算力或更独立的 Agent 不会自动取得 merge 或 waiver 权。 |
| visibility / duration | 内部短时 / 用户可见 / 长时可恢复 | 低风险但长时的任务可因恢复要求选 Task；这不应自动提高测试语义。 |
| receipt capability | finding / scoped result / authoritative typed receipt | fresh subagent 可产 finding，但若 producer/subject/policy 字段不全，就不满足 final receipt 要求。 |

因此冲突不能用一个 `riskScore` 或“总是选更强”解决。推荐给后续候选比较的机械顺序是：

1. 先合成**不可违反的硬要求**：authority、human boundary、mutation/lease、actor separation、receipt schema/subject/provenance、Profile 明示的 live/manual、non-waivable Gate。
2. 再合成**运行保证**：durability、recovery、visibility、duration/retry scope、context projection、fan-in。
3. `effectiveRisk` 只提高验证与独立性下限；`complexity`、`duration` 可提高运行载体的持久性/预算，但不得降低或替代验证下限。
4. 仅在满足全部硬要求的 Carrier 集合中，用成本、启动延迟、当前容量等软指标择优。
5. 集合为空时停止路由；不得把同一 RoleAssignment 递归“再升一次”来掩盖无解。

## 失败路径模拟

### 1. Task 爆炸

触发链：每个未知 finding 都升独立 Task；Task 又派独立 QA/Review；candidate 更新使旧 receipt stale；每轮重新创建新 Task。一个 WorkTicket 会产生 `attempt × role × retry × review-axis` 个可见 Task。

必须具备的止损条件：

- 一个 `role_instance_id + subject_digest + policy_revision` 同时最多一个 active CarrierBinding；重复 dispatch 幂等返回既有 binding。
- `max_attempts`、`max_parallel_carriers`、`max_delegation_depth`、时间/成本预算是 Profile 或 Story 级硬上限；耗尽后进入显式终态，不继续 spawn。
- subject 变化先使旧 binding/receipt stale 并终止或归档旧 attempt，再创建新 attempt；不能新旧同时执行同一责任。
- Standards/Spec 等 team 必须有有限 fan-out 与 typed fan-in；没有聚合规则不能选择 team。
- “需要 fresh actor”不等于“每个测试命令一个 Task”；命令由同一 attempt 的 harness 执行，Role Carrier 负责解释与出 receipt。

### 2. 无限成本与过度测试

若 `unknown` 被解释为 `critical + full suite + live + manual + independent Task`，即使未知仅是 duration 估计，也会无条件消耗最昂贵资源。更严重的是，manual/live 不是 automated 的严格超集：缺少真人或真实环境时，多跑自动测试仍不能满足 Gate。

必须区分：

- **测试强度**由 Profile、AC evidence class、真实影响面和 effective risk 决定；只能单调增加 required evidence。
- **Carrier 成本/持久性**由持续时间、恢复、可见性、并发和上下文要求决定。
- 两者可能相关，但不能互相冒充。大批量低风险文档任务可选持久 Task，而不必自动增加 live/manual；三行权限改动即使短，也可能需要 high-risk 独立 QA。

### 3. 死锁

至少有四种可复现的逻辑死锁：

1. Profile 要求 authorized human receipt，但没有已授权 human；Router 不断换 Agent/Task，永远不可能满足。
2. Profile 要求 live 环境，CapabilityRegistry 没有可用环境；创建更独立的 Task 不会产生环境。
3. 风险分类依赖真实 diff，而 work 尚未执行；执行又要求先完成风险路由。若没有 planning floor + execution-time monotonic re-evaluation，会形成前置循环。
4. “无 Carrier -> 升更强 Carrier”没有最高档/终态，或最高档仍被标记 unknown，形成递归 dispatch。

修复边界：规划阶段只需要可执行的冻结下限；candidate 产生后再用 canonical diff/依赖/运行路径重算并追加 requirements。外部前置条件缺失进入 `BLOCKED`；Contract/权限/风险语义不清进入 `requires-decision`；瞬时容量失败走有次数和 backoff 上限的 `retryable`。三者不得混成一个 `escalated`。

## 无满足 Carrier 时的终态判定

| 情况 | 应有终态 | 原因 |
| --- | --- | --- |
| 存在另一个已注册 Carrier，机械证明它满足全部硬要求，且启动不引入新权限、不可逆动作或超出已授权预算 | 自动选择该 Carrier，并记录 `RouteDecision` | 这是正常匹配，不需要用户；“更强”必须由 capability dominance 证明。 |
| 所需 live 环境、凭据、授权 human、系统 capability 当前不存在或不可用 | `BLOCKED`，带 `missing_capability`、恢复条件与责任 owner | 换 Agent 无法创造外部前置条件。 |
| 只有修改 Profile/Contract、降低隔离/证据要求、接受新成本、授予新权限或选择 waiver 才能继续 | `requires-decision` | 继续会改变用户承诺、风险或授权边界。 |
| 事实足够但两个等价 Carrier 仅成本/速度不同 | 按版本化 policy 的 deterministic tie-break 选择 | 属于 Agent-owned 运行选择，不应占用用户问题。 |
| capability discovery 自相矛盾、签名/digest 不匹配或不能证明来源 | fail-closed `degraded`，禁止 terminal Gate；必要时转 `BLOCKED` | 未证明能力不能按“可能更强”乐观放行。 |
| 暂时容量不足、进程退出或网络瞬断，且同一绑定可安全重试 | `retryable`，受 attempt/时间预算限制；耗尽后 `BLOCKED` 或已授权 fallback | 防止无限重试和 Task 泛滥。 |

`BLOCKED` 与 `requires-decision` 不能按“严重程度”互换：前者表示已知目标下缺外部可满足条件，后者表示必须改变承诺/策略或由用户裁决才能知道该做什么。

## 主 Agent 的裁量怎样可审计

主 Agent 可以提供语义判断或候选说明，但不能拥有不可重放的“我觉得这是 low”的权威。最小 `RouteDecision` 至少应持久化：

```json
{
  "role_instance_id": "role:qa:job-52:attempt-2",
  "subject_digest": "sha256:...",
  "profile": {"id": "...", "revision": 3, "digest": "sha256:..."},
  "requirements": [{"id": "actor-separated", "source": "profile", "non_waivable": true}],
  "observations": {"diff_digest": "...", "dependency_digest": "...", "capability_snapshot_digest": "..."},
  "rules": [{"id": "ESC-permission", "version": 2, "outcome": "high"}],
  "candidates": [
    {"carrier_id": "subagent", "outcome": "REJECTED", "reason": "missing durable producer identity"},
    {"carrier_id": "desktop-task", "outcome": "SELECTED", "reason": "satisfies all hard requirements"}
  ],
  "budget_snapshot": {"attempts_remaining": 1, "task_slots_remaining": 2},
  "decision": "desktop-task",
  "router_policy_digest": "sha256:..."
}
```

可审计的关键不是长篇 rationale，而是任何新会话用同一 canonical inputs、registry revisions 与 policy digest 能重放相同的候选淘汰结果。模型文字只能作为 `advisory_reason`，不得覆盖 rule outcome、改写 requirement source 或直接提交 Gate。

## 防止模型通过改标签降档

1. `declaredRisk` 只能作为冻结下限之一，不能成为唯一事实源；`effectiveRequirements` 必须从 Contract/Profile、canonical diff、dependency graph、changed runtime paths、AC evidence class、capability preflight 和已有 receipt 缺口做逐维 join。
2. 执行者不能写 `effectiveRisk`、`actorSeparated=true` 或 Carrier capability；它只能发布带 provenance 的观察/receipt，由 Core 推导。
3. 风险/要求更新是 append-only 且单调：在同一 subject/policy revision 内只能增加硬要求；任何降低都必须新 policy revision，并按 Q29/Q32 使相关旧证据 stale、在需要时取得授权 Receipt。
4. Carrier capability 来自版本化 registry + preflight，不接受 prompt 自报；host role 名、Skill 名、Task 名都不等于 capability proof。
5. 规则必须以稳定 ID、版本和命中证据记录；允许模型提出 `possible_trigger`，但不能通过改文件标签、缩写路径或省略依赖使 rule 不命中。路径、diff、依赖和运行目标由 repo/Git/Registry 事实生成。
6. 未知不允许被重写为 low。无法证明某项 hard requirement 不需要时，保持 `unknown` 并按其类型进入 `requires-decision`、`BLOCKED` 或 fail-closed degraded，而不是生成可自动通过的低档默认值。

## 三套候选

### 候选 A：所有未知都进入最高安全档

**规则**：任何风险、复杂度、duration、隔离、live/manual 或 capability 字段为 unknown，就要求 critical profile、独立 Task、最深自动验证，并等待所有可能的 live/manual/human Gate。

**最强支持**：这是最容易描述和审计的 fail-safe；只要最高档资源齐全，就不会因为分类遗漏而少测或由同 actor 自证。安全/合规优先、任务稀少且人力常驻的环境可接受成本。

**最强反对**：它把不同维度误当成单一等级。独立 Task 不能补出 human authority 或 live 环境；“可能需要人工”会让所有未知永久等待。每个 finding 都可触发新 Task、全量回归和 stale/retry，导致任务数与成本乘法增长。最高档资源不可用时没有合法下一步，形成死锁。

**可翻转变量**：

- 最高档 Carrier、live 环境与授权 human 是否始终可用；可用指向 A，不可用反对 A。
- 单 Story 的活跃 Role/attempt 数是否有严格小上限；极小指向 A，大规模反对 A。
- 最高档是否真的是所有 requirement 的数学超集；若不是，反对 A。
- 组织是否接受低风险工作也统一等待人工与全量验证；接受指向 A，否则反对 A。

### 候选 B：硬要求向量 + 有界、确定性最小满足匹配

**规则**：Core 从 Profile/Contract 与 canonical observations 合成逐维 requirements；Router 先过滤不满足者，再从满足集合中按版本化成本策略选择。语义分类 unknown → `requires-decision`；能力/外部条件缺失 → `BLOCKED`；暂态失败 → 有界 retry；不存在“递归升档”。

**最强支持**：它直接落实 Q25/Q26/Q27/Q32：验证下限只能升、Carrier 可替换、Gate 可重建、承诺不清回 Discovery。风险、duration、human、actor separation 可分别表达，不会让“长时但低风险”或“小改但高风险”互相污染。候选淘汰、成本 tie-break 与无解终态都可重放。

**最强反对**：必须先定义 RoleRequirements、CapabilityRegistry、dominance/冲突规则、budget、RouteDecision、preflight 和各 Carrier receipt 等价性；当前仓库均未完整实现。错误或过时的 registry 会产生“确定性地错”，规则数量多时维护成本高；某些语义风险仍需模型/人提出观察，Core 不能凭 schema 自动发现所有业务影响。

**可翻转变量**：

- 能否为每个硬要求建立可机械验证的 capability/receipt 字段；能指向 B，不能则削弱 B。
- Profile/Router policy 的变更频率与治理能力；稳定、可版本化指向 B，高频漂移反对 B。
- 真实 Carrier 数量与异构程度；多且异构更支持 B，单一宿主则收益降低。
- 允许的 route latency 与 registry/preflight 开销；可接受指向 B，极低延迟要求削弱 B。

### 候选 C：模型风险评分 + 阈值选 Carrier，Core 只做底线否决

**规则**：模型综合 risk、complexity、duration、blast radius、actor separation、live/manual 得出分数；阈值决定 main/subagent/Task/human。Core 仅阻止明确的 non-waivable 冲突并记录模型 rationale。

**最强支持**：对开放世界的业务语义、模糊改动和快速演化的 Carrier 最灵活；不必预先穷举所有规则。模型可综合路径之外的代码含义、组织语境和预计工时，早期实现成本最低。

**最强反对**：单一分数掩盖不可互换的硬约束；同一事实可能因提示/模型版本得到不同 Carrier。执行者可通过改写“低复杂度/短时/只是重构”等标签影响分数；长 rationale 不能证明 actor separation 或 receipt authority。若 Core 底线不完整，模型恰好会在规则缺口处降档，违背 Q25 的确定性 Gate 与 Q27 的 capability match。

**可翻转变量**：

- 模型输出是否只在“多个已证明等价的 Carrier”间做软成本 tie-break；若是，C 可缩成 B 的非权威优化层。
- 是否存在独立、持续校准的 routing eval 与降档误判阈值；强证据指向 C，缺失反对 C。
- 主体是否允许同输入因模型升级改变 Carrier；允许指向 C，要求可重放则反对 C。
- Core 的 non-waivable 底线是否覆盖全部权限、人工、隔离和 receipt 约束；完整则降低 C 风险，不完整则反对 C。

## 三个代表性任务的路由模拟

| 场景 | 硬要求合成 | 合理路由结果 | 不能做的事 |
| --- | --- | --- | --- |
| 只改帮助文案，automated AC，几分钟完成，无 live/manual、无跨会话恢复 | fresh context、read-only QA、scoped receipt；风险下限 low | fresh subagent + harness；若 receipt authority 需要持久 producer，则由 host/adapter 补齐或改选满足者 | 不能因“很小”让 executor 自签；也不应创建 QA/Review Task 树。 |
| 只改三行授权代码，但触及 permission path，Profile 要求 independent actor、live 环境与 human approval | high risk、independent producer、live receipt、authorized human receipt | 独立 QA Task 负责验证编排 + live harness；human 单独签授权 Receipt | 不能因 diff 小降档；Task 不能代替 human。 |
| 大批量生成低风险文档，预计数小时，需要跨会话恢复，但 AC 全自动 | durability/recovery/visibility 高；验证风险仍 low | 持久 Desktop Task + automated harness；测试下限不因 duration 自动变成 live/manual | 不能把“长时”解释为高业务风险，也不能用短 subagent 冒充可恢复 Task。 |

三例说明：`risk/verification` 与 `carrier/runtime` 是相关但独立的两个轴；Router 应做 constraint matching，不应只对“任务复杂度”打一个总分。

## 当前候选进入实现前 definitely missing

1. `unknown` 的分类与终态表：至少区分 semantic ambiguity、missing capability/external prerequisite、transient failure、equivalent-choice tie。
2. requirement 冲突优先级和非标量 dominance 规则：尤其 human/live/authority/actor separation 与 duration/complexity 的关系。
3. 有界预算：attempt、并发 Carrier、delegation depth、超时/成本与耗尽后的 terminal。
4. 可重放的 `RouteDecision` envelope 与版本化 CapabilityRegistry/preflight；不能只保存自然语言理由。
5. 降档防护与证据失效：canonical inputs、append-only escalation、policy revision、subject/digest 绑定，以及 executor 无权改 effective requirements。

在这五项进入 prototype/Goal Contract 前，执行 Agent 仍必须猜“默认升档升到哪里、何时停止、无载体怎么办”，因此当前短句不足以直接交给实现。

## 未知项

- 尚未决定三候选中的哪一种作为公共默认；本文不提供百分比或推荐，避免把审计推论自动当成用户决定。
- 尚未定义每个 Profile/Role 的实际 hard requirement、Carrier capability schema、预算数字或 cost policy。
- 尚未证明当前 internal subagent、Desktop Task、harness 在统一 receipt envelope 下的 producer identity 与隔离等价性。
- 尚未决定“满足全部硬要求但预算不足”应由哪些 Profile 自动 fallback、哪些必须用户授权新增成本。

## 没查的

- 未运行 live Task/subagent、权限破坏、成本压测或长时恢复实验。
- 未设计或实现 Router、RoleRegistry、CapabilityRegistry、CarrierAdapter、ProfileRegistry 或 receipt schema。
- 未询问用户，未替用户裁决候选，未修改 manifest、rounds、context、prototype 或产品代码。
