# 候选 3：AesAgent 承载的 Hybrid Local Control Plane

> 状态：只读设计分片，不是用户裁决，不修改 prototype。  
> 结论范围：评估“深 Story Domain Kernel + 可重建 durable operational ledger/projection + AesAgent host adapter”；Skill、CLI、Web 都只是 client/transport Adapter。  
> 当前事实绑定：`G:\GIT\AI_WorkFlow\aes-agent`，分支 `main`，HEAD `a57b93fe6f07e38af7e13a1603cbb3a652bd145e`。  
> 词汇：严格使用 **Module / Interface / Seam / Adapter / Depth / Leverage / Locality**。

## 结论先行

**推荐这个 hybrid 方向。** 当前需求已经超过“若干 Skill 下 `.mjs` 各自维护状态”的安全上限；但证据也不支持现在再造一个 standalone daemon。最合适的第一形态是：

```text
workflow-story-map Skill / CLI / Web
                  │ client / transport Adapter
                  ▼
┌─────────────────────────────────────────────────────┐
│ AesAgent apps/server：StoryControl Host Adapter     │
│  durable operational journal / projection / workers │
├─────────────────────────────────────────────────────┤
│ Story Domain Kernel：纯 decider / reducer / router  │
└─────────────────────────────────────────────────────┘
      │             │              │              │
 Tracker Adapter  Repo Adapter   Carrier Adapter  Human/Live Adapter
 GitHub/GitLab    exact Git      Provider/Task/   typed request/receipt
                                subagent/harness
```

推荐理由不是 AesAgent “已经实现 workflow-story-map”，而是它已经承担了最昂贵、最容易做错的宿主责任：常驻 server 生命周期、SQLite/WAL/事务、串行 command engine、event/command receipt/projection、Web/desktop transport、Plugin 安装与隔离、Provider session/execution/事件流。Story 领域语义仍必须成为新的深 Module，不能散落进 HTTP handler、Skill prompt 或 Provider Adapter。

反证也明确：AesAgent 当前 aggregate 只有 `project | thread`；Workflow Run 嵌在 Thread projection；现有 Provider Adapter 只代表 coding-provider session；现有 `WorkflowGateReceipt` 只绑定 ArtifactRevision 且 verdict 仅 `pass|fail`；生产 `RuntimeReceiptBus` 是 no-op、仅供测试同步。这些都不能原样冒充跨 RepoLane StoryRoot、Role/Carrier Router、Human/Waiver/quorum/撤销和 tracker-ack 语义。

## 1. External Interface：三个入口

```ts
interface StoryControl {
  submit(command: StoryCommand): Promise<SubmitResult>;
  query(query: StoryQuery): Promise<ProjectionEnvelope>;
  watch(request: WatchRequest): AsyncIterable<ProjectionDelta>;
}
```

- `submit`：接收 Web 人类命令、Workflow RoleAssignment、Adapter observation、Receipt/Revocation；调用方不拼 reducer、Router、outbox 或 Gate 顺序。
- `query`：读取同一 revision 的 Story Console、Map、Ticket journey、route explanation、evidence 或 operations projection。
- `watch`：从 durable cursor 续传 projection delta；断线可恢复，客户端按 event id 去重。

不把 `claim/retry/publishReceipt/selectCarrier/reconcile` 拆成许多 public methods。它们是 versioned `command.kind`；少量 Interface 承载大量行为，才有 **Depth**。

### 1.1 关键 envelope

```ts
type StoryCommand = {
  schemaVersion: string;
  commandId: string;
  idempotencyKey: string;
  actor: ActorProof;
  subject: StoryRootRef | RepoLaneRef | WorkTicketRef | AttemptRef | RoleInstanceRef;
  expectedRevision: RevisionVector;
  policy: { contractDigest: string; profileDigest?: string; rolePolicyDigest?: string };
  kind: string;
  payload: unknown;
};

type SubmitResult =
  | { outcome: "COMMITTED"; canonicalAck: TrackerAck; revision: RevisionVector }
  | { outcome: "PENDING_EFFECT"; operationId: string; revision: RevisionVector }
  | { outcome: "NOT_COMMITTED"; code: string; recovery: RecoveryAction[] }
  | { outcome: "ACK_UNRESOLVED"; code: "TRACKER_ACK_UNRESOLVED"; recovery: RecoveryAction[] };

type ProjectionEnvelope = {
  revision: RevisionVector;
  sourceCursor: string;
  freshness: "CANONICAL" | "CACHED" | "LAGGING" | "DEGRADED";
  data: unknown;
  diagnostics: Diagnostic[];
};
```

多 RepoLane 没有一个诚实的全局整数 revision；必须用 topology digest + 各 lane tracker/profile/integration token 的 `RevisionVector`。

### 1.2 Interface 不变量

1. **Tracker ack 才是业务 `COMMITTED`。** AesAgent SQLite intent/event 已提交，只能表示 local accepted/pending effect，不能冒充 canonical transition。
2. **相同 idempotency key 必须同语义。** 同 key、同 canonical digest 重放返回同结果；同 key、不同 payload fail closed。
3. **网络不确定不能伪造零变化。** 只有能证明 tracker 未落 command marker 才返回 `NOT_COMMITTED`；请求可能已落但 ack 不明时必须 `ACK_UNRESOLVED` 并冻结相关 subject。
4. **本地 ledger 可删除重建。** 删除 AesAgent 本地 Story journal/projection 后，必须能从 tracker 子图 + exact checkout + Repo Registry + evidence 重新得到相同业务投影；无法重建的本地事实不得成为完成条件。
5. **Profile 只来自 exact Repo Registry。** Workflow Binding、plugin state、SQLite cache 都不能替代 `profile_id + version + digest`；不匹配即 Q35 degraded。
6. **Gate 只由 Kernel 派生。** Agent、Skill、Adapter、人只能提交 typed Receipt/Revocation；不能提交权威 GateVerdict。
7. **Receipt 精确绑定。** actor、RoleAssignment、attempt、subject、contract/profile/policy digest、provenance、quorum 都必须可核验；subject 变化后旧 receipt 只留审计并 stale。
8. **Role-first。** Workflow 持久化 RoleAssignment；Router 用 capability proof 选 Carrier；Agent Carrier 才在授权内调用 Skill。Provider/host role/Skill 名均不自动取得 receipt authority。
9. **Risk 单调、unknown 三分流。** Contract ambiguity 回 Discovery；capability 未证明即排除/阻塞；仅 risk ceiling unknown 时取可信上界。
10. **一个 command 一个明确 write set。** 跨 GitHub/GitLab lane 不假装原子；采用可观察 saga/补偿。Integration target 保持单 writer lease。
11. **长任务不占 `submit` 调用栈。** transaction 只落 RoleAssignment/effect intent；Carrier 进展通过 observation/receipt 再次 `submit`。
12. **Interface 就是测试面。** CLI/Web/Skill/test 均不得越过它直接改 SQLite、tracker 或 projection。

## 2. Skill、CLI、Web 与 AesAgent 的使用方式

### Skill

`workflow-story-map` 仍是用户入口 Workflow，但不再是状态机实现：它负责识别用户意图、调用 `query/submit`、解释阻塞和向用户提出真正的 contract 决策。原子 Skill 只在已绑定 Role 的 Agent Carrier 内执行。

```text
用户 → workflow-story-map Skill → StoryControl.submit/query
RoleAssignment → AesAgent Carrier Adapter → Agent → allowed Skill(s)
Agent finding/receipt → StoryControl.submit → Kernel → Gate projection
```

因此 Q8 的“独立薄组合层 Skill”不需要撤销；需要撤销的是“Skill 目录脚本就是完整 control plane”的隐含假设。

### CLI

CLI 只做 argv/stdin/JSON、退出码和人类文本：

```text
story status --json       → query
story command <json>      → submit
story watch --cursor ...  → watch
```

CLI 不自行读取 Registry 后判 Gate，不维护另一本 `state.json`，也不直接 dispatch Provider。

### Web

Web 通过 AesAgent 的 authenticated RPC/HTTP/WS Adapter 消费同一 projection：

- 页面加载 `query(story-console)`；
- Action Center 的白名单动作走 `submit`；
- 实时刷新走 `watch(cursor)`；
- freshness、degraded、pending effect、ack unresolved 必须显式可见。

Web 不把 optimistic local change 投影成 canonical committed；Graph 与 Action Center 也不分别维护状态。

### AesAgent

AesAgent 是第一宿主，不是 Story 真源。建议复用：

- `apps/server` 的进程生命周期、auth、WebSocket/RPC、observability 与 worker supervision；
- SQLite WAL 和单 connection transaction；
- `OrchestrationEngine` 已证明的串行 command queue、command receipt dedupe、event + projection + receipt 同 transaction；
- `ProjectionPipeline` 的 cursor/bootstrap/rebuild 模式；
- Workflow Plugin 的 exact plugin/workflow/prompt digest Binding、StagePlan、Attempt、Agent role、artifact 与隔离 plugin host；
- `ProviderService` 的 execution identity、七类 Provider Driver、capability、start/send/steer/interrupt/stop/resume/event stream；
- Plugin lifecycle append-only journal 与 Run lease，管理 `workflow-story-map` release，而不是管理 Story business state。

但应新增独立的 Story vertical Module；不要硬塞进现有 `project|thread` aggregate，也不要把 `workflow_run_json` 当 StoryRoot ledger。现有 OrchestrationEngine 是可复用的实现模式/基础设施，不是无需改动的 Story Interface。

## 3. Seam 后隐藏的 Implementation

调用者不应知道以下内部 Module/内部 Seam：

1. `StoryTopologyLoader`：StoryRoot membership、child back-reference、RepoLane revision vector。
2. `StoryCommandDecider/EventReducer`：Ticket/Attempt/RoleAssignment/Lease/HumanRequest append-only fold。
3. `ProfileResolver`：从 exact checkout 解析 ProfileRegistry/GateCatalog 并校验 digest。
4. `SubjectResolver/ReceiptValidator/GateProjector`：authority、quorum、freshness、revocation、stale、waiver-not-pass。
5. `RiskRequirementsCompiler/CarrierRouter`：planned floor、observed risk、hard filter、deterministic tie-break、budget。
6. `Revision/IdempotencyCoordinator`：CAS、command fingerprint、tracker marker 与 ack reconcile。
7. `Saga/Outbox/ReconcileCoordinator`：intent-before-effect、lease/fencing、retry/dead letter、external fact adoption。
8. `ProjectionBuilder`：Now/Why/Next、Action Center、Accountability DAG、Invocation Graph、operations view。

删除这个 Module 后，上述复杂度会重新散到 Skill、CLI、Web、Tracker/Carrier Adapter 中，因而它通过 deletion test，并带来真正的 **Leverage** 与 **Locality**。

## 4. Dependencies 与 Adapter

| Seam | 类别 | Production Adapter | 现状与缺口 |
| --- | --- | --- | --- |
| Tracker | true external | GitHub、GitLab | 必须新增；负责 capability、typed translation、ack marker、read-after-write，不负责 Gate/Router。 |
| Repo/Evidence | local-substitutable | exact checkout、Git、content-addressed artifact | AesAgent 已有 VCS/checkpoint/workspace 基础，但 Story Profile/evidence 语义需新增。 |
| Provider Agent Carrier | remote but owned | AesAgent `ProviderService` | 已有 execution/session/capability/event；可复用为一种 Carrier。 |
| Desktop Task / subagent / harness / human Carrier | remote but owned / external | 各自 Adapter | 当前 Provider Adapter 不等于这些 Carrier；需独立 capability proof、identity、lease、receipt translation。 |
| Operational ledger/projection | local-substitutable | AesAgent SQLite | 新 Story journal/projection；必须可从 tracker/repo 重建，不能成为第三业务真源。 |
| Transport | Adapter | AesAgent RPC/HTTP/WS、CLI、direct test | 复用现有宿主安全与连接；不承载领域规则。 |

不要复用错误的 Seam：生产 `RuntimeReceiptBus` 明确不保留、不广播，只供测试等待 checkpoint；它不能承载业务 Receipt。现有 `WorkflowGateReceipt` 也不足以表达 commit/integration/contract subject、Human/Waiver/quorum/revocation，必须扩展为 Story 的 typed Receipt 合同，或建立兼容而不降语义的新 schema。

## 5. 为什么复用 AesAgent，而不是新 standalone service

1. **已有宿主而非假想宿主。** AesAgent main 已有常驻 server、Web/desktop、auth、SQLite、migration、event/projection、Plugin lifecycle 和 Provider runtime。
2. **Provider Adapter 是真实第二实现集。** 七个 built-in Driver 共用一个 conformance contract；Story Carrier 可在此基础上增加，而不必再造 coding-agent process/session/event 桥。
3. **Workflow 平台已有不可变 Binding/Attempt/Artifact。** 这些与本次 exact subject、fresh carrier、跨中断恢复高度同向。
4. **最难故障窗已有工程模式。** serialized dispatch、command receipt、transactional projection、Provider reactors、execution runtime/reconcile 都有当前代码证据。
5. **产品面已存在。** Story Web、CLI/Skill 与真实 Agent 执行都需要同一宿主；另起 service 会新增安装、端口、认证、secret、升级、日志、备份、跨进程版本握手，却仍要回接 AesAgent Provider。
6. **Locality 更好。** Agent lifecycle、workflow runtime、Web connection 与 Story control 的宿主故障在一个可观测运行面；standalone 会把故障跨两个控制面分散。

最危险的伪折中是：保留多套 `.mjs` writer，再让 AesAgent/HTTP 只做转发。它承担两套系统成本，却没有单一 Kernel 正确性。

## 6. 当前 AesAgent 能力不能被夸大的地方

- `OrchestrationEngine.dispatch` 在本地 SQLite event/projection/command receipt transaction 完成后返回 sequence；Story command 不能把这个 sequence 直接映射为 tracker canonical `COMMITTED`。
- engine 的 aggregate kind 固定为 `project|thread`；StoryRoot/RepoLane 不是现成 aggregate。
- Workflow Run 是 Thread 内的 event-derived state，不是跨多个 Thread/RepoLane 的 Story control ledger。
- Plugin runtime 提供 start/interaction/provider-turn/artifact/attempt/workspace operations，但目前没有 GitHub/GitLab typed command、通用 Carrier Router、outbox/fencing 或 Human/Waiver authority operation。
- Provider capability 是 Provider session 能力，不等于 Role receipt authority、Desktop Task 可见性、subagent actor separation 或 human authorization。
- 本地 Provider execution runtime 能恢复 execution identity，但不能代替 tracker attempt index 与 repo evidence。

因此推荐是“在 AesAgent 内新增深 Story Module，并复用宿主 seams”，不是“写一个 Workflow Plugin 就自动完成”。

## 7. Q5 / Q18 / Q19 / Q35 冲突检查

| 既有裁决 | Hybrid 必须遵守 | 潜在冲突与修复 |
| --- | --- | --- |
| Q5：tracker/repo 按领域分治，每项事实一个真源 | SQLite 只存 operational intent、outbox、lease、RouteDecision copy、projection cursor/cache | 若 Story membership、lifecycle、Profile 或 evidence 只存在 SQLite，就形成第三真源；禁止。 |
| Q18：tracker 是 attempt 控制索引，repo/Git 是 evidence | Role/Attempt/Carrier 的 canonical control pointer/摘要必须回写 tracker；Receipt bytes/policy 留 repo，SQLite 可重建 | AesAgent `WorkflowRun/workflow_run_json/provider_execution_runtime` 不能成为唯一接管材料。需要定义哪些 RouteDecision/RoleAssignment digest 镜像到 tracker/repo。 |
| Q19：tracker ack 才 committed；断连不得 local-first | local transaction 只到 `PENDING_EFFECT`；收到并核验 tracker ack 后才 `COMMITTED` | 真实网络存在“写入成功但 ack 丢失”。若不能证明未写，返回 `ACK_UNRESOLVED`，不能谎报 `NOT_COMMITTED`。这暴露了 Q19 尚未覆盖的必要失败态，后续 Contract 应显式锁定。 |
| Q35：Repo Registry 是唯一 Profile 真源；缺失 fail-closed | 每次需要 Profile 语义的 command 都按 bound digest 解析 exact Registry；cache/plugin state 只诊断加速 | AesAgent immutable Workflow Binding 有帮助，但不能替代 Repo ProfileRegistry；missing/mismatch 只允许读取、诊断、pause/cancel/release。 |

只要满足上表，hybrid 不推翻既有真源决定。若希望本地 ledger 在 tracker/repo 丢失时仍独立推进或完成 Story，就必须重新裁决 Q5/Q18/Q19/Q35，不能称为透明实现升级。

## 8. 什么时候反而必须 standalone / multi-host

以下任一项成为硬要求或被实测触发时，应重新比较 standalone；其中后四项通常还会迫使 multi-host：

1. workflow-story-map 必须在完全没有 AesAgent server 的环境独立运行并提供相同 SLA。
2. Story control 的发布/升级/故障域必须与 AesAgent Provider/Web 产品完全解耦。
3. 需要公网 tracker webhook、组织级 queue 或 24×7 scheduler，而个人 AesAgent 不应常驻。
4. 两台以上主机必须同时写同一 Story/RepoLane，tracker 又不能提供可靠 CAS/idempotency/lease。
5. Carrier 分布在多主机，宿主死亡后仍要在 SLA 内 heartbeat、fencing、自动改派。
6. 多用户中心 RBAC、secret custody、quorum/audit signer 不能分散到个人 AesAgent。
7. 多客户端需要 durable push/cursor 保留，或本地 SQLite/单机 projection 已实测达不到 Story 规模 SLO。
8. 事件量/保留期超过 tracker+repo 可重建能力，业务希望中心 event store 成为新 canonical source。

multi-host 不是“把 SQLite 换 Postgres”即可；还需要 leader election、distributed fencing、checkout/artifact 可达性、secret distribution、clock/network partition 与 host capability truth。第 8 项更会直接重开真源裁决。

## 9. 推荐的架构判断（不是实现授权）

```text
现在应锁定：
  StoryControl Interface
    + pure/deep Story Domain Kernel
    + AesAgent apps/server Host Adapter
    + rebuildable operational ledger/projection
    + Tracker/Repo/Carrier/Human Adapters

不要锁定：
  standalone deployment
  multi-host
  local ledger 作为业务真源
  直接复用现有 WorkflowGateReceipt/RuntimeReceiptBus 的降语义方案
```

这是三个候选中兼顾 **Depth、Leverage、Locality** 与可逆性的方案：比“嵌入式、无常驻宿主”更能承担 scheduler/outbox/watch/Agent lifecycle；比“新 standalone durable service”少复制一整套宿主产品；同时保留未来把同一 StoryControl Interface 放到独立进程/多主机实现的 Seam。

## 证据完整性与置信度

- 已完整读取本 Issue 当前 `context.md`、47 条 `rounds.jsonl`、`impact-surface.md`、`v3-role-skill-carrier-model.md`、最小 Kernel 与 durable service 两份候选。
- 已只读核对 AesAgent main：`packages/workflow-platform` public SDK/runtime contract；`OrchestrationEngine` serialized dispatch、SQLite event/command receipt/projection transaction；Workflow Run/Attempt/Artifact/GateReceipt；Plugin lifecycle/isolated host；Provider Adapter/Service capability 与 execution runtime。
- 事实置信度：高（当前本地 main HEAD）。
- 推荐置信度：中高。主要翻转变量是：是否要求无 AesAgent 独立部署、是否首版 multi-host、是否要求本地 ledger 成为 canonical、以及 tracker ack-lost 的公共失败语义。
