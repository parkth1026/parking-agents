#!/usr/bin/env node
// aggregate-trigger.mjs — 触发评测聚合（subagent 探针机制，官方 run_loop 口径）
// 读 trigger-evals.json（评测集）+ probe-results.jsonl（探针首行结果），输出 trigger-benchmark.json。
// 口径（与官方 run_loop 对齐）:
//   - train/test 60/40 按 should_trigger 分层切分（每组洗牌后取前 max(1, floor(n*0.4)) 进 test）
//   - 每 query 默认 3 探针取严格多数（有效探针中 triggered > 半数才算触发）
//   - 首行 `SKILL: <名或 none>` 是唯一判定源；解析失败记 invalid 不猜
//   - best_description 按 test 分数选出（防过拟合）：correct ↑ → 应触发率 ↑ → 误触发率 ↓，全平取先出现有效轮
// --persist <技能目录>: 题库（trigger-evals.json）读取与成绩（trigger-benchmark.json）写出缺省指向技能目录；
//   显式 --eval-set/--output 可覆盖；probe-results.jsonl 始终住 workspace（原始探针是 scratch）。
// 用法: node aggregate-trigger.mjs <workspace目录> [--persist <技能目录>] [--eval-set <路径>] [--probes <路径>] [--output <路径>] [--min-test-queries <N>]
// 退出码: 0 成功 / 1 数据缺失、无有效结果或 --persist 目标不可写 / 2 用法错
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { readJson, writeJson } from "./lib/jsonio.mjs";

const SPLIT_SEED = 42;
const HOLDOUT = 0.4;

function usage() {
  console.log("用法: node aggregate-trigger.mjs <workspace目录> [--persist <技能目录>] [--eval-set <路径>] [--probes <路径>] [--output <路径>] [--min-test-queries <N>]");
  console.log("示例: node aggregate-trigger.mjs ../my-skill-workspace --persist ../../skills/log-classifier");
  process.exit(2);
}

/** 确定性 PRNG（mulberry32），保证黄金切分可复现 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(arr, rand) {
  const x = [...arr];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

/** 官方 split_eval_set 口径：按 should_trigger 分层，每组洗牌后取前 n_test 进 test */
export function splitEvalSet(queries, holdout = HOLDOUT, seed = SPLIT_SEED) {
  const rand = mulberry32(seed);
  const trigger = queries.filter((q) => q.should_trigger).map((q) => q.id);
  const noTrigger = queries.filter((q) => !q.should_trigger).map((q) => q.id);

  const trigShuffled = shuffled(trigger, rand);
  const noTrigShuffled = shuffled(noTrigger, rand);

  const nTrigTest = Math.max(1, Math.floor(trigShuffled.length * holdout));
  const nNoTrigTest = Math.max(1, Math.floor(noTrigShuffled.length * holdout));

  const test = [...trigShuffled.slice(0, nTrigTest), ...noTrigShuffled.slice(0, nNoTrigTest)];
  const train = [...trigShuffled.slice(nTrigTest), ...noTrigShuffled.slice(nNoTrigTest)];
  return { train, test };
}

/**
 * 解析探针首行。返回 { status: "hit"|"miss"|"invalid", triggered }。
 *   `SKILL: <被测技能名>` → hit（触发）
 *   `SKILL: none` / `SKILL: <其他技能名>` → miss（协议合法但未触发本技能）
 *   不匹配 `SKILL: x` 协议 → invalid（不猜）
 */
export function parseFirstLine(firstLine, skillName) {
  if (typeof firstLine !== "string") return { status: "invalid", triggered: null };
  if (firstLine.includes("\n") || firstLine.includes("\r")) return { status: "invalid", triggered: null };
  const m = firstLine.match(/^SKILL:\s*(\S.*)$/);
  if (!m) return { status: "invalid", triggered: null };
  const value = m[1].trim();
  if (value === skillName) return { status: "hit", triggered: true };
  return { status: "miss", triggered: false }; // none 或其他技能名
}

/** 校验 trigger-evals.json，避免把缺字段静默当成 should-not-trigger。 */
export function validateEvalSet(evalSet) {
  const errors = [];
  if (!evalSet || typeof evalSet !== "object" || Array.isArray(evalSet)) {
    return ["顶层必须是 JSON 对象"];
  }
  if (typeof evalSet.skill !== "string" || !evalSet.skill.trim()) {
    errors.push("skill 必须是非空字符串");
  }
  if (!Array.isArray(evalSet.queries) || evalSet.queries.length === 0) {
    errors.push("queries 必须是非空数组");
    return errors;
  }

  const ids = new Set();
  let triggerCount = 0;
  let noTriggerCount = 0;
  evalSet.queries.forEach((query, index) => {
    const label = `queries[${index}]`;
    if (!query || typeof query !== "object" || Array.isArray(query)) {
      errors.push(`${label} 必须是对象`);
      return;
    }
    if ((typeof query.id !== "string" && typeof query.id !== "number") || String(query.id).trim() === "") {
      errors.push(`${label}.id 必须是非空字符串或数字`);
    } else if (ids.has(query.id)) {
      errors.push(`${label}.id 重复: ${String(query.id)}`);
    } else {
      ids.add(query.id);
    }
    if (typeof query.text !== "string" || !query.text.trim()) {
      errors.push(`${label}.text 必须是非空字符串`);
    }
    if (typeof query.should_trigger !== "boolean") {
      errors.push(`${label}.should_trigger 必须是布尔值`);
    } else if (query.should_trigger) {
      triggerCount++;
    } else {
      noTriggerCount++;
    }
  });
  if (triggerCount === 0 || noTriggerCount === 0) {
    errors.push("queries 必须同时包含 should_trigger=true 和 false，才能计算两类触发率");
  }
  return errors;
}

/** 读 jsonl（跳过空行与坏行并计数） */
function readJsonl(path) {
  const rows = [];
  const bad = [];
  const text = readFileSync(path, "utf8");
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      bad.push({ line: i + 1 });
    }
  }
  return { rows, bad };
}

/**
 * 聚合。返回 trigger-benchmark 对象（写入 json）。
 * jsonl 行: { query_id, probe, first_line, description? }；description 用于多轮迭代分组（缺省归入 null 轮）。
 */
// test 样本下限：低于它就不宣告 best_description。理由与「全无效探针退出 1、不写假报告」
// 同源——test 只有 2 条时，一轮赢另一轮往往只差一条 query，那不是证据是噪声。
// 判定基数是 test 里**真正拿到有效探针**的 query 数，不是切分声明的条数：
// 8 条里 6 条没探针，实际证据仍然只有 2 条。
export const MIN_TEST_QUERIES = 6;

export function aggregateTrigger(evalSet, probeRows, opts = {}) {
  const minTestQueries = Number.isInteger(opts.minTestQueries) ? opts.minTestQueries : MIN_TEST_QUERIES;
  const skill = evalSet.skill;
  const byId = new Map(evalSet.queries.map((q) => [q.id, q]));
  const split = splitEvalSet(evalSet.queries);

  let invalidProbes = 0;
  // 结构无法关联到评测 query 的行不能创建一个假的 null 轮次。
  const usableRows = [];
  for (const row of probeRows) {
    if (!row || typeof row !== "object" || Array.isArray(row) || !byId.has(row.query_id)) {
      invalidProbes++;
      continue;
    }
    usableRows.push(row);
  }

  // 按 description 分轮（保序：首次出现顺序）
  const roundOrder = [];
  const rounds = new Map();
  for (const row of usableRows) {
    const key = Object.prototype.hasOwnProperty.call(row, "description") ? row.description : null;
    if (!rounds.has(key)) {
      rounds.set(key, []);
      roundOrder.push(key);
    }
    rounds.get(key).push(row);
  }

  let validProbes = 0;
  const roundStats = [];
  for (const key of roundOrder) {
    // query_id → 首行判定列表
    const perQuery = new Map();
    for (const row of rounds.get(key)) {
      const parsed = parseFirstLine(row.first_line, skill);
      if (parsed.status === "invalid") {
        invalidProbes++;
        continue; // invalid 探针不参与判定，不猜
      }
      validProbes++;
      const list = perQuery.get(row.query_id) ?? [];
      list.push(parsed.triggered);
      perQuery.set(row.query_id, list);
    }

    const splitStats = (ids) => {
      let should = 0, shouldTriggered = 0;
      let shouldNot = 0, falseTriggered = 0;
      let correct = 0, invalidQueries = 0;
      for (const id of ids) {
        const q = byId.get(id);
        if (!q) continue;
        const probes = perQuery.get(id);
        if (!probes || probes.length === 0) {
          invalidQueries++; // 该 query 无任何有效探针
          continue;
        }
        const triggered = probes.filter(Boolean).length * 2 > probes.length; // 严格多数
        if (q.should_trigger) {
          should++;
          if (triggered) { shouldTriggered++; correct++; }
        } else {
          shouldNot++;
          if (triggered) falseTriggered++;
          else correct++;
        }
      }
      return {
        queries: ids.length,
        evaluated: ids.length - invalidQueries,
        trigger_rate_on_should: should > 0 ? round4(shouldTriggered / should) : 0,
        false_trigger_rate_on_should_not: shouldNot > 0 ? round4(falseTriggered / shouldNot) : 0,
        correct,
        invalid_queries: invalidQueries,
      };
    };

    roundStats.push({
      description: key,
      valid_probes: [...perQuery.values()].reduce((sum, probes) => sum + probes.length, 0),
      train: splitStats(split.train),
      test: splitStats(split.test),
    });
  }

  // best_description：按 test 分数选优（防过拟合）。
  // 分数字典序：correct ↓ → 应触发率 ↓ → 误触发率 ↑ → 全平取先出现轮（保守保底）。
  // 官方 run_loop 只比 correct（平局取先）；小 test 集上 correct 平局常见，
  // 用率细分避免「触发率大涨但 correct 撞平」的更优轮被丢弃。误触发率一步仅在
  // 两轮 valid 探针分母不同导致率与 correct 同时打平时才可达，兜底用。
  function beats(challenger, champ) {
    if (challenger.test.correct !== champ.test.correct) return challenger.test.correct > champ.test.correct;
    if (challenger.test.trigger_rate_on_should !== champ.test.trigger_rate_on_should)
      return challenger.test.trigger_rate_on_should > champ.test.trigger_rate_on_should;
    if (challenger.test.false_trigger_rate_on_should_not !== champ.test.false_trigger_rate_on_should_not)
      return challenger.test.false_trigger_rate_on_should_not < champ.test.false_trigger_rate_on_should_not;
    return false; // 全平：保守保留先出现轮
  }
  // 样本下限（issue #55）：证据不足的轮次没有资格当冠军——宁可不宣告，也不拿噪声当结论。
  let best = null;
  let bestReason = null;
  const eligible = roundStats.filter((r) => r.valid_probes > 0 && r.test.evaluated >= minTestQueries);
  for (const r of eligible) {
    if (best === null || beats(r, best)) best = r;
  }
  if (best === null && roundStats.length > 0) {
    const maxEvaluated = Math.max(0, ...roundStats.map((r) => r.test.evaluated));
    bestReason = `样本不足：test 有效 query 数 ${maxEvaluated} < 下限 ${minTestQueries}（扩充题库或显式放宽 --min-test-queries 后重跑）`;
  }

  return {
    skill,
    split: { train: split.train, test: split.test, seed: SPLIT_SEED, holdout: HOLDOUT },
    rounds: roundStats,
    best_description: best ? best.description : null,
    best_description_reason: bestReason,
    min_test_queries: minTestQueries,
    valid_probes: validProbes,
    invalid_probes: invalidProbes,
  };
}

function round4(x) {
  return Math.round(x * 10000) / 10000;
}

// --- CLI ---
const argv = process.argv.slice(2);
const wsArg = argv.find((a) => !a.startsWith("--"));
if (!wsArg || argv.includes("--help")) usage();

const flag = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
};

const ws = resolve(wsArg);

// --min-test-queries N：覆盖 test 样本下限（默认 MIN_TEST_QUERIES）。放宽是显式动作，
// 免得小题库悄悄拿到一个看起来权威的 best_description。
const minArg = flag("--min-test-queries");
let minTestQueries = MIN_TEST_QUERIES;
if (minArg !== undefined) {
  const n = Number(minArg);
  if (!Number.isInteger(n) || n < 1) {
    console.log(`用法错: --min-test-queries 需为 ≥1 的整数，收到: ${minArg}`);
    process.exit(2);
  }
  minTestQueries = n;
}

// --persist <技能目录>：题库读取与成绩写出的缺省从 workspace 切到技能目录（持久依据随技能走）。
// 题库未沉淀时拒绝，绝不静默回退读 workspace 旧副本——那是跨轮漂移的源头。
const persistIdx = argv.indexOf("--persist");
if (persistIdx !== -1 && !argv[persistIdx + 1]) usage();
const persistDir = persistIdx !== -1 ? resolve(argv[persistIdx + 1]) : null;
if (persistDir) {
  if (!existsSync(persistDir) || !statSync(persistDir).isDirectory()) {
    console.log(`拒绝: --persist 目标不是可写目录: ${persistDir}（题库与成绩要沉淀进技能目录）`);
    process.exit(1);
  }
}
const persistEvalSet = persistDir ? join(persistDir, "trigger-evals.json") : null;
const evalSetPath = flag("--eval-set") ?? persistEvalSet ?? join(ws, "trigger-evals.json");
const probesPath = flag("--probes") ?? join(ws, "probe-results.jsonl");
const outPath = flag("--output") ?? (persistDir ? join(persistDir, "trigger-benchmark.json") : join(ws, "trigger-benchmark.json"));
if (persistEvalSet && evalSetPath === persistEvalSet && !existsSync(persistEvalSet)) {
  console.log(`拒绝: 题库未沉淀到技能目录: ${persistEvalSet}（先把 trigger-evals.json 迁入技能目录，或去掉 --persist 走 workspace 口径）`);
  process.exit(1);
}

const evalSet = readJson(evalSetPath);
const evalErrors = validateEvalSet(evalSet);
if (evalErrors.length > 0) {
  console.log(`评测集缺失或结构不符: ${evalSetPath}`);
  for (const error of evalErrors) console.log(`  - ${error}`);
  process.exit(1);
}
if (!existsSync(probesPath)) {
  console.log(`探针结果缺失: ${probesPath}`);
  process.exit(1);
}

const { rows, bad } = readJsonl(probesPath);
if (bad.length > 0) {
  console.log(`警告: ${probesPath} 有 ${bad.length} 行不可解析，已跳过`);
}

const result = aggregateTrigger(evalSet, rows, { minTestQueries });
result.invalid_probes += bad.length;
if (result.rounds.length === 0 || result.valid_probes === 0) {
  console.log("无有效探针结果");
  process.exit(1);
}

writeJson(outPath, result);

// 终端摘要
const label = (r) => ({
  train: `train (${r.train.queries} queries): 应触发触发率 ${r.train.trigger_rate_on_should.toFixed(2)}  误触发率 ${r.train.false_trigger_rate_on_should_not.toFixed(2)}`,
  test: `test  (${r.test.queries} queries):  应触发触发率 ${r.test.trigger_rate_on_should.toFixed(2)}  误触发率 ${r.test.false_trigger_rate_on_should_not.toFixed(2)}`,
});
result.rounds.forEach((r, i) => {
  console.log(`第 ${i + 1} 轮${r.description === null ? "" : ` (${String(r.description).slice(0, 40)}…)`}`);
  console.log("  " + label(r).train);
  console.log("  " + label(r).test);
});
if (result.best_description === null && result.best_description_reason) {
  console.log(`best_description: 未宣告 —— ${result.best_description_reason}`);
} else {
  const bestRound = result.rounds.find((r) => r.description === result.best_description);
  console.log(`best_description: 按 test 分数选出（correct=${bestRound?.test.correct ?? "?"}/${bestRound?.test.evaluated ?? "?"} 有效, 触发率=${bestRound?.test.trigger_rate_on_should.toFixed(2) ?? "?"}，平局比率细分，防过拟合；下限 ${result.min_test_queries}）`);
}
console.log(`valid 探针: ${result.valid_probes}`);
console.log(`invalid 探针: ${result.invalid_probes}`);
console.log(`→ ${outPath}`);
process.exit(0);
