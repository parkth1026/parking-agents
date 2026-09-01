#!/usr/bin/env node
// 为 Codex / Claude / zcode 按 run 指定模型与推理强度。失败硬报，不代写产物。
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { runUntilComplete } from "./lib/run-until-complete.mjs";

const USAGE = `用法:
  node scripts/run-headless-eval-arm.mjs --host <codex|claude|zcode> \\
    (--model <模型> [--effort <强度>] | --profile-file <resolved.json> --role <execution|trigger|grader>) \\
    --prompt-file <文件> --run-dir <目录> [--completion-file <run内相对路径>] [--completion-grace-ms <毫秒>] [--timeout-ms <毫秒>]

认证由宿主 CLI 自己管理；本脚本不接受 credential 参数。zcode 兼容通道仍要求进程环境提供 ZCODE_API_KEY。
退出码: 0=完成；1=宿主执行失败；2=参数或前置条件拒绝。`;

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const parsed = { timeoutMs: 600_000, completionGraceMs: 15_000 };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--help" || flag === "-h") {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) fail(`${USAGE}\n参数缺值: ${flag}`, 2);
    if (flag === "--host") parsed.host = value;
    else if (flag === "--model") parsed.model = value;
    else if (flag === "--effort") parsed.effort = value;
    else if (flag === "--profile-file") parsed.profileFile = resolve(value);
    else if (flag === "--role") parsed.role = value;
    else if (flag === "--prompt-file") parsed.promptFile = resolve(value);
    else if (flag === "--run-dir") parsed.runDir = resolve(value);
    else if (flag === "--completion-file") parsed.completionFile = value;
    else if (flag === "--completion-grace-ms") parsed.completionGraceMs = Number(value);
    else if (flag === "--timeout-ms") parsed.timeoutMs = Number(value);
    else fail(`${USAGE}\n未知参数: ${flag}`, 2);
  }
  if (!parsed.host || !parsed.promptFile || !parsed.runDir || (!parsed.model && !parsed.profileFile)) fail(USAGE, 2);
  if (!["codex", "claude", "zcode"].includes(parsed.host)) fail("拒绝: --host 只接受 codex、claude、zcode", 2);
  if (parsed.profileFile && !["execution", "trigger", "grader"].includes(parsed.role)) fail("拒绝: --profile-file 必须同时提供合法 --role", 2);
  if (!Number.isInteger(parsed.timeoutMs) || parsed.timeoutMs < 1_000 || parsed.timeoutMs > 3_600_000) fail("拒绝: --timeout-ms 必须是 1000..3600000 的整数", 2);
  if (!Number.isInteger(parsed.completionGraceMs) || parsed.completionGraceMs < 0 || parsed.completionGraceMs > 60_000) fail("拒绝: --completion-grace-ms 必须是 0..60000 的整数", 2);
  if (parsed.completionFile && isAbsolute(parsed.completionFile)) fail("拒绝: --completion-file 必须是 run-dir 内相对路径", 2);
  return parsed;
}

const args = parseArgs(process.argv.slice(2));
if (args.profileFile) {
  if (!existsSync(args.profileFile)) fail(`拒绝: resolved profile 不存在: ${args.profileFile}`, 2);
  const profile = JSON.parse(readFileSync(args.profileFile, "utf8"));
  if (profile.host !== args.host) fail(`拒绝: profile host=${profile.host} 与 --host=${args.host} 不同`, 2);
  args.model = profile[args.role]?.model_requested;
  args.effort = profile[args.role]?.effort_requested ?? undefined;
  if (!args.model || args.model === "inherit") fail(`拒绝: headless ${args.role} 没有可执行的具体模型`, 2);
}
if (args.host === "zcode" && !process.env.ZCODE_API_KEY) fail("拒绝: zcode 通道缺 ZCODE_API_KEY", 2);
if (!existsSync(args.promptFile)) fail(`拒绝: prompt 文件不存在: ${args.promptFile}`, 2);
const prompt = readFileSync(args.promptFile, "utf8");
if (!prompt.trim()) fail("拒绝: prompt 文件为空", 2);

mkdirSync(args.runDir, { recursive: true });
const completionFile = args.completionFile ? resolve(args.runDir, args.completionFile) : null;
if (completionFile && relative(args.runDir, completionFile).startsWith("..")) fail("拒绝: --completion-file 不得逃逸 run-dir", 2);
const command = args.host === "codex" ? "codex" : args.host === "claude" ? "claude" : "zcode";
const commandArgs = args.host === "codex"
  ? ["exec", "--ephemeral", "--skip-git-repo-check", "--sandbox", "workspace-write", "--model", args.model,
      ...(args.effort ? ["--config", `model_reasoning_effort=${JSON.stringify(args.effort)}`] : []), "--cd", args.runDir, prompt]
  : args.host === "claude"
    ? ["--print", "--no-session-persistence", "--permission-mode", "acceptEdits", "--output-format", "json", "--model", args.model,
        ...(args.effort ? ["--effort", args.effort] : []), prompt]
    : ["--prompt", prompt, "--cwd", args.runDir, "--mode", "yolo", "--no-color"];
const childEnv = args.host === "zcode" ? { ...process.env, ZCODE_MODEL: args.model } : process.env;
const startedAt = new Date().toISOString();
const t0 = Date.now();
const result = await runUntilComplete({
  command, args: commandArgs, cwd: args.runDir, env: childEnv,
  timeoutMs: args.timeoutMs, completionFile, completionGraceMs: args.completionGraceMs
});
const durationMs = result.durationMs ?? (Date.now() - t0);
const versionOut = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 30_000 });
const combined = (result.stdout ?? "") + (result.stderr ?? "");
const traceId = (combined.match(/traceId[: ]+([0-9a-f-]{8,})/i) || [])[1] ?? null;
let effectiveModel = null;
let effectiveEffort = null;
let modelEvidence = "requested_only";
if (args.host === "codex") {
  effectiveModel = (combined.match(/^model:\s*(\S+)\s*$/mi) || [])[1] ?? null;
  effectiveEffort = (combined.match(/^reasoning effort:\s*(\S+)\s*$/mi) || [])[1] ?? null;
  if (effectiveModel) modelEvidence = "host_reported";
} else if (args.host === "claude") {
  try {
    const response = JSON.parse(result.stdout ?? "{}");
    const usage = Object.values(response.modelUsage ?? {})[0];
    effectiveModel = usage?.canonicalModel ?? null;
    if (effectiveModel) modelEvidence = "provider_reported";
  } catch { /* non-JSON failure is handled by exit status */ }
}
const meta = {
  channel: "headless", host: args.host, model_requested: args.model,
  effort_requested: args.effort ?? null, host_version: (versionOut.stdout || "").trim() || null,
  effective_model: effectiveModel, effective_effort: effectiveEffort,
  model_evidence: modelEvidence, effort_evidence: effectiveEffort ? "host_reported" : "requested_only",
  exit_code: result.status,
  timed_out: !result.completionSeenAt && result.terminationRequested && durationMs >= args.timeoutMs,
  completed_by: result.completedBy,
  completion_file: completionFile,
  completion_seen_at: result.completionSeenAt,
  terminated_after_completion: result.completedBy === "completion_marker" && result.terminationRequested,
  trace_id: traceId, started_at: startedAt, duration_ms: durationMs, prompt_file: args.promptFile,
};
writeFileSync(resolve(args.runDir, "run-meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf8");

if (result.error) fail(`headless 启动失败: ${result.error.message}（host=${args.host}, model=${args.model}）`, 1);
if (result.status !== 0 && result.completedBy !== "completion_marker") fail(`headless 退出码 ${result.status}（host=${args.host}, model=${args.model}, effort=${args.effort ?? "default"}）。请核对模型可用性、强度支持和宿主认证。`, 1);
process.stdout.write(`OK host=${args.host} model=${args.model} effort=${args.effort ?? "default"} duration_ms=${durationMs}\nrun-meta.json 已写入 ${args.runDir}\n`);
