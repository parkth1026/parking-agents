#!/usr/bin/env node
// eval-conflict-batch-ingest 专项评分器（ruler v3 纪元，2026-08-23）。
// 场景：多素材冲突批次 = C1083×3（同签名不同根因，考不误并丢素材）+ C2039×3（同根因家族，考关联）
// + C2672 recurrence×1（考回流）。断言只考任务本质（知识承接/回流/关联/绿），不进技能私有契约。
// 评分尺子（validate-wiki.mjs + 技能 config）对两臂一视同仁；路径 import.meta.url 相对解析。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = (() => { const a = process.argv[2]; if (!a || !existsSync(a)) { console.log("用法: node grade-conflictbatch.mjs <iteration目录>"); process.exit(2); } return resolve(a); })();
const SC = "eval-conflict-batch-ingest";
const SCRIPT = join(HERE, "..", "scripts", "validate-wiki.mjs");
const CFG = join(HERE, "..", "config.json");
const SEED_LOG = join(HERE, "..", "fixtures-conflictbatch", "wiki-seed", "log.md");
const GATES = ["with_skill", "without_skill"];
const SEED_DETAILS = new Set([
  "024-asset-version-mismatch.md",
  "002-lnk2019-fearthmaterialparametersbakerfragment.md",
  "aes6-496-c2672-invoke-flushuptodatetask.md",
  "038-c2660-handle-download-complete-args-mismatch.md",
  "029-C2664-TypeConversionError-UnrealEngineProperty.md",
]);
const C1083_RAW = [
  "aes6-1007-1008-C1083-propertyeditor-editor-only-include.md",
  "aes6-1257-1258-C1083-objecttools-editor-include.md",
  "aes6-1910-1912-C1083-unused-interchange-include.md",
];
const C2039_RAW = [
  "aes6-1221-1223-C2039-unguarded-editoronly-changeset-api.md",
  "aes6-1556-1558-C2039-utexture-source-editoronly.md",
  "aes6-2223-2225-C2039-mipgensettings-editor-only.md",
];
const RECURRENCE_RAW = "recurrence-aes6-496-c2672-invoke-flushuptodatetask.md";
const KNOWLEDGE_RAW = [...C1083_RAW, ...C2039_RAW];

const fmOf = (c) => {
  const m = c.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (m) for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return fm;
};
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const walkMd = (dir) => {
  const acc = [];
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) acc.push(...walkMd(join(dir, e.name)));
    else if (e.name.endsWith(".md")) acc.push(join(dir, e.name));
  }
  return acc;
};

function validate(wikiDir, rawDir) {
  let out = "", code = 0;
  const env = { ...process.env, SKILL_ENV: join(ROOT, "no-such-env.json") };
  try { out = execFileSync("node", [SCRIPT, "--wiki", wikiDir, "--config", CFG, "--raw", rawDir], { encoding: "utf8", env }); }
  catch (e) { out = e.stdout?.toString() ?? ""; code = e.status ?? 1; }
  return { code, total: Number((out.match(/Total: ([\d.]+) \/ 10/) || [])[1] ?? 0), passed: /Status: PASS/.test(out), brokenLinks: Number((out.match(/Broken Links \((\d+)\)/) || [])[1] ?? 0) };
}

for (const gate of GATES) {
  const runDir = join(ROOT, SC, gate, "run-1");
  if (!existsSync(runDir)) continue;
  const outputs = join(runDir, "outputs");
  const wikiDir = join(outputs, "wiki");
  const rawDir = join(outputs, "wiki-raw");
  const v = validate(wikiDir, rawDir);
  const checks = [];
  const ev = (name, passed, evidence) => checks.push({ name, type: "script", passed: !!passed, evidence: evidence || "" });

  const raws = {};
  for (const f of [...KNOWLEDGE_RAW, RECURRENCE_RAW]) {
    const c = read(join(rawDir, "details", f));
    raws[f] = { fm: fmOf(c), content: c };
  }
  const detailFiles = existsSync(join(wikiDir, "details")) ? readdirSync(join(wikiDir, "details")).filter((f) => f.endsWith(".md")) : [];
  const pages = detailFiles.map((f) => ({ stem: f.replace(/\.md$/, ""), content: read(join(wikiDir, "details", f)), fm: fmOf(read(join(wikiDir, "details", f))) }));

  // 逐份 raw 找承接页：error_code 命中 + (fix 构建号 | primary_fix_commit) 命中（同 realraw 口径）
  const matched = new Map();
  for (const f of KNOWLEDGE_RAW) {
    const { fm } = raws[f];
    const code = fm.error_code ?? "";
    const fix = (fm.fix_build ?? "").split("-").pop();
    const commit = fm.primary_fix_commit ?? "";
    const hit = pages.filter((p) => p.content.includes(code) && (p.content.includes(fix) || (commit && p.content.includes(commit))));
    if (hit.length) matched.set(f, hit);
  }
  ev("6 份新知识素材各有对应承接（error_code+fix 构建号/commit 可追溯，6/6）", matched.size === 6,
    KNOWLEDGE_RAW.map((f) => `${f.replace(/^aes6-[\d-]+-/, "").slice(0, 24)}:${matched.has(f) ? "✓" : "✗"}`).join(" "));

  const page496 = read(join(wikiDir, "details", "aes6-496-c2672-invoke-flushuptodatetask.md"));
  const fm496 = fmOf(page496);
  const updated = fm496.updated ?? "";
  const trace = /recurrence|复发|v2|2026-08-17|双重指针/.test(page496);
  ev("recurrence 按回流契约处理：496 页 updated >= 2026-08-17 且复发证据留痕", updated >= "2026-08-17" && trace,
    `updated=${updated || "缺失"}，复发留痕=${trace}`);

  const c2039Pages = C2039_RAW.flatMap((f) => matched.get(f) ?? []);
  const uniq = [...new Map(c2039Pages.map((p) => [p.stem, p])).values()];
  const interlinked = uniq.filter((p) => uniq.some((q) => q !== p && p.content.includes(`[[${q.stem}`)));
  const tagged = uniq.filter((p) => /editor-only|editoronly/i.test(p.fm.tags ?? "") || /editor-only|editoronly/i.test(p.content.slice(0, 600)));
  // 枢纽形态：≥2 个家族页链到同一非种子页（可在任意目录，如 patterns/ 模式页）且该页回链 ≥2 个家族页
  // ——同根因家族的合法关联形态（iter14 without 臂实证），与直接互链/统一 tag 同等接受
  const familyPaths = new Set(uniq.map((p) => p.stem));
  const hubs = walkMd(wikiDir)
    .map((f) => ({ stem: f.replace(/\.md$/, "").split(/[\\/]/).pop(), content: read(f) }))
    .filter((h) => !SEED_DETAILS.has(`${h.stem}.md`) && !familyPaths.has(h.stem)
      && uniq.filter((p) => p.content.includes(`[[${h.stem}`)).length >= 2
      && uniq.filter((p) => h.content.includes(`[[${p.stem}`)).length >= 2);
  const connected = interlinked.length >= 2 || tagged.length === uniq.length && uniq.length >= 3 || hubs.length >= 1;
  ev("同根因家族（C2039×3）建立关联：相关页互链、统一 tag 或枢纽页联结", connected,
    `直接互链 ${interlinked.length}/${uniq.length}，editor-only 标注 ${tagged.length}/${uniq.length}，枢纽页 ${hubs.map((h) => h.stem).join(",") || "无"}`);

  ev("整理后校验 PASS（断链 0、总分 >= 9）", v.passed && v.brokenLinks === 0 && v.total >= 9, `Total=${v.total}, 断链=${v.brokenLinks}, ${v.passed ? "PASS" : "FAIL"}`);

  const logLines = read(join(wikiDir, "log.md")).split(/\r?\n/).length;
  const logGrew = logLines > read(SEED_LOG).split(/\r?\n/).length;
  const idxLinks = new Set([...read(join(wikiDir, "index.md")).matchAll(/\[\[([^\]|]+)\]\]/g)].map((m) => m[1].trim()));
  const newPages = pages.filter((p) => !SEED_DETAILS.has(`${p.stem}.md`));
  const allIndexed = newPages.every((p) => idxLinks.has(p.stem));
  ev("log 追加整理条目、index 收录全部新页", logGrew && allIndexed, `log增长=${logGrew}, 新页入index=${newPages.filter((p) => idxLinks.has(p.stem)).length}/${newPages.length}`);

  const rawsKept = KNOWLEDGE_RAW.concat([RECURRENCE_RAW]).filter((f) => existsSync(join(rawDir, "details", f))).length;
  ev("原文沉淀 raw（wiki-raw 保留 7 份素材）", rawsKept === 7, `wiki-raw 素材 ${rawsKept}/7`);

  writeFileSync(join(runDir, "grading-objective.json"), JSON.stringify({ scenario: SC, gate, validator: v, results: checks }, null, 2));
  const ok = checks.filter((c) => c.passed).length;
  console.log(`${SC} | ${gate} | Total=${v.total} PASS=${v.passed} 断链=${v.brokenLinks} | script断言 ${ok}/${checks.length}`);
}
