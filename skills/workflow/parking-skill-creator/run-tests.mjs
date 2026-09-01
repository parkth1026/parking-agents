#!/usr/bin/env node
// run-tests.mjs — parking-skill-creator 自带回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒执行（execFileSync 跑脚本再比对输出），退出码 0=全过/1=有失败；
//       夹具全部建在系统临时目录——本测试自身不能在技能扫描根下留下任何 SKILL.md。
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildQualityVerdict } from "./scripts/lib/quality.mjs";

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
function runNode(scriptPath, args = [], opts = {}) {
  try {
    const stdout = execFileSync("node", [scriptPath, ...args], { encoding: "utf8", ...opts });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? "", stderr: e.stderr?.toString() ?? "" };
  }
}
const out = (r) => r.stdout + r.stderr;
function lastJson(text) {
  const lines = String(text).trim().split(/\r?\n/).reverse();
  for (const line of lines) {
    try { return JSON.parse(line); } catch { /* keep looking */ }
  }
  return null;
}
const sha256Text = (text) => `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
const canonicalTestJson = (value) => Array.isArray(value)
  ? `[${value.map(canonicalTestJson).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalTestJson(value[key])}`).join(",")}}`
    : JSON.stringify(value);
const sha256Json = (value) => sha256Text(canonicalTestJson(value));

const run = (args) => runFile("snapshot-skill.mjs", args);

// ---- 中文 Prompt 术语边界·自身文档契约 ----
const CREATOR_DIR = dirname(fileURLToPath(import.meta.url));
const creatorDoc = readFileSync(join(CREATOR_DIR, "SKILL.md"), "utf8");
const writingGuide = readFileSync(join(CREATOR_DIR, "references", "writing-guide.md"), "utf8");
const creatorInterface = readFileSync(join(CREATOR_DIR, "agents", "openai.yaml"), "utf8");
const creatorDescription = creatorDoc.match(/^description:\s*(.+)$/m)?.[1] ?? "";
console.log("中文 Prompt 术语边界：");
check("SKILL.md 声明 Chinese-first 与四道 conversion gate", ["中文 Prompt 的语言与术语边界", "Named concept", "Execution impact", "English information gain", "Stable mapping"].every((s) => creatorDoc.includes(s)));
check("SKILL.md 声明短 Prompt/长文档的转换上限", creatorDoc.includes("最多 2 个 English terms") && creatorDoc.includes("最多 5 个"));
check("writing guide 固化不凑数和 semantic nucleus", ["转换预算", "硬上限，不是最低配额", "没有值得转换的词就使用 0 个", "semantic nucleus", "双向钢人分析（steelman）", "分歧核心（crux）"].every((s) => writingGuide.includes(s)));
check("UI default prompt 保持中文且保留 skill name contract", creatorInterface.includes("使用 $parking-skill-creator") && creatorInterface.includes("创建、评测、迭代或打包"));
check("parking-skill-creator 自身 description 保持中文优先", creatorDescription.length < 450
  && ["with_skill/without_skill", "description", "subagent", ".skill", "Node"].every((s) => creatorDescription.includes(s))
  && !creatorDescription.includes("with/without"));

// ---- 无嵌套 Agent·headless 触发探针 fallback ----
console.log("headless 触发探针 fallback：");
const fallbackDoc = readFileSync(join(CREATOR_DIR, "references", "headless-trigger-fallback.md"), "utf8");
// 触发评测全流程已下沉到 references/trigger-eval.md（issue #57）。路由契约拆两层校验：
// SKILL.md 保证「这条降级路径可被发现」，trigger-eval.md 保证「细则完整」。
const triggerEvalDoc = readFileSync(join(CREATOR_DIR, "references", "trigger-eval.md"), "utf8");
check("SKILL.md 指针提到无嵌套 Agent 的降级路径", creatorDoc.includes("references/headless-trigger-fallback.md")
  && creatorDoc.includes("交回主会话直跑"));
check("trigger-eval.md 把无嵌套 Agent 路由到 fallback 或主会话",
  triggerEvalDoc.includes("references/headless-trigger-fallback.md")
  && triggerEvalDoc.includes("交回主会话直跑"));
check("fallback 文档固化三禁、单轮与扫描边界", [
  "不得读取、备份、修改或恢复 `~/.zcode/cli/config.json`",
  "凭据只进进程环境",
  "禁止自答",
  "--max-turns 1",
  "RESIDUE_SCAN_OK",
  "BLOCKED",
].every((s) => fallbackDoc.includes(s)));
check("fallback 文档用 PATH 发现 Git Bash zcode 入口", fallbackDoc.includes('ZCODE_BIN="$(command -v zcode)"')
  && fallbackDoc.includes('--command-arg "$ZCODE_BIN"'));
function markdownFilesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFilesUnder(path);
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  });
}
const publishedDocPaths = markdownFilesUnder(CREATOR_DIR);
const hardcodedUserDir = /(?:[a-z]:[\\/](?:users|documents and settings)[\\/][^\s<]+|\/(?:[a-z]\/)?users\/[^\s<]+|\/(?:home|root)\/[^\s<]+)/i;
const userPathOffenders = publishedDocPaths.filter((path) => hardcodedUserDir.test(readFileSync(path, "utf8")));
check(`发布文档不硬编码用户目录绝对路径${userPathOffenders.length ? `: ${userPathOffenders.join(", ")}` : ""}`,
  userPathOffenders.length === 0);

const fallbackRoot = mkdtempSync(join(tmpdir(), "headless-probe-test-"));
try {
  const fakeCli = join(fallbackRoot, "fake-zcode.mjs");
  const skillsFile = join(fallbackRoot, "visible-skills.txt");
  const privateTemp = join(fallbackRoot, "private-temp");
  const sharedConfig = join(fallbackRoot, ".zcode", "cli", "config.json");
  mkdirSync(dirname(sharedConfig), { recursive: true });
  // 预存的假 secret store 故意含测试前缀：扫描若读取它，成功用例就会失败。
  writeFileSync(sharedConfig, "PSC_TEST_ONLY_NOT_A_REAL_SECRET_123456789\n", "utf8");
  writeFileSync(skillsFile, "demo-skill: 处理真实的演示任务\n", "utf8");
  writeFileSync(fakeCli, `
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];
const prompt = value("--prompt") ?? "";
const settings = value("--settings") ?? "";
const contractOk = value("--max-turns") === "1"
  && value("--mode") === "plan"
  && value("--surface") === "terminal"
  && args.includes("--no-color")
  && readFileSync(settings, "utf8").trim() === "{}"
  && prompt.startsWith("你是一个技能路由判断器。你不需要、也不允许实际执行任务、调用任何工具或浏览任何文件")
  && prompt.includes("第一行输出 ")
  && prompt.includes("SKILL: <技能name>")
  && process.env.ZCODE_API_KEY
  && process.env.ZCODE_MODEL === "fake-same-model";
if (!contractOk) process.exit(9);
if (process.env.PSC_FAKE_MODE === "both-leaks") {
  writeFileSync(process.env.TEMP + "/leaked-key.txt", process.env.ZCODE_API_KEY, "utf8");
  writeFileSync(process.env.PSC_LEAK_FILE, process.env.ZCODE_API_KEY, "utf8");
  console.log("SKILL: demo-skill\\n路由匹配");
} else if (process.env.PSC_FAKE_MODE === "private-leak") {
  writeFileSync(process.env.TEMP + "/leaked-key.txt", process.env.ZCODE_API_KEY, "utf8");
  console.log("SKILL: demo-skill\\n路由匹配");
} else if (process.env.PSC_FAKE_MODE === "leak-file") {
  writeFileSync(process.env.PSC_LEAK_FILE, process.env.ZCODE_API_KEY, "utf8");
  console.log("SKILL: demo-skill\\n路由匹配");
} else if (process.env.PSC_FAKE_MODE === "prefix-filename") {
  writeFileSync(process.env.PSC_LEAK_DIR + "/" + process.env.ZCODE_API_KEY.slice(0, 12) + "-name.txt", "no secret content", "utf8");
  console.log("SKILL: demo-skill\\n路由匹配");
} else if (process.env.PSC_FAKE_MODE === "secret-output") {
  console.log(process.env.ZCODE_API_KEY);
} else if (process.env.PSC_FAKE_MODE === "invalid") {
  console.log("我觉得应该用 demo-skill");
} else if (process.env.PSC_FAKE_MODE === "long-reason") {
  console.log("SKILL: demo-skill\\n这个理由明显已经超过十五个汉字所以必须失败关闭");
} else {
  console.log("SKILL: demo-skill\\n路由匹配");
}
`, "utf8");

  // 明显的测试占位串，不是 Provider 凭据；只通过子进程 env 注入。
  const fakeKey = "PSC_TEST_ONLY_NOT_A_REAL_SECRET_123456789";
  const baseArgs = [
    "--query", "请处理这个演示任务",
    "--skills-file", skillsFile,
    "--command", process.execPath,
    "--command-arg", fakeCli,
    "--temp-root", privateTemp,
    "--scan-root", fallbackRoot,
  ];
  const baseEnv = {
    ...process.env,
    HOME: fallbackRoot,
    USERPROFILE: fallbackRoot,
    ZCODE_API_KEY: fakeKey,
    ZCODE_MODEL: "fake-same-model",
  };
  const sharedBefore = readFileSync(sharedConfig, "utf8");
  const success = runFile("run-headless-trigger-probe.mjs", baseArgs, { env: baseEnv });
  check("fallback: 单轮 Provider 合法结果原样转发", success.code === 0
    && success.stdout === "SKILL: demo-skill\n路由匹配\n");
  check("fallback: 共享 cli/config.json 未读写流程保持原样", readFileSync(sharedConfig, "utf8") === sharedBefore);
  check("fallback: 私有 psc-trigger-probe 临时目录清零", readdirSync(privateTemp).length === 0);
  check("fallback: stdout/stderr 不含测试凭据或前缀", !out(success).includes(fakeKey)
    && !out(success).includes(fakeKey.slice(0, 12)));

  const noKeyEnv = { ...baseEnv };
  delete noKeyEnv.ZCODE_API_KEY;
  const noKey = runFile("run-headless-trigger-probe.mjs", baseArgs, { env: noKeyEnv });
  check("fallback: 无进程环境 key 失败关闭", noKey.code === 1 && out(noKey).includes("缺少有效的 ZCODE_API_KEY")
    && !out(noKey).includes("SKILL:"));

  const invalid = runFile("run-headless-trigger-probe.mjs", baseArgs, {
    env: { ...baseEnv, PSC_FAKE_MODE: "invalid" },
  });
  check("fallback: Provider 协议非法时不猜测不自答", invalid.code === 1
    && out(invalid).includes("不猜测、不代答") && !out(invalid).includes("SKILL: demo-skill"));

  const longReason = runFile("run-headless-trigger-probe.mjs", baseArgs, {
    env: { ...baseEnv, PSC_FAKE_MODE: "long-reason" },
  });
  check("fallback: 超长理由失败关闭而非截断", longReason.code === 1
    && out(longReason).includes("超过 15 字") && !out(longReason).includes("SKILL: demo-skill"));

  const secretOutput = runFile("run-headless-trigger-probe.mjs", baseArgs, {
    env: { ...baseEnv, PSC_FAKE_MODE: "secret-output" },
  });
  check("fallback: Provider 输出凭据时抑制原文", secretOutput.code === 1
    && out(secretOutput).includes("内容已抑制")
    && !out(secretOutput).includes(fakeKey) && !out(secretOutput).includes(fakeKey.slice(0, 12)));

  const privateLeak = runFile("run-headless-trigger-probe.mjs", baseArgs, {
    env: { ...baseEnv, PSC_FAKE_MODE: "private-leak" },
  });
  check("fallback: 私有 Temp 凭据落盘被发现且清理", privateLeak.code === 1
    && out(privateLeak).includes("写入私有 Temp") && readdirSync(privateTemp).length === 0
    && !out(privateLeak).includes(fakeKey));

  const bothLeakFile = join(fallbackRoot, "both-leaks-outside.txt");
  const bothLeaked = runFile("run-headless-trigger-probe.mjs", baseArgs, {
    env: { ...baseEnv, PSC_FAKE_MODE: "both-leaks", PSC_LEAK_FILE: bothLeakFile },
  });
  const bothOutput = out(bothLeaked);
  check("fallback: 私有与外部同时泄漏仍完成外部扫描再统一失败", bothLeaked.code === 1
    && bothOutput.includes("写入私有 Temp")
    && bothOutput.includes("凭据前缀残留 1 个文件")
    && bothOutput.includes("RESIDUE_SCAN_DONE")
    && bothOutput.includes("findings=1")
    && bothOutput.includes("status=failed")
    && bothOutput.indexOf("RESIDUE_SCAN_DONE") < bothOutput.indexOf("写入私有 Temp")
    && bothOutput.includes(bothLeakFile)
    && readdirSync(privateTemp).length === 0
    && !bothOutput.includes(fakeKey));
  rmSync(bothLeakFile, { force: true });

  const leakFile = join(fallbackRoot, "outside-private-temp.txt");
  const leaked = runFile("run-headless-trigger-probe.mjs", baseArgs, {
    env: { ...baseEnv, PSC_FAKE_MODE: "leak-file", PSC_LEAK_FILE: leakFile },
  });
  check("fallback: 扫描根发现凭据前缀即拒绝", leaked.code === 1
    && out(leaked).includes("凭据前缀残留") && out(leaked).includes(leakFile)
    && !out(leaked).includes(fakeKey));
  rmSync(leakFile, { force: true });

  const prefixFilename = join(fallbackRoot, `${fakeKey.slice(0, 12)}-name.txt`);
  const filenameLeaked = runFile("run-headless-trigger-probe.mjs", baseArgs, {
    env: { ...baseEnv, PSC_FAKE_MODE: "prefix-filename", PSC_LEAK_DIR: fallbackRoot },
  });
  const filenameOutput = out(filenameLeaked);
  check("fallback: 文件名含 key 前缀时检出且整条路径脱敏", filenameLeaked.code === 1
    && filenameOutput.includes("RESIDUE [REDACTED_SECRET_DERIVED_PATH]")
    && filenameOutput.includes("findings=1")
    && !filenameOutput.includes(prefixFilename)
    && !filenameOutput.includes(fakeKey)
    && !filenameOutput.includes(fakeKey.slice(0, 12)));
  rmSync(prefixFilename, { force: true });

  const missingCli = runFile("run-headless-trigger-probe.mjs", [
    ...baseArgs.slice(0, 4),
    "--command", join(fallbackRoot, "no-such-zcode"),
    "--temp-root", privateTemp,
    "--scan-root", fallbackRoot,
  ], { env: baseEnv });
  check("fallback: CLI 缺失不生成探针答案", missingCli.code === 1
    && out(missingCli).includes("不生成探针答案") && !out(missingCli).includes("SKILL:"));

  writeFileSync(skillsFile, "demo-skill: should_trigger=true\n", "utf8");
  const polluted = runFile("run-headless-trigger-probe.mjs", baseArgs, { env: baseEnv });
  check("fallback: 技能清单混入预期答案提示时拒绝", polluted.code === 1
    && out(polluted).includes("混入评测答案") && !out(polluted).includes("SKILL:"));
} finally {
  rmSync(fallbackRoot, { recursive: true, force: true });
}

function exists(p) {
  try { readFileSync(p); return true; } catch { return false; }
}

// ---- snapshot-skill.mjs ----
const root = mkdtempSync(join(tmpdir(), "snaptest-"));
const skillsRoot = join(root, "skills"); // 模拟技能扫描根，workspace 缺省必须落在平行 evals 根
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
  const defaultSnap = join(root, "evals", "demo-skill-workspace", "skill-snapshot");
  check("缺省落到与 skills 平行的 evals/", byDefault.stdout.includes(`SNAPSHOT ${defaultSnap}`));
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
  check("SKILL.md 含 TODO 占位时给提示(不挡退出码)", qv.code === 0 && qv.stdout.includes("提示: SKILL.md 仍含 TODO 占位"));

  const bare = join(root3, "bare-skill");
  mkdirSync(bare, { recursive: true });
  writeFileSync(join(bare, "SKILL.md"), "---\nname: bare-skill\ndescription: d\n---\n");
  const qvWarn = runFile("quick-validate.mjs", [bare]);
  check("无 run-tests 时 PASS 但给警告", qvWarn.code === 0 && qvWarn.stdout.includes("警告: 无 run-tests.mjs"));
  check("无 design.md 时 PASS 但给警告", qvWarn.code === 0 && qvWarn.stdout.includes("警告: 无 references/design.md"));

  check("生成 references/design.md 骨架", exists(join(genDir, "references", "design.md")));
  check("生成 agents/openai.yaml", exists(join(genDir, "agents", "openai.yaml")));
  const design = readFileSync(join(genDir, "references", "design.md"), "utf8");
  check("design.md 四节齐全且验收编号 AC-N", ["## 意图与触发场景", "## 设计取舍", "## 验收条件", "## 迭代记录", "AC-1"].every((s) => design.includes(s)));
  const interfaceYaml = readFileSync(join(genDir, "agents", "openai.yaml"), "utf8");
  check("openai.yaml 含三项 interface 元数据", ["display_name:", "short_description:", "default_prompt:", "$demo-gen"].every((s) => interfaceYaml.includes(s)));
  check("openai.yaml display_name 与技能名一致", interfaceYaml.includes('display_name: "demo-gen"'));
  const aliasAttempt = runFile("init-skill.mjs", ["Alias Demo", "--interface", "display_name=别名", "--path", join(root3, "locked")]);
  check("init 拒绝 display_name 别名", aliasAttempt.code === 2 && out(aliasAttempt).includes("display_name 固定为技能目录名"));
  check("init stdout 报 design/openai 产物行", gen.stdout.includes("references/design.md") && gen.stdout.includes("agents/openai.yaml") && gen.stdout.includes("AC-N"));

  const proseSkill = join(root3, "prose-skill");
  mkdirSync(proseSkill, { recursive: true });
  writeFileSync(join(proseSkill, "SKILL.md"), "---\nname: prose-skill\ndescription: d\n---\n规则说明：`[TODO` 是校验器提示文本，不是占位。\n");
  const qvProse = runFile("quick-validate.mjs", [proseSkill]);
  check("正文引用 [TODO 不触发误报", qvProse.code === 0 && !qvProse.stdout.includes("提示: SKILL.md 仍含 TODO 占位"));
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
  check("干净根报告技能 1 个(递归)", clean.stdout.includes("技能 1 个（递归）"));

  mk(join(skills, "real-skill-workspace", "iteration-1", "outputs", "fake"), "fake-skill");
  const dirty = runFile("check-shadow-skills.mjs", [skills]);
  check("出现影子后退出码 1", dirty.code === 1);
  check("点名产物内活 SKILL.md 相对路径", dirty.stdout.includes(join("real-skill-workspace", "iteration-1", "outputs", "fake", "SKILL.md")));
  check("标注位于评测产物目录", dirty.stdout.includes("位于评测产物目录"));

  check("不存在的根退出码 2", runFile("check-shadow-skills.mjs", [join(root2, "no-such")]).code === 2);

  // 无参数：从脚本自身位置推导 skills 祖先扫描根（扁平挂载=技能父目录），不依赖宿主目录名
  const host = join(root2, "skill-host");
  const hostSkills = join(host, "skills");
  const copiedChecker = join(hostSkills, "creator", "scripts", "check-shadow-skills.mjs");
  mkdirSync(join(hostSkills, "creator", "scripts"), { recursive: true });
  cpSync(join(SCRIPTS, "check-shadow-skills.mjs"), copiedChecker);
  mkdirSync(join(hostSkills, "only-skill"), { recursive: true });
  writeFileSync(join(hostSkills, "only-skill", "SKILL.md"), "---\nname: only-skill\ndescription: d\n---\n");
  const auto = runNode(copiedChecker, [], { cwd: root2 });
  check("无参数从自身位置推导干净根退出码 0", auto.code === 0 && auto.stdout.includes(hostSkills));
} finally {
  rmSync(root2, { recursive: true, force: true });
}

// ---- 分类布局与缺省解析回归（2026-08-30 布局大搬移后两条不变量恢复） ----
console.log("分类布局·快照落点：");
const rootCat = mkdtempSync(join(tmpdir(), "cattest-"));
try {
  const mk = (p, name) => {
    mkdirSync(p, { recursive: true });
    writeFileSync(join(p, "SKILL.md"), `---\nname: ${name}\ndescription: d\n---\n`);
  };
  const repo = join(rootCat, "repo");
  const skillsCat = join(repo, "skills");
  mk(join(skillsCat, "workflow", "two-layer"), "two-layer");
  mk(join(skillsCat, "matt-skills", "engineering", "three-layer"), "three-layer");

  const snap2 = run([join(skillsCat, "workflow", "two-layer")]);
  check("快照缺省: 分类 2 层技能落 skills 祖先父级的 evals/(扫描根外)",
    snap2.code === 0 && snap2.stdout.includes(`SNAPSHOT ${join(repo, "evals", "two-layer-workspace", "skill-snapshot")}`));
  const snap3 = run([join(skillsCat, "matt-skills", "engineering", "three-layer")]);
  check("快照缺省: 分类 3 层技能落同一公式(与嵌套深度无关)",
    snap3.code === 0 && snap3.stdout.includes(`SNAPSHOT ${join(repo, "evals", "three-layer-workspace", "skill-snapshot")}`));
  check("快照缺省: 分类布局快照同样去识别化",
    exists(join(repo, "evals", "two-layer-workspace", "skill-snapshot", "SKILL.md.bak"))
    && !exists(join(repo, "evals", "two-layer-workspace", "skill-snapshot", "SKILL.md")));

  console.log("分类布局·快照回退：");
  const lonely = join(rootCat, "mytools", "foo-skill");
  mk(lonely, "foo-skill");
  const fallbackSnap = run([lonely]);
  check("快照回退: 无 skills 祖先时回退上两级公式且落点不变",
    fallbackSnap.code === 0
    && fallbackSnap.stdout.includes(`SNAPSHOT ${join(rootCat, "evals", "foo-skill-workspace", "skill-snapshot")}`));
  check("快照回退: stdout 多一行回退提示且退出码不变",
    fallbackSnap.code === 0 && fallbackSnap.stdout.includes("回退上两级")
    && fallbackSnap.stdout.includes("SNAPSHOT "));

  console.log("分类布局·影子判据：");
  const catClean = runFile("check-shadow-skills.mjs", [skillsCat]);
  check("影子判据: 分类根 2~3 层真技能全合法不误报",
    catClean.code === 0 && catClean.stdout.includes("技能 2 个（递归）")
    && catClean.stdout.includes("✓ 无影子技能"));

  // 无参数派生：从 3 层分类技能跑，应覆盖全 skills 根而不是 skills/<分类>
  const catCreator = join(skillsCat, "matt-skills", "engineering", "creator");
  mkdirSync(join(catCreator, "scripts"), { recursive: true });
  cpSync(join(SCRIPTS, "check-shadow-skills.mjs"), join(catCreator, "scripts", "check-shadow-skills.mjs"));
  const derived = runNode(join(catCreator, "scripts", "check-shadow-skills.mjs"), [], { cwd: rootCat });
  check("影子派生: 无参数从 3 层分类技能覆盖全 skills 根",
    derived.code === 0 && derived.stdout.includes(skillsCat));

  mk(join(skillsCat, "evals", "demo-workspace", "skill-snapshot"), "demo");
  mk(join(skillsCat, "life", "shopping-deep-research"), "shopping-deep-research");
  mk(join(skillsCat, "life", "shopping-deep-research", "eval-fixtures", "case-a"), "fixture-fake");
  const catDirty = runFile("check-shadow-skills.mjs", [skillsCat]);
  check("影子判据: 扫描根内产物名单目录的活 SKILL.md 点名判影子",
    catDirty.code === 1
    && catDirty.stdout.includes(join("evals", "demo-workspace", "skill-snapshot", "SKILL.md"))
    && catDirty.stdout.includes("位于评测产物目录"));
  check("影子判据: 真技能族内 eval-fixtures 产物同判不豁免",
    catDirty.code === 1
    && catDirty.stdout.includes(join("life", "shopping-deep-research", "eval-fixtures", "case-a", "SKILL.md")));

  console.log("link 挂载快照：");
  const realSkill = join(rootCat, "repo", "skills", "workflow", "two-layer");
  const flatHost = join(rootCat, "flat-host");
  const flatSkills = join(flatHost, "skills");
  mkdirSync(flatSkills, { recursive: true });
  let linkMade = true;
  try {
    symlinkSync(realSkill, join(flatSkills, "two-layer"), "junction");
  } catch {
    linkMade = false; // 无链接权限的环境按设计跳过
  }
  if (linkMade) {
    const viaLink = run([join(flatSkills, "two-layer")]);
    const linkSnap = join(flatHost, "evals", "two-layer-workspace", "skill-snapshot");
    check("快照缺省: link 挂载落调用侧 skills 祖先父级 evals/",
      viaLink.code === 0 && viaLink.stdout.includes(`SNAPSHOT ${linkSnap}`));
    check("link 挂载: 复制实体而非链接，源 SKILL.md 原样保留",
      exists(join(linkSnap, "SKILL.md.bak")) && !exists(join(linkSnap, "SKILL.md"))
      && readFileSync(join(realSkill, "SKILL.md"), "utf8").includes("name: two-layer"));
  } else {
    check("link 挂载: 无法建链接夹具时按设计跳过", true);
  }
} finally {
  rmSync(rootCat, { recursive: true, force: true });
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

  writeFileSync(join(root4, "evals"), "x"); // 占用缺省 workspace 的上级路径名
  const defBlocked = run([advSkill]);
  check("缺省 workspace 被文件占用 → 干净拒绝 1（不吐堆栈）", defBlocked.code === 1 && out(defBlocked).includes("拒绝"));
  rmSync(join(root4, "evals"));

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

// ---- frontmatter 支持子集边界（issue #54：与宿主 YAML 语义对齐 / 越界失败关闭） ----
console.log("frontmatter·支持子集与失败关闭：");
const root54 = mkdtempSync(join(tmpdir(), "fm54-"));
try {
  const BS = String.fromCharCode(92);
  const Q = String.fromCharCode(34);
  const SQ = String.fromCharCode(39);
  const mk = (name, fmBody) => {
    const d = join(root54, name);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "SKILL.md"), "---" + "\n" + fmBody + "\n---\n\nbody\n");
    return d;
  };

  // 修复类：解析结果必须与宿主一致，判定不能相反
  const longPlain = mk("long-plain",
    "name: probe-skill\ndescription: " + "A".repeat(600) + "\n  " + "B".repeat(600));
  const rLong = runFile("quick-validate.mjs", [longPlain]);
  check("多行 plain 标量：折叠后按 1201 判超长(旧实现读 600 假 PASS)",
    rLong.code === 1 && out(rLong).includes("1201"));

  const escQ = mk("esc-quote",
    "name: probe-skill\ndescription: " + Q + "say " + BS + Q + "hi" + BS + Q + " now" + Q);
  const rEsc = runFile("quick-validate.mjs", [escQ]);
  check("双引号转义：解出真引号，长度 12 与宿主一致",
    rEsc.code === 0 && out(rEsc).includes("12/1024"));

  const uEsc = mk("u-escape",
    "name: probe-skill\ndescription: " + Q + "tag " + BS + "u003ca" + BS + "u003e end" + Q);
  const rU = runFile("quick-validate.mjs", [uEsc]);
  check("\u003c 转义：解出真尖括号并被尖括号规则拦下(旧实现可绕过)",
    rU.code === 1 && out(rU).includes("尖括号"));

  const cmt = mk("trailing-comment", "name: probe-skill # 这是注释\ndescription: hello world # note");
  const rCmt = runFile("quick-validate.mjs", [cmt]);
  check("行尾注释：剥离后 name 不被误判非 kebab-case(旧实现假 FAIL)",
    rCmt.code === 0 && out(rCmt).includes("11/1024"));

  // 失败关闭类：不猜，退出码 3
  const flowDesc = mk("flow-desc", "name: probe-skill\ndescription: [a, b, c]");
  const rFlow = runFile("quick-validate.mjs", [flowDesc]);
  check("description 是 flow 集合 → 无法判定退出 3",
    rFlow.code === 3 && out(rFlow).includes("UNDECIDABLE"));

  const crossQ = mk("cross-quote",
    "name: probe-skill\ndescription: " + Q + "line1\n  line2" + Q);
  check("跨行引号标量 → 无法判定退出 3", runFile("quick-validate.mjs", [crossQ]).code === 3);

  const sqEsc = mk("sq-escape",
    "name: probe-skill\ndescription: " + SQ + "it" + SQ + SQ + "s fine" + SQ);
  check("单引号双写转义 → 无法判定退出 3", runFile("quick-validate.mjs", [sqEsc]).code === 3);

  const keepChomp = mk("keep-chomp", "name: probe-skill\ndescription: |+\n  line1\n  line2");
  check("块标量 keep chomping(+) → 无法判定退出 3", runFile("quick-validate.mjs", [keepChomp]).code === 3);

  // 越界落在不被校验的键上时不得阻塞（野外 3 处命中全在这类键）
  const flowTools = mk("flow-tools",
    "name: probe-skill\ndescription: a normal description\nallowed-tools: [Read, Glob, Grep]");
  check("allowed-tools 是 flow 集合 → 不阻塞判定(仍 PASS)",
    runFile("quick-validate.mjs", [flowTools]).code === 0);

  // 打包门禁必须同样守住「无法判定」
  writeFileSync(join(flowDesc, "run-tests.mjs"), "process.exit(0);\n");
  const rPkg = runFile("package-skill.mjs", [flowDesc, join(root54, "dist")]);
  check("无法判定的技能拒绝打包且不产出包",
    rPkg.code === 1 && !exists(join(root54, "dist", "flow-desc.skill")));
} finally {
  rmSync(root54, { recursive: true, force: true });
}

// ---- frontmatter 键分诊（issue #63：未知键降警告，拼错的已知键仍判错） ----
console.log("frontmatter·键分诊：");
const root63 = mkdtempSync(join(tmpdir(), "keys63-"));
try {
  const mkKey = (name, extraLine) => {
    const d = join(root63, name);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "SKILL.md"),
      "---\nname: probe-skill\ndescription: a valid description here\n" + extraLine + "\n---\n\nbody\n");
    return d;
  };

  const rTypo = runFile("quick-validate.mjs", [mkKey("typo-desc", "descrption: 拼错")]);
  check("拼错的已知键判 FAIL 并给出建议",
    rTypo.code === 1 && out(rTypo).includes("疑似拼错") && out(rTypo).includes("description"));

  const rTypo2 = runFile("quick-validate.mjs", [mkKey("typo-tools", "allowed_tool: Read")]);
  check("下划线+缺字母的 allowed_tool 判 FAIL", rTypo2.code === 1 && out(rTypo2).includes("疑似拼错"));

  // 宿主对部分键接受 kebab/snake/camel 三种写法，归一后不得误判成拼写错
  const rSnake = runFile("quick-validate.mjs", [mkKey("snake-ok", "display_name: Demo")]);
  check("已知键的 snake_case 变体 PASS 且不报拼写错",
    rSnake.code === 0 && !out(rSnake).includes("疑似拼错"));
  const rCamel = runFile("quick-validate.mjs", [mkKey("camel-ok", "defaultEnabled: true")]);
  check("已知键的 camelCase 变体 PASS", rCamel.code === 0);

  // changelog 求证过的宿主键必须在已知集内（否则每次宿主加键都要改 psc）
  for (const k of ["disable-model-invocation: true", "argument-hint: [x]", "user-invocable: false", "effort: high"]) {
    const key = k.split(":")[0];
    const r = runFile("quick-validate.mjs", [mkKey("known-" + key, k)]);
    check(`已知宿主键 ${key} 不再被拒`, r.code === 0 && !out(r).includes("未知键"));
  }

  // 宿主新增而 changelog 无 skill 侧记载的键：只警告，不挡退出码
  const rNew = runFile("quick-validate.mjs", [mkKey("host-new", "version: 1.2.0")]);
  check("未知键只警告不挡退出码", rNew.code === 0 && out(rNew).includes("未知键"));
} finally {
  rmSync(root63, { recursive: true, force: true });
}

// ---- 全仓复扫防腐化（issue #63：单技能 fixture 看不见门禁腐化） ----
// 门禁规则腐化只有在真实语料上才暴露——本条正是这么发现的（曾拒掉 58 个技能里的 24 个）。
// 本仓之外的宿主没有这个目录结构，此时跳过而不是失败，保持技能可移植。
console.log("全仓复扫·门禁腐化：");
{
  const SKILL_DIR_63 = dirname(SCRIPTS);
  const { pathToFileURL } = await import("node:url");
  const repoRoot = join(SKILL_DIR_63, "..", "..", "..");
  // 注意：本文件的 exists() 用 readFileSync 实现，对目录会抛 EISDIR，不能用来判目录。
  const isDir63 = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
  const roots = ["skills", join(".agents", "skills")]
    .map((r) => join(repoRoot, r))
    .filter(isDir63);
  if (roots.length === 0) {
    check("全仓复扫：非本仓布局，按设计跳过", true);
  } else {
    const { validateSkill } = await import(pathToFileURL(join(SKILL_DIR_63, "scripts", "quick-validate.mjs")).href);
    const dirs = [];
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const p = join(d, e.name);
        if (exists(join(p, "SKILL.md"))) dirs.push(p);
        else walk(p);
      }
    };
    for (const r of roots) walk(r);
    const bad = [];
    for (const d of dirs) {
      const r = validateSkill(d);
      if (r.undecidable && r.undecidable.length) bad.push(`${d} → 无法判定`);
      else if (!r.valid) bad.push(`${d} → ${r.errors[0]}`);
    }
    check(`全仓 ${dirs.length} 个技能全部过门禁${bad.length ? "：" + bad.slice(0, 3).join(" / ") : ""}`,
      dirs.length > 0 && bad.length === 0);
  }
}

// ---- 孤儿资源检测（issue #56：comparator.md 曾在参考清单里挂了 202 行却无调用路径） ----
// 病根是「文件存在、被索引、但正文没有任何一处说何时用它」。文件存在性测不出这一点，
// 但「SKILL.md 里根本没提到它」是可测的，也是孤儿的第一道征兆。
console.log("孤儿资源检测：");
{
  const SKILL_DIR_56 = dirname(SCRIPTS);
  const skillMd = readFileSync(join(SKILL_DIR_56, "SKILL.md"), "utf8");
  const orphans = [];
  for (const sub of ["agents", "references"]) {
    const dir = join(SKILL_DIR_56, sub);
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (!skillMd.includes(`${sub}/${e.name}`)) orphans.push(`${sub}/${e.name}`);
    }
  }
  check(`agents/ 与 references/ 下无孤儿资源${orphans.length ? "：" + orphans.join(", ") : ""}`,
    orphans.length === 0);
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
  check("包内含 agents/openai.yaml", zip.includes(Buffer.from("pkg-demo/agents/openai.yaml")));
  check("包内含 history.json", zip.includes(Buffer.from("pkg-demo/history.json")));
  check("包内含 run-tests.mjs", zip.includes(Buffer.from("pkg-demo/run-tests.mjs")));

  writeFileSync(join(pkgDir, "run-tests.mjs"), "#!/usr/bin/env node\nconsole.log('intentional failure');\nprocess.exit(7);\n", "utf8");
  const rejectedDist = join(root5, "rejected-dist");
  const rejected = runFile("package-skill.mjs", [pkgDir, rejectedDist]);
  check("失败的 run-tests 拒绝打包且不产出包", rejected.code === 1
    && out(rejected).includes("技能自测未通过")
    && !exists(join(rejectedDist, "pkg-demo.skill")));
} finally {
  rmSync(root5, { recursive: true, force: true });
}

// ---- 聚合·timing 全缺失防呆（离线夹具：全 null/部分有效/正常/无 timing 文件） ----
console.log("聚合·timing 缺失诊断：");
const timingFixtureRoot = join(CREATOR_DIR, "fixtures", "aggregate-timing");
const timingTestRoot = mkdtempSync(join(tmpdir(), "timing-fixture-test-"));
try {
  const aggregateFixture = (name, persistHistory = false) => {
    const target = join(timingTestRoot, name);
    cpSync(join(timingFixtureRoot, name, "iteration-1"), join(target, "iteration-1"), { recursive: true });
    const iterDir = join(target, "iteration-1");
    const args = [iterDir, "--skill-name", "timing-demo"];
    const historyDir = join(target, "skill");
    if (persistHistory) { mkdirSync(historyDir); args.push("--history", historyDir); }
    const result = runFile("aggregate-benchmark.mjs", args);
    const benchmark = JSON.parse(readFileSync(join(iterDir, "benchmark.json"), "utf8"));
    const markdown = readFileSync(join(iterDir, "benchmark.md"), "utf8");
    const history = persistHistory ? JSON.parse(readFileSync(join(historyDir, "history.json"), "utf8")) : null;
    return { result, benchmark, markdown, history };
  };

  const allNull = aggregateFixture("all-null", true);
  check("timing 全 null: 聚合成功且 stdout 显著告警", allNull.result.code === 0
    && (allNull.result.stdout.match(/^警告: timing 全缺失：/gm) || []).length === 2);
  check("timing 全 null: benchmark 保持 null、不伪造 0", allNull.benchmark.configs.with_skill.time_ms.mean === null
    && allNull.benchmark.configs.with_skill.tokens.mean === null
    && allNull.benchmark.delta.time_ms === null
    && allNull.benchmark.delta.tokens === null);
  check("timing 全 null: markdown/终端显示未测量", allNull.markdown.includes("未测量") && allNull.result.stdout.includes("未测量"));
  check("timing 全 null: --history 仍追加一条且保持 null", allNull.history.runs.length === 1
    && allNull.history.runs[0].gates.with_skill.mean_ms === null
    && allNull.history.runs[0].gates.with_skill.mean_tokens === null);

  const partial = aggregateFixture("partial");
  check("timing 部分有效: 不误报整轮全缺失且保留可用样本", partial.result.code === 0
    && !partial.benchmark.warnings.some((warning) => warning.startsWith("timing 全缺失"))
    && partial.benchmark.configs.with_skill.tokens.mean === 200
    && partial.benchmark.configs.without_skill.time_ms.mean === 1200);
  check("timing 部分有效: 缺失侧仍为 null，delta 不造假", partial.benchmark.configs.with_skill.time_ms.mean === null
    && partial.benchmark.configs.without_skill.tokens.mean === null
    && partial.benchmark.delta.time_ms === null
    && partial.benchmark.delta.tokens === null);

  const normal = aggregateFixture("normal");
  check("timing 正常: 数值与 delta 保持兼容", normal.result.code === 0 && normal.benchmark.warnings.length === 0
    && normal.benchmark.configs.with_skill.time_ms.mean === 1200
    && normal.benchmark.configs.without_skill.tokens.mean === 180
    && normal.benchmark.delta.time_ms === 200
    && normal.benchmark.delta.tokens === 20);

  const missing = aggregateFixture("missing-file");
  check("timing 文件缺失: 与 null 同样显式诊断", missing.result.code === 0
    && missing.benchmark.warnings.filter((warning) => warning.startsWith("timing 全缺失")).length === 2
    && missing.benchmark.configs.with_skill.time_ms.mean === null
    && missing.benchmark.configs.without_skill.tokens.mean === null
    && missing.result.stdout.includes("timing.json 缺失"));
} finally {
  rmSync(timingTestRoot, { recursive: true, force: true });
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
  // iteration-3: 与 iteration-2 同通过率（防抖用，独立 ref）
  for (const [ev, pass] of [["eval-b", true], ["eval-c", true]]) { mkRun("iteration-3", ev, "with_skill", pass); mkRun("iteration-3", ev, "without_skill", false); }
  // iteration-4: 同样全过，但 gate 改名 my_skill（gate 不连续场景）
  for (const [ev, pass] of [["eval-b", true], ["eval-c", true]]) { mkRun("iteration-4", ev, "my_skill", pass); mkRun("iteration-4", ev, "without_skill", false); }

  const skillDir = join(root6, "skill");
  mkdirSync(skillDir);
  const agg = (iter, extra = []) => runFile("aggregate-benchmark.mjs", [join(root6, "ws", iter), "--skill-name", "hist-demo", ...extra]);
  const aggH = (iter) => agg(iter, ["--history", skillDir]);

  // history 断档：上一轮目录仍在，但首次聚合当前轮时没有上一轮 history 条目。
  const skillDirGap = join(root6, "skill-gap");
  mkdirSync(skillDirGap);
  const gapRun = agg("iteration-2", ["--history", skillDirGap]);
  const gapBenchmark = JSON.parse(readFileSync(join(root6, "ws", "iteration-2", "benchmark.json"), "utf8"));
  const gapHistory = JSON.parse(readFileSync(join(skillDirGap, "history.json"), "utf8"));
  check("断档: workspace 有上一轮但 history 缺条目时显著告警", gapRun.code === 0
    && gapRun.stdout.includes("警告: history 断档")
    && gapBenchmark.warnings.some((warning) => warning.includes("iteration-1") && warning.includes("history.json")));
  check("断档: 不伪造上一轮 history，只追加当前轮", gapHistory.runs.length === 1
    && gapHistory.runs[0].iteration_ref.endsWith("iteration-2"));

  const r1 = aggH("iteration-1");
  const h1 = JSON.parse(readFileSync(join(skillDir, "history.json"), "utf8"));
  check("首轮: 创建 history.json 且 1 条 run", r1.code === 0 && h1.runs.length === 1);
  check("首轮: vs_previous 为 null", h1.runs[0].vs_previous === null);
  check("首轮: current_best=runs[0]", h1.current_best === "runs[0]");
  check("首轮: gates 键=配置目录名", h1.runs[0].gates.with_skill && h1.runs[0].gates.without_skill);
  check("首轮: stdout 趋势 3 行", (r1.stdout.match(/^history: /gm) || []).length === 3);
  check("断言 ac 字段不碍聚合", r1.code === 0 && JSON.parse(readFileSync(join(root6, "ws", "iteration-1", "benchmark.json"), "utf8")).evals.length === 2);

  // output-evals.json 沉淀（题面+断言，随 --history 同通道）
  const oe1 = JSON.parse(readFileSync(join(skillDir, "output-evals.json"), "utf8"));
  check("题面沉淀: 首轮 skill/evals/prompt 齐全", oe1.skill === "hist-demo" && oe1.evals.length === 2
    && oe1.evals.every((e) => e.prompt === "p"));
  check("题面沉淀: 断言全量含 type/ac", oe1.evals[0].assertions.length === 1
    && oe1.evals[0].assertions[0].name === "断言" && oe1.evals[0].assertions[0].type === "script"
    && oe1.evals[0].assertions[0].ac === "AC-1");
  check("题面沉淀: 记录来源轮次", oe1.source_iteration === "iteration-1");

  const r2 = aggH("iteration-2");
  const h2 = JSON.parse(readFileSync(join(skillDir, "history.json"), "utf8"));
  const vs = h2.runs[1].vs_previous;
  check("次轮: 追加第 2 条且第 1 条未回改", h2.runs.length === 2 && h2.runs[0].date === h1.runs[0].date);
  check("次轮: won/lost/tie 按同 eval 名匹配", vs.won === 1 && vs.lost === 0 && vs.tie === 0);
  check("次轮: eval-b 翻正记 won", vs.detail.some((d) => d.eval === "eval-b" && d.result === "won"));
  check("次轮: 新增 eval-c 记 new 不计胜负", vs.detail.some((d) => d.eval === "eval-c" && d.result === "new") && vs.evals_total === 2);
  check("次轮: 缺席 eval-a 标 dropped", vs.detail.some((d) => d.eval === "eval-a" && d.result === "dropped"));
  check("次轮: current_best 严格推进", h2.current_best === "runs[1]");
  check("断档: 已记录上一轮时不误报", !r2.stdout.includes("history 断档")
    && !JSON.parse(readFileSync(join(root6, "ws", "iteration-2", "benchmark.json"), "utf8")).warnings.some((warning) => warning.includes("history 断档")));

  const oe2 = JSON.parse(readFileSync(join(skillDir, "output-evals.json"), "utf8"));
  check("题面沉淀: 跟随最新轮整写覆盖", oe2.source_iteration === "iteration-2"
    && oe2.evals.map((e) => e.name).join(",") === "eval-b,eval-c");

  const r3 = aggH("iteration-3");
  const h3 = JSON.parse(readFileSync(join(skillDir, "history.json"), "utf8"));
  check("防抖: 独立轮持平不推进 current_best", r3.code === 0 && h3.runs.length === 3 && h3.current_best === "runs[1]");

  // gate 改名：绝不产生幻影 lost，实验 gate 不抢星标
  const r4 = aggH("iteration-4");
  const h4 = JSON.parse(readFileSync(join(skillDir, "history.json"), "utf8"));
  check("gate 改名: 不产生幻影 lost", r4.code === 0 && h4.runs[3].vs_previous === null
    && !JSON.stringify(h4.runs[3].vs_previous).includes('"lost"'));
  check("gate 改名: stdout 明示 gate 不连续", r4.stdout.includes("gate 不连续"));
  check("gate 改名: 实验轮不参与 current_best", h4.current_best === "runs[1]");

  // 重复聚合同一 iteration：预警 + 不自比 + 以最新一条为该轮有效成绩
  const r5 = aggH("iteration-2");
  const h5 = JSON.parse(readFileSync(join(skillDir, "history.json"), "utf8"));
  check("重复聚合: stdout 预警此前已记录", r5.stdout.includes("此前已记录"));
  check("重复聚合: 不与自己比(vs_previous null)", h5.runs[4].vs_previous === null);
  check("重复聚合: 星标以各轮最新有效成绩为准", h5.current_best === "runs[2]");

  writeFileSync(join(skillDir, "history.json"), "{broken", "utf8");
  const r6 = aggH("iteration-2");
  const backups = readdirSync(skillDir).filter((f) => f.startsWith("history.json.corrupt-"));
  const h6 = JSON.parse(readFileSync(join(skillDir, "history.json"), "utf8"));
  check("损坏: 先备份 .corrupt-<ts> 再重建", r6.code === 0 && backups.length >= 1 && h6.runs.length === 1 && h6.current_best === "runs[0]");
  check("损坏: stdout 明示备份不静默", r6.stdout.includes("已备份为 history.json.corrupt-"));

  // 部分损坏：个别 run 形状不合法 → 备份并保留合法 run，好数据不陪葬
  const skillDirP = join(root6, "skill-partial");
  mkdirSync(skillDirP);
  const aggP = (iter) => runFile("aggregate-benchmark.mjs", [join(root6, "ws", iter), "--skill-name", "hist-demo", "--history", skillDirP]);
  aggP("iteration-1");
  aggP("iteration-2");
  const hp = JSON.parse(readFileSync(join(skillDirP, "history.json"), "utf8"));
  hp.runs.push({ date: "bad", iteration_ref: "x" }); // 无 gates 的坏条目
  writeFileSync(join(skillDirP, "history.json"), JSON.stringify(hp), "utf8");
  const rp = aggP("iteration-3");
  const hp2 = JSON.parse(readFileSync(join(skillDirP, "history.json"), "utf8"));
  check("部分损坏: 忽略坏条目保留合法 run", rp.code === 0 && rp.stdout.includes("形状不合法")
    && hp2.runs.length === 3 && readdirSync(skillDirP).some((f) => f.startsWith("history.json.corrupt-")));

  // 锁死防护：半程高估被同 iteration 修正取代，后续真进步仍可推进
  const skillDirL = join(root6, "skill-lock");
  mkdirSync(skillDirL);
  const aggL = (iter) => runFile("aggregate-benchmark.mjs", [join(root6, "ws", iter), "--skill-name", "hist-demo", "--history", skillDirL]);
  aggL("iteration-1");
  const halfFix = JSON.parse(readFileSync(join(skillDirL, "history.json"), "utf8"));
  halfFix.runs[0].gates.with_skill.pass_rate = 1; // 模拟半程聚合高估
  writeFileSync(join(skillDirL, "history.json"), JSON.stringify(halfFix), "utf8");
  aggL("iteration-1"); // 同 iteration 完整重聚(0.5)取代高估
  const hl = JSON.parse(readFileSync(join(skillDirL, "history.json"), "utf8"));
  const corrected = hl.runs[1].gates.with_skill.pass_rate;
  aggL("iteration-2"); // 下轮真到 1.0
  const hl2 = JSON.parse(readFileSync(join(skillDirL, "history.json"), "utf8"));
  check("防锁死: 修正轮取代高估,下轮 1.0 仍可推进", corrected === 0.5 && hl2.current_best === "runs[2]"
    && hl2.runs[2].gates.with_skill.pass_rate === 1);

  const r7 = agg("iteration-1");
  check("无参数: 不产 history 行不在 iteration 目录建 history", r7.code === 0 && !r7.stdout.includes("history:")
    && !exists(join(root6, "ws", "iteration-1", "history.json")));
  check("无参数: 不产题面行不建 output-evals.json", !r7.stdout.includes("evals:")
    && !exists(join(root6, "ws", "iteration-1", "output-evals.json")));

  const r8 = agg("iteration-1", ["--history", join(root6, "no-such")]);
  check("拒绝: 目标不可写退出 1 且 benchmark 照常产出", r8.code === 1 && r8.stdout.includes("拒绝")
    && exists(join(root6, "ws", "iteration-1", "benchmark.json")));

  const skillDirD = join(root6, "skill-dir-case");
  mkdirSync(skillDirD, { recursive: true });
  mkdirSync(join(skillDirD, "history.json")); // history.json 本身是目录
  const r9 = agg("iteration-1", ["--history", skillDirD]);
  check("拒绝: history.json 是目录时不 rename 不追加", r9.code === 1 && r9.stdout.includes("是目录")
    && statSync(join(skillDirD, "history.json")).isDirectory());

  // 题库纪元（bank_epoch）+ 修正条 supersedes：换题面（new/dropped）→ 星标重置为本纪元首轮，不跨纪元比较
  const skillDirE = join(root6, "skill-epoch");
  mkdirSync(skillDirE);
  const aggE = (iter) => runFile("aggregate-benchmark.mjs", [join(root6, "ws", iter), "--skill-name", "hist-demo", "--history", skillDirE]);
  aggE("iteration-1");
  const re2 = aggE("iteration-2"); // eval-c new / eval-a dropped → 换纪元
  const re3 = aggE("iteration-3"); // 同纪元持平
  const he = JSON.parse(readFileSync(join(skillDirE, "history.json"), "utf8"));
  check("纪元: 首轮 bank_epoch=1", he.runs[0].bank_epoch === 1);
  check("纪元: new/dropped 换代 bank_epoch 递增且 stdout 明示", re2.code === 0 && he.runs[1].bank_epoch === 2 && re2.stdout.includes("题库换纪元"));
  check("纪元: 同题面轮次不递增", he.runs[2].bank_epoch === 2);
  check("纪元: 换代首轮 current_best 重置为本轮", he.current_best === "runs[1]");
  check("纪元: 同纪元持平不推进", re3.code === 0 && he.current_best === "runs[1]" && re3.stdout.includes("持平不推进"));
  const re4 = aggE("iteration-3"); // 重复聚合=修正
  const he2 = JSON.parse(readFileSync(join(skillDirE, "history.json"), "utf8"));
  check("修正: supersedes 指向被修正条", he2.runs[3].supersedes === "runs[2]"
    && re4.stdout.includes("supersedes runs[2]"));
} finally {
  rmSync(root6, { recursive: true, force: true });
}

// ---- 聚合·output-evals 边界（字符串断言/缺 prompt/目录占用拒绝） ----
console.log("聚合·题面沉淀边界：");
const root6b = mkdtempSync(join(tmpdir(), "oevalstest-"));
try {
  const mkEval = (ev, metadata) => {
    const d = join(root6b, "iteration-1", ev, "with_skill", "run-1");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "grading.json"), JSON.stringify({ results: [{ name: "x", passed: true }] }));
    if (metadata !== null) writeFileSync(join(root6b, "iteration-1", ev, "eval_metadata.json"), JSON.stringify(metadata));
  };
  mkEval("eval-s", { prompt: "题面", assertions: ["老式字符串断言"] });
  mkEval("eval-t", null); // 无 eval_metadata.json 的 eval

  const sd = join(root6b, "skill");
  mkdirSync(sd);
  const legacy = runFile("aggregate-benchmark.mjs", [join(root6b, "iteration-1"), "--history", sd]);
  const oe = JSON.parse(readFileSync(join(sd, "output-evals.json"), "utf8"));
  check("边界: 字符串断言归一为 {name}", legacy.code === 0 && oe.evals[0].assertions[0].name === "老式字符串断言");
  check("边界: 缺 metadata 的 eval 记空题面并警告", oe.evals[1].prompt === "" && oe.evals[1].assertions.length === 0
    && legacy.stdout.includes("缺 prompt"));

  const sd2 = join(root6b, "skill-dir");
  mkdirSync(join(sd2, "output-evals.json"), { recursive: true }); // 题面文件位是目录
  const dr = runFile("aggregate-benchmark.mjs", [join(root6b, "iteration-1"), "--history", sd2]);
  check("边界: output-evals.json 是目录 → 拒绝 1", dr.code === 1 && dr.stdout.includes("是目录"));

  // --keep-evals：专项轮只跑题库子集时，题库未被本轮跑到的 eval 保留不缩水
  const bankDir = join(root6b, "skill-bank");
  mkdirSync(bankDir);
  writeFileSync(join(bankDir, "output-evals.json"), JSON.stringify({
    skill: "hist-demo", source_iteration: "iteration-0",
    evals: [
      { name: "eval-s", prompt: "旧题面", assertions: [{ name: "旧断言" }] },
      { name: "eval-legacy", prompt: "不在本轮的存量", assertions: [] },
    ],
  }));
  const kept = runFile("aggregate-benchmark.mjs", [join(root6b, "iteration-1"), "--skill-name", "hist-demo", "--history", bankDir, "--keep-evals"]);
  const bank = JSON.parse(readFileSync(join(bankDir, "output-evals.json"), "utf8"));
  check("keep-evals: 专项轮保留存量 eval 不缩水", kept.code === 0
    && bank.evals.some((e) => e.name === "eval-legacy")
    && bank.evals.find((e) => e.name === "eval-s").prompt === "题面"
    && bank.evals.length === 3);
  check("keep-evals: stdout 明示保留数量", kept.stdout.includes("保留题库中本轮未跑的 1 个"));
  const shrink = runFile("aggregate-benchmark.mjs", [join(root6b, "iteration-1"), "--skill-name", "hist-demo", "--history", bankDir]);
  const shrunk = JSON.parse(readFileSync(join(bankDir, "output-evals.json"), "utf8"));
  check("无旗标: 全量轮整写语义不变（存量被本轮集合取代）", shrunk.evals.length === 2 && !shrunk.evals.some((e) => e.name === "eval-legacy"));
} finally {
  rmSync(root6b, { recursive: true, force: true });
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

// ---- 聚合·判罚对账（grading.results 数 ≠ 题库断言数告警，缺/多双向；缺 manual 合并即缺条目形态） ----
console.log("聚合·判罚对账：");
const root7b = mkdtempSync(join(tmpdir(), "recontest-"));
try {
  const mkCase = (ev, metaCount, resultCount) => {
    const d = join(root7b, "iteration-1", ev, "with_skill", "run-1");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "grading.json"), JSON.stringify({
      results: Array.from({ length: resultCount }, (_, i) => ({ name: `断言${i + 1}`, passed: true })),
    }));
    writeFileSync(join(root7b, "iteration-1", ev, "eval_metadata.json"), JSON.stringify({
      prompt: "p",
      assertions: Array.from({ length: metaCount }, (_, i) => ({ name: `断言${i + 1}`, type: "script" })),
    }));
  };
  mkCase("eval-ok", 2, 2);      // 条数相符 → 零告警
  mkCase("eval-missing", 3, 2); // 缺 1 条（漏交 manual / 评分器少判形态）
  mkCase("eval-extra", 2, 3);   // 多 1 条（标注误计入 results 形态）
  mkCase("eval-nometa", 0, 1);  // metadata 断言未登记 → 无从对账，不告警
  const r = runFile("aggregate-benchmark.mjs", [join(root7b, "iteration-1"), "--skill-name", "recon-demo", "--output", join(root7b, "b.json")]);
  const w = JSON.parse(readFileSync(join(root7b, "b.json"), "utf8")).warnings;
  check("对账: 相符与断言未登记的 run 不告警", r.code === 0 && !w.some((s) => s.includes("eval-ok") || s.includes("eval-nometa")));
  check("对账: 缺条目告警点名差数", w.some((s) => s.includes("eval-missing") && s.includes("2 条 ≠ 题库断言 3 条") && s.includes("缺 1 条")));
  check("对账: 多条目告警点名差数", w.some((s) => s.includes("eval-extra") && s.includes("3 条 ≠ 题库断言 2 条") && s.includes("多 1 条")));
} finally {
  rmSync(root7b, { recursive: true, force: true });
}

// ---- 触发评测聚合·schema、严格协议与失败关闭 ----
console.log("触发聚合·schema 与失败关闭：");
const root9 = mkdtempSync(join(tmpdir(), "triggertest-"));
try {
  const evalSet = {
    skill: "trigger-demo",
    queries: [
      { id: "q1", text: "需要使用该技能的任务", should_trigger: true },
      { id: "q2", text: "另一个需要使用该技能的任务", should_trigger: true },
      { id: "q3", text: "关键词相似但不该使用该技能", should_trigger: false },
      { id: "q4", text: "另一个 near-miss", should_trigger: false },
    ],
  };
  writeFileSync(join(root9, "trigger-evals.json"), JSON.stringify(evalSet), "utf8");
  writeFileSync(join(root9, "probe-results.jsonl"), [
    { query_id: "q1", first_line: "SKILL: trigger-demo", description: "旧描述" },
    { query_id: "q2", first_line: "SKILL: none", description: "旧描述" },
    { query_id: "q3", first_line: "SKILL: none", description: "旧描述" },
    { query_id: "q4", first_line: "SKILL: trigger-demo", description: "旧描述" },
    { query_id: "q1", first_line: "SKILL: trigger-demo", description: "新描述" },
    { query_id: "q2", first_line: "SKILL: trigger-demo", description: "新描述" },
    { query_id: "q3", first_line: "SKILL: none", description: "新描述" },
    { query_id: "q4", first_line: "SKILL: none", description: "新描述" },
    { query_id: "q1", first_line: "SKILL: trigger-demo\nspoof", description: "新描述" },
    { query_id: "unknown", first_line: "SKILL: trigger-demo", description: "新描述" },
    [],
  ].map((row) => JSON.stringify(row)).join("\n") + "\nnot-json\n", "utf8");
  // 本用例考的是选优逻辑，题库刻意小（test=2）；下限另有专门用例，这里显式放宽。
  const good = runFile("aggregate-trigger.mjs", [root9, "--min-test-queries", "2"]);
  const triggerBenchmark = JSON.parse(readFileSync(join(root9, "trigger-benchmark.json"), "utf8"));
  check("触发聚合: 有效探针产出多轮 benchmark", good.code === 0 && triggerBenchmark.rounds.length === 2
    && triggerBenchmark.valid_probes === 8 && triggerBenchmark.invalid_probes === 4);
  check("触发聚合: best_description 只从有效轮选择", triggerBenchmark.best_description === "新描述");

  // 样本下限（issue #55）：test 证据不足时不宣告 best_description，而不是硬选一个。
  const floored = runFile("aggregate-trigger.mjs", [root9, "--output", join(root9, "floored.json")]);
  const flooredJson = JSON.parse(readFileSync(join(root9, "floored.json"), "utf8"));
  check("样本下限: 默认下限下小题库不宣告 best_description",
    floored.code === 0 && flooredJson.best_description === null);
  check("样本下限: 未宣告时给出可读原因并记录下限值",
    typeof flooredJson.best_description_reason === "string"
      && flooredJson.best_description_reason.includes("样本不足")
      && flooredJson.min_test_queries === 6);
  check("样本下限: 终端显式说明未宣告", out(floored).includes("best_description: 未宣告"));
  check("样本下限: 仍产出其余指标(不是整体失败)",
    flooredJson.rounds.length === 2 && flooredJson.valid_probes > 0);
  check("样本下限: test 计入有效 query 数而非切分声明条数",
    flooredJson.rounds.every((r) => typeof r.test.evaluated === "number" && r.test.evaluated <= r.test.queries));
  const badFloor = runFile("aggregate-trigger.mjs", [root9, "--min-test-queries", "0"]);
  check("样本下限: 非法下限按用法错退出 2", badFloor.code === 2);
  const nanFloor = runFile("aggregate-trigger.mjs", [root9, "--min-test-queries", "abc"]);
  check("样本下限: 非整数下限退出 2", nanFloor.code === 2);

  // 反向验证：下限必须不误拦。20 条题库(正10/负10) 在 holdout=0.4 下 test=8 ≥ 6，应正常宣告。
  const bigWs = join(root9, "big");
  mkdirSync(bigWs);
  const bigQueries = [];
  for (let i = 1; i <= 10; i++) bigQueries.push({ id: `p${i}`, text: `应触发场景 ${i}`, should_trigger: true });
  for (let i = 1; i <= 10; i++) bigQueries.push({ id: `n${i}`, text: `near-miss 场景 ${i}`, should_trigger: false });
  writeFileSync(join(bigWs, "trigger-evals.json"),
    JSON.stringify({ skill: "trigger-demo", queries: bigQueries }), "utf8");
  const bigRows = [];
  for (const q of bigQueries) {
    // 旧描述：应触发的一半漏触发；新描述：全对
    const oldTrig = q.should_trigger ? Number(q.id.slice(1)) % 2 === 1 : false;
    bigRows.push({ query_id: q.id, first_line: oldTrig ? "SKILL: trigger-demo" : "SKILL: none", description: "旧描述" });
    bigRows.push({ query_id: q.id, first_line: q.should_trigger ? "SKILL: trigger-demo" : "SKILL: none", description: "新描述" });
  }
  writeFileSync(join(bigWs, "probe-results.jsonl"), bigRows.map((r) => JSON.stringify(r)).join("\n"), "utf8");
  const bigRun = runFile("aggregate-trigger.mjs", [bigWs]);
  const bigJson = JSON.parse(readFileSync(join(bigWs, "trigger-benchmark.json"), "utf8"));
  check("样本下限: 20 条题库(test=8) 正常宣告 best_description",
    bigRun.code === 0 && bigJson.best_description === "新描述" && bigJson.best_description_reason === null);
  check("样本下限: 足量时 test.evaluated 达到下限",
    bigJson.rounds.every((r) => r.test.evaluated >= bigJson.min_test_queries));

  const bad = join(root9, "all-invalid");
  mkdirSync(bad);
  writeFileSync(join(bad, "trigger-evals.json"), JSON.stringify(evalSet), "utf8");
  writeFileSync(join(bad, "probe-results.jsonl"), '{"query_id":"q1","first_line":"不是协议行"}\n[]\nnot-json\n', "utf8");
  const noEvidence = runFile("aggregate-trigger.mjs", [bad]);
  check("触发聚合: 全无效证据退出 1 且不写假报告", noEvidence.code === 1
    && out(noEvidence).includes("无有效探针结果")
    && !exists(join(bad, "trigger-benchmark.json")));

  const malformed = join(root9, "malformed");
  mkdirSync(malformed);
  writeFileSync(join(malformed, "trigger-evals.json"), JSON.stringify({
    skill: "trigger-demo",
    queries: [{ id: "q1", text: "只有一类", should_trigger: "true" }],
  }), "utf8");
  writeFileSync(join(malformed, "probe-results.jsonl"), '{"query_id":"q1","first_line":"SKILL: trigger-demo"}\n', "utf8");
  const badEval = runFile("aggregate-trigger.mjs", [malformed]);
  check("触发聚合: 非法评测集退出 1 且不写报告", badEval.code === 1
    && out(badEval).includes("评测集缺失或结构不符")
    && !exists(join(malformed, "trigger-benchmark.json")));
} finally {
  rmSync(root9, { recursive: true, force: true });
}

// ---- 触发评测聚合·--persist 沉淀进技能目录 ----
console.log("触发聚合·--persist 沉淀：");
const root10 = mkdtempSync(join(tmpdir(), "persisttest-"));
try {
  const evalSet = {
    skill: "persist-demo",
    queries: [
      { id: "q1", text: "需要使用该技能的任务", should_trigger: true },
      { id: "q2", text: "另一个需要使用该技能的任务", should_trigger: true },
      { id: "q3", text: "关键词相似但不该使用该技能", should_trigger: false },
      { id: "q4", text: "另一个 near-miss", should_trigger: false },
    ],
  };
  const skillDir = join(root10, "persist-demo-skill");
  const ws = join(root10, "persist-demo-workspace");
  mkdirSync(skillDir);
  mkdirSync(ws);
  writeFileSync(join(skillDir, "trigger-evals.json"), JSON.stringify(evalSet), "utf8");
  writeFileSync(join(ws, "probe-results.jsonl"), [
    { query_id: "q1", first_line: "SKILL: persist-demo" },
    { query_id: "q2", first_line: "SKILL: persist-demo" },
    { query_id: "q3", first_line: "SKILL: none" },
    { query_id: "q4", first_line: "SKILL: none" },
  ].map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  const persisted = runFile("aggregate-trigger.mjs", [ws, "--persist", skillDir]);
  const persistedBenchmark = JSON.parse(readFileSync(join(skillDir, "trigger-benchmark.json"), "utf8"));
  check("触发沉淀: 题库从技能目录读、成绩写到技能目录", persisted.code === 0
    && persistedBenchmark.skill === "persist-demo" && persistedBenchmark.valid_probes === 4
    && !exists(join(ws, "trigger-benchmark.json")));

  const missingBank = join(root10, "missing-bank-skill");
  mkdirSync(missingBank);
  const noBank = runFile("aggregate-trigger.mjs", [ws, "--persist", missingBank]);
  check("触发沉淀: 题库未沉淀拒绝退出 1 且不写报告", noBank.code === 1
    && out(noBank).includes("题库未沉淀到技能目录")
    && !exists(join(missingBank, "trigger-benchmark.json")));

  const notDir = runFile("aggregate-trigger.mjs", [ws, "--persist", join(root10, "no-such-dir")]);
  check("触发沉淀: 目标不是目录拒绝退出 1", notDir.code === 1
    && out(notDir).includes("拒绝: --persist 目标不是可写目录"));

  const noValue = runFile("aggregate-trigger.mjs", [ws, "--persist"]);
  check("触发沉淀: --persist 缺值按用法错退出 2", noValue.code === 2);
} finally {
  rmSync(root10, { recursive: true, force: true });
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
  check("技能名优先取 history 的 skill 字段", html.includes('"skill_name":"view-demo"'));
  check("评审页含建议卡片与仅建议标记", html.includes("结构审查建议") && html.includes("仅建议 · 未执行"));
  const st2 = viewer([join(root8, "iteration-1"), "--skill-name", "view-demo", "--static", join(root8, "review2.html"), "--no-open"]);
  const html2 = readFileSync(join(root8, "review2.html"), "utf8");
  check("无 --history 时不嵌历史数据(旧行为不变)", st2.code === 0 && !html2.includes('"history"'));

  // $-注入防护：嵌入数据含 $& / $' 时不得被当替换模式展开（页面不被截断、原文保留）
  const d9 = join(root8, "iteration-9", "eval-dollar", "with_skill", "run-1");
  mkdirSync(join(d9, "outputs"), { recursive: true });
  writeFileSync(join(d9, "grading.json"), JSON.stringify({ results: [{ name: "a", passed: true }] }));
  writeFileSync(join(root8, "iteration-9", "eval-dollar", "eval_metadata.json"),
    JSON.stringify({ prompt: "价格是 5$& 和 8$' 哦", assertions: [] }));
  const st3 = viewer([join(root8, "iteration-9"), "--static", join(root8, "review3.html"), "--no-open"]);
  const html3 = readFileSync(join(root8, "review3.html"), "utf8");
  const tpl = readFileSync(join(SCRIPTS, "..", "eval-viewer", "viewer.html"), "utf8");
  check("嵌入数据 $&/$' 不展开(页面完整)", st3.code === 0
    && (html3.match(/<\/script>/g) || []).length === (tpl.match(/<\/script>/g) || []).length
    && (html3.match(/EMBEDDED_DATA/g) || []).length === (tpl.match(/EMBEDDED_DATA/g) || []).length
    && html3.includes("5$&"));

  const invalidPort = viewer([join(root8, "iteration-1"), "--port", "not-a-port", "--no-open"]);
  const missingPort = viewer([join(root8, "iteration-1"), "--port", "--no-open"]);
  check("评审页: 非法端口退出 2", invalidPort.code === 2 && out(invalidPort).includes("端口无效")
    && missingPort.code === 2 && out(missingPort).includes("端口无效"));

  // 服务器模式：用独立子进程验证真实 GET 首页、POST feedback、GET feedback 闭环。
  const smoke = join(root8, "http-smoke.mjs");
  writeFileSync(smoke, `
import { spawn } from "node:child_process";
const [viewerPath, iterationPath, startPort] = process.argv.slice(2);
const child = spawn(process.execPath, [viewerPath, iterationPath, "--port", startPort, "--no-open"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
let settled = false;
const finish = (fn) => { if (!settled) { settled = true; fn(); } };
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => finish(() => reject(new Error("viewer ready timeout"))), 5000);
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
    const match = output.match(/viewer 已启动: (http:\\/\\/127\\.0\\.0\\.1:\\d+)/);
    if (match) { clearTimeout(timer); finish(() => resolve(match[1])); }
  });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  child.once("exit", (code) => finish(() => reject(new Error("viewer exited " + code + "\\n" + output))));
});
try {
  const url = await ready;
  const page = await fetch(url);
  const pageText = await page.text();
  const feedback = { reviews: [{ eval: "eval-jia", config: "with_skill", run: "run-1", comment: "ok" }], status: "complete" };
  const posted = await fetch(url + "/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(feedback),
  });
  const readBack = await fetch(url + "/api/feedback");
  console.log(JSON.stringify({
    pageStatus: page.status,
    pageHasEmbeddedData: pageText.includes("EMBEDDED_DATA"),
    postStatus: posted.status,
    getStatus: readBack.status,
    feedback: await readBack.json(),
  }));
} finally {
  child.kill("SIGTERM");
}
` , "utf8");
  const http = runNode(smoke, [join(SCRIPTS, "..", "eval-viewer", "generate-review.mjs"), join(root8, "iteration-1"), "39991"]);
  let httpResult = null;
  try { httpResult = JSON.parse(http.stdout.trim().split(/\r?\n/).pop()); } catch { /* assertion below reports failure */ }
  check("评审页: HTTP GET/POST feedback 闭环", http.code === 0 && httpResult?.pageStatus === 200
    && httpResult.pageHasEmbeddedData === true && httpResult.postStatus === 200 && httpResult.getStatus === 200
    && httpResult.feedback?.reviews?.[0]?.comment === "ok");
} finally {
  rmSync(root8, { recursive: true, force: true });
}

// ---- 外部证据·契约与物化（Issue #160 / AC-001） ----
console.log("外部证据·契约与物化：");
const evidenceRoot = mkdtempSync(join(tmpdir(), "evidence-contract-test-"));
try {
  const skillDir = join(evidenceRoot, "skill");
  const fixtureDir = join(skillDir, "eval-fixtures", "eval-demo", "epoch-1");
  const evalDir = join(evidenceRoot, "workspace", "iteration-1", "eval-demo");
  const payloadDir = join(fixtureDir, "payloads");
  mkdirSync(payloadDir, { recursive: true });
  mkdirSync(evalDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), "---\nname: demo-skill\ndescription: demo\n---\n", "utf8");
  const payloadText = JSON.stringify({
    sources: [{ url: "https://example.invalid/source", title: "脱敏来源", captured_at: "2026-08-30" }],
    summary: "固定证据摘要，不含用户路径或凭据",
  });
  writeFileSync(join(payloadDir, "entry-a.json"), payloadText, "utf8");
  const manifestBase = {
    schema_version: 1,
    kind: "eval-evidence-manifest",
    eval: "eval-demo",
    epoch: 1,
    captured_at: "2026-08-30T10:00:00+08:00",
    sanitization: { status: "passed", ruleset: "external-evidence-v1" },
    entries: [{
      id: "entry-a",
      intent: "固定示例证据",
      query: "示例证据查询",
      payload: "payloads/entry-a.json",
      sha256: sha256Text(payloadText),
      source_count: 1,
    }],
  };
  writeFileSync(join(fixtureDir, "evidence-pack.json"), JSON.stringify({
    ...manifestBase,
    manifest_sha256: sha256Json(manifestBase),
  }, null, 2) + "\n", "utf8");
  const metadata = {
    prompt: "用户题面必须逐字保留",
    assertions: [{ name: "固定证据可读", type: "script", ac: "AC-1" }],
    evidence: {
      schema_version: 1,
      mode: "replay",
      provider: "fake-evidence",
      manifest: "eval-fixtures/eval-demo/epoch-1/evidence-pack.json",
      manifest_sha256: sha256Json(manifestBase),
      epoch: 1,
      miss_policy: "fail",
      live_policy: { trigger: "manual_or_stale", concurrency: 1, max_calls: 16, freshness: "declared" },
    },
  };
  writeFileSync(join(evalDir, "eval_metadata.json"), JSON.stringify(metadata, null, 2) + "\n", "utf8");
  const hostAdapter = join(evidenceRoot, "host-verified.json");
  writeFileSync(hostAdapter, JSON.stringify({ network_isolation: "verified", live_calls: 0 }) + "\n", "utf8");

  const preflight = runFile("eval-evidence.mjs", ["preflight", "--eval-metadata", join(evalDir, "eval_metadata.json"), "--skill-dir", skillDir, "--host-adapter", hostAdapter]);
  const preflightJson = lastJson(out(preflight));
  check("preflight 保留逐字 prompt 且验证 manifest/payload 摘要", preflight.code === 0
    && preflightJson?.ok === true && preflightJson?.mode === "replay"
    && preflightJson?.entries === 1 && preflightJson?.hits === 1 && preflightJson?.misses === 0
    && preflightJson?.live_calls === 0 && preflightJson?.network_isolation === "verified"
    && JSON.parse(readFileSync(join(evalDir, "eval_metadata.json"), "utf8")).prompt === metadata.prompt);

  const materialized = runFile("eval-evidence.mjs", ["materialize", "--eval-dir", evalDir, "--skill-dir", skillDir, "--host-adapter", hostAdapter, "--gates", "with_skill,old_skill,without_skill"]);
  const materializedJson = lastJson(out(materialized));
  const digests = ["with_skill", "old_skill", "without_skill"].map((gate) => {
    const pack = join(evalDir, gate, "run-1", "inputs", "evidence-pack", "evidence-pack.json");
    return exists(pack) ? JSON.parse(readFileSync(pack, "utf8")).manifest_sha256 : null;
  });
  check("每个 gate 的 inputs/ 物化同一 evidence digest", materialized.code === 0
    && materializedJson?.ok === true && materializedJson?.gate_digest_consistent === true
    && digests.every((digest) => digest === metadata.evidence.manifest_sha256)
    && new Set(digests).size === 1);
  const materializedPayload = join(evalDir, "with_skill", "run-1", "inputs", "evidence-pack", "payloads", "entry-a.json");
  const materializedPack = join(evalDir, "with_skill", "run-1", "inputs", "evidence-pack", "evidence-pack.json");
  check("物化只携带 evidence pack，不把 harness 控制塞进用户题面", exists(materializedPayload) && exists(materializedPack)
    && !readFileSync(materializedPayload, "utf8").includes(metadata.prompt)
    && readFileSync(materializedPack, "utf8").includes("entry-a"));
} finally {
  rmSync(evidenceRoot, { recursive: true, force: true });
}

// ---- 外部证据·replay 失败关闭（Issue #160 / AC-002） ----
console.log("外部证据·replay 失败关闭：");
function setupEvidenceCase(base, payloadText = JSON.stringify({ summary: "脱敏固定证据" })) {
  const skillDir = join(base, "skill");
  const fixtureDir = join(skillDir, "eval-fixtures", "eval-demo", "epoch-1");
  const payloadDir = join(fixtureDir, "payloads");
  const evalDir = join(base, "workspace", "iteration-1", "eval-demo");
  mkdirSync(payloadDir, { recursive: true });
  mkdirSync(evalDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), "---\nname: demo-skill\ndescription: demo\n---\n", "utf8");
  const payloadPath = join(payloadDir, "entry-a.json");
  writeFileSync(payloadPath, payloadText, "utf8");
  const manifestBase = {
    schema_version: 1,
    kind: "eval-evidence-manifest",
    eval: "eval-demo",
    epoch: 1,
    captured_at: "2026-08-30T10:00:00+08:00",
    sanitization: { status: "passed", ruleset: "external-evidence-v1" },
    entries: [{ id: "entry-a", intent: "固定示例证据", query: "示例证据查询", payload: "payloads/entry-a.json", sha256: sha256Text(payloadText), source_count: 1 }],
  };
  const manifest = { ...manifestBase, manifest_sha256: sha256Json(manifestBase) };
  const manifestPath = join(fixtureDir, "evidence-pack.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  const metadataPath = join(evalDir, "eval_metadata.json");
  writeFileSync(metadataPath, JSON.stringify({
    prompt: "用户题面",
    assertions: [{ name: "固定证据可读", type: "script", ac: "AC-1" }],
    evidence: {
      schema_version: 1, mode: "replay", provider: "fake-evidence",
      manifest: "eval-fixtures/eval-demo/epoch-1/evidence-pack.json",
      manifest_sha256: manifest.manifest_sha256, epoch: 1, miss_policy: "fail",
      live_policy: { trigger: "manual_or_stale", concurrency: 1, max_calls: 16, freshness: "declared" },
    },
  }, null, 2) + "\n", "utf8");
  const hostAdapter = join(base, "host.json");
  writeFileSync(hostAdapter, JSON.stringify({ network_isolation: "verified" }) + "\n", "utf8");
  return { skillDir, fixtureDir, evalDir, payloadPath, manifestPath, metadataPath, hostAdapter };
}

const replayRoot = mkdtempSync(join(tmpdir(), "evidence-replay-test-"));
try {
  const missing = setupEvidenceCase(join(replayRoot, "missing"));
  rmSync(missing.payloadPath);
  const missingResult = runFile("eval-evidence.mjs", ["preflight", "--eval-metadata", missing.metadataPath, "--skill-dir", missing.skillDir, "--host-adapter", missing.hostAdapter]);
  const missingJson = lastJson(out(missingResult));
  check("缺 payload 在起跑前 BLOCKED 且 zero-live", missingResult.code === 3
    && missingJson?.status === "BLOCKED" && missingJson?.code === "BLOCKED_EVIDENCE_UNAVAILABLE" && missingJson?.live_calls === 0
    && !exists(join(missing.evalDir, "benchmark.json")));

  const noIsolation = setupEvidenceCase(join(replayRoot, "no-isolation"));
  writeFileSync(noIsolation.hostAdapter, JSON.stringify({ network_isolation: "unavailable" }) + "\n", "utf8");
  const isolationResult = runFile("eval-evidence.mjs", ["preflight", "--eval-metadata", noIsolation.metadataPath, "--skill-dir", noIsolation.skillDir, "--host-adapter", noIsolation.hostAdapter]);
  const isolationJson = lastJson(out(isolationResult));
  check("host 无法隔离时 BLOCKED_NETWORK_ISOLATION_UNAVAILABLE", isolationResult.code === 3
    && isolationJson?.status === "BLOCKED" && isolationJson?.code === "BLOCKED_NETWORK_ISOLATION_UNAVAILABLE"
    && isolationJson?.live_calls === 0 && !exists(join(noIsolation.evalDir, "benchmark.json")));

  const miss = setupEvidenceCase(join(replayRoot, "query-miss"));
  const calls = join(replayRoot, "query-miss-calls.json");
  writeFileSync(calls, JSON.stringify([{ intent: "未声明意图", query: "未声明查询" }]) + "\n", "utf8");
  const queryMiss = runFile("eval-evidence.mjs", ["replay", "--eval-metadata", miss.metadataPath, "--skill-dir", miss.skillDir, "--host-adapter", miss.hostAdapter, "--calls", calls]);
  const queryMissJson = lastJson(out(queryMiss));
  check("运行中 query miss 判 FAIL 且不 fallback live", queryMiss.code === 1
    && queryMissJson?.status === "FAIL" && queryMissJson?.code === "REPLAY_QUERY_MISS"
    && queryMissJson?.live_calls === 0 && queryMissJson?.next_safe_action?.includes("record")
    && !exists(join(miss.evalDir, "benchmark.json")));

  const emptyReplay = setupEvidenceCase(join(replayRoot, "empty-calls"));
  const emptyReplayResult = runFile("eval-evidence.mjs", ["replay", "--eval-metadata", emptyReplay.metadataPath, "--skill-dir", emptyReplay.skillDir, "--host-adapter", emptyReplay.hostAdapter]);
  const emptyReplayJson = lastJson(out(emptyReplayResult));
  check("没有执行 replay 不能以 hits=0 假装 PASS", emptyReplayResult.code === 1
    && emptyReplayJson?.status === "FAIL" && emptyReplayJson?.code === "REPLAY_NOT_EXECUTED"
    && emptyReplayJson?.live_calls === 0);

  const tampered = setupEvidenceCase(join(replayRoot, "tampered"));
  writeFileSync(tampered.payloadPath, "{\"summary\":\"被改写\"}\n", "utf8");
  const integrity = runFile("eval-evidence.mjs", ["preflight", "--eval-metadata", tampered.metadataPath, "--skill-dir", tampered.skillDir, "--host-adapter", tampered.hostAdapter]);
  const integrityJson = lastJson(out(integrity));
  check("payload 摘要错判 FAIL 且不自动重签", integrity.code === 1
    && integrityJson?.status === "FAIL" && integrityJson?.code === "EVIDENCE_INTEGRITY_MISMATCH"
    && integrityJson?.live_calls === 0 && JSON.parse(readFileSync(tampered.manifestPath, "utf8")).entries[0].sha256 !== sha256Text(readFileSync(tampered.payloadPath, "utf8")));

  const gates = setupEvidenceCase(join(replayRoot, "gate-drift"));
  const materialized = runFile("eval-evidence.mjs", ["materialize", "--eval-dir", gates.evalDir, "--skill-dir", gates.skillDir, "--host-adapter", gates.hostAdapter, "--gates", "with_skill,old_skill,without_skill"]);
  const driftPack = join(gates.evalDir, "old_skill", "run-1", "inputs", "evidence-pack", "evidence-pack.json");
  const drift = JSON.parse(readFileSync(driftPack, "utf8"));
  drift.manifest_sha256 = "sha256:" + "0".repeat(64);
  writeFileSync(driftPack, JSON.stringify(drift) + "\n", "utf8");
  const gateAudit = runFile("eval-evidence.mjs", ["audit-gates", "--eval-dir", gates.evalDir, "--gates", "with_skill,old_skill,without_skill"]);
  const gateAuditJson = lastJson(out(gateAudit));
  check("跨 gate digest 不一致整组 BLOCKED 且不产主成绩", materialized.code === 0 && gateAudit.code === 3
    && gateAuditJson?.status === "BLOCKED" && gateAuditJson?.code === "EVIDENCE_DIGEST_MISMATCH"
    && gateAuditJson?.live_calls === 0 && !exists(join(gates.evalDir, "benchmark.json")));
} finally {
  rmSync(replayRoot, { recursive: true, force: true });
}

const pilotWriterRoot = mkdtempSync(join(tmpdir(), "pilot-writer-test-"));
try {
  const pilotCase = setupEvidenceCase(join(pilotWriterRoot, "case"));
  const pilotIteration = join(pilotWriterRoot, "case", "workspace", "iteration-1");
  const pilotCalls = join(pilotWriterRoot, "calls.json");
  writeFileSync(pilotCalls, JSON.stringify([{ entry_id: "entry-a", query: "示例证据查询" }]) + "\n", "utf8");
  const pilotMaterialize = runFile("eval-evidence.mjs", ["materialize", "--eval-dir", pilotCase.evalDir, "--skill-dir", pilotCase.skillDir, "--host-adapter", pilotCase.hostAdapter, "--gates", "with_skill,old_skill,without_skill"]);
  const pilotReplay = ["with_skill", "old_skill", "without_skill"].map((gate) => runFile("eval-evidence.mjs", [
    "replay", "--eval-metadata", pilotCase.metadataPath, "--skill-dir", pilotCase.skillDir, "--host-adapter", pilotCase.hostAdapter,
    "--calls", pilotCalls, "--run-dir", join(pilotCase.evalDir, gate, "run-1"),
  ]));
  const pilotHistoryDir = join(pilotWriterRoot, "history-skill");
  mkdirSync(pilotHistoryDir, { recursive: true });
  const pilotWrite = runFile("aggregate-benchmark.mjs", [
    "--pilot-audit", pilotIteration, "--history", pilotHistoryDir, "--skill-name", "pilot-demo", "--pilot-id", "pilot-replay-1",
  ]);
  const pilotHistory = exists(join(pilotHistoryDir, "history.json")) ? JSON.parse(readFileSync(join(pilotHistoryDir, "history.json"), "utf8")) : {};
  const pilotReceipt = pilotHistory.pilot_audits?.[0];
  check("pilot 收据由 aggregate history writer 消费真实 replay audit 追加", pilotMaterialize.code === 0
    && pilotReplay.every((result) => result.code === 0) && pilotWrite.code === 0
    && pilotReceipt?.status === "PASS" && pilotReceipt?.source?.includes("aggregate-benchmark")
    && pilotReceipt.evaluations?.[0]?.gates?.length === 3
    && pilotReceipt.evaluations?.[0]?.hits === 1 && pilotReceipt.evaluations?.[0]?.live_calls === 0
    && pilotReceipt.live_acceptance?.status === "BLOCKED");
} finally {
  rmSync(pilotWriterRoot, { recursive: true, force: true });
}

// ---- 外部证据·record/live 生命周期（Issue #160 / AC-003） ----
console.log("外部证据·record/live 生命周期：");
const lifecycleRoot = mkdtempSync(join(tmpdir(), "evidence-lifecycle-test-"));
try {
  const good = setupEvidenceCase(join(lifecycleRoot, "good"));
  const providerPath = join(lifecycleRoot, "provider.json");
  const provider = {
    entries: {
      "entry-a": {
        payload: { summary: "受控 provider 的脱敏结果", sources: [{ url: "https://example.invalid/a", reachable: true }] },
        query: "示例证据查询",
        tool: "fake-web-search",
        sources: [{ url: "https://example.invalid/a", reachable: true, published_at: "2026-08-30" }],
        captured_at: "2026-08-30T10:00:00+08:00",
        freshness_ok: true,
      },
    },
  };
  writeFileSync(providerPath, JSON.stringify(provider, null, 2) + "\n", "utf8");
  const outputDir = join(good.skillDir, "eval-fixtures", "eval-demo");

  const noAuth = runFile("eval-evidence.mjs", ["record", "--eval-metadata", good.metadataPath, "--skill-dir", good.skillDir, "--output-dir", outputDir, "--provider-fixture", providerPath, "--concurrency", "1", "--max-calls", "16"]);
  const noAuthJson = lastJson(out(noAuth));
  check("record 缺显式授权 BLOCKED 且不调用 provider", noAuth.code === 3
    && noAuthJson?.code === "LIVE_AUTHORIZATION_REQUIRED" && noAuthJson?.live_calls === 0
    && !exists(join(outputDir, "epoch-2")));

  const unsafeConcurrency = runFile("eval-evidence.mjs", ["record", "--eval-metadata", good.metadataPath, "--skill-dir", good.skillDir, "--output-dir", outputDir, "--provider-fixture", providerPath, "--authorize-live", "--concurrency", "2", "--max-calls", "16"]);
  const unsafeConcurrencyJson = lastJson(out(unsafeConcurrency));
  check("record 并发不为 1 BLOCKED", unsafeConcurrency.code === 3
    && unsafeConcurrencyJson?.code === "LIVE_CONCURRENCY_UNSAFE" && unsafeConcurrencyJson?.live_calls === 0
    && !exists(join(outputDir, "epoch-2")));

  const policyMissingFreshness = setupEvidenceCase(join(lifecycleRoot, "missing-freshness"));
  const policyMetadata = JSON.parse(readFileSync(policyMissingFreshness.metadataPath, "utf8"));
  delete policyMetadata.evidence.live_policy.freshness;
  writeFileSync(policyMissingFreshness.metadataPath, JSON.stringify(policyMetadata) + "\n", "utf8");
  const policyResult = runFile("eval-evidence.mjs", ["record", "--eval-metadata", policyMissingFreshness.metadataPath, "--skill-dir", policyMissingFreshness.skillDir, "--output-dir", join(policyMissingFreshness.skillDir, "eval-fixtures", "eval-demo"), "--provider-fixture", providerPath, "--authorize-live", "--concurrency", "1", "--max-calls", "16"]);
  const policyJson = lastJson(out(policyResult));
  check("record 缺 freshness policy BLOCKED", policyResult.code === 3 && policyJson?.code === "LIVE_POLICY_UNDECLARED");

  const budgetCase = setupEvidenceCase(join(lifecycleRoot, "budget"));
  const budgetManifest = JSON.parse(readFileSync(budgetCase.manifestPath, "utf8"));
  const budgetProvider = { entries: {} };
  for (let i = 2; i <= 17; i++) {
    budgetManifest.entries.push({ id: `entry-${i}`, intent: `固定证据 ${i}`, query: `示例证据查询 ${i}`, payload: `payloads/entry-${i}.json`, sha256: "sha256:" + "1".repeat(64), source_count: 1 });
    budgetProvider.entries[`entry-${i}`] = { payload: { summary: `结果 ${i}` }, captured_at: "2026-08-30" };
  }
  writeFileSync(budgetCase.manifestPath, JSON.stringify(budgetManifest) + "\n", "utf8");
  writeFileSync(join(lifecycleRoot, "budget-provider.json"), JSON.stringify(budgetProvider) + "\n", "utf8");
  const budget = runFile("eval-evidence.mjs", ["record", "--eval-metadata", budgetCase.metadataPath, "--skill-dir", budgetCase.skillDir, "--output-dir", join(budgetCase.skillDir, "eval-fixtures", "eval-demo"), "--provider-fixture", join(lifecycleRoot, "budget-provider.json"), "--authorize-live", "--concurrency", "1", "--max-calls", "16"]);
  const budgetJson = lastJson(out(budget));
  check("record 预算耗尽 BLOCKED 且不晋级", budget.code === 3 && budgetJson?.code === "LIVE_BUDGET_EXHAUSTED"
    && budgetJson?.epoch_promoted === false && !exists(join(budgetCase.skillDir, "eval-fixtures", "eval-demo", "epoch-2")));

  const incompleteProvider = join(lifecycleRoot, "incomplete.json");
  writeFileSync(incompleteProvider, JSON.stringify({ entries: {} }) + "\n", "utf8");
  const incomplete = runFile("eval-evidence.mjs", ["record", "--eval-metadata", good.metadataPath, "--skill-dir", good.skillDir, "--output-dir", outputDir, "--provider-fixture", incompleteProvider, "--authorize-live", "--concurrency", "1", "--max-calls", "16"]);
  const incompleteJson = lastJson(out(incomplete));
  check("record 部分采集不晋级 epoch", incomplete.code === 3
    && incompleteJson?.code === "LIVE_CAPTURE_INCOMPLETE" && incompleteJson?.epoch_promoted === false
    && !exists(join(outputDir, "epoch-2")));

  const secretProvider = join(lifecycleRoot, "secret.json");
  writeFileSync(secretProvider, JSON.stringify({ entries: { "entry-a": { payload: { api_key: "sk-test-only" }, captured_at: "2026-08-30" } } }) + "\n", "utf8");
  const secret = runFile("eval-evidence.mjs", ["record", "--eval-metadata", good.metadataPath, "--skill-dir", good.skillDir, "--output-dir", outputDir, "--provider-fixture", secretProvider, "--authorize-live", "--concurrency", "1", "--max-calls", "16"]);
  const secretJson = lastJson(out(secret));
  check("record 脱敏失败不覆盖旧 epoch", secret.code === 3
    && secretJson?.code === "EVIDENCE_SANITIZATION_FAILED" && secretJson?.epoch_promoted === false
    && !exists(join(outputDir, "epoch-2")));

  const record = runFile("eval-evidence.mjs", ["record", "--eval-metadata", good.metadataPath, "--skill-dir", good.skillDir, "--output-dir", outputDir, "--provider-fixture", providerPath, "--authorize-live", "--concurrency", "1", "--max-calls", "16"]);
  const recordJson = lastJson(out(record));
  check("record 成功只建立可审计 epoch，不生成 pass_rate", record.code === 0
    && recordJson?.ok === true && recordJson?.mode === "record" && recordJson?.epoch_promoted === true
    && recordJson?.calls === 1 && !Object.prototype.hasOwnProperty.call(recordJson, "pass_rate")
    && exists(join(outputDir, "epoch-1", "evidence-pack.json")));

  const repeatRecord = runFile("eval-evidence.mjs", ["record", "--eval-metadata", good.metadataPath, "--skill-dir", good.skillDir, "--output-dir", outputDir, "--provider-fixture", providerPath, "--authorize-live", "--concurrency", "1", "--max-calls", "16"]);
  const repeatJson = lastJson(out(repeatRecord));
  check("相同 evidence 内容只复用 epoch，不制造重复纪元", repeatRecord.code === 0
    && repeatJson?.epoch_promoted === false && repeatJson?.reused_epoch === true
    && !exists(join(outputDir, "epoch-2")));

  const liveAudit = join(lifecycleRoot, "live-audit.json");
  const live = runFile("eval-evidence.mjs", ["live", "--eval-metadata", good.metadataPath, "--skill-dir", good.skillDir, "--provider-fixture", providerPath, "--authorize-live", "--concurrency", "1", "--max-calls", "16", "--audit-path", liveAudit]);
  const liveJson = lastJson(out(live));
  check("fixture live 只产 simulated PASS，不冒充真实 provider", live.code === 0
    && liveJson?.ok === true && liveJson?.mode === "live" && liveJson?.status === "SIMULATED_PASS"
    && liveJson?.execution === "simulated" && liveJson?.real_provider_verified === false
    && liveJson?.concurrency === 1
    && liveJson?.calls <= 16 && liveJson?.query_plan === "PASS" && liveJson?.tool_path === "PASS"
    && liveJson?.source_reachability === "PASS" && liveJson?.freshness === "PASS"
    && liveJson?.replay_comparison === "incomparable" && exists(liveAudit));

  const adapterPath = join(lifecycleRoot, "provider-adapter.mjs");
  writeFileSync(adapterPath, `
const request = JSON.parse(await new Promise((resolve, reject) => {
  let text = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", chunk => text += chunk);
  process.stdin.on("end", () => resolve(text)); process.stdin.on("error", reject);
}));
console.log(JSON.stringify({ entries: Object.fromEntries(request.requests.map(item => [item.entry_id, {
  query: item.query, tool: "adapter-web-search", sources: [{ url: "https://example.invalid/adapter", reachable: true }], freshness_ok: true,
  captured_at: "2026-08-30T10:00:00+08:00", payload: { summary: "adapter result" }
}])) }));
`, "utf8");
  const adapterLive = runFile("eval-evidence.mjs", ["live", "--eval-metadata", good.metadataPath, "--skill-dir", good.skillDir, "--provider-adapter", adapterPath, "--authorize-live", "--concurrency", "1", "--max-calls", "16"]);
  const adapterLiveJson = lastJson(out(adapterLive));
  check("可执行 provider adapter 才能产出真实 live PASS", adapterLive.code === 0
    && adapterLiveJson?.status === "PASS" && adapterLiveJson?.execution === "live"
    && adapterLiveJson?.real_provider_verified === true);
} finally {
  rmSync(lifecycleRoot, { recursive: true, force: true });
}

// ---- Agent 文档质量假设与上下文预算（Issue #160 / AC-004） ----
console.log("Agent 文档质量假设与上下文预算：");
const qualityRoot = mkdtempSync(join(tmpdir(), "quality-plan-test-"));
try {
  const qualitySkill = join(qualityRoot, "demo-skill");
  mkdirSync(join(qualitySkill, "references"), { recursive: true });
  mkdirSync(join(qualitySkill, "eval-fixtures", "private-pack"), { recursive: true });
  writeFileSync(join(qualitySkill, "SKILL.md"), "---\nname: demo-skill\ndescription: demo\n---\n", "utf8");
  writeFileSync(join(qualitySkill, "references", "writing-guide.md"), "completion criteria\nprogressive disclosure\n", "utf8");
  writeFileSync(join(qualitySkill, "run-tests.mjs"), "process.exit(0);\n", "utf8");
  writeFileSync(join(qualitySkill, "output-evals.json"), "{}\n", "utf8");
  writeFileSync(join(qualitySkill, "eval-fixtures", "private-pack", "payload.json"), "secret fixture payload\n", "utf8");
  const metadataPath = join(qualityRoot, "eval_metadata.json");
  writeFileSync(metadataPath, JSON.stringify({
    prompt: "原始用户题面",
    assertions: [{ name: "报告带出脚本事实", type: "manual", ac: "AC-10" }],
    quality: { policy: { required_comparators: ["old_skill"], cost_budget: { tokens_ratio_vs_old_max: 1.25 } } },
  }, null, 2) + "\n", "utf8");
  const findingsPath = join(qualityRoot, "findings.json");
  writeFileSync(findingsPath, JSON.stringify({
    findings: [{
      id: "QH-01",
      lever: "completion_criteria",
      risk: "脚本已算出事实但报告可能漏带",
      expected_behavior: "报告将事实与上下文成组呈现",
      assertions: ["报告带出脚本事实"],
      gates: ["with_skill", "old_skill"],
    }],
    not_applicable: [{ lever: "leading_words", reason: "当前失败是结果传导，不是术语召回" }],
  }, null, 2) + "\n", "utf8");
  const plan = runFile("quality-plan.mjs", ["plan", "--skill-dir", qualitySkill, "--eval-metadata", metadataPath, "--findings-file", findingsPath]);
  const planJson = lastJson(out(plan));
  check("finding 转成 risk→expected→assertion→gate 的质量假设", plan.code === 0
    && planJson?.verdict === "FINDINGS_RECORDED_NOT_PROVEN"
    && planJson?.quality_hypotheses?.length === 1
    && planJson.quality_hypotheses[0].risk.includes("脚本")
    && planJson.quality_hypotheses[0].expected_behavior.includes("成组")
    && planJson.quality_hypotheses[0].assertions.includes("报告带出脚本事实")
    && planJson.quality_hypotheses[0].gates.includes("old_skill")
    && planJson.not_applicable?.[0]?.reason.includes("结果传导"));

  const badFindingsPath = join(qualityRoot, "bad-findings.json");
  writeFileSync(badFindingsPath, JSON.stringify({ findings: [{ id: "QH-BAD", lever: "completion_criteria", risk: "没有绑定验证" }] }) + "\n", "utf8");
  const badPlan = runFile("quality-plan.mjs", ["plan", "--skill-dir", qualitySkill, "--eval-metadata", metadataPath, "--findings-file", badFindingsPath]);
  const badPlanJson = lastJson(out(badPlan));
  check("未绑定 finding 失败关闭，不冒充质量计划", badPlan.code === 1
    && badPlanJson?.code === "UNBOUND_QUALITY_FINDING" && badPlanJson?.verdict !== "SUPPORTED");

  const scriptMeta = join(qualityRoot, "script-metadata.json");
  writeFileSync(scriptMeta, JSON.stringify({
    prompt: "确定性脚本题面",
    assertions: [{ name: "脚本输出可复算", type: "script", ac: "AC-1" }],
  }) + "\n", "utf8");
  const scriptFindings = join(qualityRoot, "script-findings.json");
  writeFileSync(scriptFindings, JSON.stringify({ findings: [{ id: "QH-SCRIPT", lever: "completion_criteria", risk: "脚本输出缺失", expected_behavior: "输出字段完整", assertions: ["脚本输出可复算"], gates: ["with_skill", "without_skill"] }] }) + "\n", "utf8");
  const scriptPlan = runFile("quality-plan.mjs", ["plan", "--skill-dir", qualitySkill, "--eval-metadata", scriptMeta, "--findings-file", scriptFindings]);
  const scriptJson = lastJson(out(scriptPlan));
  check("确定性 script 断言默认 1 run，Agent 行为默认 3 runs", scriptPlan.code === 0
    && scriptJson?.quality_policy?.stability_runs === 1 && planJson?.quality_policy?.stability_runs === 3);

  const context = runFile("quality-plan.mjs", ["audit-context", "--creator-dir", CREATOR_DIR]);
  const contextJson = lastJson(out(context));
  const externalWritingName = ["writing", "for", "agents"].join("-");
  check("Creator 独立且双零增长预算固定", context.code === 0
    && contextJson?.status === "PASS" && contextJson?.independence?.external_skill_dependencies?.length === 0
    && contextJson?.always_loaded?.max_utf8_bytes === 31415 && contextJson?.always_loaded?.max_lines === 312
    && contextJson?.create_or_edit_branch?.max_utf8_bytes === 40364 && contextJson?.create_or_edit_branch?.max_lines === 475
    && contextJson?.create_or_edit_branch?.files?.includes("references/writing-guide.md")
    && !JSON.stringify(contextJson).includes(externalWritingName));

  const dist = join(qualityRoot, "dist");
  const packed = runFile("package-skill.mjs", [qualitySkill, dist]);
  const packagePath = join(dist, "demo-skill.skill");
  const packageBytes = exists(packagePath) ? readFileSync(packagePath) : Buffer.alloc(0);
  check("独立包可打包且排除 eval-fixtures payload", packed.code === 0 && exists(packagePath)
    && packageBytes.includes(Buffer.from("demo-skill/output-evals.json"))
    && !packageBytes.includes(Buffer.from("demo-skill/eval-fixtures/private-pack/payload.json")));
} finally {
  rmSync(qualityRoot, { recursive: true, force: true });
}

// ---- 质量 verdict 与 viewer（Issue #160 / AC-005） ----
console.log("质量 verdict 与 viewer：");
function writeQualityIteration(rootDir, iterationName, withValues, oldValues, options = {}) {
  const iterationDir = join(rootDir, iterationName);
  const evalDir = join(iterationDir, "eval-quality");
  const skillDir = options.skillDir ?? join(rootDir, "skill");
  mkdirSync(evalDir, { recursive: true });
  mkdirSync(skillDir, { recursive: true });
  const fixtureDir = join(evalDir, "fixture");
  const payloadDir = join(fixtureDir, "payloads");
  mkdirSync(payloadDir, { recursive: true });
  const payloadText = JSON.stringify({ summary: "quality test replay payload", marker: options.digest ?? "default" }) + "\n";
  writeFileSync(join(payloadDir, "entry-a.json"), payloadText, "utf8");
  const manifestBase = {
    schema_version: 1,
    kind: "eval-evidence-manifest",
    eval: "eval-quality",
    epoch: options.epoch ?? 1,
    captured_at: "2026-08-30T10:00:00+08:00",
    sanitization: { status: "passed", ruleset: "external-evidence-v1" },
    entries: [{ id: "entry-a", intent: "质量假设固定证据", query: "质量假设固定查询", payload: "payloads/entry-a.json", sha256: sha256Text(payloadText), source_count: 1 }],
  };
  const manifest = { ...manifestBase, manifest_sha256: sha256Json(manifestBase) };
  writeFileSync(join(fixtureDir, "evidence-pack.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  const digest = manifest.manifest_sha256;
  const metadata = {
    prompt: "质量假设题面保持原话",
    assertions: [{ name: "关键行为", text: "关键行为文本", type: "manual", ac: "AC-1" }],
    quality: {
      hypotheses: [{ id: "QH-01", lever: "completion_criteria", risk: "结果可能未传导", expected_behavior: "报告带出关键行为", assertions: ["关键行为"], gates: ["with_skill", "old_skill"] }],
      policy: { stability_runs: 3, required_comparators: ["old_skill"], cost_budget: { tokens_ratio_vs_old_max: 1.25 } },
    },
    evidence: {
      schema_version: 1, mode: "replay", provider: "fake-evidence", manifest: "fixture/evidence-pack.json",
      manifest_sha256: digest, epoch: options.epoch ?? 1, miss_policy: "fail",
      live_policy: { trigger: "manual_or_stale", concurrency: 1, max_calls: 16, freshness: "declared" },
    },
  };
  writeFileSync(join(evalDir, "eval_metadata.json"), JSON.stringify(metadata, null, 2) + "\n", "utf8");
  writeFileSync(join(evalDir, "evidence-audit.json"), JSON.stringify({
    schema_version: 1, status: "PASS", mode: "replay", evidence_epoch: options.epoch ?? 1,
    evidence_digest: digest, hits: 1, misses: 0, live_calls: 0, network_isolation: "verified", gate_digest_consistent: true,
    gates: { with_skill: { evidence_digest: digest }, old_skill: { evidence_digest: digest } },
  }, null, 2) + "\n", "utf8");
  const makeRuns = (gate, values, tokens) => values.forEach((value, index) => {
    const runDir = join(evalDir, gate, `run-${index + 1}`);
    mkdirSync(join(runDir, "outputs"), { recursive: true });
    mkdirSync(join(runDir, "inputs", "evidence-pack", "payloads"), { recursive: true });
    cpSync(join(fixtureDir, "payloads", "entry-a.json"), join(runDir, "inputs", "evidence-pack", "payloads", "entry-a.json"));
    cpSync(join(fixtureDir, "evidence-pack.json"), join(runDir, "inputs", "evidence-pack", "evidence-pack.json"));
    writeFileSync(join(runDir, "evidence-audit.json"), JSON.stringify({
      schema_version: 1, status: "PASS", mode: "replay", evidence_epoch: options.epoch ?? 1,
      evidence_digest: digest, hits: 1, misses: 0, live_calls: 0, network_isolation: "verified", gate_digest_consistent: true,
    }) + "\n", "utf8");
    writeFileSync(join(runDir, "grading.json"), JSON.stringify({ results: [{ name: "关键行为", text: "关键行为文本", passed: value, evidence: value ? "命中" : "未命中" }] }) + "\n", "utf8");
    writeFileSync(join(runDir, "timing.json"), JSON.stringify({ duration_ms: 1000 + index, total_tokens: tokens }) + "\n", "utf8");
    writeFileSync(join(runDir, "outputs", "result.md"), value ? "关键行为\n" : "", "utf8");
  });
  makeRuns("with_skill", withValues, options.withTokens ?? 100);
  makeRuns("old_skill", oldValues, options.oldTokens ?? 100);
  return { iterationDir, skillDir, evalDir, evidenceDigest: digest };
}

const verdictRoot = mkdtempSync(join(tmpdir(), "quality-verdict-test-"));
try {
  const inconclusive = writeQualityIteration(join(verdictRoot, "inconclusive"), "iteration-1", [true, true, true], [true, true, true]);
  const incAgg = runFile("aggregate-benchmark.mjs", [inconclusive.iterationDir, "--skill-name", "quality-demo"]);
  const incBenchmark = exists(join(inconclusive.iterationDir, "benchmark.json")) ? JSON.parse(readFileSync(join(inconclusive.iterationDir, "benchmark.json"), "utf8")) : {};
  check("全平高分保留 run PASS 但 quality=INCONCLUSIVE", incAgg.code === 0
    && incBenchmark.quality_verdict?.status === "INCONCLUSIVE"
    && incBenchmark.quality_verdict.reasons.some((reason) => reason.includes("全平"))
    && incBenchmark.quality_verdict.forbidden_claims.length > 0);

  const supported = writeQualityIteration(join(verdictRoot, "supported"), "iteration-1", [true, true, true], [false, false, false]);
  const supAgg = runFile("aggregate-benchmark.mjs", [supported.iterationDir, "--skill-name", "quality-demo"]);
  const supBenchmark = JSON.parse(readFileSync(join(supported.iterationDir, "benchmark.json"), "utf8"));
  check("足量同 epoch 的关键 assertion 改善才 SUPPORT", supAgg.code === 0
    && supBenchmark.quality_verdict?.status === "SUPPORTED"
    && supBenchmark.quality_audit?.hypotheses_covered === 1
    && supBenchmark.evidence_audit?.live_calls === 0
    && supBenchmark.comparison_epoch);

  const regressed = writeQualityIteration(join(verdictRoot, "regressed"), "iteration-1", [true, true, false], [true, true, true]);
  const regAgg = runFile("aggregate-benchmark.mjs", [regressed.iterationDir, "--skill-name", "quality-demo"]);
  const regBenchmark = JSON.parse(readFileSync(join(regressed.iterationDir, "benchmark.json"), "utf8"));
  check("关键 assertion 退步时 quality=REGRESSED 且不通过", regAgg.code === 0
    && regBenchmark.quality_verdict?.status === "REGRESSED"
    && regBenchmark.quality_verdict.reasons.some((reason) => reason.includes("退步")));

  const blockedBase = join(verdictRoot, "blocked");
  const blocked = writeQualityIteration(blockedBase, "iteration-1", [true, true, true], [false, false, false]);
  writeFileSync(join(blocked.evalDir, "evidence-audit.json"), JSON.stringify({ status: "BLOCKED", mode: "replay", code: "BLOCKED_NETWORK_ISOLATION_UNAVAILABLE", live_calls: 0 }) + "\n", "utf8");
  const blockedAgg = runFile("aggregate-benchmark.mjs", [blocked.iterationDir, "--skill-name", "quality-demo"]);
  check("证据前置 BLOCKED 时不创建主 benchmark", blockedAgg.code === 1
    && !exists(join(blocked.iterationDir, "benchmark.json")));

  const legacy = writeQualityIteration(join(verdictRoot, "legacy"), "iteration-1", [true], [false]);
  rmSync(join(legacy.evalDir, "evidence-audit.json"));
  const legacyMeta = JSON.parse(readFileSync(join(legacy.evalDir, "eval_metadata.json"), "utf8"));
  delete legacyMeta.evidence;
  delete legacyMeta.quality;
  writeFileSync(join(legacy.evalDir, "eval_metadata.json"), JSON.stringify({ prompt: legacyMeta.prompt, assertions: legacyMeta.assertions }) + "\n", "utf8");
  const legacyAgg = runFile("aggregate-benchmark.mjs", [legacy.iterationDir, "--skill-name", "quality-demo"]);
  const legacyBenchmark = JSON.parse(readFileSync(join(legacy.iterationDir, "benchmark.json"), "utf8"));
  check("legacy eval 标 unmanaged/unassessed 而不回填", legacyAgg.code === 0
    && legacyBenchmark.evidence_audit?.mode === "unmanaged"
    && legacyBenchmark.quality_verdict?.status === "unassessed");

  const epochBase = join(verdictRoot, "epochs");
  const epochSkill = join(epochBase, "skill");
  const epoch1 = writeQualityIteration(epochBase, "iteration-1", [true, true, true], [false, false, false], { skillDir: epochSkill, digest: "sha256:" + "2".repeat(64) });
  const epoch2 = writeQualityIteration(epochBase, "iteration-2", [true, true, true], [false, false, false], { skillDir: epochSkill, digest: "sha256:" + "3".repeat(64), epoch: 2 });
  const e1 = runFile("aggregate-benchmark.mjs", [epoch1.iterationDir, "--skill-name", "quality-demo", "--history", epochSkill]);
  const e2 = runFile("aggregate-benchmark.mjs", [epoch2.iterationDir, "--skill-name", "quality-demo", "--history", epochSkill]);
  const epochHistory = JSON.parse(readFileSync(join(epochSkill, "history.json"), "utf8"));
  check("evidence/harness epoch 改变标 incomparable，不制造 won/lost", e1.code === 0 && e2.code === 0
    && epochHistory.runs.length === 2 && epochHistory.runs[1].comparison_status === "incomparable"
    && epochHistory.runs[1].vs_previous === null && epochHistory.runs[1].evidence_audit.evidence_digest === epoch2.evidenceDigest);

  const viewerHtmlPath = join(verdictRoot, "quality-review.html");
  const view = runFile("../eval-viewer/generate-review.mjs", [supported.iterationDir, "--skill-name", "quality-demo", "--static", viewerHtmlPath, "--no-open"]);
  const viewerHtml = exists(viewerHtmlPath) ? readFileSync(viewerHtmlPath, "utf8") : "";
  check("viewer 首屏展示 Evidence gate/Quality claim/reasons/forbidden claims", view.code === 0
    && viewerHtml.includes("Evidence gate") && viewerHtml.includes("Quality claim")
    && viewerHtml.includes("SUPPORTED") && viewerHtml.includes("forbidden")
    && viewerHtml.includes("本轮 replay"));

  const managedEvidence = { managed: true, blocking: false, mode: "replay", evidence_digest: "sha256:" + "4".repeat(64), evidence_epochs: [1], live_calls: 0 };
  const qualityEval = (name, maxRatio, withTokens, oldTokens, withPassed, oldPassed) => ({
    name,
    quality: {
      hypotheses: [{ id: `QH-${name}`, lever: "completion_criteria", risk: "结果可能未传导", expected_behavior: "结果完整", assertions: ["A"], gates: ["with_skill", "old_skill"] }],
      policy: { stability_runs: 1, required_comparators: ["old_skill"], cost_budget: { tokens_ratio_vs_old_max: maxRatio } },
    },
    configs: {
      with_skill: [{ tokens: withTokens, results: [{ name: "A", passed: withPassed }] }],
      old_skill: [{ tokens: oldTokens, results: [{ name: "A", passed: oldPassed }] }],
    },
  });
  const heterogeneousBudget = buildQualityVerdict({
    evals: [qualityEval("strict", 1.1, 150, 100, true, false), qualityEval("wide", 2.0, 200, 100, true, false)],
    benchmark: { configs: { with_skill: {}, old_skill: {} } },
    evidenceAudit: managedEvidence,
  });
  check("异构题目逐题应用 token budget，不取最宽预算", heterogeneousBudget.quality_verdict.status === "REGRESSED"
    && heterogeneousBudget.quality_audit.cost_budget_status === "exceeded"
    && heterogeneousBudget.quality_audit.cost_budget_details.some((item) => item.eval === "strict" && item.status === "exceeded"));

  const crossEvalRegression = buildQualityVerdict({
    evals: [qualityEval("positive", 2.0, 100, 100, true, false), qualityEval("negative", 2.0, 100, 100, false, true)],
    benchmark: { configs: { with_skill: {}, old_skill: {} } },
    evidenceAudit: managedEvidence,
  });
  check("同名 assertion 跨 eval 不互相平均抵消回归", crossEvalRegression.quality_verdict.status === "REGRESSED"
    && Object.keys(crossEvalRegression.quality_audit.assertion_delta).length === 2);
} finally {
  rmSync(verdictRoot, { recursive: true, force: true });
}

// ---- 模型控制 fallback·provision-eval-agent ----
console.log("模型控制 fallback·provision-eval-agent：");
{
  const fx = mkdtempSync(join(tmpdir(), "psc-provision-"));
  const prov = (args) => runFile("provision-eval-agent.mjs", args);
  const r1 = prov(["--list", "--agents-dir", fx]);
  check("空目录 list 退出码 0 且提示无定义", r1.code === 0 && out(r1).includes("无 agent 定义"));
  const r2 = prov(["--ensure", "--name", "eval-smoke", "--agents-dir", fx]);
  check("ensure 缺失时写入定义并提示重启", r2.code === 0 && existsSync(join(fx, "eval-smoke.md")) && out(r2).includes("重启"));
  const r3 = prov(["--check", "--name", "eval-smoke", "--agents-dir", fx]);
  check("check 通过并解析 model", r3.code === 0 && out(r3).includes("model=inherit"));
  const before = readFileSync(join(fx, "eval-smoke.md"), "utf8");
  const r4 = prov(["--ensure", "--name", "eval-smoke", "--agents-dir", fx]);
  const after4 = readFileSync(join(fx, "eval-smoke.md"), "utf8");
  check("ensure 幂等不改写", r4.code === 0 && before === after4);
  const r5 = prov(["--ensure", "--name", "eval-smoke", "--model", "custom:test:flash", "--agents-dir", fx]);
  const after5 = readFileSync(join(fx, "eval-smoke.md"), "utf8");
  check("model 不同且未加 --force 不覆盖", r5.code === 0 && after5 === before);
  const r6 = prov(["--ensure", "--name", "eval-smoke", "--model", "custom:test:flash", "--force", "--agents-dir", fx]);
  const after6 = readFileSync(join(fx, "eval-smoke.md"), "utf8");
  check("--force 覆盖生效", r6.code === 0 && after6.includes("custom:test:flash"));
  const r7 = prov(["--check", "--name", "no-such", "--agents-dir", fx]);
  check("check 缺失退出码 1", r7.code === 1);
  const r8 = prov(["--ensure", "--name", "Bad_Name", "--agents-dir", fx]);
  check("非法 name 退出码 2", r8.code === 2);
  const r9 = prov(["--list", "--agents-dir", fx]);
  check("list 解析新写入定义", r9.code === 0 && out(r9).includes("eval-smoke") && out(r9).includes("custom:test:flash"));
  rmSync(fx, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
