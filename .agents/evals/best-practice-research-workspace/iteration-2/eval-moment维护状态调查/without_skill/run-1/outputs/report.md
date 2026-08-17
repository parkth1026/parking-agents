# Moment.js 维护状态调研报告

- 调研日期：2026-08-16
- 调研背景：老项目中大量使用 moment.js 做日期处理，近期要开发新功能，需要确认 moment.js 的维护状态、官方态度，以及存量代码与新代码的选型策略。

---

## 一、结论速览（TL;DR）

| 问题 | 结论 |
|---|---|
| moment.js 死了吗？ | **没有死，但官方明确宣布"已经完工"（done）**——自 2020 年 9 月起进入维护模式（maintenance mode），不再开发新功能 |
| 官方推荐新项目用它吗？ | **不推荐。** 官方文档明确写道 "we would like to discourage Moment from being used in new projects going forward"（我们不鼓励在今后的新项目中使用 Moment） |
| 存量代码要动吗？ | **不建议为了"弃用"而专门重构。** 官方仍会修关键安全漏洞、更新时区数据，存量代码可安全继续运行；建议"新代码不再新增依赖 + 旧代码改动时顺手迁移"的渐进策略 |
| 新代码该用什么？ | 优先考虑 **Day.js**（API 最像 moment、团队上手成本最低）或 **date-fns**；强时区需求选 **Luxon**；同时关注已进入 ES2026 的原生 **Temporal** API |

---

## 二、官方自己是怎么说的（第一手出处）

### 2.1 官方文档"项目状态"页原文

moment.js 官方文档设有专门的 [Project Status（项目状态）页面](https://momentjs.com/docs/#/-project-status/)，核心表述（原文引用）：

> "We now generally consider Moment to be a **legacy project in maintenance mode**. It is not dead, but it is indeed done."
> （我们现在普遍将 Moment 视为一个处于维护模式的传统项目。它没有死，但它确实已经完工了。）

> "we would like to **discourage Moment from being used in new projects going forward**"
> （我们不鼓励在今后的新项目中使用 Moment。）

官方明确列出**不会再做**的事：

- 不新增任何功能或能力；
- 不会把 API 改为不可变（immutable）设计；
- 不解决 tree shaking / 打包体积问题；
- 不做重大变更，**不会有 v3 版本**；
- 可能选择不修复长期已知的 bug 和行为怪癖（尤其是涉及 locale 本地化数据的）。

官方承诺**仍然会做**的事：

- 处理关键的安全问题；
- 跟随 IANA 时区数据库更新，持续发布 moment-timezone 数据更新。

### 2.2 GitHub 仓库 README 的声明

GitHub 仓库 [moment/moment](https://github.com/moment/moment) README 顶部同样标注：

> "Moment.js is a legacy project, now in maintenance mode. **In most cases, you should choose a different library.**"
> （Moment.js 是一个传统项目，现处于维护模式。在大多数情况下，你应该选择别的库。）

### 2.3 官方给出的弃用原因

官方在项目状态页中列举了三条主要动机：

1. **对象可变（mutable）**：moment 对象是可变的，容易引发难以察觉的 bug；
2. **打包体积大**：moment 的设计无法配合现代打包工具做 tree shaking，导致前端包体积偏大；
3. **工具链已在"劝退"**：Chrome DevTools 已开始（因包体积原因）向开发者提示建议替换 Moment。

> 注：网上大量"还在推荐 moment"的教程文章多为旧内容或未更新，与官方立场相悖。选型时应以官方文档为准。

---

## 三、"维护模式"的实际含义：现在（2026-08）还活着吗？

维护模式 ≠ 停止维护。以下为 2026-08-16 当天核实的客观事实：

| 事实 | 数据 | 出处 |
|---|---|---|
| 仓库是否归档 | **未归档**（archived: false） | [GitHub API / 仓库页](https://github.com/moment/moment) |
| 星标数 | 约 47,900 stars | 同上 |
| 最近一次代码推送 | 2026-08-15（昨天） | 同上 |
| 最新正式版本 | **2.30.1**，发布于 **2026-07-26** | [GitHub Releases](https://github.com/moment/moment/releases) |
| 时区库 moment-timezone | 最新 0.6.3，2026-07 仍有更新 | [moment/moment-timezone](https://github.com/moment/moment-timezone) |
| npm 注册表最近更新 | 2026-08-12 | npm registry |

**解读**：项目仍在按"维护模式"的承诺运转——持续修 bug、跟进时区数据（例如 2.30.1 就是 2026 年 7 月发布的维护版本），但没有任何新功能开发，也永远不会出 v3。它**可以安全地继续在存量项目中运行**，不是安全风险源，只是技术上限已锁定。

---

## 四、社区使用现状：它还是主流吗？

npm 最近 30 天下载量（2026-08-16 经 npm 下载统计 API 查询）：

| 库 | 近 30 天下载量（约） | 相对关系 |
|---|---|---|
| date-fns | 3.90 亿 | moment 的约 2.7 倍 |
| Day.js | 2.60 亿 | moment 的约 1.8 倍 |
| Luxon | 1.46 亿 | 与 moment 相当 |
| **moment** | **1.43 亿** | 仍庞大，但已被多个替代品反超 |

打包体积对比（bundlephobia，2026-08-16 查询；Day.js 为官网自述）：

| 库 | 压缩前 | gzip 后 |
|---|---|---|
| moment 2.30.1 | 60.6 kB | 19.7 kB |
| Luxon 3.7.2 | 69.8 kB | 21.9 kB |
| Day.js | — | 约 2 kB（官网自称 "Fast 2kB alternative to Moment.js"） |

注意：moment 的 60.6 kB 只是核心（不含语言包）。moment 默认会引入全量 locale 文件，实际前端打包增量常达数百 kB 且**无法 tree shaking**——这正是官方弃用的核心动机之一，也是迁移收益最直接的地方（仅对浏览器端有意义；Node.js 服务端打包体积基本不构成问题）。

---

## 五、存量代码要不要动？

**结论：不必为"moment 被弃用"而发起专项重构，但应停止增长，按机会成本逐步迁移。**

官方态度本身也支持这一点。项目状态页明确列出了"继续使用 Moment 的合理理由"：

- 需要兼容老浏览器（moment 支持 IE8+）；
- 其他依赖（日期选择器、图表库等）本身依赖 moment，此时全项目统一用 moment 反而比混用两个库好；
- 团队对它的 API 和坑足够熟悉，上述问题不构成实际困扰。

针对"老项目 + 加新功能"的具体建议：

1. **不要做"一刀切"的大规模重写**。日期/时区逻辑是重灾区，大爆炸式迁移的回归风险通常高于收益。
2. **冻结增量**：新功能一律不再新增 `moment()` 调用（见第六节选型）。
3. **机会式迁移（绞杀者模式）**：改到哪个模块就顺手把该模块的 moment 换掉；不改的模块不动。
4. **前端先动，后端缓动**：浏览器端有包体积收益（且 Chrome DevTools 会提示），Node.js 服务端收益很小，优先级可放低。
5. **如果第三方依赖（如老版 antd 日期组件、某些图表库）内部依赖 moment，别硬拆**——等依赖库升级或统一处理。
6. **立即做的低成本优化**：若必须继续用 moment，配置构建（如 webpack `IgnorePlugin`）只保留实际用到的 locale，通常可立省数百 kB。

---

## 六、新代码该不该继续用？用什么？

**结论：新代码不应再引入 moment（这是官方明文建议），按场景选替代方案。**

官方项目状态页给出的推荐替代（[出处](https://momentjs.com/docs/#/-project-status/recommendations/)）：

| 方案 | 官方/社区定位 | 亮点 | 注意点 |
|---|---|---|---|
| **Luxon** | 官方称其为 "the evolution of Moment"（Moment 的进化版），由 Moment 长期贡献者 Isaac Cambron 开发 | 基于 Intl API，时区与本地化能力最强，不可变 API | API 与 moment 差异较大，迁移有学习成本 |
| **Day.js** | 极简替代品，官网自称 "Fast 2kB alternative to Moment.js"，API 与 moment 高度相似 | 体积约 2 kB，团队从 moment 迁移上手最快 | 官方提醒它 **不是** drop-in replacement，个别行为与 moment 有差异；时区能力靠插件 |
| **date-fns** | 基于原生 Date 的函数式工具集 | 可 tree shaking，按需引入，现代社区用量最大 | 函数式风格与 moment 的链式调用习惯差异大 |
| **js-Joda** | Java ThreeTen Backport 的 JS 移植 | API 严谨 | 生态小，国内使用少 |
| **原生 Date + Intl** | 不引入第三方库 | 零依赖 | 官方文档强烈不建议用 `Date.parse` / `new Date(字符串)` 解析字符串（"strongly discouraged"） |

**对"moment 老团队 + 要加新功能"的最优路径：优先 Day.js**（心智模型几乎一致、`dayjs(value).format('YYYY-MM-DD')` 这类常用写法基本原样保留），需要复杂时区运算时选 Luxon。

### 前瞻：原生 Temporal API 已定稿（值得纳入技术雷达）

- TC39 提案 [proposal-temporal](https://github.com/tc39/proposal-temporal) 已于 **2026 年 3 月达到 Stage 4**，正式纳入 **ECMAScript 2026**，用于一劳永逸地替代 `Date` 及第三方日期库；
- 实装进度（2026-08）：**Firefox 139**（2025-05-27 发布）、**Chrome 144**（2026-01-13 发布）、**Node.js 26**（2026-05-05 发布）已内置；Safari/JavaScriptCore 尚在开发中；
- 官方 polyfill `@js-temporal/polyfill` 仍标注 Alpha，官方仓库明确提示其自带 polyfill **不要用于生产环境**；如需生产 polyfill 可关注社区维护的 `temporal-polyfill`；
- **建议**：Safari 尚未实装、polyfill 未到生产级，现阶段新代码直接全面押注 Temporal 还早；但跨浏览器就绪后（预计一两年内），新项目可优先原生方案，无需任何第三方库。

---

## 七、给本项目的行动清单

1. 【立即】新功能代码不再新增 moment 依赖，团队约定选 Day.js（或 date-fns/Luxon，由技术负责人定夺并写入编码规范）；
2. 【立即】若前端 bundle 偏大，配置构建忽略 moment 的非必要 locale 文件；
3. 【持续】旧模块按"改动时顺手迁移"原则渐进替换，不立项专项重构；
4. 【持续】排查第三方依赖对 moment 的引用，跟随其官方升级路径处理，不自行硬拆；
5. 【跟踪】每年复核一次 Temporal 在 Safari 的实装与 polyfill 成熟度，跨浏览器就绪后将原生方案纳入新项目默认选型。

---

## 八、参考来源

**官方第一手来源（结论的主要依据）：**

1. Moment.js 官方文档 · Project Status（项目状态，含维护模式声明、不再做的事、继续做的事、继续使用的理由）：
   https://momentjs.com/docs/#/-project-status/
2. Moment.js 官方推荐替代方案页：
   https://momentjs.com/docs/#/-project-status/recommendations/
3. GitHub 仓库 moment/moment（README 顶部维护模式声明、星标/发布信息）：
   https://github.com/moment/moment
4. GitHub 仓库 moment/moment Releases（2.30.1，2026-07-26 发布）：
   https://github.com/moment/moment/releases
5. GitHub 仓库 moment/moment-timezone（0.6.3，2026-07 更新）：
   https://github.com/moment/moment-timezone
6. Day.js 官网（"Fast 2kB alternative to Moment.js"、API 兼容性自述）：
   https://day.js.org/
7. TC39 proposal-temporal（Stage 4、各引擎实装进度、polyfill 状态）：
   https://github.com/tc39/proposal-temporal

**数据接口（2026-08-16 当日查询）：**

8. npm 下载统计 API（moment / dayjs / date-fns / luxon 近 30 天下载量）：
   https://api.npmjs.org/downloads/point/last-month/{package}
9. bundlephobia 体积 API（moment 2.30.1：60.6 kB min / 19.7 kB gzip；Luxon 3.7.2：69.8 kB / 21.9 kB）：
   https://bundlephobia.com/

**辅助/佐证来源：**

10. Reddit r/programming 对 2020 年 9 月维护模式公告的讨论帖：
    https://www.reddit.com/r/programming/comments/it4frw/momentjs_now_to_be_considered_a_legacy_project_in/
11. Socket.dev：TC39 Advances Temporal to Stage 4（2026-03）：
    https://socket.dev/blog/tc39-advances-temporal-to-stage-4
12. NodeSource：The History of Date in JavaScript（Temporal 2026-03 达 Stage 4，Node 26 实装）：
    http://nodesource.com/blog/javascript-temporal-history-nodejs-26/

> 说明：文中所有下载量、体积、版本号均为 2026-08-16 当日通过上述接口/页面实测获得；引用的英文原句均出自官方页面原文，中文为便于阅读的翻译。
