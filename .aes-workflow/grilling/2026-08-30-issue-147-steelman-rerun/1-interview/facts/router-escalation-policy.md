# Fact: Router 可审计升档与 Carrier 匹配策略

- 派遣问题：在 Issue #147 已确认的 Role-first / Carrier late binding 下，调查 Router 应依据哪些可审计输入选择 harness、fresh subagent、independent Desktop Task、team 或 human，以及升档、降档和 fail-closed 的确定性优先级。
- 完成：2026-08-30T15:20:00+08:00
- 来源说明：只读 architect subagent 完成调查并回传完整报告；因其宿主角色禁止写盘，本文件由主 Agent 原样聚合报告要点。本文不替用户裁决。

## 核心发现

Carrier 不是 `subagent → Task → team → human` 的单轴强度阶梯。正确模型是：先从 Profile、Role、Contract 与实际影响面推导不可违反的 `RoleRequirements`，再从持有可验证 capability proof 的 Carrier 中做确定性匹配。`harness`、`team`、`human` 是正交分支，不是更强的 Agent。

现有现场已经锁定：

- 规划风险与验证要求是执行期下限，只能升档；最终交付必须在 integration SHA 上跑全量回归。
- Q27 已确定 DAG 声明能力要求，Router 选择 Carrier 并记录理由；不能从 `subagent` 或 `Task` 名称推断隔离、身份和证据能力。
- P5 已确定同一 Role 可晚绑定不同 Carrier，但 Receipt schema、subject、policy、provenance 与 Gate 规则必须相同；实现 actor 不得签需要独立性的最终 QA。
- 当前实现已有 `effectiveRisk = max(declaredRisk, changed-path rules)` 的单调风险规则，但它只机械影响 review/merge，没有形成完整 QA/Carrier Router。
- `aes-qa` 按实际影响面而非改动行数选择验证形态；fresh subagent 当前只明确证明 fresh context，Desktop Task 只明确证明可见 thread、registry 与部分 lease 约束。
- 当前 `IssueWorkOrder` 尚未携带完整 risk profile、测试强度、验证下限和升档规则；下述是目标设计，不是已实现能力。

## 候选可审计输入

| 输入 | 权威来源 | Router 用途 | 判定性质 |
| --- | --- | --- | --- |
| Profile digest、Gate requirements、waivable/non-waivable | Repo ProfileRegistry | 验证真源完整性与最低要求 | 机械 |
| Role authority、mutation scope、receipt authority | RoleAssignment | 排除越权 Carrier | 机械 |
| planned risk、verification floor | Contract/Profile | 形成不可降低的下限 | 机械 |
| changed paths、RepoLane 数、依赖、public API/schema/auth/CI 命中 | Diff/impact receipt | 单调计算 effective risk | 大部分机械 |
| 公共行为、权限语义、Contract 是否改变 | typed semantic classification | 风险上界或回流 Discovery | 语义 |
| subject digest、candidate/base/integration SHA | repo/tracker ledger | 防止旧证据结转 | 机械 |
| actor separation、fresh context、thread identity | Carrier proof | 验证独立性要求 | 机械，但只覆盖已证明保证 |
| writer/integration lease | registry | 保证单写者与串行 merge | 机械 |
| duration、retry scope、恢复、用户可见性 | RoleAssignment/Profile | subagent 与 Desktop Task 分界 | 机械；阈值需版本化 |
| live/browser/device/test-data capability | preflight receipt | 能否执行要求的验证 | 机械 |
| fan-out、写面重叠、typed fan-in | DAG | 能否采用 team | 机械结构 + 语义拆分 |
| Human Receipt 类型、actor、quorum | Profile/Gate authorization | human-only 边界 | 机械 |
| budget/quota/availability | runtime registry | 合格候选间择优，不能降低要求 | 机械 |

“任务复杂度”不应成为一个权威总分字段；它必须拆为 blast radius、风险、持续时间、上下文规模、并行度与恢复要求等可审计事实。

## 确定性处理顺序

1. **真源门禁**：Profile、Role 或 subject digest 缺失、损坏、不匹配时进入 `DEGRADED_PROFILE`；只允许读、诊断与安全止损，不 dispatch、不推进 Gate。
2. **Contract 分类**：确定不改变 Contract 才继续。可能改变目标、范围、公共行为、数据/权限边界或无法分类时，进入 `REQUIRES_DECISION` 回流 Discovery；不能靠派更强 Agent 代替裁决。
3. **单调合成 requirements**：

   ```text
   effectiveRequirements =
     roleBaseRequirements
     ∪ profileVerificationFloor
     ∪ contractRequirements
     ∪ effectiveImpactRequirements
     ∪ retry/escalationRequirements
   ```

   风险取可信输入最大值；requirements 取集合并集，不能删除规划下限。
4. **强制分支**：Human/Waiver/具名 Acceptance 只能 human；纯命令/schema/digest/reducer 优先 harness；integration writer、长期 writer lease、长时/跨会话恢复/独立重试/用户可见优先独立 Task；短时、只读、可重算且 fresh context 足够时可用 fresh subagent；用户裁决、Contract 修改、跨 RepoLane 仲裁与 Story terminal 归 main + Core。team 只是一种需额外满足并行条件的组合拓扑。
5. **Capability 硬过滤**：Carrier 必须证明所有 requirements；名称、prompt 自报、模型档位均不算 proof。缺一个 capability 即不合格，不能减配。
6. **合格候选确定性择优**：依次选择最小 authority/副作用；机械工作优先 harness；可恢复时优先恢复已有 owner；最小额外上下文与启动成本；最低预算/时延；最后用稳定 Carrier ID tie-break。
7. **持久化**：保存 RoleAssignment revision、selected carrier、capability proofs、rejected candidates、routing reason 与 preflight digest；Gate 只接受绑定该 revision 与 subject 的 Receipt。

## 升档、降档与无解终态

- 新 diff、依赖、失败次数、live/manual 需要或 capability preflight 使 requirements 增加时触发升档。当前 Carrier 仍满足则追加 Gate；不满足则暂停/终止当前 RoleAttempt，记录 `SUPERSEDED_BY_ESCALATION`，新建 CarrierBinding/attempt。
- 同一 Contract、subject、RoleAssignment revision 内禁止降档。只有 Discovery 或授权策略修订产生新 Profile/Contract revision 后才可形成更低下限，旧证据随 revision 变化 stale。
- 暂时不可用 capability 恢复后重新满足原要求不算降档。
- 无匹配 Carrier：`BLOCKED_NO_CARRIER`，列出未满足 requirements、候选失败原因和恢复入口。
- Capability 未知或 proof 过期：按“不具备”处理，进入 `DEGRADED_CAPABILITY`，不能猜测。
- 预算不足：排队或 `AWAITING_RESOURCE_AUTHORIZATION`；不能选择较弱 Carrier。
- 风险不清但 Contract 明确：取可信风险上界并记录触发原因。
- Contract/scope 不清：回流 Discovery，而不是盲目 full-suite 或创建最强 Task。
- Waiver 不降低 risk/requirements，也不把 FAIL 改成 PASS；只能产生 Profile 明示允许的独立风险终态。

## Team 的独立规则

Team 不是风险升档。只有以下条件全部满足才允许：至少两个可并行 RoleAssignment；subject/output 可分离；写面不重叠；每个 child 单独满足 requirements；有 typed fan-in owner 与聚合规则；delegation depth、并发与预算均有上限。Team 不得整体持有 merge、Waiver 或单一用户裁决权。

## 边界场景

| 场景 | 路由结果 | 原因 |
| --- | --- | --- |
| 改一行有单测覆盖的内部纯函数 | harness 跑命令；Profile 允许时 fresh subagent 做 final QA | 小、低风险、短时、只读、可重算 |
| 只改三行授权判断 | 独立 QA Task + live 正反例 harness；Profile 可能要求 human gate | 行数小不代表风险低 |
| 批量生成 5000 行文档 | harness/subagent；仅持续时间或恢复要求高时升 Task | 规模影响持久性，不自动提高安全风险 |
| 跨两个 RepoLane 且写面独立 | 两个 lane executor Task 可组成 team；每 lane 独立 IntegrationOwner | 可并行，但 merge authority 不聚合 |
| CSS/交互改动 | screenshot/live harness + authorized human checklist；QA actor 按风险选 subagent/Task | 人工是证据边界，不是最强 Agent |
| JSON schema/digest 校验 | harness | 完全机械，无需 Agent |
| final QA 要 durable receipt，subagent 无持久 actor proof | 拒绝 subagent，选独立 Desktop Task | capability 不满足 |
| Standards/Spec 双轴 review | fixed subject、只读、typed fan-in 时 team；高风险 child 可各自为 Task | team 与 Task 可组合 |
| Profile digest 缺失 | `DEGRADED_PROFILE`，不 dispatch | Q35 fail-closed |
| Task 自报 browser-live，但 preflight 失败 | 排除该 Task；无其他满足者则 `BLOCKED_NO_CARRIER` | 自报 capability 不算证明 |
| 执行中命中 auth/schema 升为 high | 当前 Carrier 不满足则新 RoleAttempt/Task；旧证据按 revision/subject 失效 | 单调升档 |
| 新发现可能改变公共行为 | `REQUIRES_DECISION` 回 Discovery | 严格测试不能代替需求裁决 |
| 独立 Task 配额耗尽 | 排队或请求资源授权 | 不得因预算降低验证下限 |
| WaiverReceipt | 只路由 Profile 授权 human | Agent/team/harness 不得代签 |

## 当前实现缺口

- 尚无统一 CapabilityRegistry、RoleRequirements matcher 或 Carrier preflight 协议。
- 当前 effective risk 只机械影响 review/merge，不生成 QA 最小测试集。
- subagent 尚无仓库级 durable identity、独立 lease 或安全沙箱证明。
- 当前 QaReceipt 缺统一 producer actor/provenance 字段，独立性还不能完整成为 Gate。
- “全量回归”当前只证明命令非空且 exit 0，不能机械证明命令属于 Profile 定义的 full suite。

## 证据出处

- `1-interview/context.md:121-130`、`:217-224`
- `skills/workflow/aes-worktree-board/scripts/merge-policy.mjs:31-79`、`:178-224`
- `skills/workflow/aes-qa/SKILL.md:15-25`、`:41-54`
- `skills/workflow/aes-worktree-board/SKILL.md:85-113`
- `skills/workflow/aes-worktree-board/scripts/issue-contract.mjs:266-297`
- `1-interview/facts/role-carrier-topology-options.md:202-215`
- `1-interview/facts/verification-topology.md:14-26`
- `1-interview/facts/agent-isolation.md:21-26`

## 未裁决

- 是否接受三类 unknown 分流：风险未知但 Contract 明确取可信上界；Contract/scope 未知回 Discovery；Capability 未证明按不具备处理并阻塞。
- 自动选择更昂贵 Carrier 的预算授权边界及具体数值。
- 各 Profile/Role 的实际 hard requirements、Capability schema 与 cost policy。

