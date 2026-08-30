# Fact: SkillDev + AesAgent 双宿主 Workflow Surface 候选

- 派遣问题：在 AesAgent 是最终集成目标、Skill+Web 是高频孵化宿主的前提下，设计一份 host-neutral Workflow Surface / Interaction Protocol，使同一 workflow domain module 通过 `SkillDevHostAdapter` 与 `AesAgentHostAdapter` 运行，成熟后不重写。
- 完成：2026-08-30T18:28:00+08:00
- 调查绑定：AesAgent 事实读取自 `G:/GIT/AI_WorkFlow/aes-agent` 当前 `main@a57b93fe6f07e38af7e13a1603cbb3a652bd145e`；未修改该仓库。
- 调查性质：事实 + 候选设计。没有替用户确认协议字段名、包名或最终部署形态。

## 结论先行

在已给约束下，单选 library、sidecar 或 server module 都不能同时满足“高频本地孵化”和“成熟后不重写”。能闭合的组合候选是：

```text
@aes/workflow-surface-contract        host-neutral library / generated zero-dependency runtime
  + WorkflowModule                   每个 workflow 唯一的 domain reducer + projector + validators
  + shared fixtures/conformance      两宿主必须消费同一份

SkillDevHostAdapter                  Node local sidecar + file/content-addressed store
  -> loopback Web + manual/host continuation

AesAgentHostAdapter                  AesAgent server module + workflow-platform/extension wrapper
  -> event store + WebSocket/HTTP + Provider/Plugin/Artifact/Viewer runtime
```

**不重写的核心不是“两边 API 长得像”，而是两边实际装载同一个 `WorkflowModule` release digest，并对同一 canonical fixture trace 产出相同 event ledger、state digest、SurfaceDocument、Interaction receipt 与 continuation recovery payload。** 迁入 AesAgent 时只允许新增 manifest/binding 与 adapter wiring；不得重写 reducer、交互 schema、投影、validator 或浏览器语义。

这个结论与当前 AesAgent 的平台边界一致：插件公开依赖面只有 `aes.workflow-platform`，Host 提供 transport/persistence/tools/artifact/viewer；Workflow 插件自己持 domain/reducer/validator/viewer，见 `G:/GIT/AI_WorkFlow/aes-agent/AGENTS.md` 的“代码边界/插件边界”及 `extensions/goal-contract/README.md:3-21`。但当前 Goal Contract 仍是“一次语义移植”：Skill 使用 issue 目录和 `session.mjs`，插件却明确改成 typed Workflow state、禁止创建 issue 目录/运行脚本，见 `extensions/goal-contract/README.md:17-21`、`extensions/goal-contract/src/plugin.ts:200-203,420-432`。这正是新 protocol 必须消除的 rewrite seam。

## 当前两宿主的可复用事实与缺口

| 事实 | 证据 | 对设计的含义 |
| --- | --- | --- |
| Skill Web 已把 submission 数据面与 continuation 控制面分开；HTTP 200 只证明 `persisted`，`agent_resumed`、`consumed` 是后续层级。 | `skills/workflow/workflow-interview-web/SKILL.md:53-71`；`references/web-protocol.md:71-88` | 三向握手不能把 Web submit、Agent 唤醒、业务吸收合并成一个“成功”。 |
| Skill Web 的主路径是原子文件落盘 + 人工“请继续”；server 不保活 Agent，且恢复载荷只包含当前 round，不回灌全历史。 | `workflow-interview-web/SKILL.md:31-46,67-71`；`references/web-protocol.md:90-119` | SkillDev adapter 可保持轻量 sidecar；continuation 必须是可选 host capability，人工恢复是合法降级。 |
| Skill Web 当前每个 workflow 自建 `state.json`、submission、ledger、HTTP schema 与页面，未来复制会形成 N 套协议。 | `workflow-interview-web/references/web-protocol.md:5-21,121-260` | 通用 Surface/Interaction contract 应从具体 workflow skill 中抽离。 |
| AesAgent 已有 immutable Workflow binding、Run revision、Interaction/Decision revision、ArtifactRevision、GateReceipt、Provider turn delivery。 | `G:/GIT/AI_WorkFlow/aes-agent/packages/workflow-platform/src/wire.ts:76-87,957-1005,1058-1154` | 新协议应保留 exact binding、optimistic revision、immutable evidence，而不是另造更弱语义。 |
| AesAgent runtime 已有 `start/handleInteraction/handleStageMessage/handleProviderTurnCompleted` → operations 的纯贡献面。 | `packages/workflow-platform/src/runtime.ts:3-42`；`packages/workflow-platform/src/v1.ts:103-160,238-298` | `AesAgentHostAdapter` 可以映射公共 module callback，不应重写 workflow 逻辑。 |
| AesAgent Web command 已使用 `expectedRevision + idempotencyKey`；重复同 key 返回 NoOp，revision 错、terminal、interaction 非 open 均拒绝。 | `packages/contracts/src/orchestration.ts:930-974`；`apps/server/src/orchestration/decider.ts:2204-2247` | 公共 error/commit 语义可以由现有强边界提升，而不是取 Skill HTTP status 的最小公分母。 |
| AesAgent Viewer 是插件输入 state → declarative AST；Host Web 不 import 插件 UI。 | `packages/workflow-platform/src/ui.ts:281-350`；`extensions/goal-contract/src/viewer.ts:17-108` | 两宿主应共享 SurfaceDocument 与 renderer contract，而不是复制 React/HTML 页面。 |
| 当前 Viewer SDK 已内置 `prototype-confirmation/reinterview/dimensions/rounds` 等业务味节点。 | `packages/workflow-platform/src/ui.ts:18-29,72-154` | 通用协议应使用少量语义 primitives + namespaced extension block/fallback，避免每个 workflow 往 Host SDK 加专属节点。 |
| AesAgent installed Workflow 在隔离 host 中按 method execute，且精确 Plugin/Workflow/Prompt digest 不匹配就 unavailable。 | `apps/server/src/workflow/installedWorkflowAdapter.ts:25-75,81-172`；`packages/workflow-platform/src/v1.ts:861-934` | Aes adapter 已有可承载公共 module 的真实隔离边界和 fail-closed binding。 |

## 候选 A：Protocol-first 双 Adapter（组合判断）

### 1. 最小公共接口

公共库只定义 JSON-compatible schema、纯函数契约、canonical digest 和 conformance runner；不得依赖 AesAgent `apps/*`、浏览器、文件系统、SQLite 或 Provider SDK。

```ts
interface WorkflowSurfaceModule<State> {
  readonly descriptor: WorkflowModuleDescriptor;

  init(input: WorkflowInitInput): Transition<State>;
  onAgentOutput(state: State, input: AgentOutputEnvelope): Transition<State>;
  onUserCommand(state: State, input: SurfaceCommandEnvelope): Transition<State>;
  onContinuation(state: State, input: ContinuationSignal): Transition<State>;

  project(state: State, context: ProjectionContext): SurfaceDocument;
  makeRecoveryPayload(state: State, cause: EventPointer): RecoveryPayload;
}

interface WorkflowHostAdapter {
  negotiate(hello: ProtocolHello): ProtocolAgreement;
  load(run: RunRef): Promise<CommittedSnapshot>;
  commit(proposal: CommitProposal): Promise<CommitReceipt>;
  readArtifact(ref: ArtifactRef): Promise<Uint8Array>;
  subscribe(run: RunRef, after: EventCursor): AsyncIterable<HostEvent>;
  requestContinuation(request: ContinuationRequest): Promise<ContinuationReceipt>;
}
```

`Transition` 只返回 `events[] + effects[]`；module 不执行 I/O。Host 在 durable commit 后执行 effect，并把结果作为新 event 再喂回 module。这样文件写、Provider turn、artifact store、Task continuation 都由 adapter 拥有，domain state machine 保持相同。

### 2. 最小公共类型

| 类型 | 最小字段与语义 |
| --- | --- |
| `WorkflowModuleDescriptor` | `protocolRanges`、`workflowType/version/moduleDigest`、`state/event/command/surface schemaVersion`、`requiredFeatures[]`、`optionalFeatures[]` |
| `RunRef` | host-neutral `runId`、exact workflow identity/digest；host thread/issue path 只放 opaque host metadata |
| `RevisionToken` | 单调 `revision` + canonical `stateDigest`；所有写命令带 `expectedRevision` |
| `EventEnvelope` | `eventId`、`runId`、`eventType/schemaVersion`、`producer`、`correlationId`、`idempotencyKey?`、`priorEventDigest?`、`payload` |
| `SurfaceDocument` | `schemaVersion`、`run`、`revisionToken`、`status`、`blocks[]`、`openInteractions[]`、`allowedActions[]`、`artifacts[]`、`continuation`、`sourceFreshness` |
| `SurfaceBlock` | 核心 primitives：`section/text/status/collection/graph/interaction/action/artifact`；可选 `extension{schema,payload,fallback}`，未知 schema 必须显示 fallback 而非执行任意 JS |
| `InteractionRequest` | `id/type/schemaVersion/revision/payload/status/supportsDraft`；payload 由 workflow schema 校验 |
| `SurfaceCommandEnvelope` | `commandId/kind/runId/targetId/targetRevision/expectedRevision/idempotencyKey/actor/payload/issuedAt` |
| `CommitReceipt` | `outcome=committed|duplicate|rejected`、`committedRevision?`、`stateDigest?`、`eventIds[]`、`continuationDisposition`、`error?` |
| `ContinuationRequest` | `continuationId/generation/runId/causeEventPointers/expectedRevision/recoveryPayloadDigest/mode` |
| `ContinuationReceipt` | `stage=armed|agent-resumed|consumed|manual-required|failed`、`generation`、`ownerRef?`、`reason?` |
| `RecoveryPayload` | 当前 trigger、当前 open interaction/action、所需 artifact refs 与 bounded facts；不含完整历史 ledger |

`producer` 必须区分 `agent|human|host|harness`，但不把 Aes thread/session id 变成公共身份。AesAgent 可在 host metadata 中保留 `threadId/runId/attemptId/executionId`；SkillDev 可保留 issue slug/process generation。

### 3. 公共不变量

1. **durable-before-visible**：先原子持久化，再返回 `committed/persisted`，再通知 Web/Agent。
2. **transport != commit != continuation != consumption**：HTTP/WS 成功不等于 canonical commit；commit 不等于 Agent resumed；resumed 不等于业务吸收完成。
3. **optimistic concurrency**：每次写带 `expectedRevision`；冲突零状态变化并返回 current revision/digest。
4. **idempotency payload-bound**：同 `(runId, actor, idempotencyKey)` + 同 payload digest 返回原 receipt；同 key 不同 payload 是冲突，不能“以第一份成功”静默吞掉差异。
5. **append-only / immutable subject**：decision、artifact、receipt、continuation generation 只追加；修订创建新 revision，不覆盖旧对象。
6. **projection-not-truth**：SurfaceDocument 可重建；Web local state、HTML、Aes Viewer AST 都不是 workflow 真源。
7. **exact release binding**：Run 固定 module version/digest 与 schema major；Host 重启或插件升级不重新解释旧 Run。
8. **capability fail-closed**：未知 required feature、缺 continuation authority、缺 artifact/write 权限都不得伪装成功；optional feature 才能用 fallback。
9. **fenced continuation**：单调 generation；旧 owner/旧 wake 对新 generation 零影响。
10. **bounded recovery**：Agent 只接当前 trigger 的 recovery payload；历史按引用定向读取，避免孵化阶段再次上下文爆炸。
11. **declarative UI**：Surface blocks 不携带 executable code；extension block 必须 schema negotiated 且有文本 fallback。
12. **host-authorized effects**：module 只能提议 effect；Adapter/Core 才执行文件、Provider、Task、网络和 artifact 写入。

### 4. 公共错误语义

统一 `ProtocolError`：

```ts
type ProtocolError = {
  code:
    | "schema-invalid" | "version-unsupported" | "capability-missing"
    | "run-not-found" | "target-not-open" | "read-only"
    | "revision-conflict" | "idempotency-conflict"
    | "authorization-denied" | "persistence-failed"
    | "continuation-unavailable" | "continuation-stale-owner"
    | "agent-runtime-failed" | "host-unavailable";
  phase: "negotiate" | "validate" | "commit" | "continue" | "consume";
  retryable: boolean;
  committed: false;
  currentRevision?: number;
  correlationId: string;
  detail?: string; // 人读；客户端不得 pattern-match
};
```

- `duplicate` 是成功 receipt，不是 error；必须返回第一次 commit 的 revision/digest。
- 网络断开导致客户端“不知道是否提交”时，客户端不得本地猜 `NOT_COMMITTED`；用原 idempotency key 重试，Host 给 `duplicate` 或真实失败。
- `revision-conflict` 只允许刷新 snapshot 后构造新命令，不得自动把旧答案套到新 interaction revision。
- `persistence-failed`、`authorization-denied`、`version-unsupported` 永远在 commit 前失败且零 canonical 状态变化。
- continuation 失败不回滚已提交用户答案；它进入 `manual-required` 或 retryable continuation debt，页面仍诚实显示 `persisted`。

## 三向握手

### A. Agent → Web（严格说是 Agent → Host → Web）

```text
1 Agent/module: PublishProposal(expectedRevision, idempotencyKey, domain events/effects)
2 Host: schema/capability/auth/revision 校验 -> atomic commit
3 Host -> Agent: CommitReceipt(committed|duplicate, revision, stateDigest, eventIds)
4 Host: project committed state -> SurfaceDocument(revisionToken)
5 Host -> Web: surface.changed(cursor, revisionToken)；Web 再 GET/subscribe 取完整投影
```

Agent 永不直接推浏览器 DOM，也不在收到 transport ack 前声称 interaction 已发布。SkillDev 的 `publish.mjs` 映射第 1～3 步；AesAgent 的 runtime operations + decider/event store 映射同一步骤。当前 AesAgent `WorkflowExecution` 已在 runtime callback 后逐 operation 按 expected revision dispatch，见 `apps/server/src/workflow/WorkflowExecution.ts:1829-1880,2180-2244`。

### B. Web → Agent

```text
1 Web: 从 SurfaceDocument 取得 run/target revision 与 allowed action
2 Web -> Host: SurfaceCommandEnvelope(expectedRevision, targetRevision, idempotencyKey, actor)
3 Host: auth + schema + open/read-only + revision + idempotency 校验 -> atomic commit Decision/Event
4 Host -> Web: CommitReceipt(persisted/duplicate) + continuationDisposition
5 Host: 独立发起 continuation；页面只在后续 receipt 到达时推进 agent-resumed/consumed
```

第一份 durable decision 不是“谁先 POST 谁覆盖”；显式 revise 必须新建 interaction/decision revision。AesAgent 当前 interaction submit 已经按 terminal、idempotency、revision、open status 顺序拒绝非法写入，见 `apps/server/src/orchestration/decider.ts:2204-2247`；SkillDev adapter 应通过共同 conformance 固定同一可观察结果，而不是沿用 `409/422/400` 的 workflow-specific 解释。

### C. Host → Agent continuation

```text
1 Host: 对已 commit cause event 创建 ContinuationRequest(generation, recoveryPayloadDigest)
2 CarrierAdapter: claim/arm；成功回 armed(ownerRef)，无 authority 回 manual-required
3 Agent runtime: 校验 generation + exact recovery payload，回 agent-resumed
4 Agent: 处理 trigger，提交下一批 domain event，并回 consumed(cause event ids)
5 Host: 持久化 receipt；重复 wake/崩溃恢复沿 continuationId+generation 幂等重放
```

SkillDevHostAdapter 默认第 2 步返回 `manual-required`，Web 显示“回当前 task 请继续”；若宿主未来提供真实 pending-tool/heartbeat authority，才允许 `armed`。AesAgentHostAdapter 可以把第 2～4 步映射为 Run/Attempt/Provider execution continuation，但必须遵守当前事实：Stage user message 只允许 active-steer intent，durable 输出由 Provider completion 处理，见 `WorkflowExecution.ts:2369-2429,2479-2523`。

## 所有权划分

| 层 | 唯一所有权 | 禁止承担 |
| --- | --- | --- |
| 通用 contract library | schema/envelope、canonical digest、Surface primitives、error codes、handshake state machine、negotiation、fixtures/conformance harness | 文件/SQLite/HTTP/Provider、具体 workflow 状态、Aes plugin lifecycle |
| 具体 `WorkflowModule` | domain event/state/reducer、interaction/action schemas、Surface projection、validators、recovery payload、prompt/assets、workflow-specific migration | host auth、进程、线程、端口、Aes `ThreadId`、直接 DOM/React、直接持久化 |
| `SkillDevHostAdapter` | loopback auth/cookie、atomic file event store、content-addressed artifacts、sidecar lifecycle、browser serving、manual/optional continuation、current issue/workspace mapping | 解释业务状态、写 family rounds/contract 之外的捷径、宣称 Agent 已 resumed |
| `AesAgentHostAdapter` | exact Plugin/Workflow binding、event store/Run revision、WS/HTTP authorization、Provider execution、plugin lease、artifact store、Viewer renderer、restart reconcile | workflow-specific fields/if branches、import具体 workflow 包进 server production、重写 reducer/view |
| Web shared renderer | 渲染 negotiated SurfaceDocument、发送 typed command、显示四级 receipt、cursor/reconnect | 业务 Gate 推导、localStorage 真源、直接唤醒 Agent |

当前 AesAgent 已明确 `packages/workflow-platform` 是插件与宿主唯一共享代码面，生产 server/web 不 import 业务插件；所以 Aes adapter 应进入 platform/server generic seam，具体 module 随 extension bundle 安装，不能为了 story-map 在 `apps/web` 写专用真源。

## 两个真实 Adapter 映射

### SkillDevHostAdapter

| 公共 port | 真实实现 |
| --- | --- |
| `load/commit/subscribe` | `<issue>/surface/events.jsonl` append-only + atomic snapshot cache；event digest chain；watch-first + immediate recheck |
| `artifact` | `<issue>/surface/blobs/sha256/...`，Surface 只存 refs/digest；确认版源文件仍由 workflow 规则拥有 |
| `surface` | local sidecar 从 module.project 生成，shared renderer 静态 bundle；loopback、HttpOnly SameSite cookie、session key |
| `command` | `POST /api/commands` 单一 generic endpoint；先 commit 后 ack；不直接写 workflow family files，module effect 由 adapter 的受限 command executor 执行 |
| `continuation` | 默认 `manual-required`；宿主提供明确 authority 时才生成 fenced generation/lease；sidecar 本身不冒充 Agent owner |
| `recovery` | CLI/host tool 只输出当前 continuation 的 bounded payload；历史用 cursor/ref 定向读取 |

它仍是 sidecar，因为 browser 需要长于模型 turn 的提交入口、鉴权和 watch；library-only 无法提供这些。sidecar 只持 adapter state，不持第二套业务 state。

### AesAgentHostAdapter

| 公共 port | 真实实现 |
| --- | --- |
| `load/commit` | Orchestration event store + `WorkflowRun.revision`；公共 `revision-conflict/idempotency` 映射现有 decider |
| `artifact` | `ArtifactRevision` + content-addressed host storage；精确 run/artifact/revision/SHA |
| `surface` | module.project → host-neutral SurfaceDocument；Aes trusted Viewer adapter只解码/返回同一文档，Web shared renderer 渲染 |
| `command` | WS/HTTP command 映射 public envelope；保留 local-control/read-only authorization，不允许 HTTP/WS 两条路径口径漂移 |
| `continuation` | Workflow runtime callback → `request-provider-turn` / active steer / fresh handoff；Provider execution identity 与 recovery 仍归 Aes server |
| `binding` | `.plugin.tgz` exact plugin/workflow/module/prompt digest；isolated host execute；缺 exact release 即 unavailable |

它应是 server module，而不是再启动公共 sidecar：AesAgent 已有事件库、认证、Provider、Plugin 和 artifact 生命周期；外置第二服务会制造双写与第二 authority。现有 installed adapter 已经把隔离 runtime method 转成 server 内 `WorkflowRuntimeContribution`，见 `installedWorkflowAdapter.ts:81-172`。

## 版本协商

```json
{
  "protocolHello": {
    "supported": ["1.1", "1.0"],
    "features": ["surface.graph/v1", "interaction.draft/v1", "continuation.manual/v1"],
    "limits": {"maxCommandBytes": 131072, "maxSurfaceBytes": 1048576},
    "hostKind": "skill-dev"
  }
}
```

1. major 不同不兼容；选择最高共同 minor。
2. required feature 缺失 → `capability-missing`，不得自动降语义；optional feature 可使用 descriptor 声明的 fallback。
3. Run 固定 negotiation result + module digest；运行中 host upgrade 不重新协商旧 Run。
4. schema 独立版本化：protocol、domain event、interaction、Surface extension、artifact 各自有 schema version；不能用 package semver 替代 payload schema。
5. AesAgent binding 继续锁 plugin/workflow/prompt/module digest；SkillDev run manifest 锁同一 module release manifest/digest。
6. migration 是显式纯函数 `old state/events -> new state/events`，两宿主跑相同 golden；没有 migrator时旧 Run decode-only/fail closed。

## Fixtures 与 conformance tests

### Canonical fixture 包

每个 workflow release 自带相同目录：

```text
fixtures/surface/
  descriptor.json
  initial-input.json
  trace.ndjson                  agent/user/host canonical inputs
  expected-events.ndjson
  expected-state.json
  expected-surface.json
  expected-receipts.ndjson
  expected-recovery.json
  blobs/...
```

### 必跑 conformance

1. module purity：相同 state/input 产生逐字节相同 Transition/Surface/digest；禁止读取 clock/random/fs/env。
2. adapter parity：SkillDev 与 AesAgent 跑同一 trace，忽略白名单 host metadata 后 canonical outputs 全等。
3. schema round-trip：所有 envelope/event/command/receipt/extension block decode→encode 稳定。
4. idempotency：同 key 同 payload返回相同 receipt；同 key 异 payload拒绝；restart 后仍成立。
5. revision conflict：stale command 零状态变化并返回 current revision。
6. crash windows：commit 后 ack 前、ack 后 continuation 前、agent-resumed 后 consumed 前分别重启，不丢 decision、不重复业务 event。
7. continuation fencing：旧 generation、重复 wake、错误 recovery digest 被拒；manual fallback 不伪造 resumed。
8. projection replay：删 snapshot/cache 后只从 ledger+blobs 重建相同 Surface。
9. unknown feature/node：required fail closed；optional extension 显示 fallback，Web 不白屏。
10. authorization：read-only Web 能订阅但 mutation 返回 typed deny；HTTP/WS/sidecar 口径一致。
11. exact release：module bytes 改而 version 不变必须 digest conflict；旧 exact release缺失时 unavailable。
12. real smoke：Skill loopback Web 实际提交/人工继续；AesAgent 安装真实 bundle后实际 Web submit→Provider continuation。自动 conformance 不能代替这两条可见路径。

## 高频迭代环

```text
编辑 workflow module/domain/prompt/surface schema
  -> module unit/golden tests
  -> SkillDev sidecar replay + Web hot reload
  -> 浏览器完成 publish/submit/manual-continue/consume
  -> 双 Adapter conformance（Aes 可先用 fixture adapter）
  -> 锁 release version + module digest
  -> extension wrapper 只写 manifest/binding/adapter registration
  -> build .plugin.tgz + isolated-host tests
  -> AesAgent real install/Web/Provider smoke
```

Skill 修改仍可高频，但不能再只复制 Markdown 后由人手工改 `plugin.ts` 语义。当前 `update-skills.mjs` 明确只同步 assets、列 semantic drift，且不改 plugin semantic material，见 `extensions/goal-contract/README.md:30-54`；新环必须让 semantic material 本身就是同一 module release。

## “成熟后不重写”的可验证条件

同时满足才可声称 no-rewrite：

- SkillDev 与 `.plugin.tgz` 内 `module.js`/schema/prompt/assets 的 manifest digest 相同；
- workflow domain package中不存在 `hostKind` 分支，也不 import Skill path、Aes `apps/*` 或 Web组件；
- 两 adapter conformance 对 canonical trace 全等；
- Skill Web 与 Aes Web 使用同一 SurfaceDocument golden 与交互 command fixtures；
- extension wrapper 的业务逻辑行数为零或只做字段机械映射，不能重写状态迁移/问题/validator；
- promotion diff 只能新增/变更 packaging、manifest、host capability declaration 与 adapter registration；
- 旧 Skill run 可导出 canonical ledger，并由 Aes adapter import/replay成相同 state/surface，或明确声明“新 Run only”而不伪称迁移；
- SkillDev live 与 AesAgent installed live 都实际完成一次 `agent publish → Web submit → persisted → continuation → consumed`；
- 任一 parity/golden/digest/live 证据缺失，只能叫“可移植候选”，不能叫“成熟后无重写”。

## 替代设计

### 候选 B：AesAgent-first，SkillDev 只嵌入/启动 Aes Workflow Platform

**做法：** 不定义更小的 host-neutral protocol；把 `aes.workflow-platform` 作为唯一 SDK，SkillDev sidecar 直接启动轻量 Aes server/isolated plugin host，Web 也复用 Aes客户端。

**好处：** 目标宿主语义天然一致；无需第二套 adapter conformance；plugin bundle 从第一天就真实运行。

**反例/代价：** 当前 platform 包依赖 Effect、hash/tar，Skill 脚本约定是 Node built-in/零依赖；Aes Run 又带 Thread、Provider、StagePlan、Artifact、Plugin lifecycle 等大面，孵化一个简单 Web workflow 成本高。它会把“Skill+Web 高频宿主”实际变成“AesAgent dev mode”。

**翻转变量：** 若 AesAgent 提供可在 1～2 秒启动、单二进制/零配置、无需完整 Provider/数据库的 official dev host，并且所有未来 workflow 都只面向 AesAgent，此候选会明显变强。

### 候选 C：一个外部 Workflow Sidecar 同时服务 Skill 与 AesAgent

**做法：** library + domain module 全部跑在独立 service；Skill Web 与 Aes server 都通过 HTTP/WS 调它，AesAgent 只是远端 client。

**好处：** 两宿主共享同一个进程实现，语言/发布可独立；未来还能给其他产品接入。

**反例/代价：** AesAgent 已有 authoritative event store、plugin inventory、auth、Provider execution、artifact store 与 isolated host。外置服务必须决定谁是 Run/Decision/Artifact 真源；网络分区会产生双提交/补偿；Desktop/local/remote/relay 安全与生命周期都加倍。若 sidecar 只是计算服务还可接受，若持久化 Run 就破坏 Aes authority。

**翻转变量：** 若 workflow runtime 要跨多台 AesAgent 共享、需非 Node 语言/独立扩缩容，且组织愿意把 workflow state authority 正式迁到外部服务，此候选才翻转。

### 候选 D：文件 ledger 是唯一公共真源，AesAgent 只镜像

**做法：** 沿用 Skill issue-dir/web ledger；Aes extension 读取/写回同一文件，Aes Run 只做投影。

**好处：** 离线、透明、最贴合当前 Skill；孵化零额外 domain library。

**反例/代价：** AesAgent 的 Run/Decision/Artifact 已是 event-derived durable domain state；把文件再设为 truth 会形成双 authority，远程/多设备/Plugin lifecycle/Provider recovery都难闭合。当前 Goal Contract 插件正是为了避免 Provider 写本地 issue 目录而映射到 typed Run，见 `extensions/goal-contract/README.md:17-28`。

**翻转变量：** 若最终产品只需只读导入，不需要在 Aes Web 继续 interaction/Provider execution，文件 ledger 可作为 interchange format，但不能承担 live双向宿主协议。

## 翻转主判断的变量

- SkillDev 是否必须保持 Node built-in/零安装，还是可以依赖完整 Aes SDK/runtime；
- 成熟 workflow 是否需要把既有 Skill runs 迁入 Aes，还是只要求新 Run 使用同代码；
- AesAgent 是否仍是 Run/Decision/Artifact 最终 authority；
- workflow-specific UI 是否必须运行自定义代码，还是 declarative Surface AST 足够；
- 自动 continuation 是否为强需求，宿主是否能提供真实 pending/heartbeat authority；
- 未来第三宿主是否存在；若有，host-neutral contract 的收益显著增加；
- AesAgent 是否愿意把当前 `aes.workflow-platform/v1` 下沉为更小、无 Aes Thread/Provider 假设的 surface package。

## 未知项与未验证边界

- 尚未定义公共包的最终名字、Effect/Schema 与零依赖 generated runtime 的生成方式。
- 未证明现有 Aes Viewer renderer 能直接覆盖 story-map 的 graph/action-center；需要 `graph/collection/status` primitives 或 extension renderer registry 的专项原型。
- 未证明 Codex Desktop 当前能给 SkillDev sidecar 自动 continuation authority；默认只能诚实使用 manual follow-up。
- 未定义 Skill issue-dir family state 与 canonical module state 的一次性迁移工具；没有它不能声称历史 run 无损迁入。
- 未实现或运行双 Adapter conformance、真实 Aes plugin install、Web/Provider live smoke。
- 未修改 manifest、rounds、context、prototype、Skill/AesAgent 产品代码或其他事实分片。
