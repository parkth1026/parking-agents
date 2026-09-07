#!/usr/bin/env node
// 命名一致性校验器。run.schema.json 管结构（id 格式、kind 枚举、argv 形状），
// 本脚本管"义"：动词域归属、保留字、dev/prod 矛盾前缀、与 package.json 的机械
// 映射一致性，并输出各动词族的限定词清单——维度一致性是语义判断，机器把族内
// 限定词摆出来供人工核对，只对已知的混合迹象（族内环境词与其他词混用）告警。

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 与 standardize_repo.mjs 的动词域同源（run standard v2/v4：serve 退役、prod/bench 入域）。
const verbDomain = ["setup", "dev", "prod", "build", "check", "lint", "test", "gate", "dist", "bench"];
// R2（run-standard §4 限定词治理）：形态限定词封闭五词，仅约束 dev.*/prod.* 族的形态位；
// test.regression、bench.download-workers 的限定词是专题词，不受此域约束。新形态词
// 须在 run.toml 头注释登记（与动词域扩展同构），未登记即报错。
const formQualifiers = new Set(["desktop", "cli", "web", "mobile", "server"]);
const reserved = new Set(["list", "show", "doctor", "help", "run"]);
const productionTokens = new Set(["prod", "production"]);
// 常见实现技术名词黑名单（不可能穷举，抓高频即可）：id 是产品目录不是技术目录，
// 技术栈会迁移而产品形态不会；命中即 warn，确认该词确属产品级词汇后可忽略。
const techNouns = new Set(["tauri", "electron", "vite", "webpack", "rollup", "esbuild", "npm", "yarn", "pnpm", "bun", "cargo", "rust", "dotnet", "csharp", "node", "deno", "java", "python", "golang", "wasm"]);

function fail(message, code) {
  process.stderr.write(`[check-naming] error: ${message}\n`);
  process.exit(code);
}

function parseArguments(argv) {
  const options = { json: false, repo: null };
  for (const argument of argv) {
    if (argument.toLowerCase() === "--json") options.json = true;
    else if (argument.startsWith("-")) fail(`unknown option '${argument}'`, 64);
    else if (options.repo === null) options.repo = argument;
    else fail("expected exactly one repository path", 64);
  }
  if (!options.repo) fail("usage: check_naming.mjs <repo> [--json]", 64);
  options.repo = resolve(options.repo);
  return options;
}

function mechanicalId(script) {
  return script.toLowerCase().replaceAll(":", ".").replaceAll("-", ".");
}

// 登记检测只认注释行（^# 开头）：id 行自身必然含该词，用全文 includes 检测登记
// 会恒真通过，校验形同虚设——登记必须显式写在头注释里才算数。
function registeredInComments(word, raw) {
  return new RegExp(`^#.*\\b${word}\\b`, "mu").test(raw);
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const tomlPath = join(options.repo, "run.toml");
  const runnerPath = join(options.repo, "scripts", "run.mjs");
  if (!existsSync(tomlPath)) fail(`run.toml not found: ${tomlPath}`, 65);
  if (!existsSync(runnerPath)) fail(`scripts/run.mjs not found: ${runnerPath}`, 65);

  const raw = readFileSync(tomlPath, "utf8");
  let document;
  try {
    const requireFromRepo = createRequire(runnerPath);
    const toml = requireFromRepo("./vendor/toml/index.cjs");
    document = toml.parse(raw);
  } catch (error) {
    fail(`cannot parse run.toml: ${error instanceof Error ? error.message : String(error)}`, 65);
  }

  const pkgPath = join(options.repo, "package.json");
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, "utf8")) : null;
  const scripts = pkg?.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};

  const findings = [];
  const families = new Map();
  const seen = new Set();
  for (const action of document.actions ?? []) {
    const id = String(action.id ?? "");
    const segments = id.split(".");
    const verb = segments[0];
    const qualifiers = segments.slice(1);

    // 与 runner 同款逐段校验（规范 §3.1：段内连字符不得开头/结尾/连续）。
    if (!id.split(".").every((segment) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(segment))) findings.push({ level: "error", id, message: "id 不是合法的小写点分词（段内连字符不得开头/结尾/连续）" });
    if (reserved.has(id) || (segments[0] === "x" && reserved.has(segments[1] ?? ""))) findings.push({ level: "error", id, message: "id 是保留字（含 x.<保留字> 扩展形式）" });
    if (seen.has(id)) findings.push({ level: "error", id, message: "id 重复" });
    seen.add(id);

    if (!verbDomain.includes(verb) && !registeredInComments(verb, raw)) {
      findings.push({ level: "error", id, message: `动词 '${verb}' 不在封闭动词域，且未在 run.toml 注释里登记为扩展` });
    }
    if (verb === "dev" && qualifiers.some((token) => productionTokens.has(token))) {
      findings.push({ level: "error", id, message: "dev 族出现生产限定词：dev 声明开发场景，生产形态属于 prod 族（v2 起 动词=意图环境 dev/prod，限定词=形态）" });
    }
    if ((verb === "dev" || verb === "prod") && qualifiers.length > 0 && !formQualifiers.has(qualifiers[0]) && !registeredInComments(qualifiers[0], raw)) {
      findings.push({ level: "error", id, message: `形态限定词 '${qualifiers[0]}' 不在封闭五词（desktop/cli/web/mobile/server），且未在 run.toml 注释登记（R2，run-standard §4 限定词治理）` });
    }
    const techHit = qualifiers.find((token) => techNouns.has(token));
    if (techHit) {
      findings.push({ level: "warn", id, message: `限定词 '${techHit}' 是实现技术名词：id 只用产品级词汇（web/desktop/mobile/server 等形态、dev/prod 等环境），技术细节放 name` });
    }

    const run = Array.isArray(action.run) ? action.run : [];
    const isScriptCall = run.length === 3 && run[1] === "run" && typeof run[2] === "string";
    if (isScriptCall) {
      const script = run[2];
      if (!(script in scripts)) findings.push({ level: "error", id, message: `argv 指向的脚本 '${script}' 不在 package.json 里` });
      else if (mechanicalId(script) !== id) findings.push({ level: "warn", id, message: `与机械映射 '${mechanicalId(script)}' 不一致（人工改名需确认语义必要）` });
    }

    if (!families.has(verb)) families.set(verb, []);
    families.get(verb).push(qualifiers.join(".") || "(bare)");
  }

  for (const [verb, qualifiers] of families) {
    if (qualifiers.some((token) => productionTokens.has(token) || token === "dev") && qualifiers.length > 1) {
      const envLike = qualifiers.filter((token) => token === "dev" || productionTokens.has(token)).length;
      if (envLike > 0 && envLike < qualifiers.length) {
        findings.push({ level: "warn", id: `${verb}.*`, message: `族内限定词疑似混维度（环境词与其他词并存）：${qualifiers.join(", ")}——同族限定词应编码同一维度` });
      }
    }
  }

  const errors = findings.filter((finding) => finding.level === "error");
  const result = { schema: "run/v2", repo: options.repo, families: Object.fromEntries([...families].map(([verb, q]) => [verb, q])), findings, errors: errors.length };
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    process.stdout.write(`\n  ${options.repo} — 动词族与限定词\n\n`);
    for (const [verb, qualifiers] of families) process.stdout.write(`  ${verb.padEnd(10)} ${qualifiers.join(" | ")}\n`);
    process.stdout.write("\n");
    for (const finding of findings) process.stdout.write(`  [${finding.level}]  ${finding.id}: ${finding.message}\n`);
    if (findings.length === 0) process.stdout.write("  no findings\n");
  }
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
