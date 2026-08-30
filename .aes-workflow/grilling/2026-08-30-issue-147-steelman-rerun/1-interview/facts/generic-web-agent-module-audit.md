# 通用 Web + Agent Workflow Surface Module 审计

> 只读事实分片；不替用户裁决。审计对象是 `skills/workflow/workflow-interview-web/` 的 `SKILL.md`、`references/web-protocol.md`、`server.mjs`、`publish.mjs`、`wait-submit.mjs`、`lib/continuation.mjs`、`lib/dossier.mjs` 及两组回归测试。没有修改 manifest、rounds、context、prototype 或产品代码。

## 1. 问题与结论边界

问题：现有 `workflow-interview-web` 中，哪些能力足以提炼成供多个 Workflow 共用的 Web + Agent 通信 **Module**；该 Module 的 **Interface** 最少应是什么；哪些 interview-specific 逻辑必须留在 Adapter 后面？

### 排名综合判断

| 排名 | 判断 | 置信度 | 证据性质 |
|---|---|---:|---|
| 1 | 现有实现已经验证了一块值得独立存在的通用底座：耐久提交、分层回执、恢复/消费幂等、fenced continuation、受限历史投影、loopback Web Host 与安全附件。 | 高 | 代码与 23 个黑盒检查共同证明。 |
| 2 | 不能把整个 `workflow-interview-web` 直接改名为通用模块；三阶段、round/item DSL、Goal Contract dossier 与 issue 目录知识占据了发布、校验、投影、导出四条主路径。 | 高 | `publish.mjs`、`dossier.mjs`、协议 schema 的直接证据。 |
| 3 | 最深的外部 **Seam** 应是一个最多 3 个 entry point 的 `WorkflowSurfaceModule`；现有 5 个脚本命令与 `continuation.mjs` 的 20+ exports 应隐藏在 Implementation 或内部 Adapter 后面，而不是成为新 Interface。 | 中高 | 基于删除测试、现有调用复杂度和已验证不变量的设计推论。 |

**结论（Inference）**：有必要做通用 Module，但它应是 `workflow-story-map` 与 `workflow-interview-web` 下方的“交互/恢复 substrate”，不是新的 Story 编排真源。这样不与 ADR-0001 的“`workflow-story-map` 是独立组合层编排技能”冲突；若让通用 Module 接管 story → 拆解 → 派发 → 收口，则会直接冲突 ADR-0001（`docs/adr/0001-整合落点为独立组合层编排技能.md:21-24`）。它也不应直接写 Tracker；ADR-0004 已规定编排脚本是 Tracker 状态唯一写入者（`:25`）。

## 2. 当前实际调用链

```text
Workflow Agent
  ├─ publish.mjs round
  │    ├─ validate interview round/item/response/final
  │    ├─ copy attachments
  │    ├─ rewrite web/state.json
  │    └─ append round_published ledger
  ├─ server.mjs start/serve
  │    ├─ loopback auth + static SPA
  │    ├─ GET state/history/export/files
  │    └─ POST submit
  │          ├─ validate interview answer DSL
  │          ├─ create-once submission file
  │          ├─ append round_submitted ledger
  │          └─ update state projection + notify browser
  └─ wait-submit.mjs
       ├─ scan oldest → recovery payload
       ├─ claim consume
       ├─ Agent separately calls family session.mjs round
       └─ mark consumed → ledger + marker

Optional Host authority
  └─ continuation.mjs
       arm → watch-first/recheck → persisted → agent_resumed → consumed
       failure/expiry/server stop → manual_followup
```

`SKILL.md:10-16` 明确它只是 interview 家族的交互/档案投影，不是第二套访谈逻辑；`SKILL.md:24-36` 又要求 Agent 自己依次 scan、取 recovery payload、调用 family `session.mjs round`、最后 mark consumed。也就是说，当前通用 runtime 已经存在，但它的 Leverage 被多个 CLI 步骤和 interview 映射知识泄漏稀释。

## 3. 真正通用能力与 interview-specific 逻辑

### 3.1 可以进入通用 Module Core 的能力

| 能力 | 直接证据 | 应保留的不变量 |
|---|---|---|
| create-once durable submission | `server.mjs:79-90, 586-666` | HTTP 成功前先持久化；同一开放 step 第一份为准；投影失败不能伪装答案丢失。 |
| revision/digest 绑定 | `server.mjs:614-625`; `continuation.mjs:464-475` | submission 必须绑定发布时的 step revision/digest；消费幂等键包含 instance/step/revision/digest。 |
| processing → committed 消费协议 | `continuation.mjs:807-869` | workflow domain 成功吸收前不得标 consumed；重试复用同一 key；冲突 fail closed。 |
| continuation authority 与 fencing | `continuation.mjs:478-597` | 自动恢复只能由 Host authority 创建；generation 单调；旧 owner 不能写新 lease/receipt。 |
| watch-first + immediate recheck | `continuation.mjs:616-684, 687-780` | 先建立 watcher 再检查文件，关闭事件/重命名竞态；普通 watcher 不自动取得 continuation authority。 |
| 分层回执 | `continuation.mjs:393-461`; `web-protocol.md:76-88` | `persisted`、`agent_resumed`、`consumed` 不得合并；200 最多证明 persisted。 |
| manual fallback | `continuation.mjs:375-461, 577-596` | capability 未证明、lease 过期、server 停止或等待失败时保留 submission 并转人工恢复。 |
| bounded Agent recovery | `continuation.mjs:325-345` | 默认只把当前 step 的问题/输入送回 Agent；历史量增长不能线性污染恢复上下文。 |
| bounded Web projection + cursor history | `continuation.mjs:270-323` | 默认窗口有界；旧历史显式分页；完整导出与默认状态读取分离。 |
| loopback Dev Host 安全 | `server.mjs:100-109, 157-173, 247-280, 499-524, 670-711, 731-757` | loopback、session key、HttpOnly/SameSite cookie、Origin 校验、附件 basename/非 symlink、无缓存。 |
| 安全公开投影 | `continuation.mjs:127-163, 230-238, 393-461` | owner nonce、pid、token、raw lease 不得进入 Web projection 或 export。 |
| event digest 与离线 artifact primitives | `dossier.mjs:26-74, 84-110, 369-384` | stable digest、附件摘要/内嵌、安全导出路径可复用；domain-specific HTML 不进入 Core。 |

### 3.2 必须留在 Workflow Adapter 后面的逻辑

| interview-specific 内容 | 直接证据 | 处置 |
|---|---|---|
| 固定三阶段 `1-interview/2-prototype/3-contract` | `publish.mjs:17, 159-184, 201-215` | 留在 `InterviewSurfaceAdapter`；Core 只认识 opaque `workflow_kind` 与 `step_id`。 |
| `ask/default/confirm`、response types、pct=100±2、QID | `publish.mjs:18-20, 72-157`; `server.mjs:333-452` | 这是 interview 表单 DSL。可作为一类 renderer/input Adapter，但不能成为所有 Workflow 的 Interface。 |
| `round.no` 排序、round/locked/open_ambiguities/final | `publish.mjs:266-295` | Core ordering 改用持久 commit sequence/cursor；这些字段留在 interview projection。 |
| `manifest.json`、`1-interview/context.md`、`3-contract/contract.md` | `dossier.mjs:113-125, 174-223` | 由 dossier Adapter 提供 domain source collector；Core 不探测这些路径。 |
| Goal Contract 决策档案、traceability、authority 文案 | `dossier.mjs:128-154, 203-223, 279-367` | `GoalContractDossierAdapter` 专属；通用 Core 只提供 event/artifact envelope 与 digest。 |
| `workflow-interview-web` actor/id、`WI_WEB_*`、内置 SPA 路径 | `dossier.mjs:58-73`; `server.mjs:31-35, 192-239, 472-480, 702-711` | actor/config/app assets 由 Host/Workflow Adapter 注入。 |
| “请继续”、`current_turn_deferred` 的 Codex task 语义 | `SKILL.md:31-36, 57-71, 86-94` | 通用状态可保留 persisted/resumed/consumed，但具体唤醒方式由 `ContinuationAdapter` 映射。 |

### 3.3 不应假通用化的内容

- 不要把 `round` 机械改名成 `node`，再原样暴露 `publish/scan/recovery-payload/history/claim/mark-consumed`。这只是命名变化；caller 仍需记住 6 步 ordering，Module 是 shallow 的。
- 不要让通用 Module 读取或写 `rounds.jsonl`、Tracker、Repo contract。现有边界本来就规定 Web 文件不是家族真源（`SKILL.md:24-27, 75-82`）。
- 不要要求所有 Workflow 使用同一问卷 DSL。Story map 的状态板、人工 Gate、命令确认与 interview 的候选问答不是同一 presentation；共享 transport/envelope，不强迫共享完整 UI schema。

## 4. 当前 Implementation 为什么还不能直接承担通用模块

### 4.1 并发下的 ledger/state 不是单一事务

**Evidence**：`appendLedgerEvent` 先读完整 ledger 取尾摘要，再直接 append（`dossier.mjs:50-73`），没有与 publish/submit 共用的锁。`publish.mjs:259-309` 又是 read state → merge/sort → rename state → append ledger；`server.mjs:614-666` 则先独占写 submission，随后分别写 ledger 和 state，异常只返回 `submission_persisted_projection_pending`。

**Inference**：单 submission 的“先落盘”是正确的，但多个 publisher/submitter 并发时，两个事件可能引用同一个 previous digest，或一个 state rewrite 覆盖另一个发布。现有测试只验证单 writer 的链顺序（`run-continuation-tests.mjs:396-404`），没有证明 multi-writer linearizability。通用 Core 必须用一个 serialized command journal/CAS 形成权威 ordering；state、ledger、Web projection 都从同一 commit sequence 派生。

### 4.2 Interface 过宽且泄漏恢复协议

**Evidence**：`wait-submit.mjs` 暴露 wait、scan、oldest、claim、mark、recovery-payload、history 七类用法（`:142-169`）；`continuation.mjs` 对外导出路径、锁、读写、投影、lease、wait、consume 等 20+ symbols。

**Inference**：这些 exports 对实现测试有价值，但不应是 Workflow caller 的 Interface。caller 被迫承担“scan → recovery → family write → mark”的正确 ordering，Locality 很差：每个新 Workflow 都可能重新实现崩溃恢复和去重。

### 4.3 transport、domain validation、projection、artifact 互相穿透

**Evidence**：`server.mjs` 同时处理 token/cookie/HTTP/WS、interview answer validation、文件存储、ledger、dossier 与 HTML export（`:23-29, 333-452, 499-715`）；`dossier.mjs` 反向 import continuation projection（`:15`），并硬读三阶段目录。

**Inference**：这是一个可工作的垂直 prototype，但不是可替换 Host。若直接搬进 AesAgent，Skill Dev Host 与 AesAgent Host 会产生两份几乎相同的 domain logic。

### 4.4 其他需要在提炼时纠正的点

- `sha256Json` 在 `continuation.mjs:36-44` 与 `dossier.mjs:26-34` 重复；应收敛到 Core implementation。
- `/shutdown` 使用有副作用的 GET（`server.mjs:696-699`）；只适合 owner-only Dev Host 兼容入口，不应成为 AesAgent Host Interface。
- 当前 WebSocket 只做 server → browser 通知，收到 client data 只 touch idle timer（`server.mjs:731-756`）。通用 Interface 应表达 `follow(cursor)` 语义；Dev Host 可用 SSE/WS，AesAgent 可用既有事件 transport，Core 不承诺某一种 wire protocol。
- 文件 watcher 是 Dev Host Adapter 的优化，不是正确性真源；正确性来自 durable inbox + recheck。

## 5. 推荐的深 Workflow Surface Module Interface（3 个 entry points）

外部 **Seam** 面向 Workflow/Agent caller；Browser 不直接调用 Core，而是通过 `HostTransportAdapter` 的内部 seam。Module construction 时注入 Store、Host、Continuation 与 Workflow adapters，调用方日常只学习以下 3 个 entry points：

```ts
interface WorkflowSurfaceModule {
  present(command: PresentCommand): Promise<PresentReceipt>;
  resume(command?: ResumeCommand): Promise<ResumeReceipt>;
  observe(query: ObserveQuery): Promise<SurfaceProjection | ExportArtifact> | AsyncIterable<SurfaceEvent>;
}
```

### 5.1 `present`

用途：发布或修订一个可交互 step，原子持久化 command/event/projection，复制并摘要附件，启动或复用当前 Host projection。

最小 caller 输入：

```ts
type PresentCommand = {
  command_id: string;                 // retry idempotency
  workflow: { kind: string; instance_id: string };
  expected_instance_revision: number;
  step: {
    id: string;
    revision: number;
    content: unknown;                 // Workflow Adapter owns schema
    input_contract: unknown;          // Workflow Adapter validates
    attachments?: ArtifactRef[];
  };
};
```

**Interface invariants**：

1. `{kind, instance_id, step.id, step.revision, digest}` 是不可变发布身份。
2. `expected_instance_revision` 做 CAS；冲突返回 `REVISION_CONFLICT`，不得 last-write-wins。
3. 同 `command_id` 重试返回同 receipt；不同 command 修改已有 persisted submission 的 step 返回 `STEP_ALREADY_SUBMITTED`。
4. 成功 receipt 只在 journal 与 projection 同一 commit sequence 可重放后返回；通知失败不回滚已提交状态，而返回可重放的 projection lag 状态。
5. Core 不解释 `round`、三阶段、Role、Gate 或 Goal Contract；这些全由 Workflow Adapter 提供。

### 5.2 `resume`

用途：恢复最早未处理 input，并在 Module 内完成 claim → 调用已注册 `WorkflowAdapter.absorb` → commit；workflow caller 不再手写 claim/mark ordering。

```ts
type ResumeCommand = {
  command_id: string;
  workflow: { kind: string; instance_id: string };
  selection?: 'oldest';               // v1 只允许 oldest，避免顺序歧义
  expected?: { step_id: string; revision: number; digest: string };
};
```

**Interface invariants**：

1. 选择顺序按 store commit sequence，不信任 workflow 自报的 `no`。
2. 恢复载荷只含当前 step 的发布 envelope 与用户原始输入，大小对历史长度为 O(1)。
3. `absorb` 成功后才 commit consumed；异常保留 pending/processing，可用同一 idempotency identity 重试。
4. receipt 明确区分 `persisted`、`domain_applied`、`consumed`；AesAgent 的 `agent_resumed` 是 Host receipt，不替代 domain applied。
5. identity/digest 冲突、Adapter 无法证明适配、Host capability 不可用全部 fail closed。

### 5.3 `observe`

用途：读取 current/bounded history、生成自包含 export，或从 cursor follow 事件。查询永不取得写 authority。

```ts
type ObserveQuery =
  | { kind: 'current'; workflow: WorkflowRef; previous?: number }
  | { kind: 'history'; workflow: WorkflowRef; before?: EventCursor; limit: number }
  | { kind: 'export'; workflow: WorkflowRef; format: 'self-contained-html' }
  | { kind: 'follow'; workflow: WorkflowRef; after?: EventCursor; signal?: AbortSignal };
```

**Interface invariants**：

1. current 默认有界；history 必须 cursor 分页；只有 export 可读取完整轨迹。
2. public projection 永不包含 token、owner nonce、pid、raw lease、内部路径或未授权附件。
3. follow 是 cursor-based at-least-once notification；消费者必须以 projection revision 去重，不能把一次 socket event 当作业务成功。
4. export 的 renderer/source collector 由 Workflow Adapter 提供，Core 只保证引用的 event/artifact digest 与导出 manifest 一致。

### 5.4 统一错误闭集

| 错误 | 含义与恢复 |
|---|---|
| `REVISION_CONFLICT` | instance/step 已推进；caller 重新 observe 后重算，不覆盖。 |
| `COMMAND_ID_CONFLICT` | 同 command id 对应不同 payload；fail closed，保留双方 digest。 |
| `STEP_NOT_OPEN` / `STEP_ALREADY_SUBMITTED` | 输入指向错误或已锁定 step；返回当前 authoritative identity。 |
| `INPUT_REJECTED` | Workflow Adapter 结构校验失败；不产生 submission committed event。 |
| `SUBMISSION_CONFLICT` | 同 step 不同首次输入；第一份不被覆盖。 |
| `STALE_OWNER` / `LEASE_EXPIRED` | continuation fencing 失败；转 manual recovery，不丢 input。 |
| `HOST_CAPABILITY_UNAVAILABLE` | Host 不能自动恢复；公开状态只承诺 manual follow-up。 |
| `DOMAIN_APPLY_FAILED` | input 已 persisted 但 workflow 未吸收；保持 pending/processing，允许幂等重试。 |
| `STORE_UNAVAILABLE` | 不返回 persisted；Browser/Agent 明确可重试。 |
| `PROJECTION_LAGGING` | authoritative journal 已提交但 Web projection 待重建；receipt 带 commit cursor。 |

## 6. 内部 Seams、Adapters 与依赖分类

```text
Workflow / Agent
       │ present · resume · observe
       ▼
WorkflowSurfaceModule  ← external Seam
  ├─ command journal + state machine + idempotency + projection rules
  ├─ internal WorkflowAdapter seam
  ├─ internal SurfaceStoreAdapter seam
  ├─ internal HostTransportAdapter seam
  ├─ internal ContinuationAdapter seam
  └─ internal Artifact/ExportAdapter seam
```

| 内部 Seam | 至少两个真实 Adapter | 依赖分类 | Core 隐藏什么 |
|---|---|---|---|
| `WorkflowAdapter` | Interview、Story Map、未来 Workflow | in-process / owned | content/input schema、domain absorb、domain projection、export renderer。 |
| `SurfaceStoreAdapter` | Skill Dev Host file/embedded store、AesAgent SQLite、in-memory test | local-substitutable | journal serialization、CAS、idempotency、projection rebuild。 |
| `HostTransportAdapter` | loopback Dev Host、AesAgent RPC/WebSocket Host | remote-but-owned / in-process | auth、cookie/RPC identity、static assets、notify、start/stop。 |
| `ContinuationAdapter` | manual message、AesAgent host resume | remote-but-owned | capability preflight、lease/fencing、resume receipt；Core 只消费 normalized result。 |
| `ArtifactExportAdapter` | directory/data-url Dev Host、AesAgent Artifact store | local-substitutable / owned | copy/hash/access/export packaging。 |

这些 Seam 都有至少两个实际 Adapter，不是为测试虚构。外部 Tracker、GitHub/GitLab、Repo Registry 不属于 Surface Module 依赖；它们仍由 Story Workflow/Adapter 按既定真源协议处理。

## 7. Skill 高频迭代时的 Dev Host 用法

Dev Host 的目标不是模拟完整 AesAgent，而是让同一个 Workflow Adapter 和同一组 Core invariants 在本地快速循环：

```ts
const surface = createWorkflowSurfaceModule({
  workflow: storyMapSurfaceAdapter,
  store: fileOrEmbeddedDevStore,
  host: loopbackWebHost,
  continuation: manualFollowupAdapter,
  artifacts: directoryArtifactAdapter,
});

const shown = await surface.present(viewCommand);          // 返回 URL + commit cursor
const resumed = await surface.resume({                     // 用户“请继续”后调用
  command_id: 'resume-...', workflow, selection: 'oldest'
});
const dossier = await surface.observe({                    // 回看/静态归档
  kind: 'export', workflow, format: 'self-contained-html'
});
```

CLI 只是 Adapter：`present`、`resume`、`observe/export` 三个命令映射同名 entry points。Browser 的 submit/history/follow routes 属于 loopback Host Implementation，不扩张 Agent Interface。集成到 AesAgent 时，只替换 Store/Host/Continuation/Artifact adapters；Story Map 的 Workflow Adapter 与核心状态机不复制。

## 8. 现有代码：可复用、需迁移、必须从通用 Core 删除

### 8.1 可复用为 Implementation 的代码/测试

- `server.mjs:63-90` 的 atomic write/create-once 模式；但必须由单一 Store Adapter 统一 serialization。
- `server.mjs:100-109, 247-280, 499-524, 670-711` 的 loopback auth、Origin、cookie、safe file checks，作为 Dev Host Adapter。
- `continuation.mjs:488-597` 的 generation/owner fencing，`:621-780` 的 watch-first/recheck，`:807-869` 的消费幂等算法，收进 Core/Continuation implementation，不再逐项 export。
- `continuation.mjs:270-345` 的 bounded history/recovery 原则；字段命名从 round/q_id 泛化为 step/input。
- `dossier.mjs:26-38, 84-110, 369-384` 的 stable digest、safe traversal、self-contained artifact primitives。
- 回归资产整体保留为新 Interface 的黑盒合同：先落盘再回执、409/create-once、manual fallback、watch race、fencing、crash replay、O(1) recovery、bounded history、secret non-disclosure、path traversal。

本次在当前 HEAD 实跑 `node skills/workflow/workflow-interview-web/run-tests.mjs`：runtime `16/16 passed`，continuation `7/7 passed`。这证明单实例已声明行为，不证明 multi-writer ordering。

### 8.2 迁入 Workflow-specific Adapters

- `publish.mjs:17-215` 的三阶段与 interaction schema → `InterviewSurfaceAdapter`。
- `server.mjs:333-452` 的 answer normalization → 对应 Workflow/Input Adapter；若未来抽出共享表单 primitives，也只能作为可选 renderer library。
- `dossier.mjs:113-223, 279-367` → `GoalContractDossierAdapter`。
- 当前 `scripts/web/` → interview Web Adapter；Story Map 保持自己的页面，不要求 fork 后改同一 SPA。

### 8.3 必须从通用 Core 删除/隐藏

- `STAGES/TIERS/RESPONSE_TYPES`、`defaultPhases`、`validateFinal`、`round.no`、`q_id`、`open_ambiguities`、Goal Contract 字符串和三阶段目录扫描。
- 重复 CLI argument parser、重复 `sha256Json`、直接读写固定 `web/state.json` 的 caller-visible 约定。
- caller-visible 的 scan/claim/mark-consumed 组合；它们只能是 `resume` 内部 transaction steps。
- Core 对 bundled SPA、`WI_WEB_*`、浏览器启动命令、GET shutdown、具体 WS framing 的知识。
- 任何“普通 CLI flag 可以声明自动续接”的路径；现有代码已经正确拒绝，通用化时必须保持。

### 8.4 删除测试（Depth）

- 若删除这个推荐 Module，所有 Workflow 都要重新实现 durable inbox、revision binding、claim/commit、fencing、fallback、bounded projection、auth 与 export；复杂度会在 N 个 Skill 和 AesAgent extension 中重新出现。因此它能产生 Leverage 与 Locality。
- 若“模块”只是包装 `publish.mjs`、`wait-submit --scan/--claim/--mark` 和 `server.mjs`，删除后 caller 只需恢复原命令调用，复杂度没有消失；这是 shallow pass-through，不值得成为长期 Extension seam。

## 9. 尚未被仓库证据解决的 Unknowns

1. 多个 Workflow 是否要共享一套 presentation primitives，还是 Core 只传 opaque content、每个 Workflow 自带 Web renderer；本审计只证明 transport/recovery 可共享，不能证明 UI schema 应统一。
2. Skill Dev Host 的 Store 应继续用单 writer file journal，还是直接使用 embedded SQLite；当前测试没有 multi-process benchmark，也没有 crash-at-every-write-point fault injection。
3. AesAgent Extension 的最终注册/权限/事件 Interface 未在本分片审计；这里的 Adapter 形状需要在 AesAgent 当前代码上另行验证。
4. 自动 continuation 在 AesAgent 中能否提供真实 host-owned authority；现有 Skill 的正确默认仍是 manual follow-up。
5. self-contained export 是所有 Workflow 的共同需求还是可选 capability；若不是共同需求，`observe(export)` 可以由 Host capability 返回 `UNSUPPORTED`，不应强制每个 Adapter 实现。

这些 Unknown 不影响第一层结论：通用化的正确对象是 durable interaction/resume substrate；不是 interview DSL，也不是 Story orchestration authority。
