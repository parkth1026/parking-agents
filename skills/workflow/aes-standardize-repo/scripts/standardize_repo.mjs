#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const templateRoot = join(skillRoot, "assets", "run");
const integrationSentence = "本仓库标准操作：`.\\run` 发现，`.\\run <id> -n` 预览，`.\\run <id>` 执行，`--json` 机器可读。";
const reserved = new Set(["list", "show", "doctor", "help", "run"]);
// 动词域的单一事实源；references/action-naming.md 的表格由这份清单派生，保持两处同步。
const verbDomain = ["setup", "dev", "start", "serve", "preview", "build", "dist", "check", "lint", "typecheck", "test", "gate"];
const acceptedScripts = new RegExp(`^(?:${verbDomain.join("|")})(?::|-|$)`, "iu");

function fail(message, code = 64, asJson = false) {
  if (asJson) process.stdout.write(`${JSON.stringify({ status: "error", exitCode: code, error: message })}\n`);
  else process.stderr.write(`[aes-standardize-repo] error: ${message}\n`);
  process.exit(code);
}

function parseArguments(argv) {
  const options = { create: false, force: false, json: false, target: null, projectId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const normalized = argument.toLowerCase();
    if (normalized === "--create") options.create = true;
    else if (normalized === "--force") options.force = true;
    else if (normalized === "--json") options.json = true;
    else if (normalized === "--project-id") {
      options.projectId = argv[index + 1] ?? null;
      index += 1;
    } else if (argument.startsWith("-")) fail(`unknown option '${argument}'`, 64, options.json);
    else if (options.target === null) options.target = argument;
    else fail("expected exactly one repository path", 64, options.json);
  }
  options.target = resolve(options.target ?? process.cwd());
  return options;
}

function readPackageJson(target, asJson) {
  const path = join(target, "package.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`cannot parse ${path}: ${error.message}`, 65, asJson);
  }
}

function slug(value) {
  return value.toLowerCase().replace(/^@/u, "").replace(/[^a-z0-9./-]+/gu, "-").replace(/-+/gu, "-").replace(/^[-./]+|[-./]+$/gu, "");
}

function inferProjectId(target, pkg) {
  if (typeof pkg?.name === "string") {
    const normalized = slug(pkg.name);
    if (normalized.includes("/")) return normalized;
    if (normalized) return `local/${normalized}`;
  }
  return `local/${slug(basename(target)) || "repository"}`;
}

function packageManager(target) {
  if (existsSync(join(target, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(target, "yarn.lock"))) return "yarn";
  if (existsSync(join(target, "bun.lockb")) || existsSync(join(target, "bun.lock"))) return "bun";
  return "npm";
}

function actionKind(id) {
  if (/^(?:dev|start|serve|preview)(?:\.|$)/u.test(id)) return "open";
  if (/^test(?:\.|$)/u.test(id)) return "test";
  if (/^gate(?:\.|$)/u.test(id)) return "gate";
  return "task";
}

// 机械映射：`test:gate-review-fixes` -> `test.gate.review.fixes`。id 始终可由脚本名推导；
// 映射不了的脚本必须报告，绝不静默丢弃。
function actionId(script) {
  const id = script.toLowerCase().replaceAll(":", ".").replaceAll("-", ".");
  return /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/u.test(id) && !reserved.has(id) ? id : null;
}

function inferActions(target, pkg) {
  if (!pkg) {
    return { actions: [{ id: "check", name: "Validate the run interface", kind: "task", run: ["node", "--check", "scripts/run.mjs"] }], skipped: [] };
  }
  const manager = packageManager(target);
  const actions = [{
    id: "setup",
    name: "Install dependencies",
    kind: "task",
    run: manager === "npm" ? ["npm", "install"] : [manager, "install"],
  }];
  const skipped = [];
  const scripts = pkg.scripts && typeof pkg.scripts === "object" ? Object.keys(pkg.scripts) : [];
  for (const script of scripts.filter((candidate) => acceptedScripts.test(candidate)).sort()) {
    const id = actionId(script);
    if (!id) {
      skipped.push({ script, reason: "does not map to a valid action id" });
      continue;
    }
    if (actions.some((action) => action.id === id)) {
      skipped.push({ script, reason: `collides with already-mapped id '${id}'` });
      continue;
    }
    actions.push({ id, name: script, kind: actionKind(id), run: [manager, "run", script] });
  }
  if (actions.length === 1) actions.push({ id: "check", name: "Validate package metadata", kind: "task", run: ["node", "-e", "JSON.parse(require('node:fs').readFileSync('package.json','utf8'))"] });
  return { actions, skipped };
}

function copyTree(source, destination, asJson = false) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) copyTree(sourcePath, destinationPath, asJson);
    else if (entry.isFile()) copyFileSync(sourcePath, destinationPath);
    else fail(`template contains unsupported entry: ${sourcePath}`, 70, asJson);
  }
}

function tomlString(value) {
  return JSON.stringify(value);
}

function renderConfig(projectId, actions) {
  const header = [
    "# run/v1 — id 遵循动词域命名规范；扩展动词域必须在此登记。",
    `# 动词域：${verbDomain.join(" ")}`,
    "",
  ].join("\n");
  const blocks = [`[project]\nid = ${tomlString(projectId)}`];
  for (const action of actions) {
    blocks.push(`[[actions]]\nid = ${tomlString(action.id)}\nname = ${tomlString(action.name)}\nkind = ${tomlString(action.kind)}\nrun = ${tomlString(action.run)}`);
  }
  return `${header}${blocks.join("\n\n")}\n`;
}

function scannedInputs(target) {
  const exact = ["package.json", "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "bun.lockb", "AGENTS.md"];
  const found = exact.filter((name) => existsSync(join(target, name)));
  for (const name of readdirSync(target)) {
    if (/^README(?:\.|$)/iu.test(name) && statSync(join(target, name)).isFile()) found.push(name);
  }
  return [...new Set(found)].sort();
}

function appendIntegration(target) {
  const path = join(target, "AGENTS.md");
  if (!existsSync(path)) {
    writeFileSync(path, `${integrationSentence}\n`, "utf8");
    return "created";
  }
  const bytes = readFileSync(path);
  const current = bytes.toString("utf8");
  if (current.includes(integrationSentence)) return "unchanged";
  const newline = current.includes("\r\n") ? "\r\n" : "\n";
  const separator = bytes.length === 0 || current.endsWith("\n") ? "" : newline;
  appendFileSync(path, Buffer.from(`${separator}${integrationSentence}${newline}`, "utf8"));
  return "appended";
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!existsSync(templateRoot)) fail(`template directory is missing: ${templateRoot}`, 70, options.json);
  if (!existsSync(options.target)) {
    if (!options.create) fail(`target does not exist: ${options.target}; use --create for a new repository`, 64, options.json);
    mkdirSync(options.target, { recursive: true });
  }
  if (!statSync(options.target).isDirectory()) fail(`target is not a directory: ${options.target}`, 64, options.json);

  if (options.create && !existsSync(join(options.target, ".git"))) {
    const result = spawnSync("git", ["init", options.target], { encoding: "utf8", shell: false });
    if (result.status !== 0) fail(`git init failed: ${(result.stderr || result.error?.message || "unknown error").trim()}`, 70, options.json);
  }

  const destinations = ["run.cmd", "run", "run.toml", "run.schema.json", join("scripts", "run.mjs"), join("scripts", "vendor", "toml")];
  const collisions = destinations.filter((relative) => existsSync(join(options.target, relative)));
  if (collisions.length > 0 && !options.force) fail(`run interface already exists (${collisions.join(", ")}); review it or explicitly use --force`, 64, options.json);

  const pkg = readPackageJson(options.target, options.json);
  const projectId = options.projectId ?? inferProjectId(options.target, pkg);
  if (!/^[a-z0-9][a-z0-9.-]*\/[a-z0-9][a-z0-9.-]*$/u.test(projectId)) fail(`project id must have lowercase namespace/name form: ${projectId}`, 65, options.json);
  const { actions, skipped } = inferActions(options.target, pkg);
  mkdirSync(join(options.target, "scripts"), { recursive: true });
  copyFileSync(join(templateRoot, "run.cmd"), join(options.target, "run.cmd"));
  copyFileSync(join(templateRoot, "run"), join(options.target, "run"));
  copyFileSync(join(templateRoot, "run.schema.json"), join(options.target, "run.schema.json"));
  copyFileSync(join(templateRoot, "scripts", "run.mjs"), join(options.target, "scripts", "run.mjs"));
  copyTree(join(templateRoot, "scripts", "vendor"), join(options.target, "scripts", "vendor"), options.json);
  chmodSync(join(options.target, "run"), 0o755);
  writeFileSync(join(options.target, "run.toml"), renderConfig(projectId, actions), "utf8");
  const agents = appendIntegration(options.target);
  const result = { status: "ok", target: options.target, createdRepository: options.create, project: projectId, actions: actions.map((action) => action.id), skipped, scanned: scannedInputs(options.target), agents };
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    process.stdout.write(`[aes-standardize-repo] generated run.cmd, run, run.toml, run.schema.json, scripts/run.mjs, and the vendored TOML parser\n`);
    process.stdout.write(`[aes-standardize-repo] project ${projectId}; actions: ${result.actions.join(", ")}\n`);
    for (const entry of skipped) process.stdout.write(`[aes-standardize-repo] skipped script '${entry.script}': ${entry.reason}\n`);
    process.stdout.write(`[aes-standardize-repo] AGENTS.md: ${agents}\n`);
  }
}

main();
