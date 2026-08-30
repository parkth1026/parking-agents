# Fact: Agent、Role、Skill、Workflow 与 Carrier 的正交本体

- 派遣问题：精确定义当前仓库与本次 `workflow-story-map` 设计里的 Main/Owner Agent、subagent、独立 Agent/Desktop Task、多 Agent team、Agent role、Skill、workflow、carrier、adapter；核对谁调用 Skill，以及身份、上下文、持久性、可见性、权限、重试和 receipt 如何绑定。
- 完成：2026-08-30T12:53:22+08:00
- 证据边界：仓库事实优先；“本次 Codex 会话能力”只按当前宿主提供的 collaboration / Desktop tool contract 记录，不外推到其他 harness。

## 先给结论

1. **Agent role 与 Skill 不互斥，而是正交。** Role 回答“这个 actor 对什么结果负责、有什么权限、必须与谁隔离”；Skill 回答“这个 actor 按什么可复用方法完成一类工作”。仓库已有直接实例：`SuperPowerSub` 是一个 Agent 角色/定义，接到委派后再加载指定 Skill；主 Agent 也可以直接执行 Skill。见 `.copilot/agents/SuperPower.agent.md:18-30`、`.copilot/agents/SuperPowerSub.agent.md:11-24`。
2. **subagent 首先是一个 Agent 实例，其次才是 carrier 选择。** 它不是“只有运输功能的空壳”：它有自己的上下文、推理与工具，可以承担 workflow role 并执行 Skill；但在 Story 协议视角里，`subagent` 这个词主要描述运行载体/拓扑，不能单独证明持久身份、权限、用户可见性或 receipt 可信度。
3. **多 Agent 系统不应在“调用 Agent role”与“调用 Skill”之间二选一。** 编排器实际派发的是一个 Agent carrier，并给它绑定 workflow role、WorkOrder、可调用/必须遵循的 Skill 或 runbook、权限边界与输出 receipt 合同。只有确定性检查才可以完全不创建 Agent，直接由 harness/core 运行。
4. **当前 Q27 已裁决 DAG 不锁具体产品载体。** 节点声明隔离、actor separation、持久性、可见性、重试范围与 receipt capability；Router 再选择 main Agent、subagent、Desktop Task、human 或 deterministic harness。见 `1-interview/rounds.jsonl:29`。因此“所有 QA/Review 都是 subagent”或“所有节点都创建 Desktop Task”都与已确认方向冲突。
5. **Skill 不是 actor、身份或授权主体。** Skill 是跨 harness 的指令/资源包，被模型加载并执行；仓库明确把 `skills/` 与 `.copilot/agents/` 分成互不依赖的两类交付物。见 `README.md:7-14`、`docs/porting-to-a-new-harness.md:11-24`。

## 核心术语

| 术语 | 当前可证定义 | 不等于什么 | 证据 |
| --- | --- | --- | --- |
| **Main / Root Agent** | 当前用户可见会话的总控 actor；持有用户交互、全局路由、子任务聚合和最终回复。`workflow-interview` 中对应“宿主 Agent”：它聚合 facts、维护阶段推进并把用户回答交给脚本落盘。 | 不天然等于实现者、reviewer、某个固定模型，也不应自动拥有所有 Receipt 的签发权。 | `skills/workflow/aes-interview/SKILL.md:32-39,118-121`；`skills/workflow/workflow-interview/SKILL.md:38-44` |
| **Owner Agent / owner session** | 某个工作项/attempt 的责任所有者；在 issue-worker 中，一个 owner session 持有单票实现闭环；v4 registry 用 `attempt.ownerThreadId` 绑定本次 owner，并优先恢复原 thread。 | 不必是 root/Main；也不是 Skill 名或 host agent type。Owner 是职责与 attempt 的绑定。 | `skills/workflow/aes-issue-worker/SKILL.md:8-16,99-110,183-184`；`skills/workflow/aes-worktree-board/scripts/master.mjs:349-404,410-451` |
| **subagent** | 由另一个 Agent 在当前编排树中派生的 Agent 实例。适合有界、可并行、可隔离上下文的工作；本仓 interview 规定 facts subagent 各写一个分片、不得问用户或替用户裁决。 | 不等于独立 Desktop Task；不自动等于只读沙箱、持久 actor、独立权限域或用户可继续交互的 Task。 | `skills/workflow/aes-interview/SKILL.md:32-39,91-116`；`docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md:101-117` |
| **独立 Agent / Desktop Task** | 用宿主 `create_thread` 创建的侧边栏可见、可跟踪的独立 Task；有 `threadId`，排队时可先有 `clientThreadId`，并可登记 `hostId/projectId`。Board 将它与 TaskRecord、worktree lease、parent reviewer 关系绑定。 | 不等于内部 subagent、CLI/headless 进程或脚本 dispatch。 | `skills/workflow/aes-worktree-board/SKILL.md:85-113`；`skills/workflow/aes-worktree-board/scripts/orchestrate.mjs:469-585,589-605` |
| **Multi-agent team** | 一个 Orchestrator 加多个 Agent 实例的运行拓扑；可并行或分阶段协作。Team 不是一个额外业务角色，也不是一个 Skill。当前 Codex team 里的 agent 共享工作目录/文件系统，可用消息与等待机制协作。 | 不等于“自动产生正确协调”；也不提供业务状态真源。持久状态仍须落 registry/inbox/receipt/Git。 | `docs/retrospectives/aes-worktree-board-multi-agent-orchestration-retrospective-2026-08-24.md:68-78,218-249`；本次 Codex collaboration tool contract（session-local） |
| **Agent role（host role）** | harness 在创建 Agent 时施加的预设行为/专长/模型配置，例如当前 Codex 的 analyst、architect、executor、reviewer 类 agent type；它改变该 Agent 如何工作。 | 不等于 repo workflow role，也不等于 Skill；不能仅凭 host role 名取得 Story 权限。 | 本次 Codex `spawn_agent` tool contract（session-local）；仓库没有通用 host-role schema |
| **Workflow role（domain role）** | DAG/协议中的责任位，例如 story-owner、executor、QA、reviewer、merge-worker、human tester。它定义输入、允许动作、独立性、输出与门禁 provenance；可由不同 carrier 承担。Board 当前机械持久化的 v3 role 只有 `executor|reviewer`，v4 另以 owner/reviewer session 字段表达部分角色。 | 不等于具体 thread/subagent/worktree/model。 | `skills/workflow/aes-worktree-board/scripts/orchestrate.mjs:469-478,510-578`；`skills/workflow/aes-worktree-board/scripts/master.mjs:827-923` |
| **Skill** | 平台无关的可发现指令/资源包；正文描述动作，由 harness 把“派子代理”等动作翻译成真实工具。模型/Agent加载 Skill 后按其方法执行。 | 不是 actor、线程、状态机实例、权限主体、隔离边界或 receipt。 | `docs/porting-to-a-new-harness.md:11-20,34-46,68-78`；`README.md:140-164` |
| **Workflow** | 拥有阶段顺序、恢复点、回退/门禁和终态语义的控制流程；它可以被打包成一个 Skill，也可以组合多个 Skills、Agents、scripts 与 adapters。`workflow-interview` 就是“编排器 Skill”。 | 不与 Skill 互斥；“workflow”是行为/状态所有权分类，“Skill”是交付与加载形态。 | `skills/workflow/workflow-interview/SKILL.md:11-20,38-72` |
| **Carrier** | Router 选择的执行载体/运行包络：Main Agent、subagent、独立 Desktop Task、human、deterministic harness 等。它提供或缺失上下文隔离、actor separation、持久性、用户可见性、重试和 receipt 能力。 | 不决定业务角色，也不自带 Skill 语义或授权。 | Q27 用户裁决：`1-interview/rounds.jsonl:29` |
| **Adapter** | Core 与外部 tracker/执行器/carrier 之间的协议翻译层；接 typed request，返回 ack/event/receipt。按 Q20/Q25，它可以发布 receipt，但不得直接改 Gate 或 Story done。v2 的 GitHub/GitLab、Board/Manual adapters 仍是设计候选，尚无实现。 | 不是 workflow owner、Gate evaluator 或业务决策者。 | `1-interview/context.md` Round 19/20/25 摘要；`1-interview/rounds.jsonl:26`；`2-prototype/drafts/v2-skill-chain.md:9-86`（draft，非已锁事实） |

## “角色由什么定义”必须拆成两层

### A. Host Agent role

由 harness 创建 Agent 时的 agent definition / agent type 定义，通常影响系统提示、专长、模型档和可用行为。它属于运行时配置。

- 当前 Codex `spawn_agent` 可以选择 host role；同一个 role 可接不同 WorkOrder/Skill。
- 本仓 `.copilot/agents/*.agent.md` 也是另一 harness 的 host-specific role 定义：`Master` 负责澄清/委派/聚合，`Worker` 执行，`Evaluator` 只读验证。见 `.copilot/agents/Master.agent.md:6-30`、`.copilot/agents/Worker.agent.md:8-31`、`.copilot/agents/Evaluator.agent.md:7-19,67-69`。
- 这类定义不能跨 harness 原样当公共 Story 协议；README 明确 `.copilot/agents/` 是 Copilot 专用，而 `skills/` 才跨平台。见 `README.md:9-14`。

### B. Workflow/domain role

由 Story/Profile/DAG/WorkOrder 定义，应包含：

- 责任与停止条件；
- 可读/可写范围与 side-effect authority；
- 是否需要独立 actor/context；
- subject 与输入 revision；
- 可接受输出/receipt 类型；
- retry/handoff 范围；
- 是否需要用户可见、长期持有或人工交互。

当前实现只覆盖一部分：v3 TaskRecord 保存 `role/modelTier/routingReason/thread/parent/generation/lease`；v4 attempt 保存 `ownerThreadId`，review receipt 保存 `reviewerSessionId` 并与 owner 比较得出 `same-session|independent|unknown`。见 `orchestrate.mjs:561-585`、`master.mjs:372-404,827-923`。

**证据结论：** workflow role 的权威不能只是一段 Agent prompt；至少 identity、parent、lease、subject 和 receipt provenance 要进入持久控制面。Host role 只是 Router 的一个实现选择，不能代替 domain role。

## 谁可以调用 Skill

### 已证事实

- **Main Agent 可以执行 Skill。** 仓库的 Copilot 例子明确写主 Agent 亲自执行时系统注入 Skill。见 `.copilot/agents/SuperPower.agent.md:18-30`。
- **subagent 可以执行 Skill。** `SuperPowerSub` 接收主 Agent 指定的 Skill，系统注入 SKILL.md 后执行；这直接否定“subagent 只能扮演角色、不能调用 Skill”。见 `.copilot/agents/SuperPowerSub.agent.md:11-24`。
- **独立 Desktop Task 也可以执行 Skill，但前提是它的 project/harness 能发现该 Skill。** 仓库规定 Codex 通过插件原生发现 `skills/`；跨 harness 的最低降级是 Agent 直接读 SKILL.md。见 `README.md:85-94`、`docs/porting-to-a-new-harness.md:68-75`。当前 Board prompt 可把 WorkOrder 与 Skill 要求送入独立 Task，但 Board registry 不证明该 Task 实际加载了哪一版 Skill。
- **Skill 本身不能直接“执行另一个 Skill”。** 文字上可以要求下一步加载/遵循另一个 Skill，真正的 caller 始终是承载该上下文的 Agent/harness；若要换 actor，则先派 Agent，再把 Skill 名/路径与输入交给它。`workflow-interview` 的三阶段就是一个编排器 Skill 指示宿主进入三个子 Skill。见 `workflow-interview/SKILL.md:11-20,38-44`。
- **script/core 不会像模型一样调用 Skill。** 确定性脚本可以校验、运行命令、写 registry 或产出 typed action；若下一步需要模型 Skill，必须由 host Agent/adapter消费该 action并创建/唤醒 Agent。Board 明文规定脚本不替代 `create_thread/wait_threads` 生命周期。见 `aes-worktree-board/SKILL.md:8-10`、`orchestrate.mjs:1-4`。

### 当前 Codex 会话的宿主事实（不可外推）

- root 与 spawned agent 都是完整 Agent，拥有同一工具集合；child 还能继续 spawn child。
- `fork_turns=none|all|N` 控制 subagent 初始上下文，不改变其 role；所有 agent 共享当前工作目录与文件系统。
- 内部 subagent 使用 collaboration tree 管理；独立用户 Task 使用 Desktop `create_thread`，会显示在侧边栏并拥有独立 thread 生命周期。

所以，“谁能调用 Skill”首先由**该 carrier 的 harness 是否发现 Skill、是否有完成动作所需工具**决定；其次由 workflow policy 决定是否允许它在该角色中调用。不是由“主/子”二字静态决定。

## 载体能力矩阵（当前可证）

| 载体 | 身份 | 上下文 | 持久/恢复 | 用户可见性 | 权限/隔离 | 重试 | receipt 现状 | 可调用 Skill |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Main/Root Agent | 当前用户 task/thread；仓库暂无统一 actor schema | 持有用户对话与全局聚合上下文 | 会话可续，但 workflow 真源必须落 manifest/registry | 当前会话可见 | 当前宿主高权限；需靠流程限制全局写入 | 同会话继续；可重建 | 通常是聚合/路由者，不应以自报代替 evidence | 是 |
| issue Owner session | `jobId + attemptId + ownerThreadId + slot/lease` | 一张票的闭环上下文 | 优先恢复原 thread；不可恢复才新 attempt | carrier 是 Desktop Task 时可见 | executor 持 writer lease；边界可机械校验 | 同 owner 修复；不可恢复新 attempt | QA/review 绑 job/attempt/candidate；owner 本身不是 PASS | 是 |
| 内部 subagent | 当前宿主有 agent id/任务名；仓库尚未统一持久化 | 可 fresh/fork，适合隔离事实或评审 | 当前仓未定义跨 root task 的 durable resume | 不可冒充侧边栏 Desktop Task | 当前 session 与 parent 共享工具/文件系统；“只读”主要是指令纪律，不是仓库证明的沙箱 | parent 可 follow-up/重新 spawn；未接通 attempt ledger | 循环 QA 只出 finding；普通 subagent 结果未自动成为 durable receipt | 是 |
| 独立 Desktop Task | `taskId/threadId`，可带 `clientThreadId/hostId/projectId/parent/generation` | prompt 自包含，不依赖主仓对话 | Registry + inbox + cursor + Git 可恢复；thread 可继续消息 | 侧边栏可见、用户可独立跟进 | executor lease/reviewer parent 可机械约束；实际 OS/凭据隔离仍未证明 | BLOCK 回原 executor；不可恢复时新 attempt | thread/event/parent/commit 可进入控制面 | 是，须 preflight Skill 可发现性 |
| deterministic harness | action/command/run id | 无模型上下文 | 只要输入与 receipt 持久化即可重放 | 通过 Web/日志投影 | 权限由进程/adapter；结果可机械复核 | 幂等重试 | 最适合产出 command/exit/artifact receipt | 否；它运行代码，不“遵循 Skill” |
| Human | 稳定 actor identity（新版待实现） | 人类观察上下文 | Receipt/Revocation 持久化 | 直接可见 | Q34 要求按 Receipt 类型分权，不等于 tracker 写权限 | 按 checklist/revision 重做 | 新版应绑 actor/subject/policy/revision；当前未实现 | 不作为 Agent 调 Skill |

## 身份、权限与 Receipt 的真实绑定

### 当前已经机械绑定的部分

- v3 Desktop Task：`taskId/threadId/issue/worktree/role/parentTaskId/generation`；executor 独占 writer lease，reviewer 必须关联同 Issue/worktree 的 executor，且不取得 writer lease。见 `orchestrate.mjs:469-585`。
- v3 event：inbox 校验 thread→Task 或 reviewer→parent 归属；APPROVE 必须来自已关联 reviewer Task，不能由 executor event 冒充。见 `orchestrate.mjs:975-1078,1101-1108`。
- v4 owner/reviewer：attempt 保存 `ownerThreadId`；review result 必须有 `reviewerSessionId`，Core 只按两者相等与否推导 same-session/independent，缺一则 unknown。见 `master.mjs:372-404,856-923`。
- QA/review receipt：至少绑定 `jobId/attemptId/commitSha`，新 candidate 会让旧 receipt stale；recovery 新 attempt 保留旧记录但重新验证。见 `aes-qa/SKILL.md:56-60`、`master.mjs:410-451,552-579,827-845`。
- Q34 已决定未来 Human Receipt 需按类型授权并绑定 actor/subject/policy digest/revision，tracker 写权限不能代替验收/豁免权。见 `1-interview/rounds.jsonl:36`。

### 尚未绑定/不能宣称的部分

- 当前通用 QaReceipt 没有统一 `producerAgentId + workflowRoleAssignmentId + carrierId + skillDigest`；不能证明“是哪一个 Skill 版本、以哪个 host role 执行”。
- `reviewerSessionId != ownerThreadId` 只证明两个 session id 不同，不证明 OS、凭据、文件系统或人员身份隔离；当前 subagent 也共享 workspace。
- Board v3 的 `role=reviewer` 与当前 Codex `agent_type=code-reviewer` 没有 schema 映射，不能视为同一字段。
- 能调用工具不等于有业务授权。Profile/Gate capability 才应决定能否签发某类 receipt；Q34 已明确按 receipt 类型分权。
- 独立 Desktop Task 的 Skill 加载版本/digest 当前未进 TaskRecord，跨 checkout/插件版本时会有漂移风险。

## 对“主 Agent / subagent / 独立 Task”的边界推论

以下是由现有决定与实现共同支持的**设计推论**，不是已实现 Router：

| 节点性质 | 最匹配载体 | 理由 |
| --- | --- | --- |
| 直接询问用户、改变 Contract、跨 RepoLane 仲裁、签发全局路由/Story terminal | Main/Story owner Agent + deterministic Core | 需要用户上下文和唯一写入权；subagent 不得替用户裁决，child workflow 不得写 Story done。 |
| 两个以上独立事实问题、短时技术探索、无副作用候选比较 | 并行 subagent | 上下文隔离和并行收益高；结果只作为 facts/proposals，由 host 聚合。 |
| fresh-context 循环 QA、短时 code/spec review，且无需独立恢复/用户可见 | subagent + 对应 Skill | 本仓已有模式；只产生 finding 或受 validator 接收的 scoped result。 |
| 跨多轮、拥有 writer lease、需要原 owner 修复/恢复、用户要在侧边栏跟进 | 独立 Desktop Task | thread/registry/lease/可见性/恢复要求超过内部 subagent 当前协议。 |
| 高风险独立 review/acceptance，Profile 明确要求独立 actor、独立 retry 或可交接 | 独立 Task 或满足同等 capability 的 carrier | “独立”由 capability 与 receipt provenance证明，不由 Skill 名称证明。 |
| 固定命令、schema/digest/Gate/reducer | deterministic harness/core | 不需要 Agent 主观推理，避免额外上下文与自报。 |
| 视觉/现实世界观察且 AI 无法充分替代 | human carrier + checklist/Receipt | Q25 补充与 Q34 授权决定；不应塞进实现 owner 自证。 |

## 对 v2 Skill 链草稿的直接校正点

`v2-skill-chain.md` 的五层拆分方向大体成立，但还缺一个正交轴。单写：

```text
Delivery Coordinator → Capability Router → aes-worktree-board → aes-issue-worker → aes-qa
```

仍无法回答“谁在运行”。每个可调度 DAG node 至少要拆成：

```text
NodeSpec
  = workflowRole
  + capability / Skill-or-runbook
  + carrierRequirements
  + subject + policy revision
  + authority / side-effect boundary
  + retry / handoff contract
  + required receipt schema

RouteDecision
  = selectedCarrier
  + selectedHostAgentRole (若 carrier 是 Agent)
  + selectedSkillDigest / command catalog
  + actor/session/task identity
  + routingReason
```

这不是新用户决定，而是实现 Q27“DAG 声明能力、Router 选载体”和 Q25“Core 从 receipts 推 Gate”所需的最小可审计分解。当前 v2 草稿只显式画了 Skill/workflow/core/adapter，尚未把 role 与 carrier 的逐节点绑定画出来。

## 未知项

- 新版公共 schema 尚未定义 `RoleAssignment`、`CarrierBinding`、`SkillBinding`、`ActorIdentity` 的字段、digest 与 revision 关系；这是后续原型/Contract 的 Agent-owned 设计，但不能省略语义。
- 尚无实现中的 Capability Router，也没有一份机器可读矩阵能把 role requirements 映射到 subagent/Desktop Task/human/harness。
- 尚未决定哪些 review/QA Profile 必须使用独立 Desktop Task，哪些允许 fresh-context subagent；Q27 只决定由 capability 驱动，不替每个 Profile 做映射。
- 当前 Codex internal subagent 的 agent id/canonical task name 是否能跨 root task 永久恢复，仓库没有协议；不能把本次 collaboration tree 当长期 registry。
- 当前 Desktop Task 能否证明加载了指定 Skill 的精确版本/digest，未找到机制或 receipt。
- “host Agent role”是否改变工具权限，在不同 harness 中不同；本仓只有 prompt/manifest 例子，没有跨平台统一能力证明。
- Human/Agent 的授权身份如何跨 GitHub/GitLab 归一化，Q34 已锁公共语义，但 adapter/schema 尚未实现。

## 没查的

- 未运行 live `create_thread` 或 subagent 权限破坏性实验；本分片不创建用户可见 Task，也不测试凭据/网络隔离。
- 未修改 manifest、rounds、context、2-prototype 草稿或产品代码；未替用户决定具体 Profile→carrier 映射。
- 未把当前 Codex agent type 列表固化进跨平台设计；它属于漂移的 host capability，Router 应探测而不是写死。
