# 执行过程简记：moment.js 维护状态调研

日期：2026-08-16
任务：调查 moment.js 当前维护状态、官方态度、存量/新代码选型建议，产出有出处的中文报告。

## 步骤记录

### 1. 制定计划
建立 4 项待办：官方状态声明调研 -> 替代库与社区数据 -> 撰写报告 -> 记录过程。

### 2. 官方第一手声明
- WebFetch https://momentjs.com/docs/#/-project-status/
  提取到核心原文："legacy project in maintenance mode. It is not dead, but it is indeed done"、不鼓励新项目使用、不再做的事（新功能/不可变 API/tree shaking/v3）、仍会做的事（安全修复/IANA 时区数据）、推荐替代（Luxon/Day.js/date-fns/js-Joda/原生 Intl/Temporal）、继续使用 moment 的理由。
- WebSearch "moment.js deprecated official statement maintenance status"
  佐证：2020-09 进入维护模式；Reddit 讨论帖等。

### 3. GitHub 仓库活跃度核实
- 先用 curl 调 GitHub API：被匿名限流（rate limit exceeded），无数据。
- 改用 gh CLI（已认证）成功：
  - moment/moment：archived=false，47,916 stars，206 open issues，最近推送 2026-08-15；
  - 最近 releases：2.30.1（2026-07-26 发布）、2.30.0、2.29.4；
  - moment/moment-timezone：未归档，最近推送 2026-07-19，最新 tag 0.6.3。

### 4. npm 社区数据
- curl https://api.npmjs.org/downloads/point/last-month/{pkg}：
  - moment ≈ 1.43 亿/月；dayjs ≈ 2.60 亿；date-fns ≈ 3.90 亿；luxon ≈ 1.46 亿（2026-08 实测）。
- npm registry：moment 的 "modified" 为 2026-08-12（仍在维护性发版）。
- 尝试解析完整 registry JSON 取版本列表：因 Windows 下 /tmp 路径映射问题失败，改用 gh releases 数据，信息已足够。

### 5. Temporal 提案现状
- WebSearch "Temporal proposal TC39 stage 3 status 2026"：多条结果指向 2026-03 已达 Stage 4（ES2026）。
- WebFetch https://github.com/tc39/proposal-temporal 核实原文："currently Stage 4"；实装：Firefox 139（2025-05-27）、Chrome 144（2026-01-13）、Node 26（2026-05-05）；Safari/JSC 开发中；@js-temporal/polyfill 为 Alpha 且官方不建议生产使用。

### 6. Chrome DevTools 提示与 GitHub README
- WebSearch "Chrome DevTools issue warning moment.js replacement"：确认官方文档提到 DevTools 因包体积建议替换（并非特定版本行为）。
- WebFetch https://github.com/moment/moment：README 顶部原文 "Moment.js is a legacy project, now in maintenance mode. In most cases, you should choose a different library."；47.9k stars。

### 7. 打包体积数据
- curl bundlephobia API：moment 2.30.1 = 60.6 kB min / 19.7 kB gzip；luxon 3.7.2 = 69.8 kB / 21.9 kB；day.js 接口返回空。
- 补充 WebFetch https://day.js.org/：官网自称 "Fast 2kB alternative to Moment.js"、API 与 moment 高度兼容。

### 8. 撰写产物
- 写入 outputs/report.md：结论速览、官方声明原文引用、2026-08 维护现状实测、npm 下载数/体积对比、存量代码策略（不专项重构、冻结增量、机会式迁移）、新代码选型（Day.js 优先，Luxon 时区强需求，Temporal 前瞻）、行动清单、12 项参考来源。

## 读取的文件
- 无本地文件读取（任务为纯网络调研）。

## 引用的来源（汇总）
官方：momentjs.com/docs（Project Status、Recommendations）、github.com/moment/moment（README、Releases）、github.com/moment/moment-timezone、day.js.org、github.com/tc39/proposal-temporal。
数据接口：api.npmjs.org（近 30 天下载量）、registry.npmjs.org、bundlephobia.com/api、api.github.com（经 gh CLI）。
佐证：Reddit r/programming 公告讨论帖、socket.dev（Temporal Stage 4 报道）、nodesource.com（Temporal 历史与 Node 26 实装）。

## 产物
- G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\best-practice-research-workspace\iteration-2\eval-moment维护状态调查\without_skill\run-1\outputs\report.md
