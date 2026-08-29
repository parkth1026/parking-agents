# aes-worktree-board 星图与 Issue 关系数据面调研

- 票：parkth1026/parking-agents#150（wayfinder map #147「story 级全链条工作流整合设计」子票）
- 日期：2026-08-29
- 方法：全部结论挂一手来源（技能代码 + 设计文档），文件路径相对本仓根；行号以当日开发侧真源 `.agents/skills/aes-worktree-board/` 为准。
- 设计文档 `docs/design/design_handoff_issue_starmap/` 在本仓找到（README.md / 需求星图 7a.dc.html / support.js / aes-worktree-board-current-status.html），未缺席。

## 0. 结论摘要（5 条）

1. **星图的全部关系数据 = 单仓 Issue 列表 + blockedBy + GitHub state**。`collect.mjs` 只对 `config.issueRepo` 一个仓跑 `gh issue list --json number,title,state,url,body,closedAt,updatedAt,labels,blockedBy,blocking`（collect.mjs:366-371）；graph.edges 只从 `issue.blockedBy` 派生（collect.mjs:520-531）。**parent / sub-issue 关系完全不进查询字段、不产生边**——#147→#150 这类原生 sub-issue 拆解在星图上只有节点、没有连线。
2. **零改动复用条件**：新工作流只要 ① Issue 落在 board.config.json 的 `issueRepo` 单仓内；② 拆解/依赖关系用 GitHub 原生 blocked-by 或 body 行文（`blocked by / depends on / 依赖于` 行、task-list `- [ ] #N` 行）表达；③ 终态用 issue close 表达——星图即可直接渲染其全部拆解关系，board 一行代码不用改。多仓聚合、parent/sub-issue 边、自定义状态字段、标签可视化四处需要改代码。
3. **frontier 是纯派生值，无标签参与**：`CLOSED→resolved；被 worker 认领→claimed；任一依赖未 CLOSED→blocked；否则 frontier`（collect.mjs:539-547）。标签只作用于控制面：`ready-for-agent`（且不带 ready-for-human/needs-info/needs-triage/wontfix）决定 Issue 能否进自动 claim 的 eligible frontier（orchestrate.mjs:87-96）；`needs-manual-test` 决定 merge 门禁是否强要真机证据或 manualTestDebt（orchestrate.mjs:492-497、1678-1681）。**board 视图本身不读 labels**。
4. **三维 verdict（code/runtime/delivery）全部是 registry 事实，不是 collect 推断**：`code=PASS` 只来自独立 reviewer APPROVE 消费（orchestrate.mjs:1102-1117）；`delivery=MERGE_READY` 只能由 `EVALUATE_MERGE_GATE` succeeded receipt 原子写入（orchestrate.mjs:1673-1694、1202-1203）；门禁 `assertEffectiveVerdict`（orchestrate.mjs:329-343）要求 code=PASS + 显式 runtime + runtime∉{BLOCKED,FAIL} + 真机要求时 runtime=PASS。assess.mjs 的 `--merge recommend/--done` 是主 agent 人工判断，只进显示层并会被 stale 机制打过期标记（assess.mjs:51-66、collect.mjs:497-508），不参与门禁。
5. **verdict ↔ 契约 AC 的现成对账点**：v4 侧已有 `GATE-acceptance` 机械门——terminal READY_TO_MERGE 携带 `acceptance[]{id,outcome,evidenceRefs}`，要求全 PASS 且取证 commit 精确等于 candidate（master.mjs:964-986、merge-policy.mjs:116-129）；issue-contract 的 AC 自带 `evidenceClass: automated|live|manual`（issue-contract.mjs:117-121）。[A] 档 ↔ automated ↔ runtime=PASS / GATE-qa checks；非 [A] 档（[B] 黄金用例、[C] 端到端、人工验收）↔ live/manual ↔ runtime=NOT_RUN+manualTestDebt / humanGates / riskProfile≥high 的 humanGate；`contractDigest`（issue-contract.mjs:226-235）已实现「AC 内容变更使旧证据失效」，与 candidate commit 前进失效（master.mjs:552-574）同一语义，可直接承载「契约 AC 变更后业务终态必须重判」。

---

## 1. 星图数据面清单

### 1.1 数据流水线

```
gh issue list (单仓 issueRepo) ──┐
fixtures/*.json (完整离线 fixture) ├→ collect.mjs collectStatus → buildGraph → graph{issues,edges,stats}
runtime/status.json 快照缓存回退 ─┘          │
                                             ├→ <repo>/.aes-worktree-board/runtime/status.json (schemaVersion 3)
                                             ├→ runtime/status.js (window.WORKBOARD 快照页)
                                             └→ server.mjs GET /api/status（LIVE，每次现采；?fast=1 走缓存链）
                                                      │
                                                      └→ board.html 三处消费：桌面星图（graph 视图）、四列进度轴（map 视图）、竖屏工作台（shadow DOM）
```

- 配置解析链：环境变量 > 目标仓 `.aes-worktree-board/board.config.json` > 技能目录默认（collect.mjs:49-67；SKILL.md:25-27）。`issueRepo` 是星图的唯一 Issue 归属。
- 三条 Issue 输入链（collect.mjs:611-618）：live gh / `--issues-fixture` 完整 fixture（loadIssueFixture，collect.mjs:392-412）/ `--no-gh` 快照回退（cachedIssueSources，collect.mjs:459-471）。三条链都保留 labels 原样数组（SKILL.md:81 明文约束；references/design.md:142 及变更记录 198 行是 #24 的回归来源）。
- server `/api/status` 无 fast 参数时实时跑一次完整 collect（server.mjs:349-352）；端口占用校验也要求 graph（issues/edges/stats）+ worktrees 全部过 schema（server.mjs:49-67）。

### 1.2 graph.issues[] 字段来源（collect.mjs:537-562）

| 字段 | 来源与规则 | 证据 |
| --- | --- | --- |
| `number/title/state/url` | gh/fixture 原样透传；state 归一为大写 OPEN/CLOSED | collect.mjs:400-405 |
| `labels` | 原样保留（gh 返回 label 对象数组或字符串都接受，`Array.isArray` 即透传），禁止空数组覆盖 | collect.mjs:373-375、SKILL.md:81 |
| `blockedBy` | 三级优先：① fixture 的 `blockedByNumbers`；② GitHub 原生 `blockedBy.nodes`；③ body 文本解析（行匹配 `blocked by / depends on / 依赖于` 或 task-list `- [ ]` 行，抽取行内 `#N`，只接受本仓已知编号）。自环过滤，去重排序 | collect.mjs:352-364、377-390、407-408 |
| `claimedBy` | worktree 名。认领判定：registry 最新 executor Task 的 `issue` 优先（`latestRegistryTask`，generation 降序）；无 registry 时回退旧 tasks 目录 activeTask prompt 里的 `#N` 或 HEAD commit subject 的 `(#N)` | collect.mjs:329-335、345-350、644-646、512-517 |
| `derived.status` | `CLOSED→resolved`；有 claimedBy→`claimed`；任一 blocker 未 CLOSED→`blocked`；否则 `frontier` | collect.mjs:539-547 |
| `derived.degree` | 该 issue 关联的边数（无向度数），即「星等」 | collect.mjs:532-536；设计稿 README.md:40 |
| `derived.warn` | `state=CLOSED` 且 issue timeline 出现过 `reopened` 事件（gh api timeline 分页查询，失败回退上次快照的 warn） | collect.mjs:414-420、444-451、559 |

### 1.3 graph.edges / graph.stats

- `edges[] = { from: 依赖方(blocker), to: 被阻塞方, satisfied: blocker.state==='CLOSED' }`，按 `dependency → issue` 方向，去重排序（collect.mjs:518-531、563）。**唯一的边来源是 `issue.blockedBy`**；查询字段里没有 parent/subIssues（collect.mjs:369），对照 check-issue-graph.mjs:20-22 的图字段全集（含 parent/subIssues）可确认这是 collect 的裁剪而非 GitHub 没有。
- `stats = { total, open, closed, frontier, edges, warned }`（collect.mjs:564-571），控制 CLI 巡检输出（collect.mjs:769-773）与看板品牌区进度条（board.html:835-839）。
- worker 侧配套：`trail`（分支 commit subject 里的 `#N` 中已 CLOSED 的，按 closedAt 排序，collect.mjs:575-588、638-642）；`position`（claimedIssue 存在则 `{kind:'issue', issue}`）；`mode`（registry Task 非终态→running，有 position→manual，否则 idle，collect.mjs:684-687）。

### 1.4 Map/List 双视图各消费什么（board.html）

桌面看板视图切换按钮文案固定 `Map / List`（board.html:208；SKILL.md:57 边界约束），`Map` 切到星图画布（data-view="graph"），`List` 切到四列进度轴（data-view="map"）：

**Map（星图画布，graph 视图）**
- 布局：一次收敛的力导向（open 双环分布、resolved 网格背景化，collect 数据直接喂入；board.html:567-628），数据更新增量重算。
- 半径=星等公式：`frontier 8+1.4×d / claimed 9+1.4×d / blocked 5+1.1×d / resolved 3.5+0.8×d`（board.html:512-518），与设计稿逐字一致（docs/design/design_handoff_issue_starmap/README.md:42-48）。
- 四态节点视觉 + warn 琥珀虚线环（board.html:680-688）；阻塞链边高亮条件是 `目标 derived.status==='blocked' && !edge.satisfied`（board.html:721-724）。
- 图例=四态计数过滤（board.html:786-787）；搜索匹配 `number / title / claimedBy`（board.html:940-945）。
- 详情面板消费：`derived.status/degree/warn`、`blockedBy`（「来路」）、`edges.filter(from===选中)` 的 to 集（「完成后解锁」）、worker 的 branch/assessment.stale、registry Task 区（taskId/state/BLOCK 计数/**三维 verdict chips**/modelTier/nextAction/transition 历史）（board.html:880-897）。
- Workers 面板：task.state 徽章、verdict 摘要 `C:✓ R:✓ D:MERGE_READY`（board.html:794-814）；全局编排胶囊读 `orchestration`（board.html:844-854）。

**List（四列进度轴，map 视图）**
- 按 `resolved / claimed / frontier / blocked` 四列分组卡片，卡片只用 `number / title / derived.status / derived.warn / worker(mode)`（board.html:819-833）。这是「不看连线只看状态队列」的降维视图。

**竖屏工作台（700×1000，shadow DOM，mock 机械生成）**
- 同一份 `graph.issues` 映射到五态闭集 `frontier/running/blocked/human/resolved`（board.html:1074、1094），并预留 `derived.stage/job/attempt/runner/model/review/qa/delivery` 扩展字段位（board.html:1095-1100）——**v3 collect 从不产出这些字段**，当前全部走默认值，属于为 v4 预留的显示位。

**不消费的东西**：`issue.labels` 在三个视图里都不渲染（全文检索 board.html 只有状态文案映射变量重名 `labels`）；labels 只被控制面读（见 1.6）。

### 1.5 三维 verdict：判定来源与 MERGE_READY 门禁（orchestrate.mjs）

值域闭集（orchestrate.mjs:23-25）：

```text
code:     PASS | BLOCK
runtime:  PASS | NOT_RUN | BLOCKED | FAIL
delivery: MERGE_READY | PARKED | HANDOFF_REQUIRED | BLOCKED
```

写入路径（谁有权写哪个格子）：

| 格子 | 唯一合法写入方 | 证据 |
| --- | --- | --- |
| `code=PASS` | 父 executor Task 消费关联 reviewer 的 `final\|verdict` 显式 `APPROVE\|PASS` 事件（且 payload.commitSha 等于当前 commit） | orchestrate.mjs:1102-1117、375-381 |
| `code=BLOCK` | 同上路径的 BLOCK，进 blockLedger 计数；第 3 次有效 BLOCK → `handoff-required` + 熔断 | orchestrate.mjs:924-941、SKILL.md:296-302 |
| `runtime` | `verdict set` 只能预登记**真实 runtime evidence**；`NOT_RUN→PASS` 有专门升级码 | orchestrate.mjs:1190-1217 |
| `delivery=MERGE_READY` | 仅 `EVALUATE_MERGE_GATE` succeeded receipt（旧 `verdict set` 直接拒绝，MERGE_GATE_RECEIPT_REQUIRED） | orchestrate.mjs:1202-1203、1673-1694 |
| `delivery=PARKED` | reviewer 收口 / lane 显式停放 | orchestrate.mjs:894、2022 |
| Task 到 `approved/merge-ready/merged` 后 verdict 冻结 | — | orchestrate.mjs:1192-1194 |

`MERGE_READY` 门禁（SKILL.md:83 的 `recommend`/`MERGE_READY` 约束的机械实现）：

- `assertEffectiveVerdict`：`code=PASS`；runtime 显式非空；runtime∉{BLOCKED,FAIL}；`requiresRuntime`（真机 Issue）时必须 `runtime=PASS`（orchestrate.mjs:329-343）。
- `needs-manual-test`（由 fresh Issue labels 自动推导为 interactionClass，显式传 `autonomous` 会 fail closed）+ `runtime=NOT_RUN` 时必须显式 `manualTestDebt`（orchestrate.mjs:492-497、1678-1681；SKILL.md:256-258）。
- 状态机证据链（assertTransitionEvidence）：`executorFinalEvidence → CREATE_REVIEWER receipt + reviewEvidence(APPROVE, commit 精确绑定) → EVALUATE_MERGE_GATE receipt（实时 git merge-tree）→ HOST_MERGE receipt（真实两父 merge commit）→ POST_MERGE_VERIFY passed verificationRun`（orchestrate.mjs:350-409；SKILL.md:283-294）。分多次写 verdict 也绕不过：门禁按合并后的**有效 verdict** 校验。

`assess.mjs` 的人工判断（`--merge recommend|not-yet|blocked`、`--done true|false|unknown`）是另一条显示层通道：只写 status.json 的 `assessment` 字段（assess.mjs:58-66），`recommend` 在 `ahead>0 且 trail 为空` 时被降级为 `not-yet`（assess.mjs:53-56）；collect 每轮用最新 Git/Task 时间重算 `stale`（collect.mjs:497-508），过期只在看板提示、不推进任何门禁（SKILL.md:153）。

### 1.6 附：v4 侧的平行业务终态（master.mjs，星图不直接渲染但同仓可用）

- job 级机械门八项固定顺序 `slot → commit → integration → acceptance → review → review-base → QA → qa-base`（SKILL.md:411；merge-policy.mjs:105-176）。
- `GATE-acceptance`：terminal `READY_TO_MERGE` 落盘的 `job.acceptance[]{id,outcome,evidenceRefs}`，要求全部 `outcome=PASS` 且 `acceptanceCommit === candidateCommit`，AC 列表为空直接拒绝放行（master.mjs:964-986；merge-policy.mjs:116-129）。
- `GATE-qa`：`outcome=PASS` + commit 精确绑定 + `checks[]` 无 NOT_RUN + `unexecuted` 为空（merge-policy.mjs:154-158）。
- 风险档：Issue 自报 riskProfile，Master 按改动路径 ESCALATION_RULES 兜底升档（merge-policy.mjs:33-41、55-80）。

## 2. 复用判据：新工作流要发出什么

### 2.1 零改动即可被星图渲染（board 代码一行不改）

| 要发出什么 | 具体约定 | 证据 |
| --- | --- | --- |
| Issue 归属 | 全部 Issue 开在 `board.config.json`/`AES_WORKTREE_BOARD_ISSUE_REPO` 指向的**同一个仓**；跨仓聚合是明确排除项 | collect.mjs:366-371；references/design.md:198「不新增多仓聚合」 |
| 依赖边（三选一，优先级从上到下） | ① GitHub 原生 blocked-by 关系（gh `--json blockedBy` 直接带出）；② issue body 中含 `blocked by / depends on / 依赖于` 的行；③ issue body 的 task-list 行 `- [ ] #N`。引用编号必须是同仓已存在的 issue 号 | collect.mjs:352-364、377-390 |
| 状态 | 只用 GitHub OPEN/CLOSED：close 即 `resolved`、解锁下游；close 后 reopen 过会自动得 ⚠ 警示环 | collect.mjs:539-547、414-420 |
| 认领可见性 | 自动路径：registry executor Task 的 issue；手动路径：worktree HEAD commit subject 写 `(#N)` 或任务提示含 `#N`，即可被标为 claimed | collect.mjs:345-350、644-646 |
| 标签（可选但强烈建议沿用本仓约定） | 视图渲染不需要任何标签；但要进**自动 claim 的 eligible frontier** 必须 `ready-for-agent` 且不带 `ready-for-human/needs-info/needs-triage/wontfix`；`needs-manual-test` 会正确收紧 merge 门禁。这套字符串与本仓 AGENTS.md triage 五标签完全同源 | orchestrate.mjs:87-96、492-497 |

### 2.2 需要改 board 代码的地方

1. **parent / sub-issue 边不渲染**：查询字段就没有 `parent/subIssues`（collect.mjs:369），buildGraph 只遍历 blockedBy。#147→#150 的原生 sub-issue 拆解在星图上是孤立节点。若坚持用 sub-issue 表达拆解：需改 `fetchIssueList` 字段集 + `buildGraph` 加第二种边（并同步设计稿的边规格与 SKILL.md 约束）。**零改动的替代**：拆解关系同时用 blocked-by 表达（GitHub 原生关系二者可并存，#150 票面本身两种都有）。
2. **多仓 Issue 图**：需要新的聚合层（config、identity、fixture 完整性都会牵动）。
3. **自定义状态字段**：`derived.status` 四态闭集硬编码于 collect（collect.mjs:539-547）；story/workflow 自有阶段（如「契约已定稿」「对账中」）只能映射到四态之一，或经竖屏预留的 `derived.stage/job/runner/qa/delivery` 扩展位注入（board.html:1095-1100 已留显示位，但 collect 不产出，需要写侧扩展，且桌面双视图不读它们）。
4. **标签可视化**：按标签着色/过滤/展示需改 board.html；受 SKILL.md:57 约束（设计语言冻结于 docs/design/design_handoff_issue_starmap/，控制面只占六个确认挂点），属于设计变更而非数据变更。
5. 备注：`graph.issues[].labels` 的形状是 gh 原样（对象数组或字符串），消费方都要走 `labelNames` 兼容（orchestrate.mjs:78-80、issue-contract.mjs:31-33、check-issue-graph.mjs:104-108）——新代码别假设字符串数组。

## 3. verdict ↔ 契约 AC 的对账候选接口

三套现成体系（同仓、可互操作）：

- **v3 Task 级三维 verdict**（orchestrate.mjs，见 1.5）；
- **v4 job 级 AC 验收**：issue-contract 的 AC `{id, evidenceClass, text}`（issue-contract.mjs:114-121）+ terminal `acceptance[]{id,outcome,evidenceRefs}`（master.mjs:978-981、1467）+ `GATE-acceptance`（merge-policy.mjs:116-129）；
- **Goal Contract 的 [A]/[B]/[C] 档**（aes-goal-contract SKILL.md:82-96）：[A]=现有自动断言，[B]=用户真实数据黄金用例，[C]=端到端。

候选映射点（按落地成本从低到高）：

| # | 契约侧 | 控制面侧 | 现有衔接证据 |
| --- | --- | --- | --- |
| M1 | AC `evidenceClass=automated` ↔ `[A]` 档 | `runtime=PASS` 的自动化证据 / v4 `GATE-qa` checks 全 PASS 且无 NOT_RUN、无 unexecuted | issue-contract.mjs:11、180-184；merge-policy.mjs:154-158；orchestrate.mjs:258「runtime=FAIL\|BLOCKED 始终阻断 merge gate」 |
| M2 | AC `evidenceClass=live/manual` ↔ 非 [A] 档（[B]/[C]/人工验收） | `runtime=NOT_RUN + manualTestDebt`（v3）或 humanGates/riskProfile≥high 的人工门（v4：AWAITING_HUMAN_GATE，waiver 只能由 human 留结构化记录） | orchestrate.mjs:1678-1681；issue-contract.mjs:140-144；merge-policy.mjs:196-217、84-101 |
| M3 | Goal Contract「完成判定」/ 全部 [A] 绿 | 业务终态三处同构：assess `done=true`（人工、显示层）；v3 `delivery=MERGE_READY`（机械门）；v4 `READY_TO_MERGE + acceptance 全 PASS + acceptanceCommit===candidate`（机械门）。**GATE-acceptance 的「AC 列表为空拒绝放行」正是 goal-contract「一条 [A] 都没有时停一下」的机械对应** | merge-policy.mjs:124-126；aes-goal-contract SKILL.md:231-232 |
| M4 | 契约 AC 内容变更 → 旧验收作废 | `contractDigest`（绑 AC/副作用/人工门内容）已实现 digest 变化即失效；与 candidate commit 前进使 review/QA/acceptance 失效是同一套语义（E5/#72）。可直接承载「story 级契约改 AC 后，下游业务终态自动重判」 | issue-contract.mjs:224-235；master.mjs:552-574、965-967 |
| M5 | [C] 端到端/高风险 AC | `riskProfile` 兜底升档（ESCALATION_RULES 按改动路径强制 high/critical）→ deep review + humanGate/PR-only。契约起草阶段标注的风险档可以直接作为 issue body `riskProfile` 被 v4 claim 消费 | merge-policy.mjs:33-41、55-80；issue-contract.mjs:128-131；master.mjs:307-316 |

注意一个语义缺口（设计 #147 时要决策）：v3 三维 verdict 是 **Task 级**（一个 issue 的某次执行尝试），v4 acceptance 是 **job 级**（跨 attempt 的 AC 结论），Goal Contract 是 **story 级**。三者粒度不同但证据链可串联：AC 条目（story 级）→ acceptance[]（job 级，带 evidenceRefs）→ review/qa receipt（attempt 级，带 commitSha）。「业务终态判定」若要 story 级收口，最自然的挂点是 M3+M4：acceptance 全绿 + contractDigest 未变 = story 业务终态达成。

## 4. 附：关键文件索引

- 数据面构造：`.agents/skills/aes-worktree-board/scripts/collect.mjs`（buildGraph 510-573；blockedBy 派生 352-390；warn 414-451；输入链 436-471、611-618）
- 视图消费：`.agents/skills/aes-worktree-board/board.html`（半径 512-518；节点/边 680-725；图例 786-787；List 819-833；详情 880-897；Workers 806-816；竖屏映射 1074-1100）
- verdict/门禁：`.agents/skills/aes-worktree-board/scripts/orchestrate.mjs`（值域 23-25；eligible frontier 87-96；门禁 329-343、350-409；merge gate receipt 1673-1694）
- 人工判断：`.agents/skills/aes-worktree-board/scripts/assess.mjs`（33-66）
- v4 AC/门禁：`.agents/skills/aes-worktree-board/scripts/issue-contract.mjs`、`scripts/master.mjs`（terminal 946-1019；gate 1114-1152）、`scripts/merge-policy.mjs`
- 图断言（wayfinder 关系活样例）：`.agents/skills/aes-worktree-board/scripts/check-issue-graph.mjs`（wayfinder:map/wayfinder:task/ready-for-agent 标签 + 原生 sub-issue + blocked-by 闭合校验，317-430）
- 设计语言真源：`docs/design/design_handoff_issue_starmap/README.md`（状态/半径/边/交互规格）、`需求星图 7a.dc.html`（高保真稿）、`support.js`（仅预览运行时）
