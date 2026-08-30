<!-- audit draft | published 2026-08-30
     用户意见：v4 未保留 v3 优势，真实数据不完整，需回到 Story Work Graph 原点
     状态：design input，等待三方向选择 -->

# v3 / v4 Product Design 重启审计

## Audit scope

- Surface：Codex 右侧约 768×1080 的 Story Atlas / Story Work Graph。
- User goal：十秒内回答当前 Story 的 Now / Why / Owner / Next / safe parallel，并可核对真实拓扑、来源与证据。
- Capture：本轮使用 Chrome CDP 原生 pointer 在 768×1080 重新打开 v3、v4；in-app Browser 控制句柄未暴露，未使用 Playwright。
- Evidence：`2-prototype/evidence/webp10-product-restart/01`–`05` 与 `audit-results.json`。

## Overall verdict

v3 可操作但领域表达错误；v4 领域表达正确但把操作理解成本推给了用户。v5 应保留 v4 的 Map-first、动态双图、Contract seam 和 provenance，同时把 v3 的 Story Pulse、显式 CTA、安全并行、RepoLane 读态、搜索定位和对象化 Evidence 重新变成地图同源投影。

此外，数据层存在 P0 事实错误：root #147 是 0/0，但 descendant subgraph 有 7 条真实 native dependency，v3/v4 都没有完整绘制。

## Step audit

| Step | Screenshot | Health | Evidence-backed finding |
| ---: | --- | --- | --- |
| 1 | `01-v3-current-status-workbench.png` | Mixed | 历史 Issue 与当前 prototype pending 区分清楚，主结论与动作显眼；但固定六阶段把不同领域对象误画成生命周期，真实关系只到 root summary。 |
| 2 | `02-v3-scenario-action-first.png` | Strong actionability / wrong model | 一屏能读主动作、Why、safe parallel、队列与 RepoLane；但 Queue-first 和六阶段压过 Story graph。 |
| 3 | `03-v3-scenario-map.png` | Mixed | selected context 与图同屏，动作可见；地图只有 6 个 fixture 节点，不能表达双动态图、Contract revision、多 wave 和真实 descendant dependencies。 |
| 4 | `04-v4-current-map-first.png` | Correct truth boundary / weak current-state reading | Map-first、双图、Delivery empty truth 正确；但首屏更像“#147 已完成”，当前 dossier 工作弱化，而且缺 7 条真实 dependency。 |
| 5 | `05-v4-scenario-raw-global-graph.png` | Structurally rich / hard to understand | 18 个同形节点、111 个首屏小于 12px 的可见叶文本、多条交叉边；NEXT 只在 10px footer，Lane band 不回答 owner/blocker/next，用户必须自己从图推导操作顺序。 |

## Strengths to preserve

- v4：Map-first、DiscoveryMap / DeliveryMap 独立动态图、Contract revision seam、requires-decision loopback、truth provenance、Review 返回恢复。
- v3：人话 Story Pulse、主 CTA、排序依据、安全并行、RepoLane 当前态、等待原因、recovery、selected context、search/filter 和 Evidence reader。
- 参考 Console/Board：Map/List 同源、一跳聚焦、owner beacon、frontier rail、bottom peek、完整 Review Workspace、missing/stale/NOT_RUN 常显。

## P0 / P1 risks

1. **事实不完整**：把 root 0/0 当整图 0 edge；真实 Story graph 缺 7 条 descendant dependency。
2. **主动作不可见**：v4 NEXT 在小号 footer；目标节点没有可见 CTA，双击动作不可发现。
3. **图谱语法过载**：同一矩形承担 research、decision、implementation、QA、Gate、Story；节点 kind/state 图例缺失。
4. **多 Lane 不可扫读**：Lane band 只有名称和 target，没有 owner、worst Gate、blocker、next、freshness。
5. **selected context 遮图**：展开 Inspector 会覆盖被选 Delivery node 与一跳关系。
6. **历史终态冒充当前工作感**：#147 CLOSED 是最大锚点，当前 dossier pending 退成 sidecar。
7. **机械 PASS 不是理解 PASS**：0 overflow、0 console error、focus 可达不能证明十秒读态。

## Accessibility risks

- v4 SIM 首屏有 111 个小于 12px 的可见叶文本；480 Fit 后图中文字只适合作为 topology overview。
- 节点状态主要依赖小字、边框和颜色；需要文字标签、图例与辅助技术可读的 focus context。
- 本轮确认 unnamed button=0、console error=0；真实 screen reader、200% zoom、Windows high contrast、320px 仍 NOT_RUN。

## Design requirements for the next visual target

- 真实 dataset：12 membership + 7 descendant dependency + author progression overlay；Delivery runtime 仍 `NOT_CONNECTED`。
- 模拟 dataset：从真实 spec/ADR/dossier 派生，所有运行态标 `SIMULATED GAP`；覆盖两 Map、多 RepoLane、contract revision、wave、stale Receipt、requires-decision、Gate reducer。
- 默认图只显示高信号骨架；选择后展开一跳，不永久铺满全部细节。
- 图旁常显 Story Pulse、唯一 next safe action、Why、Owner、Unlocks、safe parallel。
- RepoLane 是可定位 beacon/rail，不是固定阶段。
- Map/List/Queue/Evidence 共用 selection 与 state source；完整证据和 Review 留第二层。

## Evidence limits

- 真实 active Delivery runtime 不存在，无法证明真实 owner/candidate/Receipt/Gate。
- 模拟数据只能证明设计承载力，不能证明后端已实现。
- 本轮没有真实用户 comprehension timer 或 screen-reader 结果。

