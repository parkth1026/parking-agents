# diagram.html 绘图规范

> 内核轻量移植自 diagram-design v2.4.0（MIT，作者 Cathryn Lavery），2026-08-17。
> 移植进来的是「编辑级图表的最小纪律」：语义色板、4px 网格、圆角正交连线、
> 复杂度预算、.changed 改动标注、fidelity ledger。裁掉的：Google Fonts（零外链
> 是硬规则，改系统字体）、暗色/终端皮肤、动画、draw.io/Mermaid 导入链路、
> onboarding——对照物场景用不上，单消费者不背这份重量。

diagram.html 是第七面「架构与依赖」的对照物，也是业务流程改动的可视化决策面。
它和 mock.html 平级：浏览器双击可开、断网可看、逐处可质疑。表格仍是契约源，
图做决策面与架构面事实源——口径冲突时先回 behavior.md 对行，图跟着改。

**管辖权**：几何与样式以本规范为准。确认版样例（本 issue 的
`2-prototype/diagram.html`）只定**改动申报与 fidelity ledger** 的惯例——它的像素
是当时的现场记录，不是模板；照抄它之前，先拿本规范对一遍再动手。

## 0. 硬规则

单文件、内联 SVG/CSS、**零 JS、零外链**（无 CDN、无网络字体、无外链图片）、
系统字体。字体栈只有两套：

```css
--font-ui:   system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
--font-mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
```

人读的名字（节点名、标题）用 ui；技术内容（路径、命令、端口、字段）用 mono。

可访问性：`<svg>` 带 `role="img"` 与 `aria-labelledby`；`<title>` 是 svg 第一个
子元素（在 `<defs>` 之前）；`<title>`/`<desc>` 的 id 按图加前缀（如 `dg-title`），
不许裸用 `title`/`desc`；`<desc>` 写图展示了什么（内容），不写几何形状 narration。

## 1. 什么时候画，什么时候不画

判准一句：**读者从图里学到的东西，比一段好文字多吗？**

- 值得画：依赖方向与模块归属（拓扑）、多角色流转（流程）、边界与分组。
  「谁连谁、往哪流」扫一眼的事，读三段文字未必能确认——这正是图最强、
  文字最弱的地方。
- 不值得画：清单（用表）、简单前后对照（用表）、单点事实（写成一句话）。
  两个框一条边的图是一句话的伪装，别画。

架构视图与流程视图各管一段：架构视图是拓扑事实源，画改后态的模块与依赖边；
流程视图是 behavior.md 变化行的视图，同一批行换个画法，不另立内容。

## 2. 语义色板

单浅色皮肤。引用语义角色名，不引用 hex——要换肤只动这张表。

| 角色 | 取值 | 用途 |
| --- | --- | --- |
| `paper` | `#f5f5f5` | 页面底、连线标签 mask 底 |
| `ink` | `#2d3142` | 主文字 |
| `muted` | `#4f5d75` | 次文字、既有节点描边、默认连线 |
| `soft` | `#7a8399` | 弱化文字、图例、eyebrow |
| `accent` | `#eb6c36` | 本次新增/变更标注（全图 ≤2 处） |
| `accent-tint` | `#fdf1ec` | 改动节点填充 |
| 节点默认 | 填充 `#ffffff`、描边 `muted` 1.25px、圆角 6 | 既有节点 |
| 节点内标签底 | `#eef1f6`（改动节点用 `#f7dfd3`） | 类型小签 |
| 连线 | 既有 `muted` 1.5px；改动 `accent` 1.75px | 箭头色随线色 |

accent 是编辑色不是信号色：只标「本次新增/变更」。五个节点标五次 accent 等于
没标——分不清哪处是本次要质疑的。要标的多了，说明该拆图（见复杂度预算）。
accent 的计数单位是「改动处」：一个 `.changed` 节点（连同它的小签与文字）算
1 处，一条 accent 连线（连同 marker 与标签文字）算 1 处——同处元素不重复计。

## 3. 4px 网格

字号、节点尺寸、间距、坐标落在 4 的倍数上；描边宽度与透明度豁免；文字基线
允许为可读性偏移（9px mono 标签常见），几何量不豁免。坐标结尾落在 1/2/3/5/6/7/9
就改到落回 4 的倍数——手工布图没有网格会肉眼可见地散架。

| 类别 | 允许值 |
| --- | --- |
| 字号 | 8、12、16、20、24（ui）；8、10（mono）；微标签可 9/11 |
| 节点宽度 | 80、96、112、128、144、160、192、224、240、256（高度无档位：取 4 的倍数、同图一致） |
| 坐标 | 4 的倍数 |
| 节点间距 | 20、24、32、40、48；更大间距直接取 4 的倍数 |
| 圆角 | 节点/容器 6、8（大容器可 4）；类型小签用 2（12px 高的 chip 用 4px 显得臃肿，源技能同款） |

## 4. 连线：圆角正交

六条铁则（违一条图就糊）：

1. **先画线后画节点**，z 序让连线压在节点下。
2. **异轴节点之间只准圆角正交肘线，禁止斜线**。同轴（共享 x 或 y）才准用直线。
3. **连线标签必带纸色 mask，且与线保持 6–10px 可见间隙**——盖住自己箭头的标签
   是硬伤；mask 也不许压到后画的节点上。
4. **两条线不共轨、不叠行**。正交交叉处给次要线加半圆桥（hop），只桥一条。
5. **同一框边上的多个连接点沿边散开，间距 ≥12px**，不许叠在一个点上。
6. **连线不穿过非端点节点**；实在避不开的横穿，线改虚线示意「过境不交互」，
   箭头只落在真端点上。

肘线公式（右+下，从 `(x1,y1)` 到 `(x2,y2)`，`mid = (x1+x2)/2`，圆角 r=8）：

```svg
<path d="M x1,y1 H mid-8 Q mid,y1 mid,y1+8 V y2-8 Q mid,y2 mid+8,y2 H x2"
      fill="none" stroke="…" stroke-width="1.5" marker-end="url(#arrow)"/>
```

垂直进入下方节点用单弯 L（水平 → 圆角 → 垂直落到节点顶边）：

```svg
<path d="M x1,y1 H x2-8 Q x2,y1 x2,y1+8 V y2"
      fill="none" stroke="…" stroke-width="1.5" marker-end="url(#arrow)"/>
```

跨线桥（水平线在 `x=cx` 处跨过一条竖线，让路的是次要线）：

```svg
<path d="M x1,y H cx-8 a 8,8 0 0,1 16,0 H x2" fill="none" stroke="…"/>
```

箭头 marker 两个都定义（默认 `muted`、accent），`orient="auto-start-reverse"`；
箭头端离目标节点边 4px（箭尖不插进框），起点贴源节点边缘出发即可。

## 5. 流程视图语法

流程视图画的是 behavior.md 的变化行——行是源、图是面。最小语法：

- **步骤节点**：圆角矩形横排，主流向左→右；每步对应一条变化行，sub 行标
  「变化行 n」。首尾步骤即流程边界，不画专用的开始/结束符。
- **判定分支**：只有行为真的分叉才画——从步骤边缘出一条带条件标签的分支边
  （如「回执非零」），没有汇合就不画汇合。单图分支边 ≤2。
- **多角色**：确实跨角色才分泳道，按行分组 ≤3 道，角色名做行首 eyebrow；
  两步以内的流程不要泳道。
- **不变的行为不进图**：那是 behavior.md 不变清单的事；图里画「不变」会把
  「变」稀释掉。
- 删除的步骤不占图面，进页脚删除清单（与架构视图同一条规则）。
- 步骤计入复杂度预算，accent 预算同架构视图（改动步 + 改动边 ≤2）——超了
  拆 overview + detail，不硬塞。

## 6. 复杂度预算

| 限额 | 值 |
| --- | --- |
| 节点 | ≤9 |
| 箭头/流转边 | ≤12 |
| accent 改动处 | ≤2 |

超预算拆 overview + detail 两张图，不硬塞。**落盘与登记**：`diagram.html`
（overview）+ `diagram-detail.html`（detail），`--artifacts` 列
`diagram,diagram-detail`，两个文件各自带 fidelity ledger。架构视图与流程视图
默认**同住一个 `diagram.html`**——两张 `<svg>`，各自带 title/desc，预算也
各自算。密度目标 4/10：删无可删才算完——
永远同进同出的两个节点是一个节点，布局已经能表达的连线不画线，颜色已经能
信号的标签不写字。

## 7. 改动标注（.changed）

单视图画**改后态**，不做 before/after 双图（对抗审查否决维持：`.changed` 单视图
是家族先例，双图锁死对比视角）：

- 本次新增/变更的节点与连线挂 `.changed`：节点 `accent` 描边 2px + `accent-tint`
  填充；连线 `accent` 1.75px + accent 箭头。
- **删除项不占图面**：进页脚「删除清单」，逐条列名——用户得知道少了什么。
- 页首 lede 一句话图例：橙 = 本次新增/变更，灰 = 既有（不动）。
- 每处标注必须经得起质疑：节点归属、依赖方向、谁受影响——用户点着问，
  你改得动；改不动的，回访谈问清楚再画。

## 8. fidelity ledger（每图必带）

图是对源的压缩，压缩必申报。页脚固定五项，合并与删减绝不静默：

```markdown
Fidelity ledger
Detail: balanced · 源 = <N 类源对象> → 绘制 <n 节点 / m 边>
Merged: <哪些源对象并成了哪个节点，凭什么>
Collapsed: <哪些内部细节收进了一个节点，sub 行标注什么>
Dropped: <丢弃了什么，为什么丢弃了也安全>
Kept in full: <什么必须一笔不减地画全，为什么>
```

图比源多（几乎不发生）也要写：Merged/Collapsed/Dropped 写「无」，不许省项——
省项和静默是同一件事。

落进 HTML 的形态二选一：页脚直接写完整五项；或页脚写 Detail 摘要一行 +
文末 HTML 注释写完整五项的双份形态（确认版样例即此）。**只在注释里写、页脚
什么都不留，不算申报**——用户看不见的申报等于没申报。

## 9. worked SVG 示例

三节点最小例：既有 `scanner`、既有 `knowledge-store`、本次新增 `writer`（.changed），
新增依赖边走 accent，既有边走 muted。肘线、直线、标签 mask、marker 各演示一次。

```svg
<svg viewBox="0 0 480 280" role="img" aria-labelledby="wk-title wk-desc">
  <title id="wk-title">worked 示例：扫描器改走 writer 接口</title>
  <desc id="wk-desc">三个节点的最小架构图。scanner 与 knowledge-store 为既有节点，writer 为本次新增节点，scanner 到 writer 为新增依赖边，writer 到 knowledge-store 为既有写入边。</desc>
  <defs>
    <marker id="wk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#4f5d75"/></marker>
    <marker id="wk-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#eb6c36"/></marker>
  </defs>

  <!-- 连线先画（z 序在节点下） -->
  <!-- 同轴直线：scanner → writer（本次新增依赖，accent） -->
  <path d="M 128,120 H 188" fill="none" stroke="#eb6c36" stroke-width="1.75" marker-end="url(#wk-arrow-accent)"/>
  <!-- 异轴单弯肘线：writer → knowledge-store（既有，muted） -->
  <path d="M 288,120 H 392 Q 400,120 400,128 V 156" fill="none" stroke="#4f5d75" stroke-width="1.5" marker-end="url(#wk-arrow)"/>
  <!-- 连线标签：纸色 mask，mask 底边离线 8px -->
  <rect x="136" y="100" width="48" height="12" fill="#f5f5f5"/>
  <text x="160" y="110" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="8" fill="#eb6c36">新依赖</text>

  <!-- 节点后画 -->
  <g>
    <rect x="32" y="88" width="96" height="64" rx="6" fill="#ffffff" stroke="#4f5d75" stroke-width="1.25"/>
    <rect x="40" y="96" width="32" height="12" rx="2" fill="#eef1f6"/>
    <text x="56" y="105" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="8" fill="#4f5d75" letter-spacing="1">CLI</text>
    <text x="80" y="126" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#2d3142">scanner</text>
    <text x="80" y="142" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="9" fill="#4f5d75">既有 · 不动</text>
  </g>
  <g class="changed">
    <rect x="192" y="88" width="96" height="64" rx="6" fill="#fdf1ec" stroke="#eb6c36" stroke-width="2"/>
    <rect x="200" y="96" width="36" height="12" rx="2" fill="#f7dfd3"/>
    <text x="218" y="105" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="8" fill="#eb6c36" letter-spacing="1">NEW</text>
    <text x="240" y="126" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#2d3142">writer</text>
    <text x="240" y="142" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="9" fill="#eb6c36">本次新增</text>
  </g>
  <g>
    <rect x="352" y="160" width="112" height="64" rx="6" fill="#ffffff" stroke="#4f5d75" stroke-width="1.25"/>
    <rect x="360" y="168" width="36" height="12" rx="2" fill="#eef1f6"/>
    <text x="378" y="177" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="8" fill="#4f5d75" letter-spacing="1">NAS</text>
    <text x="408" y="198" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#2d3142">knowledge-store</text>
    <text x="408" y="214" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="9" fill="#4f5d75">既有 · 不动</text>
  </g>
</svg>
```

对应的页脚申报（本文档自身的 fidelity ledger）：

```markdown
Fidelity ledger
Detail: balanced · 源 = 连线六则 + 肘线/桥公式 + 标签规则 → 绘制 3 节点 / 2 边
Merged: 「同轴才准直线」与「肘线公式」两条规则 → 示例里直线与肘线各出现一次
Collapsed: 节点内部结构（scanner 的扫描管线、store 的文件布局）→ 单矩形 + 类型小签
Dropped: 跨线桥演示（两线无交叉可桥）、多连接点散开演示 → 铁则 4/5 只有文字
Kept in full: .changed 节点与 accent 连线的完整样式参数——这是本规范要教的动作
```

## 10. 提取触发条款

本规范住在 aes-prototype，只有一个消费者（2026-08-17 Q4 裁决）。出现以下任一
情况即触发提取复议，**停下来问用户**是否拆独立绘图技能，不在原地静默扩张：

- 出现第二个图消费者——别的技能（如 analyze）要输出图示、要引用这套色板与预算；
- 需要独立画图入口——用户不经过 2-prototype 阶段直接要一张图；
- 需要本内核没有的能力——导入 draw.io/Mermaid、动画、导出 PNG、品牌皮肤定制。

拆出去的形态是独立通用技能；MIT 出处与这份提取记录跟着走，谁问起为什么长这样，
答案在这份文件里。

## 出处

- 移植源：diagram-design v2.4.0（本地参考仓库 `G:\GIT\AI_WorkFlow_ref\diagram-design`，
  作者 Cathryn Lavery，**MIT License**）。
- 移植映射：SKILL.md §6 连线六则、§7 网格与复杂度预算、§12 可访问 SVG 契约 →
  本文 §4/§3+§6/§0；源技能 `references/style-guide.md` 的语义角色 → §2；
  源技能 `references/type-architecture.md` 的肘线公式与跨线桥 → §4。
  本文新增（非源技能内容）：引言的管辖权段、§5 流程视图语法、§6 的拆分落盘与
  双视图同文件语义、§7 改动标注、§8 的页脚化 ledger——这些是本家族的约定。
- 本地化改动：Google Fonts → 系统字体（零外链硬规则）；砍暗色/终端皮肤、动画、
  导入链路、onboarding。源技能的纪律是「规范 + self_check/verify-geometry 校验器」
  成对生效；本家族暂只有规范、没有几何校验器——所以引言的管辖权句和闸门联动
  （判「有」必出图）是仅有的两道硬约束，画完自查一遍网格与肘线再交付。
