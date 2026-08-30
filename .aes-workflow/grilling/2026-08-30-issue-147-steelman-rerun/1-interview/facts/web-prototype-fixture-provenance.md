# Fact: v3 Web prototype fixture 数据来源审计

> 任务边界：只读对照 `v3-product-prototype.html`、本 issue workflow 真源与既有 facts；不访问或修改 tracker，不替用户确认 Web artifact，不修改 prototype、manifest、rounds 或 context。
>
> 审计绑定：`v3-product-prototype.html` SHA-256 `AA4E1AC384CB53A249ECB3E717446916FC96A12C8E07993450AD88E8913E349B`；`rounds.jsonl` 物理 50 行。#147 的 tracker 事实采用并行只读分片 `facts/issue-147-real-data.md`（SHA-256 `4F3BC5A5C5E88CFEB26C8516470359D3CA5E6EE0342E4B3013ECC7010FCCF9D0`），本分片未自行请求 GitHub。

## 结论先行

当前 v3 **不是从 Issue #147 的真实运行状态还原出来的页面**。

- 真正来自 #147 的页面数据，基本只有 `parkth1026/parking-agents#147` 这组 identity。真实 #147 是 `CLOSED/completed`、12/12 子票关闭、无 assignee、无 native blocked-by/blocking 边的已收口 `wayfinder:map`。见 `facts/issue-147-real-data.md:9-28,86-118`。
- `StoryRoot`、多 `RepoLane`、固定六阶段、Receipt freshness、fail-closed、Human Test、Waiver 等**领域语义**来自 Q1～Q35 与 WEB-P3～P7 的访谈裁决；它们是未来产品合同，不是 #147 当前 tracker 字段。
- 页面里 `desktop/backend`、D17/I42/I48/Q43、`contract@4`、candidate c2/c3、attempt-4、`91b0aa10`、`profile-abc/def`、`receipt-*`、projection rev 82、等待分钟数、Gate 数量和 PASS/STALE 状态，都是为覆盖状态而构造的 fixture。
- `SCENARIO SNAPSHOT` 与 `PROTOTYPE RECEIPT` 两个标签是正确护栏，但仍不够：同一屏又使用真实 `Story #147` identity、虚构的活跃状态和看似真实的 SHA/Receipt/同步时间，用户会自然把 fixture 当作 #147 的恢复结果。
- 页面甚至展示了当前仓不存在的命令 `node skills/workflow-story-map/run-tests.mjs` 及退出码 0，以及不存在的 evidence 文件 `story-console-c3-768x1080.png`。这两项不是普通 synthetic，而是会诱导真实操作/验收判断的 **misleading**。

因此，用户的第一个质疑成立：当前内容是“真实领域规则 + 自造运行样本”，不是“真实 Issue 数据 + 明示缺口模拟”。

## 分类口径

| 标记 | 定义 | 页面应该怎样表达 |
| --- | --- | --- |
| `ISSUE FACT` | tracker API 直接返回、且已落入只读事实分片的 #147 字段 | 可显示为 `ISSUE SNAPSHOT`，带 source URL 与 captured-at；本分片没有做二次 live refresh |
| `INTERVIEW FACT` | 用户在 `rounds.jsonl` 明确选择或补充的产品语义 | 可显示为 `CONFIRMED RULE`，不能冒充当前 ticket/lane 状态 |
| `DERIVED PROJECTION` | 由明确输入和确定性规则合成的值 | 必须能展开 `derived_from + rule/revision`；若输入是 synthetic，应显示 `DERIVED FROM SCENARIO` |
| `SIMULATED GAP` | 为覆盖真实 Issue 不具备的运行态、异常态或交互路径而构造的值 | 使用不与真数据碰撞的 `SIM-*` identity，并持续显示 scenario badge |
| `MISLEADING` | unsupported/contradicted 值被放在真实 identity 或“可执行/新鲜”语境中 | 必须替换、禁用或降级为 `NOT_CONNECTED / NOT_RUN / NOT_IMPLEMENTED` |

一个字段可以同时有两个标记。例如“D17 排第一”是 `DERIVED PROJECTION`，但其输入 D17、扇出 4、等待 9 分钟全是 `SIMULATED GAP`，所以准确表达应是 `DERIVED FROM SIMULATED SCENARIO`。

## 当前可用的真实基线

### 1. GitHub Issue #147 快照

| 可确认字段 | 当前真实值 | 证据 |
| --- | --- | --- |
| identity | `github:parkth1026/parking-agents#147`，database id `5281202529` | `facts/issue-147-real-data.md:14` |
| title | `story 级全链条工作流整合设计` | `facts/issue-147-real-data.md:15` |
| state | `CLOSED / completed` | `facts/issue-147-real-data.md:16` |
| created / closed / updated | `2026-08-28T18:37:40Z` / `2026-08-29T04:18:31Z` / `2026-08-29T04:18:31Z` | `facts/issue-147-real-data.md:17-18` |
| author / assignee | author `parkth1026`；assignees 为空 | `facts/issue-147-real-data.md:19-21` |
| type/label | label `wayfinder:map`；issue type `null` | `facts/issue-147-real-data.md:20,23` |
| child shape | 12 个原生 sub-issues，12/12 closed，标题与 URL 可用 | `facts/issue-147-real-data.md:86-106` |
| dependency shape | root native `blocked_by=0 / blocking=0` | `facts/issue-147-real-data.md:28-29` |
| closure evidence | 唯一一条 owner comment 宣告 Destination 达成；spec v1 + ADR 0001–0004 | `facts/issue-147-real-data.md:73-84` |
| timeline | label、12 次 child-add、comment、close、commit reference `77ded9…` | `facts/issue-147-real-data.md:108-118` |

这是一份**已完成、可回溯的历史 Map fixture**，而不是一份正在等待 D17/Human Test 的 active Story。

### 2. 当前 workflow-interview 重跑状态

这是另一个事实域，不应与 GitHub Issue lifecycle 合并：

- 本地 workflow `stage=2-prototype`、overall `in_progress`；`1-interview=done`，`2-prototype=pending`，见 `manifest.json:9-33`。
- `rounds.jsonl:35-37` 已确认多 RepoLane、Human Receipt 分权、Registry fail-closed；这些是产品规则。
- `rounds.jsonl:41-47` 已确认工作台优先、一个主动作 + 安全并行队列、复杂 Review Workspace、768×1080 Queue-first、固定六阶段与显式 N/A；这些是 Web 产品规则。
- `rounds.jsonl:49-50` 已记录用户本轮质疑，`web_artifact_confirmed=false`，并要求真实 Issue 数据溯源、真实浏览器旅程与可视化设计。
- `context.md:224-235` 仍写 WEB-P8 待答，已落后于 append-only rounds；恢复当前状态时 rounds 优先，不能把这段 context 当作最新事实。
- `manifest.json:10` 的 `next_action` 仍写“进入 2-prototype”，也落后于当前实际工作。只有 stage/status 字段可直接采用，next_action 应从最新 rounds 与当前产物重新投影。

## v3 可见字段逐项归类

### A. Artifact 与 Shell

| v3 字段 / 文案 | 分类 | 判断依据 | 替换建议 |
| --- | --- | --- | --- |
| `draft v3`、P3/P4/WEB-P5/P6/P7 的选择摘要 | `INTERVIEW FACT` | HTML `:1-3` 与 rounds `:41-47` 一致 | 保留；补 `WEB-P8: rework required / not confirmed` |
| `Story Console · workflow-story-map v3` | `DERIVED PROJECTION` | 产品命名/IA，不是 Issue 字段 | 保留为产品壳，不参与数据真伪标签 |
| `Story #147 · parking-agents` | `ISSUE FACT` | number/repo 有直接 tracker 证据 | 改为完整 title + state，允许点开真实 source |
| `/ desktop + backend` | `SIMULATED GAP + MISLEADING` | #147 没有 RepoLane runtime 数据；真实 tracker 只有一个 GitHub issue | 从真实 #147 header 移除；只在独立 `SIM-XREPO-*` 场景出现 |
| `SCENARIO SNAPSHOT` | 正确的 provenance guardrail | 明确不是 live | 保留，但改成具体 `SYNTHETIC COVERAGE SCENARIO`；纯真实数据用 `ISSUE SNAPSHOT` |
| `rev 82 · 12 秒前` | `SIMULATED GAP + MISLEADING` | 没有 rev 82 source；静态 `file://` 也没有真实相对时钟 | 真实视图显示 captured-at；模拟视图显示 `scenario revision SIM-1`，不得写“12 秒前” |
| `重新生成快照` → `无变化 · projection rev 82` | `SIMULATED GAP + MISLEADING` | 按钮只 setTimeout 重播常量，未读取任何 source，HTML `:403` | 改为“重置场景”或禁用；真实刷新必须有 source query 与 success/no-change/error |

### B. Navigator 与 Story header

| v3 字段 / 文案 | 分类 | 判断依据 | 替换建议 |
| --- | --- | --- | --- |
| Story title `跨 RepoLane 的 Story 级交付` | `SIMULATED GAP + MISLEADING` | 真实 #147 title 是“story 级全链条工作流整合设计” | 默认视图使用真实 title；scenario 另用 `SIM-XREPO-001` |
| `story-147` | `DERIVED PROJECTION` | 可由真实 issue number 生成，但不是 tracker 原生 id | 显示原生 `#147` 为主；derived id 展开时标 `derived` |
| `等待你`、`4 actions`、阶段 micro 状态 | `SIMULATED GAP` | #147 已 closed，且无 runtime action source | 真实视图改为 `已收口 · 12/12`；当前 rerun 的 action 从 rounds/manifest 另行投影 |
| `Desktop/GitHub · attempt-4 · profile degraded` | `SIMULATED GAP` | Lane/profile/attempt 均不在 #147 API 或 repo runtime 中 | scenario 改用 `SIM-DESKTOP`、`SIM-attempt-4` |
| `Backend/GitLab · integration 91b0aa10 · PASS` | `SIMULATED GAP + MISLEADING` | 本事实域没有 GitLab target/runtime；8 位 hex 看起来像真实 SHA | 改为 `SIM-BACKEND · git:SIM-CANDIDATE-B`；没有 live GitLab 时显示 `NOT_CONNECTED` |
| D17/I42/VIS-1..3 当前工作与 P0/P1 | `SIMULATED GAP` | 只出现在 v1/v2/v3 prototype 链，不在 #147 root/children | 加 `SIM-` 前缀，或用真实 #148–#159 child titles 填充真实 navigator |
| `Story #147` breadcrumb | `ISSUE FACT` 单独成立；与当前 synthetic selection 合用时 `MISLEADING` | identity 真，选中对象假 | 纯真实/纯 synthetic 两套 dataset；若 mixed overlay，breadcrumb 明写 `#147 base + synthetic runtime overlay` |
| `contract@4` | `SIMULATED GAP` | 四份 ADR 不等于 contract revision 4；rounds 也没有该 runtime revision | 真实视图显示 `spec v1.0 + ADR 0001–0004`；scenario 用 `SIM-contract-r4` |
| `2 required lanes` | `SIMULATED GAP` | Q33 只允许多 lane，不证明 #147 有两 lane | 真实视图显示 `RepoLane runtime: unavailable` |
| `opened 2026-08-30` | `MISLEADING / contradicted` | #147 实际创建于 2026-08-28，且 2026-08-29 已 closed | 直接替换为真实 created/closed 时间 |

### C. Story Pulse、排序与安全并行

| v3 字段 / 文案 | 分类 | 判断依据 | 替换建议 |
| --- | --- | --- | --- |
| “一个全局主动作 + 明确安全并行队列” | `INTERVIEW FACT` | P4 / `rounds.jsonl:42` | 保留产品规则 |
| “D17 API 是否只读”场景 | `SIMULATED GAP` | #147 没有该票或该未决问题 | 真实 #147 已无 fog；当前 rerun 的真实主动作应是完成 WEB-P8 要求的 rework |
| “改变用户承诺应回 Discovery” | `INTERVIEW FACT` | Q32 / rounds `:34` | 保留为规则说明，不标为 #147 发生过的事件 |
| 扇出 `4 tickets`、等待 `9 分钟`、owner `story-owner`、projection `82` | `SIMULATED GAP` | 无 source object 或 clock | scenario IDs/时间统一前缀；不要伪造相对时长 |
| “D17 排第一” | `DERIVED PROJECTION FROM SIMULATED GAP` | P4 要求解释排序，但没有锁定具体算法；当前由数组顺序决定，HTML `:352,366-370` | 标出 `scenario ordering`；真实产品需展示 canonical rank inputs/rule revision |
| Registry 恢复“现在可并行” | `DERIVED PROJECTION FROM SIMULATED GAP` | 规则可由依赖/contract independence 推导，但当前图与输入都是 fixture | 展开 `independent_of=D17; policy=SIM-*`，不得只给绿色“现在可做” |

### D. 固定 Story Spine

| v3 字段 / 文案 | 分类 | 判断依据 | 替换建议 |
| --- | --- | --- | --- |
| `Discovery / Contract / Delivery / QA / Integration / Closeout` 同序同位 | `INTERVIEW FACT` | WEB-P7 / rounds `:47` | 保留 |
| N/A 不等于 PASS/blocked/not-started | `INTERVIEW FACT` | WEB-P7 的 concrete scenario、choice 与 context `:220-222` | 保留 |
| Discovery 完成、Contract rev4、Delivery 当前、QA 等人、Integration 1/2、Closeout 未开始 | `SIMULATED GAP` | #147 API 不含六阶段 runtime；真实 #147 已 closed | 真实视图应从真实 events/children 做有限投影；无机械规则时显示 `UNMAPPED`，不能猜 |
| Desktop/Backend 每阶段 mapping 与 Closeout `lanes N/A` | `SIMULATED GAP`，其表达规则是 `INTERVIEW FACT` | 当前两 lane 本身是假数据 | scenario badge 必须在 Spine 常驻；真实 #147 不显示两条虚构 lane |
| 固定阶段点击后的 Now/Why/Next | `DERIVED PROJECTION FROM SIMULATED GAP` | UI 将同一 fixture 展开为解释 | 允许，但 Evidence tab 要给 source/provenance，不再统一写 rev 82 |

### E. Action Center、Lane Rails 与数据健康

| v3 字段 / 文案 | 分类 | 判断依据 | 替换建议 |
| --- | --- | --- | --- |
| `requires-decision`、Profile mismatch fail-closed、subject changed → stale、visual → human gate | `INTERVIEW FACT` 作为领域规则 | Q32、Q35、Q29、Q25 supplement | 可作为 coverage scenario 的状态族 |
| D17/I42、`profile-abc/def`、c2/c3、receipt-QA-900、2 stale、3 visual cases | `SIMULATED GAP` | 无 tracker/repo evidence；只沿 prototype 代际复用 | 全部改为 `SIM-*`，并在对象级显示 provenance |
| Desktop/Backend 的 checkout、integration、owner、PASS、下一动作 | `SIMULATED GAP` | Q33 只规定字段形状，不提供值 | 真实 view 显示 unavailable；synthetic view 不用像真实 SHA 的裸 hex |
| “数据健康有 1 个盲区” | `DERIVED PROJECTION FROM SIMULATED GAP` | 盲区计数由虚构 Profile mismatch 得出 | scenario 可保留；真实 Source Integrity 必须按 source 数组机械合成 |
| fail-closed 时允许 read/diagnose/pause/cancel/release，禁止推进 | `INTERVIEW FACT` | Q35 / context `:193-207` | 保留为 policy detail |

### F. Map、Gate 与 Evidence reader

| v3 字段 / 文案 | 分类 | 判断依据 | 替换建议 |
| --- | --- | --- | --- |
| StoryRoot / RepoLane / Decision / Visual QA / final Gate 这类节点与 `requires/verifies` 关系 | `INTERVIEW FACT + DERIVED PRODUCT MODEL` | Q11、Q21、Q23、Q33 | 可作为 schema；不是 #147 的真实 graph |
| 当前 6-node graph、D17 → Desktop → Visual QA → final Gate | `SIMULATED GAP` | #147 真实 graph 是 root + 12 child nodes，native blocking edges 为 0 | 默认画真实 13-node parent/sub-issue map；synthetic graph 单独切换 |
| 影响 `I42/I48/Q43`、source `acceptance receipt-A71` | `SIMULATED GAP` | 无对应真实 child/receipt | `SIM-I42` 等；source 明写 `scenario seed` |
| Gate index 的 pending/needs-human/degraded/PASS/1/2 | `SIMULATED GAP` | 真实 #147 没有 Gate runtime | 真实 completed map只展示可证明的 tracker completion；Gate 写 `UNAVAILABLE` |
| receipt-QA-900、candidate c2→c3、attempt-4、exit 0 | `SIMULATED GAP` | Q29 支持失效规则，但没有这些实体 | 保留为 explicit scenario only |
| `node skills/workflow-story-map/run-tests.mjs` | `MISLEADING` | 文件不存在；context `:84-86` 也明确未来入口当前尚不存在 | 显示 `NOT_IMPLEMENTED`，按钮 disabled；不得配退出码 0 |
| “Q29 禁止 carry-forward” | `INTERVIEW FACT` | rounds `:31` | 保留并链接 Q29 source |

### G. Inspector、History 与 Source Integrity

| v3 字段 / 文案 | 分类 | 判断依据 | 替换建议 |
| --- | --- | --- | --- |
| Inspector 的 Now/Why/Next、Evidence、History 分层 | `INTERVIEW FACT + DERIVED PRODUCT MODEL` | P3/P4 与 `facts/board-human-status-ux.md` | 保留交互形态 |
| `acceptance-agent`、`Story Core`、`Registry loader` 及 9/8/4 分钟事件 | `SIMULATED GAP` | 无 actor/event source | scenario actor 改 `SIM-ACTOR-*`；真实 timeline 使用 #147 的 direct events |
| 所有对象 Evidence tab 固定写 `projection revision 82` | `SIMULATED GAP + MISLEADING` | source 不同却统一常量，HTML `:371` | 每个对象使用自己的 provenance；没有 revision 就不要造 |
| GitHub tracker `FRESH rev82 12秒` | `SIMULATED GAP + MISLEADING` | 真实可用的是 captured Issue snapshot，不是 rev82 | 显示 API captured-at 与 issue updatedAt |
| GitLab tracker `FRESH rev41 13秒` | `SIMULATED GAP + MISLEADING` | 本事实域没有 GitLab runtime/target | 显示 `NOT_CONNECTED / SYNTHETIC ONLY` |
| Desktop ProfileRegistry `BLIND abc/def` | `SIMULATED GAP` | 当前仓没有 ProfileRegistry 实体 | 显示 `NOT_IMPLEMENTED`；scenario 单独模拟 mismatch |
| Backend evidence `PASS 91b0aa10` | `SIMULATED GAP + MISLEADING` | 无 repo receipt/command/evidence | scenario only；真实 view 不显示 PASS |

### H. Human Test / Review Workspace

| v3 字段 / 文案 | 分类 | 判断依据 | 替换建议 |
| --- | --- | --- | --- |
| 高度可视化才升级 human test；逐 testcase/expected/evidence | `INTERVIEW FACT` | Q25 supplement、Q26、WEB-P5 | 保留 |
| 768×1080 是 Codex 右侧一等视口 | `INTERVIEW FACT` | WEB-P5/P6 | 保留 |
| `VIS-1..3` 三个 testcase 的题目/Expected | `DERIVED PROJECTION` | 从当前 Web 设计决定推导，不是 #147 Issue 数据 | 可转成“本 prototype 的真实 design QA suite”，但必须与 story runtime 分域 |
| VIS-1 actual=`首屏可见…`、verdict=pass | `DERIVED/TEST RESULT` 但当前 source 引用错误 | 当前 `design-qa.md` 有真实截图/检查记录；HTML 却绑定 fictitious c3 | 指向实际存在的 `39-v3-webp7-768-fixed-six-stages.png` 或新一轮真实旅程证据 |
| `story-console-c3-768x1080.png` | `MISLEADING` | 该文件不存在；实际截图名是 `39-v3-webp7-768-fixed-six-stages.png` 等 | 绑定存在且本轮可复验的 evidence path |
| `integration@c3`、`policy visual@2`、`visual_qa`、quorum `1/1` | `SIMULATED GAP` | Q34 只锁按类型授权/可选 quorum，不锁这些 id/actor/数值 | 使用 `SIM-*` 或显示 `policy unresolved` |
| Waiver 需要 `release-owner + qa-owner` | `SIMULATED GAP` | WEB-P8 的旧问题场景提出但用户没有选择该授权方案；Q34 不指定这两个角色 | 不作为 confirmed policy；只能标 scenario assumption |
| `receipt-HUMAN-P05` 与其他 `PROTOTYPE` receipt | `SIMULATED GAP`，但标签诚实 | 页面明确未写 tracker/repo/canonical state | 可保留；加 `SIM-` 前缀更不易与真实 Receipt 混淆 |

## 当前 fixture 的结构性问题

1. **真实 identity 与 synthetic runtime 冲突。** `#147` 是已完成 map，却被投影成 active、等待人、两 RepoLane、四个 action；这不是“补足缺口”，而是改写真实 Story 状态。
2. **场景把过多异常叠在同一时刻。** contract decision、Profile mismatch、stale QA、human visual gate、跨 tracker lane 同时出现，适合组件覆盖，不足以证明真实 operator journey。
3. **数据散落在 HTML 与 JS。** 同一 rev82、c3、D17、Gate 状态被重复硬编码；没有对象级 provenance、source_ref、captured_at 或 derived_from，UI 无法机械告诉用户某个值从哪里来。
4. **“可执行”外观超出实现事实。** 不存在的命令配 exit 0、不存在的 screenshot 配 PASS、静态 timeout 配“刷新成功”，会让 UI/UX 测试误把演示闭环当产品闭环。
5. **Design QA 的“four real fixture actions”只表示“四条 fixture action 确实渲染”，不表示它们来自真实 Issue。** 当前 QA 可证明布局/交互，不证明 fixture provenance。

## 建议的最小真实样本矩阵

下列四个 dataset 足以同时满足“真实数据为主”和“缺失状态覆盖”，不必把所有状态塞进一个假 #147：

| Dataset | Provenance | 核心数据 | 覆盖目的 | 明确不宣称 |
| --- | --- | --- | --- | --- |
| `REAL-147-CLOSED` | `ISSUE FACT` | #147 title/state/author/label/timestamps；12 个真实 child number/title/state；0 dependency edges；closure comment；commit reference | 默认首页、完成态、真实 Map、Timeline、Source Integrity | 不宣称 RepoLane、Gate、Receipt、owner 或当前动作 |
| `REAL-147-RERUN` | `INTERVIEW FACT + local workflow fact` | manifest 的 1-interview done / 2-prototype pending；Q1～Q35；P3～P7；WEB-P8 的 rework request | 当前工作台真实主动作、阶段门禁、未确认 Web artifact | 不把本地 workflow stage 改写成 GitHub issue state |
| `SIM-XREPO-DEGRADED` | `SIMULATED GAP + DERIVED PROJECTION` | `SIM-STORY-001`；GitHub/GitLab 两 lane；一条 complete、一条 Profile mismatch；candidate 前进使 receipt stale；显式依赖图和排序 rule | 多 RepoLane、fail-closed、stale、主动作/并行队列、Gate 合成 | 不使用 #147 identity、不使用裸真实感 SHA、不声称 GitLab connected |
| `SIM-HUMAN-WAIVER` | `SIMULATED GAP + INTERVIEW FACT rules` | `SIM-STORY-002`；3 个 visual testcase；至少一个 Blocked；policy 假设、quorum、expiry/revocation；全部 evidence 使用 `SIM-*` | Review Workspace、Human Receipt、Waiver/quorum、返回上下文 | 不把具体 role/quorum 当成 Q34 已确认值 |

如果只能保留一个页面入口，推荐默认 `REAL-147-CLOSED`，并提供清楚的 dataset switch：

```text
真实 Issue 快照
  #147 · CLOSED · 12/12 · captured 2026-08-30

覆盖场景（Synthetic）
  Cross-repo degraded
  Human test + waiver
```

不要把 dataset switch 做成不显眼的 Source Integrity 详情；它必须与 Story identity 同层常驻。

## 最小 provenance 数据合同

每个可见事实至少需要以下元数据；字段名可调整，但语义不能省略：

| 字段 | 作用 |
| --- | --- |
| `value` | 页面展示值 |
| `provenance.kind` | `issue_snapshot / interview_round / derived / simulated` |
| `source_ref` | GitHub URL、`manifest.json`、`rounds.jsonl:<physical line>` 或 scenario seed |
| `observed_at` | 真实读取时间；没有就为 null，不造“12 秒前” |
| `truth_scope` | `tracker / workflow / prototype-test / scenario`，防止把两个 lifecycle 混成一个 |
| `derived_from[] + rule_revision` | derived 值的输入和规则；输入 synthetic 时 UI 要继承 synthetic 标记 |
| `scenario_id` | 仅 simulated 数据填写；所有 ID 使用 `SIM-*` namespace |
| `availability` | `available / not_connected / not_run / not_implemented` |

## 替换后的首屏事实组合（不替用户裁决 UI）

基于现有真实材料，一个不冒充运行态的首屏可以表达：

- **Issue 层**：`#147 story 级全链条工作流整合设计 · CLOSED/completed · 12/12 child issues closed`。
- **当前 workflow 层**：`重新设计进行中 · 2-prototype pending · Web artifact 未确认`。
- **当前最高杠杆动作**：完成用户在 WEB-P8 明确要求的三项 rework——fixture provenance、真实浏览器 operator journey、服务十秒读态的可视化表达。这里可从 rounds `:49-50` 直接追溯。
- **真实 Map**：root → #148～#159 parent/sub-issue 关系；native blocker edges 明确为 0。任何阶段归类是 derived mapping，必须显示规则/来源。
- **Coverage gap**：跨 RepoLane 运行态、Registry degraded、stale Receipt、Human/Waiver 都进入独立 synthetic scenario，不伪装成 #147 当前状态。

## 置信度与限制

- **高置信**：#147 与 v3 runtime 字段不一致；真实 tracker 分片已直接列出 API 字段，而 v3 具体 runtime literals 只出现在 prototype/后续 prototype facts 中。
- **高置信**：`workflow-story-map/run-tests.mjs`、`workflow-story-map/scripts/story.mjs` 和 `story-console-c3-768x1080.png` 当前不存在；不能作为运行/证据事实。
- **高置信**：多 RepoLane、Receipt/Gate/Registry/Human 授权等规则来自访谈，但 #147 API 不提供这些运行值。
- **限制**：本分片没有递归读取 12 张 child issue 的完整评论、依赖和证据；真实 Map 只能使用已抓取的 child 摘要与 root relations，不能自行推导 child 间 blocking edges。
- **限制**：其他 agent 可能在本审计后修改 v3；若 HTML SHA 改变，需重新核对新增/替换字段，本结论不能自动覆盖未知的新 fixture。

