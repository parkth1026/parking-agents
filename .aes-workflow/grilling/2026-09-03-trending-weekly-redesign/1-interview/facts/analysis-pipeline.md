# Fact: 分析管线与 per-repo 数据可用性

- 派遣问题：① SKILL.md analysis 阶段执行流程（谁在哪个阶段生成 analysis.md/wiki 页、prompt 在哪、输入引用方式、输出结构）② enrich-repos.mjs 抓了哪些 gh api 字段、readme_excerpt 截取规则、有无代码树/contributor/外部讨论输入 ③ data-schema.md per-repo 字段全列表（含 backfill presence）④ 2026-W36.analysis.md 产物样例结构与粒度 ⑤ design.md「数据管线不依赖 LLM」原文边界及 LLM 允许位置
- 完成：2026-09-03T00:00:00+08:00（subagent 调查，宿主落盘）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| **Q1** 工作流共 7 步，Step 5「写本周分析（LLM 环节）」由 LLM 读周快照写 analysis.md，Step 4 数据门禁「不过不进 Step 5」是前置闸门 | `SKILL.md:54-64` |
| Step 5 输入指引原文：读 `data/weeks/<YYYY-Www>.json`，「重点看 `entry_status == "new"` 的仓库和 `stars_week` 排序」；不写也能出报告 | `SKILL.md:64` |
| Step 7（可选）知识页 wiki `<YYYY-Www>.md` 同样由 LLM 写，模板在 analysis-guide.md 末尾；wiki 只放结论一句话版，深度以 analysis.md 为准 | `SKILL.md:74-76`、`references/analysis-guide.md:39-57` |
| 分析 prompt/口径唯一载体是 `references/analysis-guide.md`（非代码）；写作纪律规定「事实只来自周快照 JSON 与 README 摘要，不确定的不写、不编造」 | `references/analysis-guide.md:3,32-37` |
| 输出结构有明确模板：`## 本周看点` → `## 新晋仓库`（每 new 一节 `### owner/repo —— 一句话定位` + 是什么/为什么现在火/值得关注吗 三 bullet）→ `## 常驻与回锅`（一段话）→ `## 数字速览`；新晋 >8 个时详写 stars_week 前 8、其余一句话清单 | `references/analysis-guide.md:7-30` |
| analysis.md 本身无任何结构校验（validate.mjs / validate-week.mjs 全文 0 处提及 analysis）；build-report 仅在文件存在时整篇内联进 data.js | `scripts/lib/report-data.mjs:41` |
| **Q2** enrich 对每仓库只调 2 个 gh api endpoint：`repos/<full_name>`（元数据）与 `repos/<full_name>/readme`（raw） | `scripts/enrich-repos.mjs:44-45,56,78` |
| 元数据合并字段清单：description、language、topics、homepage、created_at、pushed_at、forks、open_issues、license(spdx_id)、stars_api、api_ok/api_error | `scripts/enrich-repos.mjs:61-71,74-75,81-82` |
| readme_excerpt 截取规则：原始 README `slice(0, maxReadme)`，缺省 2500；失败为 ""；viewer 载荷层再截到 900 | `scripts/enrich-repos.mjs:5,18-19,79,85`、`scripts/lib/report-data.mjs:9,35`、`references/data-schema.md:63` |
| 未抓任何深度调研输入：scripts 全目录 grep 无 git/trees、contributors、release、issue 内容、HN/Reddit/外部讨论（唯一 "hn" 命中是 serve.mjs 的 pathname 误匹配） | `scripts/`（全目录 grep） |
| 单仓库富化失败标 `api_ok:false` 继续，gh 不可用整体 exit 2；仓库间默认 150ms delay | `scripts/enrich-repos.mjs:2-3,19,46-47,86` |
| **Q3** 周快照 per-repo 契约字段（* = enrich 新增、† = update-history 新增）：rank、full_name、url、description、language、stars_total、stars_week、forks、api_ok*、api_error*、topics*、homepage*、created_at*/pushed_at*、open_issues*/stars_api*、license*、readme_excerpt*、entry_status†、stars_prev†/stars_delta† | `references/data-schema.md:18-39` |
| `days_on_list/best_rank` **不在** data-schema.md（技能内 grep 0 命中）；其 schema 定义在 workspace 派生层：presence.json 每仓库 `{days_on_list, best_rank, first_day, last_day, ranks:{日期:名次}}` | `D:\GIT_dev\github-trading\backfill\README.md:18,23-26` |
| presence 层语义边界：是「该周登上过全球日榜」的事实，不是官方 weekly top-20，无 stars_week/stars_total；来源 antonkomarev/github-trending-archive 每日日榜聚合 | `backfill/README.md:9-10,23-26` |
| 实测 W36 JSON per-repo 实际键 20 个，与契约一致；rank1 readme_excerpt 实长 2500 | `D:\GIT_dev\github-trading\data\weeks\2026-W36.json` |
| **Q4** 2026-W36.analysis.md 为整周一篇（74 行），结构完全踩模板：本周看点(1-3) → 新晋仓库详写 8 节（三 bullet）→ 其余新晋一句话清单 13 条(:55-68) → 数字速览(:70-73) | `D:\GIT_dev\github-trading\data\weeks\2026-W36.analysis.md:1-73` |
| 该样例 per-repo 粒度仅覆盖 new 仓库（8 详写+13 一句话），无常驻/回锅节（首周 0/0）；且文本已过期：写于回填导入前称「新晋 20 · 常驻 0 · 回锅 0」，实测 JSON rank1 entry_status 已变 `returning`（W27/W28/W30 导入后重分类） | `2026-W36.analysis.md:73`、`data\weeks\2026-W36.json`（实测）、`references/design.md:51` |
| **Q5** design.md 不依赖 LLM 边界原文（设计取舍表首行）：「数据路径是否依赖 LLM｜完全不依赖。抓取/解析/富化/校验/报告全部是确定性脚本，LLM 只写 analysis.md 与 wiki 页｜用户明确要求：稳定性靠脚本校验 JSON，不靠模型自觉。缺分析时报告照常生成」 | `references/design.md:17` |
| LLM 允许位置：「LLM 只在数据落盘校验通过后写分析文字与知识页」(:5)；AC-7「全管线脚本无 LLM 参与：analysis.md 不存在时 build-report 照常产出完整报告」(:38) | `references/design.md:5,38`、`SKILL.md:3,8` |
| 自由度分级：scripts/ 五脚本与 lib 校验器低自由度；**references/analysis-guide.md 高自由度（分析口径是文字指令，留给模型判断）**；SKILL.md 工作流编排中自由度 | `references/design.md:26` |

## 未知项

- enrich 的 gh api 实际响应里是否还有未落盘的有用字段（如 subscribers、network_count、default_branch）：脚本只挑 10 个字段写回，全量原始响应未持久化，无法事后补。
- presence 层 W31–W35 与 W36 重叠 18/20 的可信度证据仅 README 一句，无独立核验输出。

## 没查的

- viewer.html 前端如何渲染 analysis 与 per-repo 卡片（只确认 data.js 内联与 900 截断）。
- build-report.mjs / update-history.mjs / fetch-trending.mjs 完整逻辑（仅核对与五问相关行）。
- backfill/aggregate-presence.mjs、build-presence-view.mjs 内部实现（只读契约与样例）。
- workspace wiki/ 目录是否已有产出（find 未列出，未单独验证）。
