# design: github-trending-weekly

## 意图与触发场景

每周把 GitHub Trending（weekly 榜）变成可积累的资产：确定性脚本采集 top 20 仓库、`gh` CLI 富化元数据与 README 摘要、JSON 结构校验、累计每仓库星数历史、生成可双击打开的 HTML 周报（含全部历史周），LLM 只在数据落盘校验通过后写分析文字与知识页。

触发场景：

- 用户说「跑一下本周 GitHub 周报 / 更新 trending 数据 / 出周报」
- 定时任务（cron）每周调用：提示词写明「执行 $github-trending-weekly 技能，workspace 为 D:\GIT_dev\cron」
- 用户想查看历史周报或某个仓库的上榜历史（直接打开 `report/index.html`，不需要本技能）

## 设计取舍

| 取舍 | 决定 | 理由 |
| --- | --- | --- |
| 数据路径是否依赖 LLM | **完全不依赖**。抓取/解析/富化/校验/报告全部是确定性脚本，LLM 只写 analysis.md 与 wiki 页 | 用户明确要求：稳定性靠脚本校验 JSON，不靠模型自觉。缺分析时报告照常生成 |
| trending 榜单获取方式 | 直接抓 HTML（每周 1 次）+ 正则解析 | 无官方 API；请求量极小不触发限流；解析锚点（`Box-row` 区块、`/stargazers` 链接、`stars this week` 文案）在 fixtures 里固化，页面改版会被校验器立刻抓住 |
| 仓库详情获取方式 | `gh api`（复用本机已登录凭证，5,000 次/小时配额） | 免凭证管理；每周约 40 次调用占配额 0.8% |
| 存储 | 文件即数据库：`data/weeks/*.json`（周快照）+ `data/repos/*.json`（累计历史），git 做版本 | 周量级 20 条，SQLite 是 over-engineering |
| JSON 校验 | 手写结构校验器（类型/格式/枚举/秩），退出码即门禁 | 引入 JSON Schema 库违反零依赖约束；校验规则就是本技能的契约 |
| HTML 报告加载本地数据 | 生成 `data.js`（`window.TRENDING_DATA = {...}`）由 `<script>` 引入 | `file://` 下 `fetch()` 本地 JSON 被 CORS 拦截；双击即开是硬需求 |
| 榜单条数 | 固定 20（weekly 页恰好 20 个 `Box-row`） | 少于 20 视为页面异常或改版，宁可失败不可缺数据 |

自由度分级：scripts/ 五个脚本与 lib 校验器全部低自由度（参数固定、退出码锁死）；references/analysis-guide.md 高自由度（分析口径是文字指令，留给模型判断）；SKILL.md 工作流编排为中自由度。

## 验收条件

| 编号 | 条件 | 类型 |
| --- | --- | --- |
| AC-1 | 离线解析真实 HTML fixture 得到 20 条记录：rank 1..20 连续、首名 tt-a1i/archify、周增 22095、`&amp;` 等 HTML entity 正确解码、无 language 的仓库该字段为 null | script |
| AC-2 | 页面结构异常（条数≠20、star 数字非法、repo 全名不合法）导致 fetch-trending 非零退出，stderr 指明原因 | script |
| AC-3 | enrich 对每个仓库合并 API 元数据与 README 摘要；`--stub` 离线回放模式下缺响应的仓库标记 `api_ok:false` 且整体不失败 | script |
| AC-4 | update-history 依据既有历史正确分类 new/recurring/returning，追加快照幂等（重跑不重复），recurring/returning 带周环比 | script |
| AC-5 | validate-week 对合法数据 PASS；字段缺失/类型错误/全名非法/`--full` 模式缺 entry_status 各自 FAIL 并指认问题字段 | script |
| AC-6 | build-report 生成 `report/data.js` + `report/index.html`，包含全部历史周、内联已写分析文本，双击可离线打开 | script |
| AC-7 | 全管线脚本无 LLM 参与：analysis.md 不存在时 build-report 照常产出完整报告 | script |
| AC-8 | run-tests 全部离线运行，退出码 0 | script |
| AC-9 | serve.mjs 本地只读后端：viewer 与静态版同源渲染，JSON API（weeks/repos/latest/analysis）全路由正确，404/路径注入拒绝，绑定 127.0.0.1 | script |

## 迭代记录

<!-- 行格式: | 日期 | 改了什么一句 | 本轮 vs 上轮 won/lost/tie | 拆分建议结论(如有) |；只追加不回改 -->
| 日期 | 改了什么 | 轮次结果 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-09-02 | 初版：5 脚本 + 校验器 + viewer + 离线回归 | — | 无 |
| 2026-09-02 | 加 serve.mjs 本地后端：载荷构建抽到 lib/report-data（build-report 与 serve 同源），viewer 不改（HTTP 下 /data.js 动态生成，file:// 下仍用静态 data.js）；回归 46/46，退出码 0 | — | 无 |
