# Fact: Web v4 Story 双地图优先的视觉模式

- 调查范围：`G:\GIT\AI_WorkFlow\aes-workflow\skills\engineering`、本仓 `skills/workflow/aes-worktree-board`、当前 `v3-product-prototype.html` 与 Issue #147 已记录的双图语义。
- 目标视口：Codex 右侧 Web 面板，主验收尺寸 `768×1080`。
- 调查性质：只读。本文给出源码事实与高置信视觉推论，不替用户确认最终 Mock，不修改 prototype、manifest、rounds 或 context。
- 完成时间：2026-08-30。

## 一句话结论

v4 不应继续把 `Discovery / Contract / Delivery / QA / Integration / Closeout` 当成 Story 的固定阶段轨。当前 Story 的第一可视化应是一张**上下贯通的双星图画布**：上半部是动态 `DiscoveryMap`，下半部是动态 `DeliveryMap`，中间只有一条可版本化的 **Contract seam**。所有节点来自实际探索出的 WorkTicket；QA、Review、Integration、Human Test 等是 DeliveryMap 中由 Profile/Gate 决定是否出现的节点或证据，不是所有 Story 必经的槽位。

在 768px 宽度里，两张图不宜左右各占半屏；应上下共用全宽，并通过 Contract seam、跨图 `produces` 边和 `requires-decision` 回流边表达关系。StoryRoot 是两张子图的共同锚点与最终终态持有者。

## 1. 已确认的领域事实

1. 一个稳定 `StoryRoot` 下常驻 `DiscoveryMap` 与 `DeliveryMap` 两个子图；两者各有独立 frontier 与局部终态，只有 StoryRoot 拥有最终 `story done`。`1-interview/context.md:17,94,122`。
2. Delivery 发现若不改变 Contract，可自动进入下一 Delivery wave；改变用户承诺或无法分类时，用 `requires-decision` 回流 Discovery，Contract revision 后旧证据 stale。`1-interview/context.md:27,122`。
3. 一个 StoryRoot 可包含多个一等 RepoLane；每条 lane 有自己的 repo/tracker/checkout/integration/Gate，所有 required lane 的局部终态合成 Story done。`1-interview/context.md:28,94`。
4. 用户在 `WEB-P9` 已明确要求“当前 Story 全局地图成为第一可视化”，并明确推翻 P3 的 Map 第二视图、WEB-P7 固定六阶段主坐标与 WEB-P6 Queue-first 首屏密度目标；P4 的单一主动作 + 安全并行、WEB-P5 分级 Review、WEB-P8 provenance 隔离继续保留。`1-interview/rounds.jsonl:53`。

## 2. 顶部六阶段究竟是什么，为什么现在不成立

### 源码事实

- v3 的六阶段来自 `WEB-P7`：为了跨 Story 扫读和固定空间记忆，把所有 Story 映射成 Discovery → Contract → Delivery → QA → Integration → Closeout，并以 `N/A` 填补不适用项。`2-prototype/drafts/v3-product-design-rationale.md` 的“已锁定的 Web 产品裁决”明确记录了这个来源。
- v3 HTML 把六格做成 sticky `spine`，在 768px 宽度仍强制六格等宽；真实 #147 页也把子票标题有限映射到 Discovery/Contract，把其余格子填成 `N/A / NOT_RUN / NOT_CONNECTED`。`v3-product-prototype.html:92-97,204-208,290-295,365-370`。
- AES Engineering Console 的固定 stage rail 是 repo Artifact 流程的投影，不是 WayFinder 路线图。WayFinder 自身使用动态 nodes/edges/frontier/tasks，stage rail 只是另一视图的工程产物索引。`aes-using-workflow/console/template.html:151-196,3754-3791,4191-4285`。
- WayFinder 的 map 只保存目的地、领域、已决策、fog 与范围外；开放问题、候选、claim 和执行态在 ticket 中实时派生，frontier 也从 ticket 状态与依赖动态计算。`aes-wayfinder/SKILL.md:14-17,69-86`。

### 设计判断

六阶段把两种不同东西混成了一条看似固定的瀑布：

- `Contract` 不是“走完的一格”，而是 Discovery 决策产出的版本边界；它决定 Delivery wave 绑定哪个承诺。
- `QA`、`Review`、`Human Test`、`Integration` 是 ticket profile、Gate 和 evidence topology 的动态组成。某些 Story 会出现多个 QA/Review 节点，某些纯调查 Story完全没有这些节点。
- `Closeout` 是 StoryRoot 的终态合成，不是 RepoLane 的末端工作节点。
- Delivery 的 regression、漏实现或新增测试会产生下一 wave；需求改变会跨 seam 回流 Discovery。固定从左到右六格无法诚实表达这种循环。

因此 v4 应删除顶部六阶段 rail 的主导航地位。若未来仍需要培训或跨 Story 比较，可把这些词降为**可选统计 lens**，例如“需求类 / 执行类 / 证据类 / 收口类”计数；不得再成为节点位置或完成顺序的来源。

## 3. 768×1080 的首屏层级

推荐首屏不是“标题 + Pulse + 阶段 + Queue + 第二层 Map”，而是：

```text
46px  Shell
      product identity · source mode · snapshot/freshness · reset/refresh

72px  Story strip
      StoryRoot identity · contract rN · 2 map frontiers · required lanes · global health

其余高度全部给 Global Map Canvas
┌────────────────────────────────────────────────────────────┐
│ DISCOVERY MAP · dynamic frontier                           │
│  unknown / research / grilling / prototype / decision     │
│                                                            │
│ ── Contract seam · r4 · produced by D12,D17 ───────────── │
│    StoryRoot anchor              ↖ requires-decision       │
│                                                            │
│ DELIVERY MAP · wave 3 · dynamic frontier                  │
│  implementation / fix / QA / review / human / acceptance  │
│                                                            │
│ [selected object peek: NOW · WHY · OWNER · NEXT · UNLOCKS]│
└────────────────────────────────────────────────────────────┘
```

### 空间预算

- Map canvas 应占 shell 以下可用面积的至少 70%；它不是一张卡片，而是页面背景层。
- DiscoveryMap 使用约 30–34% 的画布高度；Contract seam 约 52–64px；DeliveryMap 使用剩余约 55–60%。Delivery 通常节点更多，但两者都保持全宽。
- 选中对象的 peek 是画布底部 104–124px 的覆盖层，不永久挤压画布。展开完整证据时才成为 55–68dvh 的 sheet。
- Story strip 只给身份、truth/source health 与地图级摘要；不再放六阶段、KPI 卡墙或五六条 Action 队列。

## 4. 两张图的空间关系

### DiscoveryMap：需求地图

- 动态节点来自 `research / grilling / prototype / decision / task` 等实际 WorkTicket。
- 重点表达：未知是什么、候选路线、已采纳决定、被否路线、当前 frontier、谁在探索、哪些节点产出 Contract revision。
- 已解决节点收敛成小星点；frontier、claimed、blocked、human 节点保持完整标签。
- 被否候选默认折叠成灰色虚线残枝；选中主节点或打开“被否路线” lens 后再展开。这是 AES WayFinder 已有且适合复用的表达。`aes-wayfinder/SKILL.md:104-107`; `aes-using-workflow/console/template.html:4017-4053,4171-4188`。

### Contract seam：版本边界，不是第三阶段

- 画布中部是一条细的版本带，显示 `contract rN`、产生它的 Discovery decision、绑定的 Delivery wave、fresh/stale 状态。
- Discovery → Delivery 的 `produces / graduates_to` 穿过 seam 向下。
- Delivery → Discovery 的 `requires-decision` 以反向虚线弧穿过 seam 向上；边上直接写“改变承诺”或“无法分类”，避免把回流误读成失败重跑。
- revision 变化时旧 Delivery receipts 保留在图中但降亮并带 `STALE · subject changed`，不能消失，也不能继续满足 Gate。

### DeliveryMap：实现地图

- 动态节点来自真实实现波次：implementation、bug/fix、QA、review、acceptance、human test、merge/integration、closeout decision 等 WorkTicket。
- QA/Review/Integration 不固定占列。它们只在 Profile/Gate 要求时出现；同一 wave 可以有多个并行 QA/Review 节点。
- 多 RepoLane 用轻量“territory hull”或节点 lane tag 表达，不用固定 swimlane 列强迫拓扑。宽屏可以显示半透明 lane hull；768px 只保留边界线、lane 色签和 lane beacon，避免每个 lane 被压成窄列。
- Gate 和 Receipt 是节点旁的证据挂点/徽标；只有满足独立 owner/context/blocking/retry 条件时才晋升成自己的 WorkTicket 节点。

## 5. StoryRoot、frontier、loopback、selection 与下一安全动作

### StoryRoot

- StoryRoot 是 Contract seam 左侧或中部的稳定大锚点，永远可见。
- 它展示 `story lifecycle / control / gate` 的合成状态、required RepoLane 数、两个 map frontier 数、当前 Contract revision。
- StoryRoot 不代替两张图，也不把 Issue CLOSED 当 `story done`。

### 两个 map frontier 与一个 Story action frontier

- DiscoveryMap 与 DeliveryMap 各有自己的 frontier halo 和计数；不能合并成一个模糊“进行中”。
- Story Core 再从两个 frontier 计算一个全局 `next_safe_action`，但 UI 不应自己从图边、颜色或标题猜排序。
- 被选为全局主动作的节点得到常显 `NEXT` beacon；安全并行节点得到较弱的 `PARALLEL` 标记和数量，不把完整 Queue 抬到地图上方。
- 点击 `Discovery frontier · 2` 或 `Delivery frontier · 3` 应 fit 到对应 frontier 子集；点击 `NEXT` 直接聚焦目标节点。

### Loopback

- `requires-decision` 不是跳回一个固定 Discovery 阶段，而是创建或重新打开一个具体 Discovery ticket，并保留触发它的 Delivery finding。
- 视觉上必须同时看到起点、终点、跨 seam 的反向边和被影响的 contract/wave；只显示“回到 Discovery”会丢失审计关系。
- Contract 不变的发现则在 DeliveryMap 内通过 `produces` 进入下一 wave，不跨 seam。

### Selected object

复用 board 竖屏工作台的三级渐进披露：

1. 默认全局图只保留高信号节点。
2. 选中节点后，节点移到局部视觉中心，展开一跳邻居，非相关节点降到约 12–18% 不透明度；running/human owner beacon 最低仍保持约 50%，不能被过滤掉。
3. 同时打开底部 peek，固定回答：`NOW / WHY / OWNER / NEXT / UNLOCKS`。再点“完整证据”才进入 Receipt、Gate、Attempt、timeline 与 Review Workspace。

相关可复用事实：board 的选中态会重排一跳邻居、淡出无关节点、保持 beacon、打开 peek sheet，并能恢复焦点。`aes-worktree-board/board.html:287-318,327-359,453-490`。

### Next safe action

- 主动作是地图上的一个**目标节点 beacon + 底部 peek 中唯一主 CTA**，而不是地图外的大卡片。
- Peek 必须显示“为什么排第一”“需要谁”“做完解锁什么”“是否存在安全并行”，保留 v3 P4 的语义。
- 简单、可逆动作进入 Modal；多 testcase、Waiver、quorum、证据对照继续进入 Review Workspace，并恢复 map transform、selection、sheet tab 与触发焦点。
- 动作完成后保持 Ticket ID 对应的位置稳定，只增量移动受影响节点；用 300–600ms 过渡解释 frontier 重算，`prefers-reduced-motion` 下直接切换。

## 6. 状态视觉语法

建议沿用 board 已验证的“状态形状 + 色彩 + beacon”，但替换其单仓 Issue 四态为 Story Ticket 状态：

| 语义 | 地图表达 | 原因 |
| --- | --- | --- |
| frontier / 可行动 | 陶土色实心核心 + 双层 halo + 完整标签 | board 的 frontier 最醒目且可扫读 |
| claimed / running | 紫色核心 + 缓慢 pulse + owner/agent beacon | 人随时知道谁在做什么 |
| blocked | 空心虚线节点 + blocker edge 加深 | 不把“没开始”与“不能开始”混淆 |
| awaiting human | 琥珀核心或外环 + 人类 beacon | 与普通 blocked、agent running 分开 |
| resolved | 小型低对比实心点，默认只显示 ID | 保留路线记忆但不抢焦点 |
| stale evidence | 节点/证据挂点带斜线或 `STALE` 角标，旧边保留 | stale 是审计事实，不是删除 |
| degraded/source blind | 断续外框 + persistent source-health badge | 不能用绿色总状态吞掉 |
| selected | 深墨双描边，不只靠状态色 | 任意状态都能清楚被选中 |

边的最小闭集：

- `depends_on`：中性实线箭头；
- `produces / graduates_to`：向下穿 seam 的实线；
- `requires-decision`：向上穿 seam 的陶土/危险色虚线弧；
- `rejected`：灰色细虚线残枝；
- `membership`：极浅、无方向的 StoryRoot/RepoLane 归属边，不与业务依赖争夺视觉权重。

## 7. 缩放、平移与窄栏策略

### 768×1080 主策略

- 初始不是固定 `100%`，而是 `Fit Story`：同时容纳 StoryRoot、两张 map 的高信号节点和 Contract seam。
- 缩放范围可复用 board 竖屏值 `55%–250%`；滚轮以指针为中心、拖拽平移、触屏支持 pinch。`aes-worktree-board/board.html:474-490`。
- 44px 控件只保留 `− / 百分比 / + / Fit Story / Focus`，贴画布右下；搜索、legend 和 source health 使用可收起浮层，不再占固定垂直轨道。
- 位置按稳定 Ticket ID 持久化；新节点做增量布局。禁止每次刷新都重新随机 force layout，否则跨会话恢复会失去空间记忆。board 的设计文档也要求“力导向计算一次后冻结，更新时增量重算”。`docs/design/design_handoff_issue_starmap/README.md` 的 Interactions 7。

### Level of Detail

- `≥90%`：title、owner、ticket/profile、Gate 摘要全显；
- `60–89%`：ID + 短标题；frontier/running/human 仍显示 owner beacon；
- `<60%`：resolved 退成星点，只有 StoryRoot、frontier、running、blocked、human 和 selected 保持标签。

### 更窄视口

- `601–900px`：仍同时显示上下双图，不切成 Queue-first；地图内部局部缩放/pan，页面本身不横向滚动。
- `≤600px`：默认仍给全局 Fit Story，但可用 `全局 / 需求 / 实现` 三个 focus lens；lens 只是镜头，不是三套状态。另一张图的 frontier 和跨 seam loopback 必须留作 mini-rail，避免切换后忘记全局关系。
- 任何宽度都提供 List fallback，按 `需要人 / 被阻塞 / 进行中 / frontier / 已解决` 排列；它是可访问性与高密度替代，不取代默认地图。

## 8. 三个现有实现最值得复用的部分

| 来源 | 可直接复用的表达 | 不应照搬 |
| --- | --- | --- |
| `aes-worktree-board` 竖屏工作台 | 全屏星图；节点形状编码；worker/owner beacon；一跳聚焦；底部 peek→完整详情；search/filter/locate；pan/zoom/pinch；44px 控件；焦点恢复 | 单仓 Issue 四态、closed/total 进度、静态 demo stage 字段、RepoLane=worktree 的假设 |
| AES Engineering Console WayFinder | 动态 node/edge/frontier/task；问题/候选/决定/证据；被否路线折叠；invalid edge persistent error；点击节点只更新 detail；source drill-down | 三栏布局在 768px 会把地图压窄；固定 Artifact stage rail 不是 Story 双图；`Map 是第二视图` 已被 WEB-P9 推翻 |
| 当前 v3 | `ISSUE / DOSSIER / REPO / DERIVED / SIMULATED` provenance；一个主动作 + 安全并行；简单 Modal / 复杂 Review；返回恢复；真实/模拟数据隔离 | 顶部固定六阶段、Map 第二视图、静态 CSS grid 六节点、真实页把 #147 子票按标题硬映射到固定阶段 |

## 9. 当前 v3 必须避免的视觉结构

1. **不得保留六阶段 rail 再把双图塞到下面。** 它会继续暗示固定流水线，即使文案写“动态”。
2. **不得做左右两张等宽卡片。** 768px 减去 gutter 后每图不足约 350px，节点标题、跨图边和 selected context 都会拥挤。
3. **不得把 DiscoveryMap 画成需求、DeliveryMap 画成固定实现步骤。** 两边都必须是 ticket graph，都有自己的 frontier、blocked、claimed、resolved 和局部终态。
4. **不得把 QA/Integration 只作为 badge。** 当它们有独立 owner/context/blocking/retry 时应成为节点；否则才作为来源票的 Gate/Evidence 挂点。
5. **不得让 Map 自己推导下一动作。** Core 投影 `now/why/owner/consequence/next_safe_action`，Web 只表达。
6. **不得在选中节点时完全替换全局图。** 必须保留两图轮廓、Contract seam 与 loopback 的定位线索。

## 10. v4 Mock 的最小可证伪验收

后续实现与浏览器审计至少要证明：

1. 768×1080 首屏同时看见 `StoryRoot / DiscoveryMap / Contract seam / DeliveryMap / 两个 frontier`，不存在六阶段 rail。
2. 不点击任何东西时可辨认当前全局 `NEXT` 节点、一个人类等待或 blocked 节点、required RepoLane 状态与 source freshness。
3. 一次选择可展开目标的一跳关系，并在同屏 peek 读到 Now/Why/Owner/Next/Unlocks。
4. `requires-decision` 能从 Delivery finding 跨 seam 定位到具体 Discovery ticket；Contract revision 与 stale receipt 可同时可见。
5. `QA`、`Review`、`Integration` 在 fixture 中按 Profile/Gate 动态出现，删除某个 Profile 要求后对应节点/挂点消失，其他节点位置不发生全局重排。
6. Fit Story、zoom、pan、Focus、搜索定位、legend filter、Map/List、键盘选择和 Escape/focus restore 可完成；页面无横向溢出。
7. 真实数据与 simulated coverage 仍完全隔离，模拟 loopback 或 Receipt 不得挂在真实 #147 身份下。
8. 选中节点、缩放、map lens、sheet tab 与滚动位置在 Review 返回后恢复。

## 11. 证据边界

### Evidence

- 两张动态子图、独立 frontier、Contract 变化回流、Delivery wave、多 RepoLane 与 StoryRoot 独占终态来自已记录访谈事实。
- board 与 AES Console 源码证明了动态节点、状态形状、beacon、一跳聚焦、bottom sheet、pan/zoom、frontier、被否路线与 source drill-down 的现有实现方式。
- WEB-P9 已明确否定固定阶段作为主坐标，并要求 768×1080 上验证地图优先。

### Inference

- 上下双图、Contract seam、地图面积比例、底部 peek 高度、lane territory hull 与 LOD 阈值是基于 768px 宽度和现有可用模式的高置信设计推论，不是用户已经逐项裁决的像素规范。

### NOT_RUN / Unknown

- 本分片未修改或运行 v4 Mock，未截新图，未做浏览器交互、200% zoom、读屏、高对比或真实 10 秒任务测试。
- 真实 runtime 尚未提供 DiscoveryMap/DeliveryMap 的完整同构样本；后续 Mock 仍需使用明确标识的模拟缺口覆盖 loopback、stale、multi-lane 和 Human Gate。

