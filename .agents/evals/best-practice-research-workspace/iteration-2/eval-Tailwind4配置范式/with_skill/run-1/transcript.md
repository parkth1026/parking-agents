# 执行过程简记 — best-practice-research / Tailwind v4 配置范式调研

日期:2026-08-16

## 步骤

1. **读取技能文件** — 完整读取 `G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\best-practice-research\SKILL.md`,确认流程:分类问题 → (如需)explore 取本地事实 → researcher 收集官方/上游证据 → 按输出契约综合 → 停止;证据须带 URL 与版本/日期语境,取最小证据集,不做实施。
2. **问题分类** — 判定为「版本感知的实现/迁移指引」类:用户按旧教程(v2/v3 范式:`tailwind.config.js` + `purge`)操作,与现行官方文档不一致,需确认官方现行配置范式与版本分界。
3. **repo 本地事实判定** — 任务输入为 none,用户为新开项目,本地仓库与本问题无关 → 跳过 explore,报告中记为 "not needed"。
4. **外部证据收集(第一批,官方 v4 侧,4 个并行抓取)**
   - https://tailwindcss.com/blog/tailwindcss-v4 — v4.0 发布公告(2025-01-22):无需 `tailwind.config.js`、`content` 配置移除改自动内容检测、`@theme` CSS 优先配置、`@import "tailwindcss"`、`@tailwindcss/vite`/`@tailwindcss/postcss`、升级工具。
   - https://tailwindcss.com/docs/installation — 现行安装文档(页面标注 v4.3):Vite 插件为首选路线,流程无 `tailwind.config.js` 步骤,入口 CSS 仅一行 `@import "tailwindcss";`。
   - https://tailwindcss.com/docs/upgrade-guide — v3→v4 升级指南:`@tailwind` 指令移除、`@config` 显式加载旧 JS 配置、`corePlugins`/`safelist`/`separator` 不支持、`npx @tailwindcss/upgrade`、Node 20+、浏览器要求(Safari 16.4+/Chrome 111+/Firefox 128+),旧浏览器留在 v3.4。
   - https://tailwindcss.com/docs/theme — `@theme` 设计令牌定义、命名空间→工具类映射、清除/禁用默认主题。
5. **外部证据收集(第二批,版本核对 + v3/v2 对照,4 个并行抓取)**
   - https://github.com/tailwindlabs/tailwindcss/releases — 现行最新版本 v4.3.3(2026-07-16,年份按页面版权推断)。
   - https://v3.tailwindcss.com/docs/installation — v3 旧流程对照:`npx tailwindcss init`、`content` 数组、三条 `@tailwind` 指令。
   - https://v3.tailwindcss.com/docs/content-configuration — v3 `content` 配置细节;该页未提 purge 历史(故再补下一条)。
   - https://tailwindcss.com/docs/detecting-classes-in-source-files — v4 自动内容检测规则、`@source` / `@source not` / `@source inline()` / `source(none)`、monorepo 基准路径注意。
6. **外部证据收集(第三批,1 个抓取,补历史出处)** — https://v3.tailwindcss.com/docs/upgrade-guide — 原文确认 v2→v3 时 `purge` 改名为 `content`("Since Tailwind no longer uses PurgeCSS under the hood, we've renamed the purge option to content"),坐实用户教程属 v2 时代写法。此后按技能"最小证据集/勿过度抓取"规则停止收集。
7. **撰写报告** — 按技能输出契约(Direct Recommendation / Evidence Used / Version-Date Context / Repo-Local Context / Boundaries / Handoff)写成中文 `report.md`,保存至 `...\run-1\outputs\report.md`;结论:新项目按 v4.3 现行范式(无 `tailwind.config.js`、`@import "tailwindcss"`、自动内容检测、`@theme` 定制),purge 属 v2、v3 已改名 content、v4 彻底移除;并给出 Vite/PostCSS/CLI 三条安装路线、v2/v3/v4 三代对照表与 Handoff。
8. **写入本简记** — 即本文件 `transcript.md`。

## 引用的来源汇总

官方(一级):
- https://tailwindcss.com/blog/tailwindcss-v4(v4.0 发布公告,2025-01-22)
- https://tailwindcss.com/docs/installation(现行安装文档,标注 v4.3)
- https://tailwindcss.com/docs/upgrade-guide(v3→v4 升级指南)
- https://tailwindcss.com/docs/theme(@theme 主题配置)
- https://tailwindcss.com/docs/detecting-classes-in-source-files(自动内容检测与 @source)
- https://v3.tailwindcss.com/docs/installation(v3 安装流程,对照用)
- https://v3.tailwindcss.com/docs/content-configuration(v3 content 配置,对照用)
- https://v3.tailwindcss.com/docs/upgrade-guide(v2→v3,purge→content 更名出处)
- https://github.com/tailwindlabs/tailwindcss/releases(最新版本号核对)

补充(三级):无。未使用任何第三方教程/博客作为论断依据。

## 读取的本地文件

- `G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\best-practice-research\SKILL.md`(技能文件)

## 产物

- `...\run-1\outputs\report.md`(最终中文调研报告)
- `...\run-1\transcript.md`(本文件)
