#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(resolve(root, "eval-profiles.json"), "utf8"));
const limit = config.scheduling?.max_in_flight;
const usage = "用法: node scripts/plan-eval-batches.mjs --kind <output|trigger|grader> --items <正整数> [--group-size <正整数>]";
function stop(message, code = 2) { process.stderr.write(`${message}\n`); process.exit(code); }
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  const value = process.argv[i + 1];
  if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) stop(usage);
  args[key.slice(2)] = value;
}
if (!["output", "trigger", "grader"].includes(args.kind)) stop(usage);
const items = Number(args.items);
if (!Number.isInteger(items) || items < 1) stop("拒绝: --items 必须是正整数");
const defaultGroup = args.kind === "trigger" ? 3 : 1;
const groupSize = Number(args["group-size"] ?? defaultGroup);
if (!Number.isInteger(groupSize) || groupSize < 1) stop("拒绝: --group-size 必须是正整数");
if (!Number.isInteger(limit) || limit < 1) stop("BLOCKED: eval-profiles.json 缺合法 max_in_flight", 1);
if (groupSize > limit) stop(`BLOCKED: 单个 ${args.kind} group=${groupSize} 超过全局并发上限 ${limit}，不得拆散比较组`, 1);

const groupsPerBatch = Math.max(1, Math.floor(limit / groupSize));
const batches = [];
for (let start = 0; start < items; start += groupsPerBatch) {
  const groupCount = Math.min(groupsPerBatch, items - start);
  batches.push({
    batch: batches.length + 1,
    item_start: start + 1,
    item_end: start + groupCount,
    groups: groupCount,
    in_flight: groupCount * groupSize
  });
}
process.stdout.write(JSON.stringify({
  kind: args.kind,
  max_in_flight: limit,
  adaptive_concurrency: false,
  group_size: groupSize,
  groups_per_batch: groupsPerBatch,
  batches
}, null, 2) + "\n");
