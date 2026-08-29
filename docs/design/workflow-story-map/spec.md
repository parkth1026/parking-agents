# workflow-story-map 设计 spec（定稿 v1.0）

- 票：parkth1026/parking-agents#159（map #147「story 级全链条工作流整合设计」最后一张子票）
- 版本：**定稿 v1.0，2026-08-29**。草案经用户评审：六项遗留问题四项已裁决、两项顺延实现 effort（⑪ 留档）；关票由主会话执行。本文不替代任何已裁决议，只做合成。
- 真源输入：map #147 正文（Destination/Decisions so far 11 条）；子票决议 #152–#158；调研报告四份（#148–#151）；本仓惯例文件（`docs/agents/issue-tracker.md`、`docs/agents/skill-release.md`、`CONTEXT.md`、`docs/adr/README.md`）；**2026-08-29 定稿会话用户裁决四项**（automated 证据分级、[x] 勾选落点、ready→handed_off 状态对、弱父子表达，见 ⑪）。
- 术语沿用 `CONTEXT.md` 既有词汇：**业务终态**（CONTEXT.md:37-39，判定强度高于界面文案/退出码）、**契约 AC**（CONTEXT.md:25-27，有显式来源、唯一判 PASS/FAIL 的依据）。
- 证据代号（沿用 #154 评论先例）：
  - **[全景]** = `docs/research/workflow-interview-web-能力全景盘点-2026-08-29.md`
  - **[深读]** = `docs/research/wayfinder-双变体与票协议深读-2026-08-29.md`
  - **[星图]** = `docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md`
  - **[路由]** = `docs/research/aes-workflow-engineering-路由与门禁思想-2026-08-29.md`
  - **[track]** = `docs/agents/issue-tracker.md`

---

## 〇、定位与总目标

**workflow-story-map 是一个独立的组合层编排技能**（#152、#157）：让用户一次 map 请求即可把一个 story 级任务走完**拆解 → 决策 → 执行 → 验收**全链条（map #147 Destination），且不重蹈「一切挤在一个会话谱系里导致上下文爆炸」的覆辙——解法是**切割谱系而非压缩上下文**（[全景]:262）。

- 新技能只拥有「story → 拆解 → 派发 → 收口对账」的路由与门禁，自己是编排器、不产出业务文件（同 workflow-interview「决定进哪个阶段、不产出文件」的编排器先例，workflow-interview/SKILL.md:11-12，经 #152 决议援引）。
- **GitHub Issues 为拆解层真源**（map/票/fog/frontier 语法继承 wayfinder，#152；[深读] c 节 11 条候选）；**interview 家族被组合**为每票/每 story 的契约真源（10 组能力零搬运，#152；[全景] 3.1 节）；**board 被组合**为执行层（#152/#153）。Goal Contract + contractDigest 做规划侧 × 执行侧的桥（#150 结论 5）。
- 设计覆盖两层载体：流程真源（map、票、门禁、档案）与 **web 交互投影层**；落地顺序真源先行、web 后置（map #147 已定边界②）。实现另开 effort（map #147 Out of scope）。
- 命名 `workflow-story-map` 已登记（#157 决议①），category=engineering（#157 决议②），与 wayfinder 并存分工：探索性规划（路线未知、纯决策）继续用 `$wayfinder`，story 级交付任务用本工作流，两工具共享同一套 map/票语法、星图同渲（#152）。

配套 ADR（`docs/adr/`，Status=已接受，2026-08-29 用户裁决）：ADR-0001 组合层落点、ADR-0002 tracker 中性票协议、ADR-0003 story 收口四条件硬门禁、ADR-0004 grill→出口融合→派发阶段模型。

---

## ①、流程链全图

五个阶段串成单向链。每阶段标输入产物 / 门禁 / 输出产物；回退路径见 ⑤。

| 阶段 | 载体与执行者 | 输入产物 | 门禁 | 输出产物 |
| --- | --- | --- | --- | --- |
| **0. story 开档** | story map issue（tracker）+ story 目录（盘上，家族 issue 目录） | 用户的一次 map 请求 | 家族 `init` 幂等（已存在只读不覆盖，[全景] A8）；map 语法继承 wayfinder（[track]:57） | story map issue（`wayfinder:map` 标签，五区正文）；story 目录 manifest/rounds 真源 |
| **1. grill（story 级一次收敛）** | 家族三阶段前两段：1-interview + 2-prototype，story 级跑一次（#155 决议①） | 用户 story 请求、仓上下文（facts 分片调查，aes-interview:32-36 协议） | 三阶段结构闸门原样零改造：done 非自报、skipped 仅 2-prototype 带 reason、needs_reinterview 打回（[全景] A1） | `context.md`、七面扫描 impact-surface、**确认版对照物＝例子池**、rounds.jsonl、story dossier 累积 |
| **2. 出口融合（拆解出口）** | 拆解发生在 prototype 收口后（#155 Q1-A：例子聚类天然产出「一簇=一票」） | 例子池 + story 上下文 | **story 级 finalize＝拆解出口闸**：story 契约 [A] 冒烟（此刻期望全红，UNRUNNABLE 是唯一要拦的）+ 残留风险对账 + 全票 digest 清单回填，跑过才允许批量建票（#155 决议⑤/Q4-A） | **一次产出两件**（#155 决议②）：story 契约（to-spec 功能位，承载 contractDigest）+ tracer-bullet 执行票带 blocked-by 边（to-tickets 功能位，票 body 内嵌自包含契约） |
| **3. 派发（frontier 门禁线）** | 每票只跑 3-contract（#155 决议①）；编排脚本打标签 | 各票分到的例子簇 | **票级 finalize＝ready-for-agent 前置闸**：冒烟挡 UNRUNNABLE（「AC 写错了」必须在派发前拦）、交接面＝票 body + contract 路径（#155 决议⑤） | 打 `ready-for-agent` 进 frontier 的执行票（只由编排脚本写入，#155 决议「单一写入者」） |
| **4. 执行（可插拔执行层）** | board 优先消化；无 board 仓退 orchestrate-worktree-loop 或单会话（#153 决议①） | frontier 上的执行票（＝issue，零转换） | board 侧现成门禁：三维 verdict、merge 门禁、GATE-acceptance（#150 结论 4） | 票的业务终态证据（runtime/GATE receipts、acceptance[]） |
| **5. 收口** | 新技能执行收口对账（#153 决议①） | 全部执行票终态 + story 契约 + 人工回写 | **story 收口四条件硬门禁**（见 ⑤） | story 合成视图档案（见 ⑥）；map Decisions 登记行（投影重算写入，见 ②）；四条件全过置 ready、用户确认后 handed_off（见 ⑤.6） |

关键点回链：

- 阶段粒度＝story 级一次 1-interview + 2-prototype、每票只跑 3-contract——需求歧义与七面扫描天然是 story 范畴，票级契约是「把例子簇分给票」不是重新发明（#155 决议①/Q1-A）。
- 阶段的 tracker 表达＝**票生命周期属性 + frontier 门禁线**：不新增阶段票型、不设 map 阶段线；票创建即契约进行中，票级 finalize 通过才打 `ready-for-agent` 进 frontier，未 finalize 的票天然不在派发面（#155 决议④/Q2-A）。
- story 级 grill 期间 map 下尚无执行票，story 进度由 story 目录 manifest 表达，map 不需要新字段（#155 Q2-A）。
- 拆解出口的 to-spec/to-tickets **融合在出口、不单独触发**；两技能本体保持原样供 ad-hoc 使用（#155 决议②）。

---

## ②、tracker 中性票协议

决议源：#154（载体与 claim 强度）、#155（单一写入者）、2026-08-29 用户裁决（弱父子表达跨 tracker 必需）。调研底座：[深读] 全文、[track]:53-62。

### 2.1 单真源与双 tracker

- **tracker issue 为单真源**，承载全部核心内容；本地只保留**可再生状态文件**（只读缓存性质，禁止持久可变本地状态）（#154 决议）。
- **GitHub 与 GitLab 双 tracker 都要支持，且两边都要星图**——票协议必须按 tracker 中性抽象设计（#154 决议）。
- **协议必需项只用三件：labels + blocked-by 依赖 + close 状态**（#154 决议）。三件在两个 tracker 上均有原生对应（[track]:57-60 是 GitHub 侧操作面；GitLab 侧等价物由实现 effort 落地）。
- **GitHub 专有特性（sub-issues API、原生 dependencies API 等）只做增强、不进协议必需项**（#154 决议）。增强项先例：GitHub sub-issues API（父子关系的 UI 聚合增强，基础表达见下条）；dependencies 不可用时回退子票正文 `Blocked by: #<n>` 行（[track]:58-59）。
- **弱父子表达 = body 行文 `Part of #<map>`，跨 tracker 必需**（2026-08-29 用户裁决，原 #159 草案遗留问题 5）：story map 与执行票的父子关系在 GitHub/GitLab 两 tracker 上都用子票正文首行 `Part of #<map>` 表达（[track]:58 既有惯例升格为协议必需）；父子 API（GitHub sub-issues）仅做增强、不进必需项。

### 2.2 tracker 状态的单一写入者

- **编排脚本是 tracker 状态唯一写入者**：`ready-for-agent`、票 close、story 收口三类写操作只走新技能编排脚本，写前对账——打 ready-for-agent 前验盘上 manifest.validation.status=valid 且 digest 与票 body 声明一致；票 close 前验 board runtime/GATE 证据；story 收口跑四条件硬门禁。SKILL.md 明文禁止其他技能/subagent 直接改这三类状态（#155 决议，同款「manifest 不许 Edit」纪律，[全景] A8）。
- 盘上家族脚本原样零改造；这是 #149 核心结论「两变体分歧在谁保证协议被做到」的采纳——选「工具机器闸门」一侧，但不绑 CI（门禁必须在无 CI、无 board 的仓也成立，#155 Q3-A 否决 B 的理由）。

### 2.3 claim 协议（弱 claim + 留痕）

- **claim = 弱 claim（assignee）+ 认领/抢票留痕评论**：认领时留一条带会话指纹的评论（session id + 时间）；抢票（改 assignee）前必须留说明评论（谁/何时/为何）——AES reclaim 人工确认三要素的 tracker 翻译（#154 决议；[深读] 候选 3、[tool] L2525-2541）。
- **放弃 token sidecar**：GitHub 上做 token 需 sidecar 文件得不偿失；星图 claimedBy 不读 assignee、执行侧互斥已由 board registry 强保证（#154 决议；[星图] §1.2）。

### 2.4 崩溃恢复：投影全量重算

- **map Decisions 投影全量重算**（sync-map 语义 tracker 化）：Decisions so far 与 ready 判定从 closed sub-issues 现算，map 不手工追加决定行；半写（票关了 map 没更新 / 票建了边没 wire）表现为「投影缺行 / 图缺边」，重算或重跑 wire 自愈（#154 决议；[深读] 候选 9）。
- 对账脚本归新技能收口职责（#153 决议连带）。frontier 是实时查询不是手维护快照（[深读] 候选 2，两版共同不变量 WF-I07）。

### 2.5 fog 幂等锚点（双写）

- map 的 Not yet specified 每条带稳定 slug（`- [F-<slug>]`，人读）；毕业出的票打 `fog:<slug>` 标签（机器查重）。毕业流程先按标签查重，已有则只补 map 删除、不建第二张（#154 决议；[深读] 候选 7——tracker 无内建幂等键必须自造，且查重必须是机械命令才真幂等）。

### 2.6 不继承与轻量约定

- **不继承 24h 时长阈值**（AES 文档-实现缺口），改采留痕抢票语义（#154 决议；[深读] 候选 10——语义未想清的不随包继承）。
- 明确不继承的 AES 设施（[深读]:119，随 #154 载体裁决生效）：claim token/文件锁体系、封闭 YAML 头与 12 命令面、`navigation` 八字段机器结构。
- 继承的写作与 HITL 约定：按名称引用不贴裸编号（[深读] 候选 11）；HITL 决策票关闭前必须有一条人类账号的确认评论（[深读] 候选 4）；withdraw 留痕不删、回退开新 issue 写 `Reopens: #<旧票>`（[深读] 候选 6；执行细节见 ⑤）。
- 票型：决策票仍是 wayfinder 原生四型（`wayfinder:research/prototype/grilling/task`，[track]:58）；执行票只有一种票型（#155 Q2-A）。

---

## ③、两级契约与 tracer-bullet 拆解判据

决议源：#152（同型复用）、#155（两处 finalize、拆解判据）、#153（contractDigest 对账锚）。

### 3.1 两级契约

| 层级 | 载体 | 角色 | finalize 挂点 |
| --- | --- | --- | --- |
| **story 契约** | story 目录（家族流程产物；其 dossier final 节即 story 契约投影，dossier.mjs:270-273） | **拆解出口产物、承载 contractDigest**——story 收口四条件「contractDigest 未变」的对账锚（#153 决议③；#155 决议⑤） | **story 级 finalize＝拆解出口闸**：[A] 冒烟 + 残留风险对账 + 全票 digest 清单回填，跑过才允许批量建票（#155 Q4-A） |
| **票级契约** | 执行票 body 内嵌（自包含，与 Goal Contract 同型） | 每票自包含验收面（board 按票派发，票要能单独交给执行器，#152） | **票级 finalize＝ready-for-agent 前置闸**：冒烟挡 UNRUNNABLE；交接指令只在退化链单会话执行时现场生成，board 派发时票 body + contract 路径即交接面（#155 Q4-A） |

- story 级 digest 需要 story 级契约承载：board 三套体系粒度不同（v3 verdict Task 级、v4 acceptance job 级、Goal Contract story 级），story 级收口最自然的挂点是 M3+M4「acceptance 全绿 + contractDigest 未变」（#150 结论 5、[星图]:149）。
- 拆解输出与 Goal Contract 同型（每票自包含验收面），A4–A7 验收链免改造复用（#152；[全景]:263）。
- 冒烟时机判据「此刻实现还没做所以期望全红」恰好定义挂点＝派发前最后一刻——往后挂（执行后）全红判读失效，往前挂（拆解前）无东西可跑（#155 Q4-A，aes-goal-contract/SKILL.md:209-215）。

### 3.2 tracer-bullet 拆解判据

- **每票＝单个全新上下文窗口装得下的纵切片、可独立验收**（#155 决议③，采纳 to-tickets 规则）；同时作为「拆解粒度与上下文预算」（map Not yet specified 块）的判据基础（#155 决议③）。
- 支撑证据：家族侧 AC>7 校验器自要求「拆成几个能独立交付的任务」（validate-goal-contract.mjs:130-131）但拆出的多件事此前无编排层接管（[全景]:222 放大器 4）——本层就是补这个缺口。
- **skipped 语义只留 story 级**（2-prototype 原语义：七面扫描落盘 + reason 进残留风险对账）；票级不开 skipped——会让「拆解漏分例子」与「真的无差异」两种状态不可区分（#155 决议/Q6-B）。票级例子不够就在票内补对照物（不是重问需求），补不出说明拆解切错了，走 story 级回退。

---

## ④、执行层组合（双层 + 可插拔执行层）

决议源：#153 决议①；调研底座 [星图]。

- **执行票＝GitHub issue（AC 同型），零转换**：拆解输出与 Goal Contract 同型（#152 已裁），执行票就是 tracker 上的 issue，board 按 issue 派发。否决「map 内执行票型」（重造 board v4 控制面，违背组合层定位）与「纯交接包不回填」（链条断裂、收口对账丢失）（#153 决议①）。
- **board 优先消化**：frontier 派发（ready-for-agent）、三维 verdict、merge 门禁、GATE-acceptance 全部现成（#153 决议①；#150 结论 4）。
  - 星图零改动复用三条件（[星图]:11）：Issue 落 board `issueRepo` 单仓 + 拆解关系用原生 blocked-by（或 body 行文）表达 + 终态用 issue close 表达。
  - eligible frontier 标签条件：`ready-for-agent` 且不带 `ready-for-human/needs-info/needs-triage/wontfix`（orchestrate.mjs:87-96，[星图]:12）——与本仓 AGENTS.md triage 五标签同源。
- **退化链**：无 board 配置的仓退 `orchestrate-worktree-loop` 或单会话执行。退化链只是换执行器，票与验收面不变（#153 决议①）。
- **新技能只做收口对账**，不管执行派发（#153 决议①）。
- verdict ↔ 契约 AC 的既有对账映射（#150 结论 5，[星图] §3）：[A] 档 ↔ automated ↔ board runtime=PASS / GATE；非 [A] 档 ↔ live/manual ↔ manualTestDebt / humanGate + [x]（勾选协议见 ⑤）。contractDigest 已实现「AC 内容变更使旧证据失效」（issue-contract.mjs:226-235），可承载 story 级「契约 AC 改动后业务终态必须重判」。

---

## ⑤、story 收口：四条件硬门禁 + [x] 人工回写 + 指针漂移模型

决议源：#153 决议②③；#155 决议（回退分层）；[路由] §2.3/指针漂移；2026-08-29 用户裁决（automated 证据分级、[x] 勾选落点、ready→handed_off 状态对）。

### 5.1 四条件硬门禁（全过才宣布 story 做完）

1. **全票 close**：story map 名下执行票全部到达终态。
2. **acceptance 全绿**：automated 档须有对应档位的证据支撑、**不自报**——证据分级见 5.2（2026-08-29 用户裁决）。
3. **contractDigest 未变**：变了→指针漂移对账（见 5.4），收口重判。
4. **非 [A] 档全 [x]**：story 契约文件中非 [A] 档（live/manual）AC 在 story 收口前必须由人勾选 `[x]`（见 5.3）。

收口门禁由新技能执行（#153 决议③）。

### 5.2 automated 档证据分级（2026-08-29 用户裁决，原遗留问题 1）

- **board 仓**：automated 档须 board runtime/GATE 证据支撑（#153 决议③原文语义）。
- **无 board 仓（含 GitLab tracker 仓）**：退为**执行票关票评论挂证据块**——「可复现命令 + 退出码 + 产物指针」，即 CONTEXT.md「可辩护」判据（CONTEXT.md:17-19：每个结论都必须有证据链——命令、退出码、产物、转录，无证据不得宣称成功）；收口脚本核验关票评论含证据块，**不自报**。
- 票 close 本身仍属编排脚本单一写入者三类写之一（②.2）；证据块随 close 评论落 tracker，进免费审计时间线（#154 载体选型所得）。

### 5.3 非 [A] 档回写 = [x] 硬门禁

- 采纳 [路由] 人工面回写协议：**勾选是「人核对通过」的唯一来源**——用户在对话里说信得过不是勾，agent 也不能替他勾（#153 决议②；[路由]:99-101 原文「人核对通过只有一个来源：文件里的那个 [x]」）。未勾全则收口门禁拒收。
- **唯一勾选落点 = story 契约文件**（contractDigest 锚定物本体；2026-08-29 用户裁决，原遗留问题 3）：票 body 的 AC 是引用非副本，勾 story 契约即算数、票内不勾——两级契约间不再存在去重问题。
- 这补上了 interview 家族只「报给用户」没有回写面的缺口（#153 决议②）。
- 档位映射：[A]↔automated↔board runtime PASS/GATE；非 [A]↔live/manual↔manualTestDebt/humanGate+[x]（#153 决议②；[星图] M1/M2）。
- **技术注记（实现须落实的推论，非新决策）**：勾选 `[ ]`→`[x]` 发生在 contractDigest 的锚定文件内，digest 计算的规范化必须排除勾选态（勾选不算 AC 内容变更），否则条件 ③ 与条件 ④ 互相锁死（一勾即 digest 变、永远收不了口）。board 先例 contractDigest 绑 AC 内容变更（issue-contract.mjs:226-235），勾选态在其口径内如何规范化由实现首票验证。

### 5.4 指针漂移模型

- 采纳 [路由] 的「在飞不爆红、收口一次重判」：上游改了在飞不报，收口那一刻一次对账（#153 决议③援引 #151；[路由]:71）。
- 判定锚：story 契约的 contractDigest（票 close 快照是对账的固定参照物，见 ⑥；重投影暴露漂移与快照留证是两件事，不互斥——#156 决议③）。

### 5.5 回退分层（三档）

1. **票级歧义**（票契约化时例子对不上）：票内能问清的当场问，票目录 rounds 落盘、asking 三档分诊照旧（#155 决议）。
2. **story 级歧义**（动了目标/范围/公共行为/验收基线）：受影响票 withdraw（close + 原因留痕），替换票开新 issue 写 `Reopens: #<旧票>`（不复活旧正文、失效历史留痕），未受影响票原样保留（#155 决议；[深读] 候选 6——GitHub 原生 reopen 会复活过期正文并抹掉「为什么关」）。
3. **执行中撞出需求歧义**：该票挂起（撤 ready-for-agent / 加 blocked-by 边指向新开的 story 级 grilling 子票），digest 漂移按 5.4 处理，重拆后收口对账（#155 决议）。

### 5.6 story map 状态对：ready → handed_off（2026-08-29 用户裁决，原遗留问题 4）

- **采纳 ready→handed_off 状态对**（[深读] 候选 5 翻译方案的正式落地）：**四条件全过 = ready（待用户确认），用户确认 = handed_off**。
- **独立状态对、不进四条件门禁**：四条件判「story 做没做完」，状态对表达「做完之后等谁点头、谁点过头」——收口语义与确认语义分层。
- 载体符合 tracker 中性协议：状态用 labels 表达（属必需项三件之一，无需新字段）；具体标签字符串候选 `wayfinder:ready` / `wayfinder:handed-off`（[深读] 候选 5 原案），随实现期 SKILL.md 定稿。状态写入归编排脚本单一写入者（②.2）。

---

## ⑥、决策档案：两级同构 + story 合成视图 + 投影时机

决议源：#156 全部四题；实现底座 dossier.mjs（家族分发的只读投影库）。

- **两级同构批准**：map 的 Decisions-so-far＝**索引层**（一行 gist + 链接）；票级决策档案＝**投影层**，由 `dossier.mjs` 从票真源投影；两级同构由**同一投影库单实现**保证——#146 已实证「单一投影实现保证同构；双实现必然漂移」，此为该架构从两载体向两层级推广，不需要新协议（#156 决议①；[全景]:264）。
- **story 全链条档案＝合成视图（无新实体）**：story 收口视图由各票 dossier + story 契约**重投影聚合**而成，真源零新增；不做第三级 story dossier 实体（两级变三级、多一份版本对账）（#156 决议②）。story 自身走家族访谈本就有自己的 dossier（final 节即 story 契约投影，dossier.mjs:270-273），合成输入全部现成。
- **投影时机＝随票 close 即投影 + story 收口时合成**：票 close 时投影该票 dossier（票终态报告，#146「收尾导出 dossier.html 并报导出路径与 dossier_digest」行为的自然延伸）；story 收口（四条件全过）时合成 story 视图（#156 决议③）。close 快照是 5.1 条件③「contractDigest 未变」对账的固定参照物；投影幂等可重算（只读库），不排斥复投。
- **web 层现投现渲消费真源**：web 直接调同一 `dossier.mjs` 从票真源/story 契约现投，两级档案都是 web 的产物而非输入（#156 决议④）。

---

## ⑦、web 交互投影层

决议源：#158 全部三项；#154（双 tracker）；#147 已定边界②（真源先行、web 后置）。

- **星图归一＝workflow-story-map web 面做通用 issue 关系星图渲染器**：读 tracker 中性三件（labels + blocked-by + close），GitHub/GitLab 天然双支持；board 星图保留为执行层专属视图——它渲染的 verdict/lane/worktree 信息本就超出 issue 关系，决策层与执行层分工符合 #157 分层单向链（#158 决议①）。否决 board 扩展双 tracker（执行编排器 charter 膨胀）与 board 星图退役（丢执行层视图）。
- **web v1＝只读投影三件**（#158 决议②）：
  1. 通用星图（双 tracker）；
  2. story 决策档案合成视图（现投现渲，#156 决议④）；
  3. 收口四条件状态面板。
- **交互放 v2，复用 workflow-interview-web 已验证协议**：结构化 response type、提交两阶段吸收、会话安全（#158 决议②；[全景] B 组能力清单）。
- **wait-submit 唤醒原语＝round-scoped 保留**：每轮会话挂自己的后台等待、吸收即终，不再钉全程单会话——与切割谱系（⑨）完全兼容，服务「单会话连续 grind」场景；纯回合模式仍是正选切割点。原语义（跨轮存活唤醒）已被 #148 判为上下文爆炸根因，废止（#158 决议③；[全景]:193）。
- 落地顺序：真源先行、web 后置（#147 已定边界②）；真源设计已为投影层预留挂点——结构化 rounds + manifest 保持可投影，后置 web 面可无伤重挂（[全景]:249）。

---

## ⑧、组合边界（分层单向链）

决议源：#152（组合关系与并存分工）、#157 决议④（description 边界原则）、#155 决议②（to-spec/to-tickets 融合位）。

| 组件 | 与 workflow-story-map 的关系 | 边界要点 |
| --- | --- | --- |
| **interview 家族**（workflow-interview / aes-interview / aes-prototype / aes-goal-contract / workflow-interview-web） | **被组合**为契约真源（10 组能力零搬运，#152） | 家族原样被调用，grilling 高效性零损失；web v2 复用其协议（#158）；实现期顺带修复 workflow-interview 零信息 description 债（#157 决议④） |
| **wayfinder** | **并存分工**（#152） | 探索性规划（路线未知、纯决策）用 `$wayfinder`；story 级交付用本工作流；共享同一套 map/票语法，星图同时渲染两者，语法同源不分裂 |
| **aes-worktree-board** | **被组合**为执行层（#152/#153） | board 优先消化、星图保留执行层视图（#158 决议①）；新技能只做收口对账 |
| **to-spec / to-tickets** | **融合位在拆解出口**（#155 决议②） | story 契约＝to-spec 功能位、tracer-bullet 票＝to-tickets 功能位；两技能本体保持原样供 ad-hoc 使用，不单独触发 |
| **orchestrate-worktree-loop** | 退化链执行器（#153 决议①） | 无 board 仓的中间档；再退为单会话 |
| **wayfinder map / 票语法** | 继承（#152；[track]:53-62） | map=索引不是 store；票型四类；fog/frontier 语义见 ② |

**description 互指原则＝分层单向链**（#157 决议④）：每个技能 description 只声明自己拥有的那一层 + 一句向上回指（谁路由自己）；同级分工（vs wayfinder）只写在组合者（新技能）一侧，被组合件不复制组合层的路由叙事——aes-interview 尾部回指先例（aes-interview/SKILL.md:5）的自然推广。

---

## ⑨、会话纪律（切割谱系）

决议源：#148 调研结论（[全景]:262）被 map #147 Decisions 采纳；#158 决议③；[深读] 候选 8；2026-08-29 用户裁决（轮次上限判据）。

- **放弃「单会话谱系跑完全程」的隐式默认**；会话预算的解法是切割谱系而非压缩上下文（#148 结论 6；[全景]:262）。
- **三处显式换会话**（[全景]:262）：
  1. **票边界**：每票一个子会话（一会话一票；research 豁免是 wayfinder 原语义，[深读] 候选 8）；派发文本现场生成（ticket-prompt 投影语义：question + 已关闭阻塞摘要 + 写入边界 + 停止条件），不留档不过期（[深读] 候选 8）。
  2. **阶段边界**：grill → 拆解 → 派发 → 收口各阶段切换时结束会话。
  3. **轮次上限**：判据＝**单轮会话预算触顶 / 轮 JSON 体积超限即换会话**，**不定数值**——由实现首票按真实负载校准（2026-08-29 用户裁决，顺延项见 ⑪）。
- **续跑三段式**（[全景] B3 继承判定）：读状态（manifest/票目录）→ 扫描吸收未消化输入（异步输入先原子落盘→逐项映射→全部成功才标记，B2 模式）→ 续跑或挂下一轮等待。磁盘真源、幂等 init、文件化门禁保证换会话零损失（[全景]:200-203、:243）。
- HITL 票每次会话先调 Skill 工具加载 `grilling` 与 `domain-modeling`（map #147 Notes 本仓约定，随语法继承）。

---

## ⑩、实现交接包（供实现 effort 的 map chart 参考）

实现另开 effort（map #147 Out of scope：编码、npm test、skill-release 五步含 web 投影层编码）。已定交接事实：

1. **命名已登记**：`workflow-story-map`（#157 决议①，登记即该票关票动作；本 spec 沿用）。组合层语义槽位有 workflow-interview 直系先例；首词分流 wayfinder、尾词宣告 map 语法继承。
2. **category=engineering**（#157 决议②）：三值允许值是既有裁决（`docs/agents/skill-release.md:23`）；本技能将是首个晋级者，先落既有体系，新桶等家族批量晋级有实例再议。设计稿 SKILL.md frontmatter 预写 `category: engineering`，五步执行留实现期。
3. **skill-release 五步指引**：按 `docs/agents/skill-release.md` 全程执行——写 category（第 1 步）→ run-tests 绿 + 五件套齐全（第 2 步）→ 跑生成器 build-release.mjs 及 --check（第 3 步）→ 核对索引自动登记（第 4 步）→ junction 干跑/重装验证 + npm test（第 5 步）。仓库脚本一律 `.mjs`（Node 内置模块、零依赖，AGENTS.md 约定）。
4. **维护 map 待随实现开档**：`workflow-story-map: story 级全链条编排技能持续维护` 一档（#100-#109 序列）随实现 effort 开（#157 决议③——维护档实体是「技能 + 五件套 + run-tests 绿」，无实现即空壳）。
5. **建议的实现切票顺序**（依赖驱动的建议，非裁决；实现 effort 的 map chart 可改）：
   1. **tracker 中性票协议 + 编排脚本地基**：三件必需项读写、单一写入者三类状态写、claim 留痕、投影重算、fog 双写锚点（② 全节；双 tracker 抽象层先于一切消费者）。
   2. **流程链前半**：story 开档 + story 级 grill 组合（家族调用零改造）+ 拆解出口（story 契约 + 建票 + blocked-by wiring，① 阶段 0-2）。
   3. **派发面**：票级 finalize → ready-for-agent 前置闸（① 阶段 3）。
   4. **执行层组合 + 收口**：board 优先对接与退化链、四条件门禁、[x] 回写、指针漂移对账（① 阶段 4-5）。
   5. **决策档案**：dossier 两级同构接线 + 随票投影 + story 合成视图（⑥）。
   6. **web v1 只读三件**（⑦）→ **v2 交互**（复用 workflow-interview-web 协议）。
   7. **发布收尾**：skill-release 五步 + 维护 map 开档（本节 2/3/4）。
6. 配套 ADR 四条（`docs/adr/` 0001–0004）已随本定稿转为「已接受（2026-08-29 用户裁决）」。
7. **实现首票需先定两件事**（⑪ 顺延项）：盘上目录布局（story 目录/票目录的路径与 slug 约定——dossier 投影与 web 现投现渲的输入面）；轮次上限数值校准（⑨ 判据已定：单轮会话预算触顶 / 轮 JSON 体积超限即换会话）。

---

## ⑪、遗留问题裁决记录（2026-08-29 定稿会话）

草案阶段列出的六项遗留问题：**四项经用户裁决**（已写入对应章节）、**两项顺延实现 effort**。此处留档备查：

| # | 问题（草案原文摘要） | 裁决 / 处置 | 落点 |
| --- | --- | --- | --- |
| 1 | 退化链下 automated 档证据的替代形态（无 board 仓没有 board 证据，凭何判全绿） | **裁决：证据分级**——board 仓须 board runtime/GATE 证据；无 board 仓（含 GitLab）退为执行票关票评论挂「可复现命令 + 退出码 + 产物指针」（CONTEXT.md「可辩护」判据），收口脚本核验评论含证据块、不自报 | ⑤.2 |
| 2 | 轮次上限的具体数值 | **顺延**：spec 记判据——单轮会话预算触顶 / 轮 JSON 体积超限即换会话，不定数值，实现首票校准 | ⑨ 第 3 条、⑩ 第 7 条 |
| 3 | 非 [A] 档 [x] 的勾选落点与去重语义 | **裁决：唯一落点 = story 契约文件**（contractDigest 锚定物本体）；票 body 的 AC 是引用非副本，勾 story 契约即算数、票内不勾（去重问题随之消失） | ⑤.3（含 digest 勾选态规范化技术注记） |
| 4 | story map 的终态表达（ready→handed_off 未被采纳或否决） | **裁决：采纳状态对**——四条件全过 = ready（待用户确认），用户确认 = handed_off；独立状态对、不进四条件门禁 | ⑤.6、① 阶段 5 |
| 5 | story map 与执行票父子关系的 GitLab 侧表达 | **裁决：body 行文 `Part of #<map>` 为跨 tracker 必需的弱父子表达**（两 tracker 都可用）；父子 API 仅增强不进必需项 | ②.1 |
| 6 | 盘上目录布局（story 目录/票目录路径与 slug 约定） | **顺延**：实现 effort 首票先定（dossier 投影与 web 现投现渲的输入面） | ⑩ 第 7 条 |

---

（完——定稿 v1.0；关票由主会话执行）
