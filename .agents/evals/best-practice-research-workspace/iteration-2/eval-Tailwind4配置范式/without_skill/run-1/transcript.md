# 执行过程记录（transcript）

任务：调研 Tailwind CSS 官方现行配置方式（教程中的 tailwind.config.js + purge 与现行文档不符的问题），产出带出处的中文报告。
执行时间：2026-08-16

## 步骤

1. **制定调研计划**：核心疑点定位为 purge/content 配置与配置文件的历史变迁（v2 → v3 → v4），需查证：现行官方安装流程、purge 的替代机制、版本时间线。

2. **抓取官方现行安装文档**
   - URL: https://tailwindcss.com/docs/installation
   - 结论：现行文档为 v4.3；官方推荐 Vite 插件方式（`tailwindcss` + `@tailwindcss/vite`），CSS 入口仅 `@import "tailwindcss";`，全流程不创建 `tailwind.config.js`，未提及 purge/content。

3. **抓取官方 v3→v4 升级指南**
   - URL: https://tailwindcss.com/docs/upgrade-guide
   - 结论：PostCSS 插件独立为 `@tailwindcss/postcss`（可移除 autoprefixer/postcss-import）；JS 配置文件不再自动检测、需 `@config` 显式加载；主题迁移至 CSS `@theme`；`@tailwind` 三行指令被 `@import "tailwindcss"` 取代；safelist 由 `@source inline()` 替代；`corePlugins`/`safelist`/`separator` 不再支持；浏览器要求 Safari 16.4+/Chrome 111+/Firefox 128+，否则留在 v3.4；官方迁移工具 `npx @tailwindcss/upgrade`（Node 20+）。

4. **抓取 v4 内容检测文档**
   - URL: https://tailwindcss.com/docs/detecting-classes-in-source-files
   - 结论：v4 自动扫描源文件（纯文本提取 token），默认忽略 .gitignore 路径、node_modules、二进制文件、CSS、lock 文件；微调用 `@source "..."` / `@source not "..."` / `source("../src")` / `source(none)`；`@source inline("...")` 支持变体和花括号展开。

5. **抓取 v3 存档文档（对照旧教程）**
   - URL: https://v3.tailwindcss.com/docs/content-configuration
   - 结论：v3 用 `content: [...]` 数组（相对项目根目录），支持 safelist/blocklist/transform/extract；页面完全未提 purge，佐证 purge 在 v3 已被 content 取代。

6. **抓取 v2 存档文档（定位旧教程出处）**
   - URL: https://v2.tailwindcss.com/docs/optimizing-for-production
   - 结论：v2 官方推荐 purge 选项 tree-shake 未用样式，配置为 `purge: [...]` 或 `purge: { enabled: true, content: [...] }`，基于 PurgeCSS，NODE_ENV=production 时生效——用户所跟教程即此范式。

7. **抓取 v4.0 发布公告**
   - URL: https://tailwindcss.com/blog/tailwindcss-v4
   - 结论：v4.0 于 2025-01-22 发布；官方原话确认"从 JS 配置转向 CSS 配置"、content 数组被启发式自动检测取代；性能数据（完整构建 3.78x、无新 CSS 增量构建 100x+ 提速）。

8. **查询 npm registry 确认当前版本**
   - URL: https://registry.npmjs.org/tailwindcss/latest
   - 结论：当前最新版本 4.3.3。

9. **撰写并保存报告**
   - 产出：`outputs/report.md`（中文，含三时代对照表、v4 官方安装步骤、purge 对应方案、@theme 主题配置、决策建议、踩坑清单、来源列表、新旧写法速查表）。

## 引用来源汇总

| 来源 | URL |
|---|---|
| Tailwind 官方安装文档（v4.3） | https://tailwindcss.com/docs/installation |
| 官方升级指南 v3→v4 | https://tailwindcss.com/docs/upgrade-guide |
| 官方内容检测文档 | https://tailwindcss.com/docs/detecting-classes-in-source-files |
| v4.0 发布公告 | https://tailwindcss.com/blog/tailwindcss-v4 |
| v3 存档·Content Configuration | https://v3.tailwindcss.com/docs/content-configuration |
| v2 存档·Optimizing for Production | https://v2.tailwindcss.com/docs/optimizing-for-production |
| npm registry（版本确认） | https://registry.npmjs.org/tailwindcss/latest |

## 产物

- `outputs/report.md` — 最终中文调研报告
- `transcript.md` — 本过程记录
