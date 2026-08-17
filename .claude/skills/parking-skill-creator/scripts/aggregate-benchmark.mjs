#!/usr/bin/env node
// aggregate-benchmark.mjs — 输出评测聚合（官方 aggregate_benchmark.py 口径移植，数据按 v2 契约）
// 扫描 <iter-dir>/eval-*/<config>/run-*/{grading.json, timing.json}（eval 目录也可在 runs/ 下），
// 输出 benchmark.json（configs 统计 + delta）与 benchmark.md。
// 统计口径: pass_rate/time_ms/tokens 的 mean/stddev(样本 n-1)/min/max；delta = with − baseline。
// timing 数值为 null 时跳过该 run 对应统计并计入 skipped，不报错。
// --history <技能目录>: 另把本轮各 gate 指标追加进 <技能目录>/history.json（只追加不覆盖），
//   与上一 run 按同 eval 名比 won/lost/tie；不带该参数时行为与旧版逐字节一致。
// 用法: node aggregate-benchmark.mjs <iter-dir> [--skill-name <名>] [--output <路径>] [--history <技能目录>]
// 退出码: 0 成功 / 1 无数据或目录不存在（含 --history 目标不可写，聚合产出不回滚）/ 2 用法错
import { existsSync, readdirSync, statSync, renameSync, readFileSync } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";
import { readJson, writeJson, writeText } from "./lib/jsonio.mjs";
import { calcStats, round4 } from "./lib/stats.mjs";

function usage() {
  console.log("用法: node aggregate-benchmark.mjs <iteration目录> [--skill-name <名>] [--output <路径>] [--history <技能目录>]");
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

// ---- history.json（技能目录，只追加） ----

/** 主 gate：with_skill 优先，否则按字典序首个（current_best 与 vs_previous 同口径） */
export function primaryGate(gates) {
  const names = Object.keys(gates).sort();
  return names.includes("with_skill") ? "with_skill" : names[0];
}

/** 本地时区 ISO 时间（对齐 api-mock 报文样例的 +08:00 形态） */
export function localIsoDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const off = d.getTimezoneOffset();
  const sign = off <= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** 本轮各 gate 摘要进 run 记录；timing 全缺时 mean 为 null（区别于 0） */
function buildGatesSummary(benchmark) {
  const gates = {};
  for (const [cfg, s] of Object.entries(benchmark.configs)) {
    gates[cfg] = {
      pass_rate: s.pass_rate.mean,
      mean_ms: s.runs - s.skipped.time_ms > 0 ? s.time_ms.mean : null,
      mean_tokens: s.runs - s.skipped.tokens > 0 ? s.tokens.mean : null,
    };
  }
  return gates;
}

/** eval 名 → 该 gate 下是否全过（多 run 取均值 ===1）；gate 缺该 eval 数据按未通过计 */
function evalPassMap(evals, gate) {
  const map = {};
  for (const ev of evals) {
    const runs = (ev.configs[gate] ?? []);
    map[ev.name] = runs.length > 0 && runs.reduce((s, r) => s + r.pass_rate, 0) / runs.length === 1;
  }
  return map;
}

/**
 * 与上一 run 比逐 eval 胜负：同 eval 名精确匹配、pass 布尔翻转；
 * 本轮新增 eval 计入 total 不计入 won/lost（detail 标 new）；上轮存在本轮缺席标 dropped。
 * 上一轮逐 eval 数据从其 iteration_ref 目录现算（数据只在聚合时齐备）；不可读返回 { error }。
 */
export function computeVsPrevious(curEvals, prevRun) {
  const gate = primaryGate(prevRun.gates ?? {});
  const prevLoaded = loadIteration(prevRun.iteration_ref, []);
  if (prevLoaded.error) return { error: prevLoaded.error };
  const prevMap = evalPassMap(prevLoaded.evals, gate);
  const curMap = evalPassMap(curEvals, gate);

  const detail = [];
  let won = 0, lost = 0, tie = 0;
  for (const ev of curEvals) {
    if (!(ev.name in prevMap)) { detail.push({ eval: ev.name, result: "new" }); continue; }
    if (prevMap[ev.name] === false && curMap[ev.name] === true) { detail.push({ eval: ev.name, result: "won" }); won++; }
    else if (prevMap[ev.name] === true && curMap[ev.name] === false) { detail.push({ eval: ev.name, result: "lost" }); lost++; }
    else { detail.push({ eval: ev.name, result: "tie" }); tie++; }
  }
  for (const name of Object.keys(prevMap).sort()) {
    if (!(name in curMap)) detail.push({ eval: name, result: "dropped" });
  }
  return { vs_previous: { evals_total: curEvals.length, won, lost, tie, detail } };
}

/** 读入现有 history；损坏（解析失败/形状不对）先备份 .corrupt-<ts> 再从空重建，不静默覆盖 */
function loadHistoryForAppend(historyPath) {
  if (!existsSync(historyPath)) return { history: null };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(historyPath, "utf8"));
  } catch (err) {
    return corrupt(historyPath, `history.json 解析失败: ${err.message}`);
  }
  const shapeOk = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    && Array.isArray(parsed.runs)
    && parsed.runs.every((r) => r && typeof r === "object" && r.gates && typeof r.gates === "object");
  if (!shapeOk) return corrupt(historyPath, "history.json 结构不符契约(runs/gates)");
  return { history: parsed };
  function corrupt(p, reason) {
    const ts = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
    renameSync(p, `${p}.corrupt-${stamp}`);
    console.log(`拒绝：${reason}——已备份为 history.json.corrupt-${stamp} 后重建`);
    return { history: null, rebuilt: true };
  }
}

/**
 * 组装本轮 run 记录并追加进 history（只追加：既有 runs 任何字段不回改；顶层 current_best 为权威指针）。
 * 返回 { history, summary } 供 CLI 打印趋势；写入由调用方决定（失败不吞 benchmark 产出）。
 */
export function appendHistoryRun({ result, iterDir, skillName, historyPath }) {
  const loaded = loadHistoryForAppend(historyPath);
  const history = loaded.history ?? { skill: skillName || result.benchmark.skill_name || "", runs: [] };
  const prevRun = history.runs.length > 0 ? history.runs[history.runs.length - 1] : null;
  const gates = buildGatesSummary(result.benchmark);

  let vsPrevious = null;
  let vsNote = "首轮无对比";
  if (prevRun) {
    const cmp = computeVsPrevious(result.evals, prevRun);
    if (cmp.error) {
      vsNote = `上一轮 iteration 数据不可读(${cmp.error})`;
    } else {
      vsPrevious = cmp.vs_previous;
      vsNote = `won ${vsPrevious.won} / lost ${vsPrevious.lost} / tie ${vsPrevious.tie}`;
    }
  }

  // current_best：主 gate pass_rate 严格更高才推进，平局不推进（防抖）
  const bestIdxBefore = (() => {
    const m = typeof history.current_best === "string" ? history.current_best.match(/^runs\[(\d+)\]$/) : null;
    return m && Number(m[1]) < history.runs.length ? Number(m[1]) : (history.runs.length > 0 ? 0 : -1);
  })();
  const newRate = gates[primaryGate(gates)]?.pass_rate ?? 0;
  const bestRateBefore = bestIdxBefore >= 0
    ? (history.runs[bestIdxBefore].gates[primaryGate(history.runs[bestIdxBefore].gates)]?.pass_rate ?? 0)
    : null;
  const advance = bestIdxBefore < 0 || newRate > bestRateBefore;
  const bestIdxAfter = advance ? history.runs.length : bestIdxBefore;

  const run = {
    date: localIsoDate(),
    iteration_ref: resolve(iterDir),
    gates,
    vs_previous: vsPrevious,
  };
  if (advance) run.current_best = true;
  history.runs.push(run);
  history.current_best = `runs[${bestIdxAfter}]`;

  const summary = {
    index: history.runs.length,
    vsNote,
    advance,
    bestIdxAfter,
    reason: bestIdxBefore < 0 ? "首轮即最佳" : advance
      ? `pass_rate ${newRate} > ${bestRateBefore} 推进`
      : `pass_rate ${newRate} 未严格超过 ${bestRateBefore}，持平不推进`,
    rebuilt: loaded.rebuilt ?? false,
  };
  return { history, summary };
}

// --- CLI ---
const argv = process.argv.slice(2);
const iterDirArg = argv.find((a) => !a.startsWith("--"));
if (!iterDirArg || argv.includes("--help")) usage();

const skillNameIdx = argv.indexOf("--skill-name");
const outputIdx = argv.indexOf("--output");
const historyIdx = argv.indexOf("--history");
if (historyIdx !== -1 && !argv[historyIdx + 1]) usage();
const skillName = skillNameIdx !== -1 ? argv[skillNameIdx + 1] : "";
const historyDir = historyIdx !== -1 ? resolve(argv[historyIdx + 1]) : null;

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

// --history：评测数据反向沉淀进技能目录（唯一写入通道，须显式传参；失败不吞 benchmark 产出）
if (historyDir) {
  if (!existsSync(historyDir) || !statSync(historyDir).isDirectory()) {
    console.log(`拒绝：--history 目标不是可写目录: ${historyDir}（本次不追加历史，聚合结果照常产出）`);
    process.exit(1);
  }
  const historyPath = join(historyDir, "history.json");
  let appended;
  try {
    appended = appendHistoryRun({ result, iterDir: iterDirArg, skillName, historyPath });
    writeJson(historyPath, appended.history);
  } catch (err) {
    console.log(`拒绝：history.json 写入失败: ${err.message}（本次不追加历史，聚合结果照常产出）`);
    process.exit(1);
  }
  const s = appended.summary;
  console.log(`history: 追加 1 条 run（第 ${s.index} 条）→ ${s.vsNote}${s.vsNote.startsWith("won") ? "（vs 上一条，按 eval 名匹配）" : ""}`);
  console.log(`history: current_best ${s.advance ? `推进至 runs[${s.bestIdxAfter}]` : `保持 runs[${s.bestIdxAfter}]`}（${s.reason}）`);
  console.log(`history: → ${historyPath}（runs 共 ${appended.history.runs.length} 条，只追加）`);
}
process.exit(0);
