#!/usr/bin/env node
// run-tests.mjs — parking-skill-creator 自带回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒执行（execFileSync 跑脚本再比对输出），退出码 0=全过/1=有失败；
//       夹具全部建在系统临时目录——本测试自身不能在技能扫描根下留下任何 SKILL.md。
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "scripts");

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

function runFile(script, args, opts = {}) {
  try {
    const stdout = execFileSync("node", [join(SCRIPTS, script), ...args], { encoding: "utf8", ...opts });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? "", stderr: e.stderr?.toString() ?? "" };
  }
}
const out = (r) => r.stdout + r.stderr;
const run = (args) => runFile("snapshot-skill.mjs", args);

function exists(p) {
  try { readFileSync(p); return true; } catch { return false; }
}

// ---- snapshot-skill.mjs ----
const root = mkdtempSync(join(tmpdir(), "snaptest-"));
const skillsRoot = join(root, "skills"); // 模拟技能扫描根,workspace 缺省必须落在它外面
const skill = join(skillsRoot, "demo-skill");
const workspace = join(root, "demo-skill-workspace");
mkdirSync(join(skill, "scripts"), { recursive: true });
writeFileSync(join(skill, "SKILL.md"), "---\nname: demo-skill\ndescription: 测试用\n---\n正文\n");
writeFileSync(join(skill, "scripts", "run.mjs"), "console.log('hi')\n");

try {
  console.log("快照·用法与拒绝：");
  check("无参数退出码 2", run([]).code === 2);
  check("不存在的目录退出码 1", run([join(root, "no-such")]).code === 1);
  mkdirSync(join(root, "empty"));
  check("无 SKILL.md 的目录退出码 1", run([join(root, "empty")]).code === 1);

  console.log("快照·去识别化：");
  const first = run([skill, workspace]);
  check("首次快照退出码 0", first.code === 0);
  check("stdout 以 SNAPSHOT 起头", first.stdout.startsWith("SNAPSHOT "));
  check("快照内有 SKILL.md.bak", readFileSync(join(workspace, "skill-snapshot", "SKILL.md.bak"), "utf8").includes("demo-skill"));
  check("快照内没有活的 SKILL.md", !exists(join(workspace, "skill-snapshot", "SKILL.md")));
  check("scripts 随快照复制", readFileSync(join(workspace, "skill-snapshot", "scripts", "run.mjs"), "utf8") === "console.log('hi')\n");
  check("源技能 SKILL.md 原样保留", readFileSync(join(skill, "SKILL.md"), "utf8").includes("正文"));

  console.log("快照·重复递增：");
  const second = run([skill, workspace]);
  check("第二次快照落到 -v2", second.stdout.includes(`SNAPSHOT ${join(workspace, "skill-snapshot-v2")}`));
  check("v2 同样去识别化", !exists(join(workspace, "skill-snapshot-v2", "SKILL.md")));

  console.log("快照·缺省 workspace 在扫描根外：");
  const byDefault = run([skill]);
  const defaultSnap = join(root, "skill-workspaces", "demo-skill-workspace", "skill-snapshot");
  check("缺省落到 <根上一级>/skill-workspaces/", byDefault.stdout.includes(`SNAPSHOT ${defaultSnap}`));
  check("缺省快照同样去识别化", exists(join(defaultSnap, "SKILL.md.bak")) && !exists(join(defaultSnap, "SKILL.md")));
} finally {
  rmSync(root, { recursive: true, force: true });
}

// ---- init-skill.mjs 脚手架自带测试 ----
console.log("init·测试固化：");
const root3 = mkdtempSync(join(tmpdir(), "inittest-"));
try {
  const gen = runFile("init-skill.mjs", ["Demo Gen", "--structure", "task", "--path", root3]);
  const genDir = join(root3, "demo-gen");
  check("init 退出码 0 且目录归一化", gen.code === 0 && exists(join(genDir, "SKILL.md")));
  check("生成 run-tests.mjs", exists(join(genDir, "run-tests.mjs")));
  check("SKILL.md 含测试节", readFileSync(join(genDir, "SKILL.md"), "utf8").includes("## 测试"));
  const ran = (() => {
    try {
      const out = execFileSync("node", [join(genDir, "run-tests.mjs")], { encoding: "utf8" });
      return { code: 0, out };
    } catch (e) { return { code: e.status ?? 1, out: e.stdout?.toString() ?? "" }; }
  })();
  check("生成的 run-tests 可执行且全过", ran.code === 0 && ran.out.includes("passed"));

  const qv = runFile("quick-validate.mjs", [genDir]);
  check("脚手架过 quick-validate 且无缺测试警告", qv.code === 0 && !qv.stdout.includes("警告"));

  const bare = join(root3, "bare-skill");
  mkdirSync(bare, { recursive: true });
  writeFileSync(join(bare, "SKILL.md"), "---\nname: bare-skill\ndescription: d\n---\n");
  const qvWarn = runFile("quick-validate.mjs", [bare]);
  check("无 run-tests 时 PASS 但给警告", qvWarn.code === 0 && qvWarn.stdout.includes("警告: 无 run-tests.mjs"));
  check("无 design.md 时 PASS 但给警告", qvWarn.code === 0 && qvWarn.stdout.includes("警告: 无 references/design.md"));

  check("生成 references/design.md 骨架", exists(join(genDir, "references", "design.md")));
  const design = readFileSync(join(genDir, "references", "design.md"), "utf8");
  check("design.md 四节齐全且验收编号 AC-N", ["## 意图与触发场景", "## 设计取舍", "## 验收条件", "## 迭代记录", "AC-1"].every((s) => design.includes(s)));
  check("init stdout 报 design.md 产物行", gen.stdout.includes("references/design.md") && gen.stdout.includes("AC-N"));
} finally {
  rmSync(root3, { recursive: true, force: true });
}

// ---- check-shadow-skills.mjs ----
console.log("影子技能检测：");
const root2 = mkdtempSync(join(tmpdir(), "shadowtest-"));
try {
  const skills = join(root2, "skills");
  const mk = (p, name) => {
    mkdirSync(p, { recursive: true });
    writeFileSync(join(p, "SKILL.md"), `---\nname: ${name}\ndescription: d\n---\n`);
  };
  mk(join(skills, "real-skill"), "real-skill");
  // 已去识别化快照（只有 .bak）不算影子
  const snap = join(skills, "real-skill-workspace", "skill-snapshot");
  mkdirSync(snap, { recursive: true });
  writeFileSync(join(snap, "SKILL.md.bak"), "---\nname: real-skill\n---\n");

  const clean = runFile("check-shadow-skills.mjs", [skills]);
  check("干净根(快照仅 .bak)退出码 0", clean.code === 0);
  check("干净根报告一级技能 1 个", clean.stdout.includes("一级技能 1 个"));

  mk(join(skills, "real-skill-workspace", "iteration-1", "outputs", "fake"), "fake-skill");
  const dirty = runFile("check-shadow-skills.mjs", [skills]);
  check("出现影子后退出码 1", dirty.code === 1);
  check("报出影子技能名 fake-skill", dirty.stdout.includes('"fake-skill"'));
  check("标注 workspace 内", dirty.stdout.includes("(workspace 内)"));

  check("不存在的根退出码 2", runFile("check-shadow-skills.mjs", [join(root2, "no-such")]).code === 2);

  // 无参数：自动发现 cwd 下的 .claude/skills
  mkdirSync(join(root2, ".claude", "skills", "only-skill"), { recursive: true });
  writeFileSync(join(root2, ".claude", "skills", "only-skill", "SKILL.md"), "---\nname: only-skill\ndescription: d\n---\n");
  const auto = runFile("check-shadow-skills.mjs", [], { cwd: root2 });
  check("无参数自动发现干净根退出码 0", auto.code === 0 && auto.stdout.includes(join(root2, ".claude", "skills")));
} finally {
  rmSync(root2, { recursive: true, force: true });
}

// ---- 对抗回归：路径占用/参数护栏/空必填键（2026-08-17 对抗测试修复） ----
console.log("对抗·崩溃与判定修复：");
const root4 = mkdtempSync(join(tmpdir(), "advtest-"));
try {
  const advSkill = join(root4, "sk", "demo");
  mkdirSync(advSkill, { recursive: true });
  writeFileSync(join(advSkill, "SKILL.md"), "---\nname: demo\ndescription: d\n---\n");
  const outFile = join(root4, "占用文件");
  writeFileSync(outFile, "x");

  const wsIsFile = run([advSkill, outFile]);
  check("workspace 参数是文件 → 干净拒绝 1", wsIsFile.code === 1 && out(wsIsFile).includes("拒绝"));

  writeFileSync(join(root4, "skill-workspaces"), "x"); // 占用缺省 workspace 的上级路径名
  const defBlocked = run([advSkill]);
  check("缺省 workspace 被文件占用 → 干净拒绝 1（不吐堆栈）", defBlocked.code === 1 && out(defBlocked).includes("拒绝"));
  rmSync(join(root4, "skill-workspaces"));

  check("snapshot 拦 - 开头参数 → 用法 2", run(["--help"]).code === 2);

  const badSkill = join(root4, "sk2", "bad");
  mkdirSync(join(badSkill, "SKILL.md"), { recursive: true }); // SKILL.md 是目录
  check("SKILL.md 是目录 → 干净拒绝 1", run([badSkill]).code === 1);

  check("init --path 指向文件 → 用法 2", runFile("init-skill.mjs", ["x1", "--path", outFile]).code === 2);

  const outDir = join(root4, "out");
  mkdirSync(outDir);
  writeFileSync(join(outDir, "occupied"), "x");
  check("init 目标被同名文件占用 → 拒绝 1", runFile("init-skill.mjs", ["occupied", "--path", outDir]).code === 1);

  const qvFile = runFile("quick-validate.mjs", [outFile]);
  check("quick-validate 参数是文件 → 报「不是目录」", qvFile.code === 1 && out(qvFile).includes("不是目录"));

  const emptyName = join(root4, "qv1");
  mkdirSync(emptyName);
  writeFileSync(join(emptyName, "SKILL.md"), '---\nname: ""\ndescription: d\n---\n');
  check("空 name 判 FAIL", runFile("quick-validate.mjs", [emptyName]).code === 1);

  const emptyDesc = join(root4, "qv2");
  mkdirSync(emptyDesc);
  writeFileSync(join(emptyDesc, "SKILL.md"), "---\nname: ok-skill\ndescription: >\n---\n");
  check("空 description 判 FAIL", runFile("quick-validate.mjs", [emptyDesc]).code === 1);

  const dirSkillMd = join(root4, "qv3");
  mkdirSync(join(dirSkillMd, "SKILL.md"), { recursive: true });
  const r3 = runFile("quick-validate.mjs", [dirSkillMd]);
  check("SKILL.md 是目录 → FAIL 且如实报错", r3.code === 1 && out(r3).includes("is a directory"));
} finally {
  rmSync(root4, { recursive: true, force: true });
}

// ---- 打包·设计文档与成绩随包分发（2026-08-17 设计自包含升级） ----
console.log("打包·设计与成绩随包：");
const root5 = mkdtempSync(join(tmpdir(), "pkgtest-"));
try {
  const gen2 = runFile("init-skill.mjs", ["pkg-demo", "--structure", "workflow", "--path", root5]);
  const pkgDir = join(root5, "pkg-demo");
  check("init 供打包技能成功", gen2.code === 0 && exists(join(pkgDir, "SKILL.md")));
  writeFileSync(join(pkgDir, "history.json"), JSON.stringify({ skill: "pkg-demo", runs: [], current_best: "runs[0]" }) + "\n");
  const dist = join(root5, "dist");
  const pkg = runFile("package-skill.mjs", [pkgDir, dist]);
  check("打包退出码 0", pkg.code === 0);
  const zip = readFileSync(join(dist, "pkg-demo.skill"));
  check("包内含 references/design.md", zip.includes(Buffer.from("pkg-demo/references/design.md")));
  check("包内含 history.json", zip.includes(Buffer.from("pkg-demo/history.json")));
  check("包内含 run-tests.mjs", zip.includes(Buffer.from("pkg-demo/run-tests.mjs")));
} finally {
  rmSync(root5, { recursive: true, force: true });
}

// ---- 聚合·--history 契约边界（首轮/次轮/防抖/dropped/损坏/无参数不变/拒绝） ----
console.log("聚合·history 契约：");
const root6 = mkdtempSync(join(tmpdir(), "histtest-"));
try {
  const mkRun = (iter, ev, cfg, passed) => {
    const d = join(root6, "ws", iter, ev, cfg, "run-1");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "grading.json"), JSON.stringify({ results: [{ name: "断言", passed }] }));
    writeFileSync(join(d, "timing.json"), JSON.stringify({ total_tokens: 100, duration_ms: 1000 }));
    writeFileSync(join(root6, "ws", iter, ev, "eval_metadata.json"), JSON.stringify({
      prompt: "p", assertions: [{ name: "断言", type: "script", ac: "AC-1" }],
    }));
  };
  // iteration-1: eval-a 过 / eval-b 挂；iteration-2: eval-b 翻正(won) + eval-c 新增，eval-a 缺席(dropped)
  for (const [ev, pass] of [["eval-a", true], ["eval-b", false]]) { mkRun("iteration-1", ev, "with_skill", pass); mkRun("iteration-1", ev, "without_skill", false); }
  for (const [ev, pass] of [["eval-b", true], ["eval-c", true]]) { mkRun("iteration-2", ev, "with_skill", pass); mkRun("iteration-2", ev, "without_skill", false); }

  const skillDir = join(root6, "skill");
  mkdirSync(skillDir);
  const agg = (iter, extra = []) => runFile("aggregate-benchmark.mjs", [join(root6, "ws", iter), "--skill-name", "hist-demo", ...extra]);
  const aggH = (iter) => agg(iter, ["--history", skillDir]);

  const r1 = aggH("iteration-1");
  const h1 = JSON.parse(readFileSync(join(skillDir, "history.json"), "utf8"));
  check("首轮: 创建 history.json 且 1 条 run", r1.code === 0 && h1.runs.length === 1);
  check("首轮: vs_previous 为 null", h1.runs[0].vs_previous === null);
  check("首轮: current_best=runs[0]", h1.current_best === "runs[0]");
  check("首轮: gates 键=配置目录名", h1.runs[0].gates.with_skill && h1.runs[0].gates.without_skill);
  check("首轮: stdout 趋势 3 行", (r1.stdout.match(/^history: /gm) || []).length === 3);
  check("断言 ac 字段不碍聚合", r1.code === 0 && JSON.parse(readFileSync(join(root6, "ws", "iteration-1", "benchmark.json"), "utf8")).evals.length === 2);

  const r2 = aggH("iteration-2");
  const h2 = JSON.parse(readFileSync(join(skillDir, "history.json"), "utf8"));
  const vs = h2.runs[1].vs_previous;
  check("次轮: 追加第 2 条且第 1 条未回改", h2.runs.length === 2 && h2.runs[0].date === h1.runs[0].date);
  check("次轮: won/lost/tie 按同 eval 名匹配", vs.won === 1 && vs.lost === 0 && vs.tie === 0);
  check("次轮: eval-b 翻正记 won", vs.detail.some((d) => d.eval === "eval-b" && d.result === "won"));
  check("次轮: 新增 eval-c 记 new 不计胜负", vs.detail.some((d) => d.eval === "eval-c" && d.result === "new") && vs.evals_total === 2);
  check("次轮: 缺席 eval-a 标 dropped", vs.detail.some((d) => d.eval === "eval-a" && d.result === "dropped"));
  check("次轮: current_best 严格推进", h2.current_best === "runs[1]");

  aggH("iteration-2");
  const h3 = JSON.parse(readFileSync(join(skillDir, "history.json"), "utf8"));
  check("防抖: 持平不推进 current_best", h3.runs.length === 3 && h3.current_best === "runs[1]");

  writeFileSync(join(skillDir, "history.json"), "{broken", "utf8");
  const r4 = aggH("iteration-2");
  const backups = readdirSync(skillDir).filter((f) => f.startsWith("history.json.corrupt-"));
  const h4 = JSON.parse(readFileSync(join(skillDir, "history.json"), "utf8"));
  check("损坏: 先备份 .corrupt-<ts> 再重建", r4.code === 0 && backups.length === 1 && h4.runs.length === 1 && h4.current_best === "runs[0]");
  check("损坏: stdout 明示备份不静默", r4.stdout.includes("已备份为 history.json.corrupt-"));

  const skillDir2 = join(root6, "skill-clean");
  mkdirSync(skillDir2);
  const r5 = agg("iteration-1");
  check("无参数: 不产 history 行不建 history.json", r5.code === 0 && !r5.stdout.includes("history:")
    && !exists(join(skillDir2, "history.json")));

  const r6 = agg("iteration-1", ["--history", join(root6, "no-such")]);
  check("拒绝: 目标不可写退出 1 且 benchmark 照常产出", r6.code === 1 && r6.stdout.includes("拒绝")
    && exists(join(root6, "ws", "iteration-1", "benchmark.json")));
} finally {
  rmSync(root6, { recursive: true, force: true });
}

// ---- 聚合·自定义 gate 目录名（gate 可选制） ----
console.log("聚合·自定义 gate：");
const root7 = mkdtempSync(join(tmpdir(), "gatetest-"));
try {
  const d = join(root7, "iteration-1", "eval-x", "with_skill_no_refs", "run-1");
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "grading.json"), JSON.stringify({ results: [{ name: "a", passed: true }] }));
  writeFileSync(join(root7, "iteration-1", "eval-x", "eval_metadata.json"), '{"prompt":"p","assertions":[]}');
  const g = runFile("aggregate-benchmark.mjs", [join(root7, "iteration-1"), "--skill-name", "gate-demo", "--output", join(root7, "b.json")]);
  const bj = JSON.parse(readFileSync(join(root7, "b.json"), "utf8"));
  check("自定义 gate 目录名原样进 configs 正常聚合", g.code === 0 && bj.configs.with_skill_no_refs && bj.configs.with_skill_no_refs.pass_rate.mean === 1);
} finally {
  rmSync(root7, { recursive: true, force: true });
}

// ---- 评审页·历史轨迹区与结构审查建议卡片 ----
console.log("评审页·历史与建议卡片：");
const root8 = mkdtempSync(join(tmpdir(), "viewtest-"));
try {
  const d = join(root8, "iteration-1", "eval-jia", "with_skill", "run-1");
  mkdirSync(join(d, "outputs"), { recursive: true });
  writeFileSync(join(d, "grading.json"), JSON.stringify({ results: [{ name: "a", passed: true }] }));
  writeFileSync(join(d, "outputs", "out.md"), "# 结果\n");
  writeFileSync(join(root8, "iteration-1", "eval-jia", "eval_metadata.json"), '{"prompt":"p","assertions":[{"name":"a","type":"manual","ac":"AC-1"}]}');
  writeFileSync(join(root8, "iteration-1", "structure-review.json"), JSON.stringify({
    signals: [{ signal: "1 原子能力可复用", hit: false, evidence: "无" }],
    recommendation: "无需拆分",
    conclusion: "仅建议不执行",
  }));
  const skillDir3 = join(root8, "skill");
  mkdirSync(skillDir3);
  writeFileSync(join(skillDir3, "history.json"), JSON.stringify({
    skill: "view-demo",
    runs: [{ date: "2026-08-17T10:00:00+08:00", iteration_ref: "X:/ws/iteration-1",
      gates: { with_skill: { pass_rate: 1, mean_ms: 1000, mean_tokens: 100 } }, vs_previous: null, current_best: true }],
    current_best: "runs[0]",
  }));
  const viewer = (args) => runFile("../eval-viewer/generate-review.mjs", args);
  const st = viewer([join(root8, "iteration-1"), "--skill-name", "view-demo", "--history", skillDir3, "--static", join(root8, "review.html"), "--no-open"]);
  check("带 --history 静态评审页生成成功", st.code === 0);
  const html = readFileSync(join(root8, "review.html"), "utf8");
  check("评审页嵌入 history 数据", html.includes('"history"') && html.includes("view-demo"));
  check("评审页含建议卡片与仅建议标记", html.includes("结构审查建议") && html.includes("仅建议 · 未执行"));
  const st2 = viewer([join(root8, "iteration-1"), "--skill-name", "view-demo", "--static", join(root8, "review2.html"), "--no-open"]);
  const html2 = readFileSync(join(root8, "review2.html"), "utf8");
  check("无 --history 时不嵌历史数据(旧行为不变)", st2.code === 0 && !html2.includes('"history"'));
} finally {
  rmSync(root8, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
