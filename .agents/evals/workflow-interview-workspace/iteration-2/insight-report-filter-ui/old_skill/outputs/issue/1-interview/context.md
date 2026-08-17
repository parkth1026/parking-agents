# Context Snapshot: 2026-08-13-insight-report-facet-filter

- 创建：2026-08-13T00:00:00Z
- 分片来源：无，宿主直接调查

## 任务陈述
.copilot/agents/insight/generate-insight-report.js 生成的报告现在是一份很长的静态大页面，想加一个按 facet 筛选的下拉框，选了之后只显示对应 facet 的内容，不用整页翻。

## 用户提出的方案
加一个下拉框，选中某个 facet 后只显示对应内容，不需要整页翻找。未提出具体交互细节（放哪、选项文案、无数据怎么办、是否记住上次选择）。

## 意图假设
用户是这份报告的日常读者（运营/分析角色），不是开发者。核心诉求是"减少无关滚动"，
不是要拆分报告数据结构本身——报告仍是一次性生成的静态 HTML，只是希望浏览体验从
「整页翻」变成「按需看一块」。

## 已查事实
| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 报告由单个 Node 脚本一次性拼字符串生成，`fs.writeFileSync` 落盘为一个自包含 HTML 文件，无构建步骤、无前端框架 | `generate-insight-report.js:3199-3204` | Fact |
| 页面已经按顺序纵向排布约 23 个 `<div class="section" id="sec-*">` 区块（At a Glance、对话动力学、Agent 分布、工具分析、Token 消耗……到 Session 详情列表），每个区块有独立 `<h2>` 标题 | `generate-insight-report.js:1583-2950`（各 `id="sec-*"` 行） | Fact |
| 页面已有一份左侧滑出导航 `nav-toc`，用中文人话标签列出这 23＋1（含 header）个区块的锚点链接，点击即跳转/滚动到对应区块，但不隐藏其余内容 | `generate-insight-report.js:1493-1520`，CSS `1054-1095` | Fact |
| 部分区块是**条件渲染**：只有当对应数据存在时才会把该 `<div id="sec-*">...` 推入 `parts`（如 `sec-glance`、`sec-deep`、`sec-narratives`、`sec-lang` 等被 `if (...)` 包裹），数据不存在时该区块在最终 HTML 里完全不存在（不是隐藏，是没生成） | `generate-insight-report.js:1583, 2155, 2217, 2363` 等多处 `if (...) parts.push('<div class="section" id="sec-...')` | Fact |
| 代码库里另有一个同名词"facets"，指 LLM 对每个会话抽取的语义字段对象（`briefSummary`/`goalCategories`/`outcome`/`userSatisfaction`/…），来自 `reports/facets-cache/*.json`，是脚本内部变量 `facetsData`/`facetsMap`/`args.facetsPath` 的含义 | `facets-schema.json:1-60`，`generate-insight-report.js:26,106-175,445-459` | Fact（术语冲突，见下） |
| 页面结尾有一个 `<script>` 块，已有 `toggleNav`、`copyCode`、`toggleCollapse`、`slSort` 等纯原生 JS 函数，无第三方库依赖，可以在同一处追加筛选逻辑 | `generate-insight-report.js:3116-3193` | Fact |
| 仓库对这个脚本没有任何自动化测试或 CI 门：`.copilot/agents/insight/` 下无测试文件，`git log` 该目录下的历史提交也不含测试改动；README 里写的验证方式是手工跑三阶段流水线后打开 HTML 看 | `README.md:1-133`（全篇无"test"字样），仓库内未找到 `*.test.*` 命中该目录 | Fact |
| 响应式：CSS 已有一条 `@media` 断点把 `.nav-toc` 收窄到 160px（约等于窄屏适配），未见其它针对本报告的移动端专门样式 | `generate-insight-report.js:1360` | Fact |

## 验证基建候选池
- **手工生成 + 浏览器人工核验**（唯一现实候选）：`node generate-insight-report.js --data-path <...>` 生成 HTML，人工用浏览器打开点选下拉框逐项核对。代价：无法自动跑在 CI 里，每次改动都要人复核；仓库现状就是如此，没有别的基建可选。
- **新建自动化视觉回归**：仓库零外部依赖、零测试框架，引入 Playwright/Puppeteer 一类工具属于新建基建。代价：本次改动量对不上新增一整套浏览器自动化基建的维护成本；且用户已明确表示"跟着仓库惯例来"。
- 结论：这次改动的界面验收只能落在人工核验（对照 mock 或改后成品页面），不落自动化脚本，写进契约时验证途径要显式标"用户判断/[C] 档"。

## 术语冲突
用户口中的"facet"与代码里变量名 `facets`/`facetsData`（LLM 语义分析字段，`facets-schema.json`
定义的 `briefSummary`/`goalCategories`/`outcome` 等）字面同词，但指的不是一回事：

- 代码里的 `facets` = 每个 session 的 LLM 抽取字段，是数据层概念，不是页面可见区块。
- 用户描述的现象——"很长的静态大页面"、"每次只想看某一个 facet 的内容，不想整页翻"——
  精确对应的是页面上纵向排列的这 23＋1 个 `<div class="section">` 区块（已有的 `nav-toc`
  锚点列表就是这些区块的现成人话清单）。

这个词该按哪个意思走，改变的是下拉框到底筛的是"页面区块"还是"某个 session 的语义标签"，
是完全不同的两种实现，必须由用户裁决（见下方提问）。

## 四分类
- **Fact**：报告生成方式、现有区块结构、既有导航、条件渲染行为、验证基建现状——如上表。
- **User decision**：
  1. "facet" 到底指页面区块还是数据层 facets 字段（术语冲突，见上）；
  2. 下拉框要覆盖哪些区块——是否包含页面头部（`sec-header`，标题/汇总条）和 Session
     详情列表（`sec-sessions`，一张大表）这类"元信息/明细表"区块，还是只覆盖中间的
     分析类区块；
  3. 某个 facet 在这次生成的数据里没有内容时，下拉框选项要不要照常出现、选中后主区域
     显示什么文案；
  4. 下拉框选项文案用什么措辞（人话还是内部 key/id）；
  5. 是否要记住用户上次选的 facet（跨刷新/跨报告）。
- **Agent-owned**：具体的 CSS 类名、JS 函数命名、下拉框用原生 `<select>` 还是自绘组件、
  选中态视觉细节的具体实现手法（只要满足"看得出选中"这条约束）、响应式细节。
- **Blocked**：无。

## 未知项
无跨仓库边界的未知项——这次改动完全在 `generate-insight-report.js` 单文件内，运行时是
纯静态 HTML+内联 JS，不涉及外部服务、权限或下游消费者。
