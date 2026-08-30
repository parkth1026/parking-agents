# Issue #147：GitHub 真实数据分片

> 抓取时间：2026-08-30（只读 GitHub API / `gh`）。
>
> 范围：`parkth1026/parking-agents#147`。本文件把 API 返回值、基于它的有限推论、以及 API 无法提供的领域状态分开；它不是用户裁决，也不覆盖后续设计访谈的决定。

## Direct fact（GitHub 当前返回）

### 票本身

| 字段 | 值 |
| --- | --- |
| URL | <https://github.com/parkth1026/parking-agents/issues/147> |
| number / database id | `147` / `5281202529` |
| 标题 | `story 级全链条工作流整合设计` |
| state / state reason | `CLOSED` / `completed` |
| 创建 | `2026-08-28T18:37:40Z` |
| 关闭 / 最后更新 | `2026-08-29T04:18:31Z` / `2026-08-29T04:18:31Z` |
| author | `parkth1026`（GitHub User；非 bot） |
| labels | `wayfinder:map` |
| assignees | 空数组（未分配） |
| milestone | `null` |
| issue type | `null` |
| parent | `null` |
| project items | 空数组 |
| locked | `false`；`active_lock_reason: null` |
| comments | 1 条 |
| native dependency summary | `blocked_by: 0`，`blocking: 0` |
| GraphQL relation | `blockedBy.totalCount: 0`，`blocking.totalCount: 0` |

### 原始正文

```markdown
## Destination

一套 story 级全链条工作流的设计定稿（spec + 必要 ADR）：让用户一次 map 请求即可把一个 story 级任务走完**拆解 → 决策 → 执行 → 验收**全链条，且不重蹈「一切挤在一个会话谱系里导致上下文爆炸」的覆辙。设计覆盖两层载体：流程真源（map、票、门禁、档案的领域模型与 CLI/对话载体）与 **web 交互投影层**；落地顺序真源先行、web 后置。实现另开 effort，不在本图内。

## Notes

- 领域：agent 工作流技能整合设计。HITL 票每次会话先调 Skill 工具加载 `grilling` 与 `domain-modeling`；研究票加载 `research`。
- 优点来源清单（整合的对象，不是被改造的对象）：wayfinder（用户级）的分布式 issue 拆单/临时知识库/fog-frontier-claim；workflow-interview 家族的 grilling 方法论、三阶段门禁、Goal Contract、决策档案；aes-worktree-board 的 Issue 关系星图与三维 verdict；aes-workflow/skills/engineering 的 14 技能路由与门禁思想。
- 已定边界（chart 会话与用户敲定；② 于 2026-08-29 用户修订）：① 终点是设计定稿，实现另开 effort；② 设计定稿**包含 web 交互投影层的设计**——总目标覆盖两层载体，落地顺序仍真源先行、web 后置（两载体产物同构的架构见 #146）；③ 整合落点不预设——升级 interview 家族 / 独立新技能 / 强化 wayfinder，由图上 grilling 票裁决。
- 本仓约定：tracker 为 parkth1026/parking-agents GitHub Issues，操作见 `docs/agents/issue-tracker.md`；调研产物落 `docs/research/<slug>-<date>.md`（不切分支、不建 worktree）；结论一律挂证据（文件行号、命令输出、issue 链接）。
- 用户核心痛点：workflow-interview-web 的 grilling 与全局掌控高效，但拆解能力弱——大部分工作在一个 session 里执行，story 级任务上下文爆掉进傻子区域；wayfinder 的分布式拆单正是解药。

## Decisions so far

- [定稿：workflow-story-map 设计 spec + ADR 撰写](https://github.com/parkth1026/parking-agents/issues/159)：spec.md 定稿 v1.0（docs/design/workflow-story-map/）+ ADR 0001-0004 已接受；定稿会话补裁四项（automated 证据分级 GATE＞命令+退出码、[x] 单点勾选 story 契约且 digest 排除勾选态、ready→handed_off 状态对、Part of #<map> 跨 tracker 必需弱父子）；轮次上限数值与盘上目录布局顺延实现首票。实现 effort 另开 map，交接包在 spec ⑩。
- [裁决：web 投影层与星图归一](https://github.com/parkth1026/parking-agents/issues/158)：story-map web 面做通用 issue 关系星图渲染器（双 tracker，读 labels+blocked-by+close），board 星图保留执行层视图（分层单向链）；web v1 只读三件（星图+档案合成视图+收口状态面板），交互 v2 复用 workflow-interview-web 协议；wait-submit 原语 round-scoped 保留（每轮挂等待、吸收即终，废止跨轮钉会话）。
- [裁决：票载体与 claim 强度](https://github.com/parkth1026/parking-agents/issues/154)：tracker issue 单真源（GitHub+GitLab 双 tracker 双星图），协议必需项仅 labels+blocked-by+close 三件，GitHub 专有特性只做增强；本地仅可再生状态文件；弱 claim+认领/抢票留痕（弃 token）、Decisions 投影全量重算自愈、fog 双写幂等锚点（F-slug+fog:slug 标签）、不继承 24h 阈值改留痕抢票。
- [裁决：三阶段门禁与 map 票流融合](https://github.com/parkth1026/parking-agents/issues/155)：grill→出口融合→派发——story 级 grill 一次收敛；拆解出口一次产 story 契约（to-spec 位）+ tracer-bullet 票带 blocked-by（to-tickets 位，单窗口纵切=拆解粒度判据）；票级 finalize=ready-for-agent 前置闸、story 契约承载 contractDigest；阶段表达=票生命周期属性+frontier 门禁线；脚本=状态单一写入者；回退分层（票内问清→withdraw+Reopens 新票→执行中指针漂移）；skipped 只留 story 级。
- [裁决：决策档案分层](https://github.com/parkth1026/parking-agents/issues/156)：两级同构批准——map Decisions=索引层、票级 dossier=投影层、同一 dossier.mjs 保证同构；story 全链条档案=合成视图（各票 dossier+契约重投影聚合，零新增真源）；随票 close 即投影、收口时合成；web 层现投现渲消费真源。
- [裁决：新编排技能命名与发布](https://github.com/parkth1026/parking-agents/issues/157)：命名 workflow-story-map（组合层先例+分流 wayfinder+宣告 map 语法）；category=engineering（首个晋级者落既有体系）；维护 map 随实现开档（关票即登记）；description 互指=分层单向链。
- [裁决：执行与验收的挂载架构](https://github.com/parkth1026/parking-agents/issues/153)：双层+可插拔执行层——执行票=GitHub issue（AC 同型），board 优先消化、无 board 仓退 orchestrate-worktree-loop/单会话，新技能只做收口对账；非 [A] 档 [x] 硬门禁（勾选=人核对通过唯一来源）；story 收口四条件：全票 close + acceptance 全绿（automated 须 board 证据）+ contractDigest 未变（漂移则收口重判）+ 非 [A] 全 [x]。
- [裁决：整合能力落点](https://github.com/parkth1026/parking-agents/issues/152)：独立新编排技能（组合层）——GitHub Issues 为拆解层真源（wayfinder 语法），interview 家族被组合为契约真源（10 组能力零搬运），board 被组合为执行层，新技能只拥有路由与门禁；拆解输出与 Goal Contract 同型，验收链免改造复用。wayfinder 并存分工：探索规划用 $wayfinder、story 交付用新工作流，共享 map/票语法星图同渲。
- [调研：wayfinder 双变体与票协议深读](https://github.com/parkth1026/parking-agents/issues/149)：两变体分歧不在语义在执行者——拆票/frontier/fog/claim 语义一致，分的是「谁保证协议被做到」（tracker 平台+agent 自律 vs workflow_tool 机器闸门）；载体互补——GitHub 买到人机共读可视与免费审计、牺牲 claim 互斥，本地文件买到锁+token+原子写、牺牲人类可视；协议继承候选 11 条（优先：map=索引、frontier 实时查询、claim 先于开工但放弃 token、HITL 人类确认评论、ready→handed_off+收口拦截）；fog 毕业需自带幂等锚点（GitHub 无内建幂等键）；发现文档-实现缺口：24h claim 警告只存在于文档、代码无实现。报告：`docs/research/wayfinder-双变体与票协议深读-2026-08-29.md`
- [调研：workflow-interview-web 能力全景盘点](https://github.com/parkth1026/parking-agents/issues/148)：上下文爆炸的唯一硬耦合是「唤醒绑定」（wait-submit 退出通知只唤起启动它的会话），盘上真源/结构闸门/dossier 投影/提交吸收全部无会话耦合；可拆而未拆的地基现成（manifest 接续点、facts/<主题> 分片协议、脚本冷启动）；story 级爆掉的缺失层是拆解——AC>7 校验器自要求拆任务但拆出的多件事无编排层接管；13 条家族能力 + 9 条 web 能力全景挂证据；10 组可直接继承，应放弃「单会话跑完全程」隐式默认，会话预算的解法是切割谱系而非压缩上下文。报告：`docs/research/workflow-interview-web-能力全景盘点-2026-08-29.md`
- [调研：aes-worktree-board 星图与 Issue 关系数据面](https://github.com/parkth1026/parking-agents/issues/150)：星图边只来自 blockedBy（sub-issue 关系只显节点不显线）；零改动复用三条件——issue 同仓 + 原生 blocked-by/依赖行文 + issue close 表终态；三维 verdict 全是 registry 事实（非推断），verdict↔契约 AC 的对账点已存在（evidenceClass automated|live|manual、contractDigest 变更即失效），粒度缺口：v3 verdict 是 Task 级、v4 acceptance 是 job 级、Goal Contract 是 story 级。报告：`docs/research/aes-worktree-board-星图与Issue关系数据面-2026-08-29.md`
- [调研：aes-workflow engineering 路由与门禁思想](https://github.com/parkth1026/parking-agents/issues/151)：双入口路由（有序优先级表单步路由 + 链式执行器拒缺前置）与 review/validate/finish 门禁三件套分工干净；最可迁移是指针漂移模型（上游改了在飞不爆红、收口一次对账）与人工面回写协议（`[x]` 唯一来源、两阶段放行）；一任务一 worktree、12 类全量 schema、WayFinder 显式点名进入三处不能照搬。报告：`docs/research/aes-workflow-engineering-路由与门禁思想-2026-08-29.md`

## Not yet specified

（无——全部 fog 已毕业或吸收；map 到达终点）

## Out of scope

- **实现落地**：本图只交设计定稿；编码、npm test、skill-release 五步（含 web 投影层编码）属于实现 effort，另开 map。
- **aes-workflow/skills/engineering 本体的移植或改造**：只参考思想，不动那个仓库。
- **#101 的映射回归维护问题**：留在原维护 map，不因本图改道。
```

### 评论（原文，唯一一条）

| 时间 | 作者 | URL |
| --- | --- | --- |
| `2026-08-29T04:18:30Z` | `parkth1026`（OWNER） | <https://github.com/parkth1026/parking-agents/issues/147#issuecomment-5460289640> |

```markdown
## Map 关闭：Destination 达成

设计定稿交付：`docs/design/workflow-story-map/spec.md`（定稿 v1.0）+ `docs/adr/0001`–`0004`（已接受）。12 条 Decisions（4 研究 + 8 裁决/定稿）全链回溯：#148–#151 调研 → #152 落点 → #153 执行挂载 → #154 载体 → #155 阶段模型 → #156 档案 → #157 命名 → #158 web/星图 → #159 定稿。

后续：实现 effort 另开 map（交接包与建议切票顺序在 spec ⑩）；workflow-story-map 维护 map 随实现开档；#101 的映射回归问题仍在原维护 map。
```

### 原生子票关系（GraphQL）

`subIssues.totalCount: 12`，`subIssuesSummary: { total: 12, completed: 12, percentCompleted: 100 }`。以下 12 张均为 `CLOSED`（此表的 title/state/URL 是直接 API 字段）：

| # | 标题 |
| --- | --- |
| 148 | 调研：workflow-interview-web 能力全景盘点 |
| 149 | 调研：wayfinder 双变体与票协议深读 |
| 150 | 调研：aes-worktree-board 星图与 Issue 关系数据面 |
| 151 | 调研：aes-workflow engineering 路由与门禁思想 |
| 152 | 裁决：整合能力落点——升级 interview 家族 / 独立新技能 / 强化 wayfinder |
| 153 | 裁决：执行与验收的挂载架构 |
| 154 | 裁决：票载体与 claim 强度 |
| 155 | 裁决：三阶段门禁与 map 票流的融合 |
| 156 | 裁决：决策档案分层——map 索引 + 票级 dossier 两级同构 |
| 157 | 裁决：新编排技能命名与发布路径 |
| 158 | 裁决：web 投影层与星图归一——双 tracker 渲染归属 |
| 159 | 定稿：workflow-story-map 设计 spec + ADR 撰写 |

原生 parent/sub-issue 关系可用于显示 Map → 12 个 child nodes；API 同时明确 root 没有 parent，且没有 native blocking/blocked-by 边。

### Timeline（压缩后的直接事件）

| 时间 | event | 直接载荷 |
| --- | --- | --- |
| `2026-08-28T18:37:42Z` | `labeled` | `wayfinder:map` |
| `2026-08-28T18:39:01Z` – `18:39:10Z` | `sub_issue_added` | #148–#155 |
| `2026-08-28T19:14:32Z` – `19:14:33Z` | `sub_issue_added` | #156–#157 |
| `2026-08-28T19:41:05Z` – `19:41:07Z` | `sub_issue_added` | #158–#159 |
| `2026-08-29T04:18:30Z` | `commented` | 上述 closure comment |
| `2026-08-29T04:18:31Z` | `closed` | root issue closed |
| `2026-08-30T08:18:13Z` | `referenced` | commit `77ded9cac5ecb142f2837cc2878bf4f4b7bd2fdb` |

该 commit 的 GitHub API 元数据：message 为 `wayfinder #147`，author date `2026-08-29T14:18:16Z`，committer date `2026-08-29T14:18:24Z`，URL <https://github.com/parkth1026/parking-agents/commit/77ded9cac5ecb142f2837cc2878bf4f4b7bd2fdb>。Timeline 的 reference 出现时间晚于 commit 元数据；两者都是直接返回的不同时间字段，不能在本分片中改写为同一个事件时刻。

## Inference（受限推论，非 API 字段）

- Issue #147 适合作为 Web fixture 的**已收口 Map**：根票 `CLOSED/completed`、12/12 子票 closed、且 closure comment 明确宣称 Destination 达成。这是「API 状态 + issue 作者文字」的组合，不等于对 spec/ADR 内容逐文件验收。
- 最贴近真实数据的首个展示样本应是“已完成、可审计、可回溯的 Story Map”，而不是“正在进行的 Human Test 被 block”。后者可以作为**明确标注的假设性/缺失补全场景**，不能伪装成 #147 的实时状态。
- `author: parkth1026` 是可显示的创始人/发起人字段；因为 `assignees: []`，不能把他显示成 GitHub 当前 assignee 或凭此推导运行期 owner/quorum。
- 12 个子票标题可供真实的阶段/列表示例；它们在何种公共阶段、具体先后依赖、是否存在人工门禁，仍须以已确认的领域设计或显式模拟数据决定。根票自身没有 native blocking 边。

## 可直接进入 Web fixture 的字段

### 可标记为 “Live Issue snapshot” 的真实字段

- Repo、Issue URL、number、title、author、created/updated/closed timestamp。
- `CLOSED / completed`、`wayfinder:map`、unassigned、无 milestone/type/parent/project item。
- 12/12 complete，和所有真实子票的 number/title/state/URL。
- Native dependency summary 为 0 / 0；可视化时应显示“没有 GitHub dependency edges”，而不是凭标题画出 blockers。
- closure comment 的摘要及其链接；如要显示全文，保留 attribution 与日期。
- Timeline 的 label、child-add、comment、close、commit-reference 事件及上述时间。

### 必须明确标记为 “Synthetic scenario” 或从运行时读入的缺失补全

- RepoLane / Profile 名称、数量、映射、owner。
- 当前主动作、可安全并行队列、排序理由、SLA、风险等级。
- Human Test testcase、actual / expected、verdict、证据链接、quorum / Waiver / receipt 状态。
- 六公共阶段里的逐阶段 status，及 `N/A` 的 lane 映射。
- Gate、capability scope、degraded/fail-closed、Registry 健康度。
- 任何“谁该立即行动”的 operator work item。

这些字段均未在 #147 根票的标准 Issue 字段、唯一评论、子票关系、或 timeline 中出现。即便正文描述了未来设计意图，也不能把它转换成当前运行期数据。

## Unavailable（本次 API 读取不能证明）

- #147 的实际执行者、active owner、会话/agent、reviewer、quorum 成员、权限范围或授权史。
- 根票以外每个 child 的完整评论/证据/依赖图；本分片只读取了 root 的 relation summary 和 child 摘要，未递归读取 12 张子票。
- #147 所述 `spec.md`、ADR 0001–0004 的文件是否当前仍存在、内容是否与 comment 相符、或者在本次抓取之后是否被修改。
- `77ded...` commit 的 diff 与其是否满足任何设计/验收目标；timeline reference 只证明 GitHub 记录了引用。
- 跨 GitLab tracker 数据、任何本地 Registry、Receipt、QA 产物、worktree board verdict，或浏览器当前页面所展示的这些状态。
- 任何实时运行状态；本文件是上述抓取时刻的静态 Issue snapshot。

## Source commands（可复验，只读）

```powershell
gh issue view 147 --repo parkth1026/parking-agents --json number,id,title,state,author,createdAt,updatedAt,closedAt,labels,assignees,milestone,body,comments,url,projectItems,issueType,parent,subIssues,subIssuesSummary,blockedBy,blocking
gh api 'repos/parkth1026/parking-agents/issues/147'
gh api --paginate -H 'Accept: application/vnd.github+json' 'repos/parkth1026/parking-agents/issues/147/timeline?per_page=100'
gh api 'repos/parkth1026/parking-agents/commits/77ded9cac5ecb142f2837cc2878bf4f4b7bd2fdb'
```
