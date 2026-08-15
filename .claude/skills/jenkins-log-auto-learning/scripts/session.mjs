#!/usr/bin/env node
// session.mjs — jenkins-log-auto-learning 工作流状态的唯一写入者
//
// workflow.json 的 schema 只存在于这个文件里。编排器 SKILL.md 与子技能都不复述它，
// Agent 一律通过子命令更新，不用 Edit/Write 直接改 workflow.json / analyzed-builds.json。
//
//   status                           打印续跑指针（当前对/门禁/next_action）+ 生效配置摘要
//                                    + pending-pairs 新鲜度。编排器每次调用从这里进，
//                                    也是交给子技能的上下文载体（零转抄，单一事实源）。
//   next                             领取构建对：pending-pairs.json 中第一个未分析的对，
//                                    原子写入 workflow.json。已有未终结会话则拒绝（exit 1）
//                                    并打印续跑指针——这就是单实例锁。
//   stage 1-analyze <done|skipped|error>
//                                    子技能收尾写回。done 必须 --result "<结论串>"；
//                                    error 必须 --reason。可选 --knowledge <文件>、
//                                    --success "success:w={N}"（fixBuild 的警告计数）。
//                                    done 的产物有机械门禁：--knowledge 必须存在、
//                                    位于 rawDir 内、含一级标题且内容含错误码 token
//                                    （否则 search-kb 检索不到）；:see= 必须指向存在
//                                    的知识文件；score 限定 0-10。
//   finish                           终结会话：结论串落账 analyzed{} + runHistory，会话置 done。
//   abandon --reason <...>           丢弃僵死会话，记 failure:error:{reason} 防重复领取。
//   list                             跨会话视图：剩余对数 / analyzed 统计 / 最近 runHistory。
//
//   公共参数: --config <config.json>（缺省取脚本上级）
//   退出码: 0 成功 / 1 有问题需要处理（含"无可领对""会话占用"）/ 2 用法或路径错
//
// 结论串 grammar（与 analyzed-builds.json 既有 2000+ 条历史严格兼容）:
//   failure:score={0..10}:{ErrorCode}:fix=#{build}[:see={file}]
//   failure:infra:{reason} | failure:no-fix-found | failure:log-unavailable | failure:error:{reason}
//   skip:{REASON}

import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute, relative, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readJson, readJsonOrDie, expandHome, loadConfig, writeJsonAtomicCRLF, localTimestamp } from "./config.mjs";

const SCHEMA_VERSION = 1;
const STAGES = ["1-analyze", "2-track"];
const TERMINAL_ANALYZE = ["done", "skipped", "error"]; // 1-analyze 的合法收尾状态

const scriptDir = dirname(fileURLToPath(import.meta.url));

function die(msg, code = 1) {
  console.error(`session: ${msg}`);
  process.exit(code);
}

// ---------- 公共 ----------

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

// 载入配置并派生路径（全部展开 ~/）
function loadPaths(configPath) {
  const config = loadConfig(configPath);
  const trackFile = expandHome(config.trackFile);
  const workflowFile = expandHome(config.workflowFile || join(dirname(trackFile), "workflow.json"));
  const pendingFile = join(dirname(trackFile), "pending-pairs.json");
  return { config, trackFile, workflowFile, pendingFile };
}

// 原子写 JSON（tmp + rename），唯一的状态写入路径
function writeJsonAtomic(path, obj) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}

function readTrack(trackFile) {
  if (!existsSync(trackFile)) return { last_analyzed: {}, analyzed: {}, runHistory: [] };
  return readJsonOrDie(trackFile, "analyzed-builds.json（跟踪账本）",
    "从备份恢复或人工修复 JSON 后重试；损坏期间不要跑 next/finish（会以空账本覆盖历史）。");
}

function writeTrack(trackFile, track) {
  mkdirSync(dirname(trackFile), { recursive: true });
  writeJsonAtomicCRLF(trackFile, track); // 账本沿用无 BOM + CRLF 格式，原子替换防崩溃截断
}

// pending-pairs.json 损坏时优雅报错：它由 scan 整体重算，直接重建即可
function readPending(pendingFile) {
  if (!existsSync(pendingFile)) return null;
  return readJsonOrDie(pendingFile, "pending-pairs.json", "重跑 scan-pairs.mjs 重建（整体重算，无需保留旧文件）。");
}

function pairKey(pair, build) {
  return `${pair.jobPath}#${build}`;
}

// pending-pairs 里第一个 failBuilds 未全部落账的对
function findPendingPair(pendingFile, analyzed) {
  const pending = readPending(pendingFile);
  if (!pending) return null;
  const pairs = Array.isArray(pending.pairs) ? pending.pairs : [];
  return pairs.find((p) => !p.failBuilds.every((b) => pairKey(p, b) in analyzed)) || null;
}

function countRemaining(pendingFile, analyzed) {
  const pending = readPending(pendingFile);
  if (!pending) return 0;
  const pairs = Array.isArray(pending.pairs) ? pending.pairs : [];
  return pairs.filter((p) => !p.failBuilds.every((b) => pairKey(p, b) in analyzed)).length;
}

// ---------- 结论串校验 ----------

const RESULT_PATTERNS = [
  /^failure:score=(?:10|[0-9]):(.+?):fix=#\d+(:see=.+)?$/, // failure:score=8:C2061:fix=#1231[:see=...]，score 0-10
  /^failure:infra:.+$/,
  /^failure:no-fix-found$/,
  /^failure:log-unavailable$/,
  /^failure:error:.+$/,
  /^skip:[A-Za-z_]+$/,
  /^success:w=\d+$/, // 仅用于 --success（fixBuild 警告计数）
];

function validateResult(result) {
  return RESULT_PATTERNS.some((re) => re.test(result));
}

// ---------- 知识产物门禁（G1/G2） ----------

// 子进程路径按当前工作目录解析，统一 resolve 成绝对路径再比较
const resolvePath = (p) => (isAbsolute(p) ? p : resolve(process.cwd(), p));

function isInside(child, parent) {
  if (!parent) return false;
  const rel = relative(resolvePath(parent), resolvePath(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

// 结论串里承载"可检索错误码"的字段：score 型取 ErrorCode，infra 型取 reason；
// 其余终态（no-fix/log-unavailable/error/skip）没有 token 约束
function errorCodeToken(result) {
  let m = result.match(/^failure:score=(?:10|[0-9]):(.+?):fix=#\d+/);
  if (m) return m[1];
  m = result.match(/^failure:infra:(.+)$/);
  if (m) return m[1];
  return null;
}

// 知识文件三重校验：存在 + 在 rawDir 内 + 内容可被 search-kb 检索到。
// search-kb 只 grep 内容行——文件里没有错误码 token 就等于沉底（曾实测发生）。
function validateKnowledge(knowledge, result, config) {
  const abs = resolvePath(knowledge);
  if (!existsSync(abs)) die(`--knowledge 文件不存在: ${knowledge}`, 1);
  const rawDir = config.knowledgeBase?.rawDir ? expandHome(config.knowledgeBase.rawDir) : null;
  if (!isInside(abs, rawDir)) {
    die(`--knowledge 必须位于 knowledgeBase.rawDir（${rawDir || "未配置"}）内，收到: ${knowledge}`, 1);
  }
  const content = readFileSync(abs, "utf8");
  const firstLine = content.split(/\r?\n/).find((l) => l.trim());
  if (!firstLine || !/^# \S/.test(firstLine)) {
    die(`知识文件缺一级标题（格式 "# {ErrorCode}: {简述}"，见 knowledge-format.md）: ${knowledge}`, 1);
  }
  const token = errorCodeToken(result);
  if (token && !content.toLowerCase().includes(token.toLowerCase())) {
    die(`知识文件内容不含错误码 token "${token}"——search-kb 按内容检索，该文件将永远搜不到（标题需含 ErrorCode，见 knowledge-format.md）`, 1);
  }
}

// ---------- workflow.json 读写（唯一入口） ----------

function readSession(workflowFile) {
  if (!existsSync(workflowFile)) return null;
  try {
    return readJson(workflowFile);
  } catch (e) {
    die(`workflow.json 不是合法 JSON（${e.message}）。人工检查后删除再 next，或 abandon。`, 1);
  }
}

function writeSession(workflowFile, session) {
  mkdirSync(dirname(workflowFile), { recursive: true });
  writeJsonAtomic(workflowFile, session);
}

function blankSession(pair) {
  return {
    schema_version: SCHEMA_VERSION,
    pair,
    stage_gates: { "1-analyze": { status: "pending" }, "2-track": { status: "pending" } },
    status: "in_progress",
    result: null,
    knowledge_file: null,
    success_value: null,
    error_reason: null,
    claimed_at: localTimestamp(),
    claimed_pid: process.pid,
    finished_at: null,
    next_action: "进入子技能 jenkins-pair-analyze 分析该构建对。",
  };
}

// ---------- status ----------

function cmdStatus(argv) {
  const flags = parseFlags(argv);
  const configPath = flags.config || join(scriptDir, "..", "config.json");
  const { config, trackFile, workflowFile, pendingFile } = loadPaths(configPath);
  const session = readSession(workflowFile);
  const track = readTrack(trackFile);

  console.log(`会话: ${session ? (session.status === "done" ? "已终结(上一轮)" : "进行中") : "无"}`);
  if (session) {
    const p = session.pair;
    console.log(`对: ${p.jobName} (${p.jobPath}) fail=[${p.failBuilds.join(",")}] fix=#${p.fixBuild}`);
    for (const s of STAGES) console.log(`  ${s}: ${session.stage_gates[s].status}`);
    if (session.result) console.log(`结论: ${session.result}`);
    if (session.knowledge_file) console.log(`知识文件: ${session.knowledge_file}`);
    console.log(`next: ${session.next_action}`);
  } else {
    console.log("next: 跑 next 领取下一个构建对。");
  }

  console.log(`配置: baseUrl=${config.jenkins.baseUrl}`);
  console.log(`      gitRepos=${config.gitRepos || "(未设)"}`);
  console.log(`      rawDir=${config.knowledgeBase?.rawDir || "(未设)"} tmpDir=${config.tmpDir || "(未设)"}`);
  console.log(`      trackFile=${trackFile}`);

  const pending = readPending(pendingFile);
  if (pending) {
    const ageH = ageHours(pending.generatedAt);
    const stale = ageH > 1 ? "（超过 1 小时，建议先重跑 scan-pairs.mjs）" : "";
    console.log(`pending-pairs: ${countRemaining(pendingFile, track.analyzed)} 对待分析，生成于 ${pending.generatedAt}${stale ? ` (${ageH.toFixed(1)} 小时前${stale})` : ""}`);
  } else {
    console.log("pending-pairs: 不存在 —— 先跑 scan-pairs.mjs。");
  }
  return 0;
}

function ageHours(ts) {
  const t = new Date(ts.replace(" ", "T")).getTime();
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / 3600000;
}

// ---------- next ----------

function cmdNext(argv) {
  const flags = parseFlags(argv);
  const configPath = flags.config || join(scriptDir, "..", "config.json");
  const { trackFile, workflowFile, pendingFile } = loadPaths(configPath);

  const existing = readSession(workflowFile);
  if (existing && existing.status !== "done") {
    console.error(`session: 已有进行中的会话（${existing.pair.jobName} fail=[${existing.pair.failBuilds.join(",")}]，claimed_at=${existing.claimed_at}）。`);
    console.error("同一跟踪文件同一时间只运行一个实例。续跑见 status 输出；确认僵死后可 abandon。");
    return 1;
  }

  if (!existsSync(pendingFile)) {
    console.error("session: pending-pairs.json 不存在 —— 先跑 scan-pairs.mjs。");
    return 1;
  }

  const track = readTrack(trackFile);
  const pair = findPendingPair(pendingFile, track.analyzed);
  if (!pair) {
    console.log("没有新的构建对需要分析（pending-pairs 中所有对都已落账）。可重跑 scan-pairs.mjs 拉取新构建。");
    return 1;
  }

  writeSession(workflowFile, blankSession(pair));
  console.log(`已领取: ${pair.jobName} (${pair.jobPath}) fail=[${pair.failBuilds.join(",")}] fix=#${pair.fixBuild}`);
  console.log(`next: 进入子技能 jenkins-pair-analyze 分析该构建对。工作流状态: ${workflowFile}`);
  return 0;
}

// ---------- stage ----------

function cmdStage(argv) {
  const stage = argv[0];
  const status = argv[1];
  if (stage !== "1-analyze") die(`阶段名必须是 1-analyze（2-track 由 finish 完成）`, 2);
  if (!TERMINAL_ANALYZE.includes(status)) die(`状态必须是 ${TERMINAL_ANALYZE.join(" / ")}`, 2);
  const flags = parseFlags(argv.slice(2));
  const configPath = flags.config || join(scriptDir, "..", "config.json");
  const { config, workflowFile } = loadPaths(configPath);

  const session = readSession(workflowFile);
  if (!session) die("没有进行中的会话 —— 先跑 next。", 1);
  if (session.status === "done") die("会话已终结 —— 跑 next 领取新对。", 1);
  if (session.stage_gates["1-analyze"].status !== "pending" && session.stage_gates["1-analyze"].status !== "in_progress") {
    die(`1-analyze 已是 ${session.stage_gates["1-analyze"].status}，不得重复收尾。`, 1);
  }

  if (status === "done") {
    if (typeof flags.result !== "string") die("done 必须带 --result \"<结论串>\"，grammar 见脚本头注释。", 2);
    if (!validateResult(flags.result)) die(`--result 不符合 grammar: ${flags.result}`, 1);
    const see = flags.result.match(/:see=(.+)$/);
    if (see) {
      const seeAbs = resolvePath(see[1]);
      const rawDir = config.knowledgeBase?.rawDir ? expandHome(config.knowledgeBase.rawDir) : null;
      const wikiDir = config.knowledgeBase?.wikiDir ? expandHome(config.knowledgeBase.wikiDir) : null;
      if (!existsSync(seeAbs) || (!isInside(seeAbs, rawDir) && !isInside(seeAbs, wikiDir))) {
        die(`--result 的 :see= 必须指向 rawDir/wikiDir 内已存在的知识文件，收到: ${see[1]}`, 1);
      }
    }
    if (typeof flags.knowledge === "string") validateKnowledge(flags.knowledge, flags.result, config);
    session.result = flags.result;
    if (typeof flags.knowledge === "string") session.knowledge_file = flags.knowledge;
    if (typeof flags.success === "string") {
      if (!/^success:w=\d+$/.test(flags.success)) die(`--success 必须形如 "success:w={N}"，收到: ${flags.success}`, 1);
      session.success_value = flags.success;
    }
    session.next_action = "跑 finish 把结论落账 analyzed{} 与 runHistory。";
  } else if (status === "error") {
    if (typeof flags.reason !== "string") die("error 必须带 --reason \"<原因>\"。", 2);
    session.result = `failure:error:${flags.reason}`;
    session.error_reason = flags.reason;
    session.next_action = "跑 finish 落账 error 状态，然后向用户报告。";
  } else {
    // skipped
    const reason = typeof flags.reason === "string" ? flags.reason : "skipped";
    session.result = `skip:${reason}`;
    session.next_action = "跑 finish 落账 skip 状态。";
  }

  session.stage_gates["1-analyze"] = { status, closed_at: localTimestamp() };
  writeSession(workflowFile, session);
  console.log(`1-analyze → ${status}；result=${session.result}`);
  console.log(`next: ${session.next_action}`);
  return 0;
}

// ---------- finish ----------

function cmdFinish(argv) {
  const flags = parseFlags(argv);
  const configPath = flags.config || join(scriptDir, "..", "config.json");
  const { trackFile, workflowFile, pendingFile } = loadPaths(configPath);

  const session = readSession(workflowFile);
  if (!session) die("没有会话 —— 先跑 next。", 1);
  if (session.status === "done") die("会话已终结。", 1);
  const gate = session.stage_gates["1-analyze"].status;
  if (!TERMINAL_ANALYZE.includes(gate)) {
    die(`门禁: 1-analyze 还是 ${gate}（未收尾）。先由子技能 stage 1-analyze done|skipped|error。`, 1);
  }

  const track = readTrack(trackFile);
  const pair = session.pair;
  const result = session.result;

  for (const fb of pair.failBuilds) track.analyzed[pairKey(pair, fb)] = result;
  if (session.success_value) track.analyzed[pairKey(pair, pair.fixBuild)] = session.success_value;

  const highest = Math.max(...pair.failBuilds, pair.fixBuild);
  const prev = track.last_analyzed[pair.jobPath] || 0;
  track.last_analyzed[pair.jobPath] = Math.max(prev, highest);

  track.runHistory.push({
    timestamp: localTimestamp(),
    buildsAnalyzed: pair.failBuilds.length + (session.success_value ? 1 : 0),
    buildsSkipped: result.startsWith("skip:") ? pair.failBuilds.length : 0,
    failurePairsFound: result.startsWith("skip:") ? 0 : 1,
    infraFailures: result.startsWith("failure:infra:") ? 1 : 0,
    knowledgeWritten: session.knowledge_file ? 1 : 0,
    remaining: countRemaining(pendingFile, track.analyzed),
  });
  writeTrack(trackFile, track);

  session.stage_gates["2-track"] = { status: "done", closed_at: localTimestamp() };
  session.status = "done";
  session.finished_at = localTimestamp();
  session.next_action = "向用户报告本轮结论（阶段 3），然后停止。下次调用从 next 开始。";
  writeSession(workflowFile, session);

  console.log(`已落账: ${pair.failBuilds.map((b) => pairKey(pair, b)).join(", ")} = ${result}`);
  if (session.success_value) console.log(`已落账: ${pairKey(pair, pair.fixBuild)} = ${session.success_value}`);
  console.log(`runHistory +1（remaining=${track.runHistory[track.runHistory.length - 1].remaining}）`);
  console.log(`next: ${session.next_action}`);
  return 0;
}

// ---------- abandon ----------

function cmdAbandon(argv) {
  const flags = parseFlags(argv);
  const configPath = flags.config || join(scriptDir, "..", "config.json");
  const { trackFile, workflowFile, pendingFile } = loadPaths(configPath);

  const session = readSession(workflowFile);
  if (!session) die("没有会话可丢弃。", 1);
  if (session.status === "done") die("会话已终结，无需 abandon。", 1);
  if (typeof flags.reason !== "string") die("abandon 必须带 --reason \"<僵死原因>\"。", 2);

  // 记 failure:error 防止 next 重复领取同一对（与老语义一致：error 后取下一对）
  const track = readTrack(trackFile);
  const pair = session.pair;
  for (const fb of pair.failBuilds) track.analyzed[pairKey(pair, fb)] = `failure:error:${flags.reason}`;
  track.runHistory.push({
    timestamp: localTimestamp(),
    buildsAnalyzed: 0,
    buildsSkipped: 0,
    failurePairsFound: 0,
    infraFailures: 0,
    knowledgeWritten: 0,
    remaining: countRemaining(pendingFile, track.analyzed),
  });
  writeTrack(trackFile, track);

  session.stage_gates["1-analyze"] = { status: "error", closed_at: localTimestamp() };
  session.status = "done";
  session.finished_at = localTimestamp();
  session.result = `failure:error:${flags.reason}`;
  session.next_action = "会话已被丢弃，跑 next 领取下一对。";
  writeSession(workflowFile, session);
  console.log(`已丢弃并落账 failure:error:${flags.reason}。`);
  return 0;
}

// ---------- list ----------

function cmdList(argv) {
  const flags = parseFlags(argv);
  const configPath = flags.config || join(scriptDir, "..", "config.json");
  const { trackFile, workflowFile, pendingFile } = loadPaths(configPath);

  const track = readTrack(trackFile);
  const analyzed = track.analyzed;
  const tally = { failure: 0, success: 0, skip: 0, other: 0 };
  for (const v of Object.values(analyzed)) {
    if (v.startsWith("failure:")) tally.failure++;
    else if (v.startsWith("success:")) tally.success++;
    else if (v.startsWith("skip:")) tally.skip++;
    else tally.other++;
  }
  console.log(`analyzed 总数 ${Object.keys(analyzed).length}（failure=${tally.failure} success=${tally.success} skip=${tally.skip} other=${tally.other}）`);
  console.log(`待分析构建对: ${countRemaining(pendingFile, analyzed)}`);
  const session = readSession(workflowFile);
  if (session) console.log(`会话: ${session.status}${session.pair ? ` | ${session.pair.jobName} fail=[${session.pair.failBuilds.join(",")}]` : ""}`);
  const last = track.runHistory[track.runHistory.length - 1];
  if (last) console.log(`最近一轮: ${JSON.stringify(last)}`);
  return 0;
}

// ---------- dispatch ----------

const [sub, ...rest] = process.argv.slice(2);
const table = { status: cmdStatus, next: cmdNext, stage: cmdStage, finish: cmdFinish, abandon: cmdAbandon, list: cmdList };
if (!sub || !table[sub]) {
  console.error("用法: node session.mjs <status|next|stage|finish|abandon|list> [--config <config.json>]");
  process.exit(2);
}
process.exit(table[sub](rest));
