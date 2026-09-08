#!/usr/bin/env node
// lint-analysis.mjs — 四字段分析的格式层 lint（Step 5 写作完成条件自检）。
// 只判机器可判口径：每仓四字段行齐全、定位 2–4 句、为什么爆不复述行内星数、
// nicheTags 受控（1–3 项）、生态位以「同类：<具体竞品名>」开头。违规 exit 1，全绿 exit 0。
// lint 绿不替代用户对当期分析的全读裁决（AC-007）：拦的是格式漂移，不判内容洞察。
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs, paths, fatal } from "./lib/util.mjs";
import { resolveWorkspace } from "./lib/config.mjs";
import { NICHE_TAGS } from "./lib/analysis.mjs";

const args = parseArgs(process.argv.slice(2), { workspace: {}, week: {} });
const p = paths(resolveWorkspace(args.workspace));
const files = readdirSync(p.weeks).filter((f) => /^\d{4}-W\d{2}\.json$/.test(f)).sort();
if (!files.length) fatal("data/weeks 下没有周快照，先跑 fetch-trending");
const week = args.week ?? files.at(-1).replace(".json", "");
const weekFile = join(p.weeks, `${week}.json`);
if (!existsSync(weekFile)) fatal(`周快照不存在: ${weekFile}`);
const analysisFile = join(p.weeks, `${week}.analysis.md`);
if (!existsSync(analysisFile)) fatal(`分析文件不存在: ${analysisFile}（缺分析仍能出报告，但 lint 需要它）`);
const doc = JSON.parse(readFileSync(weekFile, "utf8"));
const text = readFileSync(analysisFile, "utf8");

const violations = [];
const push = (name, msg) => violations.push(`${name}：${msg}`);

// 行内星数复述检测：裸数 / 千分位 / 万化（1–2 位小数），仅查 ≥1000 的星数，避免误伤小数字日常用语
function echoedStar(str, repo) {
  for (const num of [repo.stars_week, repo.stars_total]) {
    if (!Number.isSafeInteger(num) || num < 1000) continue;
    const wan = num / 10000;
    const variants = [String(num), num.toLocaleString("en-US"), `${wan.toFixed(1)}万`, `${wan.toFixed(2)}万`];
    for (const v of variants) if (str.includes(v)) return num;
  }
  return null;
}

const seen = new Set();
for (const section of text.split(/^### /m).slice(1)) {
  const name = /^([\w.-]+\/[\w.-]+)(?:\s|$)/.exec(section)?.[1];
  if (!name) continue;
  seen.add(name);
  const repo = doc.repos.find((r) => r.full_name === name);
  if (!repo) { push(name, "分析里的仓库不在本周快照中"); continue; }
  const lines = section.split(/\r?\n/);
  const fieldLine = (label) => lines.find((l) => l.startsWith(`- **${label}**：`));
  const value = (label) => { const l = fieldLine(label); return l ? l.slice(l.indexOf("：") + 1).trim() : null; };

  for (const label of ["定位", "为什么爆", "可信度", "nicheTags", "生态位"]) if (!fieldLine(label)) push(name, `缺「${label}」字段行`);

  const pos = value("定位");
  if (pos) {
    const sentences = (pos.match(/[。；！？]/g) || []).length;
    if (sentences < 2 || sentences > 5) push(name, `定位 ${sentences} 句（口径 2–4，至多 5）`);
  }
  const why = value("为什么爆");
  if (why) { const hit = echoedStar(why, repo); if (hit) push(name, `为什么爆复述行内星数 ${hit}`); }

  const tagLine = value("nicheTags");
  if (tagLine !== null) {
    try {
      const tags = JSON.parse(tagLine);
      if (!Array.isArray(tags) || tags.length < 1 || tags.length > 3) push(name, "nicheTags 应为 1–3 项数组");
      else for (const t of tags) if (!NICHE_TAGS.includes(t)) push(name, `nicheTags 未受控: ${t}`);
    } catch { push(name, "nicheTags 不是合法 JSON 数组"); }
  }

  const niche = value("生态位");
  if (niche && !/^同类：\S/.test(niche)) push(name, "生态位应以「同类：<具体竞品名>」开头");
}
for (const r of doc.repos) if (!seen.has(r.full_name)) push(r.full_name, "本周快照有仓但分析未覆盖");

console.log(`lint-analysis ${week}：${doc.repos.length} 仓，${violations.length} 处违规`);
violations.forEach((v) => console.log("  违规  " + v));
if (violations.length) {
  console.error("格式层 lint 未过（见上）；修完重跑。lint 绿不替代用户全读裁决。");
  process.exit(1);
}
console.log("  格式层全绿（仅代表格式口径，内容质量仍由用户全读当期分析裁决）");
