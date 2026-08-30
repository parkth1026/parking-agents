# AesAgent Workflow Surface seams 审计

> 状态：只读事实与架构候选，不是用户裁决，不推进 prototype。  
> 审计对象：`G:\GIT\AI_WorkFlow\aes-agent`，`main@a57b93fe6f07e38af7e13a1603cbb3a652bd145e`。  
> 问题：怎样保留高频 `Skill + Web` 开发形态，同时让同一 Workflow Extension 最终进入 AesAgent，而不复制两套 Web↔Agent 语义。  
> 词汇：严格采用 **Module / Interface / Seam / Adapter / Depth / Leverage / Locality**。

## 结论先行

**当前代码支持“同一 Workflow Extension、两个 Host Adapter”的方向，但还没有这个完整 Seam。**

- `aes.workflow-platform` 已经拥有可复用的版本化 wire、Runtime operation、Viewer document、Plugin/Workflow/Prompt/Viewer digest 与 Registry；它应成为通用 Surface Protocol 的语义种子，而不是被 StoryControl 重新发明。
- AesAgent 已经拥有适合作为 Product Host 的 durable command/event/projection、Provider lifecycle、RPC/WS、MCP、Artifact integrity 与 Plugin lifecycle；这些应留在 `AesAgentHostAdapter` 后面。
- 当前缺少一个由 `SkillDevHostAdapter` 与 `AesAgentHostAdapter` **共同实现**的 host-neutral Interface：协议协商、命令收据、revision/cursor、订阅恢复、projection schema、artifact read 与 actor grant 现在散在 AesAgent contracts、WS、MCP handler 和 Web store 中。
- 通用 Surface 只能拥有“人和 Agent 怎样观察、提交、续传”的交互语义；`StoryControl` 继续拥有 StoryRoot、RepoLane、Role/Carrier Router、Receipt/Gate、Tracker/Repo 真源和风险规则。把这些放进通用 Surface 会得到一个浅、巨大的万能 Module。
- 第一版不应新增第二种顶层 Plugin contribution kind。最小兼容做法是在现有 `contributions.workflow` 的 `WorkflowContribution` 内嵌一个 versioned `surface` contribution，使 Runtime、Surface、Prompt 和 Viewer 共享同一个 immutable release identity。只有未来出现“非 Workflow 产品也需要 Surface”这一第二个真实用例时，才有证据引入新的 contribution kind。

推荐候选结构（仍待用户裁决）：

```text
Workflow Extension source/release
├─ Workflow declaration / Runtime / Validators
├─ Surface contribution (commands, projections, UI, agent ingress schemas)
└─ exact version + content digest
                  │
        WorkflowSurfaceHost Interface
    negotiate / submit / watch / readArtifact
         ┌────────┴─────────┐
SkillDevHostAdapter   AesAgentHostAdapter
local Node host       server/orchestration/plugin/provider
         └────────┬─────────┘
             Web / Agent Adapters
```

## 1. 当前可以直接复用的 Module

| 需要的能力 | 当前证据 | 判断 |
| --- | --- | --- |
| Versioned Workflow wire | `packages/workflow-platform/src/wire.ts:22-23` 固定 package `1.9.0` 与 `aes.workflow-platform/v1`；`:76-87` 定义 exact Binding identity。 | **可复用。** 不应在 Skill 仓再定义另一套 Run/Artifact/Interaction 基础类型。 |
| Extension declaration | `wire.ts:737-775` 把 Workflow、Plugin manifest 与 declaration 编码成 Schema；`v1.ts:508-755` 校验 capability、interaction、artifact role、stage、viewer/runtime/prompt digest。 | **可复用并扩展。** Surface contribution 应进入同一 declaration/digest。 |
| Runtime instruction/operation seam | `runtime.ts:12-42` 固定 callable method set；`v1.ts:103-159` 定义 Runtime context/callback；`:238-298` 以 operation 返回状态、Provider turn、interaction、artifact、attempt、workspace operation。 | **已有高价值基础。** 但它是 Plugin Runtime Interface，不是 Host Interface。 |
| Declarative Viewer | `ui.ts:142-286` 定义可解码 Viewer node/document；`:302-343` 让 Plugin Viewer 从稳定 context 生成 document，并绑定 integrity material。 | **部分可复用。** 适合通用、host-rendered UI；node/action 扩展机制不足，见缺口。 |
| Exact registry resolution | `v1.ts:475-503,809-981` 的 Registry 按 exact plugin/workflow/prompt version+digest resolve，missing/mismatch fail closed。 | **可直接复用。** Dev Host 也应采用相同 resolve 行为。 |
| Durable command/event/projection | `apps/server/src/orchestration/Layers/OrchestrationEngine.ts:108,169-204,236-274` 串行 command，检查 command receipt，并在一个 SQLite transaction 中写 event、projection、receipt。 | **Product Host 强项。** 属于 AesAgent Adapter 的 Implementation，不应搬进 protocol。 |
| Workflow recovery | `apps/server/src/orchestration/Layers/WorkflowExecutionReactor.ts:135-220,748-834` 从持久投影发现可恢复 completion/message，并由 domain event 重新入队。 | **Product Host 强项。** Dev Host 可声明较低 durability，但不能伪装等价。 |
| Artifact integrity | `WorkflowArtifactStore.ts:60-73,75-128,130-205` 校验 digest，content-first/metadata-last 原子写，并要求 stored metadata 与 authoritative projection 完全相符；`ws.ts:1291-1322` 先查权威 Run 再读 bytes。 | **可作为 AesAgent Artifact Adapter。** Protocol 只暴露 immutable reference/read result。 |
| Web request + live stream | `packages/contracts/src/orchestration.ts:78-93,2316-2372` 提供 command/query 与 thread snapshot/event/synchronized stream；`packages/client-runtime/src/state/orchestration.ts:1-78` 把它们绑定为 Web state。 | **传输存在，Host-neutral handshake 不存在。** 方法名、scope 和 contracts 均属于 AesAgent orchestration。 |
| Agent ingress | `apps/server/src/mcp/toolkits/workflow/tools.ts:47-126` 与 `handlers.ts:1238-1244` 提供三个 capability-scoped Workflow tools。 | **已有一种 Agent Adapter。** 不是通用 Agent Interface，也不能承载任意 Workflow action。 |
| Plugin lifecycle | `plugin/manifest.ts:15-29` 允许 contribution record、platform range、release digest；`PluginManager.ts:858-1265` 具备 install、enable/disable、drain/remove、Run lease；`plugin-build.ts:106-181` 定义 portable payload digest。 | **Product Host 强项。** Promotion 到 AesAgent 应使用这条 immutable release 路径。 |
| Installed runtime isolation | `installedWorkflowAdapter.ts:181-300` 加载 `contributions.workflow` 并绑定 installed identity；`IsolatedPluginHost.ts:22-90` 子进程隔离、串行调用、timeout/restart backoff。 | **可复用，但不是 durable Workflow Host。** 它只隔离 Plugin callback。 |

## 2. 当前缺失能力与影响

### 2.1 没有 Host-neutral Interface

当前公开的是三组不同的 Interface：

1. Plugin 作者面对 `WorkflowRuntimeContribution`；
2. Web 面对 `orchestration.*` RPC 和 Thread subscription；
3. Agent 面对三个 MCP tool。

它们没有共同的 handshake、actor/grant、command schema catalog、projection schema catalog、cursor epoch 或 conformance contract。删除 AesAgent 后，SkillDevHost 无法只实现一个小 Interface 即复现相同行为；它必须复制 contracts、MCP handler、WS 和 Web store 的知识。这说明缺少的 Module 具备真实 **Depth** 机会。

### 2.2 当前 aggregate 与 StoryControl 不同

`OrchestrationEngine.ts:78-98` 的 aggregate 只有 `project | thread`，除 project command 外全部落到 Thread；`wire.ts:1118-1154` 的 `WorkflowRun` 是单一 Binding/Run 的状态。它们不能原样表示跨 Thread、多 RepoLane 的 StoryRoot。

因此：

- Surface Protocol 可以 host-neutral；
- 但 StoryControl 必须保持独立领域 Module；
- `AesAgentHostAdapter` 可以复用 engine 模式，不能把 StoryRoot 假装成现有 Thread Run。

### 2.3 Viewer extension 目前不是完整 Web extension seam

- `ui.ts:64-70` 的 action 只有 `revise-interaction`；`:142-160` 的 node union 是封闭集合。
- `WorkflowViewerReadResult.view` 在 `wire.ts:1206-1213` 仍为 `Unknown`。
- Web 在 `WorkflowViewerSurface.tsx:75-83,405-426` 对 `agent-inspector-v1` 做 Host 硬编码；不是已知 Viewer document 时退化为 raw JSON。

这意味着 Plugin 可以输出自定义数据，却不能只靠 Plugin 安装一个新的、安全的交互 renderer。一个通用 Surface 应明确分两档：

1. **默认档：** versioned declarative nodes，由 Host Web renderer 渲染；安全、可跨 Host conformance。
2. **可选档：** exact-digest、权限受控的 renderer contribution；若第一版没有两个真实 renderer Adapter，则先不开放任意 JS。现有 `html-preview` 的 `scripts-disabled` 语义可继续用于非权威视觉输出。

### 2.4 Agent ingress 过窄且逻辑重复

MCP 目前只允许 publish interaction candidate、publish artifact、request fresh handoff。业务校验、revision retry、projection polling 大量位于 `handlers.ts:198-1236`；同类 operation 分派又在 `WorkflowExecution.ts:1870,2038,2233,2525` 四处重复 switch。

推论：应把“验证 command envelope → 调 Runtime/Domain Kernel → 生成 durable effects/receipt”的复杂度收进深 Module。MCP、Web、CLI 都只做 Adapter，不各自维护一套行为。否则增加每个 Workflow action 都要同时改多条入口，Locality 很差。

### 2.5 没有显式协议协商

AesAgent Server config 只广告 shell/thread pagination 等 Host flags；Workflow client 直接假定当前 RPC contracts。现有 Plugin 有 `platformRange`，但浏览器与 Agent 并不会协商：

- Surface protocol major/minor；
- command/event/projection schema；
- UI node/renderer capability；
- resume cursor/retention；
- actor grants；
- active Extension identity/digest。

对单一 AesAgent release 这尚可工作；对 SkillDevHost 与 AesAgent 双宿主会产生静默漂移，必须补 typed handshake。

## 3. 候选 host-neutral Interface

`WorkflowSurfaceHost` 是外部 Seam。Interface 只保留四个 operation，复杂度隐藏在 Adapter 后：

```ts
interface WorkflowSurfaceHost {
  negotiate(hello: SurfaceClientHello): Promise<SurfaceWelcome>;
  submit(command: SurfaceCommandEnvelope): Promise<SurfaceCommandReceipt>;
  watch(request: SurfaceWatchRequest): AsyncIterable<SurfaceFrame>;
  readArtifact(ref: SurfaceArtifactRef): Promise<SurfaceArtifactContent>;
}
```

### 3.1 Interface 不变量

1. `negotiate` 在任何 mutation 前完成；unsupported major、missing required capability、schema/digest mismatch 必须 fail closed。
2. `submit` 必须带 `commandId + idempotencyKey + actorProof + grants + subject + expectedRevision + commandSchema + payloadDigest`。
3. 同 idempotency key、同 canonical payload 返回同 receipt；同 key、不同 payload 返回 typed conflict。
4. receipt 只说明 Host 对 command 的处理结果；Story tracker ack 等业务完成语义仍由 StoryControl 定义，Surface 不将 local accepted 改名为业务 committed。
5. `watch` 只产生 `snapshot | event | synchronized | resync-required`；每帧含 `hostEpoch + cursor + instanceRevision + projectionSchema`。
6. cursor 超出保留期、Host epoch 改变或贡献 digest 改变，必须 `resync-required`，不能继续应用旧 delta。
7. Web 与 Agent 都通过同一个 `submit` 语义；区别来自 actor proof/grants 与 command schema，不来自另一本 handler 状态机。
8. Artifact bytes 与 projection 分离；read 时核验 immutable ref/digest，UI 不内联无限大证据。
9. Interface 不出现 `ThreadId`、SQLite、Effect、React、MCP、WebSocket、ProviderInstance 或 filesystem path。这些属于 Adapter Implementation。

### 3.2 双向 handshake

```text
ClientHello
  protocolRanges
  clientKind = web | agent | cli | conformance
  supportedCommand/Projection/UI schema ranges
  resume = { hostEpoch, cursor }?
  clientInstanceId + auth proof
          ↓
HostWelcome
  selectedProtocol
  hostKind = skill-dev | aesagent
  hostInstanceId + hostEpoch
  extension = id/version/digest
  selected schemas + schema digests
  granted commands/capabilities
  current revision/cursor + retention policy
  welcomeDigest
          ↓
ClientReady
  echoes welcomeDigest and loaded renderer/tool-schema digests
```

Host 在 `ClientReady` 前只允许只读 metadata；Client 无法加载 selected schema/renderer 时必须拒绝进入可写状态。这避免“Web 看的是旧字段、Agent 写的是新 command”仍继续运行。

## 4. 两个 Host Adapter 的责任

### 4.1 `SkillDevHostAdapter`

- 直接加载本地 Workflow Extension source/release；
- 用共享 Schema/Kernel 实现 negotiate/submit/watch/readArtifact；
- 本地 Node 进程提供 localhost HTTP/WS 与 Agent Adapter；
- 至少实现 revision、idempotency、cursor replay、digest、typed failure，避免原型形成假语义；
- 可声明 `durability: process | restart-local`、`carrierKinds` 等较小 capability set，不冒充 AesAgent；
- source 变化时计算新的 dev digest，并滚动 `hostEpoch` 强制 Web/Agent resync。

它不是一组 Workflow 专属 `.mjs` handler；它应是可由所有 Skill workflow 复用的 Adapter。各 Skill 只提供 Extension、assets 与启动命令。

### 4.2 `AesAgentHostAdapter`

| Host Interface operation | AesAgent 映射 |
| --- | --- |
| `negotiate` | Server auth/config + Plugin registry exact binding + contribution/schema capability catalog；新增显式 Surface welcome。 |
| `submit` | 认证/actor grant → host-neutral command decode → StoryControl 或 Workflow Kernel → `OrchestrationEngine.dispatch`；复用 command receipt/revision transaction。 |
| `watch` | Projection snapshot + domain event stream；当前 Thread subscription 可承载 legacy Workflow，StoryRoot 需独立 projection/aggregate。 |
| `readArtifact` | 先取 authoritative projection，再调用 `WorkflowArtifactStore` integrity read。 |
| Web Adapter | 把 Interface 绑定到现有 RPC/WS/client runtime；React 只渲染 projection，不作领域裁决。 |
| Agent Adapter | MCP/tool schema 只是 `submit` 的一层翻译；Provider session/Task/subagent 启动属于 Carrier Adapter，不属于 Surface。 |

`AesAgentHostAdapter` 不应变成第二个 Domain Kernel。它只翻译 identity/auth/storage/transport/provider facts；Story/Gate/Router 结论来自 StoryControl，普通 Workflow transition 来自对应 Workflow Kernel。

## 5. Extension contribution seam

候选形状：在 `WorkflowContribution` 内新增同 digest 的 `surface` 声明。

```ts
type WorkflowSurfaceContribution = {
  schema: "aes.workflow-surface/contribution/v1";
  protocolRange: string;
  commands: Array<{
    kind: string;
    schemaVersion: string;
    schemaDigest: string;
    requiredGrant: string;
  }>;
  projections: Array<{
    kind: string;
    schemaVersion: string;
    schemaDigest: string;
  }>;
  ui: {
    documentSchemaVersion: string;
    requiredNodeKinds: string[];
    renderer?: { id: string; version: string; digest: string };
  };
  agentIngress: Array<{
    toolName: string;
    commandKind: string;
    schemaDigest: string;
  }>;
};
```

所有 schema 必须由 build 产物携带，Host 用完整 Extension digest 绑定。Plugin 不能在运行时注册任意 Host method、绕过 grant 或直接写 projection/Gate。

为什么暂不建议顶层 `contributions.workflow-surface`：

- 当前 PluginManager 的 `contributions` record 是通用的，但真正的 activator 由 Host 源码调用 `registerPluginContributionActivator` 注册；本仓目前只有 `workflow` activator（`ContributionActivatorRegistry.ts:12-25`、`workflow/composition.ts:124-129`）。
- 新顶层 kind 仍要求 AesAgent 先实现 Host activator，不会让 Plugin 自动获得新能力。
- Runtime 与 Surface 若分成两个 release identity，会产生启用/禁用、drain、rollback、digest 与 active Run lease 不一致。
- 同一 Workflow release 内嵌 Surface 能保持一个 binding 和一个 promotion gate。

翻转条件：若出现第二类**非 Workflow** extension 也必须复用同一 Surface，或 Surface 必须独立发布/回滚，才应重新评估独立 contribution kind。

## 6. 版本、digest 与 promotion

四层身份必须分开：

| 层 | 作用 | 规则 |
| --- | --- | --- |
| Surface protocol SemVer | Host/Client envelope 与 handshake 兼容 | major 不兼容 fail closed；协商选择共同最高版本。 |
| Extension SemVer + digest | 一次 Workflow release 的完整业务身份 | 同 version 不得出现不同 digest；AesAgent 继续使用 tombstone/immutable install 规则。 |
| command/event/projection/renderer schema version+digest | 局部文档和 UI/tool shape | Welcome 明确选择，ClientReady 回显；digest mismatch 禁止 mutation。 |
| hostEpoch + instance revision + cursor | 一次运行实例的状态次序 | 只处理重放/恢复；绝不替代 release version 或业务 subject digest。 |

高频开发路径：

```text
Extension source edit
→ SkillDevHost 计算 dev digest，滚动 hostEpoch
→ Web/Agent handshake + conformance vectors
→ 满意后 build immutable plugin bundle
→ payload digest / platformRange / exact schema validation
→ 同一 conformance trace 跑 AesAgentHostAdapter
→ 安装/启用 AesAgent extension
```

Dev Host 可以使用 `0.0.0-dev` 展示版本，但每次行为变化都必须改变 digest/epoch；不得把“同版本、不同代码”伪装成可恢复的同一运行。

## 7. Conformance：Interface 就是测试面

同一套 host-neutral vectors 必须分别对 `SkillDevHostAdapter` 和 `AesAgentHostAdapter` 执行。规范化后只允许 host id、时间、可选 capability 不同。

最低 vectors：

1. protocol/schema/capability 协商成功与 typed rejection；
2. 相同 command 重放只产生一个 transition，并返回相同 receipt；
3. 同 idempotency key 不同 payload fail closed；
4. stale `expectedRevision` 返回 typed conflict；
5. snapshot → event → synchronized 的 cursor replay；
6. cursor gap、host restart、extension digest change 触发 `resync-required`；
7. Web actor 与 Agent actor 对同 command 的 grants 不同且可审计；
8. Agent submit 后 Web projection 的 observable result 一致；
9. invalid command/projection/renderer schema 与 digest tamper 被拒；
10. Artifact reference、bytes 与 digest 一致；
11. Adapter crash/restart 后，广告了 `restart-local` 或更高 durability 的 Host 能恢复；
12. 未广告的 capability 必须显式 `unsupported`，不能降级为假成功。

AesAgent 还需保留真实 SQLite、RPC/WS、MCP、isolated plugin、Provider recovery integration；Dev Host 需要真实 localhost transport 测试。仅对纯 reducer 跑单测不能证明双宿主 conformance。

## 8. 不能放在哪里

| 错误位置 | 原因 |
| --- | --- |
| 每个 Skill 的 `.mjs` | 会复制 auth、revision、idempotency、cursor、WebSocket、MCP 与恢复；删除通用 Module 后复杂度重新散回 N 个 Skill，说明这是错误 Seam。 |
| React/Web store | Web 是 Projection Adapter，不是真源；刷新、断线或两个客户端会使本地裁决漂移。 |
| MCP handlers | MCP 只是一种 Agent ingress；它不能同时定义 Web stream、Artifact、durability 和 Host lifecycle。 |
| Workflow Plugin Runtime | Plugin 拥有业务 workflow 与 validators，不应拥有 Host auth、event store、Provider/Task lifecycle、tracker secret 或 Gate authority。 |
| PluginManager | PluginManager 有意只管理 immutable inventory/lifecycle；把 workflow protocol 放进去会破坏 contribution-neutral Locality。 |
| `WorkflowArtifactStore` | 该 Module 只负责 immutable bytes/integrity，不负责 command、projection 或 Agent communication。 |
| 现有 Thread `OrchestrationEngine` aggregate 内硬塞 StoryRoot | 当前 aggregate 和 read model 是 project/thread；StoryControl 的多 RepoLane、tracker ack、Role/Carrier/Gate 语义需要自己的深 Domain Module。 |
| 新 standalone 产品进程（第一步） | 用户已有 SkillDevHost 与 AesAgent 两个真实 Host；第三个部署会增加安装、端口、auth、upgrade、log 与版本握手，却不增加新的领域 Adapter。Protocol package/local Host 即可先证明 Seam。 |

## 9. Plugin-only 的明确上限

只安装一个 Workflow Plugin，当前可以得到：exact catalog/binding、Runtime callbacks、typed interaction、artifact/validator、Provider turn、Viewer data、isolated execution、enable/disable/drain/remove。

只靠 Plugin **不能**得到：

- 新 aggregate kind、StoryRoot/RepoLane durable projection；
- 新 RPC/WS method 或 handshake；
- 任意新的 React interactive renderer/node；
- 任意 Workflow-specific MCP tool；
- Host auth/grant 类型；
- Tracker/Repo/Carrier leases、outbox、reconcile；
- Desktop Task/subagent/team/human 的 actor identity 与 receipt authority；
- 跨 Host conformance 和 source-mode SkillDevHost；
- 并发 scheduler 或常驻 backend。`IsolatedPluginHost` 的串行 child-process queue 只是 callback fault isolation，不是这些能力。

因此，“最终集成为 AesAgent extension”成立的前提是：AesAgent 先提供一次通用 Host/Surface/StoryControl seam；之后各 Workflow extension 才能 plugin-only 地增加业务行为。不能把缺失的 Host 能力包装成 Plugin prompt 来回避。

## 10. Ownership 分界

| Module | 权威拥有 | 明确不拥有 |
| --- | --- | --- |
| `WorkflowSurfaceProtocol` | handshake、envelope、actor grants 表达、command receipt、revision/cursor、projection/artifact wire、conformance | Story 状态、Router、Gate、Tracker/Repo 真源、Carrier 执行 |
| Workflow Extension | stages/roles、business commands、Runtime transition、validators、artifact/projection schemas、UI declaration | Host persistence/auth/transport、Provider/Task lifecycle、最终 Gate 写权 |
| `StoryControl` | StoryRoot/RepoLane、RoleAssignment、Carrier requirements/routing、typed receipt validation、Gate projection、tracker/repo truth mapping | Web/WS/MCP 细节、React、Plugin install lifecycle |
| `SkillDevHostAdapter` | source-mode loading、本地 persistence/cursor、localhost transport、dev Agent adapter、capability truth | AesAgent durability/Provider 能力的虚假模拟 |
| `AesAgentHostAdapter` | auth、plugin binding、durable dispatch/projection、RPC/WS、Artifact store、Provider/Task adapters | Workflow/Story 公共语义的第二份实现 |
| Web Adapter | renderer、operator input、freshness/diagnostics 展示 | 领域 reducer、optimistic canonical completion |
| Agent Adapter | tool/schema exposure、actor proof、command/result translation | Role authority、Gate decision、绕过 Surface submit |

这个分界同时保护两个目标：Skill 形态保留高频迭代，AesAgent 集成又不是重写；未来新增 Workflow 只需贡献 Extension，Web↔Agent 的通用复杂度集中在一个深 Module 中，获得 **Leverage** 与 **Locality**。

## 11. 置信度与可翻转变量

- 当前 AesAgent 事实：**高置信度**，绑定上述 main HEAD，已完整读取指定 workflow-platform wire/runtime/ui/v1、WorkflowExecution、ArtifactStore、MCP handlers、OrchestrationEngine，并核对 RPC/WS、Web Viewer、Plugin Manager/activator/installed Adapter。
- “内嵌 surface contribution，而非新顶层 kind”：**中高置信度推论**。
- “四 operation Host Interface”：**中高置信度候选**；最终 command/projection schema 仍需 prototype vector 验证。

会推翻或显著修改本候选的变量：

1. Surface 必须服务非 Workflow extension，且要独立于 Workflow release 发布/回滚；
2. SkillDevHost 必须完全不依赖 `aes.workflow-platform` package；
3. Web 必须加载任意第三方 React/JS renderer，而 declarative nodes 不够；
4. 第一版就要求多主机、多用户、24x7 public webhook；
5. AesAgent 决定让中心数据库成为 Story 业务真源，推翻现有 Tracker/Repo ownership；
6. 双宿主 conformance 实测表明 AesAgent Thread/Run 模型无法映射公共最小语义；
7. Dev Host 的 revision/idempotency/cursor 成本高到无法支撑高频循环——这会证明需要更小的 protocol minimum，而不是允许它静默不一致。

