# Goal Contract: 给 Insight 报告加顶部 facet 筛选下拉框，不用整页翻

- Status: Ready
- Target: `.copilot/agents/insight/generate-insight-report.js`
- Updated: 2026-08-11

## 原始请求

> .copilot/agents/insight/generate-insight-report.js 生成的报告现在是一份很长的静态大页面，想加一个按 facet 筛选的下拉框，选了之后只显示对应 facet 的内容，不用整页翻。

## 目标

报告的日常读者（运营/分析同学）能通过页面顶部一个下拉框只看某一个 facet 的内容，不用再整页滚动去找。

## Why

- 报告现在把约 25 个 `<div class="section" id="sec-*">` 区块一次性纵向铺开，读者一次只想看其中一个（比如只想看 Token 消耗或异常检测），要么整页滚动，要么依赖已有的左侧 nav-toc 抽屉逐个跳，操作成本高。
- 做完之后，选一下下拉框就能只看想看的那部分，其余内容仍在但不占视线。

## 范围

**做**：为 `generate-insight-report.js` 生成的 HTML 报告新增一个页面顶部下拉框，选项覆盖报告本次实际渲染出的全部顶层 `sec-*` 区块（Token 消耗、工具分析、异常检测……含代码里已有的那 5 个由 `facets-cache` 驱动的语义分析区块，二者是同一个下拉框的选项，不分层）；选中某个 facet 后主内容区只显示该区块，其余隐藏但保留在 DOM 里；默认打开显示列表第一个 facet；本次没有数据的 facet 选项照常出现、可选中，选中后显示固定占位文案；当前选中项有独立于 `select` 本身的明显视觉反馈。

**不做**：不改 `generate-quant-report.js`、`generate-qual-report.js`（用户原话只点名了 `generate-insight-report.js`）；不新建自动化测试或视觉回归基建；不记住用户上次选择（不引入 `localStorage` 等持久化）；不改任何区块内部既有的内容、计算逻辑或既有的 `nav-toc` 锚点导航行为；不做像素级视觉还原（`mock.html` 定的是结构、信息与关键交互方向，不是像素规范）。

## 强约束

- 报告仍是零外部依赖单文件产物：新增逻辑必须是内联 CSS/JS，不得引入任何第三方库、CDN 引用或网络请求。
- 报告生成命令、既有全部 CLI 参数（`--data-path`/`--output-path`/`--title`/`--facets-path`/`--narratives-path`/`--turns-path`）与既有控制台输出必须逐字节保持不变。
- 各 `sec-*` 区块自身的 DOM 结构、`id`、内部内容排布保持不变；筛选是叠加在外面的一层显隐控制，不得改造区块内部实现。
- 隐藏未选中 facet 时，不得使用会让浏览器原生 Ctrl+F（Find in page）搜不到内容的实现（例如单纯 `display:none`），必须让隐藏内容仍可被原生查找命中并展开——这是访谈阶段「隐藏不删除、保留可搜」与浏览器实际行为冲突后，在对照物阶段定下的技术决定，见「设计取舍」D-1。
- 已有的左侧 `nav-toc` 抽屉锚点导航必须继续保留、继续可用。
- 确认版对照物 `../2-prototype/mock.html`、`../2-prototype/behavior.md` 不得修改；执行 Agent 改的是产品，不是对照物。

## 读什么

- `../2-prototype/mock.html`：用户确认版界面 mock（v2，已通过两轮迭代确认）。下拉框的顶部位置、选中态高亮徽标、无数据占位文案、`hidden="until-found"` + `beforematch` 的隐藏/查找机制，均以它为准。
- `../2-prototype/behavior.md`：用户确认版行为对照表，含默认选中项、无数据表现、Ctrl+F 可搜性、不变清单与配置差异结论。
- `../1-interview/context.md`：facet 范围定义的调查依据（报告里全部约 25 个顶层区块，而非代码里 `facetsData`/`facets-cache` 那个更窄的同名子集），以及验证基建候选池。

## 验收条件

- AC-001: 报告打开时与切换下拉框时，主内容区始终只显示当前选中的一个 facet 对应区块；默认选中列表里第一个 facet；其余 facet 的区块仍在 DOM 中但不可见。
  - Verify: [C] 用 `node .copilot/agents/insight/generate-insight-report.js --data-path reports/insight-data.json --output-path reports/report.html` 生成一份报告，浏览器打开 `reports/report.html`：确认首次打开只看到下拉框第一项对应的区块，其余区块不可见；切换下拉框到任意第二项，确认主内容区改为只显示该区块、第一项区块变为不可见 → 与 `../2-prototype/mock.html` 中「打开即只见默认 facet／切换后只见所选 facet」的状态一致
- AC-002: 当前选中的 facet 有独立于 `select` 控件本身的明显视觉高亮标识，不需要展开下拉框就能确认正在看哪个。
  - Verify: [C] 同一份报告里，切换下拉框选中任意一个 facet，观察页面上是否出现独立于 `select`、显示当前 facet 名称的高亮标识 → 与 `../2-prototype/mock.html` 里 `.facet-current` 徽标的呈现一致
- AC-003: 筛选下拉框固定渲染在页面顶部（header 之下），整份报告里全局唯一一处，不嵌入任何 `.section` 区块内部。
  - Verify: [C] 打开生成的报告，确认筛选控件整体位于页面顶部紧邻 header 下方、整份报告只出现一次、且不在任何 `.section` 元素内部 → 与 `../2-prototype/mock.html` 的 `.facet-bar` 位置一致
- AC-004: 某个 facet 本次报告生成时没有数据（如未提供 `--facets-path` 或该目录为空导致 `sec-goals` 等语义分析区块本无内容）时，其选项依旧出现在下拉框里、可正常选中，选中后主区域固定显示「这个 facet 暂无数据」，不是空白也不是禁用态。
  - Verify: [C] 生成一份不带 `--facets-path`（或指向空目录）的报告，确认下拉框选项列表仍包含「目标分布」等 5 个语义分析 facet 且可点选，选中后主区域显示固定文案「这个 facet 暂无数据」→ 对照 `../2-prototype/mock.html` 里 `sec-goals` 的无数据演示
- AC-005: 已隐藏（未选中）facet 的文字内容仍可被浏览器原生 Ctrl+F 搜索命中并自动展开显示，下拉框选中值与高亮标识随之同步切换到命中的 facet。
  - Verify: [C] 在支持 `beforematch` 的 Chromium 内核浏览器中，切到某个 facet 后用浏览器原生 Ctrl+F 搜索另一个未选中 facet 里的一段已知文字，确认能命中、自动展开该区块，且下拉框与高亮标识同步切换过去 → 对照 `../2-prototype/mock.html` 与 `../2-prototype/behavior.md` 变化行 4；不支持该内核特性的浏览器允许搜不到，不算失败

## 挡着的事

- None.

## 访谈记录

### 第 1 轮（1-interview）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 「facet」指报告里全部约 25 个区块，还是只指代码里已有的 5 个 LLM 语义分析 facet？ | A 全部 ~25 个区块 70% / B 仅那 5 个语义区块 20% / C 两层筛选 10% | A | **A**。「报告长就是因为 Token、工具这些区块太多，不是只有那几个语义分析区块」 |
| Q2 某个 facet 本次没有数据时下拉框怎么表现？ | A 选项直接不出现 65% / B 选项常驻+暂无数据文案 30% / C 选项常驻但灰置不可点 5% | A | **B**。「选项要一直都在，不要因为没数据就藏起来或者变灰，选中之后告诉我这个 facet 暂无数据就行，别一片空白也别弄得不能点」 |

Q1 用户选了推荐的 A。**Q2 用户选了 B，翻掉了当时给分更高的 A（65% vs 30%）**——「无数据要不要在选项层面就消失」这件事置信判断偏了，它跨出了"这个人具体想要什么反馈方式"的仓库边界，属于产品体验裁决，仓库事实答不了。

没占提问、走默认区和确认区定下的条目：

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| 只改 `generate-insight-report.js`，不动另外两个报告脚本 | 默认 | 用户原话只点名了这一个文件 | 未反对 |
| 用原生 `select` + 内联 JS/CSS，不引外部库 | 默认 | 报告是零依赖单文件产物 | 未反对 |
| 下拉框默认放页面顶部、全局唯一一处 | 默认 | 已有 nav-toc 抽屉就是"全局一处、不嵌入区块"的先例 | 未反对（对照物阶段进一步落成 AC-003） |
| 不记住上次选择，默认显示第一个 facet | 默认 | 最简单、无状态 | 确认：「不需要记忆，默认显示第一个 facet 就行」 |
| 隐藏其余 facet 用 CSS 隐藏而非从 DOM 删除 | 默认 | 保留 Ctrl+F 跨 facet 搜索的习惯 | 确认：「其他 facet 内容不用删，只是隐藏，偶尔还要用 Ctrl+F 找」（对照物阶段撞出与 `display:none` 的技术冲突，见设计取舍 D-1） |
| 下拉框文案直接用各区块现有 h2 人话标题，不新造内部 key | 确认 | 仓库里每个区块的 h2 本来就是中文人话 | 确认：「好，就用现有标题；明确不要显示 facet_conv_rate 这种内部 key 名，要人话」 |

### 第 2 轮（2-prototype，mock.html 迭代）

| 版本 | 给用户看了什么 | 用户提了什么 | 改成什么 |
| --- | --- | --- | --- |
| v1 | 下拉框做成 header 下方一行朴素文字段落；选中后只靠 `select` 本身变值 | 两条：(1) 下拉框要放顶部醒目位置，不要塞成小字说明；(2) 选中态要有明显视觉反馈，比如高亮当前选中的 facet 名字 | v2：独立的 sticky 顶部筛选条 `.facet-bar`（回应意见 1，落成 AC-003）+ 显示当前 facet 名的高亮徽标 `.facet-current`（回应意见 2，落成 AC-002） |
| v2 | sticky 顶部筛选条 + 高亮徽标 + `hidden="until-found"` 演示 Ctrl+F 可搜 | 无新意见，确认通过 | 确认版 `mock.html` |

对照物阶段同时撞出一处双方都没想到的技术冲突：访谈时定的「用 CSS 隐藏保留 Ctrl+F 可搜」用 `display:none` 实现会失效（浏览器原生 Find in page 不匹配 `display:none` 内容），改用 `hidden="until-found"` + `beforematch` 事件才能真正兑现这条要求，见设计取舍 D-1；这条不改变目标、范围或验收标准，未回退 `aes-interview`。

### 第 3 轮（3-contract）

| 项目 | 内容 | 用户反应 |
| --- | --- | --- |
| AC-001～AC-005 各自的「这条错了会怎样」 | 见「验收条件」节各条的观察结果；后果一句话逐条请用户确认，未改写 | 全部确认，AC-002、AC-003 用户额外提到"这条也是我 mock 反馈里提过的" |
| Q3 5 条验收条件怎么验？ | A `[C]` 人工可复现步骤 70%（推荐）/ B 新建 jsdom 断言 22% / C 新建 Playwright 视觉回归 8% | **A**。「这是纯前端静态报告，没有自动化视觉回归基建，跟着仓库惯例，你推荐什么就是什么」 |

## 设计取舍

### D-1 隐藏未选中 facet 的实现机制

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A `display:none` | 未选中的 `.section` 设 `display:none` | 实现最简单 | 浏览器原生 Ctrl+F（Find in page）默认不匹配 `display:none` 的内容，直接违反访谈里已确认的「隐藏不删除、保留 Ctrl+F 可搜」这条要求，属于访谈定过的东西被实现方案悄悄推翻 |
| B（选定）`hidden="until-found"` + `beforematch` 事件 | 未选中的 `.section` 设 `hidden="until-found"`；监听 `beforematch` 事件，命中时同步下拉框选中值与高亮徽标 | 需要现代 Chromium 内核支持；旧内核降级为搜不到隐藏内容 | 无——这是唯一能同时满足"视觉隐藏"与"Ctrl+F 仍可搜"两条要求的原生浏览器机制，且不需要引入任何第三方库，符合零依赖约束 |
| 什么都不做（继续整页排列） | 保持现状 | 用户核心诉求完全落空 | 正是这次要解决的问题 |

选定 B。理由：这是对照物阶段撞出的技术细节——需求阶段确认「隐藏不删除、保留 Ctrl+F 可搜」时，双方都没意识到 `display:none` 会让这条要求在浏览器层面直接失效；`hidden="until-found"` 是目前唯一能同时满足两边诉求、又不破坏"零外部依赖"这条既有约束的原生方案。落进契约的形态：`强约束` 写「隐藏未选中 facet 时不得使用会让浏览器原生 Ctrl+F 搜不到内容的实现」。
