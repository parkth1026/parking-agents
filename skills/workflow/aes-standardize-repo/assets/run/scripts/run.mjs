#!/usr/bin/env node

import { spawn } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { REQUIRED_NODE_RANGE, nodeSatisfies } from "./run/lib/node-version.mjs";
import { TEST_TMP_ROOT_VAR, resolveRoutedRoot } from "./run/lib/tmp-root.mjs";

const require = createRequire(import.meta.url);
const toml = require("./vendor/toml/index.cjs");

const RUNNER_VERSION = "1.3.0";
const SCHEMA = "run/v2";
const RESERVED = new Set(["list", "show", "doctor", "help", "run"]);
const KINDS = new Set(["task", "open", "test", "gate"]);
const EXIT = Object.freeze({ OK: 0, USAGE: 64, CONFIG: 65, UNAVAILABLE: 69, INTERNAL: 70 });
const root = dirname(dirname(fileURLToPath(import.meta.url)));

class RunError extends Error {
  constructor(message, exitCode, details = undefined) {
    super(message);
    this.exitCode = exitCode;
    this.details = details;
  }
}

function parseConfig(text) {
  let document;
  try {
    document = toml.parse(text);
  } catch (error) {
    const line = Number.isInteger(error?.line) ? error.line : error?.location?.start?.line;
    const column = Number.isInteger(error?.column) ? error.column : error?.location?.start?.column;
    const location = Number.isInteger(line)
      ? ` line ${line}${Number.isInteger(column) ? `, column ${column}` : ""}`
      : "";
    throw new RunError(`run.toml${location}: ${error instanceof Error ? error.message : String(error)}`, EXIT.CONFIG);
  }

  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new RunError("run.toml must contain [project] and [[actions]] tables", EXIT.CONFIG);
  }
  const unsupported = Object.keys(document).filter((key) => key !== "project" && key !== "actions");
  if (unsupported.length > 0) throw new RunError(`run.toml has unsupported top-level keys: ${unsupported.join(", ")}`, EXIT.CONFIG);
  const project = document.project;
  const parsedActions = document.actions;
  if (!Array.isArray(parsedActions)) throw new RunError("run.toml must define [[actions]] entries", EXIT.CONFIG);
  const actions = parsedActions;
  validateConfig(project, actions);
  return { project, actions };
}

function validateConfig(project, actions) {
  if (!project || typeof project !== "object" || Array.isArray(project) || typeof project.id !== "string" || !/^[a-z0-9][a-z0-9.-]*\/[a-z0-9][a-z0-9.-]*$/u.test(project.id)) {
    throw new RunError("run.toml [project].id must have namespace/name form", EXIT.CONFIG);
  }
  if (Object.keys(project).sort().join(",") !== "id") throw new RunError("run.toml [project] supports only the id field", EXIT.CONFIG);
  if (actions.length === 0) throw new RunError("run.toml must define at least one [[actions]] entry", EXIT.CONFIG);

  const ids = new Set();
  for (const action of actions) {
    if (!action || typeof action !== "object" || Array.isArray(action) || Object.keys(action).sort().join(",") !== "desc,id,kind,name,run") {
      throw new RunError("each [[actions]] entry must contain exactly id, name, desc, kind, and run", EXIT.CONFIG);
    }
    // 规范 §3.1：段内连字符不得开头/结尾/连续。逐段校验而非整串正则，
    // 否则 `a-.b` 这类段尾连字符会从整串检查的眼皮底下漏过。
    if (typeof action.id !== "string" || !action.id.split(".").every((segment) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(segment))) {
      throw new RunError(`invalid action id '${String(action.id)}': use lowercase dot-separated tokens`, EXIT.CONFIG);
    }
    // 规范 §2.1：保留字不得用作动作 id，含扩展前缀形式（x.run 之类）。
    const segments = action.id.split(".");
    if (RESERVED.has(action.id) || (segments[0] === "x" && RESERVED.has(segments[1] ?? ""))) {
      throw new RunError(`action id '${action.id}' is reserved`, EXIT.CONFIG);
    }
    if (ids.has(action.id)) throw new RunError(`duplicate action id '${action.id}'`, EXIT.CONFIG);
    ids.add(action.id);
    if (typeof action.name !== "string" || action.name.trim() === "") throw new RunError(`action '${action.id}' must have a non-empty name`, EXIT.CONFIG);
    // 标准 v4：desc 是有效行为契约（数据空间/默认档/旗标/边界），必填——
    // 没有它，目录声明面与脚本行为面必然分叉（参照实现 G6/G19 教训）。
    if (typeof action.desc !== "string" || action.desc.trim() === "") throw new RunError(`action '${action.id}' must have a non-empty desc`, EXIT.CONFIG);
    if (typeof action.kind !== "string" || !KINDS.has(action.kind)) {
      throw new RunError(`action '${action.id}' has unsupported kind '${String(action.kind)}'`, EXIT.CONFIG);
    }
    if (!Array.isArray(action.run) || action.run.length === 0 || !action.run.every((part) => typeof part === "string" && part.length > 0)) {
      throw new RunError(`action '${action.id}' run must be a non-empty argv array`, EXIT.CONFIG);
    }
  }
}

function loadConfig() {
  const path = join(root, "run.toml");
  if (!existsSync(path)) throw new RunError("this repository has not adopted the run standard: run.toml is missing", EXIT.CONFIG);
  return parseConfig(readFileSync(path, "utf8"));
}

function executableCandidates(command) {
  if (command.toLowerCase() === "node") return [process.execPath];
  if (isAbsolute(command) || command.includes("/") || command.includes("\\")) return [resolve(root, command)];
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
    : [""];
  const hasExtension = process.platform === "win32" && extensions.some((extension) => command.toLowerCase().endsWith(extension.toLowerCase()));
  const names = hasExtension ? [command] : extensions.map((extension) => `${command}${extension.toLowerCase()}`);
  return (process.env.PATH ?? "").split(delimiter).filter(Boolean).flatMap((directory) => names.map((name) => join(directory, name)));
}

function commandAvailable(command) {
  for (const candidate of executableCandidates(command)) {
    try {
      accessSync(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK);
      return true;
    } catch {
      // Continue searching PATH.
    }
  }
  return false;
}

function decorateAction(action) {
  return { ...action, available: commandAvailable(action.run[0]) };
}

function quoteForCmd(part) {
  return /[\s"]/.test(part) ? `"${part.replace(/"/gu, '\\"')}"` : part;
}

// Windows 上 npm/npx 实为 .cmd 脚本，而 Node 18.20+/20.12+ 禁止无 shell 直接 spawn
// .cmd/.bat（CVE-2024-27980），于是 doctor 报可用、执行却失败。与 cross-spawn 同法：
// 仅当解析到的可执行文件确实是 .cmd/.bat 时经 cmd.exe 中转，argv 语义不变。
// 引号策略：必须 windowsVerbatimArguments + 整体再包一层引号——node 默认转义会把内层 "
// 变 \"（cmd /s 剥层后成垃圾 token），而 /s 的剥首去末语义恰好把内层引号留给含空格的
// 可执行路径（C:\Program Files\...）。含空格 npm.cmd 路径实测 2026-09-04。
function resolveSpawnTarget(argv) {
  if (process.platform !== "win32") return { file: argv[0], args: argv.slice(1), verbatim: false };
  const resolved = executableCandidates(argv[0]).find((candidate) => {
    try {
      accessSync(candidate, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  });
  if (resolved && /\.(cmd|bat)$/iu.test(resolved)) {
    return { file: "cmd.exe", args: ["/d", "/s", "/c", `"${argv.map(quoteForCmd).join(" ")}"`], verbatim: true };
  }
  return { file: resolved ?? argv[0], args: argv.slice(1), verbatim: false };
}

function parseCli(argv) {
  let json = false;
  let dryRun = false;
  const positional = [];
  for (const argument of argv) {
    const normalized = argument.toLowerCase();
    if (normalized === "--json") json = true;
    else if (normalized === "-n" || normalized === "--dry-run") dryRun = true;
    else if (argument.startsWith("-")) throw new RunError(`unknown option '${argument}'`, EXIT.USAGE);
    else positional.push(argument);
  }
  return { json, dryRun, positional };
}

function writeJson(payload) {
  process.stdout.write(`${JSON.stringify({ schema: SCHEMA, ...payload })}\n`);
}

function commandText(argv) {
  return argv.map((part) => (/^[a-z0-9_./:=+-]+$/iu.test(part) ? part : JSON.stringify(part))).join(" ");
}

function actionPayload(action) {
  return { id: action.id, name: action.name, desc: action.desc, kind: action.kind, run: action.run, available: action.available };
}

function listActions(config, asJson) {
  const actions = config.actions.map(decorateAction);
  if (asJson) {
    writeJson({ command: "list", status: "ok", exitCode: EXIT.OK, project: config.project.id, actions: actions.map(actionPayload) });
    return;
  }
  process.stdout.write(`\n  ${config.project.id} — ${actions.length} actions\n\n`);
  const width = Math.max(2, ...actions.map((action) => action.id.length));
  for (const action of actions) {
    const unavailable = action.available ? "" : "  [unavailable]";
    process.stdout.write(`  ${action.id.padEnd(width)}  ${action.kind.padEnd(5)}  ${action.name}  → ${commandText(action.run)}${unavailable}\n`);
  }
  process.stdout.write("\n");
}

// Levenshtein 编辑距离（两行 DP）。候选集只有几十个 id，O(len²) 足够。
function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length];
}

// 未知 id 的最近匹配建议（did-you-mean；标准 §2.3「错误信息必须引导发现」的加强实现）。
// 四层规则，宁缺毋滥——乱建议比不建议更糟：
//   ① 唯一前缀层：输入（小写化）是恰好一个动作 id 的前缀 → 建议该 id
//      （唯一前缀是比单字符编辑更强的意图信号，且接住 "dev"→"dev.desktop" 这类
//      省限定词的肌肉记忆——编辑距离 8，纯 Levenshtein 接不住）。
//   ② 家族前缀层：输入恰是多段 id 的完整前缀段（如 "test" 对 test.*）→ 不猜单条、
//      报全家族成员。用户意图是家族；让编辑距离猜出 "test"→"dist" 这类跨动词近邻
//      是语义乱建议。
//   ③ 动词近邻层：输入是某动词（id 首段）的 1 编辑近邻（如 "tist"→"test"）——
//      用户敲的是打歪的动词，意图是动词族：动词自身是 id（"gat"→"gate"）则精确
//      建议，否则报动词族（族内仅一条时等价精确建议）。同时等距命中多个动词
//      （"tist" 对 test/dist）属动词型噪声——放弃建议并抑制编辑距离层，宁缺毋滥。
//   ④ 编辑距离层：Levenshtein 距离最近候选且 ≤ 阈值才建议；短输入（≤4 字符）阈值
//      收严到 1——距离 2 的跨动词近邻比不建议更糟。
function suggestAction(actions, requested) {
  const target = requested.toLowerCase();
  const ids = actions.map((action) => action.id);
  const prefixMatches = ids.filter((id) => id.startsWith(target));
  if (prefixMatches.length === 1) return { id: prefixMatches[0] };
  if (prefixMatches.length > 1 && prefixMatches.every((id) => id.charAt(target.length) === ".")) {
    return { family: prefixMatches };
  }
  const verbs = [...new Set(ids.map((id) => id.split(".")[0]))];
  const nearVerbs = verbs.filter((verb) => editDistance(target, verb) <= 1);
  if (nearVerbs.length > 1) return null;
  if (nearVerbs.length === 1) {
    const family = ids.filter((id) => id.split(".")[0] === nearVerbs[0]);
    if (ids.includes(nearVerbs[0]) || family.length === 1) {
      return { id: ids.includes(nearVerbs[0]) ? nearVerbs[0] : family[0] };
    }
    return { family };
  }
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const id of ids) {
    const distance = editDistance(target, id);
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  const threshold = target.length <= 4 ? 1 : Math.max(2, Math.floor(target.length / 3));
  return bestDistance <= threshold ? { id: best } : null;
}

function findAction(config, requested) {
  const action = config.actions.find((candidate) => candidate.id === requested.toLowerCase());
  if (!action) {
    const suggestion = suggestAction(config.actions, requested);
    const details = { action: requested };
    let hint = "";
    if (suggestion?.id) {
      hint = ` — did you mean '${suggestion.id}'?`;
      details.suggestion = suggestion.id;
    } else if (suggestion?.family) {
      hint = ` — ${suggestion.family.length} actions start with '${requested}': ${suggestion.family.join(", ")}`;
      details.family = suggestion.family;
    }
    throw new RunError(`this repository does not define action '${requested}'${hint} (use run to list actions)`, EXIT.USAGE, details);
  }
  return decorateAction(action);
}

function showAction(config, requested, asJson) {
  const action = findAction(config, requested);
  if (asJson) {
    writeJson({ command: "show", status: "ok", exitCode: EXIT.OK, project: config.project.id, action: actionPayload(action) });
    return;
  }
  process.stdout.write(`${action.id} — ${action.name}\ndesc: ${action.desc}\nkind: ${action.kind}\nrun:  ${commandText(action.run)}\navailable: ${action.available ? "yes" : "no"}\n`);
}

function wrapperVersion(path) {
  if (!existsSync(path)) return null;
  return /run-wrapper-version:\s*([^\s]+)/u.exec(readFileSync(path, "utf8"))?.[1] ?? null;
}

function runDoctor(config, asJson) {
  const wrapperVersions = { cmd: wrapperVersion(join(root, "run.cmd")), sh: wrapperVersion(join(root, "run")) };
  const wrapperOk = wrapperVersions.cmd === RUNNER_VERSION && wrapperVersions.sh === RUNNER_VERSION;
  const tools = [...new Set(config.actions.map((action) => action.run[0].toLowerCase()))].map((command) => ({ command, available: commandAvailable(command) }));
  const nonGateMissing = config.actions.filter((action) => action.kind !== "gate" && !commandAvailable(action.run[0])).map((action) => action.id);
  const gateActions = config.actions.filter((action) => action.kind === "gate");
  const nodeOk = nodeSatisfies(process.version);
  const checks = {
    wrapper: { ok: wrapperOk, runnerVersion: RUNNER_VERSION, versions: wrapperVersions },
    config: { ok: true, actions: config.actions.length },
    node: { ok: nodeOk, version: process.version, required: REQUIRED_NODE_RANGE },
    tools,
    gate: { available: gateActions.every((action) => commandAvailable(action.run[0])), actions: gateActions.map((action) => action.id) },
  };
  const exitCode = wrapperOk && nodeOk && nonGateMissing.length === 0 ? EXIT.OK : EXIT.UNAVAILABLE;
  if (asJson) {
    writeJson({ command: "doctor", status: exitCode === 0 ? "ok" : "error", origin: exitCode === 0 ? undefined : "run", exitCode, project: config.project.id, checks });
  } else {
    process.stdout.write(`[run] wrapper: ${wrapperOk ? `ok (version ${RUNNER_VERSION})` : "error (version mismatch or missing wrapper)"}\n`);
    process.stdout.write(`[run] run.toml: ok (${config.actions.length} actions, no reserved-word conflict)\n`);
    process.stdout.write(`[run] node:     ${nodeOk ? `ok (${process.version})` : `too old (${process.version}, need ${REQUIRED_NODE_RANGE})`}\n`);
    for (const tool of tools.filter((item) => item.command !== "gate")) {
      process.stdout.write(`${(`[run] ${tool.command}:`).padEnd(16)}${tool.available ? "ok" : "unavailable"}\n`);
    }
    process.stdout.write(`[run] gate:     ${checks.gate.available ? "ok" : `unavailable (${checks.gate.actions.join(", ") || "no gate actions"})`}\n`);
  }
  return exitCode;
}

function printHelp(asJson) {
  const usage = "run [list | show <id> | doctor | help | run <id> | <id>] [-n|--dry-run] [--json]";
  if (asJson) writeJson({ command: "help", status: "ok", exitCode: EXIT.OK, usage, reserved: [...RESERVED] });
  else process.stdout.write(`${usage}\n\nBare run lists actions. Use -n to preview and --json for machine output.\n`);
}

async function executeAction(config, requested, dryRun, asJson) {
  const action = findAction(config, requested);
  const plan = { action: actionPayload(action), argv: action.run, cwd: root, dryRun, executed: !dryRun };
  if (dryRun) {
    if (asJson) writeJson({ command: "execute", status: "preview", origin: "run", exitCode: EXIT.OK, project: config.project.id, ...plan });
    else process.stderr.write(`[run] plan: ${commandText(action.run)}\n[run] cwd:  ${root}\n[run] dry run: no command was executed\n`);
    return EXIT.OK;
  }
  // 版本门（run-standard 9.5）：与 wrapper 的存在性检查分层——存在性在 sh/cmd 层
  // （无 Node 时够不到这里），达标性在这里。文案只指路 nodejs.org 的 LTS，
  // 精确 range 留给机器面（details.required）——人面不灌输 semver。
  if (!nodeSatisfies(process.version)) {
    throw new RunError(
      `Node ${process.version} 过老，本项目跑不动——请到 https://nodejs.org 重装（下载页默认 LTS 即可），装完重开终端再试`,
      EXIT.UNAVAILABLE,
      { action: action.id, node: process.version, required: REQUIRED_NODE_RANGE },
    );
  }
  if (!action.available) throw new RunError(`action '${action.id}' is unavailable because '${action.run[0]}' was not found`, EXIT.UNAVAILABLE, { action: action.id, executable: action.run[0] });

  // TEST_TMP_ROOT 临时落点路由（run-standard §9.7）：动作执行前解析——已设且有效
  // → 注入子进程 TMP/TEMP + stderr 路由行；未设 → 回退提示行（零配置仅多一行提示，
  // 子进程走机器默认 tmp，行为同无此层）；漂移（已设但不可建/不可写）→ 漂移告警行
  // 已由上方 warnings 循环打印，此处不再打「not set」（与 AntHub run 层同形态——
  // 变量明明设了不能说它没设）。诊断信息一律 stderr（§7.1 stdout 纯净），
  // --json 模式下路由行同样只落 stderr。
  const tmpRoute = resolveRoutedRoot({ variable: TEST_TMP_ROOT_VAR });
  for (const warning of tmpRoute.warnings) process.stderr.write(`${warning}\n`);
  let childEnv = process.env;
  if (tmpRoute.source === "variable") {
    childEnv = { ...process.env, TMP: tmpRoute.root, TEMP: tmpRoute.root };
    process.stderr.write(`[tmp-route] ${TEST_TMP_ROOT_VAR}=${tmpRoute.root} → 注入子进程 TMP/TEMP\n`);
  } else if (tmpRoute.variableValue === null) {
    process.stderr.write(`[tmp-route] ${TEST_TMP_ROOT_VAR} not set → 不注入，子进程回退 os.tmpdir() = ${tmpRoute.root}\n`);
  }

  if (!asJson) process.stderr.write(`[run] ${action.id} -> ${commandText(action.run)}\n`);
  const target = resolveSpawnTarget(action.run);
  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(target.file, target.args, { cwd: root, env: childEnv, shell: false, stdio: asJson ? ["inherit", "pipe", "pipe"] : "inherit", windowsVerbatimArguments: target.verbatim });
    if (asJson) {
      child.stdout.on("data", (chunk) => process.stderr.write(chunk));
      child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    }
    child.once("error", (error) => reject(new RunError(`failed to start '${action.run[0]}': ${error.message}`, EXIT.UNAVAILABLE, { action: action.id, executable: action.run[0] })));
    child.once("exit", (code, signal) => {
      if (signal) reject(new RunError(`action '${action.id}' ended by signal ${signal}`, EXIT.INTERNAL, { action: action.id, signal }));
      else resolveExit(code ?? EXIT.INTERNAL);
    });
  });
  if (asJson) writeJson({ command: "execute", status: exitCode === 0 ? "success" : "failed", origin: "child", exitCode, project: config.project.id, ...plan });
  else process.stderr.write(`[run] ${action.id} ${exitCode === 0 ? "completed" : "failed"}, exit code ${exitCode}\n`);
  return exitCode;
}

async function main() {
  let parsed;
  try {
    parsed = parseCli(process.argv.slice(2));
    const config = loadConfig();
    const words = parsed.positional;
    if (words.length === 0 || words[0].toLowerCase() === "list") {
      if (words.length > 1) throw new RunError("list does not accept positional arguments", EXIT.USAGE);
      listActions(config, parsed.json);
      return EXIT.OK;
    }
    const command = words[0].toLowerCase();
    if (command === "help") {
      if (words.length > 1) throw new RunError("help does not accept positional arguments", EXIT.USAGE);
      printHelp(parsed.json);
      return EXIT.OK;
    }
    if (command === "doctor") {
      if (words.length > 1) throw new RunError("doctor does not accept positional arguments", EXIT.USAGE);
      return runDoctor(config, parsed.json);
    }
    if (command === "show") {
      if (words.length !== 2) throw new RunError("show requires exactly one action id", EXIT.USAGE);
      showAction(config, words[1], parsed.json);
      return EXIT.OK;
    }
    if (command === "run") {
      if (words.length === 1) {
        listActions(config, parsed.json);
        return EXIT.OK;
      }
      if (words.length !== 2) throw new RunError("run requires exactly one action id", EXIT.USAGE);
      return await executeAction(config, words[1], parsed.dryRun, parsed.json);
    }
    if (words.length !== 1) throw new RunError("actions do not accept positional arguments", EXIT.USAGE);
    return await executeAction(config, words[0], parsed.dryRun, parsed.json);
  } catch (error) {
    const runError = error instanceof RunError ? error : new RunError(error instanceof Error ? error.message : String(error), EXIT.INTERNAL);
    const asJson = parsed?.json ?? process.argv.slice(2).some((argument) => argument.toLowerCase() === "--json");
    if (asJson) writeJson({ command: "error", status: "error", origin: "run", exitCode: runError.exitCode, error: { message: runError.message, details: runError.details } });
    else process.stderr.write(`[run] error: ${runError.message}\n`);
    return runError.exitCode;
  }
}

process.exitCode = await main();
