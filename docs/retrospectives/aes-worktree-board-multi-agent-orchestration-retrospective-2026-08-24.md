# `aes-worktree-board` 多智能体编排全流程复盘

> 这是一份流程复盘材料，不是某个产品 Issue 的实现报告，也不是新的规范正文。它记录本轮 `aes-worktree-board` 从“巡检 worktree”演进到“基于 Issue、Codex Desktop `create_thread`、独立 review、自动合并和熔断”的完整运行过程，供后续进化技能使用。

## 1. 复盘结论

本轮已经证明，目标流程的核心业务闭环是可行的：主 Agent 可以作为 Orchestrator，给每个 dev worktree 创建侧边栏可见的独立 Codex Task；每个 worker 可以拥有一个 Issue，自己完成实现、定向测试、自检、提交；独立 reviewer 可以审查；发现问题后回到原 executor 修复、重测、提交；通过后主 Agent 可以在 main 上复核并合并；连续三次 reviewer BLOCK 可以熔断；所有线路都没有自动可推进项时可以写入 `orchestration-stop` 并停止派发。

但是，这次运行还没有成为一个可靠的“挂机式状态机”。真正的问题不在于有没有创建五个 Task，也不在于某一个 Issue 最终是否完成，而在于控制平面仍然依赖主 Agent 的临时记忆、当前回合的事件监听和可被覆盖的快照文件。任务执行平面已经接近目标，任务状态、事件消费、租约、监听恢复、合并门禁和停止条件还没有被固化成同等可靠的系统能力。

一句话判断：

> **业务闭环跑通，控制闭环不稳；执行者边界已经纠正，Orchestrator 的状态与事件边界仍需产品化。**

## 2. 复盘范围与证据边界

### 2.1 复盘对象

本报告只回答以下问题：

- 技能是否正确识别了主 Agent、executor、reviewer、main 和 test worktree 的职责？
- Issue → Task → worktree → 实现 → QA → review → fix → commit → merge 的状态链是否连续？
- 事件是否被及时、逐项、幂等地消费？
- worker 状态是否足够可信，能否支持自动决策？
- BLOCK、park、handoff、merge 和全局停止是否有清晰边界？
- 模型路由、真实运行证据和用户交互优先级是否符合约定？
- 哪些行为已经是可复用的流程能力，哪些只是本轮 Agent 临时补救？

具体 Issue 的代码实现只作为流程证据样本，不作为本报告的主体。

### 2.2 证据来源

本报告使用了以下证据，时间戳优先采用日志中的 ISO UTC 时间：

1. 本次完整 Codex Desktop 会话 JSONL：
   `C:\Users\parking\.codex\sessions\2026\08\24\rollout-2026-08-24T00-23-23-01a02f6f-1129-7601-9668-67a93f0f399e.jsonl`
2. 技能当前文件：
   `G:\GIT\AI_WorkFlow\parking-agents\.agents\skills\aes-worktree-board\SKILL.md`
3. 技能运行快照与状态脚本：
   `G:\GIT\AI_WorkFlow\parking-agents\.agents\skills\aes-worktree-board\runtime\status.json`
   和 `status.js`
4. 本轮最终停止账本：
   `C:\Users\parking\.agents\skills\aes-worktree-board\runtime\orchestration-stop.json`
5. 治理 Issue #5：
   [parkth1026/parking-agents#5](https://github.com/parkth1026/parking-agents/issues/5)
6. 主仓规则：
   `G:\GIT\AI_WorkFlow\aes-agents-v2\AGENTS.md`
7. Git worktree、分支祖先关系、cherry 结果、测试与 review 任务的现场输出。

### 2.3 证据等级

报告中的判断按以下方式标记：

- **事实**：可以由日志、文件、Task 最终输出或 Git 状态直接复核。
- **推断**：由多个事实归纳出的流程判断，明确标出，不伪装成运行时字段。
- **建议**：面向下一版技能的设计要求，不代表当前已经实现。

当前会话日志共有 3,623 行记录，包含 54 个 turn context、1,944 个 event message、1,611 个 response item、11 个 world-state 记录和 2 个 compacted 记录。这个数字只说明本轮执行和对话的复杂度，不等于 Task 吞吐量或成功率。

## 3. 目标流程与实际流程

### 3.1 目标流程

```text
发现主仓与 worktree
  -> 读取 issue frontier 与 worker 账本
  -> 判断 issue 类型、依赖、模型和可用 worktree
  -> 为一个 worktree 创建一个有明确边界的 create_thread Task
  -> executor 自己完成实现 -> 定向 QA -> 自检 -> commit
  -> 独立 reviewer 审查
       -> APPROVE -> 主 Agent 复核 Git/main/QA -> merge main
       -> BLOCK -> 原 executor 修复、重测、补 commit -> 再 review
       -> 连续三次 BLOCK -> handoff-required
  -> 任意 Task 事件进入 inbox，由 Orchestrator 幂等消费
  -> 没有可推进线路 -> orchestration-stop
```

目标流程的关键不在于把一个任务拆成更多阶段，而在于每个 executor 负责一个完整交付闭环，主 Agent 只负责调度、证据判断、门禁和 merge。

### 3.2 本轮实际流程

实际经历了四个明显阶段：

1. **工具形态纠偏**：先尝试了 headless CLI、`dispatch.mjs`，期间还出现过 subagent 方式；用户指出这不是侧边栏可见的 Multi-Agent Orchestration，随后切换到 Codex Desktop `create_thread`。
2. **协议补齐**：围绕 Issue #5 逐步补上 executor ownership、review/fix 压缩、模型两档、autonomous 与 user-aligned 分流、事件 fan-in、cursor、三次 BLOCK 熔断和全局停止。
3. **真实并行运行**：dev1～dev5 分别承接 #56、#57、#14、#17、#41，形成 executor、reviewer、修复和 merge/park/handoff 分支。
4. **运行中修复控制平面**：用户发现已完成 Task 没有反应后，修复了只处理 `wake` 而忽略全部 `polls` 的问题；用户又指出不应靠固定定时器，最后将 heartbeat 降为丢事件恢复兜底，并在全局停止后删除它。

因此，本轮不是“按最终协议一次执行成功”，而是“边运行边发现协议缺口，再用 Issue #5 和账本补协议”。这对技能进化很有价值，但也说明当前技能缺少启动前自检和版本化契约。

## 4. 按阶段复盘

### 4.1 阶段 A：角色、工具和控制边界

#### 目标

主 Agent 是 Orchestrator，不进入 dev worktree 代写实现；worker 是真实执行者；reviewer 是独立审查者；test worktree 只用于用户手动测试，不参与自动派发。

#### 实际发生

- 初始理解把“发送任务”混合成了 CLI `codex exec`、headless dispatch、subagent 和 Desktop Task 四种不同机制。
- 用户多次纠正：需要的是侧边栏可见的独立 `create_thread` Task，而不是当前 Agent 内部开 subagent，也不是脚本直接执行。
- 主 Agent 一度承担了过多具体任务控制，用户明确要求“你现在是总管，不能管每个 worktree 具体干的活”。
- 最终切换为独立 `create_thread`，使用保存的项目和 local environment，使 worker 出现在 Codex Desktop 的任务/线程视图中。

#### 判断

这是本轮最早、影响最大的流程偏差。它不是实现细节错误，而是“任务对象的定义”没有在技能入口处锁定。`create_thread`、`spawn_agent`、`codex exec` 和脚本 dispatch 都能让某种 Agent 工作，但它们的可见性、所有权、生命周期、是否出现在侧边栏、是否能被后续 `wait_threads` 追踪完全不同。

#### 结果

- **早期：红灯。** 使用了错误的 worker 载体，用户无法在 Desktop 看到预期的独立 Task。
- **纠偏后：绿灯。** `create_thread` 成为实际可见的 worker 单元，主 Agent 与 worker 的角色边界基本稳定。

#### 下一版必须固化

技能入口应该先做“调度能力 preflight”：默认路径只能使用 Desktop `create_thread`；CLI/headless 只能作为明确标记的离线 fallback；内部 subagent 不能冒充用户要求的 worker Task。失败时要直接报告“创建了什么对象、是否可在侧边栏看到、如何继续追踪”。

### 4.2 阶段 B：仓库、worktree 和 Issue frontier 发现

#### 做得好的地方

- 没有把 `test` worktree 当作普通开发线路，遵循了用户“只用于手动测试”的约定。
- 对 dirty worktree 采取了保留现场策略，没有 reset、删除或覆盖用户修改。
- 后续状态判断使用了 branch ancestry、`git cherry`、modified/untracked 分类，而不是只看分支名字或“clean”字样。
- 发现并保留了 dev4 的 `worktrees/` 未跟踪现场；没有因为完成 merge 就擅自清理。

#### 暴露的问题

- 初始 board 输出过宽，信息截断，无法稳定支持每个 worktree 的独立判断。
- 初期的任务/Issue 映射不够可信，出现“看起来空闲”与“实际有未完成现场”之间的落差。
- `collect`、`assess` 和其他状态写入之间没有版本或租约保护，后续刷新会使已有判断倒退或被旧事实覆盖。
- 当前 `SKILL.md` 仍保留“只给合并建议、不执行 merge”的旧边界（例如文档中的合并建议规则和 `dispatch.mjs` 派发方式），而 Issue #5 已经记录了新的 create_thread、自动 merge 和熔断协议。这是契约漂移，不是单纯的文档风格问题。

#### 关键事实

技能当前要求 `recommend` 需要 ahead、无冲突、验收闭环、worktree 干净和测试/验收证据；这套静态建议规则本身是合理的，但它没有覆盖“Task 是否已结束”“review 是否已消费”“当前 merge 是否已完成”“是否应该继续派发”等运行态问题。

#### 判断

发现平面已有较好的 Git 事实采集能力，但还没有升级成可信的调度输入。下一版需要把“事实采集”和“决策状态”分成两个不可混淆的层：脚本可以更新事实快照，只有 Orchestrator 或带版本校验的状态转移才能更新任务判断。

### 4.3 阶段 C：任务分类和模型路由

#### 用户最终形成的策略

- 优先自动闭环的 autonomous Issue；需要用户确认、主观设计或范围决策的 user-aligned Issue 先 park。
- 常规、目标明确、决策少的任务默认使用 Luna Max。
- 跨边界、验收模糊、需要大量判断的任务使用 Sol High。
- 目前两档已经形成清晰边界，不需要为了“看起来精细”而强行增加第三档。

#### 本轮执行

- 常规 executor/reviewer 多使用 Luna Max。
- 发现跨 wire、Provider、SDK、插件边界等高判断任务时，follow-up reviewer 使用 Sol High。
- 该策略是在运行中逐步形成的，早期并不是所有 Task 都按同一份可解释规则路由。

#### 判断

两档模型策略是本轮有效的资源控制结论；问题不是档数，而是缺少显式评分和记录。模型选择如果只存在于 prompt 临时文字中，之后无法解释为什么某任务用了高强度模型，也无法在复盘中判断是否浪费或不足。

#### 建议

保留两档，增加可审计路由条件：

| 条件 | 默认模型 | 说明 |
| --- | --- | --- |
| 单包、局部代码、AC 明确、自动测试可覆盖 | Luna Max | 常规执行、定向修复、机械 review |
| 跨端、跨 wire、Provider/插件边界、协议迁移、验收含主观决策 | Sol High | 需要架构判断或证据冲突裁决 |

每个 Task 账本记录 `modelTier` 和 `routingReason`。除非任务事实改变，不因 worker 进度慢就自动升级模型。

### 4.4 阶段 D：executor ownership 与阶段压缩

#### 用户要求

用户明确反思了“review、fix、commit 是否可以合并”，要求每个 Agent 自己完成自己的闭环，不让 master 把一个 worker 拆成很多人工控制阶段。

#### 本轮形成的协议

- 一个 executor Task 对一个 worktree、一个 Issue 负责到底。
- executor 自己实现、运行定向 QA、做 self-review、提交 commit。
- reviewer 只做独立判断，不代替原 executor 写修复。
- reviewer BLOCK 后，回派原 executor；不再额外创建一个独立“fix and commit”角色。
- 原 executor 修复后自己重测并提交，再触发独立 follow-up review。

#### 评价

这是本轮最成功的流程设计之一。它减少了阶段切换、上下文丢失和“reviewer 说了但没有人负责提交”的问题，也符合 worker 对自己产出负责的原则。

#### 尚未解决的边界

- reviewer 是否“独立”没有由系统能力强制，主要靠 prompt 约定。
- executor 的最终输出格式没有统一成机器可判定的交付记录，主 Agent 仍要从自然语言中抽取 commit、测试和阻塞信息。
- “review APPROVE”与“executor 已 commit”有时仍被混为一谈；reviewer 可以认可工作区内容，但没有 commit 不能进入 merge gate。

### 4.5 阶段 E：create_thread 派发与可追踪性

#### 成功点

切换到 `create_thread` 后，任务成为 Desktop 可见的独立 Task，满足用户要求的 Multi-Agent Orchestration 形态。每个 Task prompt 能够带上 Issue、目标、范围、验收、禁止事项和交付证据，worker 不需要读取主仓对话才能开始工作。

#### 失败点

前期使用 headless CLI 和 subagent 说明技能没有先验证“用户要求的 Task 是什么”。这导致了一段时间内执行工作确实发生了，但用户看不到、无法在侧边栏跟进，也无法把它当作独立协作单元继续使用。

#### 根因

技能把“派发动作”写成了命令选择，而没有把“Task object contract”写成前置条件。下一版应该先声明：

```text
workerUnit = visible create_thread Task
executorOwnership = one Task owns one issue/worktree delivery loop
reviewUnit = independent create_thread Task linked to executor
fallback = only when Desktop Task capability is unavailable and explicitly recorded
```

### 4.6 阶段 F：事件监听、fan-in 和 Task 完成反应

这是本轮最明确的控制平面事故。

#### 第一个错误：只处理 `wake`

最初的监控逻辑把 `wait_threads` 返回值中的 `wake` 当成唯一需要处理的事件，没有逐项消费同一返回中的全部 `polls`。因此出现了用户观察到的现象：四个 Task 实际已完成，但主 Agent 没有分别触发 review、merge 或下一项派发；看起来像“必须五个都完成才反应”，实际是事件 fan-in 漏消费。

#### 修复

后续协议补上了：

- 每个目标 thread 有独立 cursor。
- 每次 wait 返回的所有 changed polls 都要处理。
- 已消费的 final event 不重复触发 reviewer、fix 或 merge。
- 一个 Task 完成即可推进，不等待五个 Task 汇总完成。
- final、BLOCK、APPROVE、commit、merge 都要成为可重复判断的状态转移输入。

#### 第二个错误：把当前回合 `wait_threads` 当成持续监听器

`wait_threads` 只能在当前 Orchestrator 回合持续等待；主 Agent 发出最终回复、回合结束后，原监听不会自动永久存在。此前 heartbeat 被暂停时，就发生了“Task 已经完成，但没有主 Agent 继续消费事件”的窗口。

#### 修复与代价

后来启用了 10 分钟 heartbeat 作为丢事件恢复兜底，并明确禁止它成为正常调度器、禁止重复创建 Task；全局停止后删除了该 automation。它恢复了部分可观测性，但也带来了长时间重复通知和“系统依赖定时器调度”的错觉。用户最终指出，正常路径应该是每个 Task 结束时即时知道并分析，定时器只能是监听丢失时的恢复机制。

#### 判断

事件模型已经被正确识别，但运行载体没有持久化。下一版不能只写“使用 wait_threads”，还必须回答：

1. 当前回合谁持有 listener？
2. listener 结束后谁负责 resume？
3. cursor 写在哪里，是否原子更新？
4. 同一个 final event 重新送达时如何幂等？
5. heartbeat 何时启用、何时停用、如何证明没有 live listener？

### 4.7 阶段 G：worker 状态账本与状态可信度

#### 已有能力

本轮确实维护了 worker 坐标、当前 Issue、任务描述、dirty 数、mergeCheck、assessment、blockCount、park/handoff 等信息，并最终写入了 `orchestration-stop.json`。这比只依赖聊天上下文前进了一步。

#### 暴露的缺陷

当前状态更像一个“可重建的 snapshot”，不是 append-only 的交付账本：

- `collect` 或其他刷新可以覆盖先前的 assessment，缺少版本号和 owner 校验。
- status snapshot 中同一 worktree 的字段可能互相矛盾。例如 dev4 的 `currentTask` 写着“已合并 main”，但 `merge` 字段仍是 `not-yet`，理由正文却又确认已合并。
- 旧 reviewer Task 在 worktree 已 park 后又被重新激活，说明缺少 task lease、generation 或 parked 状态的 reactivation guard。
- Task 最终状态、最新 commentary、Git HEAD、review verdict 和 merge result 没有完全统一的主键关系。
- `blockCount` 直到本轮后期才成为一等字段，早期主要依赖自然语言判断。

#### 判断

如果账本不能回答“这个事件对应哪一个 Task、哪一代执行、哪一个 commit、是否已消费”，它就不能作为自动调度依据。状态记录不是附加文档，而是这个系统的控制面数据库。

#### 目标记录

每个 worker 至少需要以下字段：

```text
workerId, worktree, issue, taskId, parentTaskId, role, generation,
state, phase, modelTier, leaseOwner, cursor, lastEventId,
headSha, dirtySummary, codeVerdict, runtimeEvidence,
reviewVerdict, blockCount, lastProgressAt, nextAction,
handoffReason, mergeCommit, updatedAt
```

状态变更应记录 `from`、`to`、`eventId`、`actor`、`reason` 和证据引用，而不是只覆盖一个 `reason` 字符串。

### 4.8 阶段 H：QA、真实运行证据和 merge gate

#### 用户提出的关键放宽

用户指出很多 BLOCK 只是因为没有做真机测试，不应让自动化任务无限等待；如果自有 QA 足够证明，应直接 merge；只有需要用户决策的项目排后。

#### 本轮形成的正确区分

后续分析把验收分成两个正交维度：

| 维度 | 回答的问题 | 可能结果 |
| --- | --- | --- |
| `code/spec verdict` | 代码和 Issue/合同是否满足，是否存在真实代码或规范缺口 | PASS / BLOCK |
| `runtime evidence` | Web、Desktop、Provider、remote 等真实环境证据是否执行并通过 | PASS / NOT_RUN / BLOCKED / FAIL |

`runtime evidence = NOT_RUN` 不能被重写成 PASS，但也不应在所有 Issue 中自动升级为 `code/spec BLOCK`。

#### 建议的门禁分类

- **autonomous、AC 不要求真实客户端/Provider 的任务**：代码、定向测试、独立 review、Git 门禁通过即可 merge；把 runtime NOT_RUN 记录为未执行证据。
- **user-aligned 或 Issue 明确要求真实 Web/Desktop/Provider 的任务**：runtime NOT_RUN、BLOCKED 或 FAIL 仍然不能 merge，应 park 或 handoff。
- **安全、数据迁移、破坏性生命周期和明确发布门禁**：按风险强制真实运行或等价高阶证据。

#### 运行样本说明

- dev4/#17 形成了成功的 autonomous merge 证据链：独立 review APPROVE、executor 修复提交、main 上定向 server/client/typecheck 通过，真实 UI 未执行但不属于该任务的代码阻断。
- dev1/#56 和 dev2/#57 最终的第三次 BLOCK 都有独立的代码/规范阻断，不能归因于“没有真机测试”。这验证了放宽策略不能变成无条件放行。
- dev5/#41 的代码和规范 review 可以 APPROVE，但最终 Ready gate 因 Provider 长时间没有发布 validation-report/ready-manifest 而失败；这是该任务自己的交付合同门禁，不能用“真机测试可选”覆盖。

#### 判断

本轮最大的验收改进不是“少做测试”，而是把不同证据层的失败分开。下一版技能必须让 reviewer 输出结构化 verdict，禁止用一个顶层 `BLOCK` 同时表示代码错、规格未定、真实环境未跑、工具不可用和用户决策未给。

### 4.9 阶段 I：review、fix、commit 和三次熔断

#### 成功闭环

本轮最终实现了以下压缩后的闭环：

```text
executor final
  -> independent reviewer
  -> BLOCK
  -> original executor fix + retest + commit
  -> independent follow-up reviewer
```

这满足了用户“一个 Agent 自己把自己的任务做好”的要求，同时保留了 review 的独立性。

#### 三次 BLOCK 规则

- dev1/#56：第三次独立 reviewer BLOCK 后进入 `handoff-required`。
- dev2/#57：第三次独立 reviewer BLOCK 后进入 `handoff-required`。
- 达到三次后不再创建 fix、reviewer 或新 Task，保留现场等待人工交接。

这是本轮明确落地的熔断能力，避免无限自动修复。

#### 仍然需要补强

- `blockCount` 必须绑定 Issue + executor generation，而不是简单数消息；同一 reviewer 重复输出不能重复计数。
- reviewer BLOCK 必须包含结构化 finding、证据文件、重现命令、建议修复边界和是否属于代码阻断。
- 第三次 BLOCK 后，必须自动生成 handoff bundle：当前 commit、已闭合问题、最后阻断、未执行证据、dirty 状态、下一决策点。
- park、handoff 和 failed 要互相排他，不能只靠自然语言标题区分。

### 4.10 阶段 J：merge main

#### 成功样本：dev4/#17

dev4/#17 是本轮最完整的自动合并样本：

- executor 修复 reviewer 反馈并形成 commit `01c01b748c4ac9b52c68bdb410fad6e012cea4fa`；
- 独立 re-review APPROVE；
- main 上产生 merge commit `ae6f245946de5b74643da25aa19cd599c302fff6`；
- main 上补跑 server lifecycle、client-runtime、ChatView.logic 和相关 typecheck；
- `git cherry main dev4` 无未合并提交，证明 commit 祖先关系闭合；
- dev4 的未跟踪 `worktrees/` 被保留，没有因为 merge 成功而清理用户现场。

这证明“自主 Issue 通过自有 QA 后直接 merge”是可行的。

#### 流程缺陷

- 技能原始文档仍写着“只给合并建议，不执行 merge”，而本轮实际行为已经需要主 Agent 执行 merge；规范真源没有同步。
- merge 结果没有成为统一的 Task 终态事件，dev4 snapshot 仍出现 `currentTask=已合并` 与 `merge=not-yet` 并存。
- merge 后 main 的验证是本轮 Agent 额外执行的判断，不是技能规定的固定门禁动作。
- main 变化后，其他 worktree 是否需要同步、哪些可以继续派发，没有由状态机自动判定。

#### 下一版 merge gate

merge 之前必须结构化确认：

```text
issueContractClosed = true
executorCommitExists = true
reviewVerdict = APPROVE
codeVerdict = PASS
runtimeGate = allowed / PASS according to issue class
mergeTree = clean
mainFreshness = verified
noUnrelatedChanges = true
```

merge 之后必须把 `mergeCommit` 写回 TaskRecord，并在 main 上重跑适用的定向门禁；否则只能标记 `review-approved`，不能标记 `merged`。

### 4.11 阶段 K：park、handoff 与全局停止

#### 本轮最终结果

在 `2026-08-23T23:37:20Z` 写入 `orchestration-stop.json` 时：

| worktree | 线路 | 状态 | 原因 | 下一步 |
| --- | --- | --- | --- | --- |
| dev1 | #56 | `handoff-required` | reviewer BLOCK×3 | 等待人工交接 |
| dev2 | #57 | `handoff-required` | reviewer BLOCK×3 | 等待人工交接 |
| dev3 | #14 | `parked` | user-aligned / needs-decision | 等待用户决策 |
| dev4 | #17 | `merged` | 已进入 main，保留未跟踪现场 | 不派发 |
| dev5 | #41 | `parked` | user-aligned / Ready gate 未通过 | 等待用户决策 |
| test | 手动测试 | 忽略 | 用户明确排除自动调度 | 不参与判断 |

此时没有 active Task，所有非 test worktree 都没有可继续的自动线路，因此停止派发是正确的。

#### 做得好的地方

- 没有因为“还有空闲 worktree”就给 user-aligned 任务强行续跑。
- 没有因为三次 BLOCK 就关闭 Issue、删除分支或覆盖现场。
- 明确记录了“等待人工交接”与“等待用户决策”是不同状态。
- 停止后删除了原本用于恢复丢事件的 heartbeat，避免在全局无线路时继续制造噪声。

#### 不足

- 全局停止条件是运行后期临时补出来的文件，不是初始状态机的一等状态。
- 之前 heartbeat 连续运行了较长时间，说明系统没有在第一时间知道“所有线路都已终止/等待人工”。
- `orchestration-stop` 的读写位置与主仓 board snapshot 不在同一控制面，重启后是否自动识别停止状态还没有由技能保证。
- 恢复条件没有定义：什么时候用户交接、Issue 更新或新 Issue 到来可以解除 stop，谁有权解除。

## 5. 结果总表

| 流程能力 | 目标 | 本轮结果 | 评价 |
| --- | --- | --- | --- |
| worker 载体 | 侧边栏可见 `create_thread` | 早期错误，后期切换成功 | 黄→绿 |
| 主从边界 | master 调度，worker 实现 | 经用户纠偏后基本成立 | 黄→绿 |
| test 隔离 | 不自动派发 | 已遵守 | 绿 |
| Issue/worktree 映射 | 一条线路一个 owner | 最终形成，但早期不稳定 | 黄 |
| executor 闭环 | 实现到 commit 自己负责 | 已形成 | 绿 |
| 独立 review | reviewer 与 executor 分离 | 已形成 | 绿 |
| review/fix 压缩 | BLOCK 回原 executor | 已形成 | 绿 |
| 模型路由 | Luna 常规、Sol High 复杂 | 方向正确，记录不够结构化 | 黄 |
| event fan-in | 全量 polls、独立 cursor | 先漏消费，后修复 | 黄 |
| 持续监听 | Task 结束可自动反应 | 当前回合可反应，回合结束会丢监听 | 红 |
| 状态账本 | 可审计、不可回退 | 有 snapshot，无可靠历史 | 红 |
| runtime 证据 | 与 code/spec 分开 | 后期正确区分 | 黄→绿 |
| 三次 BLOCK 熔断 | 第三次后 handoff | dev1/dev2 已执行 | 绿 |
| autonomous merge | QA/review/Git 通过即合并 | dev4 已验证 | 绿 |
| user-aligned 分流 | 需要决策的任务 park | dev3/dev5 已执行 | 绿 |
| 全局停止 | 无线路时停止派发 | 已执行，但后补 | 黄 |
| 现场保护 | 不 reset/delete/覆盖 | 基本遵守 | 绿 |

## 6. 主要故障、根因和影响

| 表象 | 直接原因 | 深层根因 | 影响 |
| --- | --- | --- | --- |
| 用户看不到 worker | 使用 CLI/headless/subagent | 没有先锁定 worker object contract | 失去侧边栏可见性与可跟踪性 |
| 已完成 Task 没有反应 | 只处理 `wake`，漏掉全部 `polls` | 事件 fan-in 没有独立 inbox/cursor | review/merge/续派发延迟 |
| 回合结束后无人继续消费 | `wait_threads` 只在当前回合存活 | listener 生命周期没有产品化 | “Task 完成但主 Agent 不知道” |
| 10 分钟检查变成噪声 | heartbeat 被当成恢复方案 | 没有区分正常 listener 与 recovery monitor | 用户误以为定时器是主调度器 |
| assessment 被覆盖或倒退 | snapshot 可重建、无版本/租约 | 状态平面不是 append-only ledger | 自动决策失去可信输入 |
| park 后旧 reviewer 又启动 | 没有 generation/lease guard | Task 生命周期与 worktree 生命周期脱节 | 重复工作、污染现场 |
| reviewer 把未做真机测试判成代码 BLOCK | 顶层 verdict 混合多个证据维度 | 缺少 code/spec/runtime 三态模型 | 合法自动任务被错误阻塞 |
| 长测试长时间无输出 | 没有 progress heartbeat、stall threshold | Task 没有运行健康模型 | 无法判断继续等待还是转处理 |
| reviewer 临时 worktree 残留 | Windows 长路径/文件句柄导致清理失败 | 临时资源没有 owner、保留和清理协议 | untracked 噪声，影响后续判断 |
| merge 后状态仍显示 not-yet | merge 结果没有统一终态写回 | Git 事实和 board assessment 是两套真源 | UI/自动调度出现矛盾 |
| 技能文档与 Issue #5 不一致 | 实践先演进，技能文件未同步 | 没有 single source of truth 和版本迁移 | 新一轮 Agent 可能回到旧 dispatch 方式 |

## 7. 当前流程的最佳实践判断

### 7.1 应保留的设计

1. **一个 executor 对一个 Issue/worktree 负责完整闭环。** 这是减少编排开销和上下文损失的核心。
2. **reviewer 独立，fix 回原 executor。** 既保持审查独立，又避免另一个 Agent 接手后重新理解全局。
3. **两档模型即可。** Luna Max 覆盖常规任务，Sol High 覆盖跨边界和模糊任务，关键是记录路由理由。
4. **autonomous 与 user-aligned 分流。** 先处理明确、可自动验收和可交付的线路；需要产品选择的线路 park，不让它阻塞所有自动化工作。
5. **自有 QA 通过后允许 autonomous merge。** 用户不需要为已经有充分代码/测试/review 证据的任务做重复手工验收。
6. **三次 BLOCK 熔断。** 达到阈值后交接，不再自动消耗时间和上下文。
7. **现场保护优先。** dirty、untracked、未提交和临时产物都先记录再决定，禁止用清理动作掩盖状态。
8. **test worktree 单独隔离。** 手动测试现场不应被自动调度器当成空闲 worker。

### 7.2 不应继续依赖的做法

1. 用“创建了一个 Agent”代替“创建了用户可见的独立 Task”。
2. 用当前对话记忆代替 Task registry 和事件账本。
3. 用 10 分钟轮询代替事件驱动；轮询只能是丢事件恢复。
4. 用一个 `BLOCK` 表示代码失败、规范未定、真机未跑、工具不可用和等待用户决策。
5. 用 clean branch、review APPROVE 或 issue CLOSED 单独推断可 merge。
6. 用刷新 snapshot 覆盖历史状态，不记录状态转移和证据来源。
7. 在任务没有明确 handoff bundle 的情况下把第三次 BLOCK 只写成一句自然语言。

## 8. 面向下一版技能的演进要求

以下是根据本轮证据排序的技能演进材料，不是要求本次立即实现的代码计划。

### P0：先修控制平面

#### P0.1 建立一等 Task Registry

每次 `create_thread` 后必须立即记录 `taskId/threadId/issue/worktree/role/model/parent/generation/lease/cursor/state`。任何 review、fix、merge 或停止动作只能通过 registry 中的记录执行。

完成标准：重启或重新进入对话后，单靠 registry 可以回答每个 worktree 当前在做什么、谁拥有它、最后一个事件是什么、下一步是什么。

#### P0.2 建立事件 inbox 和幂等消费

每个 thread 独立保存 cursor；每次 `wait_threads` 返回先把所有 polls 写入 inbox，再逐项执行状态转移。事件必须有唯一 `eventId`，重复送达只能得到 `already-consumed`，不能重复创建 reviewer 或 merge。

完成标准：构造“同一 final event 送达两次、五个 thread 同时完成、wake 为空但 polls 有变化”的 fixture，结果仍然只创建一个后续动作。

#### P0.3 把 verdict 拆成至少三个维度

```text
codeVerdict: PASS | BLOCK
runtimeEvidence: PASS | NOT_RUN | BLOCKED | FAIL
deliveryVerdict: MERGE_READY | PARKED | HANDOFF_REQUIRED | BLOCKED
```

完成标准：runtime NOT_RUN 在 autonomous、AC 不要求真实运行的任务上可以记录但不阻塞；在明确要求真实运行的任务上会进入 PARKED/BLOCKED；任何情况下都不把 NOT_RUN 改写成 PASS。

#### P0.4 固化状态机和终态

建议状态集合：

```text
discovered
classified
claimed
dispatching
executing
self-qa
committed
reviewing
fixing
approved
merge-ready
merged
parked
handoff-required
orchestration-stop
```

每个转移必须有前置条件、触发事件、证据和下一动作。`merged`、`handoff-required`、`parked` 和 `orchestration-stop` 都是终态或暂停态，不能被普通 collect 自动覆盖回 `idle`。

#### P0.5 固化 create_thread preflight

skill 的正常路径明确为 Desktop `create_thread`。创建后验证 Task 是否有用户可见 ID、所属 project/environment、worktree 和 initial prompt；验证失败时不把 headless 或 subagent 的成功执行伪装成正常编排成功。

#### P0.6 全局停止评估器

每当一个线路进入 `merged`、`parked`、`handoff-required` 或不可派发的 dirty/lease 状态时，重新计算是否仍存在可自动推进线路。若不存在，写入与 Task Registry 同源的 `orchestration-stop`，停止新 Task、reviewer、fix 和 merge 创建。

完成标准：所有非 test worktree 都处于终态/暂停态时，不需要等待下一个 heartbeat 才停止。

### P1：补足生命周期、资源和证据

#### P1.1 worktree lease 与 generation

一个 worktree 同一时间只能有一个 executor owner；reviewer 只能读或使用隔离临时 worktree。park/handoff 后旧 Task 的 late event 必须被拒绝；重新启动同一 Issue 时必须创建新 generation，而不是复活旧 Task。

#### P1.2 progress、stall 和 timeout

Task 需要报告阶段级 progress：`phase`、`lastProgressAt`、最近测试命令、最近 commit/文件变化。长测试期间不能只依赖“没有最终消息”。超过阈值应标记 `stalled-suspected` 并要求诊断，不得按名字批量 kill 进程，也不得把 timeout 自动判成失败。

#### P1.3 reviewer 临时资源协议

为临时 reviewer worktree、缓存、日志和构建产物记录 owner、路径、创建时间、保留原因和清理状态。Windows 文件句柄导致清理失败时，生成可交接的 cleanup note，不让未跟踪产物悄悄进入“空闲/可派发”判断。

#### P1.4 可解释模型路由

保留 Luna Max/Sol High 两档；根据改动域数量、跨 wire/provider/plugin 边界、依赖关系、AC 主观性和真实运行要求计算路由理由，写入 TaskRecord。模型升级不能由“任务花的时间长”单独触发。

#### P1.5 merge handler

主 Agent 在 `approved` 后执行固定 merge gate：重新读取 main、检查祖先关系和冲突、确认无 unrelated changes、在 main 上跑适用 QA、写回 merge commit 和 main HEAD。merge 后刷新其他 worktree 的 behind/ahead，但不自动覆盖它们的工作。

#### P1.6 listener 生命周期

把正常运行分成两种明确模式：

- **interactive orchestration**：当前主线程持续 `wait_threads`，收到事件立即消费；
- **overnight/recovery orchestration**：主线程无法持续等待时，由明确的恢复 automation 接管，并且只消费 registry 中已有 Task。

heartbeat 必须能证明没有 live listener 才启动；全局 stop 或无 active Task 时自动结束。不要把它写成固定 10 分钟的正常调度器。

### P2：提高可观察性和回归能力

#### P2.1 board 展示状态机，而不是自由文本

界面至少显示：worker、Issue、Task、phase、model、last progress、code verdict、runtime evidence、review verdict、blockCount、commit、merge status、next action。自由文本 reason 作为证据摘要，不作为机器状态。

#### P2.2 单一事实源和迁移规则

Issue #5、`SKILL.md`、运行时 JSON schema 和 board UI 不能各自定义一套状态。应明确：规范源、运行时 schema、展示层分别负责什么；升级时写 migration/version，禁止“实践先改、Issue 再补、skill 仍保留旧命令”。

#### P2.3 多智能体编排回归 fixture

至少覆盖以下场景：

- 五个 Task 同时完成，但只消费一个 wake；
- polls 中同时含 executor final、reviewer final 和旧 commentary；
- duplicate final event；
- reviewer BLOCK 后原 executor fix；
- 第三次 BLOCK 进入 handoff；
- park 后旧 reviewer late event；
- runtime NOT_RUN 但 code/spec PASS；
- 所有线路终止后 global stop；
- merge 成功但 worktree 有保留的 untracked 现场；
- main 更新后其他 worktree 的 behind/ahead 变化。

## 9. 推荐的下一版流程合同

下面这段可以作为后续重写技能时的行为骨架：

```text
1. Discover
   采集 Git/worktree/Issue/Task registry；先识别 test、dirty、已有 lease 和终态线路。

2. Classify
   给每条 Issue 标记 autonomous 或 user-aligned，计算依赖、风险、runtime gate 和模型档位。

3. Claim
   为一个 Issue 和一个 worktree 建立唯一 lease；已有 active Task 或 reviewer/fix 链时只恢复，不重复创建。

4. Dispatch
   使用侧边栏可见的 create_thread；写入 TaskRecord、初始 cursor 和 generation。

5. Execute
   executor 自己完成实现、定向 QA、self-review、commit，并输出结构化交付证据。

6. Review
   独立 reviewer 只产生 code/spec/runtime 分维度 verdict；BLOCK 必须附带可验证 finding。

7. Repair
   BLOCK 回原 executor；executor 修复、重测、提交；三次 BLOCK 后 handoff-required。

8. Merge
   APPROVE 后主 Agent 在 main 上复核 Git/QA/门禁并合并；merge commit 和 main HEAD 写回 registry。

9. Park/Handoff
   user-aligned、需要决策、runtime 合同未满足或三次 BLOCK 的任务进入可恢复的暂停/交接包。

10. Stop
    每次终态转移后重算线路；没有可自动推进的非 test 线路时写 orchestration-stop，不创建新 Task。

11. Observe
    当前 listener 消费所有 polls；恢复 automation 只消费 registry 中已有事件，永不成为重复派发器。
```

## 10. 交接包应包含什么

当任务无法继续时，不能只留下“BLOCK”或“等待用户”。至少生成：

- Issue URL 和当前目标；
- worktree、branch、HEAD、ahead/behind、modified/untracked；
- executor/reviewer Task IDs、generation 和最后 cursor；
- 已通过的代码/测试/review 证据；
- 最后一次 BLOCK 的 finding、文件、命令和重现结果；
- `blockCount` 及计数依据；
- runtime evidence 的状态和未执行原因；
- 是否需要用户决策，决策问题的最小选项；
- 恢复命令或恢复条件；
- 明确声明当前不会自动创建新 Task、不会 merge、不会删除现场。

这使“等待人”成为可交接的系统状态，而不是主 Agent 失去上下文后的模糊停顿。

## 11. 对本轮执行的最终评价

### 已经真正跑通的部分

- 真实的多 worktree 并行开发，而不是单 Agent 假并行。
- 侧边栏可见的 `create_thread` worker 形态。
- 一个 executor 自己完成实现到 commit 的闭环。
- 独立 reviewer 和原 executor 修复链。
- autonomous 与 user-aligned 分流。
- Luna Max / Sol High 两档模型路由的方向。
- 不因未做真机测试而无条件阻塞所有任务，同时保留真实证据的诚实状态。
- dev4/#17 的 review → merge → main QA 闭环。
- dev1/#56、dev2/#57 的三次 BLOCK 熔断和人工交接。
- dev3/#14、dev5/#41 的 park/needs-decision 分流。
- 所有线路没有可推进项时停止派发，并保护用户现场。

### 还不能称为“可靠挂机系统”的部分

- Task registry 不是持久、单一、不可回退的真源。
- listener 只在当前回合存在，恢复机制仍是后补的 heartbeat。
- 事件 fan-in 曾经漏消费，幂等规则是运行中才补上的。
- status snapshot 存在字段矛盾和旧状态复活风险。
- merge gate、runtime gate 和 code/spec gate 没有统一 schema。
- 长任务没有正式 stalled/progress 协议。
- skill 文件与 Issue #5 的新实践仍有旧协议漂移。

因此，下一步最有价值的工作不是继续增加更多 worker 或更多轮询，而是把已有的正确行为固化为可恢复、可验证、不可重复消费的控制平面。

## 12. 复盘材料的使用说明

本文件是截至 `2026-08-24` 的流程证据快照。它不应直接被当作新的规范；进化技能时应从“目标状态机、Task Registry、事件 inbox、双轴/三轴门禁、listener 生命周期、全局停止”中选择要落入规范的内容，再同步更新：

1. `.agents/skills/aes-worktree-board/SKILL.md`；
2. 运行时 JSON schema、collect/assess/dispatch 或新调度入口；
3. board 展示和状态迁移；
4. Issue #5 的治理说明；
5. 对应的回归 fixture 和验证文档。

不要只修改 Issue #5 或只修改 `SKILL.md`。本轮已经证明，规范、运行时和展示层各自漂移时，下一次 Agent 会重新走回已经纠正过的错误路径。

## 附录 A：关键文件与复核入口

| 材料 | 作用 |
| --- | --- |
| `G:\GIT\AI_WorkFlow\parking-agents\.agents\skills\aes-worktree-board\SKILL.md` | 当前技能契约；可见旧 headless/只建议 merge 的边界 |
| `https://github.com/parkth1026/parking-agents/issues/5` | 本轮逐步补齐的 Multi-Agent Orchestration 治理协议 |
| `G:\GIT\AI_WorkFlow\parking-agents\.agents\skills\aes-worktree-board\runtime\status.json` | worktree、Issue、assessment、Git 快照；包含字段矛盾样本 |
| `C:\Users\parking\.agents\skills\aes-worktree-board\runtime\orchestration-stop.json` | 最终 global stop 和 handoff/park/merge 状态 |
| `G:\GIT\AI_WorkFlow\aes-agents-v2\AGENTS.md` | 主仓的真实 QA、Web/Desktop、隔离状态和 merge 前证据边界 |
| `G:\GIT\AI_WorkFlow\aes-agents-v2\apps\server\src\workflow\WorkflowWorkspaceFiles.ts` | #56 第三次 review 的代码阻断证据样本；用于说明 code BLOCK 与 runtime NOT_RUN 的区别 |
| `C:\Users\parking\.codex\sessions\2026\08\24\rollout-2026-08-24T00-23-23-01a02f6f-1129-7601-9668-67a93f0f399e.jsonl` | 本次全量对话、Task、heartbeat、review、merge 和用户纠偏的原始证据 |

## 附录 B：可复用的判断口诀

```text
看见 Task 完成，不等于已经消费事件。
看见 reviewer APPROVE，不等于已经 commit。
看见 commit，不等于已经 merge main。
看见 branch clean，不等于没有用户现场。
看见 runtime NOT_RUN，不等于代码失败。
看见所有 Task final，不等于可以停止；先判断是否有可推进线路。
看见没有 active Task，不等于可以重复派发；先查 lease、park、handoff 和 stop。
```
