#!/usr/bin/env node
// build-report.mjs — 汇总全部周快照生成 report/data.js + report/index.html（viewer 从 assets 拷贝）。
// analysis.md 存在则内联为该周分析文本；缺失时照常生成（管线不依赖 LLM）。
// 用法:
//   node build-report.mjs [--workspace <dir>] [--readme-cap 900]   ← workspace 省略走配置链（lib/config.mjs）
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, paths, fatal } from "./lib/util.mjs";
import { resolveWorkspace } from "./lib/config.mjs";
import { buildPayload } from "./lib/report-data.mjs";

const args = parseArgs(process.argv.slice(2), {
  workspace: {},
  "readme-cap": { default: "900" },
});
const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/ 的上级 = 技能根
const p = paths(resolveWorkspace(args.workspace));

let payload;
try {
  payload = buildPayload(p.weeks, { readmeCap: Number(args["readme-cap"]) });
} catch (e) {
  fatal(e.message);
}
mkdirSync(p.report, { recursive: true });
const dataFile = join(p.report, "data.js");
writeFileSync(dataFile, `window.TRENDING_DATA = ${JSON.stringify(payload)};\n`);
const htmlFile = join(p.report, "index.html");
const viewerSrc = join(SKILL_DIR, "assets", "viewer.html");
if (!existsSync(viewerSrc)) fatal(`viewer 模板缺失: ${viewerSrc}`);
copyFileSync(viewerSrc, htmlFile);

const analyzed = payload.weeks.filter((w) => w.analysis).length;
console.log(`OK  ${payload.weeks.length} 周（含分析 ${analyzed}）  →  ${dataFile}`);
console.log(`    viewer: ${htmlFile}（双击打开，离线可用；或跑 serve.mjs 走 http）`);
