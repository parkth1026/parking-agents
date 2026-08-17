# diagram.html 绘图规范

`2-prototype/diagram.html` 的画法内核，轻量移植自 diagram-design v2.4.0（MIT，出处见文末），
裁到只剩对照物家族用得上的部分。表格仍是契约源：架构视图是拓扑的事实源（每处标注变化会被
`aes-goal-contract` 收进例子池，落成依赖断言或强约束不变式），流程视图是 behavior.md 变化行
的视图——图不另立例子。

## 自包含硬规则

- 单 HTML 文件：内联 SVG + 内联 CSS；零 JS、零外链（无 CDN、无网络字体、无网络图片）、
  系统字体。浏览器直接打开就能看，宿主能内嵌展示就直接展示。
- `<svg>` 带 `role="img"` 与 `aria-labelledby`，指向本图自己的 `<title>`/`<desc>`；title 放
  在 defs 之前，id 带图前缀（两图同页不撞名）。
- 只出浅色一种皮肤；页面结构：eyebrow + 标题 + 一句 lede（声明 accent 语义）、SVG、页脚
  档位行。不做暗色、不做动画。

## 语义色板

| 角色 | 取值 | 用途 |
| --- | --- | --- |
| paper | `#f5f5f5` | 页面底色、标签 mask、防穿底 |
| ink | `#2d3142` | 主文字、节点名 |
| muted | `#4f5d75` | 次文字、默认连线、普通节点描边 |
| soft | `#7a8399` | 弱文字、图例 |
| accent | `#eb6c36` | 改动标注（.changed）、强调边 |
| accent-tint | `#fdf1ec` | .changed 节点底色 |

- accent 是编辑色不是信号系统：全图 ≤2 处（.changed 节点与强调边都计入）。其余一律
  ink / muted / soft；节点底色只用白或 accent-tint，不引入第二色相。
- 文字两套就够：名称用 sans（system-ui 栈），端口/命令/路径等技术标注用 mono
  （ui-monospace 栈）。竖排 writing-mode 一律禁止。

## 4px 网格

结构性坐标——节点框、容器、间距、主要拐点——落在 4 的倍数上；字号走字号阶
（8/9/10/11/13/16），文字基线与标签 mask 的 1–3px 度量豁免；描边（0.8/1/1.25/1.5/1.75/2）
与透明度豁免。节点框坐标结尾是 1/2/3/5/6/7/9 就回去修。圆角：标签 2、节点 6、容器 8；
节点间距 20/24/32/40。

## 连线：圆角正交，禁止斜线

不共轴的节点之间禁止对角 `<line>`，一律圆角正交肘形，弯角 r=8（紧凑布局最小 r=6）：

```svg
<!-- 右+下：从 (x1,y1) 到 (x2,y2)，mid = (x1+x2)/2 -->
<path d="M x1,y1 H mid-8 Q mid,y1 mid,y1+8 V y2-8 Q mid,y2 mid+8,y2 H x2"
      fill="none" stroke="#7a8399" stroke-width="1.5" marker-end="url(#arrow)"/>
```

共轴（同 x 或同 y）的端点才许用直 `<line>`/直 path。竖向为主的连接从节点上/下边出入，
不走左右侧。其余铁律：

- 先画线后画节点：线写在文档前面，z 序把线压在节点后。
- 同一箱边上的接点沿边散开，相邻 ≥12px；平行线全程 ≥12px，谁也不许盖住谁。
- 两线交叉时给次要的那条加半圆桥（水平跨竖线：`a 8,8 0 0,1 16,0`），只桥一条。
- 箭头标签必带 paper 色 mask rect，mask 与线之间留 6–10px 可见缝；mask 不许压到后画的
  节点框上（会被节点底色裁成碎字）。标签 ≤14 字符，放线的可见端。

## 复杂度预算

每张图 ≤9 节点、≤12 箭头、≤2 处 accent；超了拆成 overview + detail 两张，不挤一张。
删减测试优先于加东西：两个节点永远同进同出就合成一个，关系能从布局看出来就删掉那条线。
图画到「没什么可删」才算完，不是画到「都画上了」。

## 改动标注（.changed）

单视图画改后态，不做 before/after 双图：

- 新增/变更节点：`fill=accent-tint`、`stroke=accent`（stroke-width 2），类名 `.changed`。
- 新增/变更连线：stroke 与 marker 用 accent 版。
- 节点内的文字级标注：sub 行用 accent 色 + ★。
- 删除项不画进图，进页脚清单；改动多于 2 处时聚成一个 .changed 簇节点或拆图。
- 页首 lede 一句话声明 accent 语义（如「橙色 = 本次新增 / 变更，灰线为既有流转」），
  图例给出双线型对照。

## fidelity ledger（每图必带）

一切「画出来的少于源里的」压缩都要申报，合并与删减绝不静默。页脚两段：

1. 明面一行档位摘要：
   `detail: balanced · 8 节点 / 8 边 · 单视图（改后态）+ 改动标注，无 JS · 无外链 · 系统字体`
2. HTML 注释块逐条申报：

```html
<!--
  改动申报
  新增：…
  不变：…
  删除：…

  Fidelity ledger
  Detail: balanced · 源 = N 个技能 + M 类产物 → 绘制 8 节点 / 8 边
  Merged: 哪些源合成一个节点、凭什么
  Collapsed: 哪些内部结构压成一行 sub 标注
  Dropped: 丢了什么、为什么（与本次改动无关 / 横向方法论）
  Kept in full: 什么全保真画了（通常正是本次改动的落点）
-->
```

用户认得源系统，静默删掉的边他会以为不存在。逐处质疑的前提是先知道少了什么。

## worked 示例

最小可抄骨架（2 节点 1 边，1 处 .changed，各规则各出现一次）：

```html
<svg viewBox="0 0 480 240" role="img" aria-labelledby="ex-title ex-desc">
  <title id="ex-title">worked 示例：网关改调新服务</title>
  <desc id="ex-desc">网关改为调用本次新增的 svc-parking，新依赖边与新增节点以改动标注框出，被替换的 svc-legacy 删除进页脚清单。</desc>
  <defs>
    <marker id="ex-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7a8399"/></marker>
  </defs>
  <!-- 连线先画：肘形 r=8；标签带 paper 色 mask，与线留 6px 缝 -->
  <path d="M 160,120 H 224 Q 232,120 232,128 V 152" fill="none" stroke="#7a8399" stroke-width="1.5" marker-end="url(#ex-arrow)"/>
  <rect x="168" y="100" width="80" height="14" fill="#f5f5f5"/>
  <text x="208" y="111" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#4f5d75">调用</text>
  <!-- 节点后画：普通节点白底，改动节点 .changed -->
  <g>
    <rect x="32" y="88" width="128" height="64" rx="6" fill="#ffffff" stroke="#4f5d75" stroke-width="1.25"/>
    <text x="44" y="116" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#2d3142">api-gateway</text>
    <text x="44" y="136" font-family="ui-monospace, monospace" font-size="10" fill="#4f5d75">路由 · 限流</text>
  </g>
  <g class="changed">
    <rect x="168" y="152" width="128" height="64" rx="6" fill="#fdf1ec" stroke="#eb6c36" stroke-width="2"/>
    <text x="180" y="180" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#2d3142">svc-parking</text>
    <text x="180" y="200" font-family="ui-monospace, monospace" font-size="10" fill="#eb6c36">本次新增 ★</text>
  </g>
</svg>
<!-- fidelity ledger
  Detail: simplified · 源 = 3 服务 2 边 → 绘制 2 节点 1 边
  Merged: 无
  Collapsed: 无
  Dropped: svc-legacy 节点与网关→legacy 旧边（删除项，进页脚清单，不画进图）
  Kept in full: 网关→svc-parking 这条本次新增的依赖边
-->
```

## 提取触发条款

本规范住在 aes-prototype，只有一个消费者：aes-prototype 出图，aes-goal-contract 只读不画。
出现以下任一情况，停下来问用户是否把绘图能力提取成独立技能，不在原地静默扩张：

1. 出现第二个图消费者（例如 analyze 要输出图示，或别的技能要画图）；
2. 需要独立画图入口（不经过 2-prototype 流程、用户直接要一张图）；
3. 规范开始长出与对照物无关的节（导入 draw.io/Mermaid、动画、暗色皮肤、PNG 导出）。

## 出处（MIT）

自 diagram-design v2.4.0 轻量移植：SKILL.md 的设计系统、4px 网格与复杂度预算；
references/style-guide.md 的语义色板；references/type-architecture.md 的圆角正交连线
公式与桥接。裁掉：Google Fonts（改系统字体，守零外链）、暗色/终端皮肤、动画、导入
链路、导出、27 类型路由——单消费者用不上。原文以 MIT License 发布：

> MIT License
>
> Copyright (c) 2025 Cathryn Lavery
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
