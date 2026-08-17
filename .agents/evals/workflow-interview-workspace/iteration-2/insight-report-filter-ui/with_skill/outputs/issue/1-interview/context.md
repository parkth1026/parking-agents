# Context Snapshot: 2026-08-13-insight-report-filter-ui

- 创建：2026-08-13T00:00:00Z
- 分片来源：无，宿主直接调查

## 任务陈述

> .copilot/agents/insight/generate-insight-report.js 生成的报告现在是一份很长的静态大页面，想加一个按 facet 筛选的下拉框，选了之后只显示对应 facet 的内容，不用整页翻。

## 用户提出的方案

加一个下拉框（select），选中某个 facet 后，页面主区域只显示该 facet 对应内容，其余内容不用整页翻查看。

## 意图假设

用户是这份报告的日常使用者（运营/分析同学），不改代码。真正的问题不是「页面长」本身，
而是「每次只想看一个 facet，却要用眼睛/滚轮在一份长页面里定位」——现有的 `nav-toc`
侧边导航已经提供了跳转链接，但跳转后其余内容仍然全部占据 DOM/滚动空间，没有真正的
「只显示一个、隐藏其余」效果。用户要的是可视区域的收窄，不是新增数据或新增分析维度。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| `generate-insight-report.js` 生成的 HTML 是单文件自包含产物：`<style>`（行 675-1490）与 `<script>`（行 3116-3193）均内联，未发现任何 CDN / 外链资源引用 | `.copilot/agents/insight/generate-insight-report.js` 全文 grep `cdn/googleapis/unpkg/jsdelivr` 零命中 | Fact |
| 页面已按“区块”组织：每个区块是 `<div class="section" id="sec-xxx"><h2>…</h2>…</div>`，`id` 是内部 key（如 `sec-goals`），`<h2>` 里紧跟一个 emoji 图标 + 人话标题（如「目标分布」） | 行 1583-2951 各处 `id="sec-*"` | Fact |
| 已存在一份 `<nav class="nav-toc" id="navToc">`（行 1494-1520），列出全部 25 个区块的锚点链接（图标+人话标题），点击后 `href="#sec-xxx"` 跳转，但不隐藏其它区块——页面仍是整页可滚动，跳转只是定位 | 行 1493-1521 | Fact |
| `nav-toc` 里列出的 25 个锚点是写死的固定清单，但对应区块很多是**按数据条件渲染**的：例如 `sec-agents` 需要 `subagentEntries.length > 0`（行 1667）、`sec-tools` 需要 `toolEntries.length > 0`（行 1748）、`sec-highlights` 需要 `highlights.length > 0 \|\| issues.length > 0`（行 2019）、`sec-deep`/`sec-narratives`/`sec-learning-curve` 需要 `hasFacets`/`hasNarratives`/`lcData`（行 2152-2217）等。也就是说：**今天如果某个 facet 没有数据，对应区块整段不出现在 HTML 里**，`nav-toc` 里那一条锚点会是死链接（点了无反应，因为目标元素不存在） | 行 1667、1748、2019、2093、2152-2217、2290、2360、2450、2587、2740 及其上下文 | Fact |
| 一部分区块（`sec-header`、`sec-glance`、`sec-tokens`、`sec-time`、`sec-errors`、`sec-code`、`sec-anomaly`）在当前代码里没有数据条件，总会渲染 | 同上 grep 结果里未出现在 `if (...)` 保护下的那几条 | Fact |
| 仓库内没有为 `.copilot/agents/insight/` 配置任何自动化测试、`package.json` 或截图/视觉回归基建；`find` 全仓库未命中相关 test 文件（唯一命中的 `package.json` 都在 `.claude/skills/aes-grilling-workspace/` 的评测样例目录下，与本任务无关） | 全仓库 `find -iname package.json` 与 `-iname *test*`（限定 `*/insight/*`）结果 | Fact |
| README.md 说明本报告有三种生成模式（完整报告 / 客观数据报告 / 语义分析报告），分别由三个不同脚本产出，字段覆盖范围不同——同一份「facet 清单」在不同运行模式下，有数据的子集也会不同 | `.copilot/agents/insight/README.md` 行 1-60 | Fact |

## 验证基建候选池

- **用户真实测试（人工打开报告点选）**：唯一现成途径。代价：无自动化，每次改动都要人工验证；仓库没有为这份 HTML 配无头浏览器/DOM 测试基建，新建的代价是从零搭（Playwright/jsdom 等），对一份内部运营报告来说投入产出比低。
- **静态字符串断言（跑生成脚本后 grep 输出 HTML 里的关键字符串，比如 `<select` `data-facet=` 等）**：代价含先写：脚本本身不难写（Node 内置 `child_process` + 生成后的文件读取），仓库已经是纯 Node 脚本、无构建步骤，属于「现成语言能力，未被打包成断言」的那类，比引入浏览器测试基建代价低得多。
- **视觉回归 / 截图 diff**：仓库没有，代价含先建（引入 Puppeteer/Playwright + 基线截图流程），对一次性内部工具报告改动来说代价明显偏高。

## 四分类

- **Fact**：见上表。
- **User decision**：下拉框选项文案用人话还是内部 key；某 facet 无数据时下拉框选项是否隐藏/置灰/照常显示+提示；是否记住用户上次选择；下拉框放置位置（页面顶部 vs 区块内部）；是否需要保留 Ctrl+F 全文搜索能力（即隐藏内容是否要从 DOM 移除还是仅 CSS 隐藏）。
- **Agent-owned**：下拉框的具体 DOM/CSS 实现方式（`<select>` 原生控件还是自定义组件）、JS 用什么方式绑定 `change` 事件、CSS class 命名。
- **Blocked**：无。

## 未知项

无跨仓库边界的未知项——用户就是这份报告的最终使用者，能直接裁决全部待定项。
