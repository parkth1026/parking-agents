# 数据契约

三个 JSON 契约 + 一个 viewer 载荷契约。校验逻辑的唯一实现是 `scripts/lib/validate.mjs`，本文是给人读的镜像；两者不一致时以代码为准并更新本文。

## 周快照 `data/weeks/<YYYY-Www>.json`

```jsonc
{
  "schema": "trending-week/1",        // 固定
  "week": "2026-W36",                 // ISO 周编号，与文件名一致
  "captured_at": "2026-09-02T03:00:00.000Z",
  "source": "live",                   // live | offline | wayback（Wayback 快照回填导入，captured_at 为真实存档时刻）
  "since": "weekly",
  "repos": [ /* 恰好 20 条 */ ]
}
```

repo 条目（`*` = enrich 阶段新增，`†` = update-history 阶段新增）：

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| rank | int | 1..20 连续不重复 |
| full_name | string | `owner/repo`，字符集 `[A-Za-z0-9_.-]` |
| url | string | `https://github.com/<full_name>` |
| description | string | 页面为空时可为 ""（API 有值则覆盖） |
| language | string \| null | 页面无语言信息为 null |
| stars_total | int | > 0，页面解析值 |
| stars_week | int | > 0，页面 "N stars this week" |
| forks | int \| null | |
| api_ok* | bool | gh api 是否成功 |
| api_error* | string | 失败原因（api_ok=false 时） |
| topics* | string[] | |
| homepage* | string | |
| created_at* / pushed_at* | string | API ISO 时间 |
| open_issues* / stars_api* | int \| null | stars_api 用于与页面值交叉核对 |
| license* | string \| null | spdx_id |
| readme_excerpt* | string | README 前 2500 字符，失败为 "" |
| entry_status† | "new" \| "recurring" \| "returning" | new=首次上榜；recurring=上一日历周也在榜；returning=上过榜但上一日历周不在 |
| stars_prev† / stars_delta† | int | 依据历史最近一次快照算的环比；new 仓库无此二字段 |

## 仓库历史 `data/repos/<owner>__<repo>.json`

```jsonc
{
  "schema": "repo-history/1",
  "full_name": "owner/repo",
  "first_seen_week": "2026-W36",
  "last_seen_week": "2026-W37",
  "snapshots": [ /* 每周至多一条，按 week 升序 */ ]
}
```

snapshot：`{ week, date, rank, stars_total, stars_week }`，类型约束同上。

## 咬合检查（validate-week --full）

- 周榜单里每个仓库必须有历史文件，且含该周快照
- 历史快照的 stars_total 必须与周文件一致（防止中途重抓造成漂移）
- 周文件每条必须有 entry_status

## viewer 载荷 `report/data.js`

`window.TRENDING_DATA = { schema: "trending-report/1", generated_at, weeks: [...] }`。weeks 按周升序；每项含 `week / captured_at / analysis（string|null）/ counts{new,recurring,returning} / repos[]`；readme_excerpt 及新增别名 readme 截断到最多 2400 字符。viewer 零外部依赖，`<script src="data.js">` 载入，保留 file:// 双击访问。

新增均为可选字段：repo 的 `created/pushed/license/issues`、`coreImg`（解析后的 HTTP(S) URL）、`accel{ratio,baseWeek}`（与此前最近上榜周的 stars_week 之比，四舍五入一位小数；必须有当前及此前两点）、`presence{days,best,week}`（取不晚于当前周的最近在场记录，week 显示证据周）、`note{positioning,whyNow,trust,nicheTags:string[],niche}`。旧键保留；无证据的扩展字段不写 null。

周层增加 `capturedAt/analyzed` 别名和条件性 `staleAt/staleReason`。重写分析的分类头与当前周吻合、且内容 hash 已变化时，viewer 不再显示旧 stale。结构化 note 的固定标签和受控词表见 analysis-guide.md；整篇原稿始终保留。

周 JSON 的 enrichment 增可选 `tree[]`、`contributors[]`、`commits_90d{since,until,sampled,capped,items[]}`、`releases[]`、`source_status{readme,tree,contrib,commit,release}` 与 `evidence_at`。单信源失败删该信源产物并标 false；空数组是成功但无记录。目录不递归；提交只采近90天最多100条，并明确样本是否到上限。stale 增可选 `staleAnalysisHash`，用于识别是否完成重写，供数据层消费。

## HTTP API（serve.mjs，载荷与 viewer 同源构建）

viewer 载荷由 `scripts/lib/report-data.mjs` 唯一实现：build-report 落盘静态 `data.js`，serve.mjs 按请求实时生成 `/data.js`，两者字段完全一致。API 全部只读、JSON 响应、`Cache-Control: no-store`：

| 路由 | 返回 |
| --- | --- |
| `GET /` | viewer 页面（assets/viewer.html） |
| `GET /data.js` | viewer 载荷（实时） |
| `GET /api/weeks` | `{ count, weeks: [{week, captured_at, repos, counts, top1, top1_stars_week, has_analysis}] }` |
| `GET /api/weeks/:id` | 周快照原样 JSON |
| `GET /api/weeks/:id/analysis` | 分析 markdown（text/markdown，无则 404） |
| `GET /api/repos` | `{ count, repos: [{full_name, first_seen_week, last_seen_week, weeks_on_chart}] }` |
| `GET /api/repos/:owner__repo` | 仓库历史原样 JSON |
| `GET /api/latest` | 最近一周快照 |

周编号与仓库名参数都过白名单正则，不匹配一律 404（防路径注入）；未知路由 404 且返回路由表。
