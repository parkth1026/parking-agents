# Impact Surface: 2026-08-11-insight-report-facet-filter

- 创建：2026-08-11T00:00:00+08:00
- 上游：`1-interview/context.md`、`1-interview/rounds.jsonl`（Q1=A 全部区块可筛选，Q2=B 无数据区块选项常驻+暂无数据提示）

## 用户可见界面 — 有

`generate-insight-report.js` 生成的 HTML 报告新增一个页面顶部下拉框，选中某个 facet
（现有约 25 个 `<div class="section" id="sec-*">` 区块之一）后，主内容区只保留该区块
可见，其余区块隐藏（不删除，Ctrl+F 仍要能找到）；无数据的 facet 选中后显示「这个 facet
暂无数据」占位文案；当前选中项要有可辨认的视觉反馈。

→ 出 `mock.html`。

## 可观察行为 — 有

同一份已生成的 HTML 文件，打开时默认只显示第一个 facet（而不是像现在这样一次性铺开
全部区块）；选择动作是纯客户端交互，不重新请求数据、不重新生成文件。「隐藏」与「删除」
在浏览器原生 Ctrl+F 搜索上表现不同——这是本阶段撞出的一处双方都没想到的技术细节，
见下方「撞出的新材料」。

→ 出 `behavior.md`。

## 可运行输出（终端/日志）— 无

`node generate-insight-report.js --data-path ... [--output-path ...] [--title ...]
[--facets-path ...] [--narratives-path ...] [--turns-path ...]` 的调用方式、参数、
控制台输出（如 `[report] Loaded N turn summaries`）完全不变，只是最终写出的
`.html` 文件内容里多了下拉框相关的 HTML/CSS/JS。不出对照物。

## 对外接口报文 — 无

该脚本不暴露、不消费任何网络接口；输入是本地 JSON 文件，输出是本地 HTML 文件。
不出对照物。

## 用户配置 — 无

不新增命令行参数、环境变量或配置文件字段。`--facets-path`/`--narratives-path`/
`--turns-path` 等既有参数含义不变。不出对照物。

## 历史兼容性 — 有（影响很小，写进 behavior.md 不变清单）

- 已经生成好、躺在磁盘上的旧版报告文件不会被这次改动追溯修改，它们保持原样（一次
  性整页排列），这是预期行为，不是回归。
- 另外两个报告脚本 `generate-quant-report.js`、`generate-qual-report.js` 本次不动，
  继续保持整页排列，见 `1-interview/rounds.jsonl` 第一条默认项。
- 报告的 25 个顶层区块本身的 DOM 结构、id、既有的锚点导航 `nav-toc`（左侧抽屉，点击
  跳转 `#sec-*`）保留不变；下拉框是叠加能力，不替换它。

## 撞出的新材料（写入本节，不在对照物里现场糊过去）

浏览器原生 Ctrl+F（Find in page）默认不会匹配 `display:none` 的内容，而访谈阶段的
默认决定是「用 CSS 隐藏（如 `display:none`）保留 Ctrl+F 可搜」——这两点直接冲突：
如果真用 `display:none`，用户想用 Ctrl+F 找别的 facet 的内容时会找不到，等于默默
违反了访谈里已确认的那条默认项。

现代 Chromium 提供 `hidden="until-found"` 属性 + `beforematch` 事件，专门解决
「视觉隐藏但仍可被浏览器原生查找、命中后自动展开」这个场景，语义上完全对上用户的
诉求。mock.html 用这个属性演示，并在下方「不变清单」里把它写成技术性决定，附带
降级说明（不支持该属性的旧浏览器退化为「找不到」，不阻塞验收，因为仓库对浏览器
兼容范围没有既有约束可查，且用户人设明确「跟着仓库惯例，Agent 推荐什么就是什么」）。
这条不需要回 `aes-interview`：它不改变目标、范围或可观察验收标准，只是把「怎么隐藏」
这个 Agent-owned 实现细节做对，用 mock 演示出来给用户确认即可，无需为它单独回退访谈。
