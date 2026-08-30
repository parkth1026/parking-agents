<!-- draft v2 | published 2026-08-30T00:00:00+08:00
     用户意见：补齐完整 Skill 组合链，明确 workflow 与原子能力
     状态：superseded for orchestration semantics by v3-role-skill-carrier-model.md；仅保留能力 inventory -->

# Skill 组合设计：workflow-story-map 完整调用链

**草稿，尚未锁定。** 分类判据不是 prompt 长短，而是“谁拥有可恢复的状态推进”。

## 1. 五层分类

| 层 | 定义 | 本设计中的节点 |
| --- | --- | --- |
| 用户入口 workflow | 接受 Story 意图或 StoryRoot，恢复全局状态并决定进入哪个阶段 | **新建** `workflow-story-map` |
| 阶段 workflow | 拥有一个可恢复的阶段闭环，内部组合原子能力 | 现有 `workflow-interview`、`aes-worktree-board`、`aes-issue-worker`；**缺失待建** `aes-merge-worker` |
| 原子能力 Skill | 一个输入、一个局部产物/receipt、一个停止条件，不拥有 Story 全局状态 | `aes-interview`、`aes-prototype`、`aes-goal-contract`、`research`、`best-practice-research`、`grilling`、`domain-modeling`、`prototype`、`tdd`、`diagnosing-bugs`、`aes-qa`、`code-review`、`simplify`、`aes-gate` |
| 内部原子模块 | 新版需要，但当前没有独立复用/安装证据；先住在 `workflow-story-map` 内部 | **新建** `TicketSlicer`、`RiskVerificationPlanner`、`ChangeClassifier` |
| deterministic core / adapters | 同输入必须同输出；负责 digest、schema、reducer、权限、Gate、transport，不是长 prompt Skill | **新建** Recover/Reconcile、Profile loader、Receipt validator、Gate projector、Membership reconciler、Capability Router、RepoLane/Story reducers、GitHub/GitLab TrackerAdapter、Board/Manual ExecutionAdapter、Story Web adapter |

## 2. 完整调用链

```text
Human / Story Web
  |
  v
[W0] workflow-story-map                         用户入口 workflow（新建）
  |
  +--> [C0] Recover + Reconcile Core            deterministic
  |      +--> GitHubTrackerAdapter / GitLabTrackerAdapter
  |      +--> RepoEvidenceStore per RepoLane
  |      +--> ProfileRegistryLoader             digest 不匹配即 degraded
  |      +--> MembershipReconciler              root 枚举 ↔ child back-reference
  |      +--> ReceiptValidator -> GateProjector
  |      `--> StoryProjector                    Web/List/Map/Action Center 同一读模型
  |
  +--> [W1] Discovery Coordinator
  |      |
  |      +--> workflow-interview                阶段 workflow
  |      |      +--> aes-interview              原子：事实 + 用户裁决
  |      |      +--> aes-prototype              原子：七面 + 确认对照物
  |      |      `--> aes-goal-contract          原子：Contract + finalize
  |      |
  |      +--> research / best-practice-research 原子：事实证据
  |      +--> grilling + domain-modeling        原子：决策与术语
  |      +--> prototype                         原子：技术试验
  |      +--> TicketSlicer                      内部原子模块：无副作用票 proposals
  |      `--> RiskVerificationPlanner           内部原子模块：risk/test/SamplePack/role DAG
  |                 |
  |                 `--> Core 校验后由 TrackerAdapter 创建 WorkTicket 与边
  |
  +--> [W2] Delivery Coordinator
  |      |
  |      +--> Capability Router                 deterministic，记录选择理由
  |      |      |
  |      |      +--> BoardExecutionAdapter
  |      |      |      `--> aes-worktree-board  阶段 workflow：控制执行资源
  |      |      |             +--> aes-issue-worker       ticket owner workflow
  |      |      |             |      +--> tdd | diagnosing-bugs
  |      |      |             |      +--> aes-qa loop/final
  |      |      |             |      `--> simplify
  |      |      |             `--> aes-merge-worker       阶段 workflow（缺失待建）
  |      |      |                    +--> code-review
  |      |      |                    `--> merge + exact integration full suite
  |      |      |
  |      |      +--> ExternalManualAdapter --> human / external runner receipts
  |      |      `--> OtherExecutionAdapter  --> 同一 typed port
  |      |
  |      +--> ReceiptValidator -> GateProjector
  |      `--> ChangeClassifier                 内部原子模块
  |               +--> Contract 不变 --> 下一 Delivery wave
  |               `--> 改变承诺/不确定 --> Discovery Coordinator
  |
  +--> RepoLane Integration Reducer             required lane 精确 SHA + full suite
  `--> Story Reducer                            required lanes -> done / done-with-waiver

[P0] workflow-story-map-web                     projection/command adapter（新建）
  +--> 只读 StoryProjector：Action Center + Lane + List/Map + ticket journey
  +--> 白名单 CommandPort：answer/acceptance；claim/release/pause；retry/cancel/withdraw
  `--> Human ReceiptPort：actor/policy/subject/revision/quorum/revocation
```

## 3. 每个 workflow 的责任边界

| Workflow | 输入 | 输出 | 明确不负责 |
| --- | --- | --- | --- |
| `workflow-story-map`（新） | 新 Story 请求或现有 StoryRoot；各 RepoLane identity | 下一合法动作、阶段 dispatch、全局投影、Story terminal | 不复制深 Skill prompt；不写实现；不直接判 Gate PASS；不拥有 worktree/Agent/merge |
| `workflow-interview`（现有） | Story/decision 的需求材料与 issue 目录 | context、rounds、确认对照物、Contract、dossier | 不实现目标；不派执行；不写 execution receipt |
| `aes-worktree-board`（现有） | BoardExecutionAdapter 转换后的 dispatch/control | attempt/job/control events、candidate/review/QA/integration evidence | 不拥有跨 tracker StoryRoot；不解释 ProfileRegistry；不合成 Story done |
| `aes-issue-worker`（现有） | typed WorkOrder、exact worktree/base、AC | READY_TO_MERGE 或 typed terminal | 不 merge、不写 tracker、不自行挑票、不代答人工 |
| `aes-merge-worker`（待建） | candidate/base、review/QA receipts、integration target、full-suite catalog | review、merge/integration、full-suite receipts 或打回 | 不允许被审 worker 自审；不复用 stale receipt；不拥有 Story done |

## 4. 不直接嵌套的完整 workflow

| Skill | 保留位置 | 不能当原子嵌套的原因 |
| --- | --- | --- |
| `wayfinder` | 与 `workflow-story-map` 并存的 planning-only 用户入口 | 它拥有自己的 map/ticket/claim/close 生命周期，默认止于路线清楚；嵌套会产生两个总控和两个 tracker 写入者 |
| `to-spec` | ad-hoc spec 发布 workflow；复用其写法，不直接调用 | 它直接发布 tracker/标签，与新版 Profile 绑定和单一 CommandPort 冲突 |
| `to-tickets` | ad-hoc 拆票 workflow；抽取 tracer-bullet 规则给 `TicketSlicer` | 它会询问并直接建票；新版必须先产出无副作用 proposal，经 risk/profile/Core 校验后才持久化 |
| `workflow-interview-web` | 复用 Discovery 的 response schema 与吸收协议 | 它只投影一个 interview issue 目录，不能充当跨 Story/RepoLane 的第二真源 |

## 5. 固定链与按 Profile 选择的链

固定的只有：

```text
Recover/Reconcile → 合法阶段 → typed dispatch → receipt validation → Gate projection → reducer
```

每张票不会固定执行所有 Skill。Profile 的 role/capability DAG 决定需要哪些原子能力：

- research ticket 可以只走 `research → receipt → Gate`；
- implementation ticket 通常走 `aes-issue-worker`，内部按 TDD 或诊断路径循环；
- 简单自动检查直接走 deterministic harness，不创建 Agent；
- 独立 review 只有满足独立 owner/context/retry 等判据时才晋升 WorkTicket；
- 人工视觉验收走 ExternalManualAdapter，不进入实现 worker 会话。

## 6. 当前真实缺口

- 缺 `workflow-story-map` 用户入口 Skill 与 deterministic core。
- 缺独立 `aes-merge-worker/SKILL.md`；目前只有 board 文档中的职责描述。
- 缺 GitHub/GitLab typed TrackerAdapter；`gh`、`aes-glab` 只是 CLI/认证范式。
- 缺 Board/ExternalManual ExecutionAdapter 与 Story Web adapter。
- 缺 TicketSlicer、RiskVerificationPlanner、ChangeClassifier。
- 现有 `aes-qa` receipt 尚未映射新版 profile/contract/policy/actor/quorum/revocation envelope。

## 7. 待用户确认的设计取舍

- `TicketSlicer`、`RiskVerificationPlanner`、`ChangeClassifier` 先作为 `workflow-story-map` 内部原子模块；出现第二消费者或需要独立安装/评测时，再提取为独立 Skill。
- `aes-merge-worker` 因拥有可恢复的 integration 闭环，必须成为阶段 workflow，而不是 `code-review` 的别名。
- Web 是 projection/command adapter，不是另一个 workflow 真源。
