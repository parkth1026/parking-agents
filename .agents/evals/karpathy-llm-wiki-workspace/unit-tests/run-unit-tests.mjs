#!/usr/bin/env node
// validate-wiki.mjs 单元级冒烟测试 — 脚手架仅存在于 workspace，绝不进入 skill 目录
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const SCRIPT = "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/scripts/validate-wiki.mjs";
const ROOT = "D:/GIT_dev/parking-agents/.agents/evals/karpathy-llm-wiki-workspace/unit-tests";
// Windows: 无法删除脚本自身所在目录，只清子目录
for (const sub of ["good-wiki", "bad-wiki", "cfg-wiki", "bom-wiki", "empty-wiki", "idx-wiki", "idx-off-config.json", "hardgate-wiki", "stale-wiki", "stale-wiki-raw", "type-wiki", "stale-enforce-config.json", "sandbox", "strict-config.json", "mock-skill-env.json"])
  rmSync(join(ROOT, sub), { recursive: true, force: true });

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}
// v6：hermetic —— SKILL_ENV 指向不存在的文件，阻止 validator 回退到真实机器
// 配置（~/.config/parking-agents/skill-env.json 指向 NAS raw），测试不依赖外部状态
const HERMETIC_ENV = { ...process.env, SKILL_ENV: join(ROOT, "no-such-env.json") };
function run(args) {
  try {
    const stdout = execFileSync("node", [SCRIPT, ...args], { encoding: "utf8", env: HERMETIC_ENV });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: e.stdout?.toString() ?? "" };
  }
}

// ============ 场景 1: 好 wiki → PASS, exit 0 ============
{
  const wiki = join(ROOT, "good-wiki");
  mkdirSync(join(wiki, "concepts"), { recursive: true });
  mkdirSync(join(wiki, "entities"), { recursive: true });
  writeFileSync(join(wiki, "SCHEMA.md"), "# Schema\n## Tags\n- architecture\n- model\n");
  writeFileSync(join(wiki, "index.md"), "# Index\n- [[Transformer]] — x\n- [[Attention]] — x\n- [[OpenAI]] — x\n");
  writeFileSync(join(wiki, "log.md"), "# Log\n");
  writeFileSync(join(wiki, "concepts", "Transformer.md"),
    "---\ntitle: Transformer\ntype: concept\ntags: [architecture]\n---\n# Transformer\nSee [[Attention]] and [[OpenAI]].\n");
  writeFileSync(join(wiki, "concepts", "Attention.md"),
    "---\ntitle: Attention\ntype: concept\ntags: [architecture]\n---\n# Attention\nSee [[Transformer]] and [[OpenAI]].\n");
  writeFileSync(join(wiki, "entities", "OpenAI.md"),
    "---\ntitle: OpenAI\ntype: entity\ntags: [model]\n---\n# OpenAI\nSee [[Transformer]] and [[Attention]].\n");
  const r = run(["--wiki", wiki]);
  console.log("\n[1] good wiki");
  check("exit code 0", r.code === 0, `got ${r.code}`);
  check("Status: PASS", r.stdout.includes("Status: PASS"));
  check("no Broken Links issues", !r.stdout.includes("Broken Links ("));
  check("Found 3 wiki pages", r.stdout.includes("Found 3 wiki pages"));
}

// ============ 场景 2: 坏 wiki → 8 维度全报, exit 1 ============
{
  const wiki = join(ROOT, "bad-wiki");
  mkdirSync(join(wiki, "concepts"), { recursive: true });
  writeFileSync(join(wiki, "SCHEMA.md"), "# Schema\n- architecture\n");
  // 无 index.md → index 完整性失败
  writeFileSync(join(wiki, "concepts", "Broken.md"),
    "---\ntitle: Broken\ntype: concept\ntags: [not-a-valid-tag]\n---\n# Broken\nLink to [[Ghost Page]] and self [[Broken]] and [[Broken2]].\n");
  // 缺 frontmatter、只有 0 出链、孤儿
  writeFileSync(join(wiki, "concepts", "Orphan.md"), "# Orphan\nNo links at all.\n");
  const r = run(["--wiki", wiki]);
  console.log("\n[2] bad wiki (8 dimensions)");
  check("exit code 1", r.code === 1, `got ${r.code}`);
  check("reports Broken Links", r.stdout.includes("Broken Links (2)"));
  check("reports Self References", r.stdout.includes("Self References (1)"));
  check("reports Orphan Pages", r.stdout.includes("Orphan Pages"));
  check("reports Missing from Index", r.stdout.includes("Missing from Index"));
  check("reports Frontmatter Issues", r.stdout.includes("Missing frontmatter"));
  check("reports Invalid Tags", r.stdout.includes("not-a-valid-tag"));
  check("reports Under-linked", r.stdout.includes("Under-linked Pages"));
  check("Status: FAIL", r.stdout.includes("Status: FAIL"));
}

// ============ 场景 3: --config 覆盖（maxLines 调小 → 超尺寸）============
{
  const wiki = join(ROOT, "cfg-wiki");
  mkdirSync(join(wiki, "concepts"), { recursive: true });
  writeFileSync(join(wiki, "SCHEMA.md"), "# S\n- architecture\n");
  writeFileSync(join(wiki, "index.md"), "# I\n- [[A]]\n- [[B]]\n");
  const body = Array.from({ length: 12 }, (_, i) => `line ${i}`).join("\n");
  writeFileSync(join(wiki, "concepts", "A.md"),
    `---\ntitle: A\ntype: concept\ntags: [architecture]\n---\n# A\nSee [[B]].\n${body}\n`);
  writeFileSync(join(wiki, "concepts", "B.md"),
    `---\ntitle: B\ntype: concept\ntags: [architecture]\n---\n# B\nSee [[A]].\n`);
  const cfg = join(ROOT, "strict-config.json");
  // maxLines=5 使 A 超限；minScore 拉到 9.9 放大惩罚
  writeFileSync(cfg, JSON.stringify({ page: { maxLines: 5, minOutboundLinks: 1 }, scoring: { minScore: 9.9 } }));
  const rNoCfg = run(["--wiki", wiki]);
  const rCfg = run(["--wiki", wiki, "--config", cfg]);
  console.log("\n[3] --config override");
  check("without config: no oversized pages", !rNoCfg.stdout.includes("Oversized Pages"));
  check("with config maxLines=5: oversized reported (A=19 lines, B=7 lines)", rCfg.stdout.includes("Oversized Pages (2)"), "");
  check("with config minScore=9.9: FAIL", rCfg.stdout.includes("Status: FAIL"));
  check("threshold echoed as 9.9", rCfg.stdout.includes("Threshold: 9.9"));
}

// ============ 场景 4: BOM 容错 ============
{
  const wiki = join(ROOT, "bom-wiki");
  mkdirSync(join(wiki, "concepts"), { recursive: true });
  writeFileSync(join(wiki, "SCHEMA.md"), "# S\n- architecture\n");
  writeFileSync(join(wiki, "index.md"), "# I\n- [[A]]\n- [[B]]\n");
  const bom = "\uFEFF";
  writeFileSync(join(wiki, "concepts", "A.md"),
    `${bom}---\ntitle: A\ntype: concept\ntags: [architecture]\n---\n# A\nSee [[B]].\n`);
  writeFileSync(join(wiki, "concepts", "B.md"),
    `---\ntitle: B\ntype: concept\ntags: [architecture]\n---\n# B\nSee [[A]].\n`);
  const r = run(["--wiki", wiki]);
  console.log("\n[4] BOM tolerance");
  check("BOM page: no frontmatter false positive", !r.stdout.includes("Frontmatter Issues"));
  check("BOM page: no invalid tag false positive", !r.stdout.includes("Invalid Tags"));
  check("BOM page: PASS", r.stdout.includes("Status: PASS"));
}

// ============ 场景 5: CLI 契约 ============
{
  console.log("\n[5] CLI contract");
  const r1 = run([]);
  check("missing --wiki → exit 2", r1.code === 2, `got ${r1.code}`);
  const r2 = run(["--bogus", "x", "--wiki", join(ROOT, "good-wiki")]);
  check("unknown arg → exit 2", r2.code === 2, `got ${r2.code}`);
  const r3 = run(["--wiki", join(ROOT, "no-such-dir")]);
  check("nonexistent wiki → exit 1", r3.code === 1, `got ${r3.code}`);
  const emptyWiki = join(ROOT, "empty-wiki");
  mkdirSync(emptyWiki, { recursive: true });
  const r4 = run(["--wiki", emptyWiki]);
  check("empty wiki → exit 0, graceful", r4.code === 0 && r4.stdout.includes("Nothing to validate"), `code=${r4.code}`);
}

// ============ 场景 6: SKILL.md 配置分层链路（修复后）============
{
  console.log("\n[6] config layering (skill defaults + knowledgeBase env)");
  const mockEnv = join(ROOT, "mock-skill-env.json");
  writeFileSync(mockEnv, JSON.stringify({
    knowledgeBase: {
      wikiDir: join(ROOT, "sandbox", "wiki"),
      rawDir: join(ROOT, "sandbox", "wiki-raw"),
    },
  }));
  const { execFileSync: ef } = await import("node:child_process");
  const merged = JSON.parse(ef("node", ["-e", `
    const fs = require('fs');
    const skillCfg = JSON.parse(fs.readFileSync('D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/config.json','utf8').replace(/^\\uFEFF/,''));
    const envCfg = JSON.parse(fs.readFileSync(${JSON.stringify(mockEnv)},'utf8').replace(/^\\uFEFF/,''));
    const merged = structuredClone(skillCfg);
    (function deep(dst, src){ for (const k of Object.keys(src)) { if (src[k] && typeof src[k]==='object' && !Array.isArray(src[k])) { dst[k] = dst[k] && typeof dst[k]==='object' ? dst[k] : {}; deep(dst[k], src[k]); } else dst[k] = src[k]; } })(merged, envCfg);
    console.log(JSON.stringify({ wikiDir: merged.knowledgeBase?.wikiDir, rawDir: merged.knowledgeBase?.rawDir, minScore: merged.scoring?.minScore, maxLines: merged.page?.maxLines }));
  `], { encoding: "utf8", env: { ...process.env, SKILL_ENV: mockEnv } }));
  check("knowledgeBase.wikiDir resolves from env layer", merged.wikiDir === join(ROOT, "sandbox", "wiki"), JSON.stringify(merged));
  check("knowledgeBase.rawDir resolves from env layer", merged.rawDir === join(ROOT, "sandbox", "wiki-raw"));
  check("scoring.minScore=9.0 from skill layer", merged.minScore === 9.0);
  check("page.maxLines=200 from skill layer", merged.maxLines === 200);
}

// ============ 场景 7: v5 特性（index 断链暴露 / index 计入链 / 点号标签）============
{
  const wiki = join(ROOT, "idx-wiki");
  mkdirSync(join(wiki, "concepts"), { recursive: true });
  writeFileSync(join(wiki, "SCHEMA.md"), "# S\n## Tags\n- architecture\n- ue5.5\n");
  writeFileSync(join(wiki, "index.md"), "# I\n- [[A]] — x\n- [[B]] — x\n- [[C]] — x\n- [[Ghost]] — x\n");
  writeFileSync(join(wiki, "log.md"), "# Log\n");
  writeFileSync(join(wiki, "concepts", "A.md"),
    "---\ntitle: A\ntype: concept\ntags: [ue5.5]\n---\n# A\nSee [[B]].\n");
  writeFileSync(join(wiki, "concepts", "B.md"),
    "---\ntitle: B\ntype: concept\ntags: [architecture]\n---\n# B\nSee [[A]].\n");
  writeFileSync(join(wiki, "concepts", "C.md"),
    "---\ntitle: C\ntype: concept\ntags: [architecture]\n---\n# C\nSee [[A]] and [[B]].\n");
  const r = run(["--wiki", wiki]);
  console.log("\n[7] v5: index dangling + index counts as inbound + dot tags");
  check("index.md 悬空链被报告", r.stdout.includes("index.md -> [[Ghost]]"));
  check("断链计数含 index（1 条）", r.stdout.includes("Broken Links (1)"));
  check("含点标签 ue5.5 不再误报", !r.stdout.includes("Invalid Tags"));
  check("C 仅被 index 链接 → 不算孤儿（默认 indexCountsAsInbound=true）", !r.stdout.includes("Orphan Pages ("));
  const cfgOff = join(ROOT, "idx-off-config.json");
  writeFileSync(cfgOff, JSON.stringify({ scoring: { indexCountsAsInbound: false } }));
  const rOff = run(["--wiki", wiki, "--config", cfgOff]);
  check("关闭开关后 C 判孤儿", rOff.stdout.includes("Orphan Pages (1)") && rOff.stdout.includes("C"));
}

// ============ 场景 8: 高分 + 断链 → 硬门 FAIL 且原因明示（T2 回归） ============
{
  const wiki = join(ROOT, "hardgate-wiki");
  mkdirSync(join(wiki, "concepts"), { recursive: true });
  writeFileSync(join(wiki, "SCHEMA.md"), "# S\n## Tags\n- architecture\n");
  writeFileSync(join(wiki, "index.md"), "# I\n- [[A]] — x\n- [[B]] — x\n- [[C]] — x\n");
  writeFileSync(join(wiki, "log.md"), "# Log\n");
  writeFileSync(join(wiki, "concepts", "A.md"),
    "---\ntitle: A\ntype: concept\ntags: [architecture]\n---\n# A\nSee [[B]] and [[C]] and [[Ghost]].\n");
  writeFileSync(join(wiki, "concepts", "B.md"),
    "---\ntitle: B\ntype: concept\ntags: [architecture]\n---\n# B\nSee [[A]] and [[C]].\n");
  writeFileSync(join(wiki, "concepts", "C.md"),
    "---\ntitle: C\ntype: concept\ntags: [architecture]\n---\n# C\nSee [[A]] and [[B]].\n");
  const r = run(["--wiki", wiki]);
  console.log("\n[8] hard gate: score>=9 + 1 broken link");
  check("exit code 1", r.code === 1, `got ${r.code}`);
  check("FAIL 原因明示硬门", r.stdout.includes("hard gate: broken links must be 0 — found 1"));
  check("总分两位小数展示", /Total: \d+\.\d{2} \/ 10/.test(r.stdout));
  check("总分不再四舍五入虚高到 10", !r.stdout.includes("Total: 10.00 / 10"));
}

// ============ 场景 9: v6 staleness（raw 证据 vs 页面 updated） ============
{
  const wiki = join(ROOT, "stale-wiki");
  const raw = join(ROOT, "stale-wiki-raw");
  mkdirSync(join(wiki, "concepts"), { recursive: true });
  mkdirSync(join(raw, "details"), { recursive: true });
  writeFileSync(join(wiki, "SCHEMA.md"), "# S\n## Tags\n- architecture\n");
  writeFileSync(join(wiki, "index.md"), "# I\n- [[A]] — x\n- [[B]] — x\n- [[C]] — x\n");
  writeFileSync(join(wiki, "log.md"), "# Log\n");
  writeFileSync(join(wiki, "concepts", "A.md"),
    "---\ntitle: A\ntype: concept\ntags: [architecture]\nupdated: 2026-01-01\n---\n# A\nSee [[B]] and [[C]].\n");
  writeFileSync(join(wiki, "concepts", "B.md"),
    "---\ntitle: B\ntype: concept\ntags: [architecture]\nupdated: 2026-08-18\n---\n# B\nSee [[A]] and [[C]].\n");
  // C 有 frontmatter 但缺 updated 字段 —— 无法证明新鲜度
  writeFileSync(join(wiki, "concepts", "C.md"),
    "---\ntitle: C\ntype: concept\ntags: [architecture]\n---\n# C\nSee [[A]] and [[B]].\n");
  // raw 证据：a.md 比 A 新（stale）；recurrence-b.md 比 B 旧（fresh）；recurrence-c.md 存在而 C 缺 updated（stale）
  writeFileSync(join(raw, "details", "a.md"),
    "---\nschema: raw-knowledge/2\nrecorded_at: 2026-06-01\n---\n# a evidence\n");
  writeFileSync(join(raw, "details", "recurrence-b.md"),
    "---\nrecorded_at: 2026-08-01\n---\n# b recurrence\n");
  writeFileSync(join(raw, "details", "recurrence-c.md"),
    "---\nrecorded_at: 2026-08-10\n---\n# c recurrence\n");
  writeFileSync(join(raw, "details", "unmatched.md"),
    "---\nrecorded_at: 2026-08-18\n---\n# no matching page\n");
  const rSkip = run(["--wiki", wiki]);
  console.log("\n[9] v6 staleness");
  check("无 --raw 且 SKILL_ENV 不可用 → staleness 跳过", rSkip.stdout.includes("Skipped — rawDir not found"));
  const r = run(["--wiki", wiki, "--raw", raw]);
  check("默认 report-only：exit 0", r.code === 0, `got ${r.code}`);
  check("stale 页 = 2（A 与 C；B 证据较旧不计）", r.stdout.includes("Stale Pages (2)"));
  check("A 以证据文件+日期列出", r.stdout.includes("A: a.md (2026-06-01) > page updated 2026-01-01"));
  check("recurrence- 前缀匹配 + 缺 updated 字段标注", r.stdout.includes("C: recurrence-c.md (2026-08-10)") && r.stdout.includes("(missing updated field)"));
  check("B 不在 stale 列表", !r.stdout.includes("B: recurrence-b.md"));
  check("report-only 提示开关", r.stdout.includes("report-only"));
  const enforceCfg = join(ROOT, "stale-enforce-config.json");
  writeFileSync(enforceCfg, JSON.stringify({ scoring: { stalenessEnforce: true } }));
  const rEnf = run(["--wiki", wiki, "--raw", raw, "--config", enforceCfg]);
  check("stalenessEnforce=true → exit 1", rEnf.code === 1, `got ${rEnf.code}`);
  check("FAIL 原因明示 staleness", rEnf.stdout.includes("staleness enforced: 2 stale pages"));
}

// ============ 场景 10: v6 type 枚举（SCHEMA `## Page Types` 声明扩展） ============
{
  const wiki = join(ROOT, "type-wiki");
  mkdirSync(join(wiki, "concepts"), { recursive: true });
  writeFileSync(join(wiki, "SCHEMA.md"), "# S\n## Tags\n- architecture\n\n## Page Types\n- jenkins-error\n\n## Page Directories\n- details/\n");
  writeFileSync(join(wiki, "index.md"), "# I\n- [[A]] — x\n- [[B]] — x\n");
  writeFileSync(join(wiki, "log.md"), "# Log\n");
  writeFileSync(join(wiki, "concepts", "A.md"),
    "---\ntitle: A\ntype: jenkins-error\ntags: [architecture]\n---\n# A\nSee [[B]].\n");
  writeFileSync(join(wiki, "concepts", "B.md"),
    "---\ntitle: B\ntype: custom-type\ntags: [architecture]\n---\n# B\nSee [[A]].\n");
  const r = run(["--wiki", wiki]);
  console.log("\n[10] v6 type enum");
  check("SCHEMA 声明的 jenkins-error 合法", !r.stdout.includes("Invalid type 'jenkins-error'"));
  check("未声明的 custom-type 报 Invalid type", r.stdout.includes("Invalid type 'custom-type'"));
  check("提示在 SCHEMA Page Types 声明", r.stdout.includes("declare it in SCHEMA.md"));
  check("计入 Frontmatter Issues", r.stdout.includes("Frontmatter Issues (1)"));
  // Page Types 声明不得混入标签集
  const r2 = run(["--wiki", wiki, "--config", join(ROOT, "no-config.json")]);
  check("声明节条目不算标签（jenkins-error 不在 Invalid Tags）", !r2.stdout.includes("tag 'jenkins-error'"));
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
