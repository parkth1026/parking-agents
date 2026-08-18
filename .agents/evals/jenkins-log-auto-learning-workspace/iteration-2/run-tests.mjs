// run-tests.mjs — jenkins-log-auto-learning 严格测试运行器
// 用法: node run-tests.mjs pre|post   (pre=修复前基线, post=修复后回归)
//
// 原则:
// - 所有 config/trackFile/output 全部落在 sandbox 内,SKILL_ENV 每次显式指定,
//   绝不读取真实 ~/.claude/skill-env.json,绝不触碰真实 Jenkins 与真实跟踪文件。
// - mock Jenkins 服务器只在本机随机端口提供 /api/json。

import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const phase = process.argv[2] || "pre";
const here = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = "D:/GIT_dev/Claude_skills/.claude/skills/jenkins-log-auto-learning";
const SCRIPT = join(SKILL_DIR, "scripts", "scan-pairs.mjs");
const SB = join(here, "sandbox");

mkdirSync(join(SB, "configs"), { recursive: true });
mkdirSync(join(SB, "state"), { recursive: true });
mkdirSync(join(SB, "fakehome"), { recursive: true });

// ---------- mock Jenkins ----------
const FIXTURES = {
  // 黄金序列: 覆盖所有配对/跳过分支
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
  "job/teamA/job/job-empty": [],
};

let requestLog = [];
const server = http.createServer((req, res) => {
  const path = req.url.split("?")[0];
  requestLog.push(path);
  if (path.endsWith("/api/json")) {
    const jobPath = path.slice(0, -"/api/json".length).replace(/^\//, "");
    const fx = FIXTURES[jobPath];
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

// ---------- 工具 ----------
const results = [];
let testCounter = 0;
function record(name, passed, evidence) {
  results.push({ id: ++testCounter, name, passed, evidence: String(evidence).slice(0, 500) });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${evidence ? "  | " + String(evidence).slice(0, 200) : ""}`);
}
function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
}
function writeJson(p, obj, bom = false) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, (bom ? "\uFEFF" : "") + JSON.stringify(obj, null, 2), "utf8");
}

// 运行 scan-pairs.mjs。cfg: {config?, env?, args?, cwd?, userprofile?, script?}
// 注意必须用异步 spawn: 父进程同时承载 mock 服务器, spawnSync 会冻结事件循环导致子进程请求永远无响应
function runScript(cfg) {
  requestLog = [];
  const env = { ...process.env, SKILL_ENV: cfg.env };
  if (cfg.userprofile) env.USERPROFILE = cfg.userprofile;
  const args = [];
  if (cfg.config) args.push("--config", cfg.config);
  if (cfg.args) args.push(...cfg.args);
  return new Promise((resolve) => {
    const child = spawn("node", [cfg.script || SCRIPT, ...args], { env, cwd: cfg.cwd || join(SB, "state"), windowsHide: true });
    let stdout = "", stderr = "", settled = false;
    const timer = setTimeout(() => child.kill(), 90000);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const done = (status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status, stdout, stderr, requests: requestLog.slice() });
    };
    child.on("close", (code) => done(code));
    child.on("error", () => done(-1));
  });
}

function listSkillFiles() {
  return spawnSync("cmd", ["/c", "dir", "/s", "/b", "/a:-d", SKILL_DIR], { encoding: "utf8" })
    .stdout.trim()
    .split(/\r?\n/)
    .sort();
}

// ---------- 配置文件 ----------
const C = (n) => join(SB, "configs", n);
const S = (n) => join(SB, "state", n);

// 每轮启动清空 state,保证 pre/post 两次运行互不残留
rmSync(join(SB, "state"), { recursive: true, force: true });
rmSync(join(SB, "fakehome"), { recursive: true, force: true });
mkdirSync(join(SB, "state"), { recursive: true });
mkdirSync(join(SB, "fakehome"), { recursive: true });

writeJson(C("env-only-gitrepos.json"), { gitRepos: "D:/nonexistent" });
writeJson(C("env-no-trackfile.json"), { jenkins: { baseUrl: BASE } });
writeJson(C("env-jobs-not-array.json"), { jenkins: { baseUrl: BASE }, trackFile: S("t3.json"), jobs: "not-an-array" });

// 深合并测试: 技能层提供 baseUrl+trackFile(被环境层覆盖)+jobs[alpha], 环境层只提供 jobs[beta] (数组整体替换) + trackFile 覆盖
writeJson(C("skill-layer.json"), {
  jenkins: { baseUrl: BASE },
  trackFile: S("track-skill-layer.json"),
  jobs: [{ enabled: true, name: "alpha", path: "job/teamA/job/job-alpha" }],
});
writeJson(C("env-layer.json"), {
  trackFile: S("track-merged.json"),
  jobs: [{ enabled: true, name: "beta", path: "job/teamA/job/job-beta" }],
});

// BOM 技能层: 全量配置,带 UTF-8 BOM
writeJson(
  C("skill-layer-bom.json"),
  {
    jenkins: { baseUrl: BASE },
    trackFile: S("track-bom.json"),
    jobs: [{ enabled: true, name: "beta", path: "job/teamA/job/job-beta" }],
  },
  true
);
writeJson(C("env-empty.json"), {});

// 完整配置(状态更新测试用): alpha 黄金序列 + disabled beta + 不可达 + 空任务
writeJson(C("full-alpha.json"), {
  jenkins: { baseUrl: BASE },
  trackFile: S("track-p1.json"),
  jobs: [
    { enabled: true, name: "alpha", path: "job/teamA/job/job-alpha" },
    { enabled: false, name: "beta-disabled", path: "job/teamA/job/job-beta" },
    { enabled: true, name: "unreachable", path: "job/teamA/job/job-gone" },
    { enabled: true, name: "empty", path: "job/teamA/job/job-empty" },
  ],
});

// ============================================================
// C 组: config 读取
// ============================================================
console.log(`\n===== [${phase}] C 组: config 读取 =====`);

// C1 缺 baseUrl → 报错退出 1
{
  const r = await runScript({ config: C("env-empty.json"), env: C("env-only-gitrepos.json") });
  record("C1 缺 jenkins.baseUrl → exit 1 + 明确报错", r.status === 1 && r.stderr.includes("缺少 jenkins.baseUrl"), `exit=${r.status} stderr=${r.stderr.trim()}`);
}
// C2 缺 trackFile → exit 1
{
  const r = await runScript({ config: C("env-empty.json"), env: C("env-no-trackfile.json") });
  record("C2 缺 trackFile → exit 1 + 明确报错", r.status === 1 && r.stderr.includes("缺少 trackFile"), `exit=${r.status} stderr=${r.stderr.trim()}`);
}
// C3 jobs 非数组 → exit 1
{
  const r = await runScript({ config: C("env-empty.json"), env: C("env-jobs-not-array.json") });
  record("C3 jobs 非数组 → exit 1 + 明确报错", r.status === 1 && r.stderr.includes("缺少 jobs"), `exit=${r.status} stderr=${r.stderr.trim()}`);
}
// C4 深合并: 环境层 trackFile 覆盖技能层; jobs 数组整体替换(只扫 beta)
{
  const r = await runScript({
    config: C("skill-layer.json"),
    env: C("env-layer.json"),
    args: ["--output", S("out-c4.json")],
  });
  const betaRequested = r.requests.some((p) => p.includes("job-beta"));
  const alphaRequested = r.requests.some((p) => p.includes("job-alpha"));
  const onlyBeta = r.requests.length > 0 && r.requests.every((p) => p.includes("job-beta"));
  const envTrackWritten = existsSync(S("track-merged.json"));
  const skillTrackNotWritten = !existsSync(S("track-skill-layer.json"));
  record(
    "C4 深合并: 环境层 trackFile 覆盖技能层 + jobs 数组整体替换",
    r.status === 0 && betaRequested && !alphaRequested && onlyBeta && envTrackWritten && skillTrackNotWritten,
    `exit=${r.status} requests=${JSON.stringify(r.requests)} envTrack=${envTrackWritten} skillTrackCreated=${!skillTrackNotWritten}`
  );
}
// C5 技能层兜底: 环境层为空时 baseUrl/trackFile 取自技能层
{
  const r = await runScript({ config: C("skill-layer.json"), env: C("env-empty.json"), args: ["--output", S("out-c5.json")] });
  const alpha = r.requests.some((p) => p.includes("job-alpha"));
  record("C5 环境层为空 → 技能层配置兜底生效", r.status === 0 && alpha, `exit=${r.status} requests=${JSON.stringify(r.requests)}`);
}
// C6 BOM 容错
{
  const r = await runScript({ config: C("skill-layer-bom.json"), env: C("env-empty.json"), args: ["--output", S("out-c6.json")] });
  record("C6 带 UTF-8 BOM 的 config 可正常解析", r.status === 0 && existsSync(S("out-c6.json")), `exit=${r.status} stderr=${r.stderr.slice(0, 120)}`);
}
// C7 SKILL_ENV 指向不存在的文件 → 视为空,技能层独立工作
{
  const r = await runScript({ config: C("skill-layer.json"), env: join(SB, "configs", "no-such-file.json"), args: ["--output", S("out-c7.json")] });
  record("C7 SKILL_ENV 指向不存在文件 → 按空环境层处理", r.status === 0 && existsSync(S("out-c7.json")), `exit=${r.status} stderr=${r.stderr.slice(0, 120)}`);
}
// C8 未知参数 → exit 2
{
  const r = await runScript({ config: C("skill-layer.json"), env: C("env-empty.json"), args: ["--bogus"] });
  record("C8 未知 CLI 参数 → exit 2", r.status === 2 && r.stderr.includes("未知参数"), `exit=${r.status} stderr=${r.stderr.trim()}`);
}
// C9 trackFile 含 ~ 前缀 → 应展开到用户主目录
{
  const fakeHome = join(SB, "fakehome").replace(/\\/g, "/");
  writeJson(C("tilde.json"), {
    jenkins: { baseUrl: BASE },
    trackFile: "~/tilde-track/analyzed-builds.json",
    jobs: [{ enabled: true, name: "beta", path: "job/teamA/job/job-beta" }],
  });
  const tildeCwd = join(SB, "tilde-cwd");
  rmSync(tildeCwd, { recursive: true, force: true });
  mkdirSync(tildeCwd, { recursive: true });
  const r = await runScript({ config: C("tilde.json"), env: C("env-empty.json"), cwd: tildeCwd, userprofile: fakeHome, args: ["--output", S("out-c9.json")] });
  const expanded = existsSync(join(fakeHome, "tilde-track", "analyzed-builds.json"));
  const literalTilde = existsSync(join(tildeCwd, "~"));
  record("C9 trackFile 以 ~ 开头 → 展开到用户主目录(不产生字面 ~ 目录)", expanded && !literalTilde, `expanded=${expanded} literalTildeDir=${literalTilde} exit=${r.status} stderr=${r.stderr.split("\n")[0]}`);
}

// ============================================================
// P 组: 状态更新(配对逻辑 + trackFile)
// ============================================================
console.log(`\n===== [${phase}] P 组: 状态更新 =====`);

// P1 黄金序列
let p1out, p1track;
{
  rmSync(S("track-p1.json"), { force: true });
  rmSync(S("out-p1.json"), { force: true });
  const r = await runScript({ config: C("full-alpha.json"), env: C("env-empty.json"), args: ["--output", S("out-p1.json")] });
  p1out = existsSync(S("out-p1.json")) ? readJson(S("out-p1.json")) : null;
  p1track = existsSync(S("track-p1.json")) ? readJson(S("track-p1.json")) : null;
  const pairs = p1out?.pairs || [];
  const pOk =
    r.status === 0 &&
    pairs.length === 2 &&
    pairs[0].jobName === "alpha" &&
    JSON.stringify(pairs[0].failBuilds) === "[11,12]" &&
    pairs[0].fixBuild === 13 &&
    pairs[0].hasFix === true;
  const a = p1track?.analyzed || {};
  const trackOk =
    a["job/teamA/job/job-alpha#10"] === "success:w=?" &&
    a["job/teamA/job/job-alpha#15"] === "skip:ABORTED" &&
    a["job/teamA/job/job-alpha#17"] === undefined && // 尾部失败是瞬态（修复未到来），不预写 no-fix-found
    a["job/teamA/job/job-alpha#14"] === undefined && // 配对中的 FAILURE 不标记,留给阶段1/2
    p1out.totalBuilds === 9 && // 只有 alpha 有构建: disabled 不请求, 不可达 404 无 builds
    p1out.totalFailures === 4 &&
    p1out.totalPairs === 2;
  const buildingNotWritten = a["job/teamA/job/job-alpha#18"] === undefined; // BUILDING 进行中语义,不落账
  record("P1 黄金序列配对+跟踪状态", pOk && trackOk && buildingNotWritten, `pairs=${JSON.stringify(pairs)} analyzed=${JSON.stringify(a)} totals=${p1out?.totalBuilds}/${p1out?.totalFailures}/${p1out?.totalPairs} stdout=${r.stdout.slice(0, 200)}`);
}

// P1b ABORTED 不打断相邻配对: [14]→16
{
  const pairs = p1out?.pairs || [];
  const second = pairs.find((p) => p.fixBuild === 16);
  record("P1b ABORTED 不打断 FAILURE→SUCCESS 相邻配对 ([14]→16)", !!second && JSON.stringify(second.failBuilds) === "[14]", `pairs=${JSON.stringify(pairs)}`);
}

// P2 幂等: 立即重跑 → pairs 相同, track 内容不变
{
  const before = JSON.stringify(p1track);
  const r = await runScript({ config: C("full-alpha.json"), env: C("env-empty.json"), args: ["--output", S("out-p2.json")] });
  if (!existsSync(S("track-p1.json"))) {
    record("P2 幂等重跑: pending pairs 一致, track 无重复条目", false, "track-p1.json 不存在(P1 运行未完成)");
  } else {
    const after = readJson(S("track-p1.json"));
    const out2 = readJson(S("out-p2.json"));
    const pairsEqual = JSON.stringify(out2.pairs) === JSON.stringify(p1out.pairs);
    record("P2 幂等重跑: pending pairs 一致, track 无重复条目", r.status === 0 && pairsEqual && JSON.stringify(after) === before, `pairsEqual=${pairsEqual} trackUnchanged=${JSON.stringify(after) === before}`);
  }
}

// P3 预置已分析: pair 首键在 analyzed → 该对跳过
{
  writeJson(S("track-p3.json"), { last_analyzed: {}, analyzed: { "job/teamA/job/job-alpha#11": "done" }, runHistory: [] });
  writeJson(C("p3.json"), {
    jenkins: { baseUrl: BASE },
    trackFile: S("track-p3.json"),
    jobs: [{ enabled: true, name: "alpha", path: "job/teamA/job/job-alpha" }],
  });
  const r = await runScript({ config: C("p3.json"), env: C("env-empty.json"), args: ["--output", S("out-p3.json")] });
  const out = readJson(S("out-p3.json"));
  record("P3 已分析首键的构建对被跳过", r.status === 0 && out.totalPairs === 1 && out.pairs[0].fixBuild === 16, `pairs=${JSON.stringify(out.pairs)}`);
}

// P4/P5 disabled 任务不请求 + 不可达任务告警跳过、退出码 0 + 空任务列表
{
  const r = await runScript({ config: C("full-alpha.json"), env: C("env-empty.json"), args: ["--output", S("out-p45.json")] });
  const betaHit = r.requests.some((p) => p.includes("job-beta"));
  const goneHit = r.requests.some((p) => p.includes("job-gone"));
  const warn = r.stdout.includes("WARN") && r.stdout.includes("job-gone");
  const noBuilds = r.stdout.includes("(no builds)");
  record("P4 enabled:false 任务不被扫描", !betaHit, `betaRequested=${betaHit}`);
  record("P5 不可达任务 WARN 跳过且整体 exit 0, 空构建列表正常", r.status === 0 && goneHit && warn && noBuilds, `exit=${r.status} warn=${warn} noBuilds=${noBuilds}`);
}

// P6 输出格式: UTF-8 无 BOM + CRLF + 字段完整; track 同样无 BOM
{
  const r = await runScript({ config: C("full-alpha.json"), env: C("env-empty.json"), args: ["--output", S("out-p6.json")] });
  const raw = readFileSync(S("out-p6.json"), "utf8");
  const rawTrack = readFileSync(S("track-p1.json"), "utf8");
  const out = readJson(S("out-p6.json"));
  const keys = Object.keys(out).sort().join(",");
  record(
    "P6 输出格式: 无 BOM + CRLF + 字段 {generatedAt,totalBuilds,totalFailures,totalPairs,pairs}",
    r.status === 0 && !raw.startsWith("\uFEFF") && raw.includes("\r\n") && keys === "generatedAt,pairs,totalBuilds,totalFailures,totalPairs" && !rawTrack.startsWith("\uFEFF"),
    `keys=${keys} bom=${raw.startsWith("\uFEFF")} crlf=${raw.includes("\r\n")}`
  );
}

// P7 trackFile 不存在时自动初始化空结构
{
  rmSync(S("track-p7.json"), { force: true });
  writeJson(C("p7.json"), {
    jenkins: { baseUrl: BASE },
    trackFile: S("track-p7.json"),
    jobs: [{ enabled: true, name: "beta", path: "job/teamA/job/job-beta" }],
  });
  const r = await runScript({ config: C("p7.json"), env: C("env-empty.json"), args: ["--output", S("out-p7.json")] });
  const t = existsSync(S("track-p7.json")) ? readJson(S("track-p7.json")) : null;
  const okShape = t && Array.isArray(t.runHistory) && t.analyzed && t.last_analyzed;
  record("P7 首次运行自动初始化跟踪文件结构", r.status === 0 && !!okShape, `track=${JSON.stringify(t)?.slice(0, 120)}`);
}

// ============================================================
// T 组: 技能目录清洁度
// ============================================================
console.log(`\n===== [${phase}] T 组: 技能目录清洁度 =====`);

// T1 不传 --output 时的默认输出位置(设计要求: 不得写入技能目录)
{
  const skillTmpPending = join(SKILL_DIR, "tmp", "pending-pairs.json");
  writeJson(C("t1.json"), {
    jenkins: { baseUrl: BASE },
    trackFile: S("track-t1.json"),
    jobs: [{ enabled: true, name: "beta", path: "job/teamA/job/job-beta" }],
  });
  const before = existsSync(skillTmpPending) ? statSync(skillTmpPending).mtimeMs : 0;
  const r = await runScript({ config: C("t1.json"), env: C("env-empty.json") });
  const nowExists = existsSync(skillTmpPending);
  const freshWrite = nowExists && statSync(skillTmpPending).mtimeMs > before;
  record(
    "T1 默认输出不得写入技能目录 tmp/",
    !(freshWrite || (nowExists && before === 0)),
    `freshWrite=${freshWrite} newlyCreated=${nowExists && before === 0} exit=${r.status}`
  );
}
// T2 默认输出应与 trackFile 同目录(rawDir), 技能目录零写入
{
  writeJson(C("t2.json"), {
    jenkins: { baseUrl: BASE },
    trackFile: S("track-t2.json"),
    jobs: [{ enabled: true, name: "beta", path: "job/teamA/job/job-beta" }],
  });
  rmSync(S("track-t2.json"), { force: true });
  rmSync(S("pending-pairs.json"), { force: true });
  const snapshotBefore = listSkillFiles();
  const r = await runScript({ config: C("t2.json"), env: C("env-empty.json") });
  const expectedOut = S("pending-pairs.json");
  const outAtTrackDir = existsSync(expectedOut);
  const skillDirClean = JSON.stringify(snapshotBefore) === JSON.stringify(listSkillFiles());
  record("T2 默认输出=trackFile 同目录, 技能目录文件清单零变化", r.status === 0 && outAtTrackDir && skillDirClean, `outAtTrackDir=${outAtTrackDir} skillDirClean=${skillDirClean} stdout=${r.stdout.slice(0, 150)}`);
}

// ============================================================
// S 组: session.mjs 工作流状态机(合成 pending-pairs,不依赖服务器)
// ============================================================
console.log(`\n===== [${phase}] S 组: session.mjs 状态机 =====`);

const SESSION = join(SKILL_DIR, "scripts", "session.mjs");
const SESS_DIR = join(SB, "sess");
const WF = join(SESS_DIR, "workflow.json");
const TRACK_S = join(SESS_DIR, "analyzed-builds.json");
const PENDING_S = join(SESS_DIR, "pending-pairs.json"); // session.mjs 按 trackFile 同目录推导
// S8 的知识文件夹具：新门禁要求真实存在于 knowledgeBase.rawDir 内且内容含错误码 token
const KNOWLEDGE_S = join(SESS_DIR, "raw", "details", "x.md");

function resetSessState() {
  rmSync(SESS_DIR, { recursive: true, force: true });
  mkdirSync(join(SESS_DIR, "raw", "details"), { recursive: true });
  writeFileSync(KNOWLEDGE_S, "# C2061: S 组夹具知识文件\nerror C2061 identifier\n", "utf8");
  writeJson(PENDING_S, {
    generatedAt: localNow(),
    totalBuilds: 6,
    totalFailures: 3,
    totalPairs: 2,
    pairs: [
      { jobName: "alpha", jobPath: "job/teamA/job/job-alpha", failBuilds: [31], fixBuild: 32, hasFix: true },
      { jobName: "alpha", jobPath: "job/teamA/job/job-alpha", failBuilds: [35], fixBuild: 36, hasFix: true },
    ],
  });
  writeJson(C("sess.json"), {
    jenkins: { baseUrl: BASE },
    trackFile: TRACK_S,
    knowledgeBase: { rawDir: join(SESS_DIR, "raw").split("\\").join("/"), wikiDir: join(SESS_DIR, "wiki").split("\\").join("/") },
    jobs: [{ enabled: true, name: "alpha", path: "job/teamA/job/job-alpha" }],
  });
}
function localNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
const runSess = (args) => runScript({ script: SESSION, env: C("env-empty.json"), args: [...args, "--config", C("sess.json")] });

// S1 status 无会话 → exit 0, 提示跑 next
{
  resetSessState();
  const r = await runSess(["status"]);
  record("S1 status: 无会话时 exit 0 并给出 next 提示", r.status === 0 && r.stdout.includes("会话: 无") && r.stdout.includes("pending-pairs"), `exit=${r.status} out=${r.stdout.replace(/\r?\n/g, " | ").slice(0, 200)}`);
}
// S2 next 无 pending → exit 1
{
  rmSync(PENDING_S, { force: true });
  const r = await runSess(["next"]);
  record("S2 next: pending-pairs 不存在 → exit 1 提示先扫描", r.status === 1 && r.stderr.includes("scan-pairs"), `exit=${r.status} err=${r.stderr.trim().slice(0, 100)}`);
}
// S3 next 正常领取
{
  resetSessState();
  const r = await runSess(["next"]);
  const wf = existsSync(WF) ? readJson(WF) : null;
  record(
    "S3 next: 领取第一个未分析对并原子写入 workflow.json",
    r.status === 0 && wf?.pair?.failBuilds?.[0] === 31 && wf?.pair?.fixBuild === 32 && wf?.status === "in_progress" && wf?.stage_gates?.["1-analyze"]?.status === "pending",
    `exit=${r.status} wf=${JSON.stringify(wf)?.slice(0, 160)}`
  );
}
// S4 next 单实例锁
{
  const r = await runSess(["next"]);
  record("S4 next: 已有进行中会话 → 拒绝领取(单实例锁)", r.status === 1 && r.stderr.includes("进行中的会话"), `exit=${r.status} err=${r.stderr.trim().slice(0, 100)}`);
}
// S5 finish 未收尾 → 门禁拦截
{
  const r = await runSess(["finish"]);
  record("S5 finish: 1-analyze 未收尾 → exit 1 门禁拦截", r.status === 1 && r.stderr.includes("门禁"), `exit=${r.status} err=${r.stderr.trim().slice(0, 120)}`);
}
// S6 stage done 缺 --result → exit 2
{
  const r = await runSess(["stage", "1-analyze", "done"]);
  record("S6 stage done: 缺 --result → exit 2", r.status === 2 && r.stderr.includes("--result"), `exit=${r.status} err=${r.stderr.trim().slice(0, 100)}`);
}
// S7 stage done 非法 result → exit 1
{
  const r = await runSess(["stage", "1-analyze", "done", "--result", "failure:bogus"]);
  record("S7 stage done: 非法结论串 → exit 1 拒绝", r.status === 1 && r.stderr.includes("grammar"), `exit=${r.status} err=${r.stderr.trim().slice(0, 100)}`);
}
// S19b 非法阶段名/状态 → exit 2
{
  const r1 = await runSess(["stage", "2-track", "done"]);
  const r2 = await runSess(["stage", "1-analyze", "pending"]);
  record("S19 stage: 非法阶段名/非法状态 → exit 2", r1.status === 2 && r2.status === 2, `stage2=${r1.status} pending=${r2.status}`);
}
// S8 stage done 合法 result + knowledge + success（knowledge 须真实存在且在 rawDir 内——门禁契约）
{
  const r = await runSess(["stage", "1-analyze", "done", "--result", "failure:score=9:C2061:fix=#32", "--knowledge", KNOWLEDGE_S, "--success", "success:w=12"]);
  const wf = readJson(WF);
  record(
    "S8 stage done: 合法结论串+知识文件+success 落入会话",
    r.status === 0 && wf.result === "failure:score=9:C2061:fix=#32" && wf.knowledge_file === KNOWLEDGE_S && wf.success_value === "success:w=12",
    `exit=${r.status} result=${wf.result}`
  );
}
// S9 重复收尾 → exit 1
{
  const r = await runSess(["stage", "1-analyze", "done", "--result", "failure:score=9:C2061:fix=#32"]);
  record("S9 stage: 已收尾后重复收尾 → exit 1", r.status === 1 && r.stderr.includes("不得重复"), `exit=${r.status} err=${r.stderr.trim().slice(0, 100)}`);
}
// S10 finish 落账
{
  const r = await runSess(["finish"]);
  const track = readJson(TRACK_S);
  const wf = readJson(WF);
  const rh = track.runHistory?.[0];
  const rhKeys = rh ? Object.keys(rh).sort().join(",") : "";
  const expectedKeys = ["buildsAnalyzed", "buildsSkipped", "failurePairsFound", "infraFailures", "knowledgeWritten", "remaining", "timestamp"].sort().join(",");
  const rawTrack = readFileSync(TRACK_S, "utf8");
  record(
    "S10 finish: analyzed{} 落账 + runHistory 恰好 7 字段 + 会话终结 + 账本无BOM CRLF",
    r.status === 0 &&
      track.analyzed["job/teamA/job/job-alpha#31"] === "failure:score=9:C2061:fix=#32" &&
      track.analyzed["job/teamA/job/job-alpha#32"] === "success:w=12" &&
      track.last_analyzed["job/teamA/job/job-alpha"] === 32 &&
      rhKeys === expectedKeys &&
      rh?.remaining === 1 &&
      rh?.knowledgeWritten === 1 &&
      wf.status === "done" &&
      wf.stage_gates["2-track"].status === "done" &&
      !rawTrack.startsWith("\uFEFF") &&
      rawTrack.includes("\r\n"),
    `exit=${r.status} keys=${rhKeys} analyzed=${JSON.stringify(track.analyzed)}`
  );
}
// S11 next 领取第二对(不重复领取已落账的)
{
  const r = await runSess(["next"]);
  const wf = readJson(WF);
  record("S11 next: 终结后领取下一对(跳过已落账)", r.status === 0 && wf.pair.failBuilds[0] === 35 && wf.status === "in_progress", `exit=${r.status} fail=${wf.pair?.failBuilds}`);
}
// S12/S13 error 路径
{
  const r1 = await runSess(["stage", "1-analyze", "error", "--reason", "api down"]);
  const r2 = await runSess(["finish"]);
  const track = readJson(TRACK_S);
  record("S12/13 error→finish: failure:error:{reason} 落账", r1.status === 0 && r2.status === 0 && track.analyzed["job/teamA/job/job-alpha#35"] === "failure:error:api down", `stage=${r1.status} finish=${r2.status} v=${track.analyzed["job/teamA/job/job-alpha#35"]}`);
}
// S15 next 无可领对
{
  const r = await runSess(["next"]);
  record("S15 next: 全部落账后 → exit 1 报告没有新对", r.status === 1 && (r.stdout + r.stderr).includes("没有新的构建对"), `exit=${r.status}`);
}
// S14 abandon: 僵死会话丢弃并防重复领取
{
  resetSessState();
  await runSess(["next"]);
  const r = await runSess(["abandon", "--reason", "stale crash"]);
  const track = readJson(TRACK_S);
  const wf = readJson(WF);
  const r2 = await runSess(["next"]);
  const wf2 = readJson(WF);
  record(
    "S14 abandon: 落账 failure:error 防重复领取, 之后 next 取下一对",
    r.status === 0 && track.analyzed["job/teamA/job/job-alpha#31"] === "failure:error:stale crash" && wf.status === "done" && r2.status === 0 && wf2.pair.failBuilds[0] === 35,
    `abandon=${r.status} next2=${r2.status} fail=${wf2.pair?.failBuilds}`
  );
}
// S18 :see= 后缀(隔离状态,S14 已重置过;放在链式用例之后避免破坏 S8-S13 状态)
// 门禁契约：:see= 必须指向 rawDir 内真实存在的知识文件（夹具 KNOWLEDGE_S 满足）
{
  resetSessState();
  await runSess(["next"]);
  const r2 = await runSess(["stage", "1-analyze", "done", "--result", "failure:score=6:C1083:fix=#32:see=no-such-file.md"]);
  record("S18b stage done: :see= 指向不存在文件 → exit 1 拒绝", r2.status === 1 && r2.stderr.includes(":see="), `exit=${r2.status}`);
  const r = await runSess(["stage", "1-analyze", "done", "--result", `failure:score=6:C1083:fix=#32:see=${KNOWLEDGE_S}`]);
  record("S18 stage done: 重复模式 :see= 后缀被接受（指向真实知识文件）", r.status === 0, `exit=${r.status} err=${r.stderr.trim().slice(0, 100)}`);
}

// S16/S17 list + status 续跑指针 + 无 .tmp 残留
{
  const rl = await runSess(["list"]);
  const rs = await runSess(["status"]);
  const tmpLeft = listFiles(SESS_DIR).filter((f) => f.endsWith(".tmp"));
  record(
    "S16/17 list+status: 会话指针可见, 目录无 .tmp 残留(原子写)",
    rl.status === 0 && rs.status === 0 && rs.stdout.includes("对: alpha") && rs.stdout.includes("进行中") && rs.stdout.includes("配置: baseUrl=") && tmpLeft.length === 0,
    `list=${rl.status} status=${rs.status} tmp=${JSON.stringify(tmpLeft)}`
  );
}

// ============================================================
// E 组: 端到端(mock Jenkins): scan → next → stage → finish → next
// ============================================================
console.log(`\n===== [${phase}] E 组: 端到端编排流 =====`);
{
  const EDIR = join(SB, "e2e");
  rmSync(EDIR, { recursive: true, force: true });
  mkdirSync(EDIR, { recursive: true });
  const trackE = join(EDIR, "analyzed-builds.json");
  mkdirSync(join(EDIR, "kb", "details"), { recursive: true });
  writeFileSync(join(EDIR, "kb", "details", "fake.md"), "# LNK2019: e2e 夹具知识文件\nLNK2019 unresolved external\n", "utf8");
  writeJson(C("e2e.json"), {
    jenkins: { baseUrl: BASE },
    trackFile: trackE,
    knowledgeBase: { rawDir: join(EDIR, "kb").split("\\").join("/"), wikiDir: join(EDIR, "kb-wiki").split("\\").join("/") },
    jobs: [{ enabled: true, name: "alpha", path: "job/teamA/job/job-alpha" }],
  });
  const runE = (script, args) => runScript({ script, env: C("env-empty.json"), args: [...args, "--config", C("e2e.json")] });

  const scan = await runE(SCRIPT, []);
  const n1 = await runE(SESSION, ["next"]);
  const wf1 = readJson(join(EDIR, "workflow.json"));
  const st1 = await runE(SESSION, ["stage", "1-analyze", "done", "--result", "failure:score=8:LNK2019:fix=#13", "--knowledge", join(EDIR, "kb", "details", "fake.md")]);
  const fin1 = await runE(SESSION, ["finish"]);
  const track1 = readJson(trackE);
  const n2 = await runE(SESSION, ["next"]);
  const wf2 = readJson(join(EDIR, "workflow.json"));
  const st2 = await runE(SESSION, ["stage", "1-analyze", "error", "--reason", "timeout"]);
  const fin2 = await runE(SESSION, ["finish"]);
  const track2 = readJson(trackE);
  const n3 = await runE(SESSION, ["next"]);
  const ok =
    scan.status === 0 &&
    n1.status === 0 && wf1.pair.failBuilds.join(",") === "11,12" && wf1.pair.fixBuild === 13 &&
    st1.status === 0 && fin1.status === 0 &&
    track1.analyzed["job/teamA/job/job-alpha#11"] === "failure:score=8:LNK2019:fix=#13" &&
    track1.analyzed["job/teamA/job/job-alpha#12"] === "failure:score=8:LNK2019:fix=#13" &&
    track1.runHistory[0].remaining === 1 &&
    n2.status === 0 && wf2.pair.failBuilds[0] === 14 &&
    st2.status === 0 && fin2.status === 0 &&
    track2.analyzed["job/teamA/job/job-alpha#14"] === "failure:error:timeout" &&
    track2.runHistory.length === 2 &&
    n3.status === 1;
  record("E1 编排闭环: scan→next→分析收尾→落账→下一对→error→落账→无对可领", ok, `scan=${scan.status} n1=${n1.status} fin1=${fin1.status} n2=${n2.status} fin2=${fin2.status} n3=${n3.status}`);
}

function listFiles(dir) {
  return spawnSync("cmd", ["/c", "dir", "/s", "/b", "/a:-d", dir], { encoding: "utf8" }).stdout.trim().split(/\r?\n/).filter(Boolean);
}

server.close();

// 汇总
const passed = results.filter((r) => r.passed).length;
console.log(`\n===== 结果: ${passed}/${results.length} PASS =====`);
writeFileSync(join(here, `results-${phase}.json`), JSON.stringify({ phase, baseUrl: BASE, results, summary: { passed, total: results.length } }, null, 2), "utf8");
