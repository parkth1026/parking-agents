// run-contract-tests.mjs — 跨技能契约测试（G1-G5 修复验收）
//
// jenkins-log-auto-learning / jenkins-pair-analyze / ue-error-solver /
// epic-ue-assistant 四个技能的交接面在此钉死：
//
//   C 组  session.mjs 知识产物门禁（G1 路径校验 / G2 可检索性 / G3 score 上界）
//   K 组  知识库目录契约（G4/G5：两个写入方命名与位置口径一致、search-kb 双向可发现）
//   E 组  epic-ue-assistant CLI 契约（G5：epic-query.md 规定的调用形态被脚本真实接受）
//
// 全部用例沙箱内运行，不触碰真实账本/知识库/Epic 网络。
// 用法: node run-contract-tests.mjs   （退出码 0=全过, 1=有失败）

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SB = join(here, "sandbox");
const JLA = "D:/GIT_dev/Claude_skills/.claude/skills/jenkins-log-auto-learning";
const UES = "D:/GIT_dev/Claude_skills/.claude/skills/ue-error-solver";
const EPI = "D:/GIT_dev/Claude_skills/.claude/skills/epic-ue-assistant";
const SESSION = join(JLA, "scripts", "session.mjs");
const UES_CLI = join(UES, "scripts", "UeErrorSolver.mjs");
const EPI_CLI = join(EPI, "scripts", "epic-assistant.mjs");

rmSync(SB, { recursive: true, force: true });
for (const d of ["state/raw", "state/wiki", "kb/raw", "kb/wiki", "repos", "outside"]) {
  mkdirSync(join(SB, d), { recursive: true });
}

const results = [];
let n = 0, failed = 0;
function check(name, passed, evidence) {
  results.push({ id: ++n, name, passed: !!passed, evidence: String(evidence ?? "").slice(0, 400) });
  if (!passed) failed++;
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${evidence !== undefined ? "  | " + String(evidence).slice(0, 170) : ""}`);
}
function run(script, args, envFile) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    if (envFile) env.SKILL_ENV = envFile;
    const p = spawn(process.execPath, [script, ...args], { env });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("error", (e) => resolve({ code: -1, out: String(e) }));
    p.on("close", (code) => resolve({ code, out }));
  });
}
const fwd = (p) => p.split("\\").join("/");
const j = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

// ============ C 组：session 知识产物门禁 ============
console.log("\n===== C. session.mjs 知识产物门禁（G1/G2/G3）=====");

const JENV = join(SB, "jenkins-env.json");
writeFileSync(JENV, JSON.stringify({
  jenkins: { baseUrl: "http://127.0.0.1:1" }, // session 不访问 Jenkins，仅过配置校验
  gitRepos: fwd(join(SB, "repos")),
  knowledgeBase: { rawDir: fwd(join(SB, "state", "raw")), wikiDir: fwd(join(SB, "state", "wiki")) },
  trackFile: fwd(join(SB, "state", "raw", "analyzed-builds.json")),
  tmpDir: fwd(join(SB, "state", "tmp")),
  jobs: [{ enabled: true, name: "cjob", path: "job/contract/job/cjob" }],
}, null, 2));

const TRACK = join(SB, "state", "raw", "analyzed-builds.json");
const PENDING = join(SB, "state", "raw", "pending-pairs.json");
const WORKFLOW = join(SB, "state", "raw", "workflow.json");
const RAWDIR = join(SB, "state", "raw");
// 5 对构建，每对承载一个门禁用例
writeFileSync(PENDING, JSON.stringify({
  generatedAt: "2026-08-15T00:00:00", totalBuilds: 10, totalFailures: 5, totalPairs: 5,
  pairs: [10, 20, 30, 40, 50].map((fb) => ({
    jobName: "cjob", jobPath: "job/contract/job/cjob", failBuilds: [fb], fixBuild: fb + 1, hasFix: true,
  })),
}, null, 2));
writeFileSync(TRACK, JSON.stringify({ last_analyzed: {}, analyzed: {}, runHistory: [] }, null, 2));

const kf = (name, title, body) => {
  const p = join(RAWDIR, name);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, title === null ? `${body ?? ""}\n` : `# ${title}\n${body ?? ""}\n`, "utf8");
  return fwd(p);
};
// ue-error-solver 输出 pretty JSON，可能有前置 warning 行——截取首个 { 到末个 } 再解析
const parseCliJson = (out) => JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
const sess = (...args) => run(SESSION, args, JENV);
let r = await sess("next");
check("C1 领取首对（夹具就绪）", r.code === 0, r.out.split("\n")[0]);

// G3: score 上界
r = await sess("stage", "1-analyze", "done", "--result", "failure:score=99:C2061:fix=#11");
check("C2 [G3] score=99 被拒（满分 10）", r.code === 1 && r.out.includes("grammar"), r.out.split("\n")[0]);
r = await sess("stage", "1-analyze", "done", "--result", "failure:score=11:C2061:fix=#11");
check("C3 [G3] score=11 被拒", r.code === 1, r.code);
r = await sess("stage", "1-analyze", "done", "--result", "failure:score=10:C2061:fix=#11");
check("C4 [G3] score=10 上界放行", r.code === 0, r.out.split("\n")[0]);
r = await sess("finish");
check("C5 score=10 正常落账", r.code === 0 && j(TRACK).analyzed["job/contract/job/cjob#10"] === "failure:score=10:C2061:fix=#11", r.code);

// G1: knowledge 路径
await sess("next");
r = await sess("stage", "1-analyze", "done", "--result", "failure:score=8:C2061:fix=#21", "--knowledge", fwd(join(RAWDIR, "details", "ghost.md")));
check("C6 [G1] knowledge 不存在被拒", r.code === 1 && r.out.includes("不存在"), r.out.split("\n")[0]);
const outside = fwd(join(SB, "outside", "evil.md"));
mkdirSync(join(SB, "outside"), { recursive: true });
writeFileSync(join(SB, "outside", "evil.md"), "# C2061: rawDir 外的文件\nC2061 content\n", "utf8");
r = await sess("stage", "1-analyze", "done", "--result", "failure:score=8:C2061:fix=#21", "--knowledge", outside);
check("C7 [G1] knowledge 在 rawDir 外被拒（只写 rawDir 约束机械化）", r.code === 1 && r.out.includes("rawDir"), r.out.split("\n")[0]);
r = await sess("stage", "1-analyze", "done", "--result", "failure:score=8:C2061:fix=#21", "--knowledge", kf("details/ok-20.md", "C2061: ok"));
check("C8 [G1] rawDir 内存在的 knowledge 放行", r.code === 0, r.out.split("\n")[0]);
r = await sess("finish");
check("C9 合法 knowledge 落账 knowledgeWritten=1", j(TRACK).runHistory.at(-1).knowledgeWritten === 1, JSON.stringify(j(TRACK).runHistory.at(-1)));

// G2: 内容可检索性
await sess("next");
r = await sess("stage", "1-analyze", "done", "--result", "failure:score=7:C4180:fix=#31", "--knowledge", kf("details/no-heading-30.md", null, "C4180 内容但完全没有标题行"));
check("C10 [G2] 缺一级标题被拒", r.code === 1 && r.out.includes("一级标题"), r.out.split("\n")[0]);
r = await sess("stage", "1-analyze", "done", "--result", "failure:score=7:C4180:fix=#31", "--knowledge", kf("details/no-token-30.md", "缺少include导致编译失败"));
check("C11 [G2] 内容不含错误码 token 被拒（防搜索沉底）", r.code === 1 && r.out.includes("token") && r.out.includes("C4180"), r.out.split("\n")[0]);
r = await sess("stage", "1-analyze", "done", "--result", "failure:infra:disk-full-on-agent", "--knowledge", kf("details/infra-30.md", "磁盘满：构建机空间耗尽"));
check("C12 [G2] infra 结论的 reason token 同样校验", r.code === 1 && r.out.includes("disk-full-on-agent"), r.out.split("\n")[0]);
r = await sess("stage", "1-analyze", "done", "--result", "failure:infra:disk-full-on-agent", "--knowledge", kf("details/infra-ok-30.md", "DiskFull: 磁盘满 disk-full-on-agent"));
check("C13 [G2] infra token 存在时放行", r.code === 0, r.out.split("\n")[0]);
await sess("finish");

// G1: :see= 指针
await sess("next");
r = await sess("stage", "1-analyze", "done", "--result", "failure:score=6:C2061:fix=#41:see=" + fwd(join(RAWDIR, "details", "ghost.md")));
check("C14 [G1] :see= 指向不存在的文件被拒", r.code === 1 && r.out.includes(":see="), r.out.split("\n")[0]);
const seeTarget = kf("details/see-target-40.md", "C2061: 既有知识");
r = await sess("stage", "1-analyze", "done", "--result", "failure:score=6:C2061:fix=#41:see=" + seeTarget);
check("C15 [G1] :see= 指向 rawDir 内存在文件放行", r.code === 0, r.out.split("\n")[0]);
r = await sess("finish");
check("C16 :see= 落账完整", j(TRACK).analyzed["job/contract/job/cjob#40"].endsWith(basename(seeTarget)), j(TRACK).analyzed["job/contract/job/cjob#40"]);

// score=0 下界
await sess("next");
r = await sess("stage", "1-analyze", "done", "--result", "failure:score=0:UNKNOWN:fix=#51");
check("C17 [G3] score=0 下界放行", r.code === 0, r.out.split("\n")[0]);
await sess("finish");
check("C18 无 knowledge 时 knowledgeWritten=0（不虚记）", j(TRACK).runHistory.at(-1).knowledgeWritten === 0, JSON.stringify(j(TRACK).runHistory.at(-1)));

// ============ K 组：知识库目录契约（G4/G5） ============
console.log("\n===== K. 知识库目录契约（ue-error-solver ↔ pair-analyze）=====");

const KENV = join(SB, "kb-env.json");
writeFileSync(KENV, JSON.stringify({
  gitRepos: fwd(join(SB, "repos")),
  knowledgeBase: { rawDir: fwd(join(SB, "kb", "raw")), wikiDir: fwd(join(SB, "kb", "wiki")) },
  tmpDir: fwd(join(SB, "kb", "tmp")),
}, null, 2));
const KRAW = join(SB, "kb", "raw");
const ues = (...args) => run(UES_CLI, args, KENV);

// 模拟 pair-analyze 侧写入的文件（details 与 scratch 两个落点）
mkdirSync(join(KRAW, "details"), { recursive: true });
mkdirSync(join(KRAW, "scratch"), { recursive: true });
writeFileSync(join(KRAW, "details", "twe-100-C2061-MissingInclude.md"), "# C2061: missing include\nerror C2061 identifier\n", "utf8");
writeFileSync(join(KRAW, "scratch", "aes6-200-LNK2019-Unresolved.md"), "# LNK2019: unresolved external\nLNK2019 link error\n", "utf8");
// 正文缺 token、只在文件名里有错误码的历史文件（G4 文件名兜底的靶子）
writeFileSync(join(KRAW, "scratch", "twe-300-DiskSpaceExhausted.md"), "# 磁盘空间不足\n构建机磁盘满\n", "utf8");

r = await ues("search-kb", "--terms", "C2061");
check("K1 [G5] search-kb 能发现 pair-analyze 写入 details/ 的文件", r.code === 0 && r.out.includes("twe-100-C2061"), (r.out.match(/"filePath":.*"/g) || ["无"]).join(",").slice(0, 150));
r = await ues("search-kb", "--terms", "LNK2019");
check("K2 [G5] search-kb 能发现 pair-analyze 写入 scratch/ 的文件", r.code === 0 && r.out.includes("aes6-200-LNK2019"), r.code);
r = await ues("search-kb", "--terms", "DiskSpaceExhausted");
check("K3 [G4] 正文缺 token 时文件名兜底匹配（历史沉底文件可发现）", r.code === 0 && r.out.includes("twe-300-DiskSpaceExhausted") && r.out.includes("文件名匹配"), r.out.split("\n")[0]);

r = await ues("save-knowledge", "--job-short", "aes6", "--build", "900", "--error-code", "C4180", "--short-desc", "missing include fix", "--content", "root cause + verified fix");
{
  const saved = parseCliJson(r.out);
  check("K4 [G4] save-knowledge 命名对齐 pair-analyze 口径（{job}-{build}-{code}-{desc}.md）",
    r.code === 0 && /[\\/]aes6-900-C4180-/.test(saved.savedPath) && saved.savedPath.includes("details"), saved.savedPath);
  const content = readFileSync(saved.savedPath, "utf8");
  check("K5 [G4] 头部对齐（一级标题含错误码 + Job/Builds 行）",
    content.startsWith("# C4180:") && content.includes("**Job**: aes6") && content.includes("**Builds**: #900"), content.split("\r\n").slice(0, 3).join(" | "));
}
r = await ues("save-knowledge", "--job-short", "aes6", "--build", "901", "--error-code", "C4180", "--short-desc", "missing include fix", "--content", "second occurrence");
{
  const saved2 = parseCliJson(r.out);
  check("K6 [G4] 同码同描述仍追加 Update 段落（行为保持）",
    r.code === 0 && saved2.savedPath.includes("aes6-900-C4180") && readFileSync(saved2.savedPath, "utf8").includes("## Update: aes6#901"), saved2.savedPath);
}
r = await ues("search-kb", "--terms", "C4180");
check("K7 [G5] ue-error-solver 写入的文件能被 search-kb 发现（含新命名）", r.code === 0 && r.out.includes("aes6-900-C4180"), r.code);

// ============ E 组：epic-ue-assistant CLI 契约（G5） ============
console.log("\n===== E. epic-ue-assistant CLI 契约 =====");

// epic-query.md 规定的调用形态：ask --question（可选 --conversation-id/--timeout/--config）
const epi = (...args) => run(EPI_CLI, args);
r = await epi();
check("E1 [G5] epic CLI 子命令表含 ask（epic-query.md 的入口存在）", r.out.includes("ask"), r.out.split("\n")[0]);
r = await epi("ask");
check("E2 [G5] ask 缺 --question 时明确报错（参数名契约）", r.code !== 0 && r.out.includes("--question"), r.out.split("\n")[0]);
// 用不可达 baseUrl 的沙箱 config 动态证明：epic-query.md 规定的全部 flag 被真实解析
// （若有未知 flag 会先报"未知参数"退出，到不了网络层）
const ECFG = join(SB, "epic-dead-config.json");
writeFileSync(ECFG, JSON.stringify({
  api: {
    baseUrl: "http://127.0.0.1:9", origin: "http://127.0.0.1:9", referer: "http://127.0.0.1:9/x",
    userAgent: "contract-test",
  },
}, null, 2));
r = await epi("ask", "--question", "contract test C2061", "--conversation-id", "deadbeef", "--timeout", "2", "--config", ECFG);
check("E3 [G5] epic-query.md 的完整 flag 组合被脚本接受（到达网络层而非 usage 拒绝）",
  r.code !== 0 && !r.out.includes("未知参数") && !r.out.includes("未知子命令"), r.out.split("\n")[0]);
const epicSrc = readFileSync(EPI_CLI, "utf8");
check("E4 [G5] 响应字段契约（AgentAnswer/HtmlAnswer/References）在脚本中存在",
  ["AgentAnswer", "HtmlAnswer", "References"].every((k) => epicSrc.includes(k)), "");

// ============ 汇总 ============
console.log(`\n===== 结果: ${results.length - failed}/${results.length} PASS =====`);
writeFileSync(join(here, "contract-results.json"), JSON.stringify({ total: results.length, failed, results }, null, 2));
process.exit(failed ? 1 : 0);
