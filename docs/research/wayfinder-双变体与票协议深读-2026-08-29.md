# wayfinder 双变体与票协议深读

- 票：parkth1026/parking-agents#149（map #147「story 级全链条工作流整合设计」子票，`wayfinder:research`）
- 日期：2026-08-29
- 方法：只读一手源（两份 SKILL.md 全文、protocol.md、record-shapes.md、workflow_tool.py 代码、upstream-parity.md、本仓 issue-tracker.md），结论逐条挂出处；live 证据取自 #147/#149 自身的 GitHub 原生字段。

## 证据基础

| 简称 | 路径 |
| --- | --- |
| [原] | `C:\Users\parking\.agents\skills\wayfinder\SKILL.md`（mattpocock 原版，用户级） |
| [aes] | `G:\GIT\AI_WorkFlow\aes-workflow\skills\engineering\aes-wayfinder\SKILL.md`（强化版） |
| [proto] | `G:\GIT\AI_WorkFlow\aes-workflow\skills\engineering\aes-using-workflow\references\protocol.md`（AES Workflow v1.3/1.4 协议） |
| [shapes] | `G:\GIT\AI_WorkFlow\aes-workflow\skills\engineering\aes-using-workflow\references\record-shapes.md` |
| [tool] | `G:\GIT\AI_WorkFlow\aes-workflow\skills\engineering\aes-using-workflow\scripts\workflow_tool.py`（5271 行，命令面见附录） |
| [io] | `G:\GIT\AI_WorkFlow\aes-workflow\skills\engineering\aes-wayfinder\wayfinder_io.py`（原子写，17 行） |
| [parity] | `G:\GIT\AI_WorkFlow\aes-workflow\skills\engineering\aes-wayfinder\references\upstream-parity.md`（15 条命名不变量对照） |
| [tp] | `G:\GIT\AI_WorkFlow\aes-workflow\skills\engineering\aes-wayfinder\references\ticket-prompt.md` |
| [track] | 本仓 `docs/agents/issue-tracker.md`（GitHub tracker 现状） |

血缘与差异分类：[aes] 头部自报 `metadata: {upstream: "mattpocock/skills:wayfinder"}`；[parity] 把 15 条不变量按「等价翻译 / Tracker 适配 / AES 加严 / AES 放宽」四类登记（[parity] L29-34），其中 Tracker 适配 3 条（WF-I01/I02/I14）、AES 加严 6 条（WF-I04/I06/I08/I10/I12/I15）、登记在案的放宽 2 条（research 可路由专门执行器、主会话可批量关 research 票，[parity] L36-37）。这张表本身就是官方的差异自白，本报告逐项验证了其中关键条目。

安装面：`skills/engineering/aes-workflow-bundle.json` 列 15 个技能，是 `install.ps1` 的输入，装时校验一次、装后不再读（[proto] L823）；写入模块 [io] 放在 aes-wayfinder 技能目录里，由 [tool] 跨技能 `importlib` 加载（[tool] L1907-1913）——技能间存在代码级依赖。

---

## a) 两变体逐项对比

### 总体定位

- **原版**：把「决定档案」放在人类已有的工作表面（issue tracker）。map 是 tracker 上一个带 `wayfinder:map` 标签的 issue，票是其 child issue（[原] L21）；纪律靠技能文本约束 agent 行为，tracker 自带可视、历史与并发。
- **强化版**：把 agent 工作流当作要审计的生产系统。ticket 文件是「开放问题、认领和答案的唯一正本」，map、state.json、Console 只存索引或派生结果（[proto] L208-209）；规则由工具管，「想跳过检查只有一条明写出来的路」（[proto] L11）。

### 对比表

| 维度 | 原版（用户级） | 强化版（aes-wayfinder） | 取舍 |
| --- | --- | --- | --- |
| **map 语义** | 单 issue，标签 `wayfinder:map`，是 canonical artifact（[原] L21）；但只是索引不是仓库——决定正文只住票里，map 只写一行 gist + 链接（[原] L23）；open 票不进正文，靠 query 找（[原] L29）；五区：Destination / Notes / Decisions so far / Not yet specified / Out of scope（[原] L31-53） | `workflow/<任务词组>/wayfinder.md`，五区同构（目的地/说明/已有决定/尚未明确/范围外，[aes] L61-67）；头部 `state` 取 `exploring/blocked/ready/handed_off`，`navigation` 必含八字段（[proto] L184-195）；map 不复制开放票的问题、答案、claim、token；领域状态由 fog、开放票、认领和 Artifact 实时计算，禁止手写快照（[aes] L69-70） | 同一「map=索引」不变量（WF-I01）。差异在正本层级：原版正本是 tracker（map 是其中一员的权威表述），AES 正本是 ticket 文件（map 进一步降级为派生索引）。AES 额外禁止目的地被访谈直接改写——目的地变化属契约变化，必须停下请用户确认（[aes] L71）；原版只说重画目的地=新 effort（[原] L99），无确认门禁 |
| **ticket 形状** | child issue，正文就是一个 `## Question`（[原] L59-63）；尺寸判据「一个 100K token 会话」（[原] L57）；`wayfinder:<type>` 标签四类：research/prototype/grilling/task（[原] L65）；答案不进正文，解决时以 resolution comment 落地（[原] L71） | 独立文件 + 封闭 YAML 头约 30 个字段（[proto] L216-252，校验见 [tool] L2886-2958）：question/options/decision/decision_reason/resolution_summary、各类 artifact 引用、claim 四件套、withdrawn/out_of_scope 原因等；一票一问（WF-I03），完整答案只在 ticket 保存一次（[aes] L52-53）；被否候选连同否决理由保存在 `options`（[tool] L2922-2929：rejected 必须带 reason） | 原版用最小形状换人人可写；AES 用封闭 schema（多一个字段就拒，[proto] L149、[tool] L2896）换机器可判定。被否候选留档是 AES 独有：为「重开旧决定」和 Console 残枝可视化（[aes] L106-107）保留了证据 |
| **生命周期** | 两态：open（assignee 即 claim）→ closed。没有 withdraw；后续答案使票失效时的处置是「update or delete those tickets」（[原] L126）；误入范围的票：close + Out of scope 一行留痕，不进 Decisions so far（[原] L101） | 五态：`open → claimed → resolved / out_of_scope / withdrawn`（[shapes] L190，[tool] L89）；release 带 token 与原因回到 open（[tool] L2513-2522）；scope-out/withdraw 都必须写原因（[tool] L2544-2557） | AES 把原版的「closed」一个终态拆成三个可判定终态：resolved（走过路线）、out_of_scope（边界外）、withdrawn（失效）。frontier 的解阻塞集合是三者的并集（[tool] L2367），语义精确到「被撤回的阻塞票也算解除阻塞」 |
| **withdraw / reopen** | 无此协议。closed 票永不回 frontier（[原] L101）；失效票可被 update 或 delete（[原] L126）——历史可被抹掉 | `wayfinder-withdraw` 保留文件和原因，不能删除（[aes] L103）；重开不复活旧票：创建新文件，`reopened_from` 只写旧 `wt_` ID，旧票不改回 open（[aes] L104，[proto] L212）；`reopened_from` 不参与排序与环检测，重开旧决策不会把当前图变成环（[proto] L197-198） | AES 的设计动机是审计：决定的失效历史本身是证据。原版允许 delete 是轻量取向，代价是「为什么放弃」会丢失 |
| **fog 毕业** | fog=能感到但写不准的问题；判据是「现在能否把问题说准」而非「能否回答」（[原] L88）；不预切 fog 成票——一块 fog 可能毕业成几张票或零张（[原] L91）；解决票后把现在可表述的 fog 逐张毕业成新票，并从 Not yet specified 清除（[原] L126）；范围外永不毕业（[原] L99） | 语义相同（WF-I09，[aes] L98）；工程化：`wayfinder-graduate-fog` 建票必须带 `source_fog_id` 并从 map 删原 fog 行，同一事项不能同时留在 map 和票（[aes] L98-99）；**幂等**：建票后进程退出的场景，重跑命令发现已有同 `source_fog_id` 的票就只补 map 删除，不建第二张（[tool] L2599-2603 注释原文：「可重跑：如果第一次进程在建票后退出，这次只补 map 删除」） | 同一语义，AES 补了崩溃安全。这是把原版「毕业」从一次性手工动作变成可重试事务的关键一步 |
| **claim** | assignee 即 claim：开工前先把票 assign 给自己，让并发会话跳过（[原] L67，WF-I08）；「open 且无 assignee」=未认领，是 frontier 三条件之一 | `wayfinder-claim`：文件锁内重读票、比对摘要（`ticket_stale`）、复查 frontier（`ticket_not_frontier`）、写入 assignee/claim_session/claimed_at + token 摘要；原 token 只返回给认领会话（[aes] L86-87，[tool] L2454-2473）；session 由参数 > 环境变量 `AES_WAYFINDER_SESSION` > 新 `ws_<ULID>` 解析（[tool] L2025-2031） | 原版 claim 是社交信号（tracker 上人人可见、但无强制力）；AES claim 是带凭证的互斥（token 原文不落盘，只存 sha256 摘要，[shapes] L191）。代价：AES 的 token 对人不可见，claim 状态必须再靠工具查询 |
| **并发** | 预期用户并行跑 unblocked 票，「expect other sessions to be editing the tracker concurrently」（[原] L128）；并发正确性完全托付给 tracker 平台 | 双层锁：session 锁（`.wayfinder-session-<safe>` 文件）+ 票文件锁（O_CREAT\|O_EXCL，写 pid，10 秒等待超时 `ticket_lock_timeout`），resolve 时先 session 锁再票锁（[tool] L2034-2046、L2417-2419、L2482-2483）；research 子会话不能写 map/ticket，主会话可代领，`claim_issued_by_session` 记主会话（[aes] L90-91，[tool] L2468）；环检测防 wiring 死锁（[tool] L2435-2451、L2560-2576） | 原版依赖平台串行化（GitHub API 单条写原子）；AES 自建内核级互斥。但 AES 的锁是本机的——多机/网络盘不安全，其官方答案是「多人=物理隔离，一个任务一个 worktree，不做锁」（[proto] L387-389），即把跨机并发问题推给「不要并发」 |
| **恢复** | 未定义（tracker 自带完整历史，误操作可 revert） | 三件套：① 原子写 tmp+`os.replace`（[io] L13-17）；② resolve 已写票、map 摘要未写就崩溃 → 校验器报漏索引，`wayfinder-sync-map` 从已解决票补一行（[aes] L123）；③ fog 建票后退出 → `source_fog_id` 幂等重跑（[aes] L124） | AES 明确识别了两个崩溃窗口并各自给了对账手段。原版的等价物是 GitHub 的编辑历史，恢复靠人翻 timeline |
| **reclaim** | 无此概念（assignee 可被任何人改） | `wayfinder-reclaim` 只接受人工确认旧会话已结束：`--confirmer`、`--confirmed-at`、`--reason` 三者必填（`human_confirmation_required`），签发新 token，`reopen_reason` 记录确认者与时间（[tool] L2525-2541）；claim 不按固定时长自动接管，超过 24 小时只显示警告（[aes] L94） | AES 把「抢票」变成了需要留痕的人工动作。注意：**24h 警告只存在于 [aes] L94 的文本，workflow_tool.py 全文没有任何 `claimed_at` 与阈值的比较**（`claimed_at` 仅出现于写入与必填校验：[tool] L97、L2469、L2538、L2942；tests 目录 grep `小时|hour` 无命中）——文档先行、实现缺席，继承前需先裁决语义 |
| **门禁 ready→handed_off** | 无状态机。停止是散文级判据：「想直接做 work 的冲动通常就是你已到图边缘、该 hand off 的信号」（[原] L13） | map `state` 四值；写 `ready` 需五条件全满足：影响路线的决定都有结论、开放和认领票已清理、领域完成条件有 Artifact 证明、无未解决阻塞、交接包列出证据/延期项/受影响记录（[aes] L117-118）；`ready` 只表示等待用户确认，不能自动调下游（[aes] L118，[proto] L201-203）；用户确认后才写 `handed_off`；`sync-map` 在无剩余 fog 且无 open/claimed 票时自动置 ready 并填 handoff 默认值（[tool] L2656-2661） | 原版把「何时停」交给判断；AES 把它变成状态机 + 机器强制。这是两版最深的分歧，直接对应 story 链条的「决策→执行」切换点 |
| **收口拦截** | 无（wayfinder 之外没有下游流程概念） | `finish-check`：有 ticket 目录 + map 且 Work Item 未 done/cancelled 时，`state != handed_off` 或 `handoff.confirmation != confirmed` 即报 `wayfinder_handoff_required`，拒绝收口（[tool] L1683-1693） | AES 用下游门禁反向锁死上游：图没交接完，任务不许收口。原版没有链条，无从谈起 |
| **停止与交接（票级）** | 一会话最多解决一张票，research 例外（[原] L105）；chart 是一会话的活，不解决任何票（[原] L116） | 同一约束机器化：非 research 票，同 session 已有一张 resolved 即拒（`session_resolution_limit`，[tool] L2491-2501）；research 批量收尾需独立测试（[aes] L93，[parity] L36-37 登记为放宽）；每类型有固定停止条件文本（[tool] L2679-2685：AFK=只返证据包、HITL=等用户确认 Artifact、task=不碰生产代码）；HITL 票（prototype/grilling）关闭必须带 `human_confirmation_artifact_id`（[tool] L2489-2490） | 同一「上下文预算」不变量。原版靠 agent 自律；AES 靠 resolve 时的机器检查。research 豁免两版一致——这是分布式拆单里唯一允许批量的一类 |
| **派发** | chart 完即并行发射 research 子 agent，落在 throwaway `research/<name>` 分支（[原] L115） | `wayfinder-ticket-prompt` 只读投影：从当前 question、已关闭阻塞票摘要、写入边界、executor 和停止条件现场生成派发文本，不写文件；只有 open 且在 frontier 的票可生成（[proto] L274-275，[tp] L5-17，[tool] L2668-2696） | AES 把「给子会话的开工说明」标准化成投影而非存储——派发文本永远反映票的最新状态，不会过期 |
| **HITL 边界** | 社交约束：HITL 票只能通过真人交换解决，「自答自己问题的 grilling agent 已经坏了」（[原] L75） | 机器约束：resolve 与 validate 双层检查 prototype/grilling 的 `human_confirmation_artifact_id`（[tool] L2489-2490、L2950-2951）；AFK 会话只取 `interaction: afk` 的票，无可做票时报告「剩余 frontier 需要人工参与」（[aes] L84） | WF-I06 在原版是格言、在 AES 是闸门。story 链条若要机器化，这是必经改造 |
| **Chart 行为** | 六步：定目的地（grilling+domain-modeling）→ 广度盘雾 → 无雾即停不建图 → 建 map → 建票后第二遍 wire（issue 要先有 id 才能互引，[原] L114）→ 发射 research 子 agent → 停（[原] L111-116） | Chart 从 Work Item 契约派生目的地；只启动允许的 research claim；不替普通票写答案、不关闭普通票；无 fog 停止（[aes] L111-112） | 流程同构（WF-I11/I12）。原版明确记录了「create-then-wire 两遍」是 issue 载体的固有约束；AES 的 wire 命令带自依赖与环检测（[tool] L2560-2576） |
| **冲突处理** | 未定义 | 两个结果冲突时保留双方证据，把路线标 `blocked`，新增 `adjudication` 类型不属自动派发（[aes] L126，[proto] L201） | AES 独有：决策冲突被显式建模为需要人工裁决的停机状态 |

---

## b) 载体分析：GitHub Issues 原生 vs 本地文件

### GitHub Issues 原生（原版的选择）

**解决了什么**

1. **frontier 的人机共读可视**：原生 dependencies 在 tracker UI 里直接渲染阻塞图——原版明说这是「essential：让人类不开 map 就看见什么可拿」（[原] L69）。live 证据：#147 头部显示 `sub-issues: 8, completed: 0/8`，#149 显示 `parent: #147` 与 `blocking: #154, #152`，全部是 GitHub 原生字段，零工具。
2. **零工具零安装**：协作者只需 `gh` 或浏览器；不用 checkout、不用 Python 工具链。
3. **免费审计**：每次编辑有时间线、作者、时间戳；误操作可查可 revert。
4. **跨机器跨会话**：无本地状态，天然多人。
5. **单条写原子性**：API 串行化，单条 edit/comment 不会撕裂。

**牺牲了什么**

1. **claim 弱互斥**：assignee 是建议性的，任何有权限者可改可抢，无 token 凭证。
2. **无跨 issue 事务**：建票与 wire 必须两遍（[原] L114 自认）；「票关了、map 指针没追加」的崩溃窗口没有内建对账。
3. **票形无机器校验**：body 是自由 markdown，一票一问、HITL 边界、必填原因全靠自律。
4. **无会话身份**：「一会话一票」不可机器强制。
5. **在线依赖与 rate limit**；离线不可用。
6. **无幂等锚点**：fog 毕业没有 `source_fog_id` 的等价物，重试可能双开票。

### 本地文件（强化版的选择）

**解决了什么**

1. **真互斥**：O_EXCL 锁文件 + 10 秒超时（[tool] L2034-2046）+ claim token（原文只发认领者、盘上只有 sha256 摘要，[tool] L2466-2473）+ resolve 时 `secrets.compare_digest` 恒时比较（[tool] L2487-2488）。
2. **崩溃恢复**：原子写（[io] L13-17）+ `sync-map` 对账（[tool] L2627-2665）+ `source_fog_id` 幂等（[tool] L2599-2603）。
3. **机器门禁**：封闭 schema（[tool] L2886-2958）、HITL 缺确认拒关（[tool] L2489-2490）、一会话一票（[tool] L2491-2501）、收口拦截（[tool] L1683-1693）、环检测（[tool] L2435-2451）。
4. **离线、git 可 diff、无 rate limit、有会话身份**（`AES_WAYFINDER_SESSION`）。

**牺牲了什么**

1. **人类可视性**：本地 markdown 无 UI，被迫建 Console 投影层（[aes] L106-107 的残枝折叠即 Console 功能；`console/` 目录含 export.py、template.html、bundle.js）——原版用原生 UI 免费得到的东西，AES 要自己造。
2. **每票成本高**：约 30 个头部字段 + 12 条命令 + 封闭协议版本（`ticket_protocol_mismatch` 拒旧写新，[tool] L2891-2895）；票 ID 解析还要处理同名歧义（[tool] L2005-2011）。
3. **多机不安全**：锁与 env 都在本机；官方并发答案是任务级 worktree 物理隔离（[proto] L387-391），等于放弃跨机票级并发。
4. **协作者门槛**：必须装工具链才能参与。
5. **文档先行缺口**：24h 警告只在 SKILL.md，未实现（见上文 reclaim 行）。

### 一句话取舍

原版用「tracker 原生可视 + 社交纪律」换零成本接入，牺牲机器强制；AES 用「工具强制 + 凭证互斥」换可审计可恢复，牺牲轻量与人直接可视（必须再造投影层）。两者在 15 条不变量上有 6 条完全等价、3 条仅换载体、6 条 AES 加严（[parity] L9-25）——分歧不在「做什么」（拆票、frontier、fog、claim 的语义两版一致），而在「谁保证它被做到」（tracker 平台 + agent 自律 vs 本地工具 + 机器闸门）。

---

## c) 「全链条工作流应继承的协议」候选清单

排序按对 #147 的价值。兼容性列针对本仓现实：tracker 为 parkth1026/parking-agents GitHub Issues，操作面已在 [track] L53-63「Wayfinding operations」定义（sub-issues、原生 dependencies、assignee claim、comment+close resolve），且 map #147 已按此运行。

| # | 候选协议 | 来源 | 继承理由 | GitHub Issues 兼容性 |
| --- | --- | --- | --- | --- |
| 1 | **map=索引、决定正文只住票里**（WF-I01） | 两版一致（[原] L23；[aes] L69） | 防止 map 膨胀成第二正本是上下文预算的根基；#147 的 fog「决策档案与 map Decisions 的分层」正等这个判据 | 完全兼容，已在运行：map 正文一行 gist+链接，sub-issue 持正文 |
| 2 | **frontier 是实时查询不是手维护快照**（三条件 open+无阻塞+未认领；WF-I07） | 两版一致（[原] L69；[aes] L75-84；[tool] L2371-2410） | 消灭「看板漂移」这类故障；AES 连 map 上的领域快照都禁手写（[aes] L70） | 兼容：`gh issue list` + `issue_dependencies_summary.blocked_by` + assignee 即可算（[track] L60 已写成操作） |
| 3 | **claim 是会话第一笔写、开工前先认领**（WF-I08） | 原版 assignee（[原] L67）；AES token 互斥（[aes] L86-87） | 并发会话跳过已占票的最小机制 | 继承不变量、放弃 token：GitHub 上做 token 需 sidecar 文件，得不偿失；`--add-assignee @me`（[track] L61）已是本仓约定，可加「claim 评论带会话指纹」做轻量审计 |
| 4 | **HITL 票关闭需真人确认凭证**（WF-I06） | 原版为格言（[原] L75）；AES 为机器门禁（[aes] L55；[tool] L2489-2490） | story 链条里 grilling/prototype 的结论必须来自真人，这是「决策」段的信用基础 | 可翻译：约定 prototype/grilling 票关闭前必须有一条人类账号的确认评论（或 `needs-human-confirmation` 标签转移）；低成本起步=协议文本，进阶=小脚本扫评论作者 |
| 5 | **ready→handed_off 状态对 + 下游收口拦截** | AES（[aes] L117-119；[proto] L201-203；[tool] L1683-1693） | 地图走完 ≠ 自动进执行；用户确认是链条上唯一人工闸。#147 fog「验收回填与 story 收口协议」需要这对状态做对账终点 | 可翻译：map issue 上用标签 `wayfinder:ready` / `wayfinder:handed-off`；story 级收口检查（票全关 + map handed-off）可脚本化 |
| 6 | **withdraw 留痕不删、reopen 开新票不改旧票** | AES（[aes] L103-104；[tool] L2552-2557） | 决定的失效历史是证据；GitHub reopen 会复活过期正文并抹掉「为什么关」 | 高度兼容：closed issue 天然留痕；重开=新 issue 正文写 `Reopens: #<旧票>`（reopened_from 的等价物）；原版没有此协议，纯增益 |
| 7 | **fog 毕业带幂等锚点（source_fog_id 语义）** | 原版 fog 语义（[原] L84-93）+ AES 幂等实现（[tool] L2599-2603） | 建票后崩溃/重试不双开票；网络操作（gh api）比本地写更容易失败，幂等更重要 | 需补一个约定：map 的 Not yet specified 每条写入时带稳定 slug（如 `- [F-<slug>]`），毕业命令先查是否已有同锚点票再创建——GitHub 无内建幂等键，锚点必须自己造 |
| 8 | **一会话一票（research 豁免）+ ticket-prompt 式派发投影** | 原版（[原] L105、L115）；AES（[tool] L2491-2501、L2668-2696；[tp] 全文） | 这正是 #147 用户痛点的解药：每票一个子会话、派发文本现场生成（question+已关闭阻塞摘要+写入边界+停止条件）、不留档不过期——子会话上下文被钉死在票内 | 派发模板可直接改造为从 issue 生成；「一会话一票」无 session 身份不可机器强制，用「每票派一个 sub-agent」的执行模式近似 + 技能文本约束 |
| 9 | **Decisions 索引可从已关票全量重算（sync-map 语义）** | AES（[aes] L123；[tool] L2627-2665） | 把「关票后追加 map 指针」从易丢的手工步骤降级为可再生的投影；GitHub 侧的崩溃窗口（票关了 map 没更新）正好用它对账 | 高度兼容：从 map 的 closed sub-issues 全量重建 Decisions so far 是一条纯读+单写的 gh 脚本；ready 判定（无 open/claimed 子票+无剩余 fog 行）同源 |
| 10 | **24h 陈旧 claim 警告——先裁决再继承** | AES SKILL.md（[aes] L94），**工具与测试均未实现**（[tool] 全文无 `claimed_at` 阈值比较） | 防止 assignee 挂死的票堵住 frontier；但连 AES 自己都没落地，说明语义未想清（阈值？动作？） | 实现便宜（`gh issue list --state open` 加 assignee+时间过滤）；但建议作为独立小决定过 grilling，不随包继承 |
| 11 | **按名称引用、不贴裸编号**（WF-I04） | 原版（[原] L17）；AES 加严（[parity] WF-I04） | 长调研链里 `#42,#43,#44` 不可读；名称包链接、编号藏在里面 | 兼容良好；纯写作约定，成本为零 |

明确**不**建议继承的：AES 的 claim token/文件锁体系（GitHub 无对应物，强行移植需要 sidecar 状态，违背载体选型）；封闭 YAML 头与 12 命令面（属于本地文件载体的配套设施，GitHub 上 issue 正文即结构）；`navigation` 八字段机器结构（[proto] L184-195，其 nodes/edges 与 GitHub 原生 dependencies/sub-issues 重复，双写必然漂移）。

---

## 附录：workflow_tool.py 的 wayfinder 命令面（实测读码）

工具全命令约 40 条（[tool] L5011-5145 注册），通用面含 id/short-id/digest/raw-digest/contract-digest/change-digest/snapshot/check-snapshot/discover/resolve/status/finish-check/validate/commit-guard/msg-check/install-hooks/merge-check/todo-check/merge-verify/handoff-context/handoff-verify/chain/index/sync-digests/verify/worktree-add/list/remove/unlink；wayfinder 专属 13 条（[proto] L257-272 十二公开命令 + ticket-prompt 投影）：

| 命令 | 关键参数（[tool] L5089-5145） | 强制校验（实现行号） |
| --- | --- | --- |
| `wayfinder-map-create` | `--work-item`（必）、`--destination`、`--fog-id`（可多）、`--migrate-from` | 已有 map 拒绝（`map_exists`，L2177） |
| `wayfinder-ticket-create` | `--work-item/--title/--type/--question`（必）、`--interaction`（默认 afk）、`--executor/--frontier-order/--domain-id/--source-fog-id/--reopened-from` | 类型/interaction 枚举（L2319-2321） |
| `wayfinder-ticket-wire` | `ticket`、`--blocked-by`（多值） | 重复、自依赖、悬空引用、成环全拒（`ticket_dependency_cycle`，L2560-2576） |
| `wayfinder-frontier` | `--work-item`、`--interaction` | 只输出 open+无 assignee+解阻塞的票，按 frontier_order/created_at/id 排序（L2371-2410） |
| `wayfinder-claim` | `ticket`、`--assignee`（必）、`--session/--expected-digest/--issued-by-session` | 锁内查摘要（L2462）、查 frontier（L2464）、签发 token（L2466） |
| `wayfinder-release` | `ticket`、`--claim-token/--session/--reason`（全必） | token+session 恒时比较（L2517） |
| `wayfinder-reclaim` | `ticket`、`--confirmer/--confirmed-at/--reason/--assignee`（全必） | 只对 claimed 票；人工确认三要素（L2528-2533） |
| `wayfinder-resolve` | `ticket`、`--claim-token/--session/--decision`（必）、`--decision-reason/--resolution-summary/--resolution-artifact-id/--evidence-artifact-id/--human-confirmation-artifact-id` | session 匹配、token 匹配、HITL 确认、一会话一票（L2485-2501） |
| `wayfinder-scope-out` | `ticket`、`--reason`（必） | 原因必填（L2545-2546） |
| `wayfinder-withdraw` | `ticket`、`--reason`（必） | 原因必填（L2553-2554） |
| `wayfinder-graduate-fog` | `--work-item/--fog-id/--title/--type/--question`（必）、`--interaction/--domain-id` | fog 必须存在、幂等重跑（L2581-2608） |
| `wayfinder-sync-map` | `--work-item`（必） | 重建已有决定区；条件满足自动置 ready（L2627-2665） |
| `wayfinder-ticket-prompt` | `ticket` | 只对 open+frontier 票生成；含类型化停止条件（L2670-2696） |

票校验器（`validate_wayfinder_ticket`，L2886-2958）逐项：协议版本、封闭字段集、wt_/wi_/ar_ ID 格式、frontier_order 整数、四类型/两 interaction/五状态枚举、title+question 必填、options 三态（rejected 必带 reason）、claimed 必带 claim 四件套、resolved 必带 decision+session+时间、HITL 必带确认 Artifact、有 rejected 候选必带 decision_reason、out_of_scope/withdrawn 必带原因。路径校验强制 `wayfinder-tickets/<可读名称>.md` 且文件名不得含 ID/哈希/日期（L3011-3015）。

## 遗留问题（供 map 后续票参考）

1. **24h 警告文档-实现缺口**（[aes] L94 vs [tool] 全文）：若全链条工作流要采納陈旧 claim 处理，需先定义阈值与动作，并让实现与文档同时落地——AES 的教训是只写了文档。
2. **AES 的跨技能代码依赖**（[tool] L1907-1913 动态加载 [io]）：技能间通过 importlib 共享代码，卸载/升级单个技能会破坏另一技能——本仓若做技能族，共享逻辑应放显式共享位置。
3. **本地锁的多机局限**：AES 用「任务级 worktree 物理隔离」回避了跨机票级并发（[proto] L387-391）；GitHub 载体天然多机，反而没有这个问题——这是载体选型对协议形状的反向塑造，值得在「星图复用与 verdict 对账」票里一并考虑。
