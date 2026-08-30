# 候选 1：最小嵌入式 Domain Kernel（不设常驻后端）

> 状态：只读设计分片，不是用户裁决，不修改当前 prototype。  
> 问题：`workflow-story-map` 是否必须直接演进为常驻后端，还是先把复杂领域行为收进一个可嵌入的深 **Module**。  
> 词汇：本文严格使用 **Module / Interface / Seam / Adapter / Depth / Leverage / Locality**。  
> 结论范围：这里只给“最小嵌入式 Domain Kernel”候选及其失效阈值；不替用户选择。

## 先把争议说清楚

用户对“继续由 Skill 目录下若干 `.mjs` 承担”不放心是有仓库证据支持的。问题不在 `.mjs` 扩展名，也不在 Node 是否零依赖；问题在于领域不变量是否散落在 CLI 参数解析、Web handler、Skill 提示和测试夹具里。

这个候选主张：

```text
Skill / CLI / Web / tests
          │
          ▼
┌──────────────────────────────┐
│ Story Domain Kernel Module   │
│  small Interface             │
│  deep Implementation         │
└──────────────────────────────┘
          │ internal seams
          ├─ Tracker Adapter (GitHub / GitLab / memory)
          ├─ Evidence Adapter (repo/Git / memory)
          ├─ Execution Adapter (board / Desktop Task / subagent / harness / manual)
          └─ Live/Human Adapter
```

CLI `.mjs`、本地 Web server 和测试都只是 Kernel 外侧的 **Adapter**。它们不再拥有 reducer、Router、Receipt/Gate、revision 或幂等语义。Kernel 可以仍由 Node 模块实现，但已经是一个系统化程序，而不是“把状态机继续堆进脚本”。

“嵌入式”只表示 Kernel 与调用方同进程加载；不表示把真源放进本地内存。当前裁决仍成立：tracker 保存控制事件索引，repo/Git 保存证据实体，本地 runtime 只能是可再生投影（`context.md:17`）。

## 仓库证据：哪些支持，哪些反驳

### 支持先做嵌入式深 Module

1. 已定设计本来就要求薄 Core 与 typed Adapter，而不是 Core 直接管理 Agent/worktree：Q20 明确 `ExecutionAdapter`，P5/P6 明确 Role-first、Carrier late binding、Core 校验 Receipt/Gate（`context.md:17,226-230`；`v3-role-skill-carrier-model.md:14-19,191-216`）。因此 Seam 已经存在，不需要为了“系统化”先引入网络跳转。
2. 当前真源分治不要求一个新数据库：tracker 是 attempt 控制索引，repo/Git 是大证据，runtime 可重建；Repo Registry 又是 Profile 的唯一语义真源（`context.md:17,30`）。这反而要求 Kernel 不偷偷成为第三份领域真源。
3. v1 默认只加载当前 story 子图，不做全仓 portfolio（`context.md:17`）。这把一次重建的工作集限定在 StoryRoot，给嵌入式 fold + projection 留出了现实空间。
4. `workflow-interview/session.mjs` 已证明“单写入路径 + schema + 原子替换/append + 阶段门禁”在有限状态空间内可行：它自称唯一写入者，manifest 走 tmp→rename，round 走单次 append，并在同一处校验（`session.mjs:3,79-86,153-210,407-414`）。可复用的是确定性纪律，不是继续扩大这一个文件。
5. `aes-worktree-board` 已有可嵌入 Module 的雏形：`runtime-store.mjs` 提供同 runtime 跨进程锁、原子替换和 append 原语（`runtime-store.mjs:1,67-122,187-194`）；`job-store.mjs` 分层 job/attempt/human/discovery/delivery 并保存 append-only transitions/receipts（`job-store.mjs:2,12-30,104-123`）；`merge-policy.mjs` 把 risk、路径升档和 Gate 判定做成纯计算。
6. board 的主要 v4 测试直接导入 `master.mjs` 并调用领域函数，trajectory replay 也走同一条进程内路径（`selftest-v4.mjs:20,109-148`；`selftest-trajectory.mjs:14,39-186`）。这说明“同进程 Module + 可替换依赖”能覆盖恢复、证据失效和 merge，不必先经 HTTP 才可测试。
7. 当前本地 server 已经只是 `127.0.0.1` 的宿主形态，GET status 和 POST dispatch 最终仍调用本地 collect/orchestrate（`server.mjs:2,17,174,249,333-355,389`）。保留 Web server 作为 Adapter，和是否设领域常驻后端是两件事。

### 反驳“继续用若干脚本自然长大”

1. `session.mjs` 在只有三阶段、七个子命令时已经 830 行，并同时承担 schema、存储、阶段推进、verify、rebuild、finalize 与 CLI dispatch（`session.mjs:25,153,421,686,816-829`）。`workflow-story-map` 的状态空间远大于它，继续沿这个形状扩展会成为浅 Module。
2. board 已出现两代 runtime（v3 `runtime-store` 与 v4 `job-store`）、两套 orchestration（`orchestrate.mjs` 2147 行、`master.mjs` 1974 行）以及两个 outbox 文件。这个历史不是“必须上常驻后端”的证据，却是缺少单一深 Seam 时语义会复制和漂移的直接证据。
3. `master.mjs` 的可调用面目前有二十多个领域函数，CLI 又把 `claim/candidate/stage/terminal/gate/merge/verify/close/...` 一一暴露（`master.mjs:299,553,772,1114,1533,1704,1785-1960`）。测试也逐个跨过这些内部阶段。这让调用方必须知道正确顺序，Depth 不够。
4. 当前 server 直接导入 `collect.mjs`、`orchestrate.mjs` 并自己做 dirty、lease、身份、dispatch 前置判断（`server.mjs:12-18,174-284`）。CLI 也有相似判断。删除 Kernel 后复杂度已经实质散落到多处；这正好通过了“删除测试”：需要一个深 Module 来赢回 **Locality**。
5. 多 RepoLane、双 tracker、tracker ack 才 committed、RouteDecision 可审计，使 concurrency/revision/idempotency 成为真正的领域问题（`context.md:17,28`；`v3-role-skill-carrier-model.md:202-216`）。它们不能继续由每个入口自行约定。

### 反驳“现在就必须把领域真源迁到常驻后端”

1. 现有裁决要求 tracker/repo 是领域真源，本地 runtime 可重建。若常驻进程自己的数据库成为权威，就直接改变 Q18/Q19/Q35，而不是实现细节。
2. 当前 story 范围是单 StoryRoot 子图，不是跨仓全局 inventory；当前 Web 也只需要同 revision 的 read model（`impact-surface.md:12-15`）。尚无证据证明必须用中心化物化数据库才能达到目标。
3. 进程常驻不能自动解决 tracker 写入的“请求已到达但 ack 丢失”问题；只要 tracker 仍是 canonical ledger，仍要 idempotency key、读后确认和 `ACK_UNRESOLVED` 恢复协议。把代码搬进 daemon 不会消除分布式不确定性。

## 1. Kernel Interface

### 1.1 外部 entry points（恰好 3 个）

```ts
export type StoryKernel = {
  inspect(query: InspectQuery): Promise<ProjectionEnvelope>;
  transact(command: StoryCommand): Promise<CommandEnvelope>;
};

export function createStoryKernel(dependencies: KernelDependencies): StoryKernel;
```

只有一个工厂和两个操作。`reconcile`、`next-step`、`publish-receipt`、`dispatch`、`retry` 都是 `StoryCommand.type`，不是新增方法。测试也只能穿过这两个操作，不直接调用 reducer、Gate 或 Router。

这是一个深 **Module**：调用者只学会 Query/Command 两种 envelope，就能获得 topology 重建、Role 路由、幂等提交、证据校验、Gate 投影、恢复建议与 Web read model 的全部 **Leverage**。

### 1.2 核心类型

```ts
type StoryRef = {
  storyRootId: string;
  membershipDigest?: string;
};

type RevisionVector = {
  topology: string; // StoryRoot membership / contract revision
  lanes: Record<string, {
    trackerRevision: string;
    profileDigest: string;
    integrationHead?: string;
  }>;
};

type InspectQuery = {
  story: StoryRef;
  consistency: "canonical" | "cached-ok";
  view: "snapshot" | "action-center" | "accountability-dag" | "invocation" | "evidence";
  atRevision?: RevisionVector;
};

type StoryCommand = {
  schemaVersion: string;
  commandId: string;
  idempotencyKey: string;
  story: StoryRef;
  expectedRevision: RevisionVector;
  actor: ActorProof;
  target: SubjectRef;
  type:
    | "ANSWER_DECISION" | "CLAIM_ROLE" | "RELEASE_ROLE"
    | "PAUSE_ATTEMPT" | "CANCEL_ATTEMPT" | "RETRY_ATTEMPT"
    | "PUBLISH_RECEIPT" | "REVOKE_RECEIPT"
    | "RECONCILE" | "ADVANCE_ONE_SAFE_STEP";
  payload: unknown;
};

type ProjectionEnvelope = {
  revision: RevisionVector;
  freshness: "CANONICAL" | "CACHED" | "DEGRADED";
  story: StoryProjection;
  nowWhyNext: NowWhyNext;
  actions: SafeAction[];
  diagnostics: Diagnostic[];
};

type CommandEnvelope =
  | { outcome: "COMMITTED"; commandId: string; revision: RevisionVector; events: EventRef[]; projection: ProjectionEnvelope }
  | { outcome: "NOT_COMMITTED"; commandId: string; code: KernelErrorCode; recovery: RecoveryAction[]; observedRevision?: RevisionVector }
  | { outcome: "ACK_UNRESOLVED"; commandId: string; code: "TRACKER_ACK_UNRESOLVED"; recovery: RecoveryAction[] };
```

`RevisionVector` 必须是向量而不是假装存在一个跨 GitHub/GitLab 原子递增数。lane-scoped command 只写一条 RepoLane；StoryRoot 投影把各 lane checkpoint 与 topology digest 合成一致快照。任何要求一次 command 原子改两条 tracker lane 的功能，都超过本候选能力，见后文失效阈值。

### 1.3 Interface 不变量

1. **一个命令，一个明确 write set。** command 必须声明 target RepoLane/subject；默认不得在一次提交中写两个 tracker。
2. **canonical ack 才是 COMMITTED。** 未拿到 tracker canonical event 的可验证 ack，不返回 `COMMITTED`，也不把本地 projection 当真源。
3. **`NOT_COMMITTED` 必须有证明。** 只有 Adapter 能证明 canonical ledger 没有该 idempotency key 时才返回；若请求可能已经落地但暂时查不到，必须返回 `ACK_UNRESOLVED`。这比在网络分区下伪称“零变化”更诚实；恢复后按同 key 对账。
4. **同 key 同语义。** 相同 `idempotencyKey + canonical command digest` 重放返回同一 committed result；同 key 不同 digest 返回 `IDEMPOTENCY_CONFLICT`，零写入。
5. **revision fail closed。** `expectedRevision` 与命令 write set 的 live tokens 不一致时返回 `REVISION_CONFLICT`；Kernel 不做 last-write-wins。
6. **Profile 精确重建。** `profile_id + schema_version + digest` 任一缺失/不匹配，只允许 Q35 已授权的读取、诊断、pause/cancel/release 止损命令；其他命令 `PROFILE_DEGRADED`。
7. **Gate 只派生。** Adapter、Agent、Skill、人只能提交 typed Receipt；Gate verdict 由 Kernel 每次从 exact Profile + valid Receipt 集重算，任何输入中的 `gate=passed` 都被忽略或拒绝。
8. **Receipt 精确绑定。** receipt 必须绑定 actor、RoleAssignment、attempt、subject digest、policy/profile digest、provenance；subject 变化后旧 receipt 保留但 `STALE`。
9. **Role 与 Carrier 分离。** Router 先从 Role/Profile/Contract/impact 合成 hard requirements，再验证 capability proof，再确定性选择最小充分 Carrier。Skill 名不能证明 authority 或 actor separation。
10. **风险单调。** planning 下限不可删除；真实 diff/依赖/live path 只能追加 effective requirements。
11. **unknown 三分流。** Contract ambiguity → `requires-decision`；capability unproven → 排除/`BLOCKED_NO_CARRIER`；仅 risk ceiling unknown → 取可信上界。
12. **append-only 业务历史。** Ticket 身份稳定；retry 创建新 Attempt；事件、Receipt、revocation、route decision 不覆盖旧记录。
13. **单 writer lease。** 同一 subject/integration target 不允许两个互斥写 Role 同时持 lease；executor 不得签需要 actor separation 的最终 QA/review。
14. **runtime 可删除。** 删除本地 cache 后，`inspect(consistency="canonical")` 必须只凭 tracker 子图、精确 checkout、Registry 和 evidence 重建同一 Projection。

### 1.4 Ordering constraints

`inspect` 无领域副作用；`transact` 内部固定采用可恢复 saga，不让调用方拼顺序：

```text
1 canonicalize + schema validate
2 load StoryRoot membership and exact Repo Registry
3 acquire local lane lock; reload canonical revision
4 fold canonical events; validate expectedRevision/idempotency/authority
5 validate subject + receipts; recompute Gate
6 compile RoleRequirements / RouteDecision / effect plan
7 commit intent/control event through Tracker Adapter (canonical ack)
8 release local lock; execute short external effect through Adapter
9 persist content-addressed evidence first, then canonical receipt pointer/event
10 fold again and return projection
```

长时 Agent 不在 Kernel 调用栈里等待。Kernel 只持久化 RoleAssignment/dispatch intent，Execution Adapter 返回 stable actor/task/attempt identity；后续 event/receipt 再通过 `transact(PUBLISH_RECEIPT)` 进入。

若在 7 后、8/9 前崩溃，下一次 `inspect` 或 `RECONCILE` 能看到“已提交 intent、缺 effect receipt”，用相同 idempotency key 恢复，而不是重复创建 actor。`master.mjs` 现有 “mergeIntent 先落盘，Git 事实后对账” 已证明这种排序能避免重复 merge（`master.mjs:2-8,1163-1240,1531-1584`）。

### 1.5 Error modes

| code | 是否 canonical 改变 | 处理 |
| --- | --- | --- |
| `BAD_SCHEMA` / `UNKNOWN_COMMAND` | 否 | 修正调用方；不猜字段 |
| `REVISION_CONFLICT` | 否 | 重新 `inspect`，基于新 revision 重建动作 |
| `IDEMPOTENCY_CONFLICT` | 否 | 人/调用方修正 key；禁止重试不同 payload |
| `TRACKER_UNREACHABLE` | 仅在证明未发送/未写时为否 | 返回 `NOT_COMMITTED` |
| `TRACKER_ACK_UNRESOLVED` | 未知 | 返回 `ACK_UNRESOLVED`，按 key 查询/重放；禁止本地先行 |
| `PROFILE_MISSING` / `PROFILE_DIGEST_MISMATCH` | 可提交止损事件；不可推进 Gate | `DEGRADED`，恢复精确 Registry 或回 Discovery 建替代票 |
| `CONTRACT_AMBIGUOUS` | 可提交 requires-decision | 回 Discovery，不用更强 Agent 代替裁决 |
| `CAPABILITY_UNPROVEN` / `NO_ELIGIBLE_CARRIER` | 可提交 blocked diagnosis | 补 capability proof/资源；不得降档 |
| `AUTHORITY_DENIED` / `ACTOR_SEPARATION_VIOLATION` | 否 | 换合法 actor/RoleAssignment |
| `STALE_SUBJECT` / `STALE_RECEIPT` | 旧历史保留；Gate 不通过 | 对新 subject 重验 |
| `EFFECT_FAILED` | intent 可能已 committed | 显式 blocked/retryable effect；同 key reconcile |
| `MULTI_LANE_ATOMICITY_UNSUPPORTED` | 否 | 拆成 saga，或触发后端/真源架构重议 |

## 2. 三种使用方式

### CLI Adapter

```js
const kernel = createStoryKernel(loadProductionAdapters());
const request = decodeArgv(process.argv.slice(2));
const result = request.kind === 'inspect'
  ? await kernel.inspect(request.query)
  : await kernel.transact(request.command);
printOneJson(result);
process.exitCode = exitCodeOf(result);
```

CLI 只负责 argv/stdin、JSON 编解码和退出码。它不读取 registry 后自行判断 Gate，也不自己先写 manifest 再调用 tracker。`session.mjs` 未来若复用 Kernel，也应成为这种 Adapter，而不是把 story 状态机塞进现有 interview session writer。

### Web server Adapter

```js
GET  /story/:id/snapshot -> kernel.inspect(...)
POST /story/:id/commands -> kernel.transact(...)
```

Web server 只拥有 HTTP body limit、origin/token/session auth、状态码和流式传输。dirty/lease/route/gate/idempotency 全部进入 Kernel。当前 `server.mjs` 在 handler 内重复 dirty、lease 和 dispatch preflight，正是要消除的 Seam 泄漏。

Web 可以常驻以服务页面，但它不是领域常驻后端：杀掉并重启不会丢 canonical 状态；另一 CLI 进程加载同一 Kernel 仍得到同样结果。

### Test Adapter

```js
const kernel = createStoryKernel({
  tracker: new MemoryTrackerAdapter(),
  evidence: new MemoryEvidenceAdapter(),
  execution: new ScriptedExecutionAdapter(),
  git: new TemporaryRepoAdapter(),
  clock: fixedClock,
});

await kernel.transact(command);
assert.deepEqual(await kernel.inspect(query), expectedProjection);
```

Interface 是唯一测试面。测试不再逐个调用 `recordCandidate → recordStageResult → masterTerminal → evaluateGate` 这类内部阶段。崩溃测试通过 Adapter fault injection 在 canonical ack 前后截断，再用新 Kernel 实例 `RECONCILE`，而不是暴露更多内部方法。

## 3. Kernel 隐藏的 Implementation

调用者不应知道以下内部 Module/内部 Seam：

1. `EnvelopeCanonicalizer`：schema version、stable digest、closed enum。
2. `StoryTopologyLoader`：StoryRoot 权威 membership、child back-reference 对账、RepoLane revision vector。
3. `EventReducer`：Ticket/Attempt/RoleAssignment/Lease/HumanRequest 的 append-only fold。
4. `ProfileLoader`：从 exact checkout 读取 ProfileRegistry/GateCatalog，校验 schema/version/digest。
5. `SubjectResolver`：contract/artifact/candidate/integration/decision subject 的 canonical digest。
6. `ReceiptValidator`：authority、actor separation、subject、policy、provenance、revocation、staleness。
7. `GateProjector`：从 Profile predicate + valid receipts 确定性重算 Gate；绝不接受外部 verdict 写入。
8. `RiskPlanner`：planned floor + observed impact 的单调 requirements 合成。
9. `CarrierRouter`：capability hard filter、unknown 三分流、deterministic tie-break、budget check、RouteDecision provenance。
10. `RoleCompiler`：RoleAssignment、procedure policy、forbidden authority、delegation budget。
11. `CommandPlanner`：authorization、write set、event/effect plan、合法 transition。
12. `RevisionCoordinator`：RevisionVector、compare-and-append、idempotency journal、ack 对账。
13. `SagaCoordinator`：intent-before-effect、effect receipt、retry/reconcile/outbox。
14. `ProjectionBuilder`：lifecycle/control/gate、Now/Why/Next、Action Center、Accountability/Invocation 两张图。

它们可以各自很小并有内部测试 Seam，但不进入外部 Interface。删除 Kernel 后，这些知识会重新出现在 CLI、Web、Skill 和 tests 四处；因此这个 Module 具有真正 **Depth**，也把变化集中成 **Locality**。

## 4. 依赖类别与 Adapter

| 依赖类别 | 本候选中的内容 | Seam / Adapter 策略 | 测试方式 |
| --- | --- | --- | --- |
| in-process | reducer、Profile predicate、Gate、risk 合成、Router hard filter/tie-break、projection | 直接放进 Kernel Implementation；不为每个纯函数造外部 port | 只从 `inspect/transact` 观察结果；少量内部性质测试可走私有 Seam |
| local-substitutable | exact checkout、Git facts、content-addressed evidence、本地 cache/lock、clock | Git production Adapter + 临时 Git repo Adapter；filesystem production Adapter + temp/in-memory Adapter。cache 不进入真源 Interface | 临时 repo 覆盖 ancestry/diff/dirty；删除 cache 后重建 |
| remote but owned | Desktop Task/Agent host、board execution、subagent harness、内部 live runner | 定义 `ExecutionPort`，至少有 Desktop/board、subagent/harness、in-memory 三个 Adapter；Role/Carrier 语义留在 Kernel | scripted Adapter 验证 dispatch intent、stable actor id、retry/reconcile |
| true external | GitHub、GitLab、人工答复、外部 browser/live 环境 | `TrackerPort` 至少有 GitHub、GitLab、memory Adapter；Human/Live 只发布 typed Receipt，不写 Gate | mock Adapter 模拟 timeout、ack lost、rate limit、permission denied、out-of-order event |

真实 Seam 的理由已经满足：tracker 至少 GitHub/GitLab 两个 Adapter；execution 至少 board/manual/subagent；测试还有 memory Adapter。不要再为只存在一个实现的纯计算制造公共 port。

`createStoryKernel(dependencies)` 的配置也是 Interface 一部分，必须约束：

- 每个 RepoLane 恰好一个 Tracker Adapter 和一个 exact checkout resolver；
- Adapter 声明 capability，但 capability 必须通过现场 preflight proof，不信自报；
- production Adapter 提供 stable adapter id/version/digest；
- clock/id generator 只为可重复测试注入，不能改变业务语义；
- Adapter 只能执行 Kernel 给出的 typed effect，不能自行推进 transition/Gate。

## 5. 取舍

### 这个候选得到什么

- **Leverage**：CLI、Web、Skill、自动化和 tests 共用同一套语义；修一次 Gate/Router/revision，所有入口同时生效。
- **Locality**：Receipt freshness、actor separation、Profile degraded、unknown 分流不再散落。
- 系统化但不提前引入 daemon、数据库迁移、进程监督、端口、部署、备份与多租户身份。
- 继续符合 tracker/repo 真源和“主会话死亡后可重建”；Kernel 进程本身没有需要恢复的记忆。
- 测试可以替换 Adapter、重建实例、注入崩溃，直接验证外部行为；不会为过内部函数而锁死 Implementation。
- 以后若确实需要常驻后端，同一 Kernel 可以原样被一个 HTTP/queue host 包住，CLI/Web 改接 remote Adapter，领域规则不重写。

### 这个候选付出什么

- 没有调用者时不会自己跑定时 reconcile、lease expiry、outbox retry 或 queue drain；AFK 进展依赖宿主 Agent/automation 周期调用。
- 每次 canonical inspect 可能重新读 tracker + checkout + evidence；长 story 会有 fold 延迟，需要 revision-tagged cache/snapshot，但 cache 仍非真源。
- 同机多进程可用 local lock + tracker conditional write；跨机器并发只能依赖 tracker 的 CAS/幂等能力，不能靠本地锁。
- GitHub/GitLab 未必提供理想的 compare-and-append。Adapter 可能需要 comment/event marker、ETag 或 read-after-write；其一致性上限必须如实暴露。
- network timeout 后“是否已写”可能暂时不可判。Kernel 必须承认 `ACK_UNRESOLVED`，不能为了简化 UI 把它伪造成 `NOT_COMMITTED`。
- Kernel package 与 Profile/Receipt schema 也有版本兼容责任；“同一个本地模块”不会自动消除升级漂移。
- 一个进程内调用仍可被长耗时 Adapter 卡住，所以 Kernel 只做短事务；Agent 执行、测试、人工等待必须异步化为 intent + receipt。

## 6. 哪些失效阈值会迫使升级为常驻后端

以下任一条被产品要求或实测触发，本候选失效。这里的“升级”优先指让同一 Kernel 由受监督常驻 host 承载；是否让其数据库成为新真源是另一项会改 Q18/Q19/Q35 的用户裁决。

| 硬阈值 | 为什么嵌入式不够 | 被迫升级后的最小职责 |
| --- | --- | --- |
| 两台及以上机器可同时写同一 Story/RepoLane，而 tracker Adapter 无法提供 conditional append、唯一 idempotency key 对账或可靠 writer lease | 本地锁无效，无法机械阻止双写/乱序 | 中心化 serial command processor + durable lease；或把 tracker 改造成可 CAS 的 ledger |
| 产品要求“一次命令原子修改多个 GitHub/GitLab RepoLane”，不接受 saga 的部分完成/补偿状态 | 跨两个外部 tracker 没有共同事务 | 先重新裁决 canonical ownership；需要中心事务记录和 outbox，但外部 tracker 仍只能最终一致 |
| 在没有任何 Agent、CLI、浏览器或 automation 调用时，lease 到期、超时、重试、outbox、next-wave 仍须在明确 SLA 内自动推进 | 嵌入式 Module 没有生命周期和时钟驱动者 | durable scheduler/queue/worker，持久 retry 与 dead-letter |
| 多用户远程访问要求中心 RBAC、session、quorum、审计签名与密钥隔离，不能把 tracker credential 放在每个调用宿主 | 进程内依赖注入无法形成统一安全域 | authenticated command host、secret custody、audit signer |
| 需要向多个客户端提供可靠 push（SSE/WebSocket）且事件在客户端离线后仍须补发 | 轮询 Adapter 没有订阅游标与保留策略 | durable event stream + subscription cursor |
| 在验收上限 Story 规模下，即便使用 revision-tagged snapshot，`inspect(canonical)` 仍不能达到产品读态 SLO，或 tracker rate limit 使正常刷新频繁 degraded | 每次 fold/远程读成本已进入公共行为 | materialized projection store + incremental consumer；仍需能从 tracker/repo 重建 |
| `ACK_UNRESOLVED` 在正常链路反复出现，且业务要求命令调用同步获得唯一终局，不允许稍后 reconcile | 调用进程无法跨断连持续查证 | durable command inbox/outbox 和后台对账；若仍要求 tracker canonical，终局仍受 tracker 可用性上限约束 |
| RoleAssignment/attempt 必须在宿主死亡后继续接收 heartbeat、强制超时、回收全局资源并自动改派，且这些动作不能等下一次用户调用 | 没有常驻 coordinator 就无法履行时间性保证 | supervised coordinator + durable timers + carrier callbacks |
| 多仓事件量或保留期超过 tracker payload/rate/查询能力，完整审计无法再由 tracker+repo 在可接受时间重建 | 当前真源分治的存储能力被实测击穿 | 需重新裁决事件真源；若引入中心 event store，这是 Contract/ADR 变化，不是透明实现升级 |

建议在 Goal Contract 里把阈值变成可测指标，而不是凭“感觉复杂”决定部署形态：

- 最大验收 Story 的 ticket/attempt/receipt 数；
- `inspect(canonical)` p50/p95 和 tracker 请求数；
- 同 Story 并发 writer 数与宿主数量；
- `ACK_UNRESOLVED` 率及最长恢复时间；
- 无调用者时是否有明确自动推进 SLA；
- 是否存在必须原子跨 RepoLane 的公共命令；
- 是否存在多用户中心授权/密钥托管要求。

## 候选判断（不是用户决定）

仓库事实支持“不能继续让 Skill 提示与零散 `.mjs` 各自拥有逻辑”；也支持先把逻辑做成一个深 Domain Kernel，而不是立刻新增权威后端。

最小可逆路径是：

```text
现在：Skill/CLI/Web/tests → embedded Story Domain Kernel → typed Adapters
触发阈值后：Skill/CLI/Web → remote Adapter → supervised Kernel host → same typed Adapters
```

真正难逆的不是“有没有 server 进程”，而是“谁拥有 canonical revision、command serialization 和 durable timers”。只要 tracker/repo 仍是真源、v1 命令保持 lane-scoped、显式或宿主周期 reconcile 可接受，嵌入式 Kernel 的 Depth/Leverage/Locality 足以承接复杂逻辑；一旦命中上表硬阈值，才有证据把它部署成常驻后端，甚至重新裁决真源。

## 证据完整性与置信度

- 已完整读取：本 Issue 的 `context.md`、`rounds.jsonl`（47 条当前记录）、`v3-role-skill-carrier-model.md`、`impact-surface.md`、`workflow-interview/scripts/session.mjs`。
- 已检查 `aes-worktree-board/scripts` 全部文件的 imports/exports/规模，并深读状态存储、job store、outbox、risk/Gate、Issue Contract、Human Request、runner、collect、dispatch、server、`master.mjs`/`orchestrate.mjs` 的状态与恢复主路径，以及 v4/trajectory/selftest 的调用形态。
- 事实置信度：高（本地当前 checkout）。
- 设计判断置信度：中高；决定因素不是代码行数，而是上表常驻性、跨主机并发、跨 lane 原子性和 SLO 是否被最终 Contract 要求。
