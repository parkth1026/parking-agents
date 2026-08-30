# Fact: workflow-story-map skill 组合与完整调用链

- 派遣问题：新版 `workflow-story-map` 要完整实现 Q1～Q35 已定语义，仓库现有/参考 skill 中哪些应作为用户入口 workflow、阶段 workflow、原子能力、adapter/执行器；完整调用链、各节点 charter / 输入输出 / 禁区是什么；旧 spec 与新裁决还差什么。
- 完成：2026-08-30T16:34:00+08:00
- 调查性质：只读事实调查。下面凡是“仓库已经写明”的结论标为 **Evidence**；为了补齐新版调用链而提出的分层标为 **Inference**；仓库尚未裁定的标为 **Unknown**。

## 一句话结论

**Evidence + Inference：** 旧 spec 已经选对了“薄的 `workflow-story-map` 总控 + 复用深 skill”的大方向，但它只有粗粒度的 `interview 家族 → 匿名拆票功能位 → board → 收口`。Q1～Q35 之后，完整链至少要明确为四层：

1. **一个用户入口 workflow**：`workflow-story-map`；
2. **三个阶段 workflow**：Discovery（复用 `workflow-interview`）、Delivery ticket owner（复用 `aes-issue-worker`）、Integration/merge（需要独立 `aes-merge-worker`，当前尚未成 skill）；
3. **一组原子能力**：访谈、事实研究、原型、契约、拆票/风险验证规划、TDD/调试、QA、review、simplify、change classification；
4. **三类 adapter**：GitHub/GitLab tracker adapter、board/manual/其他 ExecutionAdapter、Web projection/command adapter。

`ProfileRegistry loader`、`Receipt validator`、`Gate projector`、`membership reconciler`、`Story/RepoLane reducer`、`Router` 应优先是**确定性 core 模块/脚本，不是长 prompt skill**；否则会把 Q24/Q25/Q35 的确定性与 fail-closed 语义重新交给模型自由发挥。

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| 新能力已裁决为独立、薄的组合层 Skill；Core 只通过 typed `ExecutionAdapter` 交换请求与 attempt 事件，不直接拥有 board/worktree/agent 生命周期。 | `1-interview/context.md:17-24,108`；`1-interview/rounds.jsonl` 的 Q8、Q20 |
| Story 不再是旧的单向静态五阶段，而是稳定 `StoryRoot` 下的 `DiscoveryMap` / `DeliveryMap` 双子图；Contract 不变进入下一 Delivery wave，改变承诺或无法分类回 Discovery。 | `1-interview/context.md:17-27,110-111`；Q23、Q32 |
| `workflow-interview` 本身就是不产业务文件的三阶段编排器，依次调用 `aes-interview`、`aes-prototype`、`aes-goal-contract`，且明确“不实现任务目标”。 | `skills/workflow/workflow-interview/SKILL.md:6-20,24-55,116` |
| 三个 interview 子 skill 都有单一、可界定产物：需求上下文与轮次、确认版对照物、Goal Contract 与 finalize 证据。 | `skills/workflow/aes-interview/SKILL.md:3-12,88-208`；`skills/workflow/aes-prototype/SKILL.md:3-18,26-61,171-215`；`skills/workflow/aes-goal-contract/SKILL.md:3-20,26-51,146-201,203-254` |
| `aes-issue-worker` 已是 implementation ticket 的阶段组合器：`tdd/diagnosing-bugs ⇄ aes-qa → simplify → candidate → aes-qa final`；它明确不 merge、不写 GitHub、不自行挑票。 | `skills/workflow/aes-issue-worker/SKILL.md:2-25,27-47,136-185` |
| `aes-qa` 是有边界的验证能力：循环轮出 findings，最终轮出绑定 SHA 的 typed `QaReceipt`；`NOT_RUN` 不得变成 PASS，人工项必须进入 checklist 且 Agent 不得代答。 | `skills/workflow/aes-qa/SKILL.md:2-25,27-54,56-105` |
| `aes-worktree-board` 是一个完整执行控制 workflow，不是纯 adapter：它管理 Desktop Task、runner/job/attempt、registry、review/merge/full regression 与恢复；当前 live tracker 身份和读写链明确是 GitHub。 | `skills/workflow/aes-worktree-board/SKILL.md:2-10,19-47,49-67,359-419,453-503` |
| `aes-merge-worker` 只在 `aes-worktree-board` 文档中定义了 lane 职责；`aes-issue-worker` 也称其“待建”。仓库里没有独立 `aes-merge-worker/SKILL.md`。 | `skills/workflow/aes-issue-worker/SKILL.md:8-16`；`skills/workflow/aes-worktree-board/SKILL.md:453-480`；`rg --files skills` 无匹配文件 |
| `wayfinder` 是 planning-only 的完整用户 workflow，拥有自己的 map/ticket/claim/close 生命周期；`to-spec` 与 `to-tickets` 也会直接发布 tracker 内容。它们不是可安全嵌套的无副作用原子函数。 | `skills/matt-skills/engineering/wayfinder/SKILL.md:1-15,19-60,103-126`；`skills/matt-skills/engineering/to-spec/SKILL.md:1-13,71-73`；`skills/matt-skills/engineering/to-tickets/SKILL.md:1-15,25-66` |
| 旧 spec 因此只把 `to-spec/to-tickets` 当“功能位”融合，没有直接调用它们；同时规定 `wayfinder` 只是并存分工。 | `docs/design/workflow-story-map/spec.md:18-25,44-47,200-213` |
| `workflow-interview-web` 明确只是 interview 家族的投影/双向入口，不是第二套访谈逻辑；阶段推进仍只走家族脚本，浏览器不能直接写过程真源。 | `skills/workflow/workflow-interview-web/SKILL.md:3,7-31,47-56` |
| `gh` 与 `aes-glab` 是 CLI 使用/认证范式，不是实现共同领域协议的 typed tracker adapter；当前仓 `docs/agents/issue-tracker.md` 只定义 GitHub。 | `skills/pub/gh/SKILL.md:1-9,20-69,146-197`；`skills/pub/aes-glab/SKILL.md:1-8,18-30,60-82`；`docs/agents/issue-tracker.md:1-5,28-42` |
| Q24/Q25/Q29/Q34/Q35 已要求 repo 版本化 ProfileRegistry、Core 从 typed receipts 确定性推 Gate、subject 变化即 stale、Human Receipt 分权和 Registry 缺失 fail-closed。现有任一单 skill 都没有覆盖这一整组 core 语义。 | `1-interview/context.md:17-30,112-125`；`2-prototype/drafts/v1-behavior.md:23-29,35-42,61-64` |

## 分层判据（Inference）

这里用“谁拥有状态推进”而不是“skill 内文字多少”分类：

| 类别 | 判据 | 允许做什么 | 不允许做什么 |
| --- | --- | --- | --- |
| **用户入口 workflow** | 接受用户意图或 StoryRoot 身份，恢复全局状态，决定进入哪个阶段/子图 | 路由、门禁、恢复、汇总、调用下层 | 复制深 skill 方法论；亲自写实现；凭模型判断直接改 Gate |
| **阶段 workflow** | 拥有一个可恢复的阶段闭环，内部调用多个原子能力 | 管阶段 attempt、预算、回退与终局 | 越权拥有 StoryRoot 全局 done 或其他阶段的状态 |
| **原子能力 skill** | 一个输入、一个局部产物/receipt、一个停止条件 | 研究、访谈、原型、实现方法、QA、review、分类 | 调度全 Story；直接写 tracker lifecycle；直接写 Gate verdict |
| **adapter / executor** | 把 typed port 翻译到外部 tracker、board、人工或其他载体 | 发送命令，回传 ack / event / receipt | 发明领域状态；绕过 Core；把 transport 成功当 Gate PASS |
| **deterministic core** | 同输入必须得同输出，承载不可由 prompt 漂移的规则 | schema 校验、digest、reducer、reconcile、授权、Gate 投影 | 访谈、产品取舍、实现代码 |

## 新版完整调用链（Inference，符合 Q1～Q35 的最小闭环）

```text
Human / Web
  |
  v
[W0] workflow-story-map                         用户入口 workflow（新建）
  |
  +--> [C0] Recover + Reconcile Core            确定性 core（新建）
  |      +--> TrackerPort --> GitHubAdapter      adapter（新建；gh 只作底层参考）
  |      |                --> GitLabAdapter      adapter（新建；aes-glab 只作底层参考）
  |      +--> RepoEvidenceStore per RepoLane     repo/Git 证据读取器
  |      +--> ProfileRegistryLoader              digest 精确加载，失败即 degraded
  |      +--> MembershipReconciler               root 枚举 vs child back-reference
  |      +--> ReceiptValidator -> GateProjector  只由 profile + receipts 推导
  |      `--> StoryProjector                     lifecycle/control/gate + Web read model
  |
  +--> [W1] Discovery Coordinator               阶段 workflow
  |      |
  |      +--> workflow-interview                现有阶段 workflow
  |      |      +--> aes-interview              原子：事实 + 用户裁决
  |      |      +--> aes-prototype              原子：七面扫描 + 确认版对照物
  |      |      `--> aes-goal-contract          原子：Goal Contract + finalize
  |      |
  |      +--> profile=research   --> research / best-practice-research 等原子能力
  |      +--> profile=decision   --> grilling + domain-modeling 原子能力
  |      +--> profile=prototype  --> prototype（技术试验）或 aes-prototype（确认对照物）
  |      |
  |      +--> [A1] TicketSlicer                 原子 planner（新建）
  |      +--> [A2] RiskVerificationPlanner      原子 planner（新建）
  |      |        输出 risk 下限、测试强度、SamplePack 要求、Gate/role DAG
  |      `--> TrackerCommandPort                唯一持久写入口；创建 produces/requires 边
  |
  +--> [W2] Delivery Coordinator                阶段 workflow（可由 W0 内部实现）
  |      |
  |      +--> [C1] Capability Router            确定性选择器（新建）
  |      |      |
  |      |      +--> BoardExecutionAdapter      adapter（新建）
  |      |      |      `--> aes-worktree-board  现有执行控制 workflow
  |      |      |             +--> aes-issue-worker       ticket owner workflow
  |      |      |             |      +--> tdd | diagnosing-bugs
  |      |      |             |      +--> aes-qa (loop/final receipt)
  |      |      |             |      `--> simplify
  |      |      |             `--> aes-merge-worker       integration workflow（缺失）
  |      |      |                    +--> code-review
  |      |      |                    `--> merge + exact-integration full suite receipt
  |      |      |
  |      |      +--> ExternalManualAdapter     adapter（新建）
  |      |      |      `--> human / external runner，回 HumanTest/Acceptance/Waiver receipt
  |      |      `--> OtherExecutionAdapter     扩展 adapter；同一 typed port
  |      |
  |      +--> ReceiptPort --> ReceiptValidator --> GateProjector
  |      `--> [A3] ChangeClassifier             原子（新建）
  |               +--> contract unchanged --> next Delivery wave
  |               `--> requires-decision  --> Discovery Coordinator
  |
  +--> [C2] RepoLane Integration Reducer        每条 required lane 精确 SHA + full suite
  `--> [C3] Story Reducer                       required lanes 合成 done/done-with-waiver

[P0] workflow-story-map-web                     投影/命令 adapter（新建）
  +--> 只读 StoryProjector：全局 map + ticket journey + gates/attempts/receipts
  +--> 白名单 CommandPort：answer/acceptance；claim/release/pause；retry/cancel/withdraw
  `--> Human Receipt Port：actor/policy/subject/revision/quorum/revocation
```

### 链中不应直接嵌套的现有 workflow

| skill | 正确位置 | 为什么不直接嵌套进热路径 |
| --- | --- | --- |
| `wayfinder` | 与 `workflow-story-map` 并存的 planning-only 用户入口；可复用术语与 frontier/fog 设计 | 它拥有另一套 map/ticket claim/close 生命周期且默认止于“路线清楚”，直接嵌套会形成两个总控与两个 tracker 写入者。 |
| `to-spec` | ad-hoc 用户 workflow；其 spec 写法可作为 `TicketSlicer`/contract planner 的参考 | 它会直接发布 tracker、打 `ready-for-agent`，与新版 ProfileRegistry 绑定和单一 CommandPort 冲突。 |
| `to-tickets` | ad-hoc 用户 workflow；其 tracer-bullet、单上下文、blocking 规则应抽成 `TicketSlicer` 的无副作用算法 | 它会询问并直接建票；新版需要先产生 typed proposal，经 profile/risk/gate 规划与 Core 校验后再由 tracker adapter 持久化。 |
| `aes-worktree-board` | `BoardExecutionAdapter` 后面的执行器 workflow | 当前 board 是 GitHub/worktree/merge 控制面，不是 tracker-neutral Story Core；不能让它拥有 StoryRoot、DiscoveryMap、跨 RepoLane done 或 Gate projector。 |
| `workflow-interview-web` | Discovery 问答协议与 UI 交互模式的参考/复用库 | 它只投影一个 interview issue 目录；不能直接升级为 Story Web 总控并绕过 Story CommandPort。 |

## 节点 charter、输入、输出与禁区

### Workflow 层

| 节点 | 现状 / 路径 | 输入 | 输出 | 不得承担 |
| --- | --- | --- | --- | --- |
| `workflow-story-map` | **缺失，新建**；旧设计 charter 见 `docs/design/workflow-story-map/spec.md:16-25` | 用户新 Story 请求或现有 StoryRoot；各 RepoLane tracker/repo identity | 下一合法动作、阶段 dispatch、全局可恢复投影、最终 Story terminal | 复制子 skill prompt；实现产品；直接生成 Gate PASS；拥有 board/worktree 生命周期 |
| `workflow-interview` | 现有 `skills/workflow/workflow-interview/SKILL.md` | story / decision ticket 的需求材料与 issue 目录 | `context + rounds + confirmed prototype + contract + dossier` | 实现目标；跨 Story 调度；写 execution receipts |
| `aes-issue-worker` | 现有 `skills/workflow/aes-issue-worker/SKILL.md` | typed `IssueWorkOrder`、exact worktree/base、AC、预算 | `READY_TO_MERGE` 或 typed blocked/human/conflict terminal | merge、tracker 写入、自主挑票、放宽 AC、代答人工 |
| `aes-worktree-board` | 现有 `skills/workflow/aes-worktree-board/SKILL.md` | board adapter 转换的 dispatch/control、runner/worktree 与 GitHub 配置 | attempt/job/control events、candidate/QA/review/integration evidence | 充当跨 tracker Story Core；解释 ProfileRegistry；直接决定 Story done |
| `aes-merge-worker` | **缺失**；仅 charter 文本存在 | mergeQueue job、candidate/base、review/QA receipts、integration target、full-suite catalog | review receipt、merge/integration receipt、final full-suite receipt 或打回 | 被审 worker 自审；复用 stale receipt；并行写 integration；拥有 Story done |

### 原子能力层

| 节点 | 现有路径 / 状态 | 输入 | 输出 | 不得承担 |
| --- | --- | --- | --- | --- |
| `aes-interview` | `skills/workflow/aes-interview/SKILL.md` | 用户目标、repo 事实、未决项 | context/rounds 与明确决定边界 | 替用户选；判实现；写 Gate |
| `aes-prototype` | `skills/workflow/aes-prototype/SKILL.md` | 已收口需求 | 七面扫描、确认版 mock/behavior/api/example/diagram | 实现产品；把新歧义就地糊掉 |
| `aes-goal-contract` | `skills/workflow/aes-goal-contract/SKILL.md` | context + confirmed prototypes | 自包含 Contract、Verify、finalize 结果 | 执行实现；把 UNRUNNABLE 降级；替用户确认非自动项 |
| `research` / `best-practice-research` | 现有 research skill 家族 | 一个明确事实问题 | 带 provenance 的事实 artifact/receipt | 产品裁决；tracker lifecycle |
| `grilling` + `domain-modeling` | `skills/matt-skills/productivity/grilling`、`skills/matt-skills/engineering/domain-modeling` | 一个决策问题、术语/场景 | 用户决定与术语更新 | 自问自答；实现 |
| `prototype` | `skills/matt-skills/engineering/prototype` | 一个技术/状态模型问题 | throwaway prototype artifact | 生产实现；Story 对照物真源（除非明确走 aes-prototype） |
| `TicketSlicer` | **缺失**；可抽取 `to-tickets` 规则 | contract examples、RepoLane、上下文预算 | 无副作用 WorkTicket proposals + edges | 直接建票、打 ready、选择 executor |
| `RiskVerificationPlanner` | **缺失** | diff/影响面先验、ProfileRegistry、GateCatalog、SamplePack 可用性 | risk floor、test intensity、角色 DAG、receipt requirements | 执行测试；降低规划下限；写 Gate verdict |
| `tdd` / `diagnosing-bugs` | 现有 Matt skills | WorkTicket AC、worktree、反馈循环 | 实现 diff + 测试/根因证据 | claim/merge/Story 收口 |
| `aes-qa` | `skills/workflow/aes-qa/SKILL.md` | AC、candidate subject、命令、环境/SamplePack | findings 或 typed QaReceipt / human checklist | 把 NOT_RUN 变 PASS；代答人工；直接写 Gate |
| `code-review` | `skills/matt-skills/engineering/code-review/SKILL.md` | fixed point、spec、standards | standards/spec 双轴 findings 或 review receipt 包装输入 | 修改被审代码；merge；直接写 Gate |
| `simplify` | `skills/pub/simplify/SKILL.md` | 明确 diff/file scope | 窄范围清理后的 diff | 扩 scope；收口；review 自证 |
| `aes-gate` | `skills/workflow/aes-gate/SKILL.md` | repo gate inventory / explicit gate-building request | GateCatalog 候选、实跑红绿、缺口 | 在 QA 热路径自动建门；二值宣称仓库完整；给 Story Gate 写 PASS |
| `ChangeClassifier` | **缺失** | 发现项 + 当前 contract/profile/integration target | `in-current-scope` / `next-wave` / `requires-decision` | 修改 contract；自行裁决无法分类项 |

### Adapter 与 deterministic core

| 节点 | 现状 | 输入 → 输出 | 不得承担 |
| --- | --- | --- | --- |
| GitHub tracker adapter | **缺失**；`gh` 是调用规范，不是 adapter | typed query/command → canonical snapshot/ack | 把 GitHub 特性变协议必需；断连本地先提交 |
| GitLab tracker adapter | **缺失**；`aes-glab` 是调用规范，不是 adapter | 同一领域命令 → GitLab 等价 snapshot/ack | 静默退为文本解析成功；改变共同语义 |
| `BoardExecutionAdapter` | **缺失** | `DispatchRequest/ControlRequest` ↔ board work order/events/receipts | 暴露 board 私有状态为公共模型；替 Core 投 Gate |
| `ExternalManualAdapter` | **缺失** | dispatch/checklist/control ↔ external/human receipt | 超时代答；拿 tracker 写权限冒充授权 |
| `workflow-story-map-web` | **缺失** | Story read model + whitelist commands ↔ ack/human receipts | 直接改 tracker/repo/rounds；自行推导状态 |
| ProfileRegistry loader | **缺失** | repo + `(id, version, digest)` → exact profile / degraded | 用同名最新版；用 ticket snapshot 顶替 repo 真源 |
| Receipt validator / Gate projector | **缺失** | profile policy + immutable receipts → pending/passed/failed/needs-human/stale | 接受 adapter 直接 verdict；跨 subject 结转 |
| Membership reconciler | **缺失** | root member list + child backrefs → consistent/degraded | 静默补写；在不一致时允许 close/done |
| Capability Router | **缺失** | DAG role requirements + carrier capabilities → selected adapter + reason | 按“subagent/Task”名字猜保证；执行工作 |
| RepoLane/Story reducer | **缺失** | required/optional lanes + integration gates → Story terminal | 运行期把 required 改 optional；把 NOT_RUN/BLOCKED 当 PASS |

## 旧 spec 与 Q1～Q35 的差距

| 优先级 | 旧设计 | 新裁决要求 | 结论 |
| --- | --- | --- | --- |
| P0 | 五阶段单向链，一次拆票后等待清空。`spec.md:29-47` | Discovery/Delivery 双图，Delivery 按 wave 演进，`requires-decision` 回流。 | 旧阶段图必须重画，不是补一条箭头。 |
| P0 | tracker issue 是“全部核心内容单真源”，本地仅可再生缓存。`spec.md:55-66` | tracker 保存控制索引；repo/Git 保存 contract/artifact/receipt 大实体；每条事实只有一个领域真源。 | 旧“tracker 单真源”与 Q5/Q18 冲突。 |
| P0 | board 优先、退化为旧 loop/单会话，Core 与 board 直接耦合。`spec.md:114-124` | typed `ExecutionAdapter` + capability Router；board/manual/其他载体等价接入。 | 需要 port/adapter 边界，不能只写 fallback prose。 |
| P0 | 四条件收口 + comment / `[x]` 人工回写。`spec.md:128-170` | ProfileRegistry + typed receipts + deterministic Gate projector + actor/quorum/revocation + waiver + stale。 | 旧门禁模型不够表达 Q24～Q35。 |
| P0 | 单仓 map 与 board 工作树拓扑为主。 | 一个 StoryRoot 多 RepoLane，各自 tracker/checkout/integration/Gate，required lanes 合成。 | 需要 RepoLane 一等域对象与 Story reducer。 |
| P1 | research/prototype/grilling 四种 decision 票 + 一种 execution 票。`spec.md:82-87` | research/decision/prototype/implementation/review/acceptance 共用 WorkTicket envelope + stable lifecycle profile。 | 票 taxonomy、状态与 `produces/verifies/accepts` 边需更新。 |
| P1 | review/acceptance 主要埋在 board execution/收口里。 | 默认 Gate-first；只有独立 owner/context/blocking/retry/跨票覆盖时才晋升 WorkTicket。 | 调用链需显式 Gate 节点与“晋升为票”的路由。 |
| P1 | automated 证据只区分 board evidence 与 tracker 评论证据。 | 规划期 risk/test 强度、每 session 适量验证、最终 integration SHA 全量回归、SamplePack provenance。 | 缺 `RiskVerificationPlanner`、GateCatalog/full-suite proof 与 SamplePack。 |
| P1 | Web v1 只读星图/档案/四条件；交互放 v2。`spec.md:185-196` | Web v1 已裁决三组 typed commands，且 ticket 层要显示完整 journey。 | 必须新增 Story Web command adapter；不能只复用 interview web。 |
| P1 | Registry/profile 不存在。 | ready 前绑定 profile version+digest；缺失时 fail-closed degraded，仅止损命令可用。 | 恢复链必须先 Profile preflight，不能先 dispatch。 |
| P2 | `to-spec/to-tickets` 只有“匿名功能位”，未写清谁调用、输入输出与 tracker 写入边界。 | 用户明确要求完整 skill 组合链和 workflow/atomic 分类。 | 应保留其规则、抽成无副作用 planner，不直接嵌套两个发布型 workflow。 |

## 关键设计含义（Inference）

1. **热路径只需要一个总控 prompt。** `workflow-story-map` 负责恢复和路由；Profile/Gate/Receipt/Router/Reducer 都应由 scripts/modules 承载。参考 `aes-workflow` 也把用户入口与阶段 skill 分开，并声明确定性工具只做 ID/digest/index/结构校验：`G:/GIT/AI_WorkFlow/aes-workflow/skills/engineering/README.md:5-20`、`aes-using-workflow/SKILL.md:8-35,113-122`。
2. **不要把所有现有 skill 都串成固定线性链。** ProfileRegistry 声明 role/capability DAG；同一 ticket 只调用它需要的原子能力。固定的是协议边界与 Gate，不是 `research → prototype → implementation → review` 每票全跑。
3. **Web 是另一个 adapter，不是另一个 workflow 真源。** 它读 Core 投影、发 typed command、收 Human Receipt；所以无论用户从 Web、聊天或 tracker 操作，最后都经过同一个 CommandPort/ReceiptPort。

## 未知项

- **ProfileRegistry 的文件路径、schema 与首批内置 profile** 尚未由仓库定义；Q24 只锁定 repo 真源、声明式扩展、ready 前 digest 绑定。
- `TicketSlicer`、`RiskVerificationPlanner`、`ChangeClassifier` 是同一 `workflow-story-map` skill 内部三个原子模块，还是三个可独立安装 skill，仓库没有裁决。按“薄总控”原则，若它们需要独立复用或独立评测才值得拆 skill；否则可先作为同一 skill 的 deterministic/agent module。
- `aes-merge-worker` 的独立 SKILL 仍缺失；其现有 charter 在 board 文档里，但输入 schema、终局 schema和安装边界未成文。
- GitLab tracker adapter 没有实现证据；`aes-glab` 只能提供底层 CLI 约束，不能证明共同领域协议等价。
- 当前 `aes-qa` 的 `aes.qa.receipt/v1` 与新版统一 Receipt envelope 的映射尚未定义；尤其缺 policy/profile/contract/subject digest、actor authorization、quorum、revocation。
- 外部 `aes-workflow` 是参考 checkout，不是本仓运行时依赖。最终是复制思想、包装调用还是建立版本依赖，尚未裁决。
- Web 与 board 的最终信息架构属于另一事实分片；本文件只说明 Web 在调用链中是 projection/command/human-receipt adapter。

## 没查的

- 未验证任何尚不存在的 `workflow-story-map` 实现、GitLab live API 或 Web runtime，因为本轮明确不实现目标。
- 未替用户决定具体 JSON 字段名、目录布局、Router 评分算法、Profile taxonomy 的最终名称。
- 未修改 `manifest.json`、`rounds.jsonl`、`context.md`、`2-prototype/` 或产品代码。
