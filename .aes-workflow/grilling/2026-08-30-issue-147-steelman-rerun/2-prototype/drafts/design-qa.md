# Story Atlas v4 · Design QA

- Source visual truth：`v4-map-first-rationale.md`、`../../1-interview/facts/web-v4-map-first-visual-patterns.md` 与用户 WEB-P9 原话；v3 作为被推翻的 before capture，不是目标设计。
- Implementation：`v4-map-first-prototype.html`。
- Implementation screenshots：`../evidence/webp9-v4/01-current-global-map.png`、`05-sim-global-dual-map.png`、`13-mobile-current-480.png`、`14-mobile-sim-480.png`、`15-wide-sim-1440.png`。
- Full-view comparisons：`16-v3-v4-current-map-first.png`、`17-v3-v4-sim-dynamic-maps.png`。
- Viewports / density：768×1080、480×900、1440×1000 CSS px；所有截图 deviceScaleFactor=1，像素尺寸与 CSS 尺寸相同，无密度归一化差异。
- State：WEB-P9 map-first dual-dynamic-map candidate；Web artifact 未确认。

## Findings

没有残留可执行 P0/P1/P2 finding。

### Information architecture

- 默认第一可视化确实是当前 Story 全局图，不是 Action Queue。
- StoryRoot、DiscoveryMap、Contract revision seam 与 DeliveryMap 同屏；固定六阶段 DOM 元素为 0。
- Action、Evidence 与 Review 均能指回实际 map node，不形成第二套权威状态。

### Layout / spacing

- 768px 画布区域从 y=261 到 y=964，完整 map canvas 为 733×672；legend/frontier summary 与 64px Inspector peek 都在首屏。
- 上下双图使用完整宽度；Contract seam 是 64px 版本带，不会被误读为第三张阶段卡。
- wave-1 history、wave-2 带、两个 RepoLane territory 与 Story reducer 已重新排布，不再碰撞或贴底裁切。
- 480px Fit 同时按宽高计算；真实图 57%、SIM 图 61%，整张图在局部 map frame 内完整可见。

### Fonts / typography

- Story title 保留 serif；操作正文使用 sans；ID、Receipt、edge label 与 provenance 使用 mono。
- 100% zoom 下节点标题、profile 与 runtime state 保持三层层级；≤600px Fit 是 topology overview，用户可放大后读取文字。
- 长 title 在 node 中使用固定宽度和紧凑 line-height；完整内容进入 Inspector，不靠 tooltip 才能理解。

### Colors / tokens

- 延续 v3 暖纸/深墨/陶土方向，没有重新发明色板。
- node 左边色只表达 profile；border 与文字表达 runtime state，避免用一个颜色同时编码类型与状态。
- `requires-decision` 使用红色虚线，native membership 使用低权重绿色，普通 verifies 使用蓝/中性色。
- 所有状态同时有文字，非纯色判读。

### Image / asset fidelity

- 本产品状态图本身是数据可视化，不依赖 logo、照片、illustration 或非标准 icon asset。
- 没有用 emoji、占位图或假产品图片替代视觉资产。
- SVG 仅作为基于真实 node position 实时绘制的 edge data layer；节点仍是语义化 button，不是装饰插画。

### Copy / content

- `Contract revision seam · 版本边界，不是固定阶段` 直接解释用户当前质疑。
- `DeliveryMap 0 verified nodes`、`DOSSIER SIDECAR · NOT TRACKER MEMBER` 和 `REPO NOT_CONNECTED` 明确缺失事实。
- #153 为 `decision · NOT implementation`，#159 为 `contract-finalization`。
- SIM 模式持续标记 `SIMULATED / NO REAL RUNTIME`。

### Interactions / accessibility

- Dataset、view、Inspector tabs 支持方向键；map nodes 支持方向键/Home/End roving focus。
- Source Modal 初始焦点、Escape、focus return 通过。
- Node selection、Frontier/Risk filters、作者演进线、zoom/Fit、一跳聚焦、Action/Evidence、Review 输入与返回均通过真实浏览器输入。
- 有效 target 低于 24px：0；accessibility tree unnamed buttons：0；reduced-motion：0s；console/runtime errors：0。

## Focused comparison

不需要额外局部裁切：两张 1536×1138 的同视口 comparison 已能清晰判断首屏层级、六阶段删除、双图空间关系与回流边；节点具体 copy 又通过 `02-current-153-inspector.png` 与 `07-sim-web-qa-selected.png` 单独复核。

## Comparison history

### Pass 1 — blocked

- [P1] 480px 默认 100% 只能看到局部，违背“全局地图第一印象”。
- [P2] wave-1 history 与 wave-2/lane 标签争夺 DeliveryMap 顶部空间。
- [P2] Story reducer 太贴画布底部；长内容存在视觉裁切风险。
- [P2] dataset 切换后残留上一模式 toast。

### Fixes

- Fit Story 同时计算 map frame 宽、高；≤600px 自动缩放。
- wave-1 history 移到左侧专属区域；wave-2 带限制在右侧；RepoLane territory 下移。
- Story reducer 上移 10px。
- dataset 切换清理 toast、旧 Inspector 与 selection context。

### Pass 2 — passed

- 768、480、1440 全屏和 focused states 重拍。
- 同视口 comparison 重新检查。
- P1/P2 不再复现；浏览器断言全部通过。

## Residual gaps

- Real screen reader：NOT_RUN。
- 200% browser zoom：NOT_RUN。
- Windows high contrast：NOT_RUN。
- 320px：NOT_RUN。
- Real active Story runtime：NOT_CONNECTED。

## Follow-up polish

- P3：若用户确认上下双图关系，可继续弱化 57–61% mobile Fit 下的次级 node copy，只保留 ID/type/state，以提升缩略图清晰度。

final result: passed
