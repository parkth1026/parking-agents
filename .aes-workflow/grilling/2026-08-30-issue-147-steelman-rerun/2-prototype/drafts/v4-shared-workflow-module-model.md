<!-- draft v4 | published 2026-08-30T11:07:25Z
     用户意见：P8 已确认核心规则只实现一次；P9 已确认共用 Web Shell + Workflow 页面说明书；晋级发布方式待 P10
     状态：superseded by P10 independent Skill+Web Runtime direction -->

# 共享 Workflow Module：单一规则、双 Host、共用 Surface

**已被 P10 推翻，仅保留历史。** P10 移除当前 v1 的 AesAgent、双 Host 与 Extension 晋级主线；下一版必须改为独立 `Skill + Web + Local Runtime` 完整闭环。本文件不得晋级为确认版或进入 Contract。

## 1. 一句话模型

```text
一个 WorkflowReleaseSource
  → 一个 Workflow Module@digest（业务规则唯一实现）
  → SkillDevHostAdapter / AesAgentHostAdapter（两个真实 Adapter）
  → 同一个 Web Shell 渲染同版本 SurfaceDocument
```

不允许出现第二份 StoryRoot reducer、Router policy、Receipt/Gate 规则、action validator 或 Surface projector。

## 2. 已锁定与仍待确认

| 项目 | 状态 | 具体含义 |
| --- | --- | --- |
| Role-first、Carrier 晚绑定 | 已锁定（P5） | Workflow 先产生 RoleAssignment；Router 按可证明 capability 选择 Carrier；Agent Carrier 才在授权内调用 Skill。 |
| unknown 三分流 | 已锁定（P6） | Contract 未知回 Discovery；capability 未证明即不具备；仅 risk 上界未知时保守升档。 |
| 双 Host | 已锁定（P7） | Skill+Web 保留为高频孵化 Host；AesAgent 是最终产品 Host。 |
| 单一业务规则 | 已锁定（P8） | 两个 Host 装载同一个 Workflow Module；Host 不重新实现业务 transition。 |
| 共用 Web Shell | 已锁定（P9） | Workflow 输出页面说明书；Shell 统一处理提交、恢复、历史、权限、布局和可访问性。第一版不执行任意 Workflow React/JavaScript。 |
| 晋级发布方式 | **待 P10** | 候选是从 manual repo 的唯一源码构建 immutable `.plugin.tgz`，AesAgent 只安装 artifact，不复制业务源码。 |
| 旧 SkillDev Run 是否迁移 | 未裁决 | 第一版可只保证新 Run 使用同一 Module；历史 Run 无损迁移需要独立 importer/replay 证据。 |

## 3. Module、Interface、Seam 与 Adapter

| 名称 | 唯一职责 | 明确不负责 |
| --- | --- | --- |
| `WorkflowReleaseSource` | Module 源码、schema、Prompt/Skill assets、canonical fixtures 的唯一版本化来源 | Host 状态、安装 inventory、运行中 actor |
| `WorkflowModule` | StoryRoot/RepoLane、Role DAG、Router policy、Receipt/Gate、Reducer、业务 action validation、Story projection | 文件、SQLite、HTTP/WS、Agent/Task 生命周期、Tracker 凭据 |
| `WorkflowSurfaceHost` Interface | Host 必须共同满足的协商、提交、观察、Artifact 与 continuation 语义 | Story-specific 字段、React、MCP、ThreadId、文件路径 |
| `SkillDevHostAdapter` | 本地 source-mode 装载、journal、loopback、当前 Agent/subagent/harness binding、人工或真实 Host continuation | 冒充 AesAgent durability；重写 Router/Gate/Reducer |
| `AesAgentHostAdapter` | exact Extension binding、事件账本、RPC/WS、Provider/Task/Artifact/Plugin lifecycle | 第二份 Workflow 业务规则；按 Workflow 名硬编码分支 |
| `WebShell` | 渲染 `SurfaceDocument`；提交 typed action；显示 revision、freshness、Receipt 与恢复状态 | 本地推导 canonical Gate；直接唤醒 Agent；执行任意 Extension 代码 |
| Tracker/Repo/Carrier Adapters | 把真实外部事实和运行能力翻译成 typed input/effect result | 改写 Module transition；直接宣称 Story done |

外部 **Seam** 有两个且都有真实 Adapter：

1. `WorkflowModule` Interface：SkillDevHost 与 AesAgentHost 都调用。
2. `WorkflowSurfaceHost` Interface：Dev Host 与 Product Host 都实现。

删除这些 Module 后，revision、idempotency、恢复、Router、Gate 与投影复杂度会重新散回两个 Host，因此它们具有真实 **Depth**、**Leverage** 与 **Locality**，不是只换名字的 pass-through。

## 4. WorkflowModule Interface 候选

```ts
interface WorkflowModule<State> {
  descriptor(): WorkflowDescriptor;
  decide(state: State | null, input: WorkflowInput): Transition<State>;
  project(state: State, context: ProjectionContext): SurfaceDocument;
  recovery(state: State, cause: EventPointer): RecoveryPayload;
}
```

### Interface 不变量

1. `decide`、`project`、`recovery` 是纯函数：不得读取 clock、random、env、文件、网络或 Host 类型。
2. `Transition` 只返回 `events[] + effects[]`；Host 先 durable commit event，再执行 effect，再把结果作为新 input 喂回 Module。
3. 相同 state/input/schema 必须得到逐字节相同的 canonical transition、state digest 和 `SurfaceDocument`。
4. `WorkflowDescriptor` 固定 module/version/digest，以及 command/event/state/surface schema version。
5. Module 可以要求 capability，但不能创建 Provider、Task、subagent、human 或 tracker mutation。

## 5. WorkflowSurfaceHost Interface 候选

```ts
interface WorkflowSurfaceHost {
  negotiate(hello: SurfaceClientHello): Promise<SurfaceWelcome>;
  submit(command: SurfaceCommandEnvelope): Promise<SurfaceCommandReceipt>;
  watch(request: SurfaceWatchRequest): AsyncIterable<SurfaceFrame>;
  readArtifact(ref: SurfaceArtifactRef): Promise<SurfaceArtifactContent>;
}
```

普通 Skill/Agent 调用面保持更浅，可只暴露：

```text
present  发布当前 Surface / interaction
resume   吸收最早待处理 input 并继续 Workflow
observe  读取 current/history/export，或 follow cursor
```

`scan → claim → recovery-payload → domain apply → mark-consumed` 等 ordering 全部藏在 Module Implementation 后，不能让每个 Workflow caller 重写。

## 6. Web → Host → Agent 的真实完成层级

```text
1. Web 提交 typed action
2. Host durable commit                         → persisted
3. Host 取得合法 continuation authority        → armed / manual-required
4. 精确 RoleAttempt / Agent 接收 bounded input → agent-resumed
5. WorkflowModule 吸收并提交下一 transition    → consumed
```

硬规则：

- HTTP 200、WebSocket 通知或按钮变绿最多证明 `persisted`，不能冒充 `agent-resumed` 或 `consumed`。
- continuation 失败不回滚已持久化答案；页面显示 `manual-required` 和下一安全动作。
- recovery payload 只含当前 trigger、open interaction、必要 Artifact refs 与有界 facts，不回灌全历史。
- generation 单调；旧 owner、旧 wake、错误 recovery digest 对新 generation 零影响。

## 7. Role、Carrier 与 Skill 如何进入共享 Module

```text
WorkflowInput
  → WorkflowModule.decide
  → RoleAssignment + effectiveRequirements
  → deterministic Router hard filter
  → HostAdapter 绑定一个合格 Carrier
  → CarrierAdapter 创建/恢复 Agent | harness | human request
  → Agent Carrier 在 Role 授权内绑定 Skill
  → typed finding / Receipt
  → WorkflowModule.decide
  → ReceiptValidator + GateProjector + Reducer
```

两个 Host 可以绑定不同 Carrier，但下面这些内容必须相同：

- RoleAssignment subject、authority、actor separation、mutation scope；
- Profile/Contract/policy digest；
- Router hard requirements 与淘汰理由；
- Receipt schema、subject/provenance 校验与 Gate 规则；
- `SurfaceDocument` 的业务语义。

允许不同：

- SkillDev 的当前 Agent/subagent/file journal/loopback；
- AesAgent 的 Provider/Task/SQLite/RPC/WS；
- Host ID、时间、连接方式，以及诚实声明的可选 capability。

## 8. SurfaceDocument 页面说明书

```json
{
  "schema": "aes.workflow-surface/document/v1",
  "workflow": {
    "id": "workflow-story-map",
    "version": "0.1.0-dev",
    "module_digest": "sha256:module-abc"
  },
  "revision": {"instance": 82, "state_digest": "sha256:state-82"},
  "freshness": {"mode": "captured", "sources": []},
  "blocks": [],
  "open_interactions": [],
  "allowed_actions": [],
  "continuation": {"stage": "consumed"}
}
```

第一版安全 block 候选：`section`、`text`、`status`、`attention`、`collection`、`graph`、`interaction`、`action`、`artifact`、`history-link`、`extension-with-fallback`。

- `StoryProjector` 产生 Now/Why/Owner/Next 等业务读模型。
- `WorkflowModule.project` 把读模型变成版本化 `SurfaceDocument`。
- `WebShell` 渲染 block，并把 action 按 schema 提交给 Host。
- Shell 不认识 required block/schema 时 fail closed；optional extension 必须展示安全文本 fallback，不能白屏或猜字段。

## 9. 晋级候选：安装同一 artifact，不复制源码

当前推荐靶子：

```text
manual repo / WorkflowReleaseSource
  → SkillDevHost source-mode 验证
  → official aes.workflow-platform plugin-build
  → immutable workflow-story-map@version.plugin.tgz
  → AesAgent install + exact binding
  → Product Host conformance + live smoke
```

好处：

- 高频修改仍在 manual repo；正式发布直接使用同一 semantic material。
- AesAgent 已有 exact version/digest、并存、disable、drain、remove 与 rollback Seam。
- AesAgent repo 无业务源码复制 diff；Host 能力与 Workflow release 可独立评审。

代价：

- manual repo 要新增与 Skill `.mjs` 零依赖运行分开的 release-only toolchain/CI。
- Host contract 变化与 Extension promotion 需要跨 repo compatibility matrix。
- artifact 供应、签名、长期保留尚未被当前证据证明。

未选候选：

- 把源码复制进 `aes-agent/extensions`：会产生第二份规则，或迫使孵化源永久搬离 manual。
- 立刻新建中立 repo/package：第三个 release queue 过早；等第三个真实消费者、独立团队或独立发布节奏出现再复议。

## 10. “无重写晋级”的机械门禁

全部满足才可生成 `PromotionReceipt`：

1. SkillDev 与 `.plugin.tgz` 中的 Workflow Module digest 相同。
2. Plugin wrapper 只有 declaration、registration 与 Adapter wiring，没有 domain branch、validator、projector 或 Prompt 语义。
3. 两 Host 对同一 canonical trace 的 events、state digest、SurfaceDocument、receipts 与 recovery payload 规范化后全等。
4. promotion diff 不新增第二份 reducer、schema、validator 或页面说明书。
5. clean rebuild 的 tgz digest 可复现；同 `pluginId@version` 不得出现不同 digest。
6. SkillDevHost 与 AesAgentHost 都完成真实 `publish → submit → persisted → continuation → consumed`。
7. 未证明的自动 continuation、multi-writer、live runtime 或人工验收保持 `NOT_PROVEN` / `NOT_RUN`，不得包装为 PASS。

任一项缺失，只能报告 `PORTABLE_CANDIDATE`，不能报告 `PROMOTED_NO_REWRITE`。

## 11. 统一失败语义

| 失败 | 状态变化 | 恢复 |
| --- | --- | --- |
| `VERSION_UNSUPPORTED` / `CAPABILITY_MISSING` | 无 | 升级 Host/Client，或使用明确 optional fallback |
| `REVISION_CONFLICT` | 无 | 重新 observe 后构造新命令；不得自动套用旧答案 |
| `IDEMPOTENCY_CONFLICT` | 无 | 保留首次 receipt，要求新 key/新意图 |
| `AUTHORIZATION_DENIED` | 无 | 显示缺失 authority，不改 Gate |
| `PERSISTENCE_FAILED` | 无 committed 状态 | 原 key 重试；客户端不得猜是否成功 |
| `CONTINUATION_UNAVAILABLE` | 已 persisted，不回滚 | 转 `manual-required`，保留 bounded recovery payload |
| `DOMAIN_APPLY_FAILED` | input 保持 pending/processing | 复用相同 consume identity 幂等重试 |
| `PROJECTION_LAGGING` | journal 已 committed | receipt 带 cursor；从 journal 重建 projection |

## 12. 仍待用户决定

最高杠杆问题是：是否接受把“晋级”定义为从 manual repo 的唯一 `WorkflowReleaseSource` 构建 immutable `.plugin.tgz`，由 AesAgent 安装同一 artifact 而不复制业务源码；中立 repo 等第三个真实消费者出现后再评估。

该问题确认后，下一项难逆兼容决定才是：旧 SkillDev Run 是否必须无损导入 AesAgent，还是第一版只保证新 Run 使用同一 Module。
