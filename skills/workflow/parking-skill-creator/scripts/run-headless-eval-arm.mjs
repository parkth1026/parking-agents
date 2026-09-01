#!/usr/bin/env node
// headless 评测臂启动器：按进程指定模型（ZCODE_MODEL + ZCODE_API_KEY），跑一个 eval run。
// 只从进程环境读凭据；不读共享配置；失败硬报、绝不代写产物。
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const USAGE = `用法:
  node scripts/run-headless-eval-arm.mjs \\
    --prompt-file <run prompt 文本文件> \\
    --run-dir <该 run 的目录（含 outputs/）> \\
    [--timeout-ms <毫秒，默认 600000>]

凭据契约（与 run-headless-trigger-probe.mjs 同源）:
  只从当前进程环境读取 ZCODE_API_KEY 与 ZCODE_MODEL；不接受 key 参数，不读取任何配置文件。
  两项必须同时存在，否则在启动前拒绝（退出码 2）。

行为:
  - 以参数数组启动 zcode --prompt <全文> --cwd <run-dir> --mode yolo --no-color；
    产物由 headless agent 按 prompt 指示写入 run-dir/outputs/。
  - 在 run-dir 写 run-meta.json：请求模型、zcode 版本、退出码、时长、traceId（若可提取）。
  - 退出码：0 = headless 正常结束；1 = headless 失败（含无效模型，zcode 会硬失败）；
    2 = 参数/环境拒绝。失败时不伪造任何产物。`;

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const parsed = { timeoutMs: 600_000 };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--help" || flag === "-h") {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) fail(`${USAGE}\n参数缺值: ${flag}`, 2);
    if (flag === "--prompt-file") parsed.promptFile = resolve(value);
    else if (flag === "--run-dir") parsed.runDir = resolve(value);
    else if (flag === "--timeout-ms") parsed.timeoutMs = Number(value);
    else fail(`${USAGE}\n未知参数: ${flag}`, 2);
  }
  if (!parsed.promptFile || !parsed.runDir) fail(USAGE, 2);
  if (!Number.isInteger(parsed.timeoutMs) || parsed.timeoutMs < 1_000 || parsed.timeoutMs > 3_600_000) {
    fail("拒绝: --timeout-ms 必须是 1000..3600000 的整数", 2);
  }
  return parsed;
}

const args = parseArgs(process.argv.slice(2));

if (!process.env.ZCODE_MODEL) {
  fail("拒绝: 进程环境缺 ZCODE_MODEL。headless 模型控制必须由宿主/用户预置该变量（与 ZCODE_API_KEY 成对）。", 2);
}
if (!process.env.ZCODE_API_KEY) {
  fail("拒绝: 进程环境缺 ZCODE_API_KEY。共享 OAuth 登录不供给 headless --prompt；不得从配置文件提取。", 2);
}
if (!existsSync(args.promptFile)) fail(`拒绝: prompt 文件不存在: ${args.promptFile}`, 2);

const prompt = readFileSync(args.promptFile, "utf8");
if (!prompt.trim()) fail("拒绝: prompt 文件为空", 2);

mkdirSync(args.runDir, { recursive: true });
const startedAt = new Date().toISOString();
const t0 = Date.now();

const result = spawnSync(
  "zcode",
  ["--prompt", prompt, "--cwd", args.runDir, "--mode", "yolo", "--no-color"],
  {
    encoding: "utf8",
    timeout: args.timeoutMs,
    env: process.env,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  },
);

const durationMs = Date.now() - t0;
const stdout = result.stdout ?? "";
const stderr = result.stderr ?? "";
const combined = stdout + stderr;
const traceId = (combined.match(/traceId[: ]+([0-9a-f-]{8,})/i) || [])[1] ?? null;
const versionOut = spawnSync("zcode", ["--version"], { encoding: "utf8", timeout: 30_000 });
const zcodeVersion = (versionOut.stdout || "").trim() || null;

const meta = {
  channel: "headless",
  model_requested: process.env.ZCODE_MODEL,
  zcode_version: zcodeVersion,
  exit_code: result.status,
  timed_out: result.signal === "SIGTERM" || result.error?.code === "ETIMEDOUT",
  trace_id: traceId,
  started_at: startedAt,
  duration_ms: durationMs,
  prompt_file: args.promptFile,
};
writeFileSync(
  resolve(args.runDir, "run-meta.json"),
  JSON.stringify(meta, null, 2) + "\n",
  "utf8",
);

// 不打印任何可能携带凭据的环境内容；只给诊断最小集。
if (result.error) {
  fail(`headless 启动失败: ${result.error.message}（model=${process.env.ZCODE_MODEL}, traceId=${traceId}）`, 1);
}
if (result.status !== 0) {
  fail(
    `headless 退出码 ${result.status}（model=${process.env.ZCODE_MODEL}, traceId=${traceId}）。` +
      `无效模型会在此处硬失败——这是 fail-fast 验证的一部分；请核对模型 ID 与 API key 的配对。`,
    1,
  );
}
process.stdout.write(
  `OK model=${process.env.ZCODE_MODEL} duration_ms=${durationMs} traceId=${traceId}\nrun-meta.json 已写入 ${args.runDir}\n`,
);
