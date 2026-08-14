#!/usr/bin/env node
// aggregate-benchmark.mjs — 输出评测聚合（官方 aggregate_benchmark.py 口径移植，数据按 v2 契约）
// 扫描 <iter-dir>/eval-*/<config>/run-*/{grading.json, timing.json}（eval 目录也可在 runs/ 下），
// 输出 benchmark.json（configs 统计 + delta）与 benchmark.md。
// 统计口径: pass_rate/time_ms/tokens 的 mean/stddev(样本 n-1)/min/max；delta = with − baseline。
// timing 数值为 null 时跳过该 run 对应统计并计入 skipped，不报错。
// 用法: node aggregate-benchmark.mjs <iter-dir> [--skill-name <名>] [--output <benchmark.json 路径>]
// 退出码: 0 成功 / 1 无数据或目录不存在 / 2 用法错
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";
import { readJson, writeJson, writeText } from "./lib/jsonio.mjs";
import { calcStats, round4 } from "./lib/stats.mjs";

function usage() {
  console.log("用法: node aggregate-benchmark.mjs <iteration目录> [--skill-name <名>] [--output <路径>]");
  console.log("示例: node aggregate-benchmark.mjs ../my-skill-workspace/iteration-1");
  process.exit(2);
}

/** 单个 run 的度量：pass_rate 来自 grading.results[].passed；time/tokens 来自 timing.json（null 跳过） */
function loadRunMetrics(runDir, warnings) {
  const grading = readJson(join(runDir, "grading.json"));
  if (!grading) {
    warnings.push(`grading.json 缺失或不可解析: ${runDir}`);
    return null;
  }
  const results = Array.isArray(grading.results) ? grading.results : [];
  const passed = results.filter((r) => r && r.passed === true).length;
  const total = results.length;
  const passRate = total > 0 ? passed / total : 0.0;

  const timing = readJson(join(runDir, "timing.json")) || {};
  return {
    pass_rate: passRate,
    passed,
    failed: total - passed,
    total,
    time_ms: typeof timing.duration_ms === "number" ? timing.duration_ms : null,
    tokens: typeof timing.total_tokens === "number" ? timing.total_tokens : null,
  };
}

/** 扫描 iteration 目录 → { config → run 度量数组, evals: [eval目录信息] } */
export function loadIteration(iterDir, warnings = []) {
  if (!existsSync(iterDir) || !statSync(iterDir).isDirectory()) {
    return { error: `目录不存在: ${iterDir}` };
  }
  // 两种布局：eval-* 直接在 iter-dir 下，或在其 runs/ 下
  let searchDir = iterDir;
  const direct = readdirSync(iterDir).filter((n) => n.startsWith("eval-") && isDir(join(iterDir, n)));
  if (direct.length === 0) {
    const runsDir = join(iterDir, "runs");
    if (existsSync(runsDir)) searchDir = runsDir;
  }

  const evalNames = readdirSync(searchDir)
    .filter((n) => n.startsWith("eval-") && isDir(join(searchDir, n)))
    .sort();
  if (evalNames.length === 0) {
    return { error: `未发现 eval-* 目录: ${iterDir}` };
  }

  const configs = {};
  const evals = [];
  for (const evalName of evalNames) {
    const evalDir = join(searchDir, evalName);
    const metadata = readJson(join(evalDir, "eval_metadata.json")) || {};
    const evalEntry = {
      name: evalName,
      prompt: metadata.prompt ?? "",
      assertions: Array.isArray(metadata.assertions) ? metadata.assertions.map((a) => a.name ?? a) : [],
      configs: {},
    };

    // 配置目录动态发现：含 run-* 子目录的目录即为配置（白名单外也接受，原样进 configs）
    for (const cfgName of readdirSync(evalDir).sort()) {
      const cfgDir = join(evalDir, cfgName);
      if (!isDir(cfgDir)) continue;
      const runDirs = readdirSync(cfgDir).filter((n) => /^run-\d+$/.test(n)).sort(byRunNumber);
      if (runDirs.length === 0) continue;

      for (const runName of runDirs) {
        const metrics = loadRunMetrics(join(cfgDir, runName), warnings);
        if (!metrics) continue;
        (configs[cfgName] ??= []).push(metrics);
        (evalEntry.configs[cfgName] ??= []).push({ run: runName, ...metrics });
      }
    }
    evals.push(evalEntry);
  }

  if (Object.keys(configs).length === 0) {
    return { error: `未发现任何 run 数据: ${iterDir}` };
  }
  return { configs, evals, warnings };
}

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}
function byRunNumber(a, b) {
  return parseInt(a.split("-")[1], 10) - parseInt(b.split("-")[1], 10);
}

/** 契约 4 口径：configs 统计 + delta（第一个配置 − 第二个配置；字母序 with_skill 在前） */
export function buildBenchmark(iterDir, skillName = "") {
  const warnings = [];
  const loaded = loadIteration(iterDir, warnings);
  if (loaded.error) return loaded;

  const configNames = Object.keys(loaded.configs).sort();
  const configsOut = {};
  for (const cfg of configNames) {
    const runs = loaded.configs[cfg];
    const passRates = runs.map((r) => r.pass_rate);
    const times = runs.map((r) => r.time_ms).filter((v) => v !== null);
    const tokenList = runs.map((r) => r.tokens).filter((v) => v !== null);
    configsOut[cfg] = {
      runs: runs.length,
      pass_rate: calcStats(passRates),
      time_ms: calcStats(times),
      tokens: calcStats(tokenList),
      skipped: { time_ms: runs.length - times.length, tokens: runs.length - tokenList.length },
    };
  }

  const delta = {};
  if (configNames.length >= 2) {
    const a = configsOut[configNames[0]];
    const b = configsOut[configNames[1]];
    delta.pass_rate = round4(a.pass_rate.mean - b.pass_rate.mean);
    delta.time_ms = round4(a.time_ms.mean - b.time_ms.mean);
    delta.tokens = round4(a.tokens.mean - b.tokens.mean);
  }

  return {
    benchmark: {
      iteration: basename(resolve(iterDir)),
      skill_name: skillName || "",
      configs: configsOut,
      delta,
      evals: loaded.evals.map((e) => e.name),
      warnings,
    },
    evals: loaded.evals,
  };
}

/** benchmark.md：同数据的人类可读渲染（字段一一对应） */
export function renderMarkdown(benchmark) {
  const cfgNames = Object.keys(benchmark.configs);
  const label = (c) => c.replace(/_/g, " ");
  const lines = [
    `# Skill Benchmark: ${benchmark.skill_name || "(未命名)"} · ${benchmark.iteration}`,
    "",
    `Evals: ${benchmark.evals.join(", ")}`,
    "",
    "| 指标 | " + cfgNames.map(label).join(" | ") + " | delta |",
    "|--------|" + cfgNames.map(() => "------------").join("|") + "|-------|",
  ];

  const metricRow = (key, fmt) => {
    const cells = cfgNames.map((c) => {
      const s = benchmark.configs[c][key];
      return fmt(s);
    });
    let d = "—";
    if (cfgNames.length >= 2) {
      const v = benchmark.delta[key];
      d = key === "pass_rate" ? (v >= 0 ? "+" : "") + v.toFixed(2) : (v >= 0 ? "+" : "") + v.toFixed(0);
    }
    lines.push(`| ${key} | ${cells.join(" | ")} | ${d} |`);
  };
  metricRow("pass_rate", (s) => `${(s.mean * 100).toFixed(0)}% ± ${(s.stddev * 100).toFixed(0)}%`);
  metricRow("time_ms", (s) => `${(s.mean / 1000).toFixed(1)}s ± ${(s.stddev / 1000).toFixed(1)}s`);
  metricRow("tokens", (s) => `${Math.round(s.mean)} ± ${Math.round(s.stddev)}`);

  for (const c of cfgNames) {
    const sk = benchmark.configs[c].skipped;
    if (sk.time_ms || sk.tokens) {
      lines.push("", `注: ${label(c)} 有 timing 数值缺失（time_ms 跳过 ${sk.time_ms}，tokens 跳过 ${sk.tokens}），统计不含这些 run。`);
    }
  }
  return lines.join("\n") + "\n";
}

// --- CLI ---
const argv = process.argv.slice(2);
const iterDirArg = argv.find((a) => !a.startsWith("--"));
if (!iterDirArg || argv.includes("--help")) usage();

const skillNameIdx = argv.indexOf("--skill-name");
const outputIdx = argv.indexOf("--output");
const skillName = skillNameIdx !== -1 ? argv[skillNameIdx + 1] : "";

const result = buildBenchmark(resolve(iterDirArg), skillName || "");
if (result.error) {
  console.log(result.error);
  process.exit(1);
}

const outJson = outputIdx !== -1 ? resolve(argv[outputIdx + 1]) : join(resolve(iterDirArg), "benchmark.json");
writeJson(outJson, result.benchmark);
writeText(outJson.replace(/\.json$/, ".md"), renderMarkdown(result.benchmark));

// 终端摘要
const b = result.benchmark;
const cfgNames = Object.keys(b.configs);
console.log(`${b.iteration}: ${b.evals.length} evals × ${cfgNames.length} configs`);
for (const c of cfgNames) {
  const s = b.configs[c];
  console.log(
    `  ${c.padEnd(14)} pass_rate ${(s.pass_rate.mean * 100).toFixed(0)}% ±${(s.pass_rate.stddev * 100).toFixed(0)}%` +
    `   ${(s.time_ms.mean / 1000).toFixed(1)}s ±${(s.time_ms.stddev / 1000).toFixed(1)}s` +
    `   ${(s.tokens.mean / 1000).toFixed(1)}k ±${(s.tokens.stddev / 1000).toFixed(1)}k tokens` +
    (s.runs ? `   (${s.runs} runs)` : "")
  );
}
if (cfgNames.length >= 2) {
  const d = b.delta;
  console.log(
    `  delta           ${(d.pass_rate >= 0 ? "+" : "") + d.pass_rate.toFixed(2)}` +
    `        ${(d.time_ms >= 0 ? "+" : "") + (d.time_ms / 1000).toFixed(1) + "s"}` +
    `        ${(d.tokens >= 0 ? "+" : "") + (d.tokens / 1000).toFixed(1) + "k"}`
  );
}
console.log(`→ ${outJson}, ${outJson.replace(/\.json$/, ".md")}`);
process.exit(0);
