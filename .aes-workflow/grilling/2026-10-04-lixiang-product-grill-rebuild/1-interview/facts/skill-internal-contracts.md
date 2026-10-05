# Fact: lixiang-ceo-grill 技能内部契约

- 派遣问题：run-tests 断言清单、报告模板骨架、web-prompt 压缩方式、题库单模块格式、装机拓扑
- 完成：2026-10-04T16:30+08:00

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| run-tests.mjs 共 89 行；断言组：AC-1 原文存档（来源链接/三层名/9 模块名/三个关键词）、AC-2 题库 9 模块各含「核心问题/追问/红旗/合理答案的样子」四字样+层间四检查点、AC-3 SKILL 协议 12 要素（一次一问/李想的标准/证据三级/裁定四档/层间依赖检查/拆开逐问/示例回合/引用你的思考/不使用 AskUserQuestion/合理答案判据/校准式认可/复述成）、术语纪律（无 workaround/Plan B）、web-prompt 覆盖、AC-4 报告模板要素、AC-5 层序递增+禁止反向、基线（frontmatter/description>50 字/design AC-1~6 标记） | `skills/product/lixiang-ceo-grill/run-tests.mjs` |
| 题库单模块格式（六要素）：`### 模块 N：名称` + **李想的标准**（「」逐字引文）/**核心问题**（可多问句）/**追问**（列表 3-4 条）/**红旗**（列表）/**合格线**（单行）/**合理答案的样子**（「」整段示例） | `skills/product/lixiang-ceo-grill/references/question-bank.md` L76-95（模块 4 样例） |
| 题库 L3 声明五要素与 run-tests 实际断言 4 字样存在差异（代码层面事实，重构时统一） | `question-bank.md:3` vs `run-tests.mjs` AC-2 |
| report-format.md 七节：总览（证据分布计数）/九模块矩阵（层/模块/裁定/证据强度/核心差距）/逐模块明细六字段/「你是怎么思考这个产品的」（只引用不复述行为，3-5 条带来源）/层间断裂点/前三差距（差距+依据+影响+推荐强度四要素硬性）/推翻结论关键问题（≥3 条） | `skills/product/lixiang-ceo-grill/references/report-format.md`（58 行） |
| web-prompt.md 161 行：铁律八条+合理答案判据+开场+推进裁定+尺子（每模块 7 行压缩：伪标题+标准/第一问/追问/红旗/合格线/合理答案 6 bullet）+收尾（断裂检查+内嵌报告模板）+防走样复述 | `skills/product/lixiang-ceo-grill/web-prompt.md` |
| output-evals.json 3 个 eval：全量复盘-材料丰富（8 断言）/单文件网页prompt（6 断言）/材料贫瘠-缺口发现（5 断言）；断言全 manual 型 | `skills/product/lixiang-ceo-grill/output-evals.json` |
| 用户级装机：C:/Users/parking/.agents/skills/lixiang-ceo-grill 是 **symlink** → /g/GIT/AI_WorkFlow/parking-agents-manual/skills/product/lixiang-ceo-grill/；项目级 .agents/ 无 skills 子目录 | `ls -la C:/Users/parking/.agents/skills/`；readlink 确认 |
| 技能现体积：SKILL.md 10.6KB/111 行，question-bank 15.5KB/211 行，全目录 59KB | `wc -c -l` 实测 |

## 未知项

- 无（派遣范围内已查清）

## 没查的

- ceo-copilot 的 SKILL.md 集成措辞细节——归 wiki-precedent 分片
