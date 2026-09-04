# 影响面扫描: 2026-09-03-trending-weekly-redesign

判据：改完之后，程序在哪些地方跑起来不一样了？每一处谁会看见？

| 影响面 | 判定 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | **有（大）** | viewer 全面重构：单表 8 列 → TLDR 头 + 三段版面（新晋高亮 top10+折叠 / 回锅平铺 / 常驻默认折叠）；行样式改 trendshift 式（hero metric `+N★ this week`、行内比例条、前三金色、语言色点、tabular-nums）；详情卡改点击行内联展开，新增四字段注释（定位/为什么爆/可信度/生态位竞品）、sparkline、backfill 在场徽章、扩展元数据；stale 黄条；≤640px 移动端降级 | 每周打开周报的用户本人（唯一读者） | drafts/v1-mock.html（已用真实 W36 数据渲染并验证交互） |
| 可观察行为 | **有** | ①常驻段默认折叠、回锅平铺次级高亮、新晋 >10 折叠——同一份 data.js 渲染结构变了；②enrich 从每仓 2 个 gh endpoint 扩到 5 个（+git/trees、contributors、commits 概要、releases）；③update-history 重分类后给 analysis 标 stale（新行为：以前无感知）；④analysis 口径从三 bullet 改四字段 | 用户；gh api 配额（调用量 ×2.5）；fixtures 回放测试 | drafts/v1-behavior.md |
| 可运行输出 | **有（轻）** | enrich 终端逐仓输出行内容变多（+readme 之外的新信源标记）；build-report 输出行不变；run-tests 新增断言但退出码语义不变；每周管线耗时上升（抓取 ×2.5） | 跑管线的用户/定时任务 | drafts/v1-example-run.md |
| 对外接口报文 | **有** | data.js 载荷（viewer 的「接口」）字段扩展：repos[] 增 created/pushed/license/issues/presence/hist/note（全部可选），weeks[] 增 staleAt/staleReason（可选），readme 上限 900→2400；serve.mjs `/api/*` 原始 JSON 报文**不变**（D2 锁定） | viewer 本身；无外部消费者（serve API 仅供调试） | drafts/v1-api-mock.md |
| 用户配置 | **无** | 不新增任何配置项：enrich 新 endpoint 写死；backfill 消费路径=workspace 下 `backfill/*.presence.json`（已存在），不存在时静默降级（无在场徽章，不报错）；配置链 CLI > SKILL_ENV > ~/.config > 占位 保持原样 | — | 记录于 behavior.md 配置差异节（省略表，整节声明无差异） |
| 历史兼容性 | **有** | ①旧 weeks JSON（无新 enrich 字段）必须仍可渲染——新字段全部可选、viewer 缺省降级；②旧 analysis.md（三 bullet 口径、无四字段节）在新 viewer 显示「注释待新口径生成」占位，不报错；③trending-week/1 schema **只增可选字段**（trees/contributors 等落盘字段），validate-week 同步放宽；④已生成的旧 report/index.html 被下次 build 覆盖，无兼容负担；⑤repo-history/1 契约不变 | 历史周数据（W27/W28/W30 回填 + W36）；run-tests fixture 回放 | drafts/v1-behavior.md 不变清单 |
| 架构与依赖 | **有** | ①backfill presence 从「workspace 派生层、无消费者」升为 report-data 的输入（跨出技能官方契约，design.md 需记边界）；②analysis-guide.md 从「三 bullet 口径」扩为「四字段 + 生态位结构化标签」——LLM 层产出被 build-report 结构化抽取（新增 md→结构化 的解析约定）；③模块依赖方向不变（scripts → lib → assets 单向） | 技能维护者；design.md 读者 | drafts/v1-diagram.html |

## 七面结论

六面「有」一面「无」（用户配置）。界面是主对照物，行为/兼容/接口/架构各有对应物，全部为 v1 草稿待用户逐处质疑后升级为确认版。
