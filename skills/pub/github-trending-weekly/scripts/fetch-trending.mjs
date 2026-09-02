#!/usr/bin/env node
// fetch-trending.mjs — 抓取 GitHub Trending（weekly）并解析为周快照 JSON。
// 门禁：解析与结构校验任何一条不过即 exit 1，不写半成品数据。
// 用法:
//   node fetch-trending.mjs --workspace <dir> [--top 20] [--since weekly] [--html <file>] [--week YYYY-Www]
// --html 走离线 fixture（测试/回放），默认在线抓取。
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isoWeekId, parseArgs, paths, fatal } from "./lib/util.mjs";
import { parseTrending } from "./lib/parse-html.mjs";
import { validateWeek } from "./lib/validate.mjs";

const args = parseArgs(process.argv.slice(2), {
  workspace: { default: "." },
  top: { default: "20" },
  since: { default: "weekly" },
  html: {},
  week: {},
});

const top = Number(args.top);
if (!Number.isInteger(top) || top < 1 || top > 25) fatal(`--top 取值非法: ${args.top}`);

async function getHtml() {
  if (args.html) {
    console.log(`离线模式: 读取 ${args.html}`);
    return readFileSync(args.html, "utf8");
  }
  const url = `https://github.com/trending?since=${encodeURIComponent(args.since)}`;
  console.log(`抓取 ${url} …`);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) fatal(`HTTP ${res.status} ${res.statusText}——疑似限流，稍后重试`);
  return res.text();
}

const html = await getHtml();

let repos;
try {
  repos = parseTrending(html, top);
} catch (e) {
  fatal(`解析失败: ${e.message}`);
}

const week = args.week ?? isoWeekId(new Date());
const doc = {
  schema: "trending-week/1",
  week,
  captured_at: new Date().toISOString(),
  source: args.html ? "offline" : "live",
  since: args.since,
  repos,
};
const errs = validateWeek(doc, { expectedCount: top });
if (errs.length) {
  errs.forEach((e) => console.error(`校验失败: ${e}`));
  fatal("周快照未通过结构校验，已拒绝写入");
}

const p = paths(args.workspace);
const file = join(p.weeks, `${week}.json`);
writeFileSync(file, JSON.stringify(doc, null, 2));
console.log(`OK  ${week}  ${repos.length} 个仓库  →  ${file}`);
console.log(`第 1 名: ${repos[0].full_name}  本周 +${repos[0].stars_week}  总 ${repos[0].stars_total}`);
