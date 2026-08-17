# Impact Surface: 2026-08-13-insight-report-filter-ui

判据：改完之后，这个程序在哪些地方跑起来不一样了？每一处不一样，谁会看见、谁会受影响？

## 用户可见界面

**有。** `generate-insight-report.js` 生成的 HTML 报告新增一个页面顶部的 facet 筛选下拉框；
选中某个 facet 后，主区域只显示该 facet 对应的 `<div class="section" id="sec-xxx">` 内容，
其余 `.section` 用 `content-visibility: hidden` 隐藏（不占版面，但浏览器 Ctrl+F 仍可命中并
自动展开）。下拉框选项文案取自各区块 `<h2>` 里的人话标题，不暴露内部 `id`。无数据的 facet
选项照常在列表里，选中后主区域显示「这个 facet 暂无数据」提示。当前选中项在下拉框旁高亮
显示 facet 名字。谁会看见：打开这份 HTML 报告的运营/分析同学。

出：`mock.html`

## 可观察行为

**有，但已被「用户可见界面」的 mock 完整覆盖，不再单独出 `behavior.md`。** 具体变化点
（选中切换只显示对应 facet、无数据提示文案、默认选中第一个 facet、选中态高亮）本质上都是
同一份界面在不同状态下的表现，是 mock.html 里的「关键状态」而不是独立于界面之外的行为，
拆成两份文件会让同一件事写两遍。

## 可运行输出

**无。** `generate-insight-report.js` 的命令行参数、标准输出、退出码都不变；改动只发生在
生成出来的 HTML 文件内部结构（新增 `<select>`、一段 JS、若干 CSS 规则），脚本本身跑起来的
方式（`node generate-insight-report.js --data-path ... --output-path ...`）和终端能看到的
提示信息不变。

## 对外接口报文

**无。** 这是一个本地命令行脚本生成静态 HTML 文件，不对外提供任何 HTTP/RPC 接口，没有
请求/响应报文。

## 用户配置

**无。** 不新增命令行参数、环境变量或配置文件字段。README.md 里记录的三种生成模式
（完整报告 / 客观数据报告 / 语义分析报告）调用方式不变——三个脚本的现有 CLI 参数
（`--data-path` `--output-path` `--title` `--facets-path` `--narratives-path` 等）都不动。

## 历史兼容性

**有影响，需要保持不变的地方。** 三点不变量：

1. 已经生成过的旧版 HTML 报告文件不受影响——这次改动只影响下次重新运行脚本时生成的新文件，
   不会去改写、迁移任何历史产物。
2. `generate-quant-report.js`、`generate-qual-report.js` 两个脚本当前不在本次需求范围内，
   不新增筛选下拉框（用户的原始请求明确只提到 `generate-insight-report.js`）。
3. 现有 `nav-toc` 侧边导航（图标+锚点跳转）保留，不因为新增下拉框而删除——它是历史已有能力，
   用户没有要求移除，且部分用户可能仍习惯用它快速跳转到某个 facet 内部的某个小节。

这三点写进 `behavior.md` 的「不变清单」由下一阶段（`aes-goal-contract`）转成验收条件，
本阶段不重复出对照物，直接在 mock.html 末尾的「新增什么、不变什么」注释里一并列出即可。
