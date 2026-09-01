# Fact: 既有大任务规格、拆票、执行与收口边界

- 派遣问题：核对当前 `to-spec`、`to-tickets`、`workflow-interview`、`workflow-story-map`（若存在）、board/closeout 的职责边界，以及 ADR-0001/0003/0004 对本次制作目标的既有约束；区分已存在的技能定义/源码、已接受设计与未验证能力。
- 完成：2026-08-31T20:39:00+08:00。
- 核对范围：`G:/GIT/AI_WorkFlow/parking-agents-manual`；HEAD `f4e37757b9f3d5627c7636626f579d87d523bc37`。只读当前规则、技能定义及有限源码；本文件为本分片唯一写入。未改 manifest、rounds、context、技能或产品。
- 时间与证据边界：下表的“已有”指当前文件/源码可读，不等同本轮运行验收通过。ADR 的“已接受”是其文件所记历史裁决；旧研究结论未重新调查，不用旧访谈替用户决定本次范围。

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| 本仓约定以指定开发目录工作，不默认新建/切换 worktree；技能脚本以 Node `.mjs` 为约定，`.agents/skills` 是孵化位，`skills` 是安装源。 | `AGENTS.md:12-14` |
| `workflow-interview` 现有职责是锁“要做什么”和“怎么算做完”；其自身是编排器，组合 interview、prototype、contract 三阶段，不实现用户任务目标。 | `skills/workflow/workflow-interview/SKILL.md:8-20,116` |
| 该编排器终态交付契约、阻塞/启动指令与决策档案；非 `[A]` 条款需要报告给用户，没有在该技能中宣称完成执行侧人工验收。 | `skills/workflow/workflow-interview/SKILL.md:76-90` |
| 三阶段的结构闸门和单契约 finalize 已有源码：第三阶段检查 `3-contract/contract.md` 与上次 finalize；finalize 运行该契约 validator 并生成面向这一份契约的 `/goal` 交接语句。 | `skills/workflow/workflow-interview/scripts/session.mjs:341-350,686-707,763-779` |
| `to-spec` 已有技能定义，输入是当前对话和仓库理解，要求综合已有结论而非重新访谈；先讨论测试 seam，再发布规格并打 `ready-for-agent`。它的模板包含 Problem、Solution、User Stories、Implementation/Testing Decisions、Out of Scope。 | `skills/matt-skills/engineering/to-spec/SKILL.md:3-19,21-75` |
| 当前 `to-spec` 本体没有把完整 Goal Contract、确认原型和 finalize 写为所有调用的机械前置条件；“不得用 to-spec 代替未完成访谈”是组合流程需要维持的边界，不能误报成该独立技能已内置的完整门禁。 | `skills/matt-skills/engineering/to-spec/SKILL.md:7-19`；`docs/adr/0004-grill出口融合派发阶段模型.md:19-23` |
| `to-tickets` 已有技能定义，接受 plan/spec/conversation，产出独立可验的 tracer-bullet 票和阻塞边；默认一票适合一个全新上下文窗口。先向用户展示拆分与依赖，批准后发布；不关闭或修改父票。 | `skills/matt-skills/engineering/to-tickets/SKILL.md:9,25-38,42-67` |
| 纵切不是当前 `to-tickets` 的无例外绝对规则：宽重构明确允许 expand–contract、按影响面分批；独立批次仍无法保持绿色时允许共享集成分支，最终 integrate-and-verify 票才承诺绿色。 | `skills/matt-skills/engineering/to-tickets/SKILL.md:40` |
| `to-tickets` 当前已有本地一票一文件和远端一票一 Issue 两种输出约定；本地模板与远端模板都有 AC 与 Blocked by，但没有 board 所需完整执行契约的所有字段。 | `skills/matt-skills/engineering/to-tickets/SKILL.md:58-105`；`skills/workflow/aes-worktree-board/scripts/issue-contract.mjs:26-29,46-54` |
| ADR-0001 已接受的组合层落点是独立 `workflow-story-map`：拥有 story→拆解→派发→收口路由与门禁；组合 interview 家族与 board，规划侧通过 Goal Contract + contractDigest 接执行侧；wayfinder 继续负责路线未知的探索规划。 | `docs/adr/0001-整合落点为独立组合层编排技能.md:19-27` |
| 在当前仓库 `skills/` 文件清单中未定位到 `workflow-story-map/SKILL.md`；当前 checkout 也没有 `.agents/skills/` 目录。可确认有上述 ADR，不能据此称该组合技能已经可调用。此为限定目录的检索结论，不断言别的 checkout/安装位没有实现。 | 本轮 `rg --files skills` 后按 `workflow-story-map` 过滤无匹配；`Test-Path .agents/skills` 为 false；`docs/adr/0001-整合落点为独立组合层编排技能.md:21-25` |
| ADR-0004 已接受的历史阶段模型是 story 级 interview+prototype 收敛一次，出口融合总体契约与拆票功能位，每票生成自己的契约；story 与票各有 finalize，票通过后才进入 ready-for-agent frontier，tracker 状态由编排脚本唯一写入。 | `docs/adr/0004-grill出口融合派发阶段模型.md:17-25` |
| ADR-0004 的拆分判据明确引用 `to-tickets`，并非可以忽略其当前宽重构例外的独立“永远纵切”定律。该 ADR 属既有设计约束；本次是否继续采用此组合落点、适用哪些拆分例外，仍需与用户本次制作目标对账。 | `docs/adr/0004-grill出口融合派发阶段模型.md:20-21`；`skills/matt-skills/engineering/to-tickets/SKILL.md:31-40` |
| ADR-0003 的 story 收口是四条件：全票 close、acceptance 有证据全绿、story contractDigest 未漂移、非 `[A]` 档由人对 story 契约本体勾 `[x]`；不能以 Agent 自报或聊天里说信任代替。无 board 环境的自动证据走关票评论可复现命令/退出码/产物指针。 | `docs/adr/0003-story收口四条件硬门禁.md:16-23` |
| 上述四条件是 story 级收口设计，不等同目前 board 的“没有可继续推进的 lane/Issue”停止条件；后者可在 lane 为 merged、parked、handoff-required 时收敛，因此不能自动解释为所有产品验收均成功。 | `docs/adr/0003-story收口四条件硬门禁.md:18-23`；`skills/workflow/aes-worktree-board/SKILL.md:225-229`；`skills/workflow/aes-worktree-board/scripts/orchestrate.mjs:1478-1503` |
| board 已有执行控制面的技能定义与源码：脚本负责采集/记录/锁定/校验/渲染，宿主负责实际 Task 生命周期；只处理既有 worktree，不能代本次用户授权创建或调度工作。 | `skills/workflow/aes-worktree-board/SKILL.md:8-10,49-55,86-103` |
| board 的 `ready-for-agent` 标签仅是候选条件之一；另有 contract-complete 门，要求 goal、workflowRole、AC、dependencies、riskProfile、allowedSideEffects，缺字段不会靠自然语言猜补。 | `skills/workflow/aes-worktree-board/scripts/issue-contract.mjs:26-29,35-54,149-208` |
| board 已有每执行票的 contractDigest，覆盖目标、role、AC、依赖、副作用与人工门；不是仅靠标题或 ready 标签关联执行。 | `skills/workflow/aes-worktree-board/scripts/issue-contract.mjs:224-234`；`skills/workflow/aes-worktree-board/scripts/master.mjs:316-317,965-981` |
| board 已有 candidate 变化使 review/QA/acceptance 失效，以及 acceptance 绑定当前 candidate 的源码检查；集成后 verificationRun 也绑定 live integration HEAD。可复用该执行侧防线，不需要在总体规格中复制一套 competing runtime。 | `skills/workflow/aes-worktree-board/scripts/master.mjs:552-571`；`skills/workflow/aes-worktree-board/scripts/merge-policy.mjs:169-182`；`skills/workflow/aes-worktree-board/scripts/orchestrate.mjs:1709-1725` |
| 当前 board 有 job 的 claim→candidate→review/QA→gate→merge→verify→close 路径；这证明执行票流程入口已存在，不证明 ADR-0003 的跨票 story closeout、无 board 降级核验和人工 `[x]` 汇总器均已实现。 | `skills/workflow/aes-worktree-board/SKILL.md:382-425`；`docs/adr/0003-story收口四条件硬门禁.md:16-23` |

### 对本次制作目标的事实含义（不代用户裁决）

1. 不是从零发明“规格写作、拆票、依赖、独立验收、执行证据”五套能力：其独立定义或执行侧实现已有来源。新增目标首先需要说明要组合、增强或替代哪一段。
2. 独立 `to-spec/to-tickets` 的默认 ready 标签不自动满足 board 的 contract-complete。若目标包含交给 board 派发，必须定义两种契约形态之间的接口；仅输出普通 AC 清单不能冒充已接通。
3. “总体 spec + 多任务 + 独立验收”与 ADR-0001/0004 的方向有关，但不能由此推断用户已经同意本次制作覆盖运行时派发、持续执行、merge 或 story closeout，也不能把旧 ADR 的全链路范围自动扩大成本次授权。
4. 若此次只做到可派发交接，执行与收口是外部消费者及接口约束；若做到真正全链路收口，ADR-0003 的证据/人工回写/漂移规则会进入产物职责。两者的用户可见完成结果不同，属于 User decision，分片不选择。
5. “改 workflow-interview 让它直接实现/持续执行”会触及其当前 charter 与 ADR-0001 独立组合层落点；若用户要这样做，应明确重开设计取舍，不能静默覆盖既有边界。

## 未知项

- 当前 `skills/` 未定位到命名的 `workflow-story-map` 或 story `closeout`/`finish-check` 入口；本轮仅查技能文件清单、有关 ADR 与 board 有限源码，不能证明不存在以其他名字或在其他 checkout 的实现。
- 未核对远端 #147/#152/#153/#155/#159 后续是否有推翻 ADR 的新裁决。ADR 当前文件状态为已接受；其正文引用研究与票状态都作为历史来源，不作为实时 tracker 状态。
- 当前 repo 的总体规格→拆票→票级 finalize→board 契约适配是否已有其他集成入口，有限检索未获得完整可执行链证据；已确认两端独立能力，不宣称中间已贯通。
- 本次用户未确定的边界：只交总体 spec 和独立任务，还是交接至可派发，还是包含派发后的实际执行与总体收口；拆分原则及宽重构等例外的可接受范围。不得用上述源码/ADR代答。

## 没查的

- 不查远端 tracker，不创建、修改、关联或关闭 Issue，不启动 board、Goal、任务或 worker，不触发实际实现与验收。
- 不重新调查旧 #147 或 AesAgent Graph workbench 访谈；它们不是此次技能制作目标的自动授权来源。
- 不跑技能评测、board/selftests、模型或浏览器。本轮结果为文件与有限源码的 READ_ONLY_VERIFIED，运行闭环为 NOT_RUN；验证基建全景由宿主另行分片。
- 不决定最终 skill 命名、目标目录、整体范围、拆分算法、发布方式或迁移策略；这些需由主访谈结合用户制作目标收口。
