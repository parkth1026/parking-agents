# 接口报文对: data.js 载荷（v1 草稿）

**v1 草稿——待用户质疑。** serve.mjs `/api/*` 报文不变（D2 锁定），本文件只定义 data.js 载荷（viewer 的唯一「接口」）。

## 成功形态：改后新增字段（以 W36 rank1 为例，真实数据）

```jsonc
// 现在（report-data.mjs 白名单）
{ "rank":1, "full_name":"tt-a1i/archify", "url":"…", "description":"…",
  "language":"JavaScript", "stars_total":41617, "stars_week":22095, "forks":486,
  "topics":[…], "homepage":"", "entry_status":"returning", "stars_prev":1019,
  "stars_delta":21076, "readme":"…(900 字符截断)" }

// 改后（同一条，新增键全部可选）
{ "rank":1, "full_name":"tt-a1i/archify", "url":"…", "description":"…",
  "language":"JavaScript", "stars_total":41617, "stars_week":22095, "forks":486,
  "topics":[…], "homepage":"", "entry_status":"returning", "stars_prev":1019,
  "stars_delta":21076,
  "readme":"…(上限 2400)",
  // —— 以下为新增 ——
  "created":"2025-11-07", "pushed":"2026-09-01", "license":"MIT", "issues":12,
  "presence":{ "days":14, "best":1, "weeks":["2026-W33","2026-W34","2026-W35"] },   // 可缺省：backfill 无该仓
  "hist":[["2026-W28",13,3634,1019],["2026-W36",1,41617,22095]],                    // [week,rank,总★,周增]；可空数组
  "note":{ "positioning":"…", "whyNow":"…", "trust":"…", "niche":"…" } }             // 可缺省：analysis 未按新口径写
```

```jsonc
// weeks[] 顶层新增（可选）
{ "week":"2026-W36", "capturedAt":"2026-09-01T20:05:11.014Z", "analyzed":true,
  "analysis":"…(整篇 md 仍内联，不变)",
  "staleAt":"2026-09-02T…", "staleReason":"entry_status 集合与 analysis 落笔时不一致（回填重分类）" }
```

## 缺省/降级形态

| 情况 | 形态 | viewer 行为 |
| --- | --- | --- |
| 旧周（无新字段） | 键缺省，不写 null | 注释位显示占位、无在场徽章、无 sparkline——页面不报错 |
| backfill 无该仓 | `presence` 缺省 | 不渲染徽章（B3） |
| 首次上榜 | `hist: []` | 「积累中」文案（B4） |
| api_ok=false 仓 | enrich 扩展字段空串 | 注释标注「信源不完整」（B5） |

## 已锁定的约定（出处）

1. **新字段全部可选**——保证旧 data.js 与新 viewer、新 viewer 与旧周数据双向兼容（1-interview D5 + 兼容面裁决）。
2. **analysis 仍整篇 md 内联**（不变清单）；`note` 是 build-report 从 analysis.md 固定标签行抽取的结构化层，格式约定写进 analysis-guide.md（四字段标签行，Agent-owned 细节）。
3. **`/api/*` 报文不变**（rounds.jsonl round1 D2）。
4. readme 上限 900→2400：原始 2500 的一致性截断（Agent-owned，随 D5）。
