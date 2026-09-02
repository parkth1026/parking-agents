#!/usr/bin/env node
// update-history.mjs — 累计每仓库星数历史，分类 new/recurring/returning，算周环比。幂等：重跑替换同周快照。
// 用法:
//   node update-history.mjs --workspace <dir> [--week YYYY-Www]
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs, paths, prevWeekId, repoFileName, fatal } from "./lib/util.mjs";
import { validateWeek, validateHistory, crossCheckWeekHistory } from "./lib/validate.mjs";

const args = parseArgs(process.argv.slice(2), {
  workspace: { default: "." },
  week: {},
});

function latestWeek(p) {
  const files = readdirSync(p.weeks).filter((f) => /^\d{4}-W\d{2}\.json$/.test(f)).sort();
  if (!files.length) fatal(`data/weeks 下没有周快照，先跑 fetch-trending`);
  return files.at(-1).replace(".json", "");
}
const p = paths(args.workspace);
const week = args.week ?? latestWeek(p);
const weekFile = join(p.weeks, `${week}.json`);
if (!existsSync(weekFile)) fatal(`周快照不存在: ${weekFile}`);
const doc = JSON.parse(readFileSync(weekFile, "utf8"));
const errs = validateWeek(doc, { expectedCount: doc.repos.length });
if (errs.length) { errs.forEach((e) => console.error(e)); fatal("周快照未通过校验，拒绝更新历史"); }

const prevWeek = prevWeekId(week);
const summary = { new: [], recurring: [], returning: [] };

for (const repo of doc.repos) {
  const file = join(p.repos, repoFileName(repo.full_name));
  const existed = existsSync(file);
  let hist = existed
    ? JSON.parse(readFileSync(file, "utf8"))
    : { schema: "repo-history/1", full_name: repo.full_name, first_seen_week: week, snapshots: [] };
  if (existed) {
    const hErrs = validateHistory(hist);
    if (hErrs.length) { hErrs.forEach((e) => console.error(e)); fatal(`历史文件损坏: ${file}`); }
  }

  // 分类与环比先于快照追加（依据既有历史）
  const prior = hist.snapshots.filter((s) => s.week !== week);
  const lastSeen = prior.at(-1)?.week;
  repo.entry_status = prior.length === 0 ? "new" : lastSeen === prevWeek ? "recurring" : "returning";
  if (prior.length > 0) {
    repo.stars_prev = prior.at(-1).stars_total;
    repo.stars_delta = repo.stars_total - repo.stars_prev;
  } else {
    delete repo.stars_prev;
    delete repo.stars_delta;
  }

  // 追加/替换本周快照（幂等）
  const snap = { week, date: doc.captured_at, rank: repo.rank, stars_total: repo.stars_total, stars_week: repo.stars_week };
  const idx = hist.snapshots.findIndex((s) => s.week === week);
  if (idx >= 0) hist.snapshots[idx] = snap; else hist.snapshots.push(snap);
  hist.snapshots.sort((a, b) => a.week.localeCompare(b.week));
  hist.last_seen_week = week;
  const xErrs = validateHistory(hist).concat(crossCheckWeekHistory(doc, hist));
  if (xErrs.length) { xErrs.forEach((e) => console.error(e)); fatal(`更新后历史不合法: ${file}`); }
  writeFileSync(file, JSON.stringify(hist, null, 2));

  summary[repo.entry_status].push(`${repo.full_name}#${repo.rank}`);
}

writeFileSync(weekFile, JSON.stringify(doc, null, 2));
console.log(`OK  ${week}  历史已更新（新晋 ${summary.new.length} / 常驻 ${summary.recurring.length} / 回锅 ${summary.returning.length}）`);
for (const [k, list] of Object.entries(summary)) {
  if (list.length) console.log(`  ${k}: ${list.join(", ")}`);
}
