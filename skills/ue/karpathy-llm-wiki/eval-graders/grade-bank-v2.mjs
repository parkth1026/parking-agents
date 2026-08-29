#!/usr/bin/env node
// 题库 v2 客观评分器（ruler v2：2026-08-21 消歧引用判定放宽——作品全名 wikilink 引用亦计入；向后兼容已在 iter9~12 实证）
// iteration-11 客观评分器：4 场景 × 2 gate 的 script 型断言 → grading-objective.json（run 目录内）。
// manual 型断言由 grader subagent 出 grading-manual.json，再由 merge 步骤合成 grading.json。
// 评分尺子（validate-wiki.mjs + 技能 config.json）对 with/without_skill 一视同仁。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, basename, extname, resolve } from "node:path";
import { createHash } from "node:crypto";

const ROOT = (() => { const a = process.argv[2]; if (!a || !existsSync(a)) { console.log("用法: node grade-*.mjs <iteration目录>"); process.exit(2); } return resolve(a); })();
const SCRIPT = "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/scripts/validate-wiki.mjs";
const CFG = "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/config.json";
const SCENARIOS = ["eval-contradiction-ingest-localraw", "eval-uncovered-query-honesty", "eval-oversize-split", "eval-disambiguation-ingest-localraw"];
const GATES = ["with_skill", "without_skill"];
const CANON = ["entities", "concepts", "sources", "comparisons", "queries"];
const manifests = JSON.parse(readFileSync(join(ROOT, "seeds", "hash-manifests.json"), "utf8"));

function validate(wikiDir, rawDir) {
  const args = [SCRIPT, "--wiki", wikiDir, "--config", CFG, "--raw", rawDir];
  let out = "", code = 0;
  const env = { ...process.env, SKILL_ENV: join(ROOT, "no-such-env.json") };
  try { out = execFileSync("node", args, { encoding: "utf8", env }); }
  catch (e) { out = e.stdout?.toString() ?? ""; code = e.status ?? 1; }
  const num = (re) => Number((out.match(re) || [])[1] ?? 0);
  return {
    code,
    total: Number((out.match(/Total: ([\d.]+) \/ 10/) || [])[1] ?? null),
    passed: /Status: PASS/.test(out),
    brokenLinks: num(/Broken Links \((\d+)\)/),
    orphans: num(/Orphan Pages \((\d+)\)/),
    missingFromIndex: num(/Missing from Index \((\d+)\)/),
    frontmatterIssues: num(/Frontmatter Issues \((\d+)\)/),
    oversized: num(/Oversized Pages \((\d+)\)/),
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
const read = (p) => existsSync(p) ? readFileSync(p, "utf8") : "";
const lineCount = (s) => { const l = s.split(/\r?\n/); if (l.length && l[l.length - 1] === "") l.pop(); return l.length; };
const hashTree = (base, prefix = "") => {
  const out = {};
  if (!existsSync(base)) return out;
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (e.isDirectory()) Object.assign(out, hashTree(join(base, e.name), `${prefix}${e.name}/`));
    else out[`${prefix}${e.name}`] = createHash("sha256").update(readFileSync(join(base, e.name))).digest("hex");
  }
  return out;
};
const fmOf = (content) => {
  const m = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (m) for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return fm;
};
const canonPages = (wikiDir) => {
  const pages = [];
  for (const d of CANON) {
    const dir = join(wikiDir, d);
    if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith(".md")) pages.push({ dir: d, stem: f.replace(/\.md$/, ""), file: join(dir, f) });
  }
  return pages;
};

const results = {};
for (const sc of SCENARIOS) {
  results[sc] = {};
  for (const gate of GATES) {
    const runDir = join(ROOT, sc, gate, "run-1");
    const outputs = join(runDir, "outputs");
    const wikiDir = join(outputs, "wiki");
    const rawDir = join(outputs, "wiki-raw");
    const c = {};
    const ev = (name, passed, evidence) => { c[name] = { passed: !!passed, evidence: evidence || "" }; };
    const v = validate(wikiDir, rawDir);
    const seedWiki = manifests[sc].seedWiki;
    const nowWiki = hashTree(wikiDir);
    const newPages = canonPages(wikiDir).filter((p) => !(seedWiki[`${p.dir}/${p.stem}.md`] || seedWiki[`${p.dir}\\${p.stem}.md`]));
    const logNow = read(join(wikiDir, "log.md"));
    const logGrew = lineCount(logNow) > lineCount(read(join(ROOT, "seeds", sc.replace(/^eval-/, "").replace("-localraw", "") + "-wiki", "log.md")));
    const idxLinks = new Set([...read(join(wikiDir, "index.md")).matchAll(/\[\[([^\]|]+)\]\]/g)].map((m) => m[1].trim()));

    if (sc === "eval-contradiction-ingest-localraw") {
      const gpt3 = read(join(wikiDir, "concepts", "GPT-3.md"));
      const both = /175/.test(gpt3) && /170/.test(gpt3);
      const srcRef = /GPT-3 Paper|Language Models are Few-Shot/i.test(gpt3) && /Vetokhin|How Many Parameters|counting methodology|blog/i.test(gpt3);
      ev("矛盾双记录：GPT-3 页同时保留 175B 与 ~170B 且各自归属来源", both && srcRef,
        both ? `数字双保留；来源引用=${srcRef}` : `175=${/175/.test(gpt3)} 170=${/170/.test(gpt3)}`);
      const srcNew = newPages.filter((p) => p.dir === "sources");
      const srcFm = srcNew.length ? fmOf(read(srcNew[0].file)) : {};
      ev("新 source 页建立（type: source，含 takeaways）", srcNew.length >= 1 && srcFm.type === "source", srcNew.map((p) => `${p.stem} (type=${srcFm.type})`).join(", ") || "sources/ 无新页");
      ev("处理后校验 PASS（断链 0、总分 >= 9）", v.passed && v.brokenLinks === 0 && v.total >= 9, `Total=${v.total}, 断链=${v.brokenLinks}, ${v.passed ? "PASS" : "FAIL"}`);
      const raws = walkMd(rawDir);
      ev("原文沉淀 raw（wiki-raw 有素材文件）", raws.length >= 1, raws.map((f) => basename(f)).join(", ") || "raw 无文件");
      ev("log 追加 ingest 条目、index 收录新页", logGrew && v.missingFromIndex === 0 && newPages.every((p) => idxLinks.has(p.stem)), `log增长=${logGrew}, 漏index=${v.missingFromIndex}`);
      const upd = fmOf(gpt3).updated;
      ev("GPT-3 页 updated >= 新证据日期 2024-11-02（页面不早于其证据）", !!upd && upd >= "2024-11-02", `updated=${upd || "缺失"}`);
    }

    if (sc === "eval-uncovered-query-honesty") {
      const comp = existsSync(join(wikiDir, "comparisons")) ? readdirSync(join(wikiDir, "comparisons")).filter((f) => f.endsWith(".md")) : [];
      ev("不建 comparisons/ 伪存档页", comp.length === 0, comp.join(", ") || "comparisons/ 无页面");
      ev("log 记录查询条目", logGrew, logGrew ? "log 有追加" : "log 未追加");
      const nowConcepts = Object.fromEntries(Object.entries(nowWiki).filter(([k]) => k.startsWith("concepts/")));
      const seedConcepts = Object.fromEntries(Object.entries(seedWiki).filter(([k]) => k.startsWith("concepts/")));
      const changed = [...new Set([...Object.keys(seedConcepts), ...Object.keys(nowConcepts)])].filter((k) => nowConcepts[k] !== seedConcepts[k]);
      ev("既有 concepts 页零改动（哈希一致）", changed.length === 0, changed.join(", ") || "哈希一致");
      const answer = read(join(outputs, "final-answer.md")) || read(join(outputs, "answer.md"));
      const refsPage = /\[\[[^\]]+\]\]|Attention Mechanism|Transformer/i.test(answer);
      ev("答复引用既有页面（[[wikilink]] 或页面名）", refsPage, (answer.match(/\[\[([^\]]+)\]\]/g) || ["Attention Mechanism/Transformer 文本引用"]).slice(0, 5).join(" "));
    }

    if (sc === "eval-oversize-split") {
      const plog = read(join(outputs, "process-log.md"));
      const discovery = (plog + walkMd(outputs).filter((f) => /report|lint|校验|体检/i.test(basename(f))).map((f) => read(f)).join("\n")).slice(0, 200000);
      const found = /oversiz|too long|exceed|超(大|限|过)|行数|lines?\s*\(?\s*(max|>|over)/i.test(discovery) && /Transformer/i.test(discovery);
      ev("超限问题被发现（过程证据提及超大/行数问题并点名页面）", found, found ? "process-log/报告提及" : "未见发现证据");
      const pageFiles = canonPages(wikiDir).map((p) => p.file);
      const tooBig = pageFiles.filter((f) => lineCount(read(f)) > 200).map(basename);
      ev("拆分后全部页面 <= 200 行", tooBig.length === 0, tooBig.join(", ") || `最大页 ${Math.max(...pageFiles.map((f) => lineCount(read(f))))} 行`);
      ev("拆分后校验 PASS（断链 0、总分 >= 9）", v.passed && v.brokenLinks === 0 && v.total >= 9, `Total=${v.total}, 断链=${v.brokenLinks}, oversized=${v.oversized}`);
      const tfFile = [...pageFiles, join(wikiDir, "concepts", "Transformer.md")].find((f) => existsSync(f) && /Transformer(\.md|$)/.test(f) && lineCount(read(f)) <= 200 && lineCount(read(f)) > 5);
      const tfContent = tfFile ? read(tfFile) : "";
      const newStems = newPages.map((p) => p.stem);
      const parentLinks = newStems.filter((s) => new RegExp(`\\[\\[${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(tfContent));
      const childLinksBack = newPages.filter((p) => /\[\[Transformer(\]\]|\|)/.test(read(p.file)));
      ev("父子页面互链（概览链子页、子页链回）", parentLinks.length >= 1 && childLinksBack.length >= 1,
        `父链子=[${parentLinks.join(",")}] 子链父=${childLinksBack.length}/${newPages.length}`);
      ev("index 收录全部页面、log 记录 lint 与修复", v.missingFromIndex === 0 && logGrew, `漏index=${v.missingFromIndex}, log增长=${logGrew}`);
    }

    if (sc === "eval-disambiguation-ingest-localraw") {
      const pages = canonPages(wikiDir);
      const stems = pages.map((p) => p.stem);
      const dup = stems.filter((s, i) => stems.indexOf(s) !== i);
      const srcAttention = existsSync(join(wikiDir, "sources", "Attention.md"));
      ev("sources/ 无与 concepts/Attention.md 同名 basename 的页面（消歧执行）", !srcAttention && !dup.includes("Attention"),
        srcAttention ? "sources/Attention.md 存在（冲突未消歧）" : dup.length ? `同名 basename: ${dup.join(",")}` : "无冲突 basename");
      const att = read(join(wikiDir, "concepts", "Attention.md"));
      const attChanged = nowWiki["concepts/Attention.md"] !== seedWiki["concepts/Attention.md"];
      // ruler v2（2026-08-21）：引用判定放宽——除作者/日期/medium 关键词外，链到任一新 source 页（wikilink 或 frontmatter 提及）亦计入；向后兼容已在 iter9~11 实证
      const newSrcStems = newPages.filter((p) => p.dir === "sources").map((p) => p.stem);
      const attRefsNew = /Vetokhin|Bogolin|2024-03-18|Attention \(blog\)|medium/i.test(att)
        || newSrcStems.some((st) => att.includes(`[[${st}`) || (fmOf(att).sources ?? "").includes(st));
      ev("既有 Attention 概念页被更新（含新来源引用）而非被绕开", attChanged && attRefsNew, `页面更新=${attChanged}, 新来源引用=${attRefsNew}`);
      ev("断链 0、校验 PASS", v.brokenLinks === 0 && v.passed, `断链=${v.brokenLinks}, Total=${v.total}, ${v.passed ? "PASS" : "FAIL"}`);
      const raws = walkMd(rawDir);
      ev("原文沉淀 raw（wiki-raw 有素材文件）", raws.length >= 1, raws.map((f) => basename(f)).join(", ") || "raw 无文件");
      ev("log 追加 ingest 条目、index 收录新页", logGrew && v.missingFromIndex === 0 && newPages.every((p) => idxLinks.has(p.stem)), `log增长=${logGrew}, 漏index=${v.missingFromIndex}`);
    }

    results[sc][gate] = { validator: v, checks: c };
    const checksJson = Object.entries(c).map(([name, r]) => ({ name, type: "script", ...r }));
    writeFileSync(join(runDir, "grading-objective.json"), JSON.stringify({ scenario: sc, gate, validator: v, results: checksJson }, null, 2));
  }
}

console.log("scenario | gate | Total | PASS | 断链 | script断言");
for (const sc of SCENARIOS) for (const gate of GATES) {
  const r = results[sc][gate];
  const ok = Object.values(r.checks).filter((x) => x.passed).length;
  const total = Object.keys(r.checks).length;
  console.log(`${sc} | ${gate} | ${r.validator.total} | ${r.validator.passed} | ${r.validator.brokenLinks} | ${ok}/${total}`);
}
