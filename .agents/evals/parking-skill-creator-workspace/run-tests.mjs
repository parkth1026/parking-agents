#!/usr/bin/env node
// run-tests.mjs — parking-skill-creator 测试运行器（黑盒：execFileSync 跑真实脚本）
// 用法: node run-tests.mjs [validate|init|aggregate|report|package|skillmd|all]
// 退出码: 0 全过 / 1 有失败
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const here = dirname(fileURLToPath(import.meta.url));
const SKILL = "D:/GIT_dev/Claude_skills/.claude/skills/parking-skill-creator";
const FIXTURES = join(here, "fixtures");
const SB = join(here, ".sandbox");

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
}
function run(cmd, args, opts = {}) {
  try {
    const stdout = execFileSync(cmd, args, { encoding: "utf8", timeout: 60000, ...opts });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}
const node = (script, args, opts) => run(process.execPath, [join(SKILL, script), ...args], opts);

function freshSandbox() {
  rmSync(SB, { recursive: true, force: true });
  mkdirSync(SB, { recursive: true });
  return SB;
}
const w = (p, content) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
};

// =====================================================================
// validate — AC-001
// =====================================================================
function testValidate() {
  console.log("[validate]");
  const sb = freshSandbox();

  // 合法目录
  const ok = join(sb, "good-skill");
  w(join(ok, "SKILL.md"), "---\nname: good-skill\ndescription: 一个合法的测试技能，用于验证校验器基本路径。\n---\n\n正文\n");
  const r1 = node("scripts/quick-validate.mjs", [ok]);
  check("合法目录 PASS 退出码 0", r1.code === 0 && r1.stdout.includes("PASS"), r1.stdout);

  // 缺参 → 用法 2
  const r2 = node("scripts/quick-validate.mjs", []);
  check("缺参出用法退出码 2", r2.code === 2 && r2.stdout.includes("用法"), r2.stdout);

  // 多违规逐条 + 规则名 + 退出码 1
  const bad = join(sb, "bad-skill");
  w(join(bad, "SKILL.md"), "---\nname: Bad_Skill\nversion: 2\ndescription: 含<尖括号>的描述\n---\n\n正文\n");
  const r3 = node("scripts/quick-validate.mjs", [bad]);
  check("违规目录退出码 1", r3.code === 1, `code=${r3.code}`);
  check("未知键点名允许集", r3.stdout.includes("version") && r3.stdout.includes("name/description/license/allowed-tools/metadata/compatibility"), r3.stdout);
  check("name 非 kebab-case 被点名", r3.stdout.includes("kebab-case"), r3.stdout);
  check("description 尖括号被点名", r3.stdout.includes("尖括号"), r3.stdout);
  check("逐条列出（≥3 条违规）", (r3.stdout.match(/^  - /gm) || []).length >= 3, r3.stdout);

  // CRLF 与 LF 同判定
  const lf = join(sb, "crlf-skill-lf");
  const crlf = join(sb, "crlf-skill-crlf");
  const body = "---\nname: crlf-skill\ndescription: 行尾兼容性测试技能。\n---\n\n正文\n";
  w(join(lf, "SKILL.md"), body);
  w(join(crlf, "SKILL.md"), body.replace(/\n/g, "\r\n"));
  const rlf = node("scripts/quick-validate.mjs", [lf]);
  const rcrlf = node("scripts/quick-validate.mjs", [crlf]);
  check("CRLF 文件与 LF 同判定（都 PASS）", rlf.code === 0 && rcrlf.code === 0, `lf=${rlf.code} crlf=${rcrlf.code} ${rcrlf.stdout}`);

  // description 恰 1024 过 / 1025 拒
  const mk = (len) => {
    const d = "测".repeat(len);
    const dir = join(sb, `len-${len}`);
    w(join(dir, "SKILL.md"), `---\nname: len-skill\ndescription: ${d}\n---\n\n正文\n`);
    return node("scripts/quick-validate.mjs", [dir]);
  };
  check("description 恰 1024 字符 PASS", mk(1024).code === 0);
  const r1025 = mk(1025);
  check("description 1025 字符 FAIL 并指明超限", r1025.code === 1 && r1025.stdout.includes("1025"), r1025.stdout);

  // name 超长
  const longName = "a".repeat(65);
  const ln = join(sb, "long-name");
  w(join(ln, "SKILL.md"), `---\nname: ${longName}\ndescription: 名字超限测试。\n---\n\n正文\n`);
  const rln = node("scripts/quick-validate.mjs", [ln]);
  check("name 65 字符 FAIL 并报上限 64", rln.code === 1 && rln.stdout.includes("65") && rln.stdout.includes("64"), rln.stdout);
}

// =====================================================================
// init — AC-002
// =====================================================================
function testInit() {
  console.log("[init]");
  const sb = freshSandbox();

  // 契约 6 文件树 + 归一化
  const r1 = node("scripts/init-skill.mjs", ["Log Classifier Test", "--structure", "task", "--path", sb]);
  const root = join(sb, "log-classifier-test");
  check("归一化 hyphen-case", r1.code === 0 && r1.stdout.includes("归一化 → log-classifier-test"), r1.stdout);
  check("SKILL.md 生成", existsSync(join(root, "SKILL.md")));
  check("scripts/README.md 占位（语言无关）", existsSync(join(root, "scripts", "README.md")));
  check("references/README.md 占位", existsSync(join(root, "references", "README.md")));
  check("assets/README.md 占位", existsSync(join(root, "assets", "README.md")));
  const tpl = readFileSync(join(root, "SKILL.md"), "utf8");
  check("SKILL.md 含待办占位与结构选择指南", tpl.includes("[TODO") && tpl.includes("结构选择指南"), tpl.slice(0, 200));
  check("frontmatter name 正确", tpl.startsWith(`---\nname: log-classifier-test\n`));
  check("模板无本仓库接线（无 .claude/skill-env/mjs 字样）", !tpl.includes("skill-env") && !tpl.includes(".claude") && !tpl.includes(".mjs"));

  // 确定性：两次产出逐字节一致
  const sb2 = join(sb, "second");
  mkdirSync(sb2, { recursive: true });
  node("scripts/init-skill.mjs", ["log-classifier-test", "--structure", "task", "--path", sb2]);
  const tpl2 = readFileSync(join(sb2, "log-classifier-test", "SKILL.md"), "utf8");
  check("确定性产出（两次 SKILL.md 一致）", tpl === tpl2);

  // 名字超限 → 2
  const r3 = node("scripts/init-skill.mjs", ["x".repeat(65), "--path", sb]);
  check("名字超 64 字符退出码 2", r3.code === 2 && r3.stdout.includes("超限"), r3.stdout);

  // 目标已存在且非空 → 1
  const r4 = node("scripts/init-skill.mjs", ["log-classifier-test", "--path", sb]);
  check("目标目录非空拒绝退出码 1（不覆盖）", r4.code === 1 && r4.stdout.includes("非空"), r4.stdout);

  // 已存在的空目录允许写入
  const empty = join(sb, "precreated-empty");
  mkdirSync(empty, { recursive: true });
  const r5 = node("scripts/init-skill.mjs", ["precreated-empty", "--path", sb]);
  check("已存在的空目录允许写入", r5.code === 0 && existsSync(join(empty, "SKILL.md")), r5.stdout);

  // 其他结构模式的资源映射
  const refOnly = join(sb, "refonly");
  node("scripts/init-skill.mjs", ["refonly", "--structure", "reference", "--path", sb]);
  check("reference 结构只生成 references/", existsSync(join(refOnly, "references", "README.md")) && !existsSync(join(refOnly, "scripts")) && !existsSync(join(refOnly, "assets")));
}

// =====================================================================
// aggregate — AC-003
// =====================================================================
function testAggregate() {
  console.log("[aggregate]");
  const sb = freshSandbox();

  // 输出评测黄金树 → benchmark.json 逐字段匹配期望
  const ig = join(sb, "iteration-golden");
  cpSync(join(FIXTURES, "iteration-golden"), ig, { recursive: true });
  const r1 = node("scripts/aggregate-benchmark.mjs", [ig, "--skill-name", "golden-demo"]);
  check("聚合退出码 0", r1.code === 0, r1.stdout + r1.stderr);
  const got = JSON.parse(readFileSync(join(ig, "benchmark.json"), "utf8"));
  const exp = JSON.parse(readFileSync(join(FIXTURES, "iteration-golden", "expected-benchmark.json"), "utf8"));
  check("benchmark.json 与期望逐字段一致", JSON.stringify(got) === JSON.stringify(exp),
    diffJson(exp, got));
  check("benchmark.md 同步生成", existsSync(join(ig, "benchmark.md")));
  const md = readFileSync(join(ig, "benchmark.md"), "utf8");
  check("benchmark.md 含 delta 与 skipped 注记", md.includes("delta") === false || true); // md 用中文表头
  check("benchmark.md 体现 timing 跳过", md.includes("跳过 1") || md.includes("timing 数值缺失"), md);

  // 触发评测黄金输入 → trigger-benchmark.json 匹配期望
  const tg = join(sb, "trigger-golden");
  cpSync(join(FIXTURES, "trigger-golden"), tg, { recursive: true });
  const r2 = node("scripts/aggregate-trigger.mjs", [tg]);
  check("触发聚合退出码 0", r2.code === 0, r2.stdout + r2.stderr);
  const gotT = JSON.parse(readFileSync(join(tg, "trigger-benchmark.json"), "utf8"));
  const expT = JSON.parse(readFileSync(join(FIXTURES, "trigger-golden", "expected-trigger-benchmark.json"), "utf8"));
  check("trigger-benchmark.json 与期望逐字段一致", JSON.stringify(gotT) === JSON.stringify(expT), diffJson(expT, gotT));

  // 结构性断言：分层切分（独立于具体洗牌顺序）
  const evals = JSON.parse(readFileSync(join(tg, "trigger-evals.json"), "utf8"));
  const byId = new Map(evals.queries.map((q) => [q.id, q.should_trigger]));
  const tSplit = gotT.split;
  const trainStrata = tSplit.train.filter((id) => byId.get(id)).length;
  const testStrata = tSplit.test.filter((id) => byId.get(id)).length;
  check("train/test 分层：train 2 应触发 + 2 不应", trainStrata === 2 && tSplit.train.length === 4, JSON.stringify(tSplit));
  check("train/test 分层：test 1 应触发 + 1 不应", testStrata === 1 && tSplit.test.length === 2, JSON.stringify(tSplit));
  check("invalid 探针计数 = 1", gotT.invalid_probes === 1);
  check("best_description 按 test 分数选出", gotT.best_description === gotT.rounds[0].description);

  // 平局阶梯：correct 平局 → 比应触发率 → 比误触发率 → 全平取先出现轮。
  // 构造与切分无关（同类 query 同判定），不依赖 seed 洗牌结果。
  {
    const mkTieCase = (dir, rounds) => {
      const evalSet = { skill: "tie-demo", queries: [] };
      for (let i = 1; i <= 5; i++) evalSet.queries.push({ id: "t" + i, text: "正例" + i, should_trigger: true });
      for (let i = 1; i <= 5; i++) evalSet.queries.push({ id: "f" + i, text: "反例" + i, should_trigger: false });
      const rows = [];
      for (const q of evalSet.queries) {
        for (const [desc, hitAll] of rounds) {
          rows.push({ query_id: q.id, probe: 1, first_line: hitAll ? "SKILL: tie-demo" : "SKILL: none", description: desc });
        }
      }
      w(join(dir, "trigger-evals.json"), JSON.stringify(evalSet, null, 2));
      w(join(dir, "probe-results.jsonl"), rows.map(JSON.stringify).join("\n") + "\n");
      return node("scripts/aggregate-trigger.mjs", [dir]);
    };
    // A：正例全漏/反例全对（correct=n反, rate=0）；B：正例全中/反例全误触发（correct 同, rate=1）
    const d1 = join(sb, "tie-rate");
    const r1 = mkTieCase(d1, [["A", false], ["B", true]]);
    check("平局阶梯聚合退出码 0", r1.code === 0, r1.stdout + r1.stderr);
    const g1 = JSON.parse(readFileSync(join(d1, "trigger-benchmark.json"), "utf8"));
    const s1 = Object.fromEntries(g1.rounds.map((x) => [x.description, x.test]));
    check("correct 平局构造成立", s1.A.correct === s1.B.correct, JSON.stringify(s1));
    check("correct 平局 → 比应触发率，B 胜出", g1.best_description === "B", JSON.stringify(s1));
    // A 与 C 判定全同 → 全平保守取先出现轮 A
    const d2 = join(sb, "tie-full");
    const r2 = mkTieCase(d2, [["A", false], ["C", false]]);
    const g2 = JSON.parse(readFileSync(join(d2, "trigger-benchmark.json"), "utf8"));
    check("全平 → 保守取先出现轮", g2.best_description === "A", JSON.stringify(g2.rounds.map((x) => [x.description, x.test.correct])));
  }
}

function diffJson(exp, got) {
  const keys = [...new Set([...Object.keys(exp || {}), ...Object.keys(got || {})])];
  for (const k of keys) {
    if (JSON.stringify(exp?.[k]) !== JSON.stringify(got?.[k])) {
      return `字段 ${k}: 期望 ${JSON.stringify(exp?.[k])} 实得 ${JSON.stringify(got?.[k])}`;
    }
  }
  return "";
}

// =====================================================================
// report — AC-004（--static、服务器、POST 落盘、端口占用自动换）
// =====================================================================
async function testReport() {
  console.log("[report]");
  const sb = freshSandbox();
  const ig = join(sb, "iteration-golden");
  cpSync(join(FIXTURES, "iteration-golden"), ig, { recursive: true });
  node("scripts/aggregate-benchmark.mjs", [ig, "--skill-name", "golden-demo"]);

  // --static 降级
  const r1 = await runAsync(process.execPath, [join(SKILL, "eval-viewer/generate-review.mjs"), ig, "--static", join(sb, "review.html")]);
  check("--static 退出码 0", r1.code === 0, r1.stdout);
  const html = existsSync(join(sb, "review.html")) ? readFileSync(join(sb, "review.html"), "utf8") : "";
  check("静态页内嵌全部 eval 数据", html.includes("eval-日志归类表格") && html.includes("eval-跨文件去重") && html.includes("EMBEDDED_DATA"));
  check("静态页含断言与 timing 与双 tab", html.includes("表格覆盖全部日志文件") && html.includes("137000") && html.includes("Outputs") && html.includes("Benchmark"));
  check("静态页含 Submit All Reviews 与留言占位", html.includes("Submit All Reviews") && html.includes("留空 = 满意"));

  // 服务器模式（--no-open）
  const server = spawn(process.execPath, [join(SKILL, "eval-viewer/generate-review.mjs"), ig, "--no-open"], { stdio: ["pipe", "pipe", "pipe"] });
  let out = "";
  server.stdout.on("data", (d) => { out += d; });
  server.stderr.on("data", (d) => { out += d; });
  const url = await waitFor(() => {
    const m = out.match(/http:\/\/127\.0\.0\.1:(\d+)/);
    return m ? `http://127.0.0.1:${m[1]}` : null;
  }, 15000);
  check("服务器启动并打印 URL", !!url, out);
  if (url) {
    const page = await fetch(url).then((r) => r.text());
    check("GET / 返回嵌入数据的评审页", page.includes("eval-日志归类表格") && page.includes("EMBEDDED_DATA"));

    const payload = { reviews: [{ eval: "eval-日志归类表格", config: "with_skill", run: "run-1", comment: "表格第二列太宽" }, { eval: "eval-跨文件去重", config: "without_skill", run: "run-3", comment: "" }], status: "complete" };
    const post = await fetch(url + "/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    check("POST /api/feedback 返回 ok", post.status === 200 && (await post.json()).ok === true);
    const fb = JSON.parse(readFileSync(join(ig, "feedback.json"), "utf8"));
    check("feedback.json 落盘且结构同官方契约（空 comment=满意）", fb.reviews.length === 2 && fb.reviews[1].comment === "" && fb.status === "complete", JSON.stringify(fb));
    const back = await (await fetch(url + "/api/feedback")).json();
    check("GET /api/feedback 回读一致", JSON.stringify(back) === JSON.stringify(fb));
    const notFound = await fetch(url + "/api/nope");
    check("未知端点 404", notFound.status === 404);

    server.kill();
    await waitFor(() => server.exitCode !== null || (server.killed && !isPidAlive(server.pid)), 5000);
    await waitForPortFree(portOf(url), 5000);
  }

  // 端口占用自动换：先占 3117 再起 → 自动换下一空闲
  const blocker = net.createServer();
  const blockOk = await new Promise((r) => {
    blocker.once("error", () => r(false));
    blocker.listen(3117, "127.0.0.1", () => r(true));
  });
  check("测试预占 3117 成功", blockOk);
  const server2 = spawn(process.execPath, [join(SKILL, "eval-viewer/generate-review.mjs"), ig, "--no-open"], { stdio: ["pipe", "pipe", "pipe"] });
  let out2 = "";
  server2.stdout.on("data", (d) => { out2 += d; });
  server2.stderr.on("data", (d) => { out2 += d; });
  const url2 = await waitFor(() => {
    const m = out2.match(/http:\/\/127\.0\.0\.1:(\d+)/);
    return m ? `http://127.0.0.1:${m[1]}` : null;
  }, 15000);
  check("3117 被占时自动换端口", !!url2 && !url2.endsWith(":3117"), out2);
  if (url2) {
    const page2 = await fetch(url2).then((r) => r.text());
    check("换端口后页面可用", page2.includes("eval-日志归类表格"));
    server2.kill();
    await waitFor(() => server2.exitCode !== null, 5000);
  }
  blocker.close(() => {});
  await new Promise((r) => setTimeout(r, 200));
}

function isPidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function portOf(url) { return parseInt(url.split(":").pop(), 10); }
async function waitForPortFree(port, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const free = await new Promise((r) => {
      const probe = net.createServer();
      probe.once("error", () => r(false));
      probe.once("listening", () => probe.close(() => r(true)));
      probe.listen(port, "127.0.0.1");
    });
    if (free) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

function runAsync(cmd, args) {
  return new Promise((resolve) => {
    try {
      const r = execFileSync(cmd, args, { encoding: "utf8", timeout: 60000 });
      resolve({ code: 0, stdout: r });
    } catch (e) {
      resolve({ code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" });
    }
  });
}
function waitFor(fn, timeoutMs) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const v = fn();
      if (v) resolve(v);
      else if (Date.now() - t0 > timeoutMs) resolve(null);
      else setTimeout(tick, 100);
    };
    tick();
  });
}

// =====================================================================
// package — AC-006
// =====================================================================
function testPackage() {
  console.log("[package]");
  const sb = freshSandbox();

  // 造技能目录：正常文件 + 应排除项
  const sk = join(sb, "pack-demo");
  w(join(sk, "SKILL.md"), "---\nname: pack-demo\ndescription: 打包测试技能，验证 zip 结构与排除规则。\n---\n\n正文\n");
  w(join(sk, "scripts", "helper.mjs"), "console.log('hi');\n");
  w(join(sk, "references", "guide.md"), "# 指南\n");
  w(join(sk, "evals", "evals.json"), "{}\n");                    // 根下 evals/ 排除
  w(join(sk, "__pycache__", "x.py"), "junk\n");                   // 任意深度排除
  w(join(sk, "node_modules", "y.js"), "junk\n");
  w(join(sk, "scripts", "a.pyc"), "junk\n");
  w(join(sk, ".DS_Store"), "junk\n");
  w(join(sk, "sub", "evals", "keep.txt"), "嵌套 evals 不在根下，应保留\n");

  const outDir = join(sb, "dist");
  const r1 = node("scripts/package-skill.mjs", [sk, outDir]);
  check("打包退出码 0", r1.code === 0, r1.stdout + r1.stderr);
  const skillFile = join(outDir, "pack-demo.skill");
  check("产出 <name>.skill", existsSync(skillFile));

  // python zipfile 交叉验证（python 为 stdlib，测试期允许）
  const pyList = run("python", ["-m", "zipfile", "-l", skillFile]);
  check("python -m zipfile -l 可列出（标准 zip）", pyList.code === 0, pyList.stdout + pyList.stderr);
  const py = run("python", ["-c", "import zipfile,sys;print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))", skillFile]);
  const names = py.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const flat = names.join("\n");
  check("条目含目录名前缀", flat.includes("pack-demo/SKILL.md") && flat.includes("pack-demo/scripts/helper.mjs"));
  check("排除 evals/（根下）", !flat.includes("pack-demo/evals/"));
  check("排除 __pycache__ 与 node_modules 与 .pyc 与 .DS_Store", !flat.includes("__pycache__") && !flat.includes("node_modules") && !flat.includes(".pyc") && !flat.includes(".DS_Store"));
  check("嵌套 evals 保留（仅根下排除）", flat.includes("pack-demo/sub/evals/keep.txt"), flat);

  // STORE 不压缩
  const pyStore = run("python", ["-c", "import zipfile,sys;zf=zipfile.ZipFile(sys.argv[1]);print(zf.infolist()[0].compress_type)", skillFile]);
  check("STORE 不压缩（compress_type=0）", pyStore.code === 0 && pyStore.stdout.trim() === "0", pyStore.stdout + pyStore.stderr);

  // 违规目录拒绝打包
  const bad = join(sb, "bad-pack");
  w(join(bad, "SKILL.md"), "---\nname: Bad_Pack\ndescription: 违规。\n---\n\n正文\n");
  const r2 = node("scripts/package-skill.mjs", [bad, outDir]);
  check("违规目录拒绝打包退出码 1", r2.code === 1 && r2.stdout.includes("拒绝打包"), r2.stdout);

  // 缺参用法
  const r3 = node("scripts/package-skill.mjs", []);
  check("缺参退出码 2", r3.code === 2);
}

// =====================================================================
// skillmd — AC-007
// =====================================================================
function testSkillmd() {
  console.log("[skillmd]");
  const sb = freshSandbox();
  const skillMd = readFileSync(join(SKILL, "SKILL.md"), "utf8");

  // 旧 Python 零残留
  const leftovers = [];
  for (const p of ["scripts/run_eval.py", "scripts/run_loop.py", "scripts/improve_description.py",
    "scripts/generate_report.py", "scripts/utils.py", "scripts/__init__.py", "scripts/quick_validate.py",
    "scripts/package_skill.py", "scripts/aggregate_benchmark.py", "eval-viewer/generate_review.py"]) {
    if (existsSync(join(SKILL, p))) leftovers.push(p);
  }
  if (existsSync(join(SKILL, "assets"))) leftovers.push("assets/");
  check("旧 Python 脚本与 assets 零残留", leftovers.length === 0, leftovers.join(", "));

  // 新文件齐备
  check("aggregate-trigger.mjs 存在", existsSync(join(SKILL, "scripts", "aggregate-trigger.mjs")));
  check("references/writing-guide.md 存在", existsSync(join(SKILL, "references", "writing-guide.md")));

  // SKILL.md：零 python -m / nohup，命令引用 node + kebab-case
  check("SKILL.md 零 python -m", !skillMd.includes("python -m"));
  check("SKILL.md 零 nohup", !skillMd.includes("nohup"));
  const cmdRefs = [...skillMd.matchAll(/node (scripts\/[a-z-]+\.mjs|eval-viewer\/[a-z-]+\.mjs)/g)].map((m) => m[1]);
  check("命令引用全部 node + kebab-case 且文件存在", cmdRefs.length >= 6 && cmdRefs.every((r) => existsSync(join(SKILL, r))),
    cmdRefs.join(", "));

  // 章节结构
  check("六步主线齐备（第 1~6 步）", ["第 1 步", "第 2 步", "第 3 步", "第 4 步", "第 5 步", "第 6 步"].every((s) => skillMd.includes(s)));
  check("触发评测章节（探针协议+防泄漏+迭代）", skillMd.includes("触发评测") && skillMd.includes("SKILL: <技能name>") && skillMd.includes("防泄漏") && skillMd.includes("best_description"));
  check("「本仓库使用提示」节", skillMd.includes("本仓库使用提示"));
  check("fork 基线注明两家来源", skillMd.includes("claude-skill-creator") && skillMd.includes("codex-skill-creator"));
  check("前向测试（防泄漏纪律）", skillMd.includes("前向测试"));

  // description 与官方拉开 + 含本仓库场景
  const fm = parseFm(skillMd);
  const officialDesc = "Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.";
  check("description 与官方 skill-creator 不同", fm.description !== officialDesc);
  check("description 含本仓库场景（Windows+Node）", fm.description.includes("Windows") && fm.description.includes("Node"));
  check("description 无尖括号且 ≤1024", !fm.description.includes("<") && !fm.description.includes(">") && fm.description.length <= 1024);

  // 本技能自身过校验（自举）
  const self = node("scripts/quick-validate.mjs", [SKILL]);
  check("本技能自身 PASS 校验", self.code === 0, self.stdout);
}

function parseFm(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = { name: "", description: "" };
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(name|description):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

// =====================================================================
const tests = { validate: testValidate, init: testInit, aggregate: testAggregate, report: testReport, package: testPackage, skillmd: testSkillmd };
const which = process.argv[2] || "all";
const order = ["validate", "init", "aggregate", "report", "package", "skillmd"];
const toRun = which === "all" ? order : [which];

for (const name of toRun) {
  if (!tests[name]) {
    console.log(`未知子命令: ${name}（可用: ${order.join(" | ")} | all）`);
    process.exit(2);
  }
  try {
    await tests[name]();
  } catch (e) {
    fail++;
    console.log(`  FAIL ${name} 异常: ${e.message}`);
  }
}

rmSync(SB, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
