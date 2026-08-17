#!/usr/bin/env node
// run-tests.mjs — parking-skill-creator 自带回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒执行（execFileSync 跑脚本再比对输出），退出码 0=全过/1=有失败；
//       夹具全部建在系统临时目录——本测试自身不能在技能扫描根下留下任何 SKILL.md。
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? "" };
  }
}
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
