#!/usr/bin/env node
// 评测 agent 定义的检测 / 自建 / 校验（模型控制 fallback 的执行件）。
// 定义位置：~/.zcode/agents/<name>.md（zcode 自建 agent 的实际落盘处；注册表为宿主启动快照，新建后需重启生效）。
// 幂等：已存在且合法时不改写；--force 才覆盖。测试可用 --agents-dir 指向夹具目录。
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const USAGE = `用法:
  node scripts/provision-eval-agent.mjs --list [--agents-dir <dir>]
  node scripts/provision-eval-agent.mjs --check --name <agent> [--agents-dir <dir>]
  node scripts/provision-eval-agent.mjs --ensure --name <agent> [--model <id>] [--thought-level <level>] [--agents-dir <dir>] [--force]

说明:
  --list    列出定义目录里每个 agent 的 name / model / thoughtLevel
  --check   校验定义存在且 frontmatter 合法（name 匹配、model 非空）：0=OK，1=缺失，3=不合法
  --ensure  缺失则按模板写入（默认 model: inherit，thoughtLevel: high），已存在且合法则不动（幂等）；
            传入 --model 且与现存不同时报差异，仅 --force 时覆盖。新建后需宿主重启才会进入 spawn 注册表。
  默认目录 ~/.zcode/agents；测试/沙箱用 --agents-dir 覆盖。`;

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const parsed = { agentsDir: join(homedir(), ".zcode", "agents"), thoughtLevel: "high", model: "inherit" };
  const modes = [];
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--help" || flag === "-h") { process.stdout.write(`${USAGE}\n`); process.exit(0); }
    if (flag === "--list" || flag === "--check" || flag === "--ensure") { modes.push(flag.slice(2)); continue; }
    if (flag === "--force") { parsed.force = true; continue; }
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) fail(`${USAGE}\n参数缺值: ${flag}`, 2);
    if (flag === "--name") parsed.name = value;
    else if (flag === "--model") parsed.model = value;
    else if (flag === "--thought-level") parsed.thoughtLevel = value;
    else if (flag === "--agents-dir") parsed.agentsDir = resolve(value);
    else fail(`${USAGE}\n未知参数: ${flag}`, 2);
  }
  if (modes.length !== 1) fail(`${USAGE}\n必须且只能指定 --list / --check / --ensure 之一`, 2);
  parsed.mode = modes[0];
  if (parsed.mode === "list") return parsed;
  if (!parsed.name) fail(`${USAGE}\n--check/--ensure 需要 --name`, 2);
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(parsed.name)) fail(`拒绝: name 须为 kebab-case 且 ≤64 字符: ${parsed.name}`, 2);
  if (parsed.force && parsed.mode !== "ensure") fail("拒绝: --force 只与 --ensure 搭配", 2);
  return parsed;
}

function parseDefinition(file) {
  const md = readFileSync(file, "utf8");
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { valid: false, reason: "no-frontmatter" };
  const fm = m[1];
  const pick = (key) => {
    const v = (fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m")) || [])[1];
    return v ? v.trim().replace(/^["']|["']$/g, "") : null;
  };
  const name = pick("name");
  const model = pick("model");
  const thoughtLevel = pick("thoughtLevel");
  if (!name) return { valid: false, reason: "no-name" };
  return { valid: true, name, model, thoughtLevel };
}

const args = parseArgs(process.argv.slice(2));

if (args.mode === "list") {
  if (!existsSync(args.agentsDir)) { process.stdout.write(`(目录不存在: ${args.agentsDir})\n`); process.exit(0); }
  const files = readdirSync(args.agentsDir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) { process.stdout.write("(无 agent 定义)\n"); process.exit(0); }
  for (const f of files) {
    const d = parseDefinition(join(args.agentsDir, f));
    process.stdout.write(d.valid
      ? `${d.name}\tmodel=${d.model ?? "?"}\tthoughtLevel=${d.thoughtLevel ?? "?"}\t${f}\n`
      : `(无法解析)\t${f}\t${d.reason}\n`);
  }
  process.exit(0);
}

const target = join(args.agentsDir, `${args.name}.md`);

if (args.mode === "check") {
  if (!existsSync(target)) { process.stdout.write(`缺失: ${target}（可先用 --ensure 自建，重启宿主后生效）\n`); process.exit(1); }
  const d = parseDefinition(target);
  if (!d.valid) { process.stdout.write(`不合法: ${target} (${d.reason})\n`); process.exit(3); }
  if (d.name !== args.name) { process.stdout.write(`不合法: frontmatter name(${d.name}) 与文件名(${args.name}) 不一致\n`); process.exit(3); }
  if (!d.model) { process.stdout.write(`不合法: 缺 model 字段\n`); process.exit(3); }
  process.stdout.write(`OK ${d.name} model=${d.model} thoughtLevel=${d.thoughtLevel ?? "?"} → ${target}\n`);
  process.exit(0);
}

// --ensure
if (existsSync(target)) {
  const d = parseDefinition(target);
  if (d.valid && d.name === args.name && d.model) {
    if (d.model !== args.model && !args.force) {
      process.stdout.write(`已存在且合法（model=${d.model}）；请求 model=${args.model} 不同，未改动——确认覆盖加 --force\n`);
      process.exit(0);
    }
    if (!args.force) { process.stdout.write(`已存在且合法（model=${d.model}），幂等跳过\n`); process.exit(0); }
  } else if (!args.force) {
    process.stdout.write(`已存在但不合法或缺字段，未改动——确认覆盖加 --force\n`);
    process.exit(3);
  }
}

const TEMPLATE = `---
name: "${args.name}"
description: "评测执行臂/探针专用 subagent（parking-skill-creator 模型控制通道；任务由 run prompt 携带）"
color: yellow
model: "${args.model}"
thoughtLevel: "${args.thoughtLevel}"
injectAgentsMd: true
---

评测执行 agent。按调用方 run prompt 执行任务并把产物写入指定 outputs 目录；
不要读取同 workspace 其他轮次产物、评分器或技能快照（沙箱纪律以 run prompt 为准）。
`;

mkdirSync(args.agentsDir, { recursive: true });
writeFileSync(target, TEMPLATE, "utf8");
process.stdout.write(`已写入 ${target}\nmodel=${args.model} thoughtLevel=${args.thoughtLevel}\n注意: 注册表为宿主启动快照，重启 zcode 后该 agent 才可被 spawn。\n`);
process.exit(0);
