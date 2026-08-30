# Logic prototype P7–P9 gap audit

日期：2026-08-30  
范围：只读比较 `2-prototype/drafts/` 中五份逻辑草稿与 `1-interview/context.md` 已记录的 P7、P8、P9 裁决。  
停止条件：只说明草稿仍成立、已过时和缺失之处；不替用户确认整套 prototype，不设计尚未裁决的包位置或实现技术。

## 1. 权威检查点

以下是本审计采用的已定事实：

- P7：AesAgent 是最终产品宿主；同时保留轻量 `Skill+Web` 孵化形态。成熟 Workflow 晋级为 AesAgent Extension，不应重新解释核心业务语义（`context.md:251-255`）。
- P8：每个 Workflow 的共享 `Workflow Module` 是核心业务规则的唯一实现；`Skill+Web` 与 `AesAgent Extension` 都通过 Host Adapter 调用它（`context.md:256,258-260`）。
- P9：第一版采用共用 `Web Shell + SurfaceDocument`；Shell 承担通用提交、恢复、历史、权限、布局和可访问性，Workflow 输出版本化 declarative `SurfaceDocument`；第一版不允许任意 React/JavaScript 注入（`context.md:257`）。
- P5/P6 仍然有效：Role-first、Carrier 晚绑定，以及 unknown 三分流。P7–P9 没有推翻这些原则（`context.md:239-249`）。

## 2. 总体结论

| 排名 | 差距 | 置信度 | 直接依据 |
| --- | --- | --- | --- |
| 1 | 五份草稿都没有把“共享 Workflow Module 是唯一业务实现”画成顶层边界；v2 仍容易被读成 `workflow-story-map` Skill 自己拥有 Core 与状态。 | 高 | `v2-skill-chain.md:13,17,25,75,118` 对照 `context.md:256,258-260` |
| 2 | 没有草稿同时展示 `SkillDevHost` 与 `AesAgentHost`，也没有展示相同 module digest、相同 canonical trace 和 promotion 无业务重写的证明。 | 高 | P7/P8 的双宿主与晋级约束只存在于 `context.md:253-260` |
| 3 | `v2-web-projection-api.md` 是有价值的 Story 业务读模型，但不是 P9 所定的版本化 declarative `SurfaceDocument`，也没有共用 Web Shell 的协议边界。 | 高 | `v2-web-projection-api.md:13-137` 对照 `context.md:257` |
| 4 | v3 的 Role/Carrier/Skill 分离仍然正确，但 `Core / Adapter`、`Workflow`、`main Agent` 等词把业务模块、宿主和执行载体混在同一层。 | 高 | `v3-role-skill-carrier-model.md:24-39,109-123` |

结论边界：这不是说现有 Role DAG、Gate、Receipt、Now/Why/Next 或 Router 设计失效。失效的是它们当前的**归属和宿主拓扑表达**。业务链大体可保留，但必须明确它只实现一次，并由两个宿主调用。

## 3. 逐文件审计

### 3.1 `v2-skill-chain.md`

#### 仍然正确

- “是否拥有可恢复状态推进”仍是区分 workflow 与原子能力的有效判据（第 7–17 行）。
- Discovery、Delivery、Receipt validation、Gate projection、ChangeClassifier 与 Story/RepoLane reducer 的业务顺序仍与 P5/P6 兼容（第 22–73 行）。
- `workflow-interview`、`aes-worktree-board`、`aes-issue-worker` 与候选 `aes-merge-worker` 的责任边界仍可作为能力 inventory（第 81–91 行）。
- Web 不能成为第二业务真源、Tracker/Repo 继续提供外部事实、Gate 只能由确定性规则投影，这些边界仍成立（第 17、75–78、98、100–114 行）。

#### 已过时或会误导

- 第 13、25 行把 `[W0] workflow-story-map` 写成恢复全局状态并推进阶段的用户入口 workflow；第 118 行又把 deterministic core 作为该 Skill 的缺口。P8 后，这种写法会被实现者理解为“Skill 内有一份业务引擎”。正确归属应是共享 `Workflow Module`；Skill 只是 `SkillDevHost` 的 Agent 入口/过程 Adapter。
- 第 17 行把 deterministic core、Tracker/Execution/Web adapters 合为一层。这隐藏了三种不同边界：`Workflow Module Core`、外部系统 Adapter、Host Adapter。
- 第 75–78 行的 `[P0] workflow-story-map-web` / Story Web adapter，以及第 98 行只“复用 workflow-interview-web response schema”的写法，已被 P9 取代。共用的是 Web Shell 和 Surface 协议；每个 Workflow 只提供自己的 `SurfaceDocument`，不是各建一个完整 Web 应用。
- 标题仍称“完整调用链”，而文件头只说明 v3 supersede orchestration semantics。P7–P9 后它也不再是完整的宿主/Surface 拓扑事实源。

#### 必须新增的具体内容

- 在“五层分类”之前增加宿主无关的 `Workflow Module` 层，并明确它唯一拥有 StoryRoot、RepoLane、Role DAG、Router policy、Receipt/Gate、Reducer、业务投影和 action validation。
- 把原来的 `Core / adapters` 拆成至少三组：`Workflow Module Core`、`Host Adapter`、Tracker/Repo/Carrier 等 external adapters。
- 把完整图的入口改成两个并列宿主：
  - `SkillDevHost`：Skill 入口、文件/本地 journal、loopback、当前 Agent/可选 subagent；
  - `AesAgentHost`：AesAgent Extension、SQLite/event history、RPC/WS、Provider/Task carrier。
- 两个宿主必须汇入**同一个** `Workflow Module@digest`；Router、Gate、Reducer、Surface projection 不得在宿主分支中重复出现。
- 在 Web 分支中增加：`Workflow Module -> SurfaceDocument -> common Web Shell`，以及 `Web action -> Host Adapter -> Workflow Module command` 的回路；删去“每个 workflow 一个完整 Web adapter”的暗示。
- 增加晋级不重写的不变量：相同 module digest、双 Adapter canonical trace 等价、promotion diff 不得包含业务 reducer/schema/validator/Surface projection 重写，以及两个宿主都要有真实交互闭环。

### 3.2 `v2-orchestration-example.md`

#### 仍然正确

- 冷启动示例优先给出 Now/Why/Next、Reconcile 结果与禁止路线，适合人类和 Agent 快速理解现场（第 10–41 行）。
- proposal 在 Profile/DAG 校验前不写 Tracker、child workflow 不能写 Story done、简单 deterministic harness 不必创建 Agent，均仍成立（第 44–61、64–86、91–109 行）。
- `requires-decision` 与 execution failure 分开，以及 Receipt 回 Core 后再投影 Gate，仍符合 P6。

#### 已过时或会误导

- 第 12 行命令 `node skills/workflow-story-map/scripts/story.mjs resume` 和第 103 行 `skills/workflow-story-map/run-tests.mjs` 把业务引擎的位置暗示为 Skill 目录。它们可以保留为 Dev Host CLI 入口，但必须明确 CLI 调用共享 Workflow Module，不能成为第二份规则。
- 第 33–35 行直接输出 selected workflow/child workflow/atomic skill；v3/P5 已要求先产生 RoleAssignment，再由 Router 选择 Carrier，Agent Carrier 内部才绑定 Skill。该示例缺少 RoleAssignment、CarrierBinding 和淘汰理由。
- 第 49、68 行都从 `workflow-story-map` 开始单宿主路线；没有 AesAgent Extension 路线，也无法证明成熟后不重写。
- 该文件完全没有 Web/Agent 的 durable submission、continuation 和 consumed 回执场景，不能覆盖 P9 的共用 Shell 交互责任。

#### 必须新增的具体示例

- 给同一个 canonical story fixture 增加两条宿主入口：SkillDev CLI 与 AesAgent Extension；两条输出都显示相同的 `workflow_module_id/version/digest`、Profile/policy digest、RouteDecision 与规范化终态。
- 在 `ROUTE` 输出中按顺序展示 `RoleAssignment -> effectiveRequirements -> CarrierBinding -> SkillBinding（仅 Agent Carrier）`，不要把 Skill 名当调度目标。
- 增加一段允许差异清单：文件与 SQLite、loopback 与 RPC/WS、当前会话与 Provider/Task 可以不同；Role DAG、Router decision、Receipt/Gate、Reducer 和 SurfaceDocument 不得不同。
- 增加一条 Web 人机闭环：Module 发布版本化 `SurfaceDocument`；共用 Shell 提交带 expected revision/idempotency key 的 action；Host 先耐久化，再恢复对应 Agent/RoleAttempt；业务吸收成功后才标记 consumed。
- 增加 promotion/conformance 示例，机械比较双宿主 canonical trace；不满足时只能报告“可移植候选”，不能报告“已无重写晋级”。

### 3.3 `v2-web-projection-api.md`

#### 仍然正确

- `now`、`why_not_done`、`next`、attention、RepoLane beacon、queue、recent changes 是有价值的 `workflow-story-map` 业务投影（第 37–126 行）。
- source freshness、`stale` / `NOT_RUN` / `BLOCKED` / `degraded` 常显、frontier 与 startable 分开，以及同一个 projection revision 的一致性要求仍应保留（第 25–35、129–137 行）。
- `allowed_actions` 由业务状态限制而不是由页面随意创造，这一意图仍正确（第 55–87 行）。

#### 已过时或不完整

- 第 13–17 行的 `story.workspace.get` 是 Workflow 业务查询，不足以充当共用 Web Shell 协议；当前响应只是 Story-specific JSON，并不是 declarative `SurfaceDocument`。
- 第 7 行“命令与 Receipt 报文仍沿用 v1”在 P8/P9 后不再充分。两个宿主必须共享版本、revision、idempotency、durable acceptance、continuation 和 consumption 语义，不能靠各自引用旧稿自行解释。
- 第 65、76、87 行的 `allowed_actions` 只是字符串。它们没有输入 schema、业务 permission、expected revision、idempotency policy、结果/错误 schema，Shell 无法安全生成表单或 fail-closed。
- 响应没有 `surface_schema_version`、Workflow Module digest、host capability、block type/version 或 unknown-block fallback，不能证明同一文档可由 SkillDev 与 AesAgent 的共用 Shell 渲染。

#### 必须新增的接口边界

- 保留现有 Story read model 作为 `StoryProjector` 输出，但在其外增加版本化 `SurfaceDocument` envelope。至少需要标识 Workflow Module identity/digest、document schema version、projection revision/cursor、数据 provenance/freshness 和所需 renderer capabilities。
- `SurfaceDocument` 应声明安全 block，例如 status、attention queue、Graph、table/list、form/action、evidence/artifact、history link；不能携带任意 React/JavaScript。
- action block 必须携带 action type/version、参数 schema、required authority/capability、expected projection revision、idempotency key 规则，以及可审计的 success/error/receipt 表达。
- 明确三方责任：Workflow Module 产生业务投影并验证 action；Web Shell 负责通用布局、提交/恢复/历史、权限呈现和可访问性；Host Adapter 负责宿主持久化、认证/transport 与 continuation。
- 增加 capability negotiation 与 fail-closed fallback：Shell 不认识 block 或 host 不具备 capability 时，不执行 action，显示稳定的 unsupported/degraded 表达和恢复条件。
- 明确两个宿主针对同一 module state 必须产生语义相同的 SurfaceDocument；宿主时间、连接方式等允许字段应在 conformance 规范中归一化。

### 3.4 `v3-role-skill-carrier-model.md`

#### 仍然正确

- “调度面 role-first，执行面 skill-enabled，正确性面 core-enforced”的结论不受 P7–P9 影响（第 9–21 行）。
- Role、Skill、Carrier、AgentInstance 的正交定义，以及 host role 不等于 Workflow role/Receipt authority，仍是必要边界（第 24–39 行）。
- Accountability DAG 与 Invocation Graph 分开、RoleAssignment 合同、actor separation、一个 Role 可用多个 Skill、多 Agent team 的 fan-in 规则都仍成立（第 41–176 行）。
- P5/P6 两节是已裁决逻辑，必须原样保留其语义（第 191–218 行）。

#### 已过时或会误导

- 第 30 行的 `Workflow` 定义没有说明可恢复规则实际由共享 `Workflow Module` 唯一实现；读者仍可能把 Skill 名、AesAgent Plugin 或当前 Agent 当成 Workflow 本体。
- 第 33 行把 `Core / Adapter` 合为一个概念。P8 后必须区分 `Workflow Module Core`、Host Adapter、CarrierAdapter 和 Tracker/Repo Adapter，否则“谁能改业务状态”仍不清楚。
- 第 79 行“Story/Web 默认展示 Accountability DAG”跳过了 P9 的投影链。准确表达应是 Workflow Module 将 DAG 投影为 `SurfaceDocument`，共用 Web Shell 负责渲染。
- 第 113–114 行把 StoryOrchestrator/Discovery 默认绑定 `main Agent`，并把 `workflow-story-map`/`workflow-interview` 直接列为 procedure。这只能描述 SkillDevHost 的一个 binding，不能描述 AesAgentHost，也不能成为跨宿主默认真相。
- 文件开头声明“Web v2 暂不改变”，但 P9 已经明确改变 Web 逻辑边界，因此这句与当前检查点直接冲突。

#### 必须新增的概念与表格

- 在正交概念中加入或拆清：
  - `Workflow Module`：业务规则唯一实现；
  - `Host`：提供持久化、transport、Agent/Task lifecycle 与认证；
  - `Host Adapter`：把 Host capability 映射到 module port；
  - `SurfaceDocument` / `Web Shell`：声明业务页面与通用渲染/交互分别归属何处。
- 把 `Core` 定义为 Workflow Module 内的确定性内核，不再作为可与 Workflow Module 并列的第二业务 owner。
- 增加双宿主映射表：相同 RoleAssignment 在 SkillDevHost 可绑定 main/subagent/local harness，在 AesAgentHost 可绑定 Provider/Task/server harness；两者都必须通过同一 Router/Gate/Receipt 校验。
- 为 `StoryOrchestrator` 行拆出 host-neutral requirement 与 host-specific binding。`workflow-story-map` Skill 是 Dev Host procedure/entry，AesAgent Extension 是 Product Host packaging；二者都不是业务规则本体。
- 增加 P7–P9 已裁决章节，写明同 module digest、canonical trace 等价和 promotion 无业务重写约束。
- 增加 human/Web action 到 RoleAssignment 的路径：Shell 提交的 durable action 先进入 Host Adapter 和 Workflow Module command validation，只有合法 transition 才创建/恢复 RoleAttempt。

### 3.5 `v3-role-runtime-diagram.html`

#### 仍然正确

- 两张图分别展示 Accountability 与单次 Invocation，是 P5 的正确可视化（第 23–44、48–67 行）。
- `RoleAssignment -> Capability Router -> CarrierBinding -> CarrierAdapter -> AgentInstance -> SkillBinding -> ReceiptValidator -> GateProjector` 的主干仍正确（第 51–64 行）。
- Story terminal 只由 reducer 形成，Skill/Agent 不能直接写 Gate，footer 的删除清单仍正确（第 44、67、70 行）。

#### 已过时或有歧义

- 第 20 行统一写 `awaiting confirmation` 会掩盖 P5/P6 已确认、整套 prototype 未确认的真实状态；需要分开标示。
- 第 24、26 行把 Accountability DAG 称为 Story/Web 直接展示的图；P9 后应通过 `SurfaceDocument` 投影并由共用 Shell 渲染。
- 两张图都没有 `Workflow Module` container、`SkillDevHost`、`AesAgentHost` 或 Web Shell，因此无法表达 P7/P8/P9。
- 第 59 行只有一个未限定的 `CarrierAdapter`，无法区分 Host Adapter 与 carrier-specific adapter，也不能证明相同 RoleAssignment 在两个宿主使用同一业务规则。
- 第 65 行的虚线从 `CarrierBinding` 直接进入 `ReceiptValidator`，视觉上绕过 `CarrierAdapter`。Human/harness 可以绕过 Skill，却不能绕过 Host/Carrier Adapter 的持久化、identity、authority 和 typed receipt 边界。这是图内语义冲突。

#### 必须新增或改动的图节点

- 增加一张顶层“双宿主、单模块”图：中心只有一个 `Workflow Module@digest`；左侧 `SkillDevHost Adapter`，右侧 `AesAgentHost Adapter / Extension`；两侧共用 `Web Shell` 并接收相同版本的 `SurfaceDocument`。
- 在 Accountability DAG 外加 `Workflow Module` 容器，说明 Role DAG、Router policy、Receipt/Gate、Reducer 与 Surface projection 都在容器内唯一实现；不要把 StoryOrchestrator 节点画成规则本体。
- Runtime 图应显示 host binding：RoleAssignment 和 effectiveRequirements 先由同一 Router 计算，再由当前 Host Adapter 把合格 Carrier capability 实例化。Host 分支之后不得重复 Router/Gate/Reducer。
- Human/harness 路径应保留 Adapter/identity/receipt 节点，只跳过 AgentInstance 和 SkillBinding。
- 增加 Web 交互回路：`SurfaceDocument -> Web Shell -> durable action receipt -> Host Adapter -> Workflow Module -> RoleAttempt resume/consume`；同时标记任意 React/JavaScript injection 为第一版禁止。
- 更新 `<title>`、`<desc>`、legend 与 fidelity ledger，使屏幕阅读文本也说明哪些节点是业务唯一真源、哪些只是宿主 binding。

## 4. 术语漂移与跨文件冲突

| 当前术语/写法 | 问题 | P7–P9 后需要的稳定关系 |
| --- | --- | --- |
| `workflow-story-map` | 同时被用作产品 Workflow、Skill 名和业务总控，无法判断规则放在哪里。 | 区分 `workflow-story-map Workflow Module` 与 `workflow-story-map Skill Adapter`；前者唯一拥有业务规则。 |
| `Workflow` | v2 指入口/阶段 Skill，v3 指可恢复状态机。 | `Workflow` 是领域过程；其规则由 `Workflow Module` 实现。Skill 与 Extension 是不同宿主入口/包装。 |
| `Core` / `deterministic Core` | 有时指整个业务引擎，有时只指校验器；还与 adapters 合为一类。 | 使用 `Workflow Module Core` 指模块内部确定性规则；它不是独立宿主，也不是第二真源。 |
| `Adapter` | 当前同时覆盖 tracker、carrier、human、Web、transport。 | 至少限定为 `HostAdapter`、`TrackerAdapter`、`RepoAdapter`、`CarrierAdapter`；权限和状态写入边界随限定词可审计。 |
| `workflow-story-map-web` / `Story Web adapter` | 暗示每个 Workflow 自带完整 Web 应用。 | 共用 `Web Shell`；Workflow 只输出 `SurfaceDocument` 与 action schema。 |
| `StoryProjector` / Web read model / `SurfaceDocument` | 当前容易被当成同一对象。 | `StoryProjector` 产生业务投影；`SurfaceDocument` 是版本化声明式页面描述；Web Shell 渲染它。两者都不是 Tracker/Repo 真源。 |
| `main Agent` / `Desktop Task` | 是当前 SkillDev/Codex 宿主的 carrier 名，不是跨宿主领域概念。 | 作为 Host capability/binding 出现；AesAgentHost 可以映射为 Provider/Task 等不同 carrier，而 RoleAssignment 不变。 |
| `AesAgent Extension` / `AesAgentHost` | 若不区分，容易把 packaging 当成业务实现。 | Extension 装载共享 Workflow Module；AesAgentHost/Host Adapter 提供产品运行能力。 |
| `workflow-interview-web` | v2 将其当 response schema 复用源。 | 它是已验证机制的提取种子；不能继续成为共用 Shell 的 interview-specific 协议真源。 |

明确的跨文件冲突：

1. `v2-skill-chain.md` 自称完整调用链，但文件头只声明被 v3 supersede 调度语义；P7–P9 的宿主与 Surface 语义也已使它不完整。
2. `v3-role-skill-carrier-model.md` 说“Web v2 暂不改变”，而 P9 已锁定共用 Web Shell + SurfaceDocument。
3. `v2-orchestration-example.md` 直接从 Skill 路径进入 Core，和 P8 的共享 Workflow Module 唯一实现存在归属冲突。
4. `v2-web-projection-api.md` 沿用 v1 command/Receipt，却没有证明两个 Host Adapter 共享相同的交互语义。
5. v3 HTML 的 human/harness 虚线路径绕过 Adapter，和 markdown 中“Adapter 创建或恢复 harness/human step”相冲突。

## 5. 尚未被 P7–P9 裁决的事项

以下不能从当前记录中自动决定，修订草稿时必须标为 open/contract-later，而不是写成事实：

- 共享 Workflow Module 最终位于哪个仓库、包名是什么、如何版本发布。
- SkillDevHost 使用何种具体持久化格式，以及它是否支持多 writer。
- AesAgent Extension 对现有 Workflow Platform RPC/event/schema 的精确映射。
- `SurfaceDocument` 第一版的完整 block catalog、schema language 与安全扩展块格式。
- 旧 Skill run 是否需要迁移到 AesAgent，还是只要求新 run 跨宿主行为等价。
- Dev 与 Product Web 是否要求像素级一致；P9 只锁定相同 Shell/Document 语义，没有锁定视觉像素等价。

## 6. 审计结论

证据支持的最小修订方向是：**保留现有业务 DAG、Role/Carrier/Skill、Receipt/Gate 和 Story read model；重画它们的归属，使共享 Workflow Module 成为唯一业务实现，SkillDevHost 与 AesAgentHost 只做宿主适配，共用 Web Shell 只渲染版本化 SurfaceDocument。**

当前五份草稿没有一份单独满足 P7–P9。`v3-role-skill-carrier-model.md` 是 P5/P6 的最强逻辑基线，`v2-skill-chain.md` 只应作为能力 inventory，`v2-web-projection-api.md` 只应作为 Story-specific projection 样本；它们需要由一张新的双宿主/单模块/共用 Surface 拓扑统一起来。整套 logic prototype 仍未确认。
