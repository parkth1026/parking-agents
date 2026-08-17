#!/usr/bin/env node
// 命名一致性校验器。run.schema.json 管结构（id 格式、kind 枚举、argv 形状），
// 本脚本管"义"：动词域归属、保留字、dev/prod 矛盾前缀、与 package.json 的机械
// 映射一致性，并输出各动词族的限定词清单——维度一致性是语义判断，机器把族内
// 限定词摆出来供人工核对，只对已知的混合迹象（族内环境词与其他词混用）告警。

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const verbDomain = ["setup", "dev", "start", "serve", "preview", "build", "dist", "check", "lint", "typecheck", "test", "gate"];
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

    if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/u.test(id)) findings.push({ level: "error", id, message: "id 不是合法的小写点分词" });
    if (reserved.has(id)) findings.push({ level: "error", id, message: "id 是保留字" });
    if (seen.has(id)) findings.push({ level: "error", id, message: "id 重复" });
    seen.add(id);

    if (!verbDomain.includes(verb) && !raw.includes(verb)) {
      findings.push({ level: "error", id, message: `动词 '${verb}' 不在封闭动词域，且未在 run.toml 注释里登记为扩展` });
    }
    if (verb === "dev" && qualifiers.some((token) => productionTokens.has(token))) {
      findings.push({ level: "error", id, message: "dev 族出现生产限定词：dev 声明开发场景，生产形态属于 serve.prod" });
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
  const result = { schema: "run/v1", repo: options.repo, families: Object.fromEntries([...families].map(([verb, q]) => [verb, q])), findings, errors: errors.length };
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
