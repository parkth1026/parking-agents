#!/usr/bin/env node
// aggregate-benchmark.mjs — 输出评测聚合（官方 aggregate_benchmark.py 口径移植，数据按 v2 契约）
// 扫描 <iter-dir>/eval-*/<config>/run-*/{grading.json, timing.json}（eval 目录也可在 runs/ 下），
// 输出 benchmark.json（configs 统计 + delta）与 benchmark.md。
// 统计口径: pass_rate/time_ms/tokens 的 mean/stddev(样本 n-1)/min/max；delta = with − baseline。
// timing 数值为 null 时跳过该 run 对应统计并计入 skipped；整轮缺失时显式告警，绝不渲染为 0。
// --history <技能目录>: 另把本轮各 gate 指标追加进 <技能目录>/history.json（只追加不覆盖），
//   与上一 run 按同 eval 名比 won/lost/tie；同通道整写 <技能目录>/output-evals.json
//   （本轮题面+断言，clone 接收方不依赖 workspace 即可重建评测用例）。不带该参数时两者都不写。
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
      assertion_specs: Array.isArray(metadata.assertions)
        ? metadata.assertions.map((a) => (a && typeof a === "object" ? a : { name: String(a) }))
        : [],
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
        // 判罚对账：grading.results 条数应等于题库断言数（缺 manual 合并、多写标注条都会虚高/失真）；
        // 题库断言为空（metadata 未登记）时无从对账，跳过不告警
        const expected = Array.isArray(metadata.assertions) ? metadata.assertions.length : 0;
        if (expected > 0 && metrics.total !== expected) {
          const diff = expected - metrics.total;
          warnings.push(`${evalName}/${cfgName}/${runName}: grading.results ${metrics.total} 条 ≠ 题库断言 ${expected} 条（${diff > 0 ? `缺 ${diff} 条（疑漏交 manual 或评分器少判）` : `多 ${-diff} 条（疑把标注当断言计入）`}）`);
        }
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
  const emptyStats = () => ({ mean: null, stddev: null, min: null, max: null });
  for (const cfg of configNames) {
    const runs = loaded.configs[cfg];
    const passRates = runs.map((r) => r.pass_rate);
    const times = runs.map((r) => r.time_ms).filter((v) => v !== null);
    const tokenList = runs.map((r) => r.tokens).filter((v) => v !== null);
    configsOut[cfg] = {
      runs: runs.length,
      pass_rate: calcStats(passRates),
      // 空 timing 样本不能沿用 calcStats([]) 的 0 占位，否则会把“未测量”伪装成真实成本。
      time_ms: times.length > 0 ? calcStats(times) : emptyStats(),
      tokens: tokenList.length > 0 ? calcStats(tokenList) : emptyStats(),
      skipped: { time_ms: runs.length - times.length, tokens: runs.length - tokenList.length },
    };
  }

  const allRuns = Object.values(loaded.configs).flat();
  const timingDiagnostics = [
    { key: "time_ms", field: "duration_ms", label: "time_ms" },
    { key: "tokens", field: "total_tokens", label: "tokens" },
  ];
  for (const metric of timingDiagnostics) {
    const available = allRuns.filter((run) => run[metric.key] !== null).length;
    if (available === 0) {
      warnings.push(`timing 全缺失：本轮 ${allRuns.length} 个 run 的 ${metric.field} 均为 null 或 timing.json 缺失，${metric.label} 未测量；不会把缺失数据当作 0。`);
    }
  }

  const delta = {};
  if (configNames.length >= 2) {
    const a = configsOut[configNames[0]];
    const b = configsOut[configNames[1]];
    delta.pass_rate = round4(a.pass_rate.mean - b.pass_rate.mean);
    delta.time_ms = a.time_ms.mean === null || b.time_ms.mean === null
      ? null : round4(a.time_ms.mean - b.time_ms.mean);
    delta.tokens = a.tokens.mean === null || b.tokens.mean === null
      ? null : round4(a.tokens.mean - b.tokens.mean);
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
    if (cfgNames.length >= 2 && benchmark.delta[key] !== null) {
      const v = benchmark.delta[key];
      d = key === "pass_rate" ? (v >= 0 ? "+" : "") + v.toFixed(2) : (v >= 0 ? "+" : "") + v.toFixed(0);
    }
    lines.push(`| ${key} | ${cells.join(" | ")} | ${d} |`);
  };
  metricRow("pass_rate", (s) => `${(s.mean * 100).toFixed(0)}% ± ${(s.stddev * 100).toFixed(0)}%`);
  metricRow("time_ms", (s) => s.mean === null ? "未测量" : `${(s.mean / 1000).toFixed(1)}s ± ${(s.stddev / 1000).toFixed(1)}s`);
  metricRow("tokens", (s) => s.mean === null ? "未测量" : `${Math.round(s.mean)} ± ${Math.round(s.stddev)}`);

  for (const c of cfgNames) {
    const sk = benchmark.configs[c].skipped;
    if (sk.time_ms || sk.tokens) {
      lines.push("", `注: ${label(c)} 有 timing 数值缺失（time_ms 跳过 ${sk.time_ms}，tokens 跳过 ${sk.tokens}），统计不含这些 run。`);
    }
  }
  return lines.join("\n") + "\n";
}

// ---- history.json（技能目录，只追加） ----

/**
 * 当前轮的上一轮目录仍在 workspace 中，但 history 没有对应条目时给出诊断。
 * 只检查相邻上一轮：旧目录可能已被 clean，不能把不可回补的历史伪造进 history。
 */
export function detectHistoryGap(iterDir, historyDir) {
  const currentName = basename(resolve(iterDir));
  const match = /^iteration-(\d+)$/.exec(currentName);
  if (!match || Number(match[1]) <= 1) return null;

  const previousName = `iteration-${Number(match[1]) - 1}`;
  const previousDir = join(dirname(resolve(iterDir)), previousName);
  if (!isDir(previousDir)) return null;

  const history = readJson(join(resolve(historyDir), "history.json"));
  const hasPrevious = Array.isArray(history?.runs)
    && history.runs.some((run) => {
      if (typeof run?.iteration_ref !== "string") return false;
      const ref = run.iteration_ref.replace(/[\\/]+$/, "");
      return basename(ref) === previousName;
    });
  if (hasPrevious) return null;

  return `history 断档：workspace 中存在 ${previousName}，但 history.json 没有对应记录；` +
    "本次不补写丢失的历史数据，请确保后续聚合带上 --history。";
}

/**
 * 题面沉淀体 output-evals.json：本轮评测用例集（整写覆盖，跨轮内容史由 git 记录）。
 * --keep-evals：专项轮（只跑题库子集）用——保留现有题库里本轮未跑的 eval，本轮条目覆盖/追加同名项，
 *   防止部分场景轮把题库整写成子集（全量轮换代仍用默认整写）。
 */
export function buildOutputEvals(evals, skillName, iterationName, keepExisting = null) {
  const entries = evals.map((e) => ({ name: e.name, prompt: e.prompt, assertions: e.assertion_specs }));
  if (keepExisting && Array.isArray(keepExisting.evals)) {
    const names = new Set(entries.map((e) => e.name));
    for (const old of keepExisting.evals) if (!names.has(old.name)) entries.push(old);
    entries.sort((a, b) => (a.name < b.name ? -1 : 1));
  }
  return {
    skill: skillName || "",
    source_iteration: iterationName,
    evals: entries,
  };
}

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

/** eval 名 → 该 gate 下是否全过（多 run 取均值 ===1）；该 gate 无数据记 null（未知，绝不当失败） */
function evalPassMap(evals, gate) {
  const map = {};
  for (const ev of evals) {
    const runs = ev.configs[gate] ?? [];
    map[ev.name] = runs.length > 0 ? runs.reduce((s, r) => s + r.pass_rate, 0) / runs.length === 1 : null;
  }
  return map;
}

/**
 * 与上一 run 比逐 eval 胜负：同 eval 名精确匹配、pass 布尔翻转。
 * 比对 gate 取两轮主 gate；主 gate 名不同（换 gate 名/纯实验 gate 轮）时，若两轮同有 with_skill
 * 则退回 with_skill，否则判「gate 不连续」不可比——绝不把「本轮没有上轮那个 gate」当失败记 lost（假回归）。
 * 本轮新增 eval 计入 total 不计入 won/lost（detail 标 new）；上轮存在本轮缺席标 dropped；
 * 某侧该 gate 无数据的 eval 按无翻转计 tie。上一轮逐 eval 数据从其 iteration_ref 目录现算。
 */
export function computeVsPrevious(curEvals, curGates, prevRun) {
  const prevPrimary = primaryGate(prevRun.gates ?? {});
  const curPrimary = primaryGate(curGates ?? {});
  let gate = curPrimary;
  if (curPrimary !== prevPrimary) {
    const common = Object.keys(curGates ?? {}).filter((g) => prevRun.gates && g in prevRun.gates);
    gate = common.includes("with_skill") ? "with_skill" : null;
  }
  if (!gate) return { error: "gate 不连续（两轮无可比 gate）" };
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

const RUN_SHAPE_OK = (r) => r && typeof r === "object" && !Array.isArray(r) && r.gates && typeof r.gates === "object";

/**
 * 读入现有 history。整文件损坏（解析失败/顶层结构不对）→ 备份 .corrupt-<ts> 后从空重建；
 * 仅个别 run 形状不合法 → 同样备份原文件，但保留合法 run 继续追加（好数据不陪葬）。均不静默覆盖。
 */
function loadHistoryForAppend(historyPath) {
  if (!existsSync(historyPath)) return { history: null };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(historyPath, "utf8"));
  } catch (err) {
    return corrupt(historyPath, `history.json 解析失败: ${err.message}`, null);
  }
  const topOk = parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.runs);
  if (!topOk) return corrupt(historyPath, "history.json 结构不符契约(runs/gates)", null);
  const badCount = parsed.runs.filter((r) => !RUN_SHAPE_OK(r)).length;
  if (badCount > 0) {
    parsed.runs = parsed.runs.filter(RUN_SHAPE_OK);
    return corrupt(historyPath, `history.json 有 ${badCount} 条 run 形状不合法（已忽略，保留 ${parsed.runs.length} 条合法 run）`, parsed);
  }
  return { history: parsed };
  function corrupt(p, reason, keep) {
    const ts = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
    renameSync(p, `${p}.corrupt-${stamp}`);
    console.log(`拒绝：${reason}——已备份为 history.json.corrupt-${stamp} 后继续`);
    return keep ? { history: keep, rebuilt: true } : { history: null, rebuilt: true };
  }
}

/**
 * 组装本轮 run 记录并追加进 history（只追加：既有 runs 任何字段不回改；顶层 current_best 为权威指针）。
 * current_best 口径：主 gate（with_skill 优先，否则字典序首个）pass_rate 严格更高才推进，平局不推进（防抖）；
 *   ① 每个 iteration_ref 只认最新一条（重复聚合=修正，旧条不再当候选，防早期脏数据锁死上限；修正条
 *     记 supersedes 指向被修正的旧条）；
 *   ② 主 gate 名不同的轮次（实验 gate/换名）不参与推进——星标只在同名主 gate 的成绩间移动；
 *   ③ 题库纪元（bank_epoch）：vs_previous 出现 new/dropped 即换纪元，星标只在与被认证条同纪元内
 *     移动；换纪元首轮重置星标为本轮（跨纪元 pass_rate 不可比）。
 * 返回 { history, summary } 供 CLI 打印趋势；写入由调用方决定（失败不吞 benchmark 产出）。
 */
export function appendHistoryRun({ result, iterDir, skillName, historyPath }) {
  const loaded = loadHistoryForAppend(historyPath);
  const history = loaded.history ?? { skill: skillName || result.benchmark.skill_name || "", runs: [] };
  const prevRun = history.runs.length > 0 ? history.runs[history.runs.length - 1] : null;
  const gates = buildGatesSummary(result.benchmark);
  const newRef = resolve(iterDir);

  let vsPrevious = null;
  let vsNote = "首轮无对比";
  let duplicateOf = history.runs.findLastIndex((r) => r.iteration_ref === newRef); // 最新一条同 ref 记录（supersedes 指向它）
  if (prevRun) {
    if (prevRun.iteration_ref === newRef) {
      vsNote = "同 iteration 重复聚合，无对比";
    } else {
      const cmp = computeVsPrevious(result.evals, gates, prevRun);
      if (cmp.error) {
        vsNote = `${cmp.error}，本轮无逐 eval 对比`;
      } else {
        vsPrevious = cmp.vs_previous;
        vsNote = `won ${vsPrevious.won} / lost ${vsPrevious.lost} / tie ${vsPrevious.tie}`;
      }
    }
  }

  // 题库纪元：vs_previous 出现 new/dropped（题面换代）即换纪元。current_best 只认证同纪元成绩——
  // 跨纪元 pass_rate 不可比，星标钉在已汰换旧题库上会误导去留决策；换纪元首轮重置星标为本轮。
  const epochChanged = !!(vsPrevious && vsPrevious.detail.some((d) => d.result === "new" || d.result === "dropped"));
  const prevEpoch = prevRun ? (prevRun.bank_epoch ?? 1) : 0;
  const epoch = prevRun ? (epochChanged ? prevEpoch + 1 : Math.max(prevEpoch, 1)) : 1;
  if (epochChanged) {
    const n = vsPrevious.detail.filter((d) => d.result === "new").length;
    const m = vsPrevious.detail.filter((d) => d.result === "dropped").length;
    vsNote += `（题库换纪元：${n} new / ${m} dropped）`;
  }

  const run = {
    date: localIsoDate(),
    iteration_ref: newRef,
    gates,
    vs_previous: vsPrevious,
    bank_epoch: epoch,
  };
  if (duplicateOf >= 0) run.supersedes = `runs[${duplicateOf}]`; // 重复聚合=修正：指向被修正的旧条
  history.runs.push(run);
  const newRunIdx = history.runs.length - 1;

  const curBestIdx = (() => {
    const m = typeof history.current_best === "string" ? history.current_best.match(/^runs\[(\d+)\]$/) : null;
    return m && Number(m[1]) < newRunIdx ? Number(m[1]) : (newRunIdx > 0 ? 0 : -1);
  })();
  const newPrimary = primaryGate(gates);
  const rateOf = (r) => r.gates[primaryGate(r.gates)]?.pass_rate ?? 0;
  const reaggregated = history.runs.slice(0, newRunIdx).some((r) => r.iteration_ref === newRef);

  // 候选 = 其他 iteration_ref 各自的最新一条、主 gate 名与本轮一致、且与本轮同题库纪元；
  // 本轮 ref 的旧条目已被本轮取代（delete），不当候选——重复聚合=修正，防早期脏数据锁死上限
  const lastIdxPerRef = new Map();
  history.runs.forEach((r, i) => { if (i !== newRunIdx) lastIdxPerRef.set(r.iteration_ref, i); });
  lastIdxPerRef.delete(run.iteration_ref);
  const candidates = [...lastIdxPerRef.values()]
    .filter((i) => primaryGate(history.runs[i].gates) === newPrimary)
    .filter((i) => (history.runs[i].bank_epoch ?? 1) === epoch);

  let advance, bestIdxAfter, reason;
  if (epochChanged && !reaggregated) {
    advance = true;
    bestIdxAfter = newRunIdx;
    const n = vsPrevious.detail.filter((d) => d.result === "new").length;
    const m = vsPrevious.detail.filter((d) => d.result === "dropped").length;
    reason = `题库换纪元（${n} new / ${m} dropped），跨纪元不可比，current_best 重置为本纪元首轮`;
  } else if (candidates.length === 0 && newRunIdx > 0 && !reaggregated) {
    advance = false;
    bestIdxAfter = curBestIdx >= 0 ? curBestIdx : 0;
    reason = `主 gate 不连续（本轮 ${newPrimary} 无同名历史轮），不参与 current_best`;
  } else if (candidates.length === 0) {
    advance = true;
    bestIdxAfter = newRunIdx;
    reason = newRunIdx === 0 ? "首轮即最佳" : "同 iteration 重复聚合，最新成绩为该轮有效成绩";
  } else {
    let best = candidates[0];
    for (const i of candidates) {
      if (rateOf(history.runs[i]) > rateOf(history.runs[best])
        || (rateOf(history.runs[i]) === rateOf(history.runs[best]) && i === curBestIdx)) best = i;
    }
    const newRate = rateOf(run);
    const bestRate = rateOf(history.runs[best]);
    if (newRate > bestRate) {
      advance = true;
      bestIdxAfter = newRunIdx;
      reason = reaggregated
        ? `同 iteration 重复聚合修正后 pass_rate ${newRate} > ${bestRate}，星标移至最新一条`
        : `pass_rate ${newRate} > ${bestRate} 推进`;
    } else {
      advance = false;
      bestIdxAfter = best;
      reason = best !== curBestIdx
        ? `星标回落至 runs[${best}]（pass_rate ${bestRate}，以各轮最新成绩的最高者为最佳）`
        : `pass_rate ${newRate} 未严格超过 ${bestRate}，持平不推进`;
    }
  }
  if (advance) run.current_best = true;
  history.current_best = `runs[${bestIdxAfter}]`;

  const summary = {
    index: history.runs.length,
    vsNote,
    advance,
    bestIdxAfter,
    reason,
    duplicateOf,
    epochChanged,
    epoch,
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
const keepEvals = argv.includes("--keep-evals");
if (historyIdx !== -1 && !argv[historyIdx + 1]) usage();
const skillName = skillNameIdx !== -1 ? argv[skillNameIdx + 1] : "";
const historyDir = historyIdx !== -1 ? resolve(argv[historyIdx + 1]) : null;

const result = buildBenchmark(resolve(iterDirArg), skillName || "");
if (result.error) {
  console.log(result.error);
  process.exit(1);
}

const historyGapWarning = historyDir ? detectHistoryGap(iterDirArg, historyDir) : null;
if (historyGapWarning) result.benchmark.warnings.push(historyGapWarning);

const outJson = outputIdx !== -1 ? resolve(argv[outputIdx + 1]) : join(resolve(iterDirArg), "benchmark.json");
writeJson(outJson, result.benchmark);
writeText(outJson.replace(/\.json$/, ".md"), renderMarkdown(result.benchmark));

// 终端摘要
const b = result.benchmark;
const cfgNames = Object.keys(b.configs);
console.log(`${b.iteration}: ${b.evals.length} evals × ${cfgNames.length} configs`);
const formatTiming = (stats, render) => stats.mean === null ? "未测量" : render(stats);
for (const c of cfgNames) {
  const s = b.configs[c];
  console.log(
    `  ${c.padEnd(14)} pass_rate ${(s.pass_rate.mean * 100).toFixed(0)}% ±${(s.pass_rate.stddev * 100).toFixed(0)}%` +
    `   ${formatTiming(s.time_ms, (v) => `${(v.mean / 1000).toFixed(1)}s ±${(v.stddev / 1000).toFixed(1)}s`)}` +
    `   ${formatTiming(s.tokens, (v) => `${(v.mean / 1000).toFixed(1)}k ±${(v.stddev / 1000).toFixed(1)}k tokens`)}` +
    (s.runs ? `   (${s.runs} runs)` : "")
  );
}
if (cfgNames.length >= 2) {
  const d = b.delta;
  console.log(
    `  delta           ${(d.pass_rate >= 0 ? "+" : "") + d.pass_rate.toFixed(2)}` +
    `        ${d.time_ms === null ? "未测量" : (d.time_ms >= 0 ? "+" : "") + (d.time_ms / 1000).toFixed(1) + "s"}` +
    `        ${d.tokens === null ? "未测量" : (d.tokens >= 0 ? "+" : "") + (d.tokens / 1000).toFixed(1) + "k"}`
  );
}
for (const warning of b.warnings) console.log(`警告: ${warning}`);
console.log(`→ ${outJson}, ${outJson.replace(/\.json$/, ".md")}`);

// --history：评测数据反向沉淀进技能目录（唯一写入通道，须显式传参；失败不吞 benchmark 产出）
if (historyDir) {
  if (!existsSync(historyDir) || !statSync(historyDir).isDirectory()) {
    console.log(`拒绝：--history 目标不是可写目录: ${historyDir}（本次不追加历史，聚合结果照常产出）`);
    process.exit(1);
  }
  const historyPath = join(historyDir, "history.json");
  if (existsSync(historyPath) && statSync(historyPath).isDirectory()) {
    console.log(`拒绝：history.json 是目录，不是历史文件: ${historyPath}（本次不追加历史，聚合结果照常产出）`);
    process.exit(1);
  }
  let appended;
  try {
    appended = appendHistoryRun({ result, iterDir: iterDirArg, skillName, historyPath });
    writeJson(historyPath, appended.history);
  } catch (err) {
    console.log(`拒绝：history.json 写入失败: ${err.message}（本次不追加历史，聚合结果照常产出）`);
    process.exit(1);
  }
  const s = appended.summary;
  if (s.duplicateOf >= 0) {
    console.log(`history: 注意: 该 iteration 此前已记录(runs[${s.duplicateOf}])，本条为重复聚合记录（supersedes runs[${s.duplicateOf}]）；对比与 current_best 以本条(最新)为准`);
  }
  console.log(`history: 追加 1 条 run（第 ${s.index} 条）→ ${s.vsNote}${s.vsNote.startsWith("won") ? "（vs 上一条，按 eval 名匹配）" : ""}`);
  if (s.epochChanged) console.log(`history: 题库换纪元 → bank_epoch ${s.epoch}，跨纪元不可比，current_best 重置为本纪元首轮`);
  console.log(`history: current_best ${s.advance ? `推进至 runs[${s.bestIdxAfter}]` : `保持 runs[${s.bestIdxAfter}]`}（${s.reason}）`);
  console.log(`history: → ${historyPath}（runs 共 ${appended.history.runs.length} 条，只追加）`);

  // 同通道沉淀题面：指标与题面一起走，clone 接收方拿齐成绩史+用例集（整写覆盖，史由 git 记录）
  const outputEvalsPath = join(historyDir, "output-evals.json");
  if (existsSync(outputEvalsPath) && statSync(outputEvalsPath).isDirectory()) {
    console.log(`拒绝：output-evals.json 是目录，不是题面文件: ${outputEvalsPath}（本次不沉淀题面，聚合结果照常产出）`);
    process.exit(1);
  }
  try {
    const existing = keepEvals ? readJson(outputEvalsPath) : null;
    const bank = buildOutputEvals(result.evals, skillName || b.skill_name, b.iteration, existing);
    writeJson(outputEvalsPath, bank);
    if (existing && bank.evals.length > result.evals.length) {
      console.log(`evals: --keep-evals 保留题库中本轮未跑的 ${bank.evals.length - result.evals.length} 个 eval（专项轮防题库缩水；全量轮换代不要带该旗标）`);
    }
  } catch (err) {
    console.log(`拒绝：output-evals.json 写入失败: ${err.message}（本次不沉淀题面，聚合结果照常产出）`);
    process.exit(1);
  }
  const noPrompt = result.evals.filter((e) => !e.prompt).length;
  console.log(`evals: 题面+断言沉淀 ${result.evals.length} 个 eval → ${outputEvalsPath}（整写覆盖，跨轮史由 git 记录）`);
  if (noPrompt > 0) console.log(`evals: 注意: ${noPrompt} 个 eval 缺 prompt（eval_metadata.json 不全，题面不可完整复现）`);
}
process.exit(0);
