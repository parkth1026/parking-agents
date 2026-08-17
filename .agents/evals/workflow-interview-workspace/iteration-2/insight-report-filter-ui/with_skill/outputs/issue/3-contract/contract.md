# Goal Contract: 给 insight HTML 报告加一个 facet 筛选下拉框

- Status: Ready
- Target: `.copilot/agents/insight/generate-insight-report.js`
- Updated: 2026-08-13

## 原始请求

> .copilot/agents/insight/generate-insight-report.js 生成的报告现在是一份很长的静态大页面，想加一个按 facet 筛选的下拉框，选了之后只显示对应 facet 的内容，不用整页翻。

## 目标

`generate-insight-report.js` 生成的 HTML 报告新增一个页面顶部的 facet 筛选下拉框，选中某个
facet 后主区域只显示该 facet 的内容，不用再整页滚动查找。

## Why

- 现状：报告把 25 个区块全部平铺在一份长页面里，虽然有一份侧边 `nav-toc` 提供锚点跳转，
  但跳转后其它区块仍占满页面、要继续滚动才能确认自己看的是不是想要的内容。
- 做到之后：运营/分析同学打开报告只需选一次下拉框，就能把可视区域收窄到自己关心的那个
  facet，不用在长页面里来回定位。

## 范围

**做什么**

- 只改 `generate-insight-report.js` 生成的 HTML 结构、内联的 style 与 script 内容。
- 新增一个页面顶部、全局唯一的 facet 筛选 `select` 元素，选项文案取各区块 `h2` 标题元素里的人话
  标题，选中后只显示对应区块内容，其余区块隐藏（不删除）。
- 无数据的 facet 选项照常出现，选中后主区域显示占位提示。

**不做什么**

- 不改 `generate-quant-report.js`、`generate-qual-report.js`（用户原话只提到
  `generate-insight-report.js` 一个脚本）。
- 不改 `analyze-insight.js` 或任何数据提取/聚合逻辑，只改渲染层。
- 不新增命令行参数、环境变量或配置文件字段。
- 不引入外部依赖、CDN 资源或构建步骤——报告必须继续是单文件自包含 HTML。
- 不做像素级视觉还原，mock.html 定的是结构、文案与关键交互，不是精确到像素的规范。
- 不记忆用户上次选择（不写 localStorage/sessionStorage/URL hash）。
- 不删除现有 `nav-toc` 侧边导航。

## 强约束

- 生成的 HTML 必须继续零外部依赖：不出现任何 CDN / 外链 `<script src=http.../>`
  `<link href=http...>`。
- `sec-header`（标题/概览条）与 `sec-glance`（At a Glance）不算进可筛选的 facet 列表，
  始终显示在筛选控件上方，不受筛选影响。
- 已经生成过的旧版报告文件不受这次改动影响，只影响下次重新运行脚本生成的新文件。
- `generate-quant-report.js`、`generate-qual-report.js` 两个脚本的代码与行为不变。
- 新增的下拉框控件使用 class `facet-select`；生成的 option 选项文案不得直接是内部
  `sec-xxx` 形态的 id 文本。
- 隐藏未选中 facet 时使用 `content-visibility: hidden`（或等价效果，但不得对带
  `data-facet` 标记的区块使用 `display:none`），保证内容仍在 DOM 里、浏览器 Ctrl+F
  页内查找仍能匹配到并自动展开。
- 不写 `localStorage` / `sessionStorage` 持久化用户选中的 facet；每次生成的报告都默认
  选中下拉框第一项。

## 自主边界

不用问，直接定：
- `select` 元素用原生 HTML、原生 `change` 事件绑定实现，不引入任何前端框架或库。
- 具体 CSS 细节（颜色、字号、间距、圆角等）延续报告现有暗色主题即可，不用逐值对照 mock。
- 选项在下拉框里的排列顺序、JS 变量/函数命名、内部数据结构怎么组织。
- 哪些区块判定为「facet」（即打上 `data-facet` 标记）——除 `sec-header`/`sec-glance`
  外，`generate-insight-report.js` 里现有的 `<div class="section" id="sec-xxx">` 都算一个
  facet，含目前按数据条件才渲染的那些（如 `sec-agents`、`sec-narratives` 等）。

必须停下来问：
- 要不要把这套筛选下拉框也加到 `generate-quant-report.js` / `generate-qual-report.js`
  （不在本次范围内，属于新的一件事）。
- 要不要支持记忆用户选择或做成可分享链接（本次已明确排除，若之后要加是新的决定）。

## 读什么

- `../2-prototype/mock.html` — 确认版界面 mock，含筛选横条位置、选中态高亮、无数据 facet
  提示文案的具体样子，文件末尾注明了「新增什么、不变什么」。

## 验收条件

- AC-001: 下拉框选项文案是各区块的人话标题（如「目标分布」「满意度分析」），不是内部
  `sec-xxx` key
  - Verify: [A] `node -e "const s=require('fs').readFileSync('.copilot/agents/insight/generate-insight-report.js','utf8'); if(!/facet-select/.test(s)) process.exit(1); if(/>\s*sec-[a-zA-Z-]+\s*<\/option>/.test(s)) process.exit(1); process.exit(0)"` → 退出码 0

- AC-002: 某个 facet 没有数据时，它在下拉框里的选项照常出现（不隐藏、不置灰），选中后
  主区域显示「这个 facet 暂无数据」一类提示文案，不是空白一片
  - Verify: [C] 按 `../2-prototype/mock.html` 里「叙事洞察」那个状态，人工打开一份实际缺该 facet 数据的生成报告核对：下拉框选项还在、选中后能看到提示语

- AC-003: 隐藏未选中 facet 使用 `content-visibility:hidden` 一类不删除 DOM 的方式，不
  对 `data-facet` 区块使用 `display:none`
  - Verify: [A] `node -e "const s=require('fs').readFileSync('.copilot/agents/insight/generate-insight-report.js','utf8'); const hasCV=/content-?[Vv]isibility/.test(s); const usesDisplayNoneOnFacet=/data-facet[\s\S]{0,400}display\s*[:=]\s*['\"]?none/.test(s); process.exit(hasCV && !usesDisplayNoneOnFacet ? 0 : 1)"` → 退出码 0

- AC-004: 选中某个 facet 后，浏览器原生 Ctrl+F 页内查找依然能匹配到其它未选中 facet
  里的文字，并自动展开、定位过去
  - Verify: [C] 打开一份真实生成的报告，切到某个 facet，用浏览器 Ctrl+F 搜索另一个未选中 facet（参照 `../2-prototype/mock.html` 任一 `data-facet` 区块）里的关键词，确认能定位到

- AC-005: 筛选下拉框位于页面顶部独立的全局区域，不嵌套在任何一个 facet 区块内部；切换
  facet 后，当前选中的 facet 名字在下拉框旁有明显视觉高亮
  - Verify: [C] 按 `../2-prototype/mock.html` 里 `.facet-bar` 与 `#facetCurrent` 两处的位置与样式，人工打开生成的报告核对一次

- AC-006: 报告不记忆用户上次选中的 facet；每次重新打开/重新生成的报告默认选中下拉框
  第一项
  - Verify: [A] `node -e "const s=require('fs').readFileSync('.copilot/agents/insight/generate-insight-report.js','utf8'); if(!/facet-select/.test(s)) process.exit(1); if(/localStorage|sessionStorage/.test(s)) process.exit(1); process.exit(0)"` → 退出码 0

## 挡着的事

- None.

## 残留风险

- None. 全部验收口径均已用户确认，没有被跳过的阶段，没有提前收口的歧义。

## 访谈记录

### 第 1 轮（1-interview）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 下拉框选项文案用什么 | A 复用 `h2` 标题元素 人话标题 70% / B 内部 key 10% / C 另建精简词典 20% | A | A。补充：「要人话，不要内部 key，比如不能显示「facet_conv_rate」这种，要显示「转化率」这种人能看懂的名字」 |
| facet 无数据时选项怎么表现 | A 照常出现+暂无数据提示 55% / B 直接不出现 30% / C 置灰 15% | A | A。补充：「选项还是要在列表里，别隐藏也别置灰，选中之后主区域写一句「这个 facet 暂无数据」就行，别空白一片」 |
| 要不要记住上次选择 | A 不记忆默认第一个 60% / B localStorage 记忆 30% / C URL hash 10% | A | A。补充：「不用记，每次打开默认第一个就行」 |
| 隐藏方式，要不要保留 Ctrl+F 跨 facet 搜索 | A `content-visibility:hidden` 65% / B `display:none` 20% / C 不真隐藏 15% | A | A。补充：「其他没被选中的内容不用删掉，只是隐藏，我偶尔还是想用浏览器内搜索找到别的 facet 的内容，老浏览器不兼容的风险可以接受」 |

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 下拉框放页面顶部，不塞进任何 facet 区块内部 | 默认 | 控件属于全局导航层，应放全局位置 | 未反对，预告 mock 阶段会具体挑位置 |
| 原生 `select` 元素，零依赖实现 | 默认 | 与报告现有零依赖风格一致 | 未反对 |
| 选中态要有明显视觉反馈（高亮当前 facet 名字） | 默认 | 用户切换后要能一眼确认看的是哪个 | 未反对，明确列为验收点 |
| `sec-header`/`sec-glance` 不算进可筛选列表、始终显示 | 确认 | 它们是全局摘要，不属于单一 facet | 未反对 |

### 第 2 轮（2-prototype，mock 迭代）

| 版本 | 给用户看了什么 | 用户意见 |
| --- | --- | --- |
| v1（首版草稿） | 下拉框塞在 `sec-glance` 区块内部，选中态只有原生 select 元素自身显示当前值，无额外高亮 | 两条：1) 下拉框要挪到页面顶部独立醒目位置，不要塞进任何一个 facet 区块内部；2) 选中态要有明显视觉反馈，比如高亮当前选中的 facet 名字 |
| v2（`../2-prototype/mock.html`，确认版） | 挪到独立顶部 sticky 横条，旁边加一个高亮标签实时显示当前选中的 facet 名字 | 确认通过，不再提新意见 |

### 第 3 轮（3-contract，验收条件）

| AC | 候选途径与代价 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| AC-001 文案人话化 | [A] 源码级静态字符串断言，只验证写法不验证某次真实生成结果 | [A] | 推荐即可（「你推荐什么就是什么」） |
| AC-002 无数据提示 | [B] 建覆盖各 facet 无数据组合的 fixture（代价高，各 facet 触发条件互不相同）/ [C] 人工照 mock 核对（代价低） | [C] | [C] |
| AC-003 隐藏机制用 `content-visibility` | [A] 源码级静态字符串断言 | [A] | [A] |
| AC-004 Ctrl+F 实测能命中隐藏内容 | [C] 真实浏览器人工核对（依赖浏览器版本，仓库不钉死目标浏览器） | [C] | [C] |
| AC-005 顶部独立位置 + 选中态高亮 | [C] 人工核对（界面呈现，仓库无视觉回归基建，不虚标 [A]） | [C] | [C] |
| AC-006 不持久化选择 | [A] 源码级静态字符串断言 | [A] | [A] |

用户原话（3-contract 收口时）：「这是纯前端静态报告，没有自动化视觉回归基建，你推荐什么就是什么，都按你说的定」。

## 设计取舍

### D-1 [A] 档 Verify 验证深度：源码级静态断言 vs 真实生成报告断言

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A（选定） | 直接 grep/正则检查 `generate-insight-report.js` 源码里有没有约定的标记（`facet-select` class、`content-visibility` 用法、没有 `localStorage`） | 只验证「代码写没写这个东西」，不验证某次用真实数据跑出来的报告是否真的表现正确；但零 fixture 成本，现在就能跑 | 无（选定） |
| B | 先跑一次 `generate-insight-report.js` 拿真实的 `--data-path` fixture 生成实际 HTML，再对输出文件做同样的字符串断言 | 置信度更高，能捕捉「源码对但生成路径没走到」这类问题；但仓库里没有可用的 `insight-data.json` 样例，`agg`/`sessions`/`meta` 字段结构复杂（涉及 3210 行生成逻辑的多处字段读取），造一份能跑通全流程的最小 fixture 本身就是一次不小的建设，对本次改动来说代价不成比例 | 仓库没有现成 fixture，建它的代价明显高于收益，本次先用方案 A |
| 什么都不做（全部退化为 [C]） | 三条 AC-001/003/006 也都改成人工核对 | 零建设成本 | 这三条恰好是「代码写没写某个约定」的机械检查，完全够格自动化，退化成人工核对是在浪费一个本可以自动拦回归的机会 |

选定 A。理由：这次改动是纯前端渲染层，规则本身（文案来源、隐藏机制、是否持久化）都能
从源码字符串层面可靠判定，不需要真实跑一遍完整数据流水线才能验证；而搭一份能跑通全部
3000+ 行生成逻辑的最小数据 fixture，成本远超这次改动本身。若未来仓库补上了标准测试
fixture，AC-001/003/006 可以顺势升级成跑真实生成结果的断言。
落进契约的形态：`验收条件` 直接写成源码级 `[A]` 断言，`Why` 段落在各条 Verify 之外
不重复展开这层权衡（已经写在这里）。
