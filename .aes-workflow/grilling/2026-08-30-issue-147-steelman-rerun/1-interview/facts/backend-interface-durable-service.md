# 候选 2：常驻 Durable Control Plane Module（最大扩展性方向）

> 状态：只读设计候选；不是用户裁决，也不是实现计划。  
> 任务范围：评估把 `workflow-story-map` 的逻辑承载从 Skill 内零散 `.mjs` 脚本提升为系统化、常驻后端程序。  
> 词汇口径：本文按 `codebase-design` 使用 **Module / Interface / Seam / Adapter / Depth / Leverage / Locality**。为避免把部署形态误当设计边界，下文称核心为 `WorkflowControlPlane Module`；“daemon”仅表示它的一种常驻进程部署形态。

## 0. 结论摘要（候选，不替用户决定）

**有充分工程理由把这套逻辑提升为系统化后端程序；但正确形态不是“给现有 `.mjs` 外面包一层 HTTP”，而是建立一个深 `WorkflowControlPlane Module`，让 Skill、CLI、Web 和 Agent Adapter 都只通过同一小型 Interface 使用它。**

这个方向最有价值的部分不是“常驻”，而是把以下互相耦合的正确性集中在一个事务与恢复模型中：

- append-only event/receipt journal 与可重建 projection；
- optimistic revision、idempotency、command dedupe；
- scheduler、RouteDecision、lease、heartbeat、budget；
- transactional outbox、外部 ack、失败重放与 dead letter；
- RoleAssignment → Carrier routing → Agent/Skill invocation；
- Receipt authority、subject freshness、Profile digest 与 Gate reducer；
- Web/CLI/RPC 同源读写；
- GitHub/GitLab、Git/repo、Desktop Task/subagent/harness/human 的 Adapter；
- startup/periodic reconcile、可观察性、schema migration。

现有 `session.mjs` 对“一个 issue、三阶段、顺序式访谈与契约导出”是合适的深度，但它不是并发交付控制面：它的 Interface 是 `init/round/stage/verify/rebuild/finalize/list`，状态写入是同步文件写与进程内结构校验（`session.mjs:3-16,79-87,308-351,382-417`）。另一方面，现有 Board 脚本已经分别实现 registry、跨进程锁、atomic replace、job/attempt、outbox lease、runner quarantine、gate、merge intent、reconcile 和 loopback HTTP（见下文证据）。这说明需求已跨过“少量脚本胶水”的范围，但也说明**不能把“Node `.mjs`”本身当成问题**：真正的问题是这些语义是否被一个小 Interface 隐藏并在同一事务/恢复模型下保持 Locality。

一个不可回避的限制：Q18/Q19/Q35 已锁定 tracker/repo 真源分治、tracker ack 才算 committed、Repo Registry 是唯一 Profile 语义真源。因此，即使采用 durable daemon，它的数据库也**不能未经重新裁决就成为第三个业务真源**。本文候选把本地 ledger 定义为“可持久恢复的操作 journal + 可重建 projection”，而不是取代 tracker/repo 的 canonical source。

## 1. 证据与推论分界

### 1.1 已确认事实 / 用户决定

| 证据 | 对本候选的约束 |
| --- | --- |
| 用户已确认会话可替换、任意新会话从持久事实接管；tracker/repo 按领域分治，本地 runtime 必须可重建。`context.md:17,117` | daemon 可跨进程重启恢复，但不能依赖 daemon 私有内存或不可导出的数据库事实。 |
| tracker 保存 append-only attempt 控制索引，repo/Git 保存证据实体；typed command 只有 tracker ack 后才 committed。`context.md:17,117-119` | local transaction 只能先保存 intent；canonical transition 必须绑定 tracker ack/pointer。 |
| Gate 由 Core 从 typed receipts 与 Profile 规则确定性推导；Receipt 绑定 subject，subject 变化后旧证据 stale。`context.md:19,24,124,131` | Adapter、Agent、Skill 和 Web 都不能直接写 Gate；Reducer 必须在 Core 内。 |
| Role/Skill/Carrier 已分离，Workflow 先调度 RoleAssignment，Router 再选 Carrier；RouteDecision 要保存输入、policy/profile digest、capability proof、淘汰理由与预算。`v3-role-skill-carrier-model.md:9-20,81-107,191-216` | scheduler 的持久对象是 RoleAssignment/RouteDecision，不是 Skill 名或 thread 名。 |
| Profile Registry 缺失/损坏/digest mismatch 时 fail-closed degraded，旧票不能按同名最新版漂移。`context.md:30,137,176,205` | 本地数据库缓存的 Profile 只能诊断/加速，不得在 Repo Registry 缺失时冒充语义真源。 |
| Web/接口影响面已经需要 Story/RepoLane/WorkTicket/Attempt、typed command、event、Receipt/Gate 和同 revision read model。`impact-surface.md:12-14` | Web 不是单独状态系统；应通过统一 projection/query Interface 消费。 |

### 1.2 当前实现证据

| 当前证据 | 说明 |
| --- | --- |
| `session.mjs` 是 issue 目录唯一写入者；manifest 用 tmp+rename，round 用 `appendFileSync`。`session.mjs:3-16,79-87,382-417` | 很适合串行阶段工具；没有 scheduler、lease、outbox、Role/Carrier、receipt/gate ledger 或后台 reconcile。 |
| Board v3 已有同 runtime 跨进程互斥、atomic replace、registry。`runtime-store.mjs:1-2,67-72,94-123,125-192` | “系统后端所需的持久原语”事实上已经在脚本中出现。 |
| Board v4 把 runner/job/attempt/humanRequest/discovery/delivery 分层，并维护 registry + transitions/inbox/receipts。`job-store.mjs:1-4,17-35,70-129` | 当前逻辑已经是一个文件型 control plane，而非简单命令助手。 |
| outbox 已有 `pending/succeeded/abandoned/acknowledged`、in-flight lease、失败 attempt 和显式 acknowledge。`outbox-store.mjs:7,39-69,128-205` | 外部副作用需要恢复与审计；这一逻辑不应在每个调用脚本重复。 |
| runner slot 已有 capability allowlist、identity/dirty quarantine 与 projection。`runner-slots.mjs:1-14,31-78,148-231,261-307` | Carrier capability proof/lease 已有真实先例，但当前只覆盖 worktree runner。 |
| Master 已实现 claim、candidate stale invalidation、stage receipt、gate、merge intent、post-merge verify、close、reconcile/next-step。`master.mjs:299-405,553-585,772-924,1114-1194,1290-1430,1531-1753` | 正确性已散布到接近 2,000 行的 CLI Module；继续按命令增长会降低 Locality。 |
| Board 已有只绑定 `127.0.0.1`、token/origin 校验的本地 HTTP 路径。`server.mjs:1-18,304-330,333-376` | Web/CLI/RPC 复用同一 Core Interface 有可行基础；但现有 server 只覆盖 status/dispatch。 |

### 1.3 本文推论

以下是架构推论，不是已确认产品决定：

1. 需要“常驻进程”是 scheduler/outbox/reconcile/streaming 的自然结果，不等于要拆微服务。
2. 需要事务型存储，是为了把 event、idempotency、outbox、lease 和 projection checkpoint 做成同一原子提交；具体用 SQLite/Postgres/其他实现尚未裁决。
3. v1 应先限定为**单机、多进程**；多主机部署会引入共享数据库、leader election、分布式 secret、跨机 checkout identity 等另一类问题。
4. 本地 ledger 需要耐受崩溃，但仍须可从 tracker/repo 重建；若要把它升级为唯一 canonical event store，必须重开 Q18 的真源决定。

## 2. External Seam：一个深 Module、三个入口

### 2.1 Interface 候选

```ts
interface WorkflowControlPlane {
  submit(command: CommandEnvelope): Promise<SubmitResult>;
  query(query: QueryEnvelope): Promise<QueryResult>;
  watch(request: WatchRequest): AsyncIterable<ProjectionChange>;
}
```

这是调用者与测试共同穿越的 external Seam。不要把 `claimTicket()`、`retryAttempt()`、`publishQaReceipt()`、`selectCarrier()`、`reconcileRepo()` 各自暴露成一组不断增长的方法；它们应是闭集、版本化 command/query kind，由 Module 内部 dispatch。三个入口的 Depth 在于：调用者只学会 command envelope、query envelope、cursor 语义，就能使用后端的权限、幂等、路由、事务、Gate 与恢复能力。

### 2.2 `CommandEnvelope`

```ts
type CommandEnvelope = {
  schemaVersion: "aes.workflow-control.command/v1";
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  causationId?: string;
  actor: {
    actorId: string;
    actorKind: "human" | "agent" | "harness" | "adapter" | "core";
    roleInstanceId?: string;
  };
  subject: {
    storyId: string;
    laneId?: string;
    ticketId?: string;
    attemptId?: string;
    roleInstanceId?: string;
    expectedRevision: number;
  };
  policy: {
    contractDigest: string;
    profileDigest?: string;
    rolePolicyDigest?: string;
  };
  kind: CommandKind;
  payload: unknown;
};
```

`CommandKind` 至少分四族，但仍走同一 `submit`：

- **human/web domain command**：answer/accept/reject、claim/release/pause、retry/cancel/withdraw；
- **workflow command**：create/update RoleAssignment、request route、open next wave、requires-decision；
- **adapter observation**：tracker ack、attempt started/finished、capability proof、carrier heartbeat、external failure；
- **evidence command**：publish/revoke Receipt、record subject advanced、request Gate recomputation。

### 2.3 `SubmitResult`

```ts
type SubmitResult =
  | {
      outcome: "COMMITTED";
      canonicalChanged: true;
      revision: number;
      cursor: string;
      committedEvents: string[];
    }
  | {
      outcome: "NOT_COMMITTED" | "REJECTED" | "BLOCKED" | "COMMIT_UNKNOWN";
      canonicalChanged: false;
      code: string;
      retryable: boolean;
      recovery: string[];
      commandId: string;
    };
```

Interface 不变量：

1. 同一 `idempotencyKey + canonical payload digest` 重放返回原结果；同 key 不同 digest 返回 `IDEMPOTENCY_CONFLICT`。
2. 所有 mutation 都校验 `expectedRevision`；冲突返回当前 revision 与安全重试提示。
3. Adapter/Agent/Skill 不能提交 `GateVerdict`，只能提交 observation/Receipt；Gate 是 Reducer 输出。
4. Receipt 必须通过 actor authority、RoleAssignment、subject、Profile/policy digest 与 freshness 校验。
5. Profile digest 无法从精确 Repo Registry 解析时进入 degraded；缓存 Profile 不获得 authority。
6. Carrier capability 未证明即视为不存在；Router 只能从满足 hard requirements 的集合选择。
7. 每个 aggregate 内有确定性 causality/revision 顺序；不同 StoryRoot/RepoLane 之间不承诺全局总序。
8. external side effect 是 at-least-once delivery；业务效果必须靠 idempotency key 去重，不靠“只调用一次”的假设。

错误模式必须是闭集并携带恢复路径，至少包含：

- `REVISION_CONFLICT`
- `AUTHORITY_DENIED`
- `PROFILE_UNAVAILABLE` / `PROFILE_DIGEST_MISMATCH`
- `CONTRACT_REQUIRES_DECISION`
- `NO_ELIGIBLE_CARRIER`
- `CAPABILITY_UNPROVEN`
- `BUDGET_AUTHORIZATION_REQUIRED`
- `TRACKER_NOT_COMMITTED`
- `EXTERNAL_COMMIT_UNKNOWN`
- `OUTBOX_BACKLOG` / `DEAD_LETTER`
- `LEDGER_UNAVAILABLE` / `PROJECTION_LAGGING`
- `RECONCILE_DRIFT`

### 2.4 `QueryEnvelope` 与 `watch`

```ts
type QueryEnvelope = {
  schemaVersion: "aes.workflow-control.query/v1";
  kind: "story-console" | "story-map" | "ticket-journey" |
        "action-center" | "route-explain" | "evidence" | "operations";
  storyId: string;
  laneId?: string;
  ticketId?: string;
  atRevision?: number;
  expand?: string[];
};

type QueryResult = {
  observedRevision: number;
  projectionRevision: number;
  freshness: "fresh" | "lagging" | "degraded";
  data: unknown;
};
```

`query` 默认只读本地 projection，不临时串行请求 GitHub/GitLab/Git/Agent；这样 Web、CLI 和自动化得到同 revision 的 Now/Why/Next。需要现场刷新时，调用者提交 `reconcile.requested` command，或由 scheduler 周期触发。

`watch` 从 durable cursor 起提供 at-least-once `ProjectionChange`。客户端断线后用 cursor 恢复；客户端必须按 `eventId` 去重。它是 Web 实时更新与后台 worker 唤醒的同一 Interface，不额外创造 Web 专属状态机。

性能语义不应先承诺具体毫秒数：

- `query` 不等待远端 I/O；延迟主要由本地 projection store 决定。
- canonical mutation 的 `submit` 延迟至少包含 tracker ack；不能用本地 enqueue 延迟冒充 committed 延迟。
- `watch` 允许投影滞后，但必须显式报告 `observedRevision/projectionRevision/freshness`。

## 3. Usage：调用者怎样使用这个 Module

### 3.1 小而低风险：fresh subagent 原地 QA

```ts
await control.submit({
  commandId: "cmd-role-qa-42",
  idempotencyKey: "role:qa:ticket-I42:candidate-c3",
  actor: { actorId: "core", actorKind: "core" },
  subject: {
    storyId: "story-147",
    laneId: "backend",
    ticketId: "ticket-I42",
    expectedRevision: 44,
  },
  policy: {
    contractDigest: "sha256:contract-v4",
    profileDigest: "sha256:implementation-v3",
    rolePolicyDigest: "sha256:qa-policy-v2",
  },
  kind: "role.assignment.requested",
  payload: {
    roleType: "QAValidator",
    subject: { kind: "candidate", digest: "git:c3" },
    requirements: {
      contextIsolation: "fresh",
      actorSeparationFrom: ["role:executor:I42:attempt-4"],
      mutationScope: "read-only",
      durability: "receipt-required",
      recovery: "new-carrier-new-attempt",
    },
  },
});
```

隐藏实现会：解析 Profile → 合成 hard requirements → 验证 CapabilityProof → 生成并持久化 RouteDecision → 选择 fresh subagent Carrier → 在同一 transaction 写 `RoleAssigned + DispatchOutbox` → Adapter 创建 subagent → Agent 在 Role 许可内调用 `aes-qa` → Receipt 回到 `submit` → Reducer 校验并更新 Gate projection。

调用者不需要自己拼 `spawn`、租约、receipt stale、Gate 或 retry。

### 3.2 高风险：同 Role 升为独立 Desktop Task

同一个 `role.assignment.requested` Interface 不变；Profile/effective risk 使 requirements 增加：

```json
{
  "durability": "cross-session",
  "visibility": "user-visible",
  "actorSeparation": "independent-task",
  "requiredCapabilities": ["browser-live", "full-suite", "receipt.qa.final"]
}
```

Router 排除 subagent，选择 Desktop Task Adapter。Receipt schema、subject/policy/provenance 和 Gate 规则不变。这正是 Interface 的 Leverage：风险策略和 Carrier 实现改变，不迫使 Workflow/Skill/Web 学习新的调用方法。

### 3.3 Web/CLI/RPC 同源

```text
Web HTTP Adapter ─┐
CLI Adapter ──────┼──> WorkflowControlPlane Interface
local RPC Adapter ┘          │
                             ├── submit
                             ├── query
                             └── watch
```

- Web Adapter 做 loopback token、origin、body limit、HTTP status 映射，不做 Gate/Router 决策。
- CLI Adapter 做参数/JSON 文件解析与 stdout/stderr/exit-code 映射，不直接读写数据库或 tracker。
- Skill 不成为后台进程。总控 Skill 只决定何时调用 Interface、怎样向人解释；Agent Skill 在 Carrier 内执行 procedure。

## 4. Implementation 隐藏在 Seam 后面的内容

### 4.1 Command transaction pipeline

```text
submit(command)
  → schema + canonicalization
  → identity / Role authority / object authorization
  → idempotency lookup
  → load aggregate at expected revision
  → resolve exact Contract/Profile/Role policy digests
  → deterministic CommandDecider
  → append Event(s) + OutboxIntent(s) + IdempotencyRecord
  → update projection checkpoints
  → commit one local transaction
  → return result / await required external ack policy
```

这条 pipeline 是 Module Depth 的核心。任何 transport、Skill 或 Adapter 都不得绕过。

### 4.2 Event ledger

Event record 至少含：

```json
{
  "eventId": "evt-...",
  "aggregateType": "WorkTicket",
  "aggregateId": "ticket-I42",
  "aggregateRevision": 45,
  "storyId": "story-147",
  "laneId": "backend",
  "commandId": "cmd-...",
  "correlationId": "story-147/wave-3",
  "causationId": "evt-...",
  "actorId": "codex-thread:...",
  "roleInstanceId": "role:qa:I42:attempt-4",
  "contractDigest": "sha256:...",
  "profileDigest": "sha256:...",
  "schemaVersion": "aes.workflow.event/v1",
  "eventType": "receipt.qa.published",
  "payload": {},
  "recordedAt": "..."
}
```

要求：append-only、per-aggregate revision 唯一、payload schema versioned、hash/digest 可核验。Snapshot/projection 可以删除重建；event 与 canonical external pointer 不能由 reducer 静默改写。

### 4.3 Scheduler、Router 与 leases

Scheduler 处理的是可持久工作项：

- due RoleAssignment；
- external effect/outbox；
- expired lease/heartbeat；
- reconciliation request；
- projection rebuild；
- human/waiver expiry；
- budget/resource authorization wait。

每次调度：

1. 事务内 claim 工作项并取得 lease；
2. 按 Profile/Role/Contract/subject observations 计算 hard requirements；
3. 对 Carrier CapabilityProof 做硬过滤；
4. 对合格候选按版本化 deterministic tie-break 排序；
5. 持久化完整 RouteDecision；
6. 写 DispatchIntent；
7. 锁外调用 Adapter；
8. Adapter 结果重新经 `submit` 写回；
9. 成功结算或按 failure class/budget 计划下一 attempt。

lease 必须包含 owner、work item、attempt、acquired/heartbeat/expires、fencing token。仅凭 PID/线程“看起来活着”不足以阻止旧 worker 在 lease 失效后继续写；所有完成回报都校验 fencing token。

### 4.4 Transactional outbox 与 external ack

```text
local transaction:
  Event/Intent + OutboxEntry + projection checkpoint
                 │
                 ▼
worker leases OutboxEntry
                 │  outside transaction
                 ▼
Tracker/Carrier/Git Adapter side effect
                 │
                 ▼
AdapterResult submitted with idempotency/fencing token
                 │
                 ▼
new local transaction settles outbox + appends result event
```

关键区别：

- **internal orchestration side effect** 可以 `accepted/pending`，但绝不能投影成业务 `COMMITTED`。
- **Q19 的 Web canonical command** 只有 tracker ack/pointer 被记录后才返回 `COMMITTED`。
- 失败后自动重试与否由 command policy 决定；用户已要求断连后显式重试的命令不能被后台悄悄执行。

#### `NOT_COMMITTED` 与网络不确定性

这里存在一个必须在后续契约中显式处理的分布式失败窗：请求可能已经到达 tracker，但 ack 在网络中丢失。此时系统不能同时证明“tracker 零变化”和“本地未收到 ack”。安全候选是：

1. 每次 tracker mutation 使用稳定 command marker/idempotency key；
2. ack 丢失后先 read-after-write/reconcile；
3. 确认 marker 不存在才返回 `NOT_COMMITTED`；
4. tracker 本身不可读、无法证明是否写入时返回独立的 `COMMIT_UNKNOWN`，冻结相关 subject，直到 reconcile；
5. 不能把 `COMMIT_UNKNOWN` 重写为低风险 `NOT_COMMITTED` 或自动重试。

这是本文推论，不是对 Q19 的偷偷改写；如果产品要求所有断连都必须立即 `NOT_COMMITTED + 绝对零变化`，Tracker Adapter 必须证明目标 tracker 支持满足该语义的幂等/查询协议，否则该承诺在真实网络失败下不可机械证明。

### 4.5 Receipt/Gate reducer

Reducer 输入：Profile/Gate definition digest、current subject、Receipt/Revoke/Waiver events、actor/Role authorization、quorum、freshness。

Reducer 输出：

- `pending`
- `passed`
- `failed`
- `needs-human`
- `blocked`
- `waived`（不等于 PASS）
- `degraded`

Reducer 必须是 pure/deterministic implementation，允许对相同 event prefix 重放得到同结果。LLM 可生成 finding、risk trigger 或 advisory explanation，但不得出权威 GateVerdict。

subject、contract、artifact、Profile/policy revision 变化时，Reducer 无条件把旧绑定 Receipt 分类到 `staleReceipts`；历史不删除。

### 4.6 Projections

同一 ledger/reconciled facts 派生：

- StoryRoot / DiscoveryMap / DeliveryMap；
- RepoLane beacons；
- WorkTicket lifecycle/control/gate；
- Attempt journey；
- RoleAssignment / Carrier / Skill provenance；
- Action Center / Now-Why-Next；
- Gate/evidence inspector；
- operational view：outbox、lease、dead letter、reconcile drift、projection lag。

所有 projection 带 revision、builtAt、source cursor、freshness。Web 不自行拼另一本状态。

### 4.7 Reconcile

Reconcile 读取 tracker/repo/Git/carrier 现场并与 ledger/projection 对账：

- tracker map membership、attempt index、command marker；
- exact checkout、candidate/integration ancestry、dirty/config drift；
- Profile Registry digest；
- AgentInstance/thread/task status、heartbeat、lease owner；
- Receipt artifact pointer/digest；
- outbox effect 是否已经在目标系统发生。

原则：用外部权威事实纠正 projection/operational intent；不能用本地状态位制造外部事实。现有 Board 已在 merge 中采用“registry 记 intent、Git ancestry 判事实”的模式（`master.mjs:1-7,1531-1587`），这应泛化为 ControlPlane 的 reconcile policy。

## 5. Internal seams 与 Ports / Adapters

只有真实变化的依赖才建立 Seam；同一 implementation 的薄包装不建立假 Port。

| Port（Interface） | 依赖分类 | Production Adapter | Test/替代 Adapter | 为什么是真 Seam |
| --- | --- | --- | --- | --- |
| `LedgerPort` | local-substitutable | embedded transactional DB Adapter | in-memory deterministic Adapter | production 持久事务与 test 重放都真实存在；外部 Interface 不暴露 SQL。 |
| `TrackerPort` | true external | GitHub Adapter、GitLab Adapter | contract/fixture Adapter | 已确认两种一等平台；同一语义、不同 API/增强路径。 |
| `RepoPort` | local-substitutable / true external（remote fetch 时） | Git CLI/filesystem Adapter | in-memory repo fixture Adapter | exact checkout、Profile Registry、artifact digest、Git ancestry 需要可替换现场。 |
| `CarrierPort` | remote but owned / host capability | Codex Desktop Task、fresh subagent、harness、human-request、external/manual Adapter | scripted carrier Adapter | P5 已确认同一 Role 晚绑定多 Carrier。 |
| `ArtifactPort` | local-substitutable | repo filesystem/Git evidence Adapter | in-memory artifact Adapter | 大 payload/evidence 与 ledger pointer 分离。 |
| `Clock/IdPort` | in-process internal Seam | system clock / secure ID Adapter | fake clock / deterministic ID Adapter | lease expiry、waiver expiry、重放测试必须可控；不暴露给外部调用者。 |
| `Transport` | Adapter，不是 Core Port | loopback HTTP、CLI、local IPC Adapter | direct in-process test Adapter | 三种调用者复用同一个 WorkflowControlPlane Interface。 |

### 5.1 Tracker Adapter 的最小职责

- capability discovery；
- canonical read/snapshot；
- idempotent typed command translation；
- ack pointer/revision；
- command marker lookup/reconcile；
- native feature enhancement 与显式 fallback；
- identity/permission/network/error taxonomy。

它不负责 lifecycle、Gate、Role routing 或 Story done。

### 5.2 Carrier Adapter 的最小职责

- 对 capability/preflight 产出可验证 CapabilityProof；
- create/resume/steer/stop AgentInstance 或 harness/human request；
- 维护外部 identity 与 RoleAssignment/attempt/fencing token 绑定；
- 把外部 progress/final/finding/receipt 翻译为 typed observation；
- 不自行授予 receipt authority；不直接投影 Gate。

Agent Carrier 收到的 invocation 大致为：

```json
{
  "roleAssignment": {},
  "contextProjection": {},
  "allowedSkills": ["aes-qa@sha256:..."],
  "allowedTools": ["test-harness"],
  "forbiddenAuthority": ["GateVerdict", "WaiverReceipt"],
  "attempt": {"id": "...", "fencingToken": 8}
}
```

因此“多 Agent 调 Role，Agent 内调 Skill”的决定由后端机械承载，而不靠 prompt 约定。

## 6. 单机 / 多进程边界

### 6.1 v1 建议限定的部署拓扑（候选）

```text
one local machine
│
├─ one active workflow-control daemon
│  ├─ WorkflowControlPlane Module
│  ├─ embedded ledger/projection store
│  ├─ scheduler + lease manager
│  └─ loopback HTTP / local IPC
│
├─ zero or more Adapter workers
│  ├─ tracker worker
│  ├─ carrier/agent worker
│  ├─ test/live harness worker
│  └─ reconcile worker
│
├─ Web client
└─ CLI / Skill / host Agent clients
```

边界：

- 同一 ledger 只允许一个 active daemon coordinator；启动时用 OS lock/DB lease + fencing epoch 防双主。
- worker 不能直接改 projection/ledger tables；通过 local RPC `submit` 回报。
- worker 可并行执行外部 I/O，但每个 outbox/RoleAssignment 必须持 lease + fencing token。
- CLI/Web/Skill 不能绕过 daemon 直接写 DB。
- daemon 崩溃后，新 daemon 从 ledger + tracker/repo/Git reconcile；过期 worker 的回报因 fencing token 被拒。
- 机器 sleep/resume 后，所有 lease 先进入 suspect/reconcile，不直接把 wall-clock 超时当作业务失败。

### 6.2 为什么 v1 不建议多主机

多主机不是“再开一个 daemon”这么简单，它会新增：

- shared durable database 或跨机 replicated log；
- leader election / distributed fencing；
- checkout/repo identity 与 artifact 可达性；
- secret distribution 与 per-host capability truth；
- clock skew、network partition、split brain；
- Desktop Task/subagent 宿主定位与跨机恢复；
- 跨机 Web/CLI authentication。

这些都不属于当前“本地 issue + Web + 本地状态文件”已确认边界。External Interface 可以不绑定 transport，以保留未来迁移 Leverage；但 v1 验收不应声称 multi-host。

### 6.3 单进程模式与多进程模式

- **单进程模式**：daemon 内同时跑 scheduler/adapters，部署最简，任何阻塞 Adapter 都可能拖累控制面。
- **多进程模式**：daemon 是唯一 decision/transaction owner，Adapter worker 独立；故障隔离和长任务恢复更强，但需要 lease/fencing、worker supervision 与版本握手。

最大扩展性候选选择多进程能力，但可以先让部分本地 Adapter 作为 in-process implementation；这属于 internal Seam 替换，不改变 external Interface。

## 7. Truth ownership：durable 不等于新真源

建议把持久事实分为三层：

| 层 | 权威内容 | 丢失后的恢复 |
| --- | --- | --- |
| Tracker canonical control | Story membership、ticket lifecycle/control、attempt control index、human command ack | 重新读取 tracker；不由 DB 猜。 |
| Repo/Git canonical evidence/policy | Contract/artifact、Profile/Gate Registry、candidate/integration、evidence bytes | 精确 checkout + digest/Git 恢复；缺失则 degraded。 |
| Local durable operational journal | command intent/result、outbox、lease、RouteDecision、projection cursor、reconcile record | 能从前两层恢复业务状态；未完成本地 effect 只能 reconcile/重派，不能伪造完成。 |

这解决两个看似冲突的诉求：

- daemon 有足够 durability 抵抗进程死亡；
- 用户仍能在换会话/换控制进程时凭 tracker + exact checkout 接管，不被一个私有 DB 绑死。

代价是重建协议必须正式化。特别是 RouteDecision、RoleAssignment、attempt control index 中哪些摘要必须镜像到 tracker/repo，不能只存在 DB；否则“本地 DB 可丢”与“审计完整”会冲突。

## 8. 可观察性与运维 Interface

### 8.1 必须可观察的指标

- command latency 与按 outcome 计数；
- outbox depth、oldest age、retry/abandoned/dead-letter；
- active/expired/suspect leases 与 fencing rejection；
- RoleAssignment queue、NO_ELIGIBLE_CARRIER、budget waits；
- tracker/Git/Carrier Adapter error taxonomy；
- reconcile drift、last successful reconcile、unexplained subjects；
- projection lag 与 rebuild duration；
- Receipt accepted/rejected/stale/revoked；
- Gate pending/failed/needs-human/waived/degraded；
- daemon epoch、schema version、worker version mismatch。

所有 log/trace 用 `storyId/laneId/ticketId/attemptId/roleInstanceId/commandId/correlationId` 关联；不得记录 token、secret、完整敏感 payload。

### 8.2 Operator projection

`query({kind:"operations"})` 至少返回：

- daemon health/schema/epoch；
- pending outbox 和恢复动作；
- expired lease/orphan worker；
- dead letter；
- tracker/profile degraded；
- projection lag；
- last reconcile result；
- safe actions（retry explicit、acknowledge、reconcile、quarantine、release）。

不要只暴露 `/health = 200`。进程活着不代表 control plane 能安全推进。

## 9. Failure model 与运维负担

| 失败 | 必须行为 | 新增运维负担 |
| --- | --- | --- |
| daemon 在 local commit 前崩溃 | transaction rollback；command 可按 idempotency 重放 | daemon supervision、restart policy |
| local commit 后、external call 前崩溃 | outbox 保留；lease 过期后重派 | outbox monitor、stale lease recovery |
| external 成功、ack 落盘前崩溃 | 用 idempotency marker + reconcile 领养事实，不重复副作用 | 每个 Adapter 都要可查询/去重 |
| tracker 写入结果未知 | `COMMIT_UNKNOWN`，冻结相关 subject，禁止自动重试 | 人类可见恢复队列 |
| worker 租约过期但旧 worker 仍回报 | fencing token 拒绝旧回报；必要时新 attempt | worker epoch/version 管理 |
| Profile Registry mismatch | fail-closed degraded，只读/诊断/止损 | Registry 保留与精确 checkout 运维 |
| projection 损坏/落后 | 从 ledger 重建；报告 lag | migration/rebuild 工具、容量规划 |
| ledger 损坏/丢失 | 从 tracker/repo 重建 canonical 状态；in-flight operational facts 进入 reconcile | backup、integrity check、灾备演练 |
| schema upgrade 中断 | transactional migration/side-by-side reader；旧 worker 拒绝写新 schema | 发布编排、兼容矩阵 |
| Adapter 版本漂移 | capability/version handshake fail closed | Adapter 包发布与回滚 |
| dead-letter 增长 | 阻止相关 Gate/close，提供 reason/recovery/ack authority | 操作台和告警 |
| host sleep/clock jump | lease 先 suspect，再现场 preflight | clock/lease 测试 |
| secret/permission 失效 | `blocked-permission`，不计 worker code failure | 本地凭据生命周期 |

### 9.1 这条路线最重的隐藏成本

1. **数据库/schema 生命周期**：migration、backup、integrity、rebuild、compatibility。
2. **daemon 生命周期**：安装、开机/按需启动、端口/IPC 冲突、升级、日志、崩溃恢复。
3. **Adapter correctness**：每个外部系统都要 idempotency、error taxonomy、capability truth、reconcile。
4. **安全**：loopback 不等于自动安全；仍需 bearer/OS identity、origin/CSRF、object authorization、secret redaction。
5. **运维 UI**：用户不仅要看 story，还要看 outbox/lease/drift/dead-letter，否则系统会“后台卡住但前台不知原因”。
6. **事件演进**：event schema 一旦落盘就不能像普通内部对象随意改；upcaster/replay test 成为长期负担。
7. **真源一致性**：本地 journal 与 tracker/repo 的恢复规则必须逐命令定义，不能依赖通用“最终一致”。

## 10. Trade-offs：Depth、Leverage、Locality

### 10.1 高 Leverage 的位置

- Web、CLI、Skill、测试只学 `submit/query/watch`；
- GitHub/GitLab 与不同 Carrier 替换不改变 Workflow caller；
- idempotency、authority、Profile/Gate、receipt stale、route、lease、outbox、reconcile 修复一次即可覆盖所有入口；
- 新 Role/Carrier/Tracker capability 以 schema/Adapter 扩展，不复制主状态机；
- 同一 projection 供 Web 和自动化使用，避免“UI 状态真源”。

### 10.2 Locality 改善

当前正确性分散在：

- `session.mjs` 阶段与文件 schema；
- Board `runtime-store/job-store/outbox-store/runner-slots`；
- `master.mjs` 的 claim/receipt/gate/merge/reconcile；
- `server.mjs` 的 HTTP/security；
- Skill prompt 中的 Role/authority/stop conditions。

深 Module 后，领域规则与 transaction/replay tests 集中在 ControlPlane implementation；Transport/Tracker/Carrier Adapter 只保留 translation 与外部事实读取。这是主要 Locality 收益。

### 10.3 Deletion test

若删除 `WorkflowControlPlane Module`，以下复杂度会重新出现在 Web、CLI、Skill 与每个 Adapter 中：revision、idempotency、authority、Profile digest、RouteDecision、lease、outbox、Receipt/Gate、reconcile、projection freshness。因此它不是 pass-through，Depth 成立。

若只是让 HTTP handler 调现有 `master.mjs` CLI，再让 CLI 调各 store，删除 HTTP 层后复杂度基本不变；那只是浅 Module，不值得称为系统化后端。

### 10.4 主要劣势

- 从“技能仓脚本”升级为需要发布、迁移、监控和恢复的本地产品；
- 初始实现/验证面显著增加；
- event sourcing/outbox/lease 的错误比普通 CLI bug 更隐蔽；
- 本地 daemon 成为可用性依赖和资源消费者；
- 若 external Interface 过早泛化，可能造出平台而不是交付 #147 目标；
- 后端无法凭空提供 subagent 独立身份、Desktop Task API、真实 browser/live 环境或 tracker 原子幂等；它只能验证 proof 并在缺失时 fail closed；
- 多 RepoLane Git 操作仍需各自 exact checkout/merge owner，不能被一个数据库事务原子包住。

## 11. 迁移方向（仅为可行性说明，不是实现授权）

如果后续裁决采用此候选，避免“大爆炸重写”的安全顺序应是：

1. 先锁定 external Interface 与 event/command/receipt schemas；建立 in-memory Adapter 的 interface-level tests。
2. 把 Gate reducer、subject stale、Profile resolution、Router 作为纯 implementation 移入 Module；CLI 仍可直接调用 in-process Interface。
3. 引入 transactional ledger + projection，双写只作验证，旧脚本仍是执行路径。
4. 把 outbox/lease/reconcile 迁入；用 crash-window trajectory 验证等价。
5. 让现有 CLI 变为薄 Adapter，不再直接读写 registry/jsonl。
6. 加 loopback HTTP/local IPC Adapter，Web 改读 `query/watch`。
7. 逐个迁移 GitHub/GitLab、Board、Desktop Task/subagent/harness/human Adapter。
8. 证明从 tracker + exact checkout 可重建后，才停用旧文件型 runtime 写路径；历史保留只读。

迁移每一步都要能回滚，且不能同时存在两个可写 canonical reducer。

## 12. 验证拓扑（后续若进入实现）

Interface 是测试面，至少需要：

- command/revision/idempotency property tests；
- event prefix replay 与 projection rebuild tests；
- Gate reducer golden/fault-injection tests；
- Router hard-filter、deterministic tie-break、unknown 三分流 tests；
- actor/Role/Receipt authority negative tests；
- outbox 八个 crash window tests（commit 前后、effect 前后、ack 前后）；
- lease expiry/fencing/late result tests；
- tracker GitHub/GitLab contract tests；
- Profile missing/digest mismatch degraded tests；
- candidate/contract/profile/subject advance stale tests；
- process kill/restart + reconcile trajectory tests；
- projection lag/rebuild/schema migration tests；
- loopback HTTP/CLI parity、安全与 object authorization tests；
- 单机多进程压力测试：并行 RepoLane、串行 integration lease、daemon restart、worker late completion；
- 真实 Desktop Task/subagent/harness/live/manual evidence 路径；不可用路径明确 `NOT_RUN/BLOCKED`。

## 13. 本候选留下的决策输入（不在本分片裁决）

1. “本地 durable ledger 仅为可重建 operational journal”是否足够，还是要重开 Q18 让它成为 canonical event store？
2. 目标部署只承诺单机多进程，还是首版就要求 multi-host？
3. embedded transactional store 的 implementation 选择与备份/迁移策略。
4. `COMMIT_UNKNOWN` 是否作为 Q19 的必要失败态被接受，还是要求 Tracker Adapter 提供更强可证明语义。
5. 哪些 Role/RouteDecision 摘要必须镜像到 tracker/repo，才能满足“本地 runtime 可完全重建”。
6. daemon 是按用户全局一个、按 repo 一个，还是按 StoryRoot 一个；这影响 lock、secret、升级和多仓资源隔离。
7. 哪些 Adapter 第一版必须 out-of-process；哪些可先 in-process 以降低运维负担。

---

## 附录：对“只用 Skill 下 `.mjs` 是否不够”的精确回答

- **若问题只是 `workflow-interview` 三阶段文件流转，`session.mjs` 足够且合适。** 它已有单一写入、结构门禁、rebuild/finalize，继续改成 daemon 反而增加负担。
- **若目标是本次已经确认的完整 `workflow-story-map`——多 RepoLane、并发 Role/Carrier、长期 attempt、typed Receipt/Gate、Web command、tracker ack、outbox/lease/reconcile——仅靠不断增加相互调用的 CLI `.mjs` 不够稳健。** 现有 Board 代码已证明这些语义会自然长成控制面。
- **语言/扩展名不是分界。** 用 Node 实现一个深、事务化、可测试的 Module 完全可行；用 Rust/Go 实现一堆浅 CLI 同样会失败。分界在 Interface、事务、恢复、ownership 与 Locality。
- **最危险的折中**是保留多套文件写入者，再加常驻 server 做转发：它同时承担 daemon 运维成本，却没有统一正确性。
