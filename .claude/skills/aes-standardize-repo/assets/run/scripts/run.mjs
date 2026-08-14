#!/usr/bin/env node

import { spawn } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const toml = require("./vendor/toml/index.cjs");

const RUNNER_VERSION = "1.0.0";
const SCHEMA = "run/v1";
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
    if (!action || typeof action !== "object" || Array.isArray(action) || Object.keys(action).sort().join(",") !== "id,kind,name,run") {
      throw new RunError("each [[actions]] entry must contain exactly id, name, kind, and run", EXIT.CONFIG);
    }
    if (typeof action.id !== "string" || !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/u.test(action.id)) {
      throw new RunError(`invalid action id '${String(action.id)}': use lowercase dot-separated tokens`, EXIT.CONFIG);
    }
    if (RESERVED.has(action.id)) throw new RunError(`action id '${action.id}' is reserved`, EXIT.CONFIG);
    if (ids.has(action.id)) throw new RunError(`duplicate action id '${action.id}'`, EXIT.CONFIG);
    ids.add(action.id);
    if (typeof action.name !== "string" || action.name.trim() === "") throw new RunError(`action '${action.id}' must have a non-empty name`, EXIT.CONFIG);
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
  return { id: action.id, name: action.name, kind: action.kind, run: action.run, available: action.available };
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

function findAction(config, requested) {
  const action = config.actions.find((candidate) => candidate.id === requested.toLowerCase());
  if (!action) throw new RunError(`this repository does not define action '${requested}' (use run to list actions)`, EXIT.USAGE, { action: requested });
  return decorateAction(action);
}

function showAction(config, requested, asJson) {
  const action = findAction(config, requested);
  if (asJson) {
    writeJson({ command: "show", status: "ok", exitCode: EXIT.OK, project: config.project.id, action: actionPayload(action) });
    return;
  }
  process.stdout.write(`${action.id} — ${action.name}\nkind: ${action.kind}\nrun:  ${commandText(action.run)}\navailable: ${action.available ? "yes" : "no"}\n`);
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
  const checks = {
    wrapper: { ok: wrapperOk, runnerVersion: RUNNER_VERSION, versions: wrapperVersions },
    config: { ok: true, actions: config.actions.length },
    node: { ok: true, version: process.version },
    tools,
    gate: { available: gateActions.every((action) => commandAvailable(action.run[0])), actions: gateActions.map((action) => action.id) },
  };
  const exitCode = wrapperOk && nonGateMissing.length === 0 ? EXIT.OK : EXIT.UNAVAILABLE;
  if (asJson) {
    writeJson({ command: "doctor", status: exitCode === 0 ? "ok" : "error", origin: exitCode === 0 ? undefined : "run", exitCode, project: config.project.id, checks });
  } else {
    process.stdout.write(`[run] wrapper: ${wrapperOk ? `ok (version ${RUNNER_VERSION})` : "error (version mismatch or missing wrapper)"}\n`);
    process.stdout.write(`[run] run.toml: ok (${config.actions.length} actions, no reserved-word conflict)\n`);
    process.stdout.write(`[run] node:     ok (${process.version})\n`);
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
  if (!action.available) throw new RunError(`action '${action.id}' is unavailable because '${action.run[0]}' was not found`, EXIT.UNAVAILABLE, { action: action.id, executable: action.run[0] });

  if (!asJson) process.stderr.write(`[run] ${action.id} -> ${commandText(action.run)}\n`);
  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(action.run[0], action.run.slice(1), { cwd: root, env: process.env, shell: false, stdio: asJson ? ["inherit", "pipe", "pipe"] : "inherit" });
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
