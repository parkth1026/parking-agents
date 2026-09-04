# 接口报文对: data.js 载荷（确认版）

**确认版·锁定（2026-09-03T19:20:00+08:00）。** serve.mjs `/api/*` 报文不变（round1 D2），本文件只定义 data.js 载荷。

## 改后字段全貌（以 W36 rank1 为例）

```jsonc
// 基础 12 字段不变：rank, full_name, url, description, language, stars_total,
//   stars_week, forks, topics, homepage, entry_status, stars_prev, stars_delta
{ "rank":1, "full_name":"tt-a1i/archify", "url":"…", "description":"…",
  "language":"JavaScript", "stars_total":41617, "stars_week":22095, "forks":486,
  "topics":["…"], "homepage":"", "entry_status":"returning", "stars_prev":1019, "stars_delta":21076,
  "readme":"…（上限 900→2400）",

  // —— 新增（全部可选，缺省即降级）——
  "created":"2026-04-15", "pushed":"2026-09-01", "license":"MIT", "issues":90,
  "presence":{ "days":4, "best":1 },                        // backfill 有该仓才有
  "accel":{ "ratio":21.7, "baseWeek":"2026-W28" },          // build-report 由 repo-history 算好；<2 快照缺省
  "coreImg":"https://raw.githubusercontent.com/tt-a1i/archify/HEAD/docs/assets/archify-readme-hero.png",
                                                            // build-report 解析；无 README 图缺省 → viewer 用 Social Preview URL
  "note":{ "positioning":"…2-4 句主字段…", "whyNow":"…因果叙事（禁复述行内数字）…",
           "trust":"…", "nicheTags":["agent-skills","diagram-generation"], "niche":"同类：…。差异点：…" } }
```

```jsonc
// weeks[] 顶层新增（可选）
{ "week":"2026-W36", "capturedAt":"…", "analyzed":true, "analysis":"…整篇 md 内联不变…",
  "staleAt":"2026-09-02T…", "staleReason":"entry_status 集合与 analysis 落笔时不一致（回填重分类）" }
```

## 与草稿版的差异（定稿裁决）

1. **`hist` 数组移出载荷**：sparkline 已裁移除（round7）；×N 加速度改由 build-report 从 repo-history 计算成 `accel`，viewer 只消费结果（round10）。
2. **`note.nicheTags` 为数组**（round5 裁决）：词表受控，由 analysis-guide.md 定义；build-report 从 analysis 固定标签行抽取。
3. **`coreImg` 由 build-report 解析成绝对 URL**（round8），viewer 不再做路径拼接。
4. readme 上限 900→2400（D5）。

## 缺省/降级形态

| 情况 | 形态 | viewer 行为 |
| --- | --- | --- |
| 旧周（无新字段） | 键缺省，不写 null | 注释位占位、无徽章、无行尾图回落 Social Preview——不报错 |
| backfill 无该仓 | `presence` 缺省 | 不渲染在场徽章（B3） |
| <2 快照 | `accel` 缺省 | 不渲染 ×N 徽章（B4） |
| README 无可用图 | `coreImg` 缺省 | 行尾图直接用 Social Preview（B7 离线再回落色块） |
| api_ok=false | 扩展字段空串 | 注释标「信源不完整」（B5） |

## 已锁定的约定（出处）

1. 新字段全部可选——旧 data.js 配新 viewer、新 viewer 配旧周双向兼容（D5+兼容面）。
2. analysis 仍整篇 md 内联；`note` 是 build-report 从 analysis.md 固定标签行抽取的结构化层，词表与标签格式写进 analysis-guide.md。
3. `/api/*` 报文不变（round1 D2）。
