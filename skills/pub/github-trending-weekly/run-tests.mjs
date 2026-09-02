#!/usr/bin/env node
// run-tests.mjs — github-trending-weekly 的离线回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒执行（spawnSync 跑脚本再比对输出/产物），退出码 0=全过/1=有失败；
//       fixtures/ 放黄金输入（真实 HTML 快照 + gh api 响应回放），全部离线，不碰网络。
// 断言 ↔ 验收条件（references/design.md AC-1..AC-8）映射见各测试节标题。
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(SKILL_DIR, "scripts");
const FIXTURES = join(SKILL_DIR, "fixtures");
const ROOT_WS = mkdtempSync(join(tmpdir(), "gtw-test-"));

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}
function run(script, args) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { encoding: "utf8", windowsHide: true });
  return { status: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
}
function mkws(name) {
  const ws = join(ROOT_WS, name);
  mkdirSync(join(ws, "data", "weeks"), { recursive: true });
  mkdirSync(join(ws, "data", "repos"), { recursive: true });
  return ws;
}
function mkRepo(rank, name, starsTotal, starsWeek) {
  return { rank, full_name: name, url: `https://github.com/${name}`, description: `desc of ${name}`,
    language: "Rust", stars_total: starsTotal, stars_week: starsWeek, forks: 1 };
}
function mkWeek(week, repos) {
  return { schema: "trending-week/1", week, captured_at: "2026-08-31T01:00:00.000Z", source: "offline",
    since: "weekly", repos };
}
const writeWeek = (ws, doc) => writeFileSync(join(ws, "data", "weeks", `${doc.week}.json`), JSON.stringify(doc, null, 2));
const readWeek = (ws, week) => JSON.parse(readFileSync(join(ws, "data", "weeks", `${week}.json`), "utf8"));

console.log("== T1/AC-1 fetch-trending 离线解析真实 fixture ==");
const T1 = mkws("t1");
{
  const r = run("fetch-trending.mjs", ["--workspace", T1, "--html", join(FIXTURES, "trending-weekly.html"), "--week", "2026-W36"]);
  check("exit 0", r.status === 0);
  const doc = readWeek(T1, "2026-W36");
  check("20 条记录", doc.repos.length === 20);
  check("第 1 名 tt-a1i/archify 周增 22095 总 41614",
    doc.repos[0].full_name === "tt-a1i/archify" && doc.repos[0].stars_week === 22095 && doc.repos[0].stars_total === 41614);
  check("rank 1..20 连续", JSON.stringify(doc.repos.map((x) => x.rank)) === JSON.stringify(Array.from({ length: 20 }, (_, i) => i + 1)));
  const omarchy = doc.repos.find((x) => x.full_name === "omacom/omarchy");
  check("HTML entity 解码（&amp; → &）", omarchy?.description.includes("Modern & Opinionated"));
  const mcp = doc.repos.find((x) => x.full_name === "punkpeye/awesome-mcp-servers");
  check("无 language 仓库为 null", mcp?.language === null);
}

console.log("== T2/AC-2 页面结构异常必须拒绝 ==");
{
  const html = readFileSync(join(FIXTURES, "trending-weekly.html"), "utf8");
  const ws = mkws("t2");
  const fewer = html.replace(/<article class="Box-row"[\s\S]*?<\/article>/, "");
  writeFileSync(join(ws, "fewer.html"), fewer);
  const r1 = run("fetch-trending.mjs", ["--workspace", ws, "--html", join(ws, "fewer.html"), "--week", "2026-W36"]);
  check("条数 19≠20 → exit 1 且 stderr 指明", r1.status === 1 && /19/.test(r1.err) && /期望/.test(r1.err));
  check("条数异常时不写数据文件", !existsSync(join(ws, "data", "weeks", "2026-W36.json")));

  // 精确定位第一个 stargazers 链接内的数字，避免误伤文章外的同串
  const badNum = html.replace(/(\/tt-a1i\/archify\/stargazers"[^>]*>\s*(?:<svg[\s\S]*?<\/svg>)\s*)41,614/, "$1N/A");
  if (badNum === html) { check("星数变异已生效（测试自身前提）", false); }
  else {
    writeFileSync(join(ws, "badnum.html"), badNum);
    const r2 = run("fetch-trending.mjs", ["--workspace", ws, "--html", join(ws, "badnum.html"), "--week", "2026-W36"]);
    check("总星数非数字 → exit 1", r2.status === 1 && /星数/.test(r2.err));
  }

  const badName = html.replace('href="/tt-a1i/archify"', 'href="/not/a/valid/repo"');
  writeFileSync(join(ws, "badname.html"), badName);
  const r3 = run("fetch-trending.mjs", ["--workspace", ws, "--html", join(ws, "badname.html"), "--week", "2026-W36"]);
  check("repo 全名不合法 → exit 1", r3.status === 1 && /全名不合法/.test(r3.err));
}

console.log("== T3/AC-3 enrich-repos --stub 离线回放 ==");
{
  const r = run("enrich-repos.mjs", ["--workspace", T1, "--week", "2026-W36", "--stub", join(FIXTURES, "stub")]);
  check("exit 0（缺响应容错不失败）", r.status === 0);
  const doc = readWeek(T1, "2026-W36");
  const archify = doc.repos.find((x) => x.full_name === "tt-a1i/archify");
  check("archify 合并 topics/stars_api/readme", archify.api_ok === true && Array.isArray(archify.topics) && archify.topics.length > 0
    && Number.isInteger(archify.stars_api) && archify.readme_excerpt.length > 0 && !!archify.license);
  const gt = doc.repos.find((x) => x.full_name === "google/googletest");
  check("googletest 富化成功", gt.api_ok === true && Number.isInteger(gt.stars_api));
  const miss = doc.repos.find((x) => x.full_name === "anthropics/claude-plugins-community");
  check("stub 无响应 → api_ok:false 且标记原因", miss.api_ok === false && typeof miss.api_error === "string");
  check("miss 仓库不残留 readme", miss.readme_excerpt === "");
  const v = run("validate-week.mjs", ["--workspace", T1, "--week", "2026-W36"]);
  check("enrich 后仍过校验器", v.status === 0);
}

console.log("== T4/AC-4 update-history 分类/环比/幂等 ==");
const T4 = mkws("t4");
{
  writeWeek(T4, mkWeek("2026-W34", [mkRepo(1, "alpha/demo", 100, 30), mkRepo(2, "beta/tool", 50, 20)]));
  writeWeek(T4, mkWeek("2026-W35", [mkRepo(1, "beta/tool", 60, 10), mkRepo(2, "gamma/lib", 30, 8)]));
  writeWeek(T4, mkWeek("2026-W36", [mkRepo(1, "alpha/demo", 150, 50), mkRepo(2, "beta/tool", 80, 20), mkRepo(3, "delta/new", 10, 10)]));
  for (const w of ["2026-W34", "2026-W35", "2026-W36"]) {
    const r = run("update-history.mjs", ["--workspace", T4, "--week", w]);
    check(`update-history ${w} exit 0`, r.status === 0);
  }
  const doc = readWeek(T4, "2026-W36");
  const [a, b, d] = doc.repos;
  check("alpha/demo 上过 W34 未上周榜 → returning，环比 +50",
    a.entry_status === "returning" && a.stars_prev === 100 && a.stars_delta === 50);
  check("beta/tool 上周在榜 → recurring，环比 +20",
    b.entry_status === "recurring" && b.stars_prev === 60 && b.stars_delta === 20);
  check("delta/new 首次入榜 → new 且无环比字段", d.entry_status === "new" && d.stars_prev === undefined && d.stars_delta === undefined);
  const betaHist = JSON.parse(readFileSync(join(T4, "data", "repos", "beta__tool.json"), "utf8"));
  check("beta/tool 历史 3 条快照（W34..W36）", betaHist.snapshots.length === 3 && betaHist.snapshots.map((s) => s.week).join() === "2026-W34,2026-W35,2026-W36");
  const r2 = run("update-history.mjs", ["--workspace", T4, "--week", "2026-W36"]);
  const betaHist2 = JSON.parse(readFileSync(join(T4, "data", "repos", "beta__tool.json"), "utf8"));
  check("重跑幂等：快照不重复", r2.status === 0 && betaHist2.snapshots.length === 3);
}

console.log("== T5/AC-5 validate-week 门禁 ==");
{
  const r = run("validate-week.mjs", ["--workspace", T4, "--full"]);
  check("合法数据 --full 全过", r.status === 0 && r.out.includes("PASS"));

  const bad1 = mkws("t5a");
  const d1 = mkWeek("2026-W36", [mkRepo(1, "no-slash", 10, 5), mkRepo(2, "beta/tool", 60, 20)]);
  writeWeek(bad1, d1);
  const v1 = run("validate-week.mjs", ["--workspace", bad1, "--week", "2026-W36"]);
  check("full_name 非法 → exit 1 指认字段", v1.status === 1 && v1.err.includes("full_name"));

  const bad2 = mkws("t5b");
  const d2 = mkWeek("2026-W36", [mkRepo(1, "alpha/demo", "41614", 5), mkRepo(2, "beta/tool", 60, 20)]);
  writeWeek(bad2, d2);
  const v2 = run("validate-week.mjs", ["--workspace", bad2, "--week", "2026-W36"]);
  check("stars_total 字符串 → exit 1 指认字段", v2.status === 1 && v2.err.includes("stars_total"));

  const bad3 = mkws("t5c");
  copyFileSync(join(T4, "data", "weeks", "2026-W36.json"), join(bad3, "data", "weeks", "2026-W36.json"));
  for (const f of ["alpha__demo.json", "beta__tool.json", "delta__new.json"]) {
    copyFileSync(join(T4, "data", "repos", f), join(bad3, "data", "repos", f));
  }
  const noStatus = readWeek(bad3, "2026-W36");
  noStatus.repos.forEach((x) => delete x.entry_status);
  writeWeek(bad3, noStatus);
  const v3base = run("validate-week.mjs", ["--workspace", bad3, "--week", "2026-W36"]);
  const v3full = run("validate-week.mjs", ["--workspace", bad3, "--week", "2026-W36", "--full"]);
  check("缺 entry_status：基础模式过、--full 拒绝并点名", v3base.status === 0 && v3full.status === 1 && v3full.err.includes("entry_status"));
}

console.log("== T6/AC-6,AC-7 build-report 产物 ==");
{
  writeFileSync(join(T4, "data", "weeks", "2026-W36.analysis.md"), "## 本周看点\n\n- **delta/new** 是测试仓库\n");
  const r = run("build-report.mjs", ["--workspace", T4]);
  check("exit 0", r.status === 0);
  const dataJs = readFileSync(join(T4, "report", "data.js"), "utf8");
  const payload = JSON.parse(dataJs.replace(/^window\.TRENDING_DATA = /, "").replace(/;\n$/, ""));
  check("包含全部 3 个历史周", payload.weeks.length === 3 && payload.weeks.map((w) => w.week).join() === "2026-W34,2026-W35,2026-W36");
  check("W36 分析已内联", payload.weeks[2].analysis.includes("delta/new"));
  check("AC-7 无分析周 analysis 为 null 且报告照常生成", payload.weeks[0].analysis === null && payload.weeks[1].analysis === null);
  check("readme 截断上限生效", payload.weeks[2].repos.every((x) => (x.readme_excerpt ?? "").length <= 900));
  const html = readFileSync(join(T4, "report", "index.html"), "utf8");
  check("index.html 存在且引用 data.js", html.includes('src="data.js"'));
}

console.log("== T8/AC-9 serve.mjs 本地后端（loopback，离线） ==");
{
  const { spawn } = await import("node:child_process");
  const portfile = join(T4, "port.txt");
  rmSync(portfile, { force: true });
  // stdio ignore：无管道，避免 Windows 上 kill 子进程触发 libuv 退出断言
  const proc = spawn(process.execPath, [join(SCRIPTS, "serve.mjs"), "--workspace", T4, "--port", "0", "--portfile", portfile], { stdio: "ignore" });
  const port = await new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function poll() {
      try {
        const n = Number(readFileSync(portfile, "utf8").trim());
        if (Number.isInteger(n) && n > 0) return resolve(n);
      } catch { /* 未就绪 */ }
      if (Date.now() - t0 > 10000) reject(new Error("服务器 10s 未就绪（portfile 未出现）"));
      else setTimeout(poll, 100);
    })();
  });
  const base = `http://127.0.0.1:${port}`;
  // 用 node:http + agent:false（每请求短连接）：fetch 的 keep-alive 池会让 process.exit 触发 libuv 断言污染退出码
  const { get: httpGet } = await import("node:http");
  const hget = (path) => new Promise((resolve, reject) => {
    const req = httpGet(`${base}${path}`, { agent: false }, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => resolve({ status: res.statusCode, text: body }));
    });
    req.on("error", reject);
  });
  try {
    const r1 = await hget("/");
    check("GET / 返回 viewer（引用 data.js）", r1.status === 200 && r1.text.includes('src="data.js"'));
    const r2 = await hget("/data.js");
    const payload = JSON.parse(r2.text.replace(/^window\.TRENDING_DATA = /, "").replace(/;\n$/, ""));
    check("GET /data.js 动态载荷 3 周", r2.status === 200 && payload.weeks.length === 3);
    const r3 = await hget("/api/weeks");
    const weeks = JSON.parse(r3.text);
    check("GET /api/weeks 摘要含 top1 与分析标记", r3.status === 200 && weeks.count === 3
      && weeks.weeks[2].top1 === "alpha/demo" && weeks.weeks[2].has_analysis === true && weeks.weeks[0].has_analysis === false);
    const r4 = await hget("/api/weeks/2026-W36");
    const w36 = JSON.parse(r4.text);
    check("GET /api/weeks/:id 完整快照", r4.status === 200 && w36.repos.length === 3 && w36.week === "2026-W36");
    const r5 = await hget("/api/weeks/2026-W36/analysis");
    check("GET /api/weeks/:id/analysis 返回 markdown", r5.status === 200 && r5.text.includes("delta/new"));
    const r6 = await hget("/api/repos");
    const repos = JSON.parse(r6.text);
    check("GET /api/repos 历史摘要", r6.status === 200 && repos.count === 4
      && repos.repos.some((x) => x.full_name === "beta/tool" && x.weeks_on_chart === 3));
    const r7 = await hget("/api/repos/beta__tool");
    const h7 = JSON.parse(r7.text);
    check("GET /api/repos/:name 单仓库历史", r7.status === 200 && h7.snapshots.length === 3);
    const r8 = await hget("/api/latest");
    const latest = JSON.parse(r8.text);
    check("GET /api/latest 最近一周", r8.status === 200 && latest.week === "2026-W36");
    const r9 = await hget("/api/weeks/1999-W01");
    check("未知周 404 JSON", r9.status === 404);
    const r10 = await hget("/api/nope");
    check("未知路由 404 且列出路由表", r10.status === 404 && JSON.parse(r10.text).routes?.length > 0);
    const r11 = await hget("/api/repos/..%2F..%2Fetc");
    check("路径注入被拒（不匹配即 404）", r11.status === 404);
  } finally {
    proc.kill();
  }
}

console.log("== T7/AC-8 SKILL.md 声明完整 ==");
check("SKILL.md 存在且声明 name", existsSync(join(SKILL_DIR, "SKILL.md"))
  && readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8").includes("name: github-trending-weekly"));

rmSync(ROOT_WS, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
