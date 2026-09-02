#!/usr/bin/env node
// enrich-repos.mjs — 用 gh api 为周快照里的每个仓库补元数据与 README 摘要。
// 容错：单仓库失败标记 api_ok:false 继续；gh 不可用整体 exit 2；合并后必须再过校验器。
// 用法:
//   node enrich-repos.mjs [--workspace <dir>] [--week YYYY-Www] [--max-readme 2500] [--delay 150]
//                         [--stub <dir>]   ← 离线回放：从目录读 {owner}__{repo}.json / .readme.md
// --workspace 省略时走配置链（lib/config.mjs）。
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parseArgs, paths, repoFileName, fatal } from "./lib/util.mjs";
import { resolveWorkspace } from "./lib/config.mjs";
import { validateWeek } from "./lib/validate.mjs";

const args = parseArgs(process.argv.slice(2), {
  workspace: {},
  week: {},
  "max-readme": { default: "2500" },
  delay: { default: "150" },
  stub: {},
});
const maxReadme = Number(args["max-readme"]);
const delay = Number(args.delay);

function latestWeek(p) {
  const files = readdirSync(p.weeks).filter((f) => /^\d{4}-W\d{2}\.json$/.test(f)).sort();
  if (!files.length) fatal(`data/weeks 下没有周快照，先跑 fetch-trending`);
  return files.at(-1).replace(".json", "");
}
const p = paths(resolveWorkspace(args.workspace));
const week = args.week ?? latestWeek(p);
const weekFile = join(p.weeks, `${week}.json`);
if (!existsSync(weekFile)) fatal(`周快照不存在: ${weekFile}`);
const doc = JSON.parse(readFileSync(weekFile, "utf8"));

function ghApi(endpoint, acceptRaw = false) {
  if (args.stub) {
    // repos/o/r -> o__r.json；repos/o/r/readme -> o__r.readme.md（与 fixtures/stub 命名一致）
    const key = endpoint.replace(/^repos\//, "").replace(/\/readme$/, "").replace(/\//g, "__");
    const f = acceptRaw ? join(args.stub, `${key}.readme.md`) : join(args.stub, `${key}.json`);
    if (!existsSync(f)) return { ok: false, missing: true };
    return { ok: true, text: readFileSync(f, "utf8") };
  }
  const cmdArgs = ["api", endpoint];
  if (acceptRaw) cmdArgs.push("-H", "Accept: application/vnd.github.raw");
  const r = spawnSync("gh", cmdArgs, { encoding: "utf8", windowsHide: true });
  if (r.error) { console.error("gh 不可用:", r.error.message); process.exit(2); }
  if (r.status !== 0) return { ok: false, stderr: (r.stderr || "").slice(0, 200) };
  return { ok: true, text: r.stdout };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let okCount = 0, missCount = 0;

for (const repo of doc.repos) {
  const metaRes = ghApi(`repos/${repo.full_name}`);
  let readme = "";
  if (metaRes.ok) {
    try {
      const m = JSON.parse(metaRes.text);
      repo.description = typeof m.description === "string" && m.description ? m.description : repo.description;
      repo.language = m.language ?? repo.language;
      repo.topics = Array.isArray(m.topics) ? m.topics : [];
      repo.homepage = typeof m.homepage === "string" ? m.homepage : "";
      repo.created_at = m.created_at;
      repo.pushed_at = m.pushed_at;
      repo.forks = Number.isInteger(m.forks_count) ? m.forks_count : repo.forks;
      repo.open_issues = Number.isInteger(m.open_issues_count) ? m.open_issues_count : null;
      repo.license = m.license?.spdx_id ?? null;
      repo.stars_api = Number.isInteger(m.stargazers_count) ? m.stargazers_count : null;
      repo.api_ok = true;
      okCount++;
    } catch (e) {
      repo.api_ok = false;
      repo.api_error = `元数据解析失败: ${e.message}`;
      missCount++;
    }
    const rdRes = ghApi(`repos/${repo.full_name}/readme`, true);
    if (rdRes.ok) readme = rdRes.text.slice(0, maxReadme);
  } else {
    repo.api_ok = false;
    repo.api_error = metaRes.missing ? "stub 无响应" : (metaRes.stderr || "gh api 失败");
    missCount++;
  }
  repo.readme_excerpt = readme;
  if (!args.stub && delay > 0) await sleep(delay);
  console.log(`${repo.api_ok ? "ok " : "miss"} #${repo.rank} ${repo.full_name}${readme ? " (+readme)" : ""}`);
}

const errs = validateWeek(doc, { expectedCount: doc.repos.length });
if (errs.length) {
  errs.forEach((e) => console.error(`合并后校验失败: ${e}`));
  fatal("enrich 产物未通过校验，拒绝写回（原周快照未动）");
}
doc.enriched_at = new Date().toISOString();
writeFileSync(weekFile, JSON.stringify(doc, null, 2));
console.log(`OK  ${week}  富化完成  api_ok=${okCount}  miss=${missCount}  →  ${weekFile}`);
if (missCount > 0) console.log(`提示: ${missCount} 个仓库富化失败（404/限流），报告仍可生成，缺 topics/readme`);
