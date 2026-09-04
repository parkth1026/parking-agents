# 行为对照表: 2026-09-03-trending-weekly-redesign

**确认版·锁定。** 执行 Agent 改的是产品，不是这份对照表。
用户确认：2026-09-03T19:20:00+08:00（rounds.jsonl round 13，汇总 round 1–12 全部裁决）

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | 打开周报（data.js 含 20 仓） | 单一 8 列表格平铺，状态是第 7 列里的一个词 | **单列 Top20 全量**（无分组、无折叠，round3 裁决）：TLDR 头（期标题=本周最猛前三+导语）→ stale 黄条（如有）→ 列表卡（listhead 计数 + 20 行）。分类退化为徽章：New this week / Back on trending |
| 2 | 行视觉规格 | 自制 8 列表 | **对 trendshift.io/weekly 1:1**（DOM 实测 2026-09-03）：行 flex pad 24/16、分隔线 #DADCE7、名 16px/500 rgba(23,23,23,.8)、描述 14px #5C5E70、数字 14px/500 + `+N Gained this week` 12px #5C5E70@70%、徽章 10px/600/uppercase/.25px #6670CC、pill 12px r6、H1 24px/600。前三名金银铜圆章，其余灰章 |
| 3 | 行内主数字 | 本周+★/总★/环比三列平权 | 唯一 hero：`+N ★`（数字区 14px）+ `Gained this week` 标签；总★/forks 为次级；**行尾 16:9 核心图 288×162**（round8/9 裁决，正文左图右） |
| 4 | SURGE 加速度层（新增） | 无 | vel=本周增量÷总★，**≥20%** 触发 ⚡Surge+`N%/wk` 徽章 + 行底 2px 靛紫速度条（宽=vel%）；≥2 快照的仓加 `×N vs Wxx` 徽章；TLDR 首行=本周最猛前三（round4 裁决，阈值来自 W36 数据断层 58.7→17.4） |
| 5 | 行尾核心图（新增） | 无 | README 首图（过滤徽章/logo，优先 hero\|screenshot\|banner\|preview\|demo\|ui 命名，相对路径解析 `raw.githubusercontent.com/<name>/HEAD/`）→ 回落 GitHub Social Preview `opengraph.githubassets.com` → 离线回落首字母色块（round7/8 裁决） |
| 6 | 点击仓库行 | 详情卡固定插在整表下方 | 被点行内联展开**纯分析详情卡**（无图无轨迹，round7 裁决）：定位（主字段 2-4 句，靛紫标签）/ 为什么爆（因果叙事，禁止复述行内数字）/ 可信度信号 / 生态位（#tag 药丸 = nicheTags 数组 + 同类差异一行）；kv 元数据与 README 摘录折叠沉底（round5/6/10 裁决） |
| 7 | update-history 重分类 | analysis.md 无感知 | entry_status 集合与 analysis 落笔不一致 → 周 JSON 记 staleAt/staleReason → viewer 顶部黄条「分析待重跑」 |
| 8 | enrich 阶段（每仓库） | 2 个 gh endpoint | 5 个 endpoint（+git/trees 顶层、contributors 前 20、commits 近 90 天概要、releases 最近 3）；输出行加信源标记；单信源失败不整仓失败 |
| 9 | LLM 写 analysis.md | 三 bullet 模板 | 四字段新口径：定位 2-4 句 / 为什么爆=因果挂证据 / 可信度 / 生态位=nicheTags（**受控词表**）+同类+差异；固定标签行供 build-report 结构化抽取 |
| 10 | 页面宽度 | 832px 限宽 | **--page-max:1152px 居中**（topbar/main/footer 同用一变量；round12 裁决；trendshift 实测无上限，此为自定值） |
| 11 | 视口 ≤640px | 无断点，横向溢出 | 单列降级：描述隐藏、fork 数字隐藏、行尾图转全宽置底、kv 两列、标题缩小 |

### 边界值行

| # | 输入 / 前置 | 改后的行为 |
| --- | --- | --- |
| B1 | 常驻 = 0 的周（W36 实况） | 单列版面无空态段；listhead 计数行显示「常驻 0」即完整表达 |
| B2 | 新晋 > 10 | **全部平铺不折叠**（round3 推翻折叠方案） |
| B3 | 仓库无 backfill presence 记录 | 不渲染 presence 徽章，静默降级 |
| B4 | 历史快照 <2 点 | 不渲染 ×N 加速度徽章（诚实不显示）；轨迹图已随 round7 移除 |
| B5 | api_ok=false（富化失败仓） | 字段空、渲染不阻塞；注释标注「信源不完整」 |
| B6 | 旧周 analysis.md（三 bullet 口径） | 整篇仍展示；详情卡注释位显示新口径占位提示 |
| B7 | 离线打开（file:// 无网络） | 行尾图回落首字母色块；页面其余功能完整（AC-6 不受损） |
| B8 | vel 恰好 20% | 触发 SURGE（≥ 为闭边界） |
| B9 | SURGE 徽章过多（如某周 10+ 仓 ≥20%） | 徽章照常渲染（数据驱动阈值不调）；速度条照常 |

## 不变清单

| 不变项 | 谁在依赖 |
| --- | --- |
| 零依赖单文件，双击 file:// 离线可开（AC-6；图片/回落见 B7） | 用户核心使用方式 |
| `<script src="data.js">` 注入与 window.TRENDING_DATA 约定 | run-tests T6/T8 字符串断言（run-tests.mjs:167,201） |
| trending-week/1、repo-history/1 契约**只增可选字段不删不改** | 全部历史周 JSON、validate-week、backfill |
| serve.mjs 路由与 /api/* 报文字节不变 | 调试/自动化访问（D2） |
| 榜单固定 20 条、解析异常宁可失败 | design.md AC 哲学、fixtures |
| 数据管线零 LLM；analysis.md 缺失时报告照常产出（AC-7） | design.md:17 用户明确要求 |
| 配置链 CLI > $SKILL_ENV > ~/.config > 占位 | T9 与既有部署 |
| `node run-tests.mjs` 退出码语义 | 晋级门禁、npm run evals |
| enrich 150ms delay、单仓失败不整批失败 | gh 限流约定 |

## 配置差异

**无。** 不新增用户配置项；宽度上限为模板内 CSS 变量非配置；backfill 消费路径为 workspace 既有目录，缺失静默降级（B3）。
