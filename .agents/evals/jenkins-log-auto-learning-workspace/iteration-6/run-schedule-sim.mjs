// run-schedule-sim.mjs — 「每半小时定时触发持续积累」模拟测试
//
// 问题: jenkins-log-auto-learning 若被定时器每 30 分钟触发一次，能否持续、
// 无重复、无丢失地积累 Jenkins 错误案例？
//
// 方法: 本机 mock Jenkins（可中途注入新构建 = CI 持续产出新失败）+ 隔离沙箱
// （独立 SKILL_ENV/trackFile/pending/workflow），按编排器 SKILL.md 的流转
// （status → scan → next → stage → finish）逐轮模拟定时触发。
// 「分析」环节以合法终态收尾命令代替（本套件测的是积累机制，不是分析质量）。
//
// 注意: 子进程必须用异步 spawn —— spawnSync 会阻塞父进程事件循环，
// mock 服务器将无法响应子进程请求（首版实测 30s 超时全部 WARN）。
//
// 场景组:
//   A 冷启动与锁 | B 定时循环行为 | C 崩溃恢复 | D 守卫与损坏
//   E 新错误持续到来的压力循环（20 轮触发）
//   F 修复后语义验证：瞬态不落账（尾部失败/BUILDING）、旧版冻结键自愈、
//     自愈一次性防重开、Jenkins 全断告警、部分不可达降级、损坏优雅指引
//
// 用法: node run-schedule-sim.mjs   （退出码 0=全过, 1=有失败）

import http from "node:http";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SKILL = "D:/GIT_dev/Claude_skills/.claude/skills/jenkins-log-auto-learning";
const SESSION = join(SKILL, "scripts", "session.mjs");
const SCAN = join(SKILL, "scripts", "scan-pairs.mjs");
const SB = join(here, "sandbox");
const STATE = join(SB, "state");

mkdirSync(join(STATE, "raw"), { recursive: true });
rmSync(join(STATE, "raw", "analyzed-builds.json"), { force: true });
rmSync(join(STATE, "raw", "pending-pairs.json"), { force: true });
rmSync(join(STATE, "raw", "workflow.json"), { force: true });
rmSync(join(SB, "state2"), { recursive: true, force: true });
rmSync(join(SB, "state3"), { recursive: true, force: true });
rmSync(join(here, "debug-sb"), { recursive: true, force: true });

// ---------- mock Jenkins（fixtures 可中途注入新构建） ----------
const F = {
  "job/teamA/job/job-alpha": [
    { number: 10, result: "SUCCESS", timestamp: 1, duration: 1 },
    { number: 11, result: "FAILURE", timestamp: 2, duration: 1 },
    { number: 12, result: "FAILURE", timestamp: 3, duration: 1 },
    { number: 13, result: "SUCCESS", timestamp: 4, duration: 1 },
    { number: 14, result: "FAILURE", timestamp: 5, duration: 1 },
    { number: 15, result: "ABORTED", timestamp: 6, duration: 1 },
    { number: 16, result: "SUCCESS", timestamp: 7, duration: 1 },
    { number: 17, result: "FAILURE", timestamp: 8, duration: 1 },
    { number: 18, result: null, timestamp: 9, duration: 1 }, // BUILDING
  ],
  "job/teamA/job/job-beta": [
    { number: 20, result: "FAILURE", timestamp: 1, duration: 1 },
    { number: 21, result: "SUCCESS", timestamp: 2, duration: 1 },
  ],
  "job/teamA/job/job-off": [ // 已禁用任务：扫描不应请求它
    { number: 30, result: "FAILURE", timestamp: 1, duration: 1 },
    { number: 31, result: "SUCCESS", timestamp: 2, duration: 1 },
  ],
  "job/teamA/job/job-stress": [],
  "job/teamA/job/job-empty": [],
};
const requested = new Set();
const server = http.createServer((req, res) => {
  const path = req.url.split("?")[0];
  if (path.endsWith("/api/json")) {
    const jobPath = path.slice(0, -"/api/json".length).replace(/^\//, "");
    requested.add(jobPath);
    const fx = F[jobPath];
    if (fx) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ allBuilds: fx }));
      return;
    }
  }
  res.statusCode = 404;
  res.end('{"error":"no such job"}');
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---------- 沙箱环境 ----------
const ENV_FILE = join(SB, "skill-env.json");
writeFileSync(ENV_FILE, JSON.stringify({
  jenkins: { baseUrl: BASE },
  gitRepos: "D:/nonexistent-git",
  knowledgeBase: { rawDir: join(STATE, "raw").split("\\").join("/"), wikiDir: join(STATE, "wiki").split("\\").join("/") },
  trackFile: join(STATE, "raw", "analyzed-builds.json").split("\\").join("/"),
  tmpDir: join(STATE, "tmp").split("\\").join("/"),
  jobs: [
    { enabled: true, name: "alpha", path: "job/teamA/job/job-alpha" },
    { enabled: true, name: "beta", path: "job/teamA/job/job-beta" },
    { enabled: true, name: "empty", path: "job/teamA/job/job-empty" },
    { enabled: false, name: "off", path: "job/teamA/job/job-off" },
    { enabled: true, name: "stress", path: "job/teamA/job/job-stress" },
  ],
}, null, 2));
const ENV2_FILE = join(SB, "skill-env-dead.json"); // F5a: Jenkins 全断
writeFileSync(ENV2_FILE, JSON.stringify({
  jenkins: { baseUrl: "http://127.0.0.1:9" },
  trackFile: join(SB, "state2", "analyzed-builds.json").split("\\").join("/"),
  jobs: [{ enabled: true, name: "alpha", path: "job/teamA/job/job-alpha" }],
}, null, 2));
const ENV3_FILE = join(SB, "skill-env-partial.json"); // F5b: 部分任务 404
writeFileSync(ENV3_FILE, JSON.stringify({
  jenkins: { baseUrl: BASE },
  trackFile: join(SB, "state3", "analyzed-builds.json").split("\\").join("/"),
  jobs: [
    { enabled: true, name: "alpha", path: "job/teamA/job/job-alpha" },
    { enabled: true, name: "ghost", path: "job/teamA/job/job-ghost" },
  ],
}, null, 2));

const TRACK = join(STATE, "raw", "analyzed-builds.json");
const PENDING = join(STATE, "raw", "pending-pairs.json");
const WORKFLOW = join(STATE, "raw", "workflow.json");

// ---------- 工具 ----------
const results = [];
let n = 0, failed = 0;
function check(name, passed, evidence) {
  results.push({ id: ++n, name, passed: !!passed, evidence: String(evidence ?? "").slice(0, 400) });
  if (!passed) failed++;
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${evidence !== undefined ? "  | " + String(evidence).slice(0, 160) : ""}`);
}
function run(script, args, envFile = ENV_FILE) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [script, ...args], {
      env: { ...process.env, SKILL_ENV: envFile },
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("error", (e) => resolve({ code: -1, out: String(e) }));
    p.on("close", (code) => resolve({ code, out }));
  });
}
const sess = (...args) => run(SESSION, args);
const scan = (envFile = ENV_FILE) => run(SCAN, [], envFile);
function j(p) { return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")); }
const track = () => j(TRACK);
const pending = () => j(PENDING);
const workflow = () => j(WORKFLOW);
const A = "job/teamA/job/job-alpha", B = "job/teamA/job/job-beta";
const addBuilds = (job, builds) => F[job].push(...builds);
function agePending(hours = 2) {
  const p = pending();
  const d = new Date(Date.now() - hours * 3600000);
  const pad = (x) => String(x).padStart(2, "0");
  p.generatedAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  writeFileSync(PENDING, JSON.stringify(p, null, 2));
}
function remainingPairs() {
  const t = track();
  return pending().pairs.filter((p) => !p.failBuilds.every((b) => `${p.jobPath}#${b}` in t.analyzed)).length;
}
// 测试侧直改沙箱账本（模拟旧版 scan 预写的冻结键；生产流程中 Agent 不得这样做）
const writeTrackFile = (t) => writeFileSync(TRACK, JSON.stringify(t, null, 2));
// 在沙箱 rawDir 写一份能过 session 知识门禁的文件（存在 + rawDir 内 + 一级标题含错误码 token）
const knowledgeFile = (name, token) => {
  const p = join(STATE, "raw", name);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `# ${token}: 测试知识条目\n\n> **Score**: 8/10 | **Token**: ${token}\n`, "utf8");
  return p.split("\\").join("/");
};
async function analyzeCycle(kind, round, pair) {
  if (kind === 0) {
    await sess("stage", "1-analyze", "done", "--result", `failure:score=8:E${round}:fix=#${pair.fixBuild}`, "--knowledge", knowledgeFile(`details/e${round}.md`, `E${round}`), "--success", "success:w=1");
  } else if (kind === 1) {
    await sess("stage", "1-analyze", "done", "--result", `failure:infra:agent-down-${round}`);
  } else if (kind === 2) {
    await sess("stage", "1-analyze", "skipped", "--reason", "REUSED");
  } else {
    await sess("stage", "1-analyze", "error", "--reason", `api-timeout-${round}`);
  }
  return sess("finish");
}

// ============ A. 冷启动与锁 ============
console.log("\n===== A. 冷启动与单实例锁 =====");

let r = await sess("status");
check("A1 冷启动 status: 无会话+提示先扫描", r.code === 0 && r.out.includes("会话: 无") && r.out.includes("先跑 scan-pairs.mjs"), r.out.split("\n")[0]);

r = await scan();
check("A2 首次 scan 成功且发现 3 对", r.code === 0 && pending().totalPairs === 3, `exit=${r.code}, totalPairs=${pending().totalPairs}`);
check("A3 scan 只记终态事实（5 键；尾部失败/BUILDING 不落账）", Object.keys(track().analyzed).length === 5 &&
  track().analyzed[`${A}#13`] === "success:w=?" && !(`${A}#17` in track().analyzed) &&
  !(`${A}#18` in track().analyzed) && track().analyzed[`${A}#15`] === "skip:ABORTED", JSON.stringify(track().analyzed));
check("A4 禁用任务未被请求", !requested.has("job/teamA/job/job-off"), [...requested].join(","));

r = await sess("next");
check("A5 next 领取第一对 alpha[11,12]→13", r.code === 0 && workflow().pair.failBuilds.join(",") === "11,12" && workflow().pair.fixBuild === 13, r.out.split("\n")[0]);

r = await sess("next");
check("A6 单实例锁: 会话进行中再 next 拒绝(exit 1)+续跑提示", r.code === 1 && r.out.includes("已有进行中的会话"), r.out.split("\n")[0]);

// ============ B. 定时循环行为（模拟第 1/2/3 次触发） ============
console.log("\n===== B. 定时循环：逐轮触发 =====");

r = await sess("stage", "1-analyze", "done", "--result", "failure:score=8:C2061:fix=#13", "--knowledge", knowledgeFile("details/fake-11.md", "C2061"), "--success", "success:w=3");
check("B1 stage done 收尾成功", r.code === 0 && workflow().stage_gates["1-analyze"].status === "done", r.out.split("\n")[0]);
r = await sess("finish");
const t1 = track();
check("B2 finish 落账 3 键+fixBuild 覆盖 success:w=3",
  t1.analyzed[`${A}#11`] === "failure:score=8:C2061:fix=#13" && t1.analyzed[`${A}#12`] === t1.analyzed[`${A}#11`] &&
  t1.analyzed[`${A}#13`] === "success:w=3", JSON.stringify({ a11: t1.analyzed[`${A}#11`], a13: t1.analyzed[`${A}#13`] }));
check("B3 runHistory 第 1 条字段正确", t1.runHistory.length === 1 && t1.runHistory[0].buildsAnalyzed === 3 &&
  t1.runHistory[0].knowledgeWritten === 1 && t1.runHistory[0].remaining === 2, JSON.stringify(t1.runHistory[0]));
check("B4 last_analyzed 推进到 13", t1.last_analyzed[A] === 13, String(t1.last_analyzed[A]));

r = await sess("next"); // 第 2 次触发: pending 新鲜, 直接领取
check("B5 第 2 次触发领取下一对 alpha[14]（不重复）", r.code === 0 && workflow().pair.failBuilds.join() === "14", r.out.split("\n")[0]);
await sess("stage", "1-analyze", "skipped", "--reason", "REUSED");
r = await sess("finish");
const t2 = track();
check("B6 skip 路径落账", t2.analyzed[`${A}#14`] === "skip:REUSED" && t2.runHistory[1].buildsSkipped === 1, t2.analyzed[`${A}#14`]);

r = await sess("next"); // 第 3 次触发
check("B7 第 3 次触发领取 beta[20]", r.code === 0 && workflow().pair.jobPath === B, r.out.split("\n")[0]);
await sess("stage", "1-analyze", "error", "--reason", "log-download-404");
r = await sess("finish");
check("B8 error 路径落账且不中断循环", track().analyzed[`${B}#20`] === "failure:error:log-download-404" && r.code === 0, track().analyzed[`${B}#20`]);

r = await sess("next");
check("B9 耗尽: next 报无对(exit 1)", r.code === 1 && r.out.includes("没有新的构建对"), r.out.split("\n")[0]);
r = await scan();
check("B10 耗尽后重扫(无新构建)仍 0 对", r.code === 0 && pending().totalPairs === 0, `totalPairs=${pending().totalPairs}`);
r = await sess("next");
check("B11 再次 next 仍无对 → 报告停止（脚本层 exit 1）", r.code === 1, r.out.split("\n")[0]);

// ---- B12-B14: pending 过期 + 新 CI 失败到来 ----
console.log("\n===== B'. 过期重扫与新错误到来 =====");
addBuilds(B, [
  { number: 22, result: "FAILURE", timestamp: 3, duration: 1 },
  { number: 23, result: "SUCCESS", timestamp: 4, duration: 1 },
  { number: 24, result: "SUCCESS", timestamp: 5, duration: 1 },
]);
agePending(2);
r = await sess("status");
check("B12 status 提示 pending 已过期(>1h)", r.out.includes("超过 1 小时"), r.out.split("\n").find((l) => l.includes("pending-pairs")));
r = await scan();
check("B13 重扫发现新失败对 beta[22]→23，旧账未丢", r.code === 0 && pending().totalPairs === 1 && pending().pairs[0].failBuilds.join() === "22" &&
  Object.keys(track().analyzed).length >= 11, `pairs=${pending().totalPairs}, keys=${Object.keys(track().analyzed).length}`);
r = await sess("next");
await sess("stage", "1-analyze", "done", "--result", "failure:score=6:LNK2019:fix=#23", "--knowledge", knowledgeFile("scratch/fake-22.md", "LNK2019"));
r = await sess("finish");
check("B14 新对完成分析落账（持续积累成立）", track().analyzed[`${B}#22`] === "failure:score=6:LNK2019:fix=#23" && track().runHistory.length === 4, track().analyzed[`${B}#22`]);

// ============ C. 崩溃恢复（无人值守的关键） ============
console.log("\n===== C. 崩溃恢复 =====");

addBuilds(B, [
  { number: 25, result: "FAILURE", timestamp: 6, duration: 1 },
  { number: 26, result: "SUCCESS", timestamp: 7, duration: 1 },
]);
await scan();
await sess("next"); // 领取 25 后"崩溃"（无 stage 无 finish）
r = await sess("status");
check("C1 崩溃后新触发: status 显示进行中+续跑指针", r.code === 0 && r.out.includes("进行中") && r.out.includes("next:"), r.out.split("\n")[0]);
await sess("stage", "1-analyze", "done", "--result", "failure:score=9:C2061:fix=#26", "--success", "success:w=12");
r = await sess("finish");
check("C2 续跑后正常落账，fixBuild 覆盖 w=12", track().analyzed[`${B}#25`] === "failure:score=9:C2061:fix=#26" &&
  track().analyzed[`${B}#26`] === "success:w=12", track().analyzed[`${B}#26`]);

addBuilds(B, [
  { number: 27, result: "FAILURE", timestamp: 8, duration: 1 },
  { number: 28, result: "SUCCESS", timestamp: 9, duration: 1 },
]);
await scan();
await sess("next");
await sess("stage", "1-analyze", "done", "--result", "failure:score=5:U0001:fix=#28", "--knowledge", knowledgeFile("scratch/fake-27.md", "U0001"));
// stage 完成、finish 前"崩溃"
r = await sess("status");
check("C3 stage 后崩溃: status 指针指向 finish", r.out.includes("1-analyze: done") && r.out.includes("finish"), r.out.split("\n").find((l) => l.includes("next:")));
const histBefore = track().runHistory.length;
r = await sess("finish");
check("C4 恢复 finish 恰好落账一次（无重复记账）", track().runHistory.length === histBefore + 1, `${histBefore} → ${track().runHistory.length}`);

addBuilds(B, [
  { number: 29, result: "FAILURE", timestamp: 10, duration: 1 },
  { number: 30, result: "SUCCESS", timestamp: 11, duration: 1 },
]);
await scan();
await sess("next");
r = await sess("abandon", "--reason", "stale-agent-crash");
check("C5 abandon 僵死会话: 落账 error + 会话终结", r.code === 0 && track().analyzed[`${B}#29`] === "failure:error:stale-agent-crash" &&
  workflow().status === "done", track().analyzed[`${B}#29`]);
r = await sess("next");
check("C6 abandon 后下次触发领取恢复正常（无对时干净退出）", (r.code === 1 && r.out.includes("没有新的构建对")) || r.code === 0, r.out.split("\n")[0]);
if (r.code === 0) { await sess("stage", "1-analyze", "skipped"); await sess("finish"); }

// ============ D. 守卫与损坏 ============
console.log("\n===== D. 守卫拒绝与文件损坏 =====");

addBuilds(B, [
  { number: 31, result: "FAILURE", timestamp: 12, duration: 1 },
  { number: 32, result: "SUCCESS", timestamp: 13, duration: 1 },
]);
await scan();
await sess("next");
r = await sess("finish");
check("D1 门禁: 1-analyze 未收尾时 finish 拒绝", r.code === 1 && r.out.includes("门禁"), r.out.split("\n")[0]);
r = await sess("stage", "1-analyze", "done", "--result", "不合法的结论串");
check("D3 非法结论串拒绝(grammar 校验)", r.code === 1 && r.out.includes("grammar"), r.out.split("\n")[0]);
await sess("stage", "1-analyze", "done", "--result", "failure:score=7:X1:fix=#32");
r = await sess("stage", "1-analyze", "done", "--result", "failure:score=7:X1:fix=#32");
check("D2 重复收尾拒绝", r.code === 1 && r.out.includes("不得重复收尾"), r.out.split("\n")[0]);
r = await sess("finish");
check("D4 正常 finish 通过", r.code === 0, r.code);
r = await sess("finish");
check("D5 会话终结后重复 finish 拒绝", r.code === 1 && r.out.includes("会话已终结"), r.out.split("\n")[0]);

writeFileSync(WORKFLOW, "{ 不是合法 json");
r = await sess("status");
check("D6 workflow.json 损坏: status 优雅报错+指引(不静默)", r.code === 1 && r.out.includes("不是合法 JSON") && r.out.includes("abandon"), r.out.split("\n")[0]);
rmSync(WORKFLOW, { force: true });
r = await sess("status");
check("D7 人工删除损坏 workflow 后恢复", r.code === 0 && r.out.includes("会话: 无"), r.out.split("\n")[0]);

// D8: 账本损坏 → 优雅报错 + 恢复指引（不再裸栈崩溃）
cpSync(TRACK, TRACK + ".bak");
writeFileSync(TRACK, '{"analyzed": {"a": ');
r = await sess("status");
check("D8 账本损坏: status 优雅报错+恢复指引", r.code === 1 && r.out.includes("不是合法 JSON") && r.out.includes("备份"), r.out.split("\n")[0]);
cpSync(TRACK + ".bak", TRACK);
rmSync(TRACK + ".bak", { force: true });

// ============ E. 压力循环: 20 轮触发 + 新错误持续到来 ============
console.log("\n===== E. 20 轮定时触发压力循环 =====");
let stressNo = 0;
const histBase = track().runHistory.length;
let keysPrev = Object.keys(track().analyzed).length;
const seenFails = new Set();
let dupClaim = 0, keysShrank = 0;

for (let round = 1; round <= 20; round++) {
  if (round % 3 === 0) agePending(2); // 模拟时间流逝: 每 3 轮 pending 过期一次
  await sess("status");
  r = await sess("next");
  if (r.code !== 0) {
    // 耗尽 → CI 产出新的失败对 → 重扫 → 再领取（phase0-scan.md 的回环）
    stressNo += 1;
    addBuilds("job/teamA/job/job-stress", [
      { number: 100 + 2 * (stressNo - 1), result: "FAILURE", timestamp: stressNo, duration: 1 },
      { number: 101 + 2 * (stressNo - 1), result: "SUCCESS", timestamp: stressNo, duration: 1 },
    ]);
    await scan();
    r = await sess("next");
    if (r.code !== 0) { check(`E-round${round} 耗尽→重扫→领取失败`, false, r.out); break; }
  }
  const pair = workflow().pair;
  for (const fb of pair.failBuilds) {
    if (seenFails.has(`${pair.jobPath}#${fb}`)) dupClaim++;
    seenFails.add(`${pair.jobPath}#${fb}`);
  }
  r = await analyzeCycle(round % 4, round, pair);
  if (r.code !== 0) { check(`E-round${round} finish 失败`, false, r.out); break; }
  const keysNow = Object.keys(track().analyzed).length;
  if (keysNow < keysPrev) keysShrank++;
  keysPrev = keysNow;
}
check("E1 20 轮零重复领取", dupClaim === 0, `dup=${dupClaim}`);
check("E2 账本键数单调不减", keysShrank === 0, `shrank=${keysShrank}`);
check("E3 每轮恰好一次 runHistory 记账", track().runHistory.length === histBase + 20, `${histBase} → ${track().runHistory.length}`);
check("E4 期末 remaining 与 pending/analyzed 交叉一致", track().runHistory.at(-1).remaining === remainingPairs(), `history=${track().runHistory.at(-1).remaining}, recount=${remainingPairs()}`);
check("E5 终态分布覆盖 done/infra/skip/error 四路", ["failure:score=", "failure:infra:", "skip:", "failure:error:"].every((p) => Object.values(track().analyzed).some((v) => v.startsWith(p))), "");

// 幂等: 第一次扫描会自然清掉已落账的残留对，之后无状态变化时连扫应完全稳定
await scan();
const keys1 = Object.keys(track().analyzed).length, pairs1 = pending().totalPairs;
await scan();
check("E6 重扫幂等: 键数与对数稳定", Object.keys(track().analyzed).length === keys1 && pending().totalPairs === pairs1, `第1次=${keys1}/${pairs1}, 第2次=${Object.keys(track().analyzed).length}/${pending().totalPairs}`);

const raw = readFileSync(TRACK, "utf8");
check("E7 账本 UTF-8 无 BOM + CRLF", !raw.startsWith("\uFEFF") && raw.includes("\r\n"), `bom=${raw.startsWith("\uFEFF")}, crlf=${raw.includes("\r\n")}`);

// ============ F. 修复后语义验证（瞬态不落账 / 自愈 / 网络语义 / 损坏指引） ============
console.log("\n===== F. 瞬态不落账 / 存量自愈 / 网络故障 / 损坏指引 =====");

// F1: 尾部失败（修复未到来）不预写 no-fix-found；修复到来后配对可领取
check("F1a 尾部失败从未被预写 no-fix-found（瞬态不落账）", !(`${A}#17` in track().analyzed), String(track().analyzed[`${A}#17`]));
addBuilds(A, [
  { number: 19, result: "FAILURE", timestamp: 10, duration: 1 },
  { number: 20, result: "SUCCESS", timestamp: 11, duration: 1 },
]);
await scan();
const f1Pair = pending().pairs.find((p) => p.failBuilds.includes(17));
check("F1b 修复到来后尾部组配对成功（[17,19]→20，错误案例不丢）", f1Pair !== undefined && f1Pair.failBuilds.join(",") === "17,19" && f1Pair.fixBuild === 20, JSON.stringify(f1Pair));
r = await sess("next");
check("F1c 修复对可被领取", r.code === 0 && workflow().pair.failBuilds.join(",") === "17,19", r.out.split("\n")[0]);
await sess("stage", "1-analyze", "done", "--result", "failure:score=7:HEAL1:fix=#20");
await sess("finish");
check("F1d 领取后落账真实终态（覆盖曾经的瞬态）", track().analyzed[`${A}#17`] === "failure:score=7:HEAL1:fix=#20", track().analyzed[`${A}#17`]);

// F2: BUILDING 不落账（Jenkins 进行中语义）；完成为 FAILURE 后修复对正常入队
addBuilds(A, [{ number: 21, result: null, timestamp: 12, duration: 1 }]);
await scan();
check("F2a BUILDING 构建不落账", !(`${A}#21` in track().analyzed), String(track().analyzed[`${A}#21`]));
F[A] = F[A].map((b) => (b.number === 21 ? { ...b, result: "FAILURE" } : b));
addBuilds(A, [{ number: 22, result: "SUCCESS", timestamp: 13, duration: 1 }]);
await scan();
const f2Pair = pending().pairs.find((p) => p.failBuilds.includes(21));
check("F2b BUILDING→FAILURE 完成后修复对正常入队", f2Pair !== undefined && f2Pair.fixBuild === 22, JSON.stringify(f2Pair));
r = await sess("next");
check("F2c 该对可被领取", r.code === 0 && workflow().pair.failBuilds.join() === "21", r.out.split("\n")[0]);
await sess("stage", "1-analyze", "skipped");
await sess("finish");

// F3: 旧版预写 no-fix-found 的存量自愈 + healed_no_fix 一次性防重开
addBuilds(B, [
  { number: 34, result: "FAILURE", timestamp: 14, duration: 1 },
  { number: 35, result: "SUCCESS", timestamp: 15, duration: 1 },
]);
{ // 模拟旧版账本：#34 被旧 scan 预写成 no-fix-found
  const t = track();
  t.analyzed[`${B}#34`] = "failure:no-fix-found";
  writeTrackFile(t);
}
await scan();
const f3Pair = pending().pairs.find((p) => p.failBuilds.includes(34));
check("F3a 旧版预写的 no-fix-found 被自愈回炉入队（healed_no_fix 记录）",
  f3Pair !== undefined && track().healed_no_fix?.[`${B}#34`] === true && !(`${B}#34` in track().analyzed),
  `pair=${f3Pair ? "存在" : "无"}, healed=${JSON.stringify(track().healed_no_fix)}`);
r = await sess("next");
check("F3b 自愈对可被领取", r.code === 0 && workflow().pair.failBuilds.join() === "34", r.out.split("\n")[0]);
await sess("stage", "1-analyze", "done", "--result", "failure:no-fix-found"); // 分析结论：无修复
await sess("finish");
await scan(); // 再扫：守卫应阻止重新入队（否则无限重开）
const f3Again = pending().pairs.find((p) => p.failBuilds.includes(34));
check("F3c 分析结论为 no-fix 时不无限重开（一次性自愈守卫）",
  f3Again === undefined && track().analyzed[`${B}#34`] === "failure:no-fix-found", `pair=${f3Again ? "又入队了" : "未重开"}`);

// F4: 旧版冻结的 skip:BUILDING 自愈为真实事实
addBuilds(A, [{ number: 23, result: null, timestamp: 14, duration: 1 }]);
await scan();
{ // 模拟旧版账本：#23 被旧 scan 冻结为 skip:BUILDING
  const t = track();
  t.analyzed[`${A}#23`] = "skip:BUILDING";
  writeTrackFile(t);
}
F[A] = F[A].map((b) => (b.number === 23 ? { ...b, result: "FAILURE" } : b));
addBuilds(A, [{ number: 24, result: "SUCCESS", timestamp: 15, duration: 1 }]);
await scan();
check("F4 旧版 skip:BUILDING 冻结被自愈（删冻结键 + 修复对入队）",
  track().analyzed[`${A}#23`] === undefined && pending().pairs.some((p) => p.failBuilds.includes(23)),
  `val=${track().analyzed[`${A}#23`]}`);

// F5: Jenkins 全断告警 + 部分不可达降级
mkdirSync(join(SB, "state2"), { recursive: true });
r = await scan(ENV2_FILE);
check("F5a Jenkins 全断: scan exit 1 且不生成 pending（告警而非静默无对）",
  r.code === 1 && !existsSync(join(SB, "state2", "pending-pairs.json")), `exit=${r.code}`);
mkdirSync(join(SB, "state3"), { recursive: true });
r = await scan(ENV3_FILE);
check("F5b 部分任务不可达: exit 0 + WARN + pending 照常生成",
  r.code === 0 && r.out.includes("不可达") && existsSync(join(SB, "state3", "pending-pairs.json")), `exit=${r.code}`);

// F6: scan 侧账本损坏优雅报错（不覆盖账本、不裸栈）
cpSync(TRACK, TRACK + ".bak");
writeFileSync(TRACK, "not json");
r = await scan();
check("F6 账本损坏: scan 优雅报错且不以空账本覆盖历史", r.code === 1 && r.out.includes("不是合法 JSON"), r.out.split("\n")[0]);
cpSync(TRACK + ".bak", TRACK);
rmSync(TRACK + ".bak", { force: true });

// F7: pending 损坏优雅报错（重扫重建指引）
cpSync(PENDING, PENDING + ".bak");
writeFileSync(PENDING, "{broken");
r = await sess("status");
check("F7 pending 损坏: status 优雅报错（重扫重建指引）",
  r.code === 1 && r.out.includes("pending-pairs.json 不是合法 JSON"), r.out.split("\n")[0]);
cpSync(PENDING + ".bak", PENDING);
rmSync(PENDING + ".bak", { force: true });

// ============ 汇总 ============
server.close();
console.log(`\n===== 结果: ${results.length - failed}/${results.length} PASS =====`);
writeFileSync(join(here, "schedule-sim-results.json"), JSON.stringify({ total: results.length, failed, results }, null, 2));
process.exit(failed ? 1 : 0);
