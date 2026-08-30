<!-- draft v4 | published 2026-08-30T00:00:00+08:00
     用户意见：当前 Story 全局地图应成为第一可视化；需求与实现是两张动态地图，节点由探索与执行实际产生
     状态：WEB-P9 rework candidate; Web artifact and 2-prototype not confirmed -->

# workflow-story-map Web v4 · Map-first 设计依据

## 这次纠正了什么

v3 顶部的 `Discovery / Contract / Delivery / QA / Integration / Closeout` 来自 WEB-P7 的“固定空间记忆”选择，不是最初领域模型的事实。它把五类不同概念误画成同一种时间阶段：

- Discovery / Delivery：两个常驻动态图容器；
- Contract：版本化用户承诺边界；
- QA / Review：按 Profile/Gate 需要动态出现的验证工作或 evidence；
- Integration：每条 RepoLane 的 terminal subject/Gate；
- Closeout：StoryRoot 的最终 reducer，而不是公共工作阶段。

WEB-P9 已推翻工作台第一、Queue-first 首屏和固定六阶段主坐标。v4 删除六阶段 rail，不用改名后的槽位继续暗示固定流程。

## 唯一稳定的顶层结构

```text
StoryRoot
├─ DiscoveryMap  需求 / 探索地图 · dynamic WorkTickets + frontier
├─ Contract seam 当前 revision、旧 subject stale、跨图版本边界
└─ DeliveryMap   实现 / 交付地图 · dynamic waves + RepoLane gates
```

稳定的是：StoryRoot 身份、两个子图边界、WorkTicket envelope、RepoLane、ProfileRegistry、Attempt/Receipt 与 Gate 规则。

动态的是：research、decision、prototype、implementation、bug、QA、review、acceptance、human、wave、owner、frontier 与依赖边。Ticket 不沿固定阶段原地变型；它完成自己的 profile 后关闭，通过 `produces / verifies / accepts / requires-decision` 连接新节点。

## 首屏信息架构

v4 的第一屏按以下顺序阅读：

1. StoryRoot 身份与当前 truth/source；
2. 同一画布中上下贯通的 DiscoveryMap 与 DeliveryMap；
3. 中部 Contract revision seam；
4. 图上的当前 NEXT 节点、安全并行 frontier、blocked/locked Gate 与回流边；
5. 选中节点后的底部 peek：Now / Why / Owner / Next / Unlocks；
6. Action Queue、Evidence、Review Workspace 作为地图派生的第二层。

因此地图占据 768×1080 首屏的主体面积。Action Queue 不再替代地图，也不再把“可扫读”实现成固定阶段。

## 为什么采用上下双图

主宿主只有约 768px 宽。两张图左右各占一半会把节点、跨图边和 Inspector 压成两列窄卡；上下布局让每张图使用完整宽度：

- DiscoveryMap 在上，适合展开 parallel research、decision 与 contract-changing fog；
- DeliveryMap 在下，给多 wave、RepoLane 与验证拓扑更多高度；
- StoryRoot 固定在中间 seam，`produces` 向下，`requires-decision` 以反向虚线弧向上；
- 两图始终同时可见，用户不需要切换后在脑内拼回跨图因果链。

这是一项 v4 视觉推论，尚待用户确认；它不是领域模型新增约束。

## Contract、QA 与 Integration 的视觉语法

### Contract seam

- StoryRoot 常显 current contract revision；
- Discovery 的实际 decision/contract ticket 才是节点；
- Delivery wave 通过边声明绑定哪个 revision；
- revision 变化后旧 Receipt 保留并标 `STALE · Gate none`；
- seam 不是“Contract 阶段完成度”。

### QA / Review / Acceptance

- 仅 evidence/Gate 时挂在来源 ticket；
- 具有独立 owner/context/blocking/retry 时才成为 WorkTicket 节点；
- 同一 wave 可以有 0、1 或多个 QA/Review 节点；
- 不为每个 Story 预留固定 QA 槽位。

### RepoLane integration Gate

- DeliveryMap 内按实际 required RepoLane 划轻量 territory；
- lane terminal Gate 是 StoryRoot reducer 的输入；
- Integration 自身需独立调度时才生成票；
- Story acceptance reducer 取代固定 Closeout 阶段。

## 真实与模拟样本

### #147 真实全图

- DiscoveryMap：12 个真实 native child nodes；research/decision/contract 分类带 `DERIVED`；
- native membership：12；native blocker edge：0；
- DeliveryMap：`0 verified nodes`，因为 #147 明确把 implementation 留给另一 effort；
- dossier：作为 `DOSSIER SIDECAR · NOT TRACKER MEMBER`，不能伪装成第 13 张票；
- repo runtime：`NOT_CONNECTED`。

### SIM 动态双图

- `SIM-STORY-001`、contract@1 → requires-decision → contract@2；
- wave-1 stale history 与 wave-2 current work；
- WEB / CORE 两条 required RepoLane；
- NEXT=`SIM-W2-WEB-Q`，安全并行=`SIM-W2-CORE-R`；
- 两条 lane Gate 未满足时 Story reducer locked；
- 所有 runtime identity、Receipt、Gate、owner 均为 `SIMULATED GAP`。

## 保留下来的 v3 能力

- ISSUE / DOSSIER / REPO / DERIVED / SIMULATED provenance 隔离；
- 一个全局主动作 + 安全并行，但改由 frontier 派生；
- 简单动作使用 Modal，复杂证据使用 Review Workspace；
- Review 返回恢复 dataset、view、map viewport、selection、Inspector 与 focus；
- 768×1080 是一等验收视口；
- 真实数据缺失时 fail-closed 表达，不用 fixture 补成假现场。

## 响应式

- 768×1080：上下双图完整同屏，地图 100% zoom；Inspector 为 64px bottom peek。
- ≤600px：默认 `Fit Story`，根据画布宽高自动缩放到约 57–61%，先展示完整拓扑；用户可放大后局部平移。
- ≥1180px：右侧 Inspector 常驻，地图仍保持上下双图，不改变空间模型。
- 所有宽度的页面本身不横向溢出；地图只在用户主动放大后产生局部滚动。

## 当前仍待确认

1. 两张图是否应在一张上下贯通画布中始终同时可见；
2. Contract seam 与 StoryRoot 的中部锚点是否符合用户心中的“双地图”关系；
3. 真实 #147 DeliveryMap 的 0 节点空态是否足够诚实清楚；
4. SIM 图中 wave / RepoLane / Gate 的视觉密度是否仍需进一步收缩。
