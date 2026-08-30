<!-- confirmed P14 | 2026-08-31
     用户确认：好的请继续；仅业务基线，不含 Web 或实现授权
     确认版·锁定不可修改；执行 Agent 改产品，不改本对照物 -->

# 行为对照表：Story Atlas 业务逻辑 v6 候选

**确认版·锁定。** 用户确认：P14（2026-08-31）。仅业务对照物已确认；v6 Web 仍需独立审阅。

## 权威优先级

以下优先级只裁定设计规范冲突，不改变客观事实。用户确认某项规则不等于 tracker 已发布、Contract 已定稿或 Receipt 已产生；事实字段仍按各自 canonical source 与 provenance 解释。

1. 本轮 `rounds.jsonl` 与 `context.md` 中已经记录的用户裁决。
2. 本轮确认后的 prototype 根文件。
3. 真实 tracker/repo 事实及其 provenance。
4. #159 旧 spec/ADR：只作 historical evidence；与本轮裁决冲突时不得支配当前投影。
5. `SIM-*`：只用于补足不存在的 Delivery runtime，不得汇入真实 Story 状态。

## 业务词汇

| 名称 | 唯一含义 | 不得混同 |
| --- | --- | --- |
| `StoryRoot` | 一个稳定用户意图的跨仓身份，拥有 DiscoveryMap、DeliveryMap 与最终终态 | tracker root 自身 CLOSED、某张票或某条 RepoLane |
| `DiscoveryRevision` | 某一时刻对目标、Contract 与裁决的版本化认识；可来自 historical tracker 或 current dossier | WorkTicket membership |
| `RepoLane` | repo 级交付单元，绑定 repo identity、tracker、exact checkout、integration target、Profile/Gate catalog 与局部终态 | WEB/CORE 组件区、团队、Workstream |
| `Workstream` | 同一 RepoLane 内的视觉/责任分组，例如 Web、Core、Docs | RepoLane；它本身不参与 Story done 合成 |
| `WorkTicket` | 稳定问题/工作身份，绑定一个稳定 Profile；完成后关闭并产生新票 | Attempt、Gate、固定流程阶段 |
| `Attempt` | WorkTicket 的一次执行；append-only，candidate 与失败证据不覆盖 | WorkTicket identity |
| `RoleAssignment` | Workflow 指派的责任、权限与 Receipt 契约 | Carrier 或 Skill 名称 |
| `Carrier` | 本次实际承载 Role 的 harness、fresh subagent、独立 Task/Agent 或 human | 角色授权；更强载体也不能补出缺失 capability |
| `Skill` | Agent Carrier 在 Role 授权内调用的局部程序/方法 | Workflow、Role、Carrier |
| `ProfileBinding` | WorkTicket ready 前冻结的 `profile_id + schema_version + digest` | 同名最新 Profile |
| `Subject` | Receipt 精确证明的对象：candidate、contract revision、artifact revision 或 integration SHA | ticket 标题或“当前最新版” |
| `Receipt` | actor 针对 subject、policy/profile revision 发布的 append-only 证据 | Gate verdict |
| `Gate` | Core 从 Profile predicate 与有效 Receipt 确定性重算的投影 | owner 可手工改写的任务 |
| `Frontier` | 当前 open、依赖已满足、未被 claim 且 capability 前置可证明的 WorkTicket 集合 | locked reducer、pending Gate 或 StoryRoot |
| `Projection Runtime` | 单向读取持久事实、校验、重算、广播只读投影的可丢弃 Runtime | Agent Host、第二真源或 Web command backend |

## 场景基线

### REAL-CURRENT：#147 当前真实投影

- Story identity：`github:parkth1026/parking-agents#147`。
- Historical Discovery revision：#148–#159，12 membership、7 native dependency、已 CLOSED。
- Current Discovery revision：本地 dossier，`1-interview=done / 2-prototype=pending / 3-contract=pending`。
- 两个 revision 同属一个 StoryRoot，但 current dossier 不是 tracker member；它作为版本化 Discovery source/sidecar 展示。
- Delivery runtime：`NOT_CONNECTED`；verified WorkTicket、RepoLane、candidate、Receipt、Gate、owner、wave 均为 0。
- v6 默认真实视图不得用 SIM PASS 改写上述状态。

### SIM-FULL：跨 RepoLane 完整闭环演练

- `SIM-LANE-SKILL`：repo=`github:parkth1026/parking-agents-manual`，tracker=`github`，exact checkout=`git:SIM-SKILL-BASE-2`，integration target=`refs/heads/dev`。
- `SIM-LANE-RUNTIME`：repo=`github:parkth1026/parking-agents`，tracker=`github`，exact checkout=`git:SIM-RUNTIME-BASE-4`，integration target=`refs/heads/dev`。
- 两条 Lane 都是 required；Web/Core 仅作为各 Lane 内 Workstream。
- 所有运行 ID、SHA、Receipt、actor、owner、wave 均带 `SIM-`，常显 `SIMULATED GAP`。

## 变化行

| # | 输入 / 前置 | v5 或旧设计行为 | v6 业务候选行为 |
| --- | --- | --- | --- |
| B1 | 打开当前 #147 | 历史 #147 图被称为 current Discovery，当前 dossier 只是一枚 pending badge | 同一 StoryRoot 显示 historical 与 current 两个 DiscoveryRevision；默认高亮 current dossier，旧 #147 图可切换审计 |
| B2 | 当前 #147 没有 Delivery runtime | 页面默认展示 active wave-2 的模拟 Delivery | 真实数据集显示 `NOT_CONNECTED / 0 VERIFIED`；完整 Delivery 只能进入明确隔离的 `SIM-FULL` 演练 |
| B3 | 同一 repo 内有 Web/Core 工作 | 将 WEB/CORE 当两个 RepoLane | 它们是 Workstream；只有拥有独立 repo/tracker/checkout/integration target 的对象才叫 RepoLane |
| B4 | WorkTicket 正在执行且 QA failed | 单一 `state=blocked/failed` | 保留 `lifecycle=active / control=running或paused / gate=failed`，主徽章只是可重算显示值 |
| B5 | research 决定生成 implementation | 一张票可能沿“阶段”原地变型 | research ticket 关闭，通过 `produces` 创建绑定新 Profile 的 implementation ticket；旧身份不复活 |
| B6 | ticket retry | 旧 candidate/证据可能被覆盖 | WorkTicket identity 不变，追加新 Attempt；旧 candidate Receipt 自动 stale 但保留审计 |
| B7 | Profile 要求独立 QA | 页面只写 owner 或 `independent` 文案 | RoleAssignment 声明 actor separation；Router 先证明 Carrier capability，再选最小充分 Carrier；实现者 actor 不得签独立 QA Receipt |
| B8 | Profile 不要求独立 Review WorkTicket | v5 固定画 QA→Review 节点 | Review 默认是来源票的 Gate/Receipt；只有满足独立 owner/context/blocking/retry/跨票覆盖判据才晋升为 WorkTicket |
| B9 | 当前 candidate QA PASS | Lane Gate 可能直接称 integration Gate | candidate Receipt 只满足 candidate Gate；merge 后 subject 变为 exact integration SHA，旧 candidate Receipt 不满足 final integration Gate |
| B10 | integration SHA 形成 | Story reducer只看两个 Lane Gate 标签 | 每条 required Lane 必须有 exact integration subject、final full-suite Receipt、Profile 所需 Human/Waiver 状态，才能得到 local terminal |
| B11 | final suite FAIL/NOT_RUN/BLOCKED | 可能被人工文字解释为完成 | 默认阻断；只有 Profile 明示 waivable 且授权 actor 发布完整 WaiverReceipt，才得到 `done-with-waiver`，绝不改写 PASS |
| B12 | Human Receipt 被撤销 | 旧 PASS 可能继续显示 | 追加 RevocationReceipt；Core 重算 Gate 为 pending/needs-human，签发与撤销都保留 |
| B13 | Delivery finding 不改 Contract | 可能占用用户决策 | ChangeClassifier 生成下一 Delivery wave，继承当前 Contract subject；新的 candidate/attempt/Receipt 仍独立 |
| B14 | Finding 改 goal、范围、公共行为、AC、数据/权限、Profile、integration target，或无法分类 | Delivery 继续或由模型猜 | `requires-decision` 回 Discovery；新 Contract revision 产生后，绑定旧 subject 的 Receipt 全部 stale |
| B15 | Registry 缓存存在但精确 digest 缺失 | 可能加载同名最新版 | `DEGRADED_PROFILE_UNAVAILABLE`；只允许 read/diagnose 与 Core 无需 Profile 即可判定的止损，不允许推进 Gate 或收口 |
| B16 | 规划为低风险，实际 diff 触及权限/跨仓路径 | executor 可沿用低强度验证 | 规划验证是冻结下限；effective risk 只能升档，补 Gate/Carrier capability，不能由 executor 降档 |
| B17 | QA 缺测试数据 | 默认把问题推给用户或随意合成 | 用户/授权数据优先；QA 可依据设计、一手规则和历史缺陷构造 versioned SamplePack；expected output 无法确定才 `AWAITING_INPUT` |
| B18 | Projection Runtime 重启 | 页面状态可能依赖进程内存 | 从 tracker index、repo artifact/Receipt、Registry digest 全量重建；缓存删除不改变 canonical Story |
| B19 | Web 用户搜索、选中、切 Tab、缩放或收藏 | 有机会被当成 Story mutation | 只保存浏览器本地 view state；Projection Runtime 只向 Web 单向广播，不接受任何领域命令 |
| B20 | 用户点击跨图回流 | 只看到解释 Modal | 跳到 source finding、target decision、Contract revision 与 new wave 的 trace，并保留返回前 Tab/selection/filter/scroll |
| B21 | 所有 required RepoLane 已满足当前 Contract 的 integration/full-suite/Human 门禁，一个预先声明 optional 的 Lane 仍 blocked | OPEN-1 未定，可能误把所有 Lane 都当成 done 前置 | P13=A：只将 required Lane 纳入终态合成；允许 Story done，同时常显 optional_debt 的 owner、原因、影响和恢复入口；不改变 optional Lane 自己的三轴与 Gate |

## 边界值与失败态

| # | 输入 / 前置 | 必须观察到的结果 |
| --- | --- | --- |
| E1 | StoryRoot 没有 required RepoLane | 不得以空集合合成 done；保持 Discovery incomplete/needs-decision |
| E2 | `SIM-LANE-SKILL` candidate PASS，但 integration SHA 尚未形成 | candidate Gate 可过；Lane integration Gate 必须 pending |
| E3 | integration SHA 改变一个 commit | 旧 integration/full-suite/Human Receipt 全部 stale；重新取证 |
| E4 | Receipt 的 subject、profile digest、contract digest、policy digest 任一不匹配 | Receipt 保留为 rejected/stale evidence，不贡献 Gate |
| E5 | 无 Carrier 同时满足 live browser、fresh context 与 actor separation | `BLOCKED_CAPABILITY_UNAVAILABLE`；不得递归升级到一个仍缺 capability 的“更强”Task |
| E6 | Contract/scope 无法分类 | `requires-decision`，不进入风险升档分支 |
| E7 | Registry 缺失时收到 pause/cancel/release | 仅当 Core 无需 Profile 即可安全判断时执行；不得顺带收票或改 Gate |
| E8 | current #147 数据集打开 Delivery Tab | 明确空态 `NOT_CONNECTED / 0 VERIFIED`，不得默认跳到 SIM-FULL |
| E9 | WorkTicket 标为 closed，但必需 Receipt 缺失 | lifecycle 可为 closed，gate 仍为 pending/failed；Story reducer不得把 close 当 PASS |
| E10 | required Lane 全部 terminal，但存在待完成的 required Human checklist | Story terminal 仍 blocked/needs-human |
| E11 | required Lane 全部 PASS，无全局必需待办；optional Lane blocked | Story=`done`，optional Lane 仍 blocked；optional_debt 不得隐藏，不得自动改 PASS/closed |
| E12 | 一个 required Lane 缺 final full-suite Receipt，optional Lane 全部 PASS | Story 不得 done；optional 的绿灯不能抵消 required 的缺证 |
| E13 | required 范围存在符合 Q30 的有效 Waiver，同时 optional Lane blocked | Story=`done-with-waiver`，optional_debt 另列；optional 身份本身不是 Waiver，底层非 PASS 结果不被改写 |
| E14 | required Lane 的真实依赖由 optional Lane 提供，但该依赖缺失 | required Gate 仍未满足，Story 仍阻断；不能用 optional 标记跳过 required 依赖 |
| E15 | 执行中尝试把失败的 required Lane 原地改为 optional | 不允许修改冻结的 Contract 绑定；必须回 Discovery 形成新 Contract revision，旧 subject Receipt 按 Q29 失效 |

## 不变清单

- `workflow-story-map` 是薄用户入口 workflow；不亲自实现产品、不直接写 Gate verdict。
- `workflow-interview` 继续锁一个任务的目标与完成口径；`wayfinder` 继续是 route-unknown、planning-only 的并存入口。
- `aes-worktree-board`、`aes-issue-worker`、`aes-qa`、review/simplify/merge 继续拥有各自执行或验证局部生命周期；Story Core 只通过 typed Adapter/Receipt 消费事实。
- GitHub/GitLab 共同领域语义等价，但原生 API 只作 enhancement。
- Tracker 保存控制索引；repo/Git 保存 Contract、Artifact、Receipt 与版本化 Registry；Projection Runtime 不是第三真源。
- WorkTicket、Attempt、Receipt、Waiver、Revocation、withdrawn/reopened 历史 append-only，不删除旧证据。
- Gate 只能由 Core 从 Profile 与 Receipt 重算；Adapter、Carrier、Web、owner 均不能直接写 PASS。
- 当前 v1 Skill+Web Runtime 不依赖 AesAgent，也不拥有 Agent/Provider/Task lifecycle。
- Web 当前完全只读；P12 已覆盖旧稿中的 Web typed mutation commands。
- P13=A：required/optional 在 Contract 中预先冻结；optional 债务不直接参与 done 判定，也不触发 Waiver，但其事实与恢复入口一直可见。
- 本 workflow 只完成访谈、对照物与 Goal Contract，不实现 `workflow-story-map`。

## 配置差异

| 配置概念 | 旧/v5 | v6 业务候选 | 迁移/失败语义 |
| --- | --- | --- | --- |
| `discovery_revision` | 历史图 + 当前 pending badge | versioned source list，显式 current/historical/superseded | 旧 #159 spec/ADR 自动归 historical evidence，不自动删除 |
| `repo_lanes[]` | WEB/CORE 组件区 | 每项必带 repo identity、tracker、exact checkout、integration target、required、Profile/Gate catalog | 缺字段不得称 RepoLane；只能退化为 Workstream |
| `repo_lanes[].required` | OPEN-1 待裁决 | Contract 冻结的必需性；只有 required Lane 参与终态合成 | 运行期不可原地改；变更回 Discovery 并修订 Contract |
| `optional_debt[]` | 未定义 | 从未完成的 optional Lane 事实投影 owner、原因、影响和恢复入口 | 可重建、不可作为第二任务真源；空集合明确显示无 optional debt |
| `work_ticket.profile` | UI 不展示 | `profile_id + schema_version + digest`，ready 前冻结 | 无法精确重建即 fail-closed degraded |
| `work_ticket.state` | 单一 state | `lifecycle + control + gate + display_projection` | display 不是正本，随三轴重算 |
| `role_assignment` | owner 字符串 | role、authorized receipt types、independence、quorum、required capabilities | Carrier 不满足任一硬要求即不合格 |
| `subjects` | candidate 与 integration 混用 | candidate / contract / artifact / integration 各自 typed + digest | subject 变化无条件 stale |
| `surface` | 页面内部推断 | declarative read-only SurfaceDocument；domain commands=`[]` | 未知 block fail-closed/read-only fallback |

## P13 已锁定：required-only 终态合成

`OPEN-1` 已由 `round:58 / q_id:P13 / choice:A` 关闭。终态合成先检查 required Lane 与全局必需义务；全部满足时为 `done`，若 required 范围使用有效授权 Waiver 则保持 `done-with-waiver`。optional Lane 的 blocked/deferred 不直接阻断，但它的 owner、原因、影响和恢复入口必须在 `optional_debt[]` 中常显，原始状态与证据不被改写。

P14 已整体确认本业务基线，批准据此构建 v6 Web 草稿；不确认 Web 成品或启动目标实现。

