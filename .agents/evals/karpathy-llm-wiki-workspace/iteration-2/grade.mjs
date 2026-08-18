#!/usr/bin/env node
// iteration-2 程序化评分：对每个 eval × config 运行客观检查，输出 grading.json
// process_check 类断言由主 agent 依据 subagent 回复证据人工补充判定
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";

const WS = "D:/GIT_dev/Claude_skills/.claude/skills/karpathy-llm-wiki-workspace/iteration-2";
const SKILL = "D:/GIT_dev/Claude_skills/.claude/skills/karpathy-llm-wiki";
const SCRIPT = join(SKILL, "scripts", "validate-wiki.mjs");

function runValidation(wiki) {
  try {
    const out = execFileSync("node", [SCRIPT, "--wiki", wiki, "--config", join(SKILL, "config.json")], { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) { return { code: e.status, out: (e.stdout?.toString() ?? "") }; }
}
function walkMd(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!name.startsWith(".")) walkMd(p, acc); }
    else if (name.endsWith(".md")) acc.push(p);
  }
  return acc;
}
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");
const base = (p) => basename(p, ".md");
const EXCLUDED = new Set(["SCHEMA.md", "index.md", "log.md", "Home.md"]);

function gradeWiki(wikiDir) {
  const g = {};
  if (!existsSync(wikiDir)) return { error: "wiki dir missing" };
  const files = walkMd(wikiDir).filter((p) => !EXCLUDED.has(basename(p)));
  const v = runValidation(wikiDir);

  // validation score / broken links
  const scoreM = v.out.match(/Total:\s+([\d.]+)\s+\/\s+10/);
  g.validationScore = scoreM ? parseFloat(scoreM[1]) : null;
  g.validationPassed = v.out.includes("Status: PASS");
  g.brokenLinkCount = (v.out.match(/^.*Broken Links \((\d+)\)/m) || [])[1] ?? null;

  // frontmatter
  const noFm = files.filter((p) => !/^---\s*\r?\n[\s\S]*?\r?\n---/.test(read(p)));
  g.allFrontmatter = noFm.length === 0;
  g.frontmatterOffenders = noFm.map(base);

  // outbound links (excluding self)
  const underlinked = [];
  for (const p of files) {
    const links = [...read(p).matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].trim()).filter((l) => l !== base(p));
    if (links.length < 2) underlinked.push(`${base(p)}:${links.length}`);
  }
  g.allMinOutbound = underlinked.length === 0;
  g.underlinked = underlinked;

  // structure dirs
  g.hasSchema = existsSync(join(wikiDir, "SCHEMA.md"));
  g.hasIndex = existsSync(join(wikiDir, "index.md"));
  g.hasLog = existsSync(join(wikiDir, "log.md"));
  g.entityPages = existsSync(join(wikiDir, "entities")) ? readdirSync(join(wikiDir, "entities")).filter((f) => f.endsWith(".md")).length : 0;
  g.conceptPages = existsSync(join(wikiDir, "concepts")) ? readdirSync(join(wikiDir, "concepts")).filter((f) => f.endsWith(".md")).length : 0;
  g.sourcePages = existsSync(join(wikiDir, "sources")) ? readdirSync(join(wikiDir, "sources")).filter((f) => f.endsWith(".md")).length : 0;

  // index coverage
  if (g.hasIndex) {
    const idx = read(join(wikiDir, "index.md"));
    const missing = files.filter((p) => !idx.includes(`[[${base(p)}]]`)).map(base);
    g.indexCoversAll = missing.length === 0;
    g.indexMissing = missing;
  }
  // log has entries
  if (g.hasLog) g.logHasEntries = read(join(wikiDir, "log.md")).split(/\r?\n/).length > 4;
  g.rawSaved = existsSync(join(wikiDir, "..", "wiki-raw")) ? walkMd(join(wikiDir, "..", "wiki-raw")).length > 0 : false;
  return g;
}

// ---- 污染检查：skill 目录 + 真实 memory 目录 ----
function pollutionCheck() {
  const skillFiles = walkMd(SKILL).map((p) => p.replace(/\\/g, "/"));
  const expected = [
    `${SKILL}/SKILL.md`, `${SKILL}/config.json`,
    `${SKILL}/references/page-templates.md`, `${SKILL}/references/tagging-taxonomy.md`,
    `${SKILL}/scripts/validate-wiki.mjs`,
  ];
  const extra = skillFiles.filter((p) => !expected.includes(p));
  const memNew = [];
  for (const d of ["C:/Users/Administrator/memory/jenkins-learnings", "C:/Users/Administrator/memory/jenkins-learnings-raw"]) {
    if (!existsSync(d)) continue;
    for (const f of walkMd(d)) {
      const m = statSync(f).mtime;
      if (m > new Date("2026-08-14T00:00:00")) memNew.push(f); // 今天被改过 = 疑似污染
    }
  }
  return { skillExtraFiles: extra, memoryTouchedToday: memNew };
}

const results = {};
for (const ev of ["eval-ingest-fresh", "eval-ingest-incremental", "eval-lint"]) {
  results[ev] = {};
  for (const cfg of ["with_skill", "without_skill"]) {
    const wiki = join(WS, ev, cfg, "outputs", "wiki");
    results[ev][cfg] = existsSync(wiki) ? gradeWiki(wiki) : { error: "no wiki dir" };
  }
}
const pollution = pollutionCheck();
writeFileSync(join(WS, "grading-raw.json"), JSON.stringify({ results, pollution }, null, 2));
console.log(JSON.stringify({ results, pollution }, null, 2));
