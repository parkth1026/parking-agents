#!/usr/bin/env node
// validate-week.mjs — 数据门禁：校验周快照与历史文件结构；--full 追加周↔历史咬合检查。
// 用法:
//   node validate-week.mjs --workspace <dir> [--week YYYY-Www] [--full]
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs, paths, repoFileName, fatal } from "./lib/util.mjs";
import { validateWeek, validateHistory, crossCheckWeekHistory } from "./lib/validate.mjs";

const args = parseArgs(process.argv.slice(2), {
  workspace: { default: "." },
  week: {},
  full: { flag: true },
});
const p = paths(args.workspace);

function weekIds() {
  if (args.week) return [args.week];
  return readdirSync(p.weeks).filter((f) => /^\d{4}-W\d{2}\.json$/.test(f)).map((f) => f.replace(".json", "")).sort();
}
const ids = weekIds();
if (!ids.length) fatal("没有可校验的周快照");

let totalErrs = 0;
for (const id of ids) {
  const weekFile = join(p.weeks, `${id}.json`);
  const doc = JSON.parse(readFileSync(weekFile, "utf8"));
  const errs = validateWeek(doc, { expectedCount: doc.repos.length });
  if (args.full) {
    for (const repo of doc.repos) {
      const hf = join(p.repos, repoFileName(repo.full_name));
      if (!existsSync(hf)) { errs.push(`${repo.full_name} 缺历史文件 ${hf}`); continue; }
      const hist = JSON.parse(readFileSync(hf, "utf8"));
      errs.push(...validateHistory(hist).map((e) => `${repo.full_name}: ${e}`));
      errs.push(...crossCheckWeekHistory(doc, hist).map((e) => `${repo.full_name}: ${e}`));
    }
  }
  if (errs.length) {
    totalErrs += errs.length;
    console.error(`FAIL ${id}`);
    errs.forEach((e) => console.error(`  - ${e}`));
  } else {
    console.log(`PASS ${id}${args.full ? "  (full)" : ""}  ${doc.repos.length} repos`);
  }
}
if (totalErrs) fatal(`共 ${totalErrs} 条校验错误`);
console.log("OK  全部通过");
