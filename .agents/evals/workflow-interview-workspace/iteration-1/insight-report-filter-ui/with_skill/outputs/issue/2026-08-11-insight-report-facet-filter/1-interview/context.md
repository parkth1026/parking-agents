# Context Snapshot: 2026-08-11-insight-report-facet-filter

- 创建：2026-08-11T00:00:00+08:00
- 分片来源：无，宿主直接调查

## 任务陈述
.copilot/agents/insight/generate-insight-report.js 生成的报告现在是一份很长的静态大页面，想加一个按 facet 筛选的下拉框，选了之后只显示对应 facet 的内容，不用整页翻。

## 用户提出的方案
加一个下拉框，选中某个 facet 后只显示对应内容，隐藏其余内容（非删除，避免破坏 Ctrl+F 搜索其他 facet 的习惯）。

## 意图假设
用户是报告的日常读者（运营/分析同学），不写代码。真正的问题是「报告一次性把 25 个区块全铺开，每次只想看某一个区块，却要整页滚动/翻找」，不是数据本身有问题。下拉框只是他能想到的界面形式，本质诉求是「按区块快速定位 + 减少视觉噪音」。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 报告是单文件、零外部依赖、CSS+JS 全内联的暗色主题 HTML，无框架 | `generate-insight-report.js:4-9` | Fact |
| 报告当前由 ~25 个顶层 `<div class="section" id="sec-*">` 区块纵向堆叠组成，另有一个 header 区（`sec-header`）不算业务 facet | `generate-insight-report.js:1494-1520`（nav-toc 列表）、各处 `id="sec-*"` 定义（1583~2951 行） | Fact |
| 已存在一个左侧抽屉式导航 `nav-toc`，点击链接用锚点 `#sec-*` 跳转到对应区块，靠 `toggleNav()` 开合，不是本次要加的下拉筛选，但证明"按区块定位"这个诉求已经被半解决过一次 | `generate-insight-report.js:1055-1096, 1494-1520, 3117-3143` | Fact |
| 代码里另有一个语义完全不同的 "facets" 概念：`analyze-insight.js` 产出、`reports/facets-cache/*.json` 里每个 session 的 LLM 语义标注字段（如 `goalCategories`、`outcome`、`userSatisfaction`），报告用它们聚合出 `sec-goals`/`sec-outcomes`/`sec-satisfaction`/`sec-friction` 等区块 | `generate-insight-report.js:444-569` | Fact + 术语冲突 |
| 不是每个区块在每次生成时都会渲染：`sec-glance`/`sec-narratives` 依赖 `hasNarratives`；`sec-goals`/`sec-outcomes`/`sec-satisfaction`/`sec-friction`/`sec-deep` 依赖 `hasFacets`；`sec-learning-curve` 额外要求 `sessions.length >= 3`；`sec-dynamics`/`sec-agents`/`sec-session-types`/`sec-tools` 依赖 `hasTurnData`。缺数据时区块要么整段不生成，要么内部退化成一句提示文案（如 `sec-dynamics` 无 turn 数据时显示提示语） | `generate-insight-report.js:1595-1596, 501, 573, 638` | Fact |
| 仓库有三个报告生成脚本共享同一批区块拼装模式：`generate-insight-report.js`（全量）、`generate-quant-report.js`（仅定量）、`generate-qual-report.js`（仅语义），用户本次请求只点名了 `generate-insight-report.js` | `.copilot/agents/insight/README.md` 报告模式表 | Fact |
| 仓库根 `package.json` 的 `test` 脚本只覆盖 `tests/skills`、`tests/hooks`、`tests/pi`、`tests/harnesses` 等技能自身测试，不包含 `.copilot/agents/insight/` 下任何内容；该目录下也没有测试文件，没有 CI 工作流（`.github` 目录不存在） | `package.json:8`、`.copilot/agents/insight/` 目录列表、仓库无 `.github/` | Fact |
| 报告是纯前端一次性生成的静态产物，无构建步骤、无打包器，脚本直接拼接字符串输出 HTML | 通读 `generate-insight-report.js` 全文 | Fact |

## 验证基建候选池
- **人工在浏览器里跑一遍生成命令 + 目测/点击验证**：仓库对这个工具链没有任何自动化测试或 CI，唯一可行且零新增代价的途径；README 里给的三条命令（quant/full 模式）就是天然的手动验证步骤。代价：不可重复回归，靠人记得再点一次。
- **新建自动化视觉/交互回归（如 Playwright 快照）**：仓库里没有任何前端自动化测试先例可抄，代价含从零建基建（选框架、装依赖、写 fixture），和"零外部依赖单文件工具"的项目气质冲突，性价比低。
- **新建 Node 级 DOM 断言（如用 jsdom 载入生成的 HTML 断言下拉框选项数/隐藏逻辑）**：比视觉回归轻，但仓库 `package.json` 里没有 `jsdom`/`happy-dom` 等依赖，仍是"代价含先建"。

按 asking.md 的分诊，验证途径选择本身要问用户（见下）。

## 术语冲突
用户说的「facet」在他的语境里 = 报告里那 ~25 个纵向堆叠的 `<div class="section" id="sec-*">` 区块（如"Token 消耗分析""工具使用分析""异常检测"）。仓库代码里已经有一个同名但语义完全不同的 `facets`：`analyze-insight.js` 产出的每-session LLM 语义标注 JSON（`reports/facets-cache/*.json`），只驱动其中 4~5 个区块（`sec-goals`/`sec-outcomes`/`sec-satisfaction`/`sec-friction`/`sec-deep`），不是全部 25 个。两者不是一回事：如果直接照搬代码里的 `facets` 概念做下拉框，筛选范围会比用户想要的窄很多（漏掉 Token/工具/时间分布/异常检测等纯定量区块）。已列为提问区第一条。

## 四分类
- **Fact**：以上「已查事实」表全部。
- **User decision**：见下方提问区四条（筛选范围/facet 定义、选项文案人话与否、无数据区块的下拉框表现、mock 阶段用什么当口径确认）。
- **Agent-owned**：具体用什么 DOM/CSS 技巧做筛选（原生 `<select>` + `display:none`/`class` 切换，还是别的）、下拉框放置的精确像素位置与视觉样式细节（在"顶部"这个大方向确定后）、URL hash 是否同步等实现细节，局部可逆、不改变外部契约。
- **Blocked**：无。

## 决定边界未知项
- 「facet」到底是指全部 ~25 个 `sec-*` 区块，还是仅指代码里已有的、由 `facets-cache` 驱动的那 4~5 个语义分析区块——这个决定同时决定了下拉框选项的候选池大小，必须问。

## 未知项
- 用户是否也要在另外两个报告脚本（`generate-quant-report.js`/`generate-qual-report.js`）里加同样的筛选——请求原话只点了 `generate-insight-report.js`，按字面先只做这一个，默认区处理，不占提问区。
- 是否要记住用户上次选择（localStorage）——人设倾向明确不需要，但按流程仍需批量问清阶段确认一次，避免默认区判断错。
