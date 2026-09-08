#!/usr/bin/env node
// enrich-repos.mjs — 用 gh api 为周快照里的每个仓库补元数据与 README 摘要。
// 容错：单仓库失败标记 api_ok:false 继续；gh 不可用整体 exit 2；合并后必须再过校验器。
// 熔断（仅在线模式）：gh stderr 出现限流特征，或连续多个仓整体富化失败（非个别 404），
//   视为系统性故障——拒绝写回、exit 3，宁可整周延迟也不出半富化报告；stub 离线回放的 miss 是测试语义，豁免。
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

const RATE_LIMIT_RE = /rate.?limit|abuse detection/i;
let rateLimited = false;

function ghApi(endpoint, acceptRaw = false) {
  if (args.stub) {
    // repos/o/r -> o__r.json；repos/o/r/readme -> o__r.readme.md（与 fixtures/stub 命名一致）
    const [,owner,name,source] = /^repos\/([^/]+)\/([^/?]+)(?:\/([^?]+))?/.exec(endpoint);
    const suffix = source === 'readme' ? '.readme.md' : source ? `.${source.startsWith('git/trees/') ? 'tree' : source}.json` : '.json';
    const f = join(args.stub, `${owner}__${name}${suffix}`);
    if (!existsSync(f)) return { ok: false, missing: true };
    const text = readFileSync(f, 'utf8');
    if (!acceptRaw) {
      try { if (JSON.parse(text)._error) return { ok: false, stderr: JSON.parse(text)._error }; }
      catch { return { ok: false, stderr: 'stub JSON 解析失败' }; }
    }
    return { ok: true, text };
  }
  const cmdArgs = ["api", endpoint];
  if (acceptRaw) cmdArgs.push("-H", "Accept: application/vnd.github.raw");
  const r = spawnSync("gh", cmdArgs, { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  if (r.error?.code === 'ENOENT') { console.error("gh 不可用:", r.error.message); process.exit(2); }
  if (r.error) return { ok: false, stderr: r.error.message };
  if (r.status !== 0) {
    const stderr = (r.stderr || "").slice(0, 200);
    if (RATE_LIMIT_RE.test(stderr)) rateLimited = true;
    return { ok: false, stderr };
  }
  return { ok: true, text: r.stdout };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let okCount = 0, missCount = 0, consecutiveMiss = 0;

for (const repo of doc.repos) {
  if (rateLimited) break; // 已见限流特征，不再继续烧配额
  const sourceStatus = {};
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
      delete repo.api_error;
      okCount++;
    } catch (e) {
      repo.api_ok = false;
      repo.api_error = `元数据解析失败: ${e.message}`;
      missCount++;
    }
  } else {
    repo.api_ok = false;
    repo.api_error = metaRes.missing ? "stub 无响应" : (metaRes.stderr || "gh api 失败");
    missCount++;
  }
  const rdRes = ghApi(`repos/${repo.full_name}/readme`, true);
  sourceStatus.readme = rdRes.ok;
  if (rdRes.ok) readme = rdRes.text.slice(0, maxReadme);
  // Evidence observed now is dated independently of the historical star snapshot.
  const until = new Date().toISOString();
  const since = new Date(Date.parse(until) - 90 * 86400000).toISOString();
  for (const [key, endpoint, field, project] of [
    ['tree', 'git/trees/HEAD', 'tree', m => { if (!Array.isArray(m.tree)) throw new Error('tree 非数组'); return m.tree.map(x => ({path:x.path, type:x.type, sha:x.sha})); }],
    ['contrib', 'contributors?per_page=20', 'contributors', m => m.slice(0,20).map(x => ({login:x.login, contributions:x.contributions, type:x.type}))],
    ['commit', `commits?since=${since}&until=${until}&per_page=100`, 'commits_90d', m => ({since, until, sampled:m.length, capped:m.length === 100, items:m.map(x => ({sha:x.sha, date:x.commit?.committer?.date, message:x.commit?.message?.split('\n')[0], url:x.html_url}))})],
    ['release', 'releases?per_page=3', 'releases', m => m.slice(0,3).map(x => ({tag:x.tag_name, published_at:x.published_at, prerelease:x.prerelease, url:x.html_url, body:(x.body || '').slice(0,2400)}))],
  ]) {
    const res = ghApi(`repos/${repo.full_name}/${endpoint}`);
    sourceStatus[key] = false;
    delete repo[field];
    if (res.ok) {
      try { repo[field] = project(JSON.parse(res.text)); sourceStatus[key] = true; }
      catch { /* malformed single source does not discard the other sources */ }
    }
  }
  repo.source_status = sourceStatus;
  repo.evidence_at = until;
  repo.readme_excerpt = readme;
  if (!args.stub && delay > 0) await sleep(delay);
  console.log(`${repo.api_ok ? "ok " : "miss"} #${repo.rank} ${repo.full_name} (${Object.entries(sourceStatus).map(([key,ok]) => `${ok ? '+' : '-'}${key}`).join(" ")})`);
  consecutiveMiss = repo.api_ok ? 0 : consecutiveMiss + 1;
  if (!args.stub && consecutiveMiss >= 3) break; // 连续整仓失败，疑似系统性故障
}

if (rateLimited || (!args.stub && consecutiveMiss >= 3)) {
  const reason = rateLimited ? "gh api 限流特征" : `连续 ${consecutiveMiss} 个仓库富化失败（非个别 404），疑似系统性故障`;
  console.error(`[github-trending-weekly] 富化中止：${reason}。周快照未写回（原数据未动），等待配额恢复或排查网络/gh auth 后重跑本步。`);
  process.exit(3);
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
