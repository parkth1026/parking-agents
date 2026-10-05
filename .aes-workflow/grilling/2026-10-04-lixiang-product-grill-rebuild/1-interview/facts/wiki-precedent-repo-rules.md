# Fact: wiki 先例（ceo-copilot）与仓库规则

- 派遣问题：仓内「LLM wiki 融合进技能」的现成先例长什么样；修改已发布技能的流程要求；lixiang-ceo-grill 名字的全仓引用面；history.json 结构
- 完成：2026-10-04T16:30+08:00

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| ceo-copilot 位于 skills/product/，references/wiki/ 含 SCHEMA.md/index.md/log.md + books/concepts/methods/cases 四目录，126 内容页 | `G:/GIT/AI_WorkFlow/parking-agents-manual/skills/product/ceo-copilot/references/wiki/` |
| 校验器用仓内技能：karpathy-llm-wiki v7.2，`node validate-wiki.mjs --wiki <path>`；8 计分维度（断链25%/自引10%/孤儿10%/index完整15%/frontmatter15%/页大小10%/出链10%/标签5%），PASS=总分≥minScore 且断链 0 | `skills/ue/karpathy-llm-wiki/scripts/validate-wiki.mjs`；实测记录 `evals/ceo-copilot-workspace/verify-v71/consistency-c/validator-output.txt`（126 页 8 维全 10/10） |
| ceo-copilot 运行时 slim：日常必读仅 SKILL.md + references/14-简明诊断.md，**复盘/诊断运行时不读 wiki**；wiki 仅显式知识查询/覆盖验收/维护时启用 | `skills/product/ceo-copilot/SKILL.md`（37 行/4010B） |
| wiki 页 frontmatter 至少 title/type/tags（硬门）+ created/updated/layers/report_lines/sources；概念页须含「拿它问什么/误用边界」，案例页须含「机制/证据与深度/不能推出什么」；文件名即 wikilink 标题，唯一前缀防跨目录重名；每页 ≥2 出链、≤200 行 | `skills/product/ceo-copilot/references/wiki/SCHEMA.md` |
| run-tests.mjs 自写结构断言（不调外部 validator），wiki 组断言：四目录在位、页数下限、index `[[]]` 覆盖全部内容页、frontmatter 齐全 | `skills/product/ceo-copilot/run-tests.mjs`（171 行，展开 117 断言） |
| 修改已发布技能无专门流程；晋级门槛=评测五件套（trigger-evals.json/output-evals.json/run-tests.mjs/trigger-benchmark.json/history.json）+ run-tests 退出码 0；无 issue 强制要求 | `docs/agents/skill-release.md`（38 行） |
| lixiang-ceo-grill 目前**缺** trigger-evals.json 与 trigger-benchmark.json（五件套不全，2026-09-21~23 发布时惯例未硬化） | `skills/product/lixiang-ceo-grill/` 目录清单 |
| 改名波及：安装器自动发现、无逐技能清单（零改动）；ceo-copilot run-tests.mjs 规范名集合含 "lixiang-ceo-grill"（L35）且要求其邻域负例 ≥3 条；ceo-copilot trigger-evals.json 3 条负例 expected_skill=lixiang-ceo-grill 且 source 字段指向旧路径 skills/pub/；b2b-product-review design.md L52 历史提及；evals/ 与 .agents/evals/ 均为记录性快照 | `skills/product/ceo-copilot/run-tests.mjs:35,41`；`skills/product/ceo-copilot/trigger-evals.json:6,143-173`；`skills/product/b2b-product-review/references/design.md:52` |
| history.json 结构：{skill, runs[]{date,iteration_ref,gates{with_skill/without_skill/old_skill},vs_previous,bank_epoch,current_best},current_best}；lixiang 现仅 1 run（2026-09-23，双臂） | 两技能 history.json 对比 |
| 仓库无 CI（无 .github/workflows），门禁全在本地：npm test（含 test-skill-discovery/install-skills/no-tool-names/hooks/pi/harness/bump-version/check:repo）、npm run evals -- --skill <名> | `package.json` scripts；`ls .github/workflows` 无 |
| check:repo 只扫 skills/pub 与 matt-skills，不含 product/ | `package.json` check:repo 组装 |

## 未知项

- ceo-copilot wiki 页均行数上限（≤200）在本域是否够用——待实际编译验证

## 没查的

- 全局 karpathy-llm-wiki 的 knowledgeBase 配置（NAS wikiDir）——本次融合进技能目录，不动全局基建，超出派遣范围
