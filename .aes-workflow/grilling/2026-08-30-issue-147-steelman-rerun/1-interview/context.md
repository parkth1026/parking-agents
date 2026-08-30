# Context Snapshot: 2026-08-30-issue-147-steelman-rerun

- 创建：2026-08-30T00:43:52+08:00
- 分片来源：`facts/agent-isolation.md`、`facts/verification-topology.md`、`facts/interview-gap-audit.md`、`facts/skill-composition-chain.md`、`facts/board-human-status-ux.md`、`facts/agent-skill-role-ontology.md`、`facts/role-carrier-topology-options.md`、`facts/role-vs-skill-critique.md`、`facts/router-escalation-policy.md`、`facts/router-ambiguity-failure-analysis.md`；Q26 后用户授权 subagent 探索，宿主聚合
- 调查绑定：工作目录 `G:\GIT\AI_WorkFlow\parking-agents-manual`；分支 `parking-agents-manual`；初始 HEAD `5a7a634ac71ec0ff3afd6bd09427a463381e794c`；Round 6 复核时 HEAD 已由用户侧推进至 `04bbc7a929f39a99c246ce16483aa12733192668`，当前只剩本 issue 目录未跟踪

## 任务陈述

基于这个 issue  [https://github.com/parkth1026/parking-agents/issues/147](https://github.com/parkth1026/parking-agents/issues/147)   [$parking-skills:workflow-interview](G:\GIT\AI_WorkFlow\parking-agents-manual\skills\workflow\workflow-interview\SKILL.md) 我们重新走一遍这个  流程 。并且每个问题都要 双向 steelman进行反思。

## 用户提出的方案

以 GitHub Issue #147 为上游材料，重新执行 `workflow-interview` 三阶段；所有需要用户裁决的问题都先做双向 steelman 反思。

## 意图假设

用户要重新锁定「#147 相关工作的目标与完成口径」。Round 1 已确认：本轮拥有完全重新裁决权。Round 2 已确认：本轮只重新完成设计定稿。Round 3～5 已确认：首要目标是切断上下文爆炸并保留可从持久事实重建的全局掌控，tracker/repo 按领域分治。Round 6～7 已确认：GitHub/GitLab 都是 v1 一等边界，共同领域语义等价，原生能力只作 enhancement。Round 8 已确认：落点是独立、薄的组合层总控 Skill，覆盖从庞大需求到代码落地的完整旅程。Round 9～10 已确认：Web 投影优先，并开放三组白名单 typed domain commands。Round 11 已确认：Web 使用分层 Graph，全局层只展示 story/ticket/依赖/owner/状态/门禁，ticket 层展示决策、原型、执行 attempt、commit、review、evidence 和人工确认的局部旅程。Round 12 已确认：统一 `WorkTicket` envelope，并由类型化 lifecycle profile 定义各工作类型的合法输出与关闭门禁。Round 13 已确认：默认数据域只加载当前 story 子图，跨 story 关系按需惰性展开；全仓 inventory/portfolio 不进入 v1 默认路径。Round 14 已确认：map root 必须权威枚举成员，child back-reference 用于对账；不一致时降级并禁止收口。Round 15 已确认：profile 在 ticket 可领取后稳定不变，完成后关闭并通过 `produces`/`graduates_to` 创建一个或多个新票。Round 16 已确认：ticket 身份跨执行尝试稳定，每次执行追加唯一 attempt，旧 attempt 与证据不可覆盖。Round 17 已确认：公共 ticket 状态使用 `lifecycle + control + gate` 三个正交维度，Web 确定性合成主徽章。Round 18 已确认：tracker 保存紧凑的 attempt 控制事件索引，repo/Git 保存证据实体与大 payload，本地 runtime 只作可再生缓存。Round 19 已确认：typed command 只有 tracker ack 后才 committed；断连返回 `NOT_COMMITTED` 且 canonical 状态零变化。Round 20 已确认：核心定义 typed `ExecutionAdapter`，只交换请求与 attempt 事件；board/manual/其他执行器实现 adapter。Round 21 已确认：review/acceptance 默认是来源票 gate/evidence，满足独立 owner/context/blocking/retry 或跨票覆盖时才晋升为 WorkTicket。Round 22 已确认真实执行模式：初始可拆出大量任务，但交付必须按可验收波次推进；每轮验收会产生 bug、未预见问题或小幅需求变化，必要时回流上游后再进入下一轮收敛。Round 23 已确认：一个稳定 `StoryRoot` 下常驻 `DiscoveryMap` 与 `DeliveryMap` 两个子图；两者各有 frontier 与局部终态，`StoryRoot` 独占最终 `story done`。Round 24 已确认：使用仓库版本化、声明式 `ProfileRegistry`；ticket 在 ready 前绑定 `profile_id + schema_version + digest`，扩展只能声明字段、证据要求和 capability 引用，不执行任意代码。

- Round 25 已确认：核心从 typed evidence receipts 与 profile 规则确定性推导 gate；adapter/capability 只能发布 receipts，不能直接改 gate。
- Round 25 补充已确认：任务规划必须决定风险与测试强度；默认尽量由 AI/harness 完成真实有效测试，高风险多测、低风险少测；每个执行 session 做与影响面匹配的验证，最终交付前必须全量回归。人工测试主要保留给高度可视化且 AI 无法充分替代的场景，并必须提供可逐条勾选的 checklist 与 testcase。实现、QA、review、acceptance 等验证角色是 Delivery DAG 的正式节点或 gate。
- Round 26 已确认：规划冻结验证下限，执行期由核心根据真实 diff、依赖、运行路径和 capability 计算 effective risk，只能升档、不得由 executor 降档；升档到人工测试时生成 checklist/testcase 并等待，Story 最终交付前强制全量回归。
- Round 27 已确认：DAG 声明角色所需的上下文隔离、actor separation、持久性、用户可见性、重试范围与 receipt capability，由 Router 选择满足要求的 harness/subagent/独立 Agent/Task/human carrier；选择理由必须可解释并持久记录。
- Round 28 已确认：代码型 Story 必须合入目标 integration SHA，并在该 SHA 上完成最终全量回归；所有 ticket/gate 终态且无必需 human checklist 待办后自动 done。只有契约、风险升档或不可逆动作明确要求时等待人工，不设 universal handed-off。
- Round 29 已确认：candidate、integration、contract、artifact 或 decision subject 版本变化后，绑定旧 subject 的 receipt 一律 stale；旧证据保留审计但不能满足新 Gate，不允许 carry-forward 或基于 freshness/主观判断复用。
- Round 30 已确认：最终全量回归任何非 PASS 默认阻止 Story done；只有 ProfileRegistry 明示 waivable 且授权 human 提供完整 WaiverReceipt 时，才允许 `done-with-waiver`，绝不改写为 PASS；non-waivable Gate 永久不能豁免。
- Round 31 已确认：data-sensitive 验证使用版本化 SamplePack；优先使用用户提供/授权数据，QA 可按设计、一手规则、历史缺陷和现有资料自行构造或寻找 production-shaped cases，无法取得数据或确定 expected output 时才 AWAITING_INPUT。隐私按实际等级处理，不默认把常规测试数据视为敏感。
- Round 32 已确认：Delivery 发现不改变当前 contract 的 regression、漏实现、既有 AC 边界/兼容修复和测试升档可自动进入下一 wave；修改 goal、范围、公共行为、AC/expected output、数据/权限边界、Profile、integration target，或无法分类时必须 requires-decision 回流 Discovery。Contract revision 后旧证据按 Q29 stale。
- Round 33 已确认：一个 StoryRoot 代表一个用户意图，并允许包含多个一等 RepoLane；每条 lane 各自绑定 repo identity、tracker、exact checkout、integration target、Profile/Gate catalog 与局部 done，所有必需 lane 的 integration gate 合成 Story done。
- Round 34 已确认：HumanTest、Acceptance、Waiver 等 Human Receipt 由 Profile/Gate 分别声明授权角色或 capability、独立性与可选 quorum；Receipt 绑定 actor、subject、policy digest 与 revision，撤销只追加 RevocationReceipt，不删除历史。
- Round 35 已确认：Repo Registry 是 profile 语义唯一真源；条目缺失、损坏或 digest 不匹配时进入 fail-closed degraded，只允许读取、诊断和不依赖 profile 的止损动作，禁止推进 Gate 或收口；恢复必须找回精确 Registry 定义或经 Discovery 创建新票。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| GitHub 身份已显式绑定 `parkth1026`，对 `parkth1026/parking-agents` 有 admin 权限；本轮只做了读取。 | 2026-08-30 实时 `gh api user` 与 repository permission 查询 | Fact |
| #147 标题为“story 级全链条工作流整合设计”，状态 `CLOSED`，有 12 张均已关闭的子票 #148–#159，且无 blocked-by/blocking 关系。 | GitHub Issue #147 实时 JSON，更新时间 2026-08-29T04:18:31Z | Fact |
| #147 的原始终点是设计定稿（spec + 必要 ADR）；明确排除实现，且覆盖流程真源与 web 投影层设计，落地顺序真源先行、web 后置。 | `https://github.com/parkth1026/parking-agents/issues/147` 正文 Destination / Out of scope | Fact |
| #147 已以 `docs/design/workflow-story-map/spec.md` v1.0 和 ADR-0001–0004 关闭；正文称“Not yet specified：无”。 | #147 Decisions / 关闭评论；`docs/design/workflow-story-map/spec.md:1-5` | Fact |
| 定稿把目标定义为独立组合层技能 `workflow-story-map`，完成 story 的拆解→决策→执行→验收，并通过切割会话谱系避免上下文爆炸。 | `docs/design/workflow-story-map/spec.md:16-25` | Fact |
| 四份已接受 ADR 固定了：独立组合层、tracker 中性单真源协议、story 收口四条件硬门禁、grill→出口融合→派发阶段模型。 | `docs/adr/0001-*.md` 至 `0004-*.md` | Fact |
| 设计仍把两个数值/布局问题顺延到“实现首票”：会话轮次上限校准、story/票目录布局。 | `docs/design/workflow-story-map/spec.md:248-263` | Fact |
| 当前 checkout 有用户自有未提交修改与删除；本流程只新增当前 issue 目录，不会覆盖、暂存或提交这些改动。 | 2026-08-30 `git status --short --branch` | Fact |
| 当前仓库验证基建为零依赖 Node；仓库门为 `npm test`，技能晋级门为五件套齐全且该技能 `run-tests.mjs` 退出码 0。 | `docs/testing.md:1-7`；`docs/agents/skill-release.md:5-20`；`package.json:7-13` | Fact |
| 自动 doc-contract 绿不证明真实端到端可用；能运行的 harness 仍需干净会话人工验收并留 transcript。 | `docs/testing.md:54-68` | Fact |
| 当前仓明确声明 GitHub tracker；其 wayfinding 语义包含 map、child ticket、blocking、frontier、claim、resolve，优先使用 GitHub sub-issues 与 native dependencies，缺失时退回正文行文。 | `docs/agents/issue-tracker.md:1-3,40-45` | Fact |
| `G:\GIT\AI_WorkFlow\aes-agent-manual` 明确声明自建 GitLab `git.51vr.local/neon/TWE/aes-agent`；其 wayfinding 也包含同六类语义，但 child 用 `Part of` 行文，blocking 优先 GitLab `/blocked_by` quick action。 | `G:\GIT\AI_WorkFlow\aes-agent-manual\docs\agents\issue-tracker.md:1-5,41-46` | Fact |
| 用户确认 GitLab 仓库数量比 GitHub 更多，且每个仓库已在自身规则中声明 tracker；因此 GitLab 是 v1 现有生产边界，不是未来可选兼容项。 | Round 6 用户原话；两仓 tracker 文件交叉核验 | User decision + Fact |
| `workflow-interview` 只锁一个任务的“做什么/怎么算做完”，不实现目标；其真源是单 issue 目录与三阶段门禁。 | `skills/workflow/workflow-interview/SKILL.md:6-20,24-55,116` | Fact |
| `wayfinder` 默认只规划：map 是 tracker canonical index，ticket 逐个解决决策，路线清楚即交接；每会话最多一票，且 tracker 物理表达由各仓 tracker doc 决定。 | `skills/matt-skills/engineering/wayfinder/SKILL.md:3-25,55-80,103-126` | Fact |
| `aes-worktree-board` 的 charter 是在主仓编排既有 worktree、执行/review/merge 与恢复；其当前 live Issue 身份和采集路径明确绑定 GitHub。 | `skills/workflow/aes-worktree-board/SKILL.md:2-10,19-47,49-67` | Fact |
| Matt 当前公开设计主张 skills 要 small、adaptable、composable；user-invoked skills 负责 orchestrate，model-invoked skills 承载可复用纪律，前者可调用后者。 | `https://github.com/mattpocock/skills` README，2026-08-30 通过 Defuddle 实时读取 | Fact |
| `aes-workflow` 远端 `dev` 与本地参考 checkout 均为 `25cc3ce157bace9b7f813bb2642aca516b2b2af4`；其 14-skill bundle 由 `aes-using-workflow`/`aes-go` 作为用户入口，后续逐文件调用深技能。 | `G:\GIT\AI_WorkFlow\aes-workflow\skills\engineering\README.md:5-20`；`aes-go/SKILL.md:8-40`；`git ls-remote origin refs/heads/dev` | Fact |
| AES Workflow 把仓库 Markdown 定为流程状态真源，确定性工具只生成 ID/digest/index/结构校验；控制台从 `state.json`、artifact 依赖与 WayFinder DAG 投影 Web，并已有受约束的本地 POST 写回服务。 | `aes-using-workflow/SKILL.md:8-35,113-122`；`references/protocol.md:3-10,178-205,349-387`；`console/export.py:1,59,447-480,634-701,1015-1135` | Fact |
| 用户明确要求 dynamic graph/map 展示从大需求到代码落地的完整旅程；能力同时覆盖分析、决策、执行、解决问题和编码，而非 planning-only。 | Round 8 用户原话 | User decision |
| `aes-worktree-board` 当前全仓采集会请求 `state=all --limit 1000`，并对关闭 issue 并发补查 timeline；全仓可见因此具有真实的网络、权限、响应时间与数据量成本。 | `skills/workflow/aes-worktree-board/scripts/collect.mjs:366-369,436-446` | Fact |
| 旧 story-map 的收口对象是“当前 story map 名下执行票全部终态”，story 契约还持有全票 digest 清单；其正确性不要求读取仓库其他 story 的 issue。 | `docs/design/workflow-story-map/spec.md:37,99,132-137` | Fact |
| Matt 当前上游 Wayfinder 只规定一个 decision map：默认只规划、不交付，route clear 后 map 完成；允许 Notes 显式覆盖为 execution-carrying map，但没有规定“探索 map 自动产生第二个 execution map”。 | `https://github.com/mattpocock/skills/blob/main/skills/engineering/wayfinder/SKILL.md`（2026-08-30 实时读取） | Fact |
| Matt 当前上游 `to-tickets` 从已清楚的 plan/spec 直接产出 tracer-bullet implementation tickets 与 blocking edges，并明确不关闭或修改 parent；上游把它们定义为执行 DAG，而不是第二个 `wayfinder:map`。 | `https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md`（2026-08-30 实时读取） | Fact |
| 当前 `aes-qa` 与 board 控制面要求 review/QA receipt 的 commit SHA 精确等于当前 candidate；candidate 前进后旧 receipt 进入 `STALE_EVIDENCE`，不能顶替新候选验证。 | `skills/workflow/aes-qa/SKILL.md:56-60`；`skills/workflow/aes-worktree-board/SKILL.md:416-419` | Fact |
| 当前控制面研究把 candidate 前进与 integration base 前进列为两层证据失效不变量；合并验证必须绑定精确组合快照，而非复用分支自身的旧绿灯。 | `docs/research/自主闭环harness设计-行业调研-2026-08-27.md:206-212,228,239-243,260` | Fact |
| 用户要求规划阶段决定测试强度，并同时避免少测与对微小改动滥跑全量回归；最终交付前必须全量回归。真实文本/数字样本是调研和执行前的必要输入。 | Round 25 补充原话 | User decision |
| 用户要求人工测试主要用于 AI 无法充分替代的高度可视化场景；一旦需要人工测试，必须生成逐条可勾选的 checklist 与 testcase，全部确认后才能验收。 | Round 25 补充原话 | User decision |
| 用户把实现、QA、代码审查、验收和常见 harness 视为 Delivery DAG 的重要角色；subagent 或独立 agent 的拓扑选择需要按角色性质裁决。 | Round 25 补充原话 | User decision |
| 现有工作流中 subagent 与独立 Desktop Task 不是同一载体：Desktop Task 侧边栏可见并有 thread/租约/registry 身份；fresh-context QA subagent 只有上下文隔离，循环轮只出 finding、不产 durable receipt。v3 独立 reviewer Task 与 v4 review subagent 并存，尚无统一机械选型规则。 | `1-interview/facts/agent-isolation.md` | Fact |
| Durable receipt 当前绑定 job/attempt/candidate/base，而不绑定产品称谓；Master 恢复依赖 registry/inbox/receipts/Git，不依赖对话记忆。 | `1-interview/facts/agent-isolation.md` | Fact |
| 当前 effectiveRisk 只能按 changed paths 升档 review 深度与 merge 策略，尚不能机械生成 QA 最小测试集；IssueWorkOrder 也未携带完整 risk/test-intensity 合同。 | `1-interview/facts/verification-topology.md` | Fact |
| 当前人工测试已有 step/expected 的目标形态，但 Board 只接收整体 human PASS/FAIL，不能证明每条 testcase 都被逐项勾选；review 能记录 same-session/independent/unknown，但尚未把独立性做成 gate。 | `1-interview/facts/verification-topology.md` | Fact |
| 当前“merge 后全量回归”仍主要是流程文字：Core 只校验命令非空且 exit 0，没有 GateCatalog digest 或 full-suite 覆盖证明。 | `1-interview/facts/verification-topology.md` | Fact |
| 旧 spec 的 `interview → 匿名拆票功能位 → board → 收口` 无法覆盖新版双图 wave 回流、多 RepoLane、typed ExecutionAdapter、ProfileRegistry、Receipt Gate 与 Human Receipt 授权；完整链必须区分用户入口 workflow、阶段 workflow、原子能力、deterministic core 与 adapters。 | `1-interview/facts/skill-composition-chain.md` | Fact + Prototype finding |
| `wayfinder`、`to-spec`、`to-tickets` 各自拥有 tracker 生命周期，是独立 workflow，不应被当作无副作用原子嵌套；`aes-issue-worker` 是 ticket owner workflow，`aes-merge-worker` 仍缺独立 SKILL。 | `1-interview/facts/skill-composition-chain.md` | Fact |
| Board 的状态获取优势来自 Now/Why/Next 多投影：全局摘要、Workers/Lane、List 队列、依赖图、渐进详情和就地操作；最值得复用的是概览→一跳 peek→完整证据，而非单仓 Issue 四态或 worktree/runner 模型。 | `1-interview/facts/board-human-status-ux.md` | Fact + Prototype finding |
| Board 自身仍缺一等 Action Center，`whyNotComplete` 藏在 tooltip，frontier 不等于 eligible frontier，LIVE 也不是自动拉取；新版 Web 不能照搬这些缺口。 | `1-interview/facts/board-human-status-ux.md` | Fact |
| Role、Skill、Workflow、Carrier、AgentInstance 与 Core/Adapter 是正交概念；外层 Workflow 应调度 RoleAssignment，Agent carrier 再在角色授权内调用一个或多个 Skill，human/harness 则不必调用 Skill。 | `1-interview/facts/agent-skill-role-ontology.md`；`1-interview/facts/role-carrier-topology-options.md` | Fact + Prototype finding |
| subagent 可以执行 Skill，但 `subagent` 名称本身不证明持久身份、独立权限域、用户可见性、writer lease、durable receipt 或 actor separation；这些必须由 RoleRequirements 与 carrier proof 机械表达。 | `1-interview/facts/agent-skill-role-ontology.md`；`1-interview/facts/role-vs-skill-critique.md` | Fact |
| 多 Agent team 是复合 carrier，不是新 Role；只有两个以上可并行、写面不冲突且存在 typed fan-in 的 RoleAssignments 才适合 team，merge/waiver/单一用户裁决不得授予 team 整体。 | `1-interview/facts/role-carrier-topology-options.md` | Prototype finding |
| v2 Skill 图把 Domain/Accountability DAG 与 Runtime/Invocation Graph 混成同一种箭头，无法说明是否产生新 actor、权限/lease、finding/receipt authority 与恢复边界，必须拆成两张图。 | `1-interview/facts/role-vs-skill-critique.md` | Prototype finding |
| Carrier 不是 `subagent → Task → team → human` 的单轴强度梯子；Router 必须从 Profile/Role/Contract/影响面合成多维 hard requirements，先做 capability proof 硬过滤，再在全部满足者中确定性选择最小充分 Carrier。 | `1-interview/facts/router-escalation-policy.md`；`1-interview/facts/router-ambiguity-failure-analysis.md` | Fact + Prototype finding |
| “unknown” 至少分三类：Contract/scope 语义未知应 `requires-decision` 回流 Discovery；capability 或外部前置缺失应 `BLOCKED`/degraded；多个合格 Carrier 只在成本速度上难选时，应按版本化 tie-break 自动选择。把三类都实现为递归升档会造成 Task 爆炸、无限成本和 human/live 死锁。 | `1-interview/facts/router-ambiguity-failure-analysis.md` | Prototype finding |
| 同一 subject/policy revision 内 requirements 只能单调增加；capability 未证明按不具备处理，预算不足不能降级载体。可审计 RouteDecision 必须保存 canonical inputs、policy/profile digest、candidate 淘汰理由、capability proofs 与预算快照，而非只存模型自然语言理由。 | `1-interview/facts/router-escalation-policy.md`；`1-interview/facts/router-ambiguity-failure-analysis.md` | Prototype finding |

## 验证基建候选池

- `node skills/workflow/workflow-interview/run-tests.mjs`：验证本次使用的访谈编排、manifest、Goal Contract 校验与 dossier 导出脚本；代价低，但只证明流程工具结构与脚本行为。
- 未来 `workflow-story-map/run-tests.mjs`：当前尚不存在，若目标进入实现 effort，必须先随新技能建立；代价包含设计并实现可执行测试，不得用现有 workflow-interview 测试冒充。
- `npm run evals -- --skill workflow-story-map`：技能晋级的行为/触发评测入口；当前技能与五件套尚不存在，因此现在不可运行，代价包含新建技能及评测资产。
- `npm test`：仓库级结构、安装、hook、harness 文档契约与 repo 检查门；覆盖广、耗时高，且当前工作树有与本流程无关的用户修改，未来执行时必须绑定明确 candidate SHA/dirty scope 解读结果。
- 干净会话真实触发与端到端 story 演练：证明“单次 map 请求能跨拆解、决策、执行、验收完成”及会话切割不丢状态；成本最高，需要真实 tracker、可能需要 board/Web/人工验收，不能由单元测试替代。
- tracker 双栈证明：GitHub 可在当前账号/仓库实测；GitLab 当前未提供目标仓库与凭据，若保留双 tracker 硬承诺则必须新建 fixture/模拟层，或由用户提供真实 GitLab 验收环境并记录未执行边界。

## 四分类

- **Fact**：#147 的历史目标、12 张子票、已关闭状态、spec v1.0、四份已接受 ADR、两项顺延实现首票的问题、当前验证基建、checkout SHA 漂移，以及 GitHub/GitLab 两仓现有 tracker 约定。
- **User decision**：历史定稿仅作候选证据；本轮终点是新版设计定稿；能力落点是独立薄总控 Skill；Web v1 是投影 + 三组白名单命令；Graph 分为 story 全局图与 ticket 局部旅程；不同工作类型共享一个 `WorkTicket` envelope，以 lifecycle profile 保留类型门禁；默认只加载当前 story 子图、跨 story 按需惰性展开；map-root 权威枚举 story membership，child back-reference 对账；profile 在 ticket 可领取后稳定，完成后关闭并产生新票；ticket 与 append-only attempt 分层；公共状态采用 lifecycle/control/gate 正交三层；tracker 保存 attempt 控制索引，repo 保存证据实体；tracker ack 才提交 typed command；核心通过 typed ExecutionAdapter 组合执行器；review/acceptance gate-first、满足独立工作判据才晋升为票；一个 StoryRoot 下使用 DiscoveryMap/DeliveryMap 双子图并由 StoryRoot 独占最终终态；profile 来自仓库版本化声明式注册表并由 ticket 锁定版本与 digest；gate 由核心从 typed receipts 确定性推导；subject 版本变化后旧 receipt 无条件 stale；一个 StoryRoot 可包含多个一等 RepoLane，并由各 lane integration gate 合成最终 Story done。
- **Agent-owned**：在权威边界确定后，如何调查相关文件、如何组织可逆的过程产物、如何选择不改变外部契约的局部验证命令。
- **Blocked**：无。真实 GitLab API/权限验证属于后续实现 effort 的验证条件，不阻塞本轮设计定稿。

## 决定边界未知项

- 已定：允许推翻 #152–#159 与 ADR-0001–0004 的已接受决定；它们仅作证据。
- 已定：新的独立交付物是重新完成设计定稿，不包含实现。
- 已定：新版设计首先消灭上下文谱系爆炸，同时保留全局掌控。
- 已定：全局掌控必须能由任意新会话从持久事实完整重建，会话不是权威。
- 已定：完整接管允许同时依赖 tracker 与精确 checkout；tracker/repo 按领域分治，每项事实只有一个权威载体。
- 已定：GitHub/GitLab 从第一版起都必须完整支持，不能 GitHub-first。
- 已定：完整支持保证共同领域语义等价；平台原生能力只作可发现增强，不进入核心正确性。
- 已定：能力落在独立、薄的组合层总控 Skill；不把深技能 prompt 搬进总控。
- 已定：Web 既展示完整 journey，也允许经确定性控制层处理的白名单 typed domain commands。
- 已定：v1 包含人类回答/验收确认、claim/release/pause、retry/cancel/withdraw；不含建票拆票、改依赖、close/reopen/handoff；不创建或恢复 Agent。
- 已定：全局图与票内局部旅程分层；不在全局平铺所有 artifact/attempt/evidence。
- 已定：研究、决策、原型、实现、review、acceptance 共享统一 `WorkTicket` envelope；各类型用 lifecycle profile 定义合法输出和关闭门禁。
- 已定：Web 与总控默认只加载当前 story 子图；跨 story 依赖按需惰性展开；全仓 inventory/portfolio 留给 `aes-worktree-board` 或后续能力。
- 已定：story membership 由 map root 权威枚举，child `Part of` 为反向对账；关系不一致时显示 degraded 并禁止 story 收口，允许编排脚本幂等修复。
- 已定：`WorkTicket` 的 lifecycle profile 在进入可领取状态后稳定不变；完成后关闭并以 `produces/graduates_to` 创建新票；未开始票允许留痕后重新分类。
- 已定：ticket 生命周期与 execution attempt 分层；`retry` 创建新 attempt，`cancel` 终止当前 attempt 并按门禁回到 paused/ready，`withdraw` 才终止 ticket；commit/review/QA/evidence 必须绑定 attempt ID。
- 已定：公共 ticket 状态采用 `lifecycle + control + gate` 三个正交维度；profile 定义 gate 细节；Web 按确定性优先级合成主徽章并保留三维详情。
- 已定：Attempt ledger 按领域分治：tracker 是 append-only 控制事件索引真源，repo/Git 是证据实体真源；两边以 digest/pointer 连接，本地 runtime 必须可完全重建。
- 已定：tracker 未确认的 Web 命令一律 `NOT_COMMITTED` 且零 canonical 状态变化；不以 queued/local-first 冒充成功；命令携带 idempotency key，恢复连接后显式重试。
- 已定：核心定义 tracker-neutral typed `ExecutionAdapter`，只交换 `DispatchRequest/ControlRequest` 与 `AttemptStarted/EvidencePublished/AttemptFinished` 等消息；v1 至少有 board adapter 与 externally-driven/manual adapter。
- 已定：review/acceptance 默认表现为来源 ticket 的 gate/evidence；需要独立 owner/context/blocking/retry 或跨多来源票时晋升为 WorkTicket，以 `verifies/accepts` 连接来源票并阻塞其 gate。
- 已定事实：初始 discovery 能产出第一批 implementation tickets，但执行验收后会稳定出现 bug、未预见问题与小需求变化；delivery 必须按有业务意义、可验收且不过小的 wave 迭代收敛，而非一次性清空静态 DAG。
- 已定：采用一个稳定 `StoryRoot` + `DiscoveryMap` / `DeliveryMap` 两个子图；子图各有独立 frontier 与局部终态，`StoryRoot` 独占最终 `story done`；`requires-decision` 回流 DiscoveryMap，新的 `produces` 边进入下一 delivery wave。
- 已定：类型化 lifecycle profile 由仓库版本化、声明式 `ProfileRegistry` 权威定义；ticket 在 ready 前固定 `profile_id + schema_version + digest`，之后不可漂移；扩展不得执行任意代码。
- 已定：gate verdict 必须由核心从 profile 规则与 typed evidence receipts 确定性重算；adapter/validator/human 只能发布带 provenance 的 receipt，不能直接写 gate。
- 已定：规划阶段必须决定风险与测试强度；每个执行 session 运行与影响面匹配的有效测试，最终交付前必须全量回归。
- 已定：默认优先用 AI/harness 完成真实用户近似验证；高度可视化且 AI 无法充分替代时进入人工测试，必须生成逐条 checklist 与 testcase 并等待全部确认。
- 已定：实现、QA、review、acceptance 与相关 harness 是 Delivery DAG 的正式角色；其 subagent/独立 agent 运行拓扑需按角色约束表达。
- 已定：规划锁定最低验证要求；核心按实际影响面计算 effective risk，只能追加 gate，executor 无权降档；Story 最终验收前全量回归。
- 已定：DAG 固定角色的可验证能力要求，Router 按 capability 选择 harness/subagent/独立 Agent/Task/human carrier；不能只凭载体名称推断独立性。
- 已定：代码型 StoryRoot 只有在目标 integration SHA 上最终全量回归通过、全部必需 gate 终态后才 done；人工确认只按契约/风险/不可逆动作条件触发。
- 已定：任一必需 subject 版本变化后旧 receipt 无条件 stale；旧证据只作历史，不存在跨版本结转。
- 已定：最终全量回归非 PASS 默认阻断；仅 profile 明示可豁免且授权 human receipt 完整时以 done-with-waiver 收口，non-waivable 永不豁免。
- 已定：SamplePack 按正常 QA 工作方式取得；用户提供优先，QA 可自行推导/构造/寻找并记录来源，无法解决时请求用户输入；expected output、provenance、隐私等级与 digest 必须可审计。
- 已定：Delivery 仅可自动吸收不改变 contract 的发现；改变或无法判断用户承诺时保守回流 Discovery，contract revision 后重新进入 Delivery。
- 已定：StoryRoot 是一个用户意图的跨仓身份，允许多个 RepoLane；每条 lane 绑定自己的 tracker、checkout、integration target 与 Gate，必需 lane 的局部终态合成 Story done。
- 已定：Human Receipt 按类型分权；Profile/Gate 声明授权角色/capability、独立性与可选 quorum，Core 校验 actor、subject、policy digest 与 revision，撤销以追加 receipt 留痕。
- 已定：Repo Registry 无法按 ticket digest 精确重建时 fail-closed degraded；只允许读取、诊断和 Core 可独立判定的止损动作，恢复不得让旧票原地漂移。

## 未知项

- 已回答：历史定稿是待挑战的候选证据，不是强约束。
- 已回答：本轮“做完”的对象是设计定稿，不是可运行产品。
- 已回答：无论其它能力如何，story 规模仍决定单会话上下文规模就视为失败。
- 已回答：总控会话死亡后必须从持久材料恢复；会话只是事实的消费者和写入流程参与者。
- 已回答：冷启动接管可以要求同时取得 tracker 与精确 checkout。
- 已回答：GitLab 是 v1 一等硬约束，而且现有 GitLab 仓库数量更多；每仓由自身规则声明 tracker。
- 已回答：跨 tracker 以相同业务状态、动作、门禁、恢复和投影为准，不要求相同 API/UI。
- 已回答：story 交付是独立用户意图，必须有单独薄总控入口与状态机；覆盖 planning 和实际交付。
- 已回答：Web 拥有受控命令入口，但不拥有任意执行权或直接真源写权。
- 已回答：v1 白名单限定三组可机械裁决且不改变 graph 结构的动作。
- 已回答：全局只同时显示可管理线路；票内细节按需放大，跨票引用用提示或跨层边暴露。
- 已回答：不同票型共享身份、依赖、claim/pause/retry 命令和基础状态；关闭门禁留给类型 profile。
- 已回答：v1 只保证当前 story 子图完整，并把全仓 inventory/portfolio 能力留给 `aes-worktree-board` 或后续按需扩展。
- 已回答：map 通过 root 权威枚举 + child back-reference 对账，在不全仓扫描的前提下完整、可修复地定义 story 成员票。
- 已回答：研究、决策或原型产出实现工作时，关闭当前 ticket 并创建一个或多个新 profile ticket。
- 已回答：ticket 的业务身份与 execution attempt 采用两层生命周期，retry 追加新 attempt 而非重置历史。
- 已回答：全局 Graph 用 lifecycle/control/gate 三个正交维度比较不同 profile，并确定性合成主状态。
- 已回答：新会话只有当前 story tracker 子图与精确 repo checkout 时，必须能重建完整 attempt 时间线及证据指针。
- 已回答：tracker 是控制索引真源时，断网命令在收到 tracker ack 前不得改变 canonical 用户可观察状态。
- 已回答：薄总控核心只消费/产出 typed execution messages，不直接拥有 Agent、Desktop Task、worktree、merge 或 runner 生命周期。
- 已回答：review/acceptance gate-first，满足独立调度判据时才晋升为票。
- 已回答：discovery 收口后，第一波通常可拆，但 delivery 会通过多轮“实现→验收→bug/变化→再实现”逐步接近完成，执行侧存在独立的 wave 演进语义。
- 已回答：采用一个稳定 StoryRoot + 两个有独立局部终态的 DiscoveryMap/DeliveryMap，并由 StoryRoot 独占最终终态。
- 已回答：profile taxonomy 是仓库可扩展、但必须由每票版本锁定的领域策略；扩展采用声明式注册表。
- 已回答：gate 是从 typed receipts 机械派生的确定性投影，不是执行方可直接维护的权威字段。
- 已回答：规划验证计划是冻结下限，执行后真实影响面只能机械升档；最终 Story gate 强制全量回归。
- 已回答：DAG 锁定可验证的隔离、身份、持久性、可见性和恢复保证，由 Router 选择载体。
- 已回答：Workflow 先调度稳定 Role，再由 Router 按 Profile、风险、工作规模、持续时间、隔离与恢复要求选择 Carrier；低风险可由 fresh subagent 承担，高风险或长时工作升档为独立 Desktop Task，但 Receipt schema、subject/provenance 校验与 Gate 规则保持一致。
- 已回答：StoryRoot 绑定目标 integration SHA 与最终全量回归；human handed-off 仅条件触发。
- 已回答：receipt 精确绑定 subject，subject 变化后旧证据无条件 stale。
- 已回答：最终全量回归非 PASS 默认阻断；显式 waiver 是独立风险终态，不是 PASS。
- 已回答：真实样本由 production fidelity、来源与可审计 expected output定义；QA 自主获取/构造，必要时向用户索取。
- 已回答：Contract 不变的发现自动进入下一 Delivery wave；改变承诺或不确定时回流 Discovery。
- 已回答：一个 StoryRoot 允许多个一等 RepoLane，并由所有必需 lane 的 integration Gate 合成最终终态。
- 已回答：HumanTest、Acceptance、Waiver 等 Receipt 采用 Profile/Gate 范围授权，按类型分权并支持留痕撤销。
- 已回答：ProfileRegistry 缺失、损坏或 digest 不匹配时 fail-closed degraded；恢复只能找回精确定义或回流 Discovery 创建新票。
- 不再占用用户问题：具体状态值、节点/边字段名、Router 算法、Web 布局和验收矩阵结构由后续对照物与执行 Agent 在不改变上述公共语义的前提下确定。

## 访谈收口检查点（2026-08-30，Q35 已答）

- 当前阶段：`1-interview`，准备执行 done 门禁。
- 已完成裁决/回答：Q1～Q35；不要重新询问。`rounds.jsonl` 共 37 行，其中 Q7 重复两次且语义一致，另有 Q25-SUPPLEMENT；恢复时按 35 个逻辑问题理解。
- Q25 已选择 A；Q25-SUPPLEMENT 的风险分级、QA、人工测试、测试数据和验证 DAG 补充必须一起理解。
- 旧的“Receipt 结转”Q26 草案从未入库；真正 Q26 已回答 A。Q29 后续已明确所有旧 subject receipt 无条件 stale。
- Q32 已选择 A：Contract 不变的发现自动进入下一 Delivery wave；改变承诺或无法分类时回流 Discovery。
- Q33 已通过 `session.mjs round` 记录为 A：一个 StoryRoot 允许多个一等 RepoLane，各 lane 独立绑定 repo/tracker/checkout/integration/Gate，并合成 Story done。
- Q34 已通过 `session.mjs round` 记录为 A：Human Receipt 采用 Profile/Gate 范围授权，按 Receipt 类型分权并以追加 RevocationReceipt 撤销。
- Q35 已通过 `session.mjs round` 记录为 A：Repo Registry 是唯一 profile 语义真源；无法精确重建时 fail-closed degraded。
- 收口审计：意图、结果、边界、约束、现状均已定；剩余事项只改变字段命名、布局或执行算法，不改变目标、范围、公共行为、兼容性、验收或难逆成本，不再询问。

### Q35：ProfileRegistry 无法重建时怎么办（已回答 A）

**具体场景**：新会话接管一张已 ready 的 implementation ticket。票上绑定 `profile_id=implementation`、`schema_version=3` 和 digest `abc`，但当前精确 checkout 中该 registry 条目已被删除、损坏，或同名条目的 digest 变成 `def`。系统因此无法重建原先要求哪些测试、哪些 Receipt、谁能签 Waiver、什么条件允许关闭。现在必须决定它还能做哪些事，以及怎样恢复。

**支持 fail-closed degraded 的最强论证**：digest 只能证明“当前内容不是原内容”，不能告诉系统原规则是什么。若继续 claim、retry、接收 evidence 或关闭 ticket，就可能在缺少测试、授权或 non-waivable Gate 的情况下制造假绿。安全做法是保留历史投影和核心级止损动作，但阻止任何需要 profile 语义的推进；只有恢复精确 registry 定义，或经 Discovery 显式迁移为新 ticket，才能继续。

**反对纯 fail-closed 的最强论证**：长寿命 ticket 遇到 registry 清理、分支切换或跨机器接管并不罕见，永久依赖旧 checkout 会削弱 Q4 的可重建承诺。ticket ready 时若同时固化完整、规范化的 profile snapshot，并用已绑定 digest 校验，那么 snapshot 本身也能精确重放原规则；继续使用它不等于猜测，还能避免旧 registry 条目丢失导致 Story 无限阻塞。

**Crux**：可重建 profile 语义的权威输入必须始终来自 repo 中的精确 Registry，还是 ticket 在 ready 时保存的、digest 匹配的完整不可变 snapshot 也足以成为历史执行语义？

**可翻转变量**：Registry 是否保证永久保留所有被引用版本、ticket 寿命、tracker payload 上限、跨机器/跨分支接管频率、snapshot 是否包含完整声明而非摘要、是否能验证签名与 digest、缺失期间是否必须支持 pause/cancel 等止损动作、迁移旧 ticket 的审计成本。

候选：

- **A. Repo Registry 是唯一语义真源；缺失时 fail-closed degraded — 57%（推荐）**：允许读取历史、导出诊断，并执行 Core 无需 profile 即可判定的止损动作，如 pause 当前 attempt、cancel 当前 attempt、release claim；禁止新 claim、dispatch、retry、接收新 evidence、重算为 passed、关闭 ticket 或合成 Story done。恢复方式是找回 digest 精确匹配的 Registry 定义，或回流 Discovery 创建绑定新 profile 的替代票，旧票不原地漂移。好处是绝不在未知 Gate 下推进；代价是 Registry 保留策略或旧 checkout 丢失会冻结交付。
- **B. Ready 时固化完整 ProfileSnapshot；Registry 缺失时按匹配 snapshot 继续 — 38%**：ticket ready 时把规范化完整 profile snapshot 与 digest 写入持久账本；Registry 正常时以 Registry 对账，缺失时只要 snapshot 完整、签名可信且 digest 匹配，就按历史 snapshot 继续执行。好处是长寿命 ticket 可跨清理、分支和机器恢复；代价是 Registry 与 snapshot 形成双载体，需要定义权威优先级、存储上限和防篡改规则。
- **C. 按同名 profile 的当前最新版自动迁移并继续 — 5%**：找不到旧 digest 时加载当前同名 profile，记录 migration event 后继续。好处是恢复最快；代价是测试、权限和关闭门禁可能静默改变，违反 ticket ready 后 profile 稳定及 Q29 的 subject 失效规则。

新会话的下一动作：执行 `session.mjs stage ... 1-interview done` 五维门禁；成功后完整读取 `aes-prototype` 及其要求引用，进入 `2-prototype`。

## Prototype Web 方向检查点（2026-08-30，WEB-P9 Map-first rework 已完成，待确认）

- 当前阶段：`2-prototype`，状态仍为 pending；尚未执行阶段 done，也未进入 Goal Contract。
- WEB-P8 的 provenance 规则继续有效：真实 #147、local dossier、repo runtime、derived classification 与 simulated coverage 必须隔离；真实 Delivery runtime 仍为 `NOT_CONNECTED`。
- WEB-P9 已通过 `session.mjs round` 以 `round:49 / q_id:WEB-P9` 记录为 `REWORK_MAP_FIRST_DUAL_DYNAMIC_MAPS`，`web_artifact_confirmed=false`。用户明确要求当前 Story 全局地图成为第一可视化，并质疑顶部六格为什么像固定流程。
- WEB-P9 推翻：P3 的工作台优先/Map 第二视图、WEB-P6 的 Queue-first 首屏主密度、WEB-P7 的固定六阶段顶部主坐标。不要再把它们写成当前锁定方向。
- WEB-P9 保留：P4 的一个全局主动作 + 安全并行，但只能由地图 frontier 派生；WEB-P5 的 Modal/Review 分级；WEB-P8 的真实/模拟 provenance；十秒读态和 768×1080 一等宿主约束。
- 领域审计确认：稳定的是 `StoryRoot + DiscoveryMap + DeliveryMap`、WorkTicket/RepoLane/Profile/Receipt/Gate 语义；动态的是节点、边、frontier、wave、owner 与阻塞。一张 WorkTicket 不沿 research→implementation→QA 原地变型，而是完成稳定 profile 后关闭，通过 `produces / verifies / accepts / requires-decision` 连接新节点。
- `Contract` 是 revision seam 与验证 subject；`QA/Review/Acceptance` 默认是动态 Gate/Evidence，满足独立调度判据时才成为 WorkTicket；`Integration` 是每条 RepoLane 的 terminal subject/Gate；没有固定 `Closeout stage`，StoryRoot reducer 独占最终终态。
- 只读事实分片：`1-interview/facts/web-v4-dual-map-domain-audit.md`、`web-v4-dual-map-sample-plan.md`、`web-v4-map-first-visual-patterns.md`。
- 新草稿：`2-prototype/drafts/v4-map-first-prototype.html`、`v4-map-first-rationale.md`。v3 已标记 superseded，只保留比较证据。
- v4 默认第一屏是一张上下贯通画布：上方动态 DiscoveryMap、中间 Contract revision seam、下方动态 DeliveryMap/RepoLane territory；StoryRoot 固定在 seam。Action/Evidence 是第二视图，Inspector 是节点选择后的 Now/Why/Owner/Next/Unlocks 投影。
- 真实模式：#147 StoryRoot + 12 真实 Discovery nodes + 12 native membership + 0 native blocker edge；DeliveryMap 为 `0 verified nodes / REPO NOT_CONNECTED`；#153 明确为 decision，#159 明确为 design contract；dossier 是 sidecar，不是 tracker member。
- SIM 模式：6 Discovery nodes、11 Delivery nodes、contract@1→requires-decision→contract@2、wave-1 stale history、wave-2 WEB/CORE required RepoLane、两条 frontier 与 Story reducer locked；所有 ID/Receipt/Gate/owner 为 `SIM-*`。
- Chrome 原生 pointer/keyboard/text-input 旅程已覆盖 node selection、作者演进线、Source Modal、dataset tabs、Frontier lens、Inspector、Review Actual/verdict/evidence/draft/return、Action 与 Evidence。固定阶段元素=0，requires-decision 回流边=1，低于 24px target=0，unnamed button=0，console/runtime error=0，reduced motion 生效。
- 768×1080 全图 100% 同屏；480×900 自动 Fit Story 到 57–61%；1440×1000 常驻 Inspector。三者页面均无横向溢出。
- 逐屏证据：`2-prototype/drafts/webp9-v4-product-audit.md`、`2-prototype/evidence/webp9-v4/`；`design-qa.md` final result=`passed`。真实 screen reader、200% zoom、high contrast、320px 与真实 active runtime 仍为 `NOT_RUN / NOT_CONNECTED`。
- 三层命名已通过 `session.mjs round` 以 `round:50 / q_id:WEB-P9-NAMING-SUPPLEMENT` 确认：产品名 `Story Atlas`，页面名 `Story Work Graph`（Story 全局工作图），工程定义 `Versioned Dual-track Story Workflow Graph`（版本化的探索—交付双轨工作图）。本裁决只锁定命名，不等于确认 Web artifact，也不回答 WEB-P10。
- 当前 Web artifact 与整个 2-prototype 仍未确认；不得执行 `2-prototype done`。

### WEB-P10 已答：Discovery / Delivery 两个一级 Tab

- `WEB-P10` 已通过 `session.mjs round` 以 `round:54 / q_id:WEB-P10` 记录为 `C_TWO_PRIMARY_TABS_EACH_OWN_GRAPH`，`web_artifact_confirmed=false`。
- 用户明确选择 Product Design 第三个方向的主要表达，但推翻同页上下堆叠：`Discovery` 与 `Delivery` 是两个一级 Tab，明确 Story 从设计到执行的两大阶段；每个 Tab 内有自己的完整 Graph、frontier、filter 与 selected context。
- 两个 Tab 不是固定六阶段 rail 的回归。它们是同一个 StoryRoot 下两个稳定领域图入口；共同 StoryRoot、Contract revision、requires-decision、stale evidence 与 new wave 必须提供跨 Tab 状态指示和一跳导航，维持全闭环而不是两个割裂工作流。
- **裁决场景**：wave-2 验收发现一个会改变公共状态语义的问题。操作者需要从 DeliveryMap finding 一跳跳到 DiscoveryMap decision ticket，看到新 contract revision，再返回新 Delivery wave，并能辨认哪些旧 Receipt stale。
- **支持上下双图同屏的最强论证**：它同时保留两个独立 frontier 和跨图因果链；768px 下每张图使用完整宽度，StoryRoot 与 Contract seam 成为稳定锚点。操作者不必在两张 tab 之间记忆 finding 从哪里回流、revision 又生成了哪一波 Delivery。
- **反对上下双图同屏的最强论证**：真实 Story 可能有数十甚至数百节点，两张完整子图长期同屏会迫使默认缩放过小，节点标题与 Gate 状态难读；统一连续图可让布局器自由利用空间，而每图独立全屏则能提供更高局部密度。若 loopback 很少，持续为它保留半屏可能得不偿失。
- **Crux**：在主视图中持续保留 Discovery↔Delivery 的全局因果链，是否比让单张地图获得最大可读面积更重要；LOD、frontier lens 与一跳聚焦能否控制大图密度。
- **可翻转变量**：典型 Story 的每图节点数与峰值；`requires-decision` 回流频率；用户是否经常同时比较两个 frontier；768×1080 下 60–100% zoom 的标题可读性；稳定增量布局是否可保证；List fallback 与一跳 focus 能否承担密集图的局部阅读；跨图边是否是审计和恢复的高频依据。
- 历史候选：
  - **A. 一张上下贯通画布，双图始终同屏 — 67%（推荐）**：采用当前 v4；DiscoveryMap、Contract seam、StoryRoot 与 DeliveryMap 同时存在，缩放/Frontier/阻塞/一跳 lens 处理密度。好处是全局因果链和两个 frontier 永不丢失；代价是超大 Story 必须依赖 LOD 与聚焦，默认节点文字可能缩小。
  - **B. 一张连续全局图，Discovery/Delivery 只作为 territory/lens — 20%**：不固定上下分区，让布局器按关系自由放置节点；颜色或 hull 标识归属。好处是空间利用更灵活、跨图边天然；代价是两张 Map 的独立 frontier、局部终态与 Contract revision 边界更难一眼区分。
  - **C. DiscoveryMap / DeliveryMap 各自全屏 tab，并保留跨图 mini-rail — 13%**：单图细节最清楚，另一图只显示 frontier 数与 loopback 指示。代价是当前 finding→decision→revision→new wave 需要切换才能验证，恢复与审计更依赖工作记忆。

### Web v5 构建历史检查点（WEB-P12 已由后续审计检查点取代）

- `WEB-P11` 已通过 `session.mjs round` 以 `round:55 / q_id:WEB-P11` 记录：用户确认双 Tab 修正版为 v5 视觉目标并授权构建；该确认只锁定视觉目标，`web_artifact_confirmed=false`。
- v5 草稿：`2-prototype/drafts/v5-story-work-graph.html`；选定视觉目标：`v5-dual-tab-selected-target.png`；理由：`v5-story-work-graph-rationale.md`。
- v5 默认 Delivery Graph；Discovery Graph / Delivery Graph 是两个一级 Tab，每个 Tab 有自己的完整 Graph、Map/List、search/filter、one-hop focus、selection 与 Now/Why/Owner/Next/Unlocks。共同 Story header 与 cross-Graph rail 保持 Contract / requires-decision 闭环。
- 数据修正：真实 Discovery 使用 root #147 + 12 membership + descendant subgraph 内 7 条 native dependency；root 0/0 只描述 root。作者 progression 是可关闭的 ISSUE COMMENT overlay。#153 明确 decision / NOT implementation，#159 明确 design contract / NOT delivery。
- Delivery runtime 没有真实来源，v5 全部使用 `SIM-*`，常显 `SIMULATED GAP / runtime NOT_CONNECTED`，并列 design basis。P12 后 Web 只做定位、筛选、查看、对比和导出，不执行 claim/dispatch/retry/close/Contract mutation。
- 视觉直接继承 `aes-workflow/skills/engineering/aes-using-workflow/console/template.html` 的 tokens、font stacks、Story header、Next action、Map/List、frontier、freshness 与 selected-context 语法；没有继承固定阶段 rail。
- Chrome CDP 原生 pointer/keyboard/text 旅程已覆盖两个 Tab、13-node Delivery、13-node Discovery、12 membership、7 dependency、Map/List、search、filter、author overlay、one-hop focus、跨图 return、source/evidence modal、Escape/focus、480/768/1440 与 reduced motion。固定阶段=0、unnamed button=0、target<24px=0、console/runtime error=0、document horizontal overflow=0。
- Product Design QA：`2-prototype/drafts/v5-design-qa.md`，`final result: passed`。逐屏证据：`2-prototype/evidence/webp11-v5/`。
- 残留：真实 screen reader、200% zoom、Windows high contrast、320px、真实 active Delivery runtime 与真实十秒理解计时仍为 `NOT_RUN / NOT_CONNECTED`。
- 当前 v5 Web artifact 尚未获得用户看图后的最终确认；不得复制为根目录 `mock.html`，不得执行 `2-prototype done`。

#### WEB-P12 历史准备问题（实际回答已追加为 round 56）

- **具体场景**：在 768×1080 Codex 右侧先打开 Delivery Graph，十秒内回答当前最长路径、owner、安全并行、被阻塞 Gate；再切 Discovery Graph，核对 12 个真实成员和 7 条 dependency；最后从 requires-decision rail 一跳回到裁决说明。现在要判断：两个独立 Tab 与共同 Story header/bridge 是否终于让“一个 Story 从设计到执行全闭环”既完整又可读。
- **支持 v5 的最强论证**：每张 Graph 获得完整阅读面积，真实/模拟不再混淆；Story Pulse、RepoLane、selected context 和 Evidence 恢复 v3 的操作优势；Map/List/search/focus 又继承 AES Console 的成熟语法。
- **反对 v5 的最强论证**：分 Tab 仍会隐藏跨图因果链，完整 13-node Graph 需要垂直滚动；Delivery 仍是模拟，无法证明真实 active Story 的理解效率。若 cross-Graph rail 不足，用户可能把设计图和执行图当成两个系统。
- **Crux**：用户能否在不记忆另一 Tab 细节的情况下，从任一 Tab 看懂当前 Story 的全局位置、另一图状态和一跳闭环；新增滚动是否换来了真正可读的节点而不是新的迷路成本。
- **可翻转变量**：十秒内能否说出 Now/Why/Owner/Next；12+7 Discovery 是否无需说明即可读懂；Delivery SIM 标签是否足够防误解；requires-decision 跨 Tab 跳转是否恢复来源与返回位置；真实 Story 峰值节点数；Map/List/一跳聚焦是否承担密集图阅读；首屏需不需要完整显示整张 Graph。
- 候选：
  - **A. 确认 v5 Web 方向 — 62%（推荐）**：锁定双 Tab、共同 Story header、bridge、AES Console 操作语法与真实/模拟边界；后续只修字段和小交互，不再改主信息架构。好处是可以进入确认版；代价是跨图比较仍需一次切换。
  - **B. 保留双 Tab，但继续重做首屏密度或 bridge — 33%**：领域结构已对，但十秒读态或跨图闭环仍不够；继续改 Graph viewport、summary、mini-map 或 return context。好处是修局部，不推翻双图；代价是原型阶段继续延长。
  - **C. 双 Tab 方向仍不成立 — 5%**：回到统一图或全新结构。好处是重新追求全局同屏；代价是重新引入 v4 的密度与可读性风险。

## Prototype Role / Skill 调用链检查点（2026-08-30，P6 已答）

- 并行 Web 原型 session 已经使用 `P3`、`P4`，因此本线程原口头称作 P3 的 Role/Carrier 问题在持久记录中顺延为 `round: 40`、`q_id: P5`；不得再按 P3 追加或重问。
- P5 已通过 `session.mjs round` 记录为 A：采用 Role-first、Carrier 按 Profile/风险晚绑定。Workflow 对外派发 RoleAssignment；Agent Carrier 在 Role 授权内调用 Skill；Core 校验 Receipt 并投影 Gate。
- 用户确认的直观规则：小而低风险的任务可以由执行会话完成实现后，另派 fresh subagent 原地做 QA；改动广、高风险、长时或要求更强隔离/恢复时，派独立 Desktop Task/专职 Agent 承担 QA。
- “小/大”不是只按改动行数判断。Router 至少考虑 blast radius、风险等级、跨仓/跨票范围、所需测试强度、执行时长、actor separation、live/manual 环境与中断恢复要求；任何不满足 Profile 下限的 Carrier 都必须 fail-closed 或升档。
- 不变边界：实现者不得以同一 actor 身份签发要求独立性的最终 QaReceipt；不同 Carrier 必须提交同 schema、subject、policy 与 provenance 约束的证据，并接受同一 Gate 规则。低风险可以降低执行载体成本，不能降低验收下限。
- P6 已通过 `session.mjs round` 记录为接受：Router 对 unknown 采用三分法。Contract/scope 语义未知进入 `requires-decision` 并回流 Discovery；Capability 未证明按不具备处理，无合格 Carrier 时显式阻塞/degraded；只有 Contract 明确、风险上界未知时才取可信上界单调增加 requirements，并选择满足全部硬要求的最小充分 Carrier。
- 多个 Carrier 都满足且只在成本/速度上有差异时，由版本化 deterministic tie-break 自动选择；若更昂贵 Carrier 超出已授权预算则等待资源授权，不能降级验收或递归创建 Task。
- 并行 Web 线程在 P6 写入前追加了 `WEB-P5 round:41` 与 `WEB-P6 round:42`；Role 线程的 P6 位于物理第 46 行，保留原始 `round:41 / q_id:P6`。恢复时以独立 `q_id` 和物理追加顺序识别，不直接改写 `rounds.jsonl`。
- `2-prototype/drafts/v3-role-skill-carrier-model.md` 与 `v3-role-runtime-diagram.html` 仍是草稿；P5/P6 只锁定调度与 unknown 分流原则，整套 Skill 调用链和 prototype 尚未最终确认。

## Prototype 双宿主 Workflow Module 检查点（2026-08-30，P8 已答）

- P7 已通过 `session.mjs round` 以 `round:44 / q_id:P7` 记录：AesAgent 是最终产品集成目标；同时必须保留轻量 `Skill+Web` 作为高频孵化形态。成熟 Workflow 应晋级为 AesAgent Extension，不应要求重新解释核心业务语义。
- 三份只读候选已落盘：`1-interview/facts/generic-web-agent-module-audit.md`、`aesagent-workflow-surface-seams.md`、`dual-host-workflow-surface-options.md`。它们是架构证据，不自动构成用户裁决。
- 当前事实：AesAgent 已有版本化 Workflow Plugin、typed interaction、revision/idempotency、事件恢复、Artifact 与 Viewer 基础；现有 `workflow-interview-web` 已验证 durable submission、分层 continuation receipt、manual fallback 与有界恢复，但仍耦合 interview DSL，且多 writer 事务正确性尚未证明。
- P8 已通过 `session.mjs round` 以 `round:47 / q_id:P8 / choice:true` 记录：每个 Workflow 的共享 `Workflow Module` 是核心业务规则的唯一实现；`Skill+Web` 与 `AesAgent Extension` 都调用同一规则，宿主差异只留在 Adapter。
- P9 已通过 `session.mjs round` 以 `round:48 / q_id:P9 / choice:true` 记录：第一版采用“共用 Web Shell + Workflow 页面说明书”。Shell 统一承担提交、恢复、历史、权限、通用布局与可访问性；每个 Workflow 输出版本化 declarative `SurfaceDocument`，声明自己的 Graph、状态、表单与允许动作。第一版不允许 Workflow 随意注入 React/JavaScript；缺少组件时应使用可协商的安全扩展块与 fail-closed fallback，而不是在两个宿主各写一份页面行为。
- 对 `workflow-story-map` 的直接含义：StoryRoot、RepoLane、Role/Carrier Router、Receipt/Gate 与相关确定性投影只能有一份核心规则；SkillDevHost 与 AesAgentHost 可分别拥有文件/SQLite、loopback/RPC、当前会话/Provider 等宿主能力，但不得各自重写这些规则。
- `Skill` 继续作为开发期 Agent 入口与过程指导；Web 继续作为交互和投影载体。共享规则不等于删除 Skill，也不等于第一版新增独立产品服务。
- “成熟后不重写”必须由相同 Workflow Module digest、双 Adapter canonical trace 等价、promotion diff 无业务 reducer/schema/validator/view 重写，以及两个宿主的真实 `publish → submit → persisted → continuation → consumed` 闭环共同证明。证据不全时只能称为可移植候选。
- 尚未确认整套 logic prototype；不得执行 `2-prototype done`。并行 Web session 的真实 Issue 数据、真实浏览器旅程、可视化设计与 artifact 确认状态仍由其独立检查点管理，本条不替它收口。

## Prototype 独立 Skill+Web Runtime 检查点（2026-08-30，P10 已推翻 AesAgent 主线）

- P10 已通过 `session.mjs round` 以 `round:51 / q_id:P10 / user_choice:INDEPENDENT_SKILL_WEB_FULL_LOOP_FIRST` 记录。用户明确拒绝“独立模式只做人机持久化、完整自动调度依赖 AesAgent”的推荐。
- 当前 v1 主线改为：`Skill + Web + 独立本地 Runtime` 自己形成完整闭环，运行时不得依赖 AesAgent。AesAgent Extension、AesAgentHostAdapter、双 Host conformance、`.plugin.tgz` promotion 与 PromotionReceipt 全部移出当前目标和验收范围；未来是否重新接入另行设计，不得继续当作当前前提。
- P10 推翻 P7 的 AesAgent-first / 当前双 Host 主线，并移除 P8 中“双 Adapter 等价”作为 v1 要求；但保留 P8 的“核心业务规则只实现一次”、P9 的“共用 Web Shell + Workflow 页面说明书”，以及 P5/P6 的 Role-first、Carrier 晚绑定和 unknown 三分流。
- `2-prototype/drafts/v4-shared-workflow-module-model.md`、`v4-shared-workflow-module-diagram.html`、`v4-surface-protocol.md`、`v4-dual-host-example-run.md` 是被 P10 推翻的 AesAgent 双 Host 历史候选，不能复制为确认版根文件，也不能进入 Goal Contract；下一版必须重画独立 Runtime。
- P10 当时提出的“独立 Runtime 必须拥有 Agent Runtime Adapter”随后已被 P11 明确推翻；这里只保留为历史转折，不得继续作为当前硬前提。
- Agent Runtime Adapter、Codex CLI、Provider API 与自动 continuation 的选择不再属于当前 v1 待裁决项；若未来需要，应进入 AesAgent 的独立后续范围。
- 整套 logic prototype 必须重做并重新确认；不得执行 `2-prototype done`，不得进入 `3-contract`。

### P11 修正：Local Runtime 只做单向信息同步，不调动 Agent

- P11 已通过 `session.mjs round` 以 `round:52 / q_id:P11 / user_choice:PROJECTION_SYNC_ONLY_NO_AGENT_LIFECYCLE` 记录。用户明确否决 Local Runtime 的 AgentRuntimeAdapter、Codex CLI start/resume 与自动 continuation 候选。
- P11 覆盖 P10 中“独立 Runtime 必须形成 Agent 完整闭环”的解释：当前独立闭环只指 Skill 产生/维护事实、Runtime 单向同步、Web 展示/交互载体在该信息方向内闭合；不包含 Agent/Provider/Task 的 start/resume/stop、session、lease、sandbox 或 execution authority。
- 当前 Local Runtime 的职责收缩为：读取或接收持久事实、校验 revision/digest、构建可重建投影、向 Web 推送更新、提供有界 history/export/freshness/provenance；它不是 Carrier，不是 Agent Host，不保活模型 turn。
- 若未来需要由 Web 或 Workflow 自动调动 Agent，该能力应直接进入 AesAgent 的正式 Host 范围，作为独立后续目标；不得在当前 Skill Runtime 中以 CodexExecAdapter 或类似方式重造。
- P11 保留 P10 的“AesAgent 不属于当前 v1 Runtime 依赖”、P8 的单一业务规则、P9 的共用 Web Shell/页面说明书，以及 P5/P6 的领域调度规则；但当前 Web 投影不得把未实际运行的 Agent/Carrier 状态伪装成 live。
- “单向同步”的方向已由 P12 锁定，不再是待定前提；见下节。

### P12 锁定：Workflow/Skill → 持久事实 → Local Runtime → Web

- P12 已通过 `session.mjs round` 以 `round:53 / q_id:P12 / user_choice:true` 记录。用户确认当前 v1 的唯一信息方向是 `Workflow/Skill → 持久事实 → Local Runtime → Web`。
- 权威边界：Workflow/Skill 负责产生或维护 Story 的持久领域事实；Local Runtime 只读取、校验、推导并广播可丢弃、可重建的 normalized projection；Web 是可信的观察、解释、比较与导出界面，不是 Story 命令入口。
- Web 当前允许的交互：缩放、平移、筛选、搜索、选择节点、切换 lens、查看历史/diff/证据、导出，以及只保存在浏览器本地的书签或视图偏好。这些不得进入 Story 领域真源。
- Web 当前禁止的领域命令：claim、dispatch、retry、close、修改 Contract、放行 Gate、提交 decision、写入 Receipt、触发 Agent 或任何会改变 Story 的操作；当前 v1 不设计 `Web → durable inbox`。
- Local Runtime 可承担的只读/派生能力：schema 与兼容性校验、fail-closed degraded、revision/digest/provenance/freshness、确定性 blocker 与 why-not-done 推导、history、revision diff、安全 artifact 读取、health、自包含 export，以及 Runtime→Web 的 WebSocket/SSE 更新通知。
- P12 不确认 Web artifact，也不回答并行 Web 线程的 WEB-P10；`2-prototype` 仍未完成。下一版 logic prototype 必须按 Projection Runtime 重画，并继续接受用户逐处质疑。

## 历史接续检查点：P13=A 已落盘，业务对照物整体确认见下方 P14

- `WEB-P12 / round:56`：用户要求先核对 v5 与业务的对齐，暂缓确认。结果见 `1-interview/facts/web-v5-business-alignment-audit.md` 与 `2-prototype/drafts/webp12-business-alignment-audit.md`；审计不是用户裁决。
- `WEB-P13 / round:57 / choice:A`：用户选择先形成并确认业务逻辑对照物，再构建 v6 Web；不得跳过整体确认。
- 已有五份候选：`v6-business-behavior.md`、`v6-business-api-mock.md`、`v6-business-example-run.md`、`v6-business-diagram.html`、`v6-business-diagram-detail.html`，均位于 `2-prototype/drafts/`，没有提升为确认版。
- `P13 / round:58 / choice:A` 已通过 `session.mjs round` 追加：只有 required RepoLane 参与 Story done 合成；optional Lane 可以保持 blocked/deferred，但 optional_debt 必须常显 owner、原因、影响与恢复入口。required/optional 在 Contract 中冻结，运行期变更必须回 Discovery。
- P13 不改写 optional Gate 或 ticket 状态，不自动生成 Waiver；required integration SHA/full-suite/Human 门禁仍必须满足。required 范围存在有效授权 Waiver 时继续使用 `done-with-waiver`。optional 依赖若阻塞 required Gate，Story 仍不能 done。
- 原 `OPEN-1` 已解决；本回答只确认此终态边界，`business_artifacts_confirmed=false`、`web_artifact_confirmed=false`。下一动作是核对更新后的整套业务对照物并取得明确确认，不重问 P13。
- 保持 manifest `stage=2-prototype`、阶段 pending、总体 in_progress；不得运行 `stage done`、进入 `3-contract`、执行 finalize 或实现 workflow-story-map。
- P13 同步后顺带纠正两处对照物不一致：流程图中 Contract 不变的 finding 回到下一 wave WorkTicket，不能直接进入 integration；current dossier 使用 revisits 指向历史版本、supersedes=null，不能冒充已发布新版 Contract。这是恢复既定 Q32/确认门禁，不是新增用户裁决。
- 当前五份业务候选的内容摘要：`sha256:91a444cfc3099dc56c72e8e076aa98f527e47751d31af91e9c099be6a870fdb7`；逐文件 SHA-256 与本轮检查见 `2-prototype/evidence/webp13-business-logic/validation-p13.json`。13 个 JSON 块可解析，P13 样例不改写 optional Gate；两张 HTML 已重新渲染，旧 validation-results.json 只作为历史证据。
- **P14 待答（未写入 rounds）**：是否确认这五份业务逻辑对照物作为 v6 Web 的依据？确认仅绑定上述五文件内容，不确认尚未构建的 v6 Web，不批准进入 Contract 或实现目标。支持确认：已把散落裁决同步成一套可追溯基线，避免页面另猜规则；反对确认：静态示例与渲染不证明真实业务执行，错误的依赖/债务/回流表达会被后续页面继承。Crux：剩余问题是运行验证缺口，还是仍有业务语义不一致。可翻转变量：真实/模拟是否清楚分开；required 与 optional debt 是否符合预期；回流与 subject/Gate 关系是否完整可理解。只询问整体确认，不重问 P13。

## 当前接续检查点：P14 已确认，构建 v6 Web 草稿

- 用户回复「好的请继续」，已通过 session.mjs round 以 round:59 / q_id:P14 / user_choice:true 落盘。五份候选在记录前均验证 SHA-256 与 validation-p13.json 一致。
- 确认业务 bundle：sha256:91a444cfc3099dc56c72e8e076aa98f527e47751d31af91e9c099be6a870fdb7；已提升为 2-prototype 根下 behavior.md、api-mock.md、example-run.md、diagram.html、diagram-detail.html。只调整确认元数据及内部文件引用；原始候选不改。
- business_artifacts_confirmed=true；web_artifact_confirmed=false。下一步据此构建 v6-story-work-graph.html，保持双 Tab、Map-first、AES Console 风格与 P12 只读边界；当前 Web 待确认，不得 stage done 或进入 3-contract。
- 不重新询问 P13/P14，不运行 init，不实现 workflow-story-map。
- v6 草稿已生成：2-prototype/drafts/v6-story-work-graph.html；真实 current/historical/Delivery空态与六个SIM快照隔离。53项有限静态/样本检查通过，见 evidence/webp14-v6/check-v6.mjs。
- 尚未完成真实浏览器检查：内置 Browser bootstrap 报 Importing module "node:process" is not allowed in node_repl。已向用户询问是否允许独立 Playwright 测试浏览器，尚无答案；此许可询问不是Web产物确认。不得直接运行Playwright或把等待许可写成已批准。
- 2-prototype/design-qa.md = blocked；open_in_codex 只返回 queued，不代表已看到实际渲染。没有 v6 截图/点击/console 通过证据。
- 下一步：收到浏览器测试许可后，记录答复，再跑768×1080核心旅程、源图对照与必要修复；完成后才提出Web独立确认问题。原始P14不重问，不提前stage done。
