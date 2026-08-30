# Fact: Web v3 → v4 UX 保留项与理解障碍审计

- 调查对象：`2-prototype/drafts/v3-product-prototype.html`、`v4-map-first-prototype.html`、两版 rationale、Product audit、Design QA 与 `evidence/webp8`、`evidence/webp9-v4` 截图/机器结果。
- 问题：v4 修正“固定阶段”后，v3 有哪些值得保留的 UX 被一并丢失；v4 为什么仍可能让人难理解；哪些问题属于 Story Work Graph 主任务，而不是外围 polish。
- 边界：只读证据审计。本文不设计 v5 最终布局，不替用户选择，也不修改 prototype、manifest、rounds 或 context。
- 完成时间：2026-08-30。

## 结论摘要

v4 正确修复了 v3 的领域表达错误：默认 Map-first、Discovery/Delivery 是两张动态图、Contract 是 seam、固定六阶段 DOM 数为 0。这一方向不应倒退。

但 v4 同时弱化了 v3 最有价值的“操作工作台”能力。v3 在不读图的情况下即可直接回答：**当前最重要的是什么、为什么、谁负责、可以同时做什么、每条 RepoLane 卡在哪里、下一步按钮在哪**。v4 把这些信息拆散到地图节点、42px footer、折叠 Inspector 和独立“行动投影”页；人在 768×1080 首屏先看到 18 个近似矩形节点和多类边，需要自己拼出 Story 状态与操作顺序。

因此真正需要保留的不是 v3 固定阶段 rail，而是 v3 的五类操作投影：

1. 当前 Story 的人话结论与唯一主动作；
2. 主动作排序理由与安全并行项；
3. RepoLane 当前态、owner、blocker、next；
4. 选中对象的非遮挡 Now/Why/Owner/Next/Unlocks；
5. blocked/stale/degraded/source truth 的可见原因和恢复入口。

这些应继续由同一个 Story Work Graph read model 派生，不能作为另一个彼此漂移的工作台真源；但它们是否以 overlay、beacon、peek、navigator 或其他形式呈现，本文不替用户裁决。

## 1. v4 已经做对、不得倒退的部分

| Evidence | 结论 |
| --- | --- |
| `v4-map-first-rationale.md`“这次纠正了什么”“唯一稳定的顶层结构”；`webp9-v4-product-audit.md:1-2` | v4 正确区分了动态 DiscoveryMap、Contract revision seam、动态 DeliveryMap、RepoLane Gate 与 Story reducer。 |
| `v4-map-first-prototype.html:33-47,150-199` | 第一视图是一张同时容纳两图和 seam 的画布；节点来自实际 dataset，而不是六个固定槽位。 |
| `evidence/webp9-v4/audit-results.json.flow.initial` | 默认 view=`map`、固定阶段元素为 0、真实 Discovery 12 nodes、Delivery 0 verified。 |
| `v4-map-first-prototype.html:169-195`；`audit-results.json.flow.simInitial` | SIM dataset 确实有 6 个 Discovery、11 个 Delivery 节点、两个 frontier、两条 RepoLane 和 1 条 requires-decision 回流边。 |
| `v4-map-first-prototype.html:229-235`；`audit-results.json.flow.sourceModal/reviewReturn` | v3 的 provenance 隔离、Source Modal、Review Workspace 与返回恢复被保留。 |

**高置信结论：** v3 固定六阶段、Queue-first 默认页与 Map 第二视图已被用户明确推翻，不属于“应保留优势”。保留工作台优点不等于恢复固定流程。

## 2. v3 被 v4 丢失、但值得保留的 UX 优势

### P0 — v3 的单一 Story Pulse 是即时可行动的；v4 的 NEXT 被降成图脚注

**Evidence**

- v3 在 Story 标题下常显一条 Pulse：结论、解释、44px 主 CTA、“查看排序依据”和安全并行项。`v3-product-prototype.html:80-91,350-360,494`。
- v3 SIM 首屏截图中，“SIM-DESKTOP 已暂停；需要处理模拟 API 决策”“决定模拟 API 行为”“恢复 SIM-DESKTOP 执行规则”在同一视觉块内可读。`evidence/webp8/05-scenario-overview.png`。
- v4 只在地图 footer 的 `frontier-summary` 显示一句 NEXT，宽度上限为 46%，字体 10px，并允许省略号截断。`v4-map-first-prototype.html:47,199,207`。
- v4 的主动作不在地图节点上显示明确 CTA；节点 `dblclick` 会直接 `runPrimary(n)`，但页面没有可见说明这一手势。单击后仍需再展开 64px Inspector 才能看到主按钮。`v4-map-first-prototype.html:55,130-135,209,216-219`。

**Inference（高置信）**

v4 保留了主动作数据，却丢失了 v3 的“第一眼行动结论”。对不熟悉 graph 语法的人，`NEXT` 是画布底部的小文本而不是明显可执行对象；双击节点还是隐藏交互。

**应回到 Story Work Graph 主任务的能力**

- Graph 的主 read model 必须直接投影唯一 `next_safe_action`、Why、Owner、Unlocks 与 primary CTA；不能要求先切“行动投影”或猜双击。
- 安全并行项也必须与主动作保持可见关系；不要求恢复 v3 大 Pulse 卡，但不能只剩 footer 文本。

### P0 — v3 把“当前本地工作”放在历史 Issue 之前；v4 默认视觉更像“#147 已完成”

**Evidence**

- v3 真实页用蓝色主 Pulse 明确写“本次 workflow-story-map 重设计尚未确认”，并把 `12 / 12 CLOSED` 降为历史 Issue 证据。`v3-product-prototype.html:280-286`; `evidence/webp8/01-real-overview.png`。
- v4 首屏标题是 `#147`，第一 badge 是 `CLOSED · completed`，Discovery 显示 12/12；当前 `2-prototype pending` 只是一枚较弱 badge，并在 DeliveryMap 下半部另放 dossier sidecar。`v4-map-first-prototype.html:151-163,198,210`; `evidence/webp9-v4/01-current-global-map.png`。
- v4 data 本身诚实声明 dossier 不是 tracker member，但画布的最大实体仍是已关闭 StoryRoot，当前 Web rework 没有成为图中的主行动节点。`v4-map-first-prototype.html:151,198,210,221`。

**Inference（高置信）**

v4 的 truth 边界比 v3 更准确，但“CURRENT STORYROOT”命名和 CLOSED 大锚点会让人把历史 #147 与当前 prototype 工作混为一个完成现场。真实页的 Action Queue 其实知道 `DOSSIER-WEB-P9 进行中 / WEB-CONFIRM 等待你 / GOAL-CONTRACT 阻塞`，但默认 Map 中这些只存在 sidecar，不是可追踪工作节点。

**应回到 Story Work Graph 主任务的能力**

- StoryRoot 全局投影必须区分“tracker Story 历史终态”和“当前 dossier/重新裁决任务状态”，并明确哪一个是当前操作者的 action scope。
- 如果 dossier 不是 tracker member，它仍需以有来源边界的 sidecar/work item projection参与当前状态理解；不能只在第二页的 Action Queue 才成为主工作。

### P1 — v3 的行动队列同时给状态、原因、后果与等待条件；v4 行动投影过度简化且不可操作

**Evidence**

- v3 action row 为三列：route、标题/原因、wait/consequence；主动作、可并行、等待 Registry、等待 QA Receipt 与最终 Gate 都有明确文字。`v3-product-prototype.html:110-114,390-399,491-494`; `evidence/webp8/05-scenario-overview.png`、`08-scenario-blocked-human.png`。
- v4 “行动投影”只有两条当前 frontier，render 为普通 `<div class="queue-row">`，不是 button，也没有从行返回地图或执行 action 的事件绑定。`v4-map-first-prototype.html:50,221,239-246`。
- v4 该页在 768×1080 截图中两行下面几乎全为空白；主动作只有 `PRIMARY · FRONTIER` 文字，没有直接 CTA。`evidence/webp9-v4/11-sim-action-projection.png`。

**Inference（高置信）**

v4 兑现了“行动页只是地图派生”，但没有兑现“行动投影可帮助人完成任务”。它更像一份摘要清单，不像操作面。

**应回到 Story Work Graph 主任务的能力**

- Action projection 与 map selection 必须双向定位，并保留状态、等待原因、consequence 和动作入口。
- 是否保留独立 Action 页可以后续裁决；但 action row 不能成为无交互的第二份摘要。

### P1 — v3 的 RepoLane rail 能独立扫读；v4 lane band 只提供分区标签

**Evidence**

- v3 `lane-row` 同时显示 lane identity、局部轨迹、当前状态、candidate/profile、下一动作与 owner。`v3-product-prototype.html:115-122,395-399`; `evidence/webp8/05-scenario-overview.png`。
- v4 的 RepoLane 只由两个 86px 高的虚线 band 和一行 `lane-name · required · target` 表达；lane 本身不是可选择对象，没有 lane owner、最差 Gate、当前 blocker、next action 或 freshness。`v4-map-first-prototype.html:40,182-187,210`。
- v4 Story reducer 通过两条红边连接 Gate，用户必须沿节点和边推断哪条 lane 卡住。`evidence/webp9-v4/05-sim-global-dual-map.png`。

**Inference（高置信）**

v4 图能证明拓扑，但不再支持像 v3 一样横向比较每条 RepoLane 的“现在怎样/下一步是什么”。对多 RepoLane Story，这会直接损失全局掌控。

**应回到 Story Work Graph 主任务的能力**

- RepoLane 必须有一等可选/可定位投影，至少暴露 required/optional、owner、current subject、最差 Gate、blocker、next 与 source freshness。
- 这些 lane facts 必须与图中节点/Gate同源；不能恢复成另一个人工维护的固定阶段 rail。

### P1 — v3 的 selected context 在同屏可读；v4 展开 Inspector 会遮住被选中的 Delivery 节点

**Evidence**

- v3 Map 在 768px 使用左侧 `map-context` + 右侧图，同屏显示原问题、当前结论、影响、来源和动作；底部 Inspector peek 仍保留选中对象与 CTA。`v3-product-prototype.html:139-150,404-407`; `evidence/webp8/07-scenario-map-reset.png`。
- v4 在 ≤1180px 时 Inspector 默认只有 64px，Now/Why/Next、tabs 和 actions 全部 hidden；点击“展开”后高度可达 70dvh。`v4-map-first-prototype.html:55,130-135`。
- `07-sim-web-qa-selected.png` 显示展开 sheet 从 y≈568 到页面底部，覆盖 DeliveryMap 大部和被选中的 `SIM-W2-WEB-Q` 节点；用户能读详情，但无法同时核对它在 RepoLane、Gate 与 Story reducer 中的位置。
- v4 audit 只断言 Inspector 能打开、内容存在、返回可恢复；没有“选中节点与一跳上下文仍可见”的可用性断言。`audit-results.json.flow.webQa/reviewReturn`。

**Inference（高置信）**

v4 的渐进详情在机械上可用，却破坏了 map-first 的核心价值：查看 Why 时拓扑被遮住。v3 虽然 Map 不是默认页，但它的 selected context 更容易同时理解。

**应回到 Story Work Graph 主任务的能力**

- 首次选择必须在不遮掉目标节点与一跳关系的情况下显示 Now/Why/Owner/Next/Unlocks 和动作入口。
- 完整证据 Workspace 可以覆盖地图，但 peek 层不能要求人丢失定位上下文。

### P1 — v3 有对象导航、搜索和状态筛选；v4 导航只在两个 dataset 间切换

**Evidence**

- v3 side 提供 Story/关注 tab、搜索框、状态 filters 和对象列表；宽屏常驻、768px 变 drawer。`v3-product-prototype.html:48-70,225-251`。
- v4 drawer 只有三个入口：#147 dataset、SIM dataset、Source Integrity；页面没有 node/title/owner/RepoLane 搜索。`v4-map-first-prototype.html:139-140,243`。
- v4 Map 只有 `全部 / Frontier / 阻塞回流` 三个 lens，以及顺序式 keyboard navigation。`v4-map-first-prototype.html:33-35,213-215,239`。

**Inference（高置信）**

当前 fixture 18 nodes 尚能浏览；真实 Story 节点增长后，没有搜索/locate 会让用户依赖缩放和肉眼找节点。v3 的 findability 优势被丢失。

**应回到 Story Work Graph 主任务的能力**

- node/owner/RepoLane/Ticket ID 搜索与 locate 属于主图可用性，不是外围 polish。
- 筛选后必须保留 StoryRoot、active/human beacons 与跨图 loopback 上下文，避免把风险从图里过滤掉。

### P1 — v3 的阻塞原因与恢复路径常显；v4 主要靠细边框和打开 Inspector

**Evidence**

- v3 Action Center 对不可执行 Human Test 明确写 `等待模拟 QA Receipt`，CTA disabled；Profile degraded 直接给恢复路径。`v3-product-prototype.html:491-493,505-508`; `evidence/webp8/08-scenario-blocked-human.png`。
- v4 blocked/locked/stale 的主视觉主要是 1px border、node-state 的 8px 文本与红边；map footer 图例只解释边类型，不解释 node kind/state。`v4-map-first-prototype.html:41-47`。
- v4 Story Gate、WEB Review、CORE Gate 都是相似白色矩形；恢复动作与等待原因只有点选后在 Inspector 才能读。`v4-map-first-prototype.html:181-187,216-218`; `evidence/webp9-v4/05-sim-global-dual-map.png`。

**Inference（高置信）**

v4 的状态数据完整，但视觉层没有让 blocked、awaiting human、degraded、stale、Gate locked 形成足够不同的操作语义。边的颜色解释多于节点状态解释。

**应回到 Story Work Graph 主任务的能力**

- 主图必须能在不点开每个节点时区分“在运行 / 可领取 / 等前置 / 等人 / degraded / stale / Gate locked”，并暴露 blocker/recovery。
- 状态不能只靠 8px 枚举或颜色；需要人话标签或可访问文本与相邻恢复入口。

### P2 — v3 的 Evidence reader 更接近对象上下文；v4 Evidence 页是稀疏账本

**Evidence**

- v3 交付与证据页使用 Gate index + Receipt reader，Receipt 明确 subject、bound/current、stale rule、真实命令状态和下一动作。`v3-product-prototype.html:151-159,411-414`; `evidence/webp8` 旅程和 `webp8-product-audit.md`。
- v4 Evidence 页只有 4 行 ledger：2 stale、1 fresh、1 missing；行不是可交互对象，也不能回到对应 map node。`v4-map-first-prototype.html:50,222`; `evidence/webp9-v4/12-sim-evidence-history.png`。
- v4 文案标题叫“证据与历史”，但实际没有 actor/time/transition event history，只有 current contract evidence list。`v4-map-first-prototype.html:50,222`。

**Inference（高置信）**

v4 证明了 Receipt freshness 的分类，却不足以支持追责、核验或从证据定位到 Gate/Ticket。v3 的对象化证据阅读能力值得保留。

**主任务/次级任务边界**

- Receipt/Gate freshness 对 Story done 的影响必须回到主图节点/边和 selected peek。
- 完整 Receipt 内容、Actor、Attempt、时间线可继续作为第二层 Evidence Workspace，不必挤进首屏地图。

## 3. v4 让人难理解的具体原因

### 3.1 同一视觉形状承担过多异质语义

v4 的 research、decision、contract、implementation、QA、review、Gate、Story 全部是近似白色圆角矩形，只用 4px 左边色、1px border 和 8px state 区分。`v4-map-first-prototype.html:42-44`。

**Inference：** 人需要同时学习“左边色=kind、边框/文字=state、band=lane、zone=map、红线=block/return、seam=contract”，认知成本高于 v3 的“先读行动行，再按需看图”。截图 `05-sim-global-dual-map.png` 中 frontier、blocked、locked、passed 的视觉差异在第一眼并不强。

### 3.2 图中没有 node kind/state 图例

footer legend 只解释 member、requires/verifies、requires-decision；没有解释 research/decision/QA/review/Gate 左边色，也没有解释 closed/running/ready/blocked/locked/stale。`v4-map-first-prototype.html:47`。

**Inference：** 即使数据正确，首次用户无法从页面本身学会节点语法。

### 3.3 NEXT 不附着在目标节点上

`SIM-W2-WEB-Q` 只有 `is-primary` accentSoft，没有显式 `NEXT` 文本；NEXT 只在 map footer 和 Action 页出现。`v4-map-first-prototype.html:42,47,180,199,207-209`。

**Inference：** 用户要先读 footer，再在 18 个节点里按 ID 找到对应节点；视觉上不是“下一动作直接从图里长出来”。

### 3.4 边交叉和回流线跨越多个区域

SIM 图同时绘制 contract→StoryRoot、StoryRoot→两 lane、QA→Review→Gate、两 Gate→reducer、wave-1→Discovery 回流。`v4-map-first-prototype.html:189-195`。

截图 `05-sim-global-dual-map.png` 中红色回流虚线穿过 seam 与 DeliveryMap 顶部，多条红色 Gate 边在 reducer 前汇聚。**Inference：** 这是语义真实但追线困难；当前没有 hover 邻居高亮、edge focus 或路径说明来降低复杂度。

### 3.5 8–10px 图内文字在 768px 已偏小，480 Fit 后不可作为阅读文本

- node ID/state/profile 与 edge label 使用 8px，node title 10px。`v4-map-first-prototype.html:41-43`。
- 480px 自动 Fit 为 57%/61%，审计明确把它称为 topology overview。`audit-results.json.responsive.viewport480Current/viewport480Scenario`; `design-qa.md`。

**Inference：** 480 下有效图中文字约 4.6–6.1px，只能看结构不能读内容。虽然 480 是补充视口，这证明 v4 高度依赖 Inspector/List fallback，不能把 Fit screenshot 当“可理解性通过”。

### 3.6 “当前 Story”真实样本不是 active runtime

真实 dataset 的 StoryRoot 已 CLOSED，DeliveryMap 为 0 verified，Repo runtime NOT_CONNECTED；当前 prototype 工作是 sidecar。`v4-map-first-prototype.html:150-168,198,210`。

**Inference：** 它非常适合证明 truthfulness，却不能验证用户真正要用的 active Story 操作体验。SIM 图证明了结构承载力，但不能替代真实操作者对当前状态的理解。

### 3.7 机器 PASS 没有覆盖理解成本

`webp9-v4-product-audit.md` 和 `design-qa.md` 的 PASS 主要证明：元素数量、固定阶段=0、node/edge 数、焦点、交互可达、viewport overflow、target size、console error 与返回恢复。`audit-results.json` 也没有 comprehension、time-on-task、error rate 或“十秒能否回答四问”的字段。

**Inference（高置信）：** “没有 P0/P1/P2 finding”只能代表该轮实现与其 source visual 对齐，不能证明普通人理解双图或找到下一动作。没有独立真实用户任务测试。

## 4. 必须纳入 Story Work Graph 主任务的保留要求

以下是**能力边界**，不是最终页面方案：

| 主任务必须承载 | 为什么属于 Graph 主任务 | v3 证据 | v4 当前缺口 |
| --- | --- | --- | --- |
| Story 当前结论 + 唯一 next safe action | 它决定全局 frontier 的读法 | Pulse + CTA + ranking | NEXT 是 footer 文本，node 无明确 CTA |
| 安全并行及排序依据 | 避免把多 frontier 误读成任意顺序 | parallel queue + rank details | 只在 footer/Action 页说一句 |
| RepoLane 一等聚合 | Story done 由 required lane Gate 合成 | lane rail 可扫 owner/next/current | band 只有名称和 target |
| Selected Now/Why/Owner/Next/Unlocks | 图要成为可操作 read model | map-context + bottom peek | 展开 sheet 遮住 Delivery topology |
| blocked/human/degraded/stale/Gate locked 的原因 | 这些决定可否行动与恢复 | action row 常显 wait/recovery | 需逐节点点开，node legend 缺失 |
| Search/locate/filter + 图/list 共用 selection | 节点增长后仍能找对象 | side search/filter/navigator | 无 node search，drawer 只切 dataset |
| Tracker Story 与 dossier/current effort 的边界 | 防止历史 CLOSED 冒充当前工作完成 | real Pulse 先说 pending | sidecar 次于 CLOSED root |
| Receipt/Gate freshness 对路径的影响 | stale 直接改变 Gate 与 Story done | Receipt reader + stale action | Evidence ledger 与 map 不双向定位 |

## 5. 可以继续留在第二层、无需塞回首屏的内容

- 完整 Action Queue：可以作为地图派生视图，但必须与 node 双向定位且有动作入口。
- Receipt 全文、Attempt、Actor、SHA、完整 event timeline：继续放 Evidence/History Workspace。
- 多 testcase、Waiver、quorum、证据对照：继续使用 Review Workspace。
- Source Integrity 详情：继续放 Source Modal，但 source/freshness 摘要需要在 Story/RepoLane/selected context 常显。
- 被否路线、历史 wave、author progression：默认折叠，通过 lens 按需展开。

## 6. Ranked synthesis

| Rank | 解释 | 置信度 | 依据 |
| --- | --- | --- | --- |
| 1 | v4 最大理解缺口不是“图不够漂亮”，而是把 v3 的主动作、排序理由、lane 状态与阻塞解释从首屏降到了 footer、折叠 Inspector和第二页。 | High | v3/v4 HTML 结构、`05-scenario-overview.png`、`05-sim-global-dual-map.png`、`11-sim-action-projection.png` 对照一致。 |
| 2 | v4 图例和视觉编码不足以支撑 8 类 node kind × 6 类 state × 多 edge type 的首次理解。 | High | v4 CSS/legend 直接证据；SIM 图 18 nodes 同形矩形。 |
| 3 | 真实 #147 dataset 虽诚实，但不代表 active Story 操作体验；它会放大“历史 closed vs 当前 dossier pending”的认知冲突。 | High | dataset 源码、真实首屏与 audit initial。 |
| 4 | v4 的内部 QA PASS 被解释过宽；它证明 mechanics 与 source fidelity，没有证明人类十秒读态。 | High | audit assertion 范围与 residual gaps；无 comprehension 测试。 |
| 5 | v4 的 Map-first 方向本身错误。 | Low / 不支持 | WEB-P9 明确要求 Map-first；v4 已修复固定阶段误建模。证据支持的是保留工作台投影，不是回退到 v3 默认页。 |

## 7. Unknown / NOT_RUN

- 没有真实用户在 768×1080 上执行“十秒回答 Story Now/Why/Owner/Next”的任务数据、录屏、错误率或主观理解评分。
- 没有真实同构 active Story runtime；v4 active path 仍是 SIM fixture。
- 未执行真实 screen reader、200% zoom、Windows high contrast、320px；两版 audit 都明确保留这些缺口。
- 本分片没有启动浏览器或重新截屏；视觉判断基于当前仓库已保存并在本轮重新打开检查的对照截图。
- 本文不裁决最终是 overlay、beacon、peek、navigator、lane strip 还是其他视觉形式；只锁定不得丢失的操作能力与证据缺口。

