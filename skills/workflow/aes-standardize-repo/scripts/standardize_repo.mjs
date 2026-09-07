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
// 标准 §11/G16：主句必须 `./run`（POSIX 形态）——`.\run` 在 Git Bash 解析为 `.run`
// 直接失败（G16 实录）；Windows 形态以括注说明。幂等检测用主句子串匹配，兼容
// 旧版单行连写与 `.\run` 旧写法，避免等价行重复追加。
const integrationCore = "本仓库标准操作：`./run` 发现，`./run <id> -n` 预览，`./run <id>` 执行，`--json` 机器可读。";
const integrationSentence = `${integrationCore}\n（Windows：cmd 用 \`run\`，PowerShell 用 \`.\\run.cmd\`；POSIX 用 \`./run\`。）`;
const reserved = new Set(["list", "show", "doctor", "help", "run"]);
// 动词域的单一事实源（run standard v2/v4：serve 已退役由 dev.server/prod.server 的
// 限定词承接，prod/bench 入域）；references/action-naming.md 与 check_naming.mjs 的
// 清单由这份派生，保持三处同步。
const verbDomain = ["setup", "dev", "prod", "build", "check", "lint", "test", "gate", "dist", "bench"];
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
  if (/^(?:dev|prod)(?:\.|$)/u.test(id)) return "open";
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
    return {
      actions: [{
        id: "check",
        name: "Validate the run interface",
        desc: "语法自检：node --check scripts/run.mjs（生成器候选稿；评审时替换为有效行为契约）",
        kind: "task",
        run: ["node", "--check", "scripts/run.mjs"],
      }],
      skipped: [],
    };
  }
  const manager = packageManager(target);
  const actions = [{
    id: "setup",
    name: `安装依赖（${manager} install）`,
    desc: `生成器候选稿：${manager} install 直转发；覆盖面（root 还是含子包/测试目录多处全装）评审时按仓库事实补全`,
    kind: "task",
    run: manager === "npm" ? ["npm", "install"] : [manager, "install"],
  }];
  const skipped = [];
  const scripts = pkg.scripts && typeof pkg.scripts === "object" ? Object.keys(pkg.scripts) : [];
  // 生命周期钩子（prepare、pre*/post* 等 npm 机制约定）不是人主动命令，静默排除；
  // 其余脚本全量过一遍：正则不匹配的必须进 skipped 报告——静默丢弃会让正式动作
  // （如生产启动入口）在候选稿里无声消失（aes-agent 实测教训：start/start:desktop）。
  const reservedLifecycle = new Set(["prepare", "prepack", "postpack", "prepublish", "prepublishOnly", "preinstall", "postinstall"]);
  const lifecycleHook = (name) => reservedLifecycle.has(name) || /^(?:pre|post)[a-z]/iu.test(name);
  for (const script of [...scripts].sort()) {
    if (lifecycleHook(script)) continue;
    if (!acceptedScripts.test(script)) {
      skipped.push({ script, reason: "动词域外的脚本名（setup/dev/prod/build/check/lint/test/gate/dist/bench 之外）——按意图人工归位（如 start→prod 族、typecheck→check 族、fmt→lint 族）或确认为非仓库级操作" });
      continue;
    }
    const id = actionId(script);
    if (!id) {
      skipped.push({ script, reason: "does not map to a valid action id" });
      continue;
    }
    if (actions.some((action) => action.id === id)) {
      skipped.push({ script, reason: `collides with already-mapped id '${id}'` });
      continue;
    }
    actions.push({
      id,
      name: script,
      desc: `生成器候选稿：机械映射直转发 ${manager} run ${script}；有效行为契约（做什么/数据落哪/默认档与量级/旗标/边界）评审时补全`,
      kind: actionKind(id),
      run: [manager, "run", script],
    });
  }
  if (actions.length === 1) {
    actions.push({
      id: "check",
      name: "Validate package metadata",
      desc: "生成器候选稿：node 解析 package.json 验证元数据可读；评审时替换为有效行为契约",
      kind: "task",
      run: ["node", "-e", "JSON.parse(require('node:fs').readFileSync('package.json','utf8'))"],
    });
  }
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
    "# run standard v4 — desc=有效行为契约（必填：做什么/数据落哪/默认档与量级/旗标/边界，`run show <id>` 可读）；",
    "# id 遵循动词域命名规范；扩展动词域必须在此登记。",
    `# 动词域：${verbDomain.join(" ")}`,
    "",
  ].join("\n");
  const blocks = [`[project]\nid = ${tomlString(projectId)}`];
  for (const action of actions) {
    blocks.push(`[[actions]]\nid = ${tomlString(action.id)}\nname = ${tomlString(action.name)}\ndesc = ${tomlString(action.desc)}\nkind = ${tomlString(action.kind)}\nrun = ${tomlString(action.run)}`);
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
  const legacyCore = integrationCore.replaceAll("./run", ".\\run");
  if (current.includes(integrationCore) || current.includes(legacyCore)) return "unchanged";
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

  const destinations = ["run.cmd", "run", "run.toml", "run.schema.json", join("scripts", "run.mjs"), join("scripts", "run", "lib"), join("scripts", "vendor", "toml")];
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
  copyTree(join(templateRoot, "scripts", "run", "lib"), join(options.target, "scripts", "run", "lib"), options.json);
  copyTree(join(templateRoot, "scripts", "vendor"), join(options.target, "scripts", "vendor"), options.json);
  chmodSync(join(options.target, "run"), 0o755);
  writeFileSync(join(options.target, "run.toml"), renderConfig(projectId, actions), "utf8");
  const agents = appendIntegration(options.target);
  const result = { status: "ok", target: options.target, createdRepository: options.create, project: projectId, actions: actions.map((action) => action.id), skipped, scanned: scannedInputs(options.target), agents };
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    process.stdout.write(`[aes-standardize-repo] generated run.cmd, run, run.toml, run.schema.json, scripts/run.mjs, scripts/run/lib (node gate), and the vendored TOML parser\n`);
    process.stdout.write(`[aes-standardize-repo] project ${projectId}; actions: ${result.actions.join(", ")}\n`);
    for (const entry of skipped) process.stdout.write(`[aes-standardize-repo] skipped script '${entry.script}': ${entry.reason}\n`);
    process.stdout.write(`[aes-standardize-repo] AGENTS.md: ${agents}\n`);
  }
}

main();
