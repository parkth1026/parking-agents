#!/usr/bin/env node
// iteration-12 客观评分器：eval-realraw-ingest 专项（真实语料整理）。
// 评分尺子（validate-wiki.mjs + 技能 config）对两臂一视同仁。
// ruler v3（2026-08-23）：① 脚本/配置路径 import.meta.url 相对解析（换机可跑）；
// ② logGrew 由「>8 行」硬编码改为与 fixtures-realraw 冻结种子 log（manifest 哈希锁定）行数比对。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = (() => { const a = process.argv[2]; if (!a || !existsSync(a)) { console.log("用法: node grade-*.mjs <iteration目录>"); process.exit(2); } return resolve(a); })();
const SC = "eval-realraw-ingest";
const SCRIPT = join(HERE, "..", "scripts", "validate-wiki.mjs");
const CFG = join(HERE, "..", "config.json");
const SEED_LOG = join(HERE, "..", "fixtures-realraw", "wiki-seed", "log.md");
const GATES = ["with_skill", "without_skill"];
const SEED_DETAILS = new Set(["024-asset-version-mismatch.md", "002-lnk2019-fearthmaterialparametersbakerfragment.md"]);
const KNOWLEDGE_RAW = [
  "aes6-377-379-LNK2038-boost-typeindex-rtti.md",
  "aes6-614-619-LNK2019-forceinline-outofline-def.md",
  "aes6-563-564-LNK2019-builder-impl-lost-in-module-merge.md",
  "aes6-2125-C1083-filehelpers-include-unguarded.md",
  "aes6-1876-1880-MissingPlugin-chaosvehicles-not-referenced.md",
];
const RECURRENCE_RAW = "recurrence-024-asset-version-mismatch.md";

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

function validate(wikiDir, rawDir) {
  let out = "", code = 0;
  const env = { ...process.env, SKILL_ENV: join(ROOT, "no-such-env.json") };
  try { out = execFileSync("node", [SCRIPT, "--wiki", wikiDir, "--config", CFG, "--raw", rawDir], { encoding: "utf8", env }); }
  catch (e) { out = e.stdout?.toString() ?? ""; code = e.status ?? 1; }
  return { code, total: Number((out.match(/Total: ([\d.]+) \/ 10/) || [])[1] ?? 0), passed: /Status: PASS/.test(out), brokenLinks: Number((out.match(/Broken Links \((\d+)\)/) || [])[1] ?? 0) };
}

for (const gate of GATES) {
  const runDir = join(ROOT, SC, gate, "run-1");
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
  const newPages = detailFiles.filter((f) => !SEED_DETAILS.has(f)).map((f) => ({ stem: f.replace(/\.md$/, ""), content: read(join(wikiDir, "details", f)), fm: fmOf(read(join(wikiDir, "details", f))) }));

  // 逐份 raw 找承接页：error_code 命中 + (fix 构建号 | primary_fix_commit) 命中
  const matched = new Map();
  for (const f of KNOWLEDGE_RAW) {
    const { fm } = raws[f];
    const code = fm.error_code ?? "";
    const fix = (fm.fix_build ?? "").split("-").pop();
    const commit = fm.primary_fix_commit ?? "";
    const hit = newPages.filter((p) => p.content.includes(code) && (p.content.includes(fix) || (commit && p.content.includes(commit))));
    if (hit.length) matched.set(f, hit);
  }
  ev("5 份新知识素材各有对应 details/ 新页（覆盖 5/5）", matched.size === 5,
    [...KNOWLEDGE_RAW.map((f) => `${f.replace(/^aes6-[\d-]+-/, "").slice(0, 24)}:${matched.has(f) ? "✓" : "✗"}`)].join(" "));

  const traced = [...matched.values()].flat().filter((p) => /#\d{3,4}|fix|commit/i.test(p.content)).length;
  ev("新页内容可追溯 raw 来源（含 fix 构建号或 primary_fix_commit）", traced >= 5, `可追溯新页 ${traced}/${newPages.length}`);

  const codeHits = KNOWLEDGE_RAW.filter((f) => (matched.get(f) ?? []).some((p) => p.content.includes(raws[f].fm.error_code ?? "###"))).length;
  ev("每份新素材的 error_code 在对应新页可寻（LNK2038/LNK2019×2/C1083/MissingPlugin）", codeHits === 5, `error_code 命中 ${codeHits}/5`);

  const page024 = read(join(wikiDir, "details", "024-asset-version-mismatch.md"));
  const fm024 = fmOf(page024);
  const updated = fm024.updated ?? "";
  const recurrenceTrace = /recurrence|复发|第 ?9 ?次|2026-08-20/.test(page024);
  ev("recurrence 按回流契约处理：024 页 updated >= 2026-08-20 且复发证据留痕", updated >= "2026-08-20" && recurrenceTrace,
    `updated=${updated || "缺失"}，复发留痕=${recurrenceTrace}`);

  ev("整理后校验 PASS（断链 0、总分 >= 9）", v.passed && v.brokenLinks === 0 && v.total >= 9, `Total=${v.total}, 断链=${v.brokenLinks}, ${v.passed ? "PASS" : "FAIL"}`);

  const logLines = read(join(wikiDir, "log.md")).split(/\r?\n/).length;
  const seedLogLines = read(SEED_LOG).split(/\r?\n/).length;
  const logGrew = logLines > seedLogLines;
  const idxLinks = new Set([...read(join(wikiDir, "index.md")).matchAll(/\[\[([^\]|]+)\]\]/g)].map((m) => m[1].trim()));
  const allIndexed = newPages.every((p) => idxLinks.has(p.stem));
  ev("log 追加整理条目、index 收录全部新页", logGrew && allIndexed, `log增长=${logGrew}, 新页入index=${newPages.filter((p) => idxLinks.has(p.stem)).length}/${newPages.length}`);

  const linkerPages = ["aes6-377-379-LNK2038-boost-typeindex-rtti.md", "aes6-614-619-LNK2019-forceinline-outofline-def.md", "aes6-563-564-LNK2019-builder-impl-lost-in-module-merge.md"].flatMap((f) => matched.get(f) ?? []);
  const interlinked = linkerPages.filter((p) => linkerPages.some((q) => q !== p && (p.content.includes(`[[${q.stem}`) || p.content.includes(`[[${q.stem.toLowerCase()}`))));
  const tagged = linkerPages.filter((p) => /linker-error/i.test(p.fm.tags ?? "") || /linker-error/i.test(p.content.slice(0, 600)));
  ev("linker 类新页建立关联（互链或统一 linker-error 类 tag）", interlinked.length >= 2 || tagged.length === 3,
    `互链页 ${interlinked.length}/3，linker-error 标注 ${tagged.length}/3`);

  writeFileSync(join(runDir, "grading-objective.json"), JSON.stringify({ scenario: SC, gate, validator: v, results: checks }, null, 2));
  const ok = checks.filter((c) => c.passed).length;
  console.log(`${SC} | ${gate} | Total=${v.total} PASS=${v.passed} 断链=${v.brokenLinks} | script断言 ${ok}/${checks.length}`);
}
