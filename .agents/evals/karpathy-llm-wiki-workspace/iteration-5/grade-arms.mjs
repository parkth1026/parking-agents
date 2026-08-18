#!/usr/bin/env node
// iteration-5 客观评分器：
//   1) 对每个 run 跑 validate-wiki.mjs 并解析（分数/状态/各维度问题数）
//   2) 结构检查（规范目录页数、raw 沉淀与命名、index 覆盖、log 条目、answer.md）
//   3) 盲评打包：剥离 process-log.md 后复制到 blind/<随机id>/，映射表事后才读
// 用法: node grade-arms.mjs [--scenario eval-query] [--arm with_skill] [--run 2]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const ROOT = "D:/GIT_dev/parking-agents/.agents/evals/karpathy-llm-wiki-workspace/iteration-5";
const SCRIPT = "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/scripts/validate-wiki.mjs";
const CFG = "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/config.json";
const CANON = ["entities", "concepts", "sources", "comparisons", "queries"];

const argv = process.argv.slice(2);
const pick = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const SCEN_FILTER = pick("scenario"), ARM_FILTER = pick("arm"), RUN_FILTER = pick("run");
const SCENARIOS = ["eval-ingest-fresh", "eval-ingest-incremental", "eval-lint", "eval-query"];

function validate(wikiDir) {
  let out = "", code = 0;
  try { out = execFileSync("node", [SCRIPT, "--wiki", wikiDir, "--config", CFG], { encoding: "utf8" }); }
  catch (e) { out = e.stdout?.toString() ?? ""; code = e.status ?? 1; }
  const num = (re) => Number((out.match(re) || [])[1] ?? 0);
  return {
    code,
    raw: out,
    total: Number((out.match(/Total: ([\d.]+) \/ 10/) || [])[1] ?? null),
    passed: /Status: PASS/.test(out),
    brokenLinks: num(/Broken Links \((\d+)\)/),
    orphans: num(/Orphan Pages \((\d+)\)/),
    missingFromIndex: num(/Missing from Index \((\d+)\)/),
    frontmatterIssues: num(/Frontmatter Issues \((\d+)\)/),
    underlinked: num(/Under-linked Pages \((\d+)\)/),
  };
}

function walkMd(dir) {
  const acc = [];
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) acc.push(...walkMd(join(dir, e.name)));
    else if (e.name.endsWith(".md")) acc.push(join(dir, e.name));
  }
  return acc;
}

function structural(outputsDir) {
  const wikiDir = existsSync(join(outputsDir, "wiki")) ? join(outputsDir, "wiki") : outputsDir;
  const layout = existsSync(join(outputsDir, "wiki")) ? "canonical" : "flat";
  const s = { layout, hasSchema: existsSync(join(wikiDir, "SCHEMA.md")), hasIndex: existsSync(join(wikiDir, "index.md")), hasLog: existsSync(join(wikiDir, "log.md")) };
  for (const d of CANON) s[`${d}Pages`] = existsSync(join(wikiDir, d)) ? readdirSync(join(wikiDir, d)).filter((f) => f.endsWith(".md")).length : 0;
  s.totalPages = CANON.reduce((a, d) => a + s[`${d}Pages`], 0);
  // index 覆盖：规范目录页的 basename 是否全部以 [[..]] 出现在 index.md
  if (s.hasIndex && s.totalPages > 0) {
    const idx = readFileSync(join(wikiDir, "index.md"), "utf8");
    const links = new Set([...idx.matchAll(/\[\[([^\]|]+)\]\]/g)].map((m) => m[1].trim()));
    const pages = CANON.flatMap((d) => existsSync(join(wikiDir, d)) ? readdirSync(join(wikiDir, d)).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")) : []);
    s.indexCoversAll = pages.every((p) => links.has(p));
    s.indexMissing = pages.filter((p) => !links.has(p));
  } else { s.indexCoversAll = s.totalPages === 0; s.indexMissing = []; }
  // log 有无正文条目
  if (s.hasLog) {
    const log = readFileSync(join(wikiDir, "log.md"), "utf8");
    s.logHasEntries = (log.match(/^\| ?\d{4}-\d{2}-\d{2}/gm) || []).length > 0;
  } else s.logHasEntries = false;
  // raw 沉淀 + 命名
  const rawDir = join(outputsDir, "wiki-raw");
  const rawFiles = walkMd(rawDir);
  s.rawSaved = rawFiles.length > 0;
  s.rawNamingOk = rawFiles.length === 0 ? null : rawFiles.some((f) => /^\d{4}-\d{2}-\d{2}-/.test(f.split(/[\\/]/).pop()));
  // query 场景产物
  s.answerSaved = existsSync(join(outputsDir, "answer.md"));
  return s;
}

function gradeRun(sc, arm, r) {
  const outputsDir = join(ROOT, sc, arm, `run-${r}`, "outputs");
  const wikiDir = existsSync(join(outputsDir, "wiki")) ? join(outputsDir, "wiki") : outputsDir;
  const v = validate(wikiDir);
  const s = structural(outputsDir);
  return { scenario: sc, arm, run: r, validator: v, structural: s, outputsDir };
}

const results = [];
const mapping = {};
for (const sc of SCENARIOS) {
  if (SCEN_FILTER && sc !== SCEN_FILTER) continue;
  for (const arm of ["with_skill", "without_skill"]) {
    if (ARM_FILTER && arm !== ARM_FILTER) continue;
    for (const r of [1, 2, 3]) {
      if (RUN_FILTER && String(r) !== RUN_FILTER) continue;
      const g = gradeRun(sc, arm, r);
      results.push(g);
      // 盲评包：复制 outputs（剥离 process-log.md），id 随机、乱序落盘
      const id = randomBytes(4).toString("hex");
      const blindDir = join(ROOT, "blind", id);
      rmSync(blindDir, { recursive: true, force: true });
      cpSync(g.outputsDir, blindDir, { recursive: true, force: true, filter: (src) => !/process-log\.md$/.test(src) });
      mapping[id] = { scenario: sc, arm, run: r };
    }
  }
}
// 打乱映射顺序再写盘，避免目录顺序=臂顺序
const shuffled = Object.fromEntries(Object.entries(mapping).sort(() => Math.random() - 0.5));
writeFileSync(join(ROOT, "blind", "mapping.json"), JSON.stringify(shuffled, null, 2));

const slim = results.map(({ validator: { raw, ...v }, structural: s, ...rest }) => ({ ...rest, validator: v, structural: s }));
writeFileSync(join(ROOT, "grading", "objective.json"), JSON.stringify({ generated: new Date().toISOString(), runs: slim }, null, 2));

// 汇总表
console.log("scenario | arm | runs | scores | passRate | meanTokens(n/a)");
for (const sc of SCENARIOS.filter((x) => !SCEN_FILTER || x === SCEN_FILTER)) {
  for (const arm of ["with_skill", "without_skill"].filter((x) => !ARM_FILTER || x === ARM_FILTER)) {
    const rs = results.filter((x) => x.scenario === sc && x.arm === arm);
    if (!rs.length) continue;
    const scores = rs.map((x) => x.validator.total).join(", ");
    const passes = rs.filter((x) => x.validator.passed).length;
    console.log(`${sc} | ${arm} | ${rs.length} | [${scores}] | ${passes}/${rs.length}`);
  }
}
console.log(`\nobjective grading -> ${join(ROOT, "grading", "objective.json")}`);
console.log(`blind bundles -> ${join(ROOT, "blind")} (${Object.keys(mapping).length} ids; mapping.json 先勿读，盲评后再用)`);
