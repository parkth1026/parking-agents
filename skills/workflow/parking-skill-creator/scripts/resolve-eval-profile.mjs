#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const usage = "用法: node scripts/resolve-eval-profile.mjs --host <codex|claude> [--profile economy|representative|strict] [--model <id>] [--effort <level>] [--grader-model <id>] [--grader-effort <level>] [--output <json>]";
function stop(message, code = 2) { process.stderr.write(`${message}\n`); process.exit(code); }
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  const value = process.argv[i + 1];
  if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) stop(usage);
  args[key.slice(2)] = value;
}
if (!args.host || !["codex", "claude"].includes(args.host)) stop(usage);
const sourcePath = resolve(root, "eval-profiles.json");
if (!existsSync(sourcePath)) stop(`BLOCKED: 内置 profile 不存在: ${sourcePath}`, 1);
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const profileName = args.profile ?? source.default_profile;
const profile = source.profiles?.[profileName];
if (!profile) stop(`BLOCKED: 未知 profile: ${profileName}`, 1);
if (profile.requires_model_override && !args.model) stop("BLOCKED: strict 必须显式提供 --model，禁止自动选择昂贵模型", 1);
const host = profile.hosts?.[args.host];
if (!host && !args.model) stop(`BLOCKED: profile=${profileName} 没有 host=${args.host} 的开箱配置`, 1);
const choose = (role) => {
  const base = host?.[role] ?? {};
  const isGrader = role === "grader";
  const modelOverride = isGrader ? args["grader-model"] : args.model;
  const effortOverride = isGrader ? args["grader-effort"] : args.effort;
  return {
    model_requested: modelOverride ?? base.models?.[0] ?? args.model,
    model_candidates: modelOverride ? [modelOverride] : (base.models ?? [args.model]),
    effort_requested: effortOverride ?? base.effort ?? null,
    resolution: modelOverride ? "explicit_override" : "built_in_profile"
  };
};
const resolved = {
  schema_version: 1,
  profile: profileName,
  host: args.host,
  source: "parking-skill-creator/eval-profiles.json",
  resolved_at: new Date().toISOString(),
  execution: choose("execution"),
  trigger: choose("trigger"),
  grader: choose("grader"),
  fallback_policy: "fail_closed_no_expensive_inherit",
  effective_model_status: "unknown"
};
const canonical = JSON.stringify({ ...resolved, resolved_at: null });
resolved.harness_profile_digest = `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
const output = JSON.stringify(resolved, null, 2) + "\n";
if (args.output) writeFileSync(resolve(args.output), output, "utf8");
process.stdout.write(output);
