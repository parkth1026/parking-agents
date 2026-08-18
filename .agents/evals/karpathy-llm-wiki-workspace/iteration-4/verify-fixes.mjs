#!/usr/bin/env node
// iteration-4 修复验证：核对 T1/T4/V1/V2/T5/T6/T7/T8/T9/D1/T2 全部落点
import { readFileSync } from "node:fs";

const SKILL = "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/SKILL.md";
const TAXO = "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/references/tagging-taxonomy.md";
const VAC = "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/references/validation-and-constraints.md";
const VALI = "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/scripts/validate-wiki.mjs";
const TPL = "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/references/page-templates.md";

let pass = 0, fail = 0;
const check = (name, cond) => { cond ? (pass++, console.log(`  PASS  ${name}`)) : (fail++, console.log(`  FAIL  ${name}`)); };

const skill = readFileSync(SKILL, "utf8");
const taxo = readFileSync(TAXO, "utf8");
const vac = readFileSync(VAC, "utf8");
const vali = readFileSync(VALI, "utf8");
const tpl = readFileSync(TPL, "utf8");

// T1: index 模板块内不再含字面 [[Page Name]]（条目格式说明在 Ingest 步骤 6，属正文规则）
const idxTpl = (skill.split("# Wiki Index")[1] ?? "").split("```")[0] ?? "";
check("T1: index 模板块内无占位链", !idxTpl.includes("[["));
check("T1: 条目格式规则落位（Ingest step 6，带括号+禁占位说明）", skill.includes("- [[Page Name]] — one-line description` (bracketed") && skill.includes("Never leave a placeholder bracketed"));
check("T1: 全文仍以 [[Page Name]] 作语法说明（非模板陷阱）", skill.includes("[[Page Name]]"));
// T4: 死链信号表述已改为 log 记录
check("T4: 删除\"死链是信号\"表述", !skill.includes("signal it deserves"));
check("T4: 改为 pending page + log 记录", skill.includes("pending page") && skill.includes("hard-fails"));
// V1: 标签分类单一真源
check("V1: 正文不再内嵌 27 标签清单", !skill.includes("### Core\n- architecture"));
check("V1: SCHEMA 模板指向 references 单一真源", skill.includes("references/tagging-taxonomy.md into this section"));
check("V1: taxonomy 含 person 标签（T7）", taxo.includes("`person`"));
// V2: 模板细节只在 references
check("V2: 正文无全量模板（Key Facts 模板段已移除）", !skill.includes("## Key Facts\n- Release date"));
check("V2: 正文留摘要表 + 指针", skill.includes("| entity | `entities/` |") && skill.includes("[references/page-templates.md](references/page-templates.md)"));
check("V2: references 模板五类型齐全", ["Entity Page", "Concept Page", "Source Page", "Comparison", "Quer"].every((h) => tpl.includes(h)));
// T5: 行尾约束放宽
check("T5: SKILL.md 行尾表述放宽", skill.includes("LF or CRLF line endings both accepted"));
check("T5: 约束文件行尾表述放宽", vac.includes("LF or CRLF"));
// T6: 文件名=标题规则
check("T6: slug 表述已替换", !skill.includes("sources/{slug}.md"));
check("T6: filename=title 规则存在", skill.includes("Filename = page title"));
// T8: 报告落位规则
check("T8: 报告必须落在 wiki 外（SKILL.md）", skill.includes("OUTSIDE `{wikiDir}`"));
check("T8: 报告落位进完成标准（约束文件）", vac.includes("OUTSIDE `{wikiDir}`"));
// T9: created 回填规则
check("T9: retro-fill created 规则存在", skill.includes("retro-fill"));
// D1: 非交互回退
check("D1: batch 模式回退路径存在", skill.includes("batch/autonomous mode"));
// T2: 校验器硬门原因 + 两位小数
check("T2: 硬门失败原因明示", vali.includes("hard gate: broken links must be 0"));
check("T2: 总分两位小数展示", vali.includes("totalScore.toFixed(2)"));
// 行数
const lines = skill.split(/\r?\n/).length;
check(`行数 ${lines} < 500`, lines < 500);

// ---- 第二轮修复（iteration-4 冷启动发现） ----
check("A5: SCHEMA 拷贝指令明确去反引号", /STRI[P|PPING] the backticks/.test(skill));
check("R3: Ingest 顺序 log 先于 index（并发一致）", skill.indexOf("Log append comes BEFORE the index write") > 0 && skill.indexOf("6. **Update log.md**") < skill.indexOf("7. **Update index.md**"));
check("R3: Query significant 判据量化", skill.includes("synthesizes 3+ pages"));
check("R3: SCHEMA 注释替换说明", skill.includes("REPLACING this comment"));
check("A3: raw 文件名日期=入库日", skill.includes("the **ingestion"));
check("T12: Phase 0 确认门有 batch 回退", skill.includes("implies authorization for creating the configured directories"));
check("A8/T14: 别名/换行 wikilink 禁用规则", skill.includes("no alias syntax"));
check("T10: 同名冲突消歧规则", skill.includes("disambiguate the **source** page"));
check("并发写入规则（iteration-5 新增）", skill.includes("## Concurrent Sessions") && skill.includes("never rewrite it from your in-memory copy"));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
