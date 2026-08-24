#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  closeSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const USAGE = `用法:
  node scripts/run-headless-trigger-probe.mjs \\
    --query <用户请求原文> --skills-file <name + description 清单> \\
    [--command <zcode|bash|node>] [--command-arg <前置参数>]... \\
    --scan-root <运行可能写入的目录> [--scan-root <目录>]... \\
    [--exclude <合法 secret store 文件或目录>]... \\
    [--temp-root <私有临时目录父级>] [--timeout-ms <毫秒>]

凭据契约:
  只从当前进程环境读取 ZCODE_API_KEY 与 ZCODE_MODEL；不接受 key 参数，不读取任何配置文件。`;

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const parsed = {
    command: "zcode",
    commandArgs: [],
    scanRoots: [],
    excludes: [],
    tempRoot: tmpdir(),
    timeoutMs: 120_000,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--help" || flag === "-h") {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) fail(`${USAGE}\n参数缺值: ${flag}`, 2);
    if (flag === "--query") parsed.query = value;
    else if (flag === "--skills-file") parsed.skillsFile = resolve(value);
    else if (flag === "--command") parsed.command = value;
    else if (flag === "--command-arg") parsed.commandArgs.push(value);
    else if (flag === "--scan-root") parsed.scanRoots.push(resolve(value));
    else if (flag === "--exclude") parsed.excludes.push(resolve(value));
    else if (flag === "--temp-root") parsed.tempRoot = resolve(value);
    else if (flag === "--timeout-ms") parsed.timeoutMs = Number(value);
    else fail(`${USAGE}\n未知参数: ${flag}`, 2);
  }
  if (!parsed.query || !parsed.skillsFile || parsed.scanRoots.length === 0) fail(USAGE, 2);
  if (!Number.isInteger(parsed.timeoutMs) || parsed.timeoutMs < 1_000 || parsed.timeoutMs > 900_000) {
    fail("拒绝: --timeout-ms 必须是 1000..900000 的整数", 2);
  }
  return parsed;
}

function buildPrompt(query, skills) {
  return `你是一个技能路由判断器。你不需要、也不允许实际执行任务、调用任何工具或浏览任何文件——你只做一件事：从下面的技能清单里选出会用到的技能。

用户向你提出以下请求：

${query}

请先决定你会使用哪个技能来处理它。可用技能清单如下（name + description）：
${skills}

回复格式要求（必须严格遵守）：
第一行输出 \`SKILL: <技能name>\`——你会读取并使用的技能名；若不需要任何技能则输出 \`SKILL: none\`。
第二行起用不超过 15 个字说明理由。`;
}

function containsSecretPrefix(file, prefix) {
  const stat = lstatSync(file);
  if (!stat.isFile()) return false;
  const needle = Buffer.from(prefix, "utf8");
  const buffer = Buffer.allocUnsafe(64 * 1024 + needle.length - 1);
  let overlap = 0;
  let fd;
  try {
    fd = openSync(file, "r");
    while (true) {
      const bytes = readSync(fd, buffer, overlap, 64 * 1024, null);
      if (bytes === 0) break;
      const used = overlap + bytes;
      if (buffer.subarray(0, used).includes(needle)) return true;
      overlap = Math.min(needle.length - 1, used);
      if (overlap > 0) buffer.copy(buffer, 0, used - overlap, used);
    }
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function normalizedPath(path) {
  const value = resolve(path).replaceAll("\\", "/").replace(/\/$/, "");
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function scanRoots(roots, prefix, excludes) {
  const findings = [];
  const unreadable = [];
  let files = 0;
  let excluded = 0;
  const excludedPaths = excludes.map(normalizedPath);
  const isExcluded = (path) => {
    const candidate = normalizedPath(path);
    return excludedPaths.some((blocked) => candidate === blocked || candidate.startsWith(`${blocked}/`));
  };
  const visit = (path) => {
    if (isExcluded(path)) { excluded++; return; }
    let stat;
    try { stat = lstatSync(path); }
    catch { unreadable.push(path); return; }
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      let names;
      try { names = readdirSync(path); }
      catch { unreadable.push(path); return; }
      for (const name of names) visit(join(path, name));
      return;
    }
    if (!stat.isFile()) return;
    files++;
    try {
      if (containsSecretPrefix(path, prefix)) findings.push(path);
    } catch {
      unreadable.push(path);
    }
  };
  for (const root of roots) visit(root);
  return { files, findings, unreadable, excluded };
}

const args = parseArgs(process.argv.slice(2));
const apiKey = process.env.ZCODE_API_KEY;
const model = process.env.ZCODE_MODEL;
if (typeof apiKey !== "string" || apiKey.length < 12) fail("拒绝: 当前进程环境缺少有效的 ZCODE_API_KEY");
if (typeof model !== "string" || model.trim() === "") fail("拒绝: 当前进程环境缺少 ZCODE_MODEL");
const prefix = apiKey.slice(0, 12);
if (args.commandArgs.some((value) => value.includes(prefix))) fail("拒绝: --command-arg 不得包含凭据");
const home = process.env.USERPROFILE || process.env.HOME;
if (home) {
  args.excludes.push(
    resolve(home, ".zcode", "cli", "config.json"),
    resolve(home, ".zcode", "v2", "config.json"),
  );
}

let skills;
try { skills = readFileSync(args.skillsFile, "utf8").trim(); }
catch { fail("拒绝: 无法读取 --skills-file"); }
if (!skills) fail("拒绝: 技能清单为空");
const leakedHints = ["should_trigger", "trigger-evals", "probe-results", "我们在测试", "预期答案"];
if (leakedHints.some((hint) => skills.includes(hint))) fail("拒绝: 技能清单混入评测答案或评测工件提示");

const prompt = buildPrompt(args.query, skills);
if (prompt.includes(prefix)) fail("拒绝: prompt 不得包含凭据");
mkdirSync(args.tempRoot, { recursive: true });
const runDir = mkdtempSync(join(args.tempRoot, "psc-trigger-probe-"));
const settingsPath = join(runDir, "empty-settings.json");
const childArgs = [
  ...args.commandArgs,
  "--prompt", prompt,
  "--max-turns", "1",
  "--mode", "plan",
  "--surface", "terminal",
  "--settings", settingsPath,
  "--no-color",
];
const childEnv = {
  ...process.env,
  TEMP: runDir,
  TMP: runDir,
  TMPDIR: runDir,
};

let child;
let privateScan;
try {
  writeFileSync(settingsPath, "{}\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  child = spawnSync(args.command, childArgs, {
    cwd: runDir,
    env: childEnv,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: args.timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
  });
} finally {
  privateScan = scanRoots([runDir], prefix, []);
  rmSync(runDir, { recursive: true, force: true });
}

const captured = `${child?.stdout ?? ""}\n${child?.stderr ?? ""}`;
if (captured.includes(prefix)) fail("拒绝: Provider 输出含凭据前缀；内容已抑制");
if (privateScan.findings.length > 0) fail("拒绝: Provider 把凭据前缀写入私有 Temp；目录已清理");
if (privateScan.unreadable.length > 0) fail("拒绝: 私有 Temp 残留扫描不完整；目录已清理");

const scan = scanRoots(args.scanRoots, prefix, args.excludes);
if (scan.findings.length > 0) {
  process.stderr.write(`拒绝: 凭据前缀残留 ${scan.findings.length} 个文件（不输出内容）\n`);
  for (const file of scan.findings) process.stderr.write(`RESIDUE ${file}\n`);
  process.exit(1);
}
if (scan.unreadable.length > 0) {
  process.stderr.write(`拒绝: 残留扫描不完整，${scan.unreadable.length} 个路径不可读\n`);
  process.exit(1);
}
if (child?.error || child?.status !== 0) {
  const reason = child?.error?.code ?? child?.signal ?? child?.status ?? "unknown";
  fail(`拒绝: headless Provider 未成功完成 (${reason})；不生成探针答案`);
}

const lines = String(child.stdout ?? "").replaceAll("\r\n", "\n").replace(/\n+$/, "").split("\n");
const firstLine = lines[0] ?? "";
if (!/^SKILL: (?:none|[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(firstLine)) {
  fail("拒绝: Provider 首行不符合 SKILL 协议；不猜测、不代答");
}
const reason = lines.slice(1).join(" ").trim();
if (Array.from(reason).length > 15) fail("拒绝: Provider 理由超过 15 字；不截断、不代答");
process.stdout.write(`${firstLine}\n${reason ? `${reason}\n` : ""}`);
process.stderr.write(`RESIDUE_SCAN_OK roots=${args.scanRoots.length} files=${scan.files} excluded=${scan.excluded}\n`);
