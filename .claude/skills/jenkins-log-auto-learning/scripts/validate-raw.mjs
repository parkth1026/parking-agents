#!/usr/bin/env node
// validate-raw.mjs — RAW 知识文件验收脚本（v2 规范的唯一裁判）
//
// 用法:
//   node validate-raw.mjs [--config <config.json>]                # 全库验收: 扫 rawDir/details + scratch
//   node validate-raw.mjs --file <知识文件> [--config ...]         # 单文件验收(session stage done 门禁复用)
//
// 校验内容（v2 三重身份锚: base_url + job_path + 构建号, 文件名 ↔ frontmatter ↔ 账本键三方互验）:
//   - UTF-8 无 BOM；frontmatter 完整且可解析（扁平 key: value）
//   - 文件名语法 ^{jobCode}-{fail}[-{end}]-{ErrorCode}-{ShortDesc}.md，jobCode ∈ jobCodes 注册表
//   - frontmatter 各字段与文件名/注册表/config 真值一致；score 与目录分档一致
//   - result 串过 grammar；error_code token 在正文中（search-kb 可检索性）
//   - Warning Trend 生效分界: recorded_at ≥ 生效时刻的文件必须有 `## Warning Trend` 节（存量放行）
//   - 全库模式: 同 job+fail 构建唯一性（非 recurrence 文件不得重复认领）、账本交叉核对
//
// 退出码: 0 通过 / 1 有 ERROR / 2 用法或路径错

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, basename, relative, isAbsolute, resolve } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { expandHome, loadConfig } from "./config.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
// 结论串 grammar（session.mjs 与本脚本共用此唯一来源，防两份漂移）
export const RESULT_PATTERNS = [
  /^failure:score=(?:10|[0-9]):(.+?):fix=#\d+(:see=.+)?$/, // failure:score=8:C2061:fix=#1231[:see=...]
  /^failure:infra:.+$/,
  /^failure:no-fix-found$/,
  /^failure:log-unavailable$/,
  /^failure:error:.+$/,
  /^skip:[A-Za-z_]+$/,
  /^success:w=\d+$/, // 仅用于 --success（fixBuild 警告计数）
];

const FM_REQUIRED = [
  "schema", "base_url", "job", "job_code", "job_path",
  "fail_builds", "fix_build", "error_code", "score", "result", "recorded_at",
];

const ERROR_CODE_RE = /^[A-Za-z][A-Za-z0-9_]*$/; // 禁连字符：连字符是文件名段分隔符，含它会导致解析歧义

// Warning Trend 生效分界（规则原子落地提交时刻，ISO 本地时间，分钟精度与 recorded_at 可比）：
// recorded_at ≥ 该时刻的新知识文件必须携带 `## Warning Trend` 必填节；早于该时刻的存量文件放行。
export const WARNING_TREND_EFFECTIVE_AT = "2026-08-17T01:30";

// ---------- frontmatter 解析（扁平 key: value，值内可含冒号，首个冒号分隔） ----------
export function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return { fm: null, body: content };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx <= 0) return { fm: null, body: content, error: `frontmatter 存在无法解析的行: "${line}"` };
    fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { fm, body: content.slice(m[0].length) };
}

export function parseFailRange(s) {
  const m = String(s ?? "").match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] !== undefined ? Number(m[2]) : start;
  return end >= start ? { start, end } : null;
}

// 结论串里承载"可检索错误码"的字段（与账本 grammar 严格一致）
export function errorCodeToken(result) {
  let m = result.match(/^failure:score=(?:10|[0-9]):(.+?):fix=#\d+/);
  if (m) return m[1];
  m = result.match(/^failure:infra:(.+)$/);
  if (m) return m[1];
  return null;
}

const resolvePath = (p) => (isAbsolute(p) ? p : resolve(process.cwd(), p));

function isInside(child, parent) {
  if (!parent) return false;
  const rel = relative(resolvePath(parent), resolvePath(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

// ---------- 单文件 v2 校验 ----------
// opts.expectedResult: stage done 传入的 --result（提供时额外校验 fm.result 与之一致）
// 返回 { errs: [], warns: [], fm }
export function validateKnowledgeFile(absPath, config, opts = {}) {
  const errs = [];
  const warns = [];
  const fn = basename(absPath);
  const parentDir = basename(dirname(absPath));
  const dirKind = parentDir === "details" ? "details" : parentDir === "scratch" ? "scratch" : null;

  const buf = readFileSync(absPath);
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    errs.push("文件带 UTF-8 BOM（必须 UTF-8 无 BOM）");
  }
  const content = buf.toString("utf8");
  const { fm, body, error: fmError } = parseFrontmatter(content);
  if (!fm) {
    errs.push(fmError || "缺 frontmatter（v2 必需，见 references/knowledge-format.md）");
    return { errs, warns, fm: null };
  }

  // 必填字段
  for (const k of FM_REQUIRED) {
    if (fm[k] === undefined || fm[k] === "") errs.push(`frontmatter 缺必填字段: ${k}`);
  }

  // H1（frontmatter 之后第一个非空行）
  const firstLine = body.split(/\r?\n/).find((l) => l.trim());
  if (!firstLine || !/^# \S/.test(firstLine)) {
    errs.push('缺一级标题（frontmatter 后首个非空行须为 "# {ErrorCode}: {简述}"）');
  }

  // schema
  if (fm.schema !== undefined && fm.schema !== "raw-knowledge/2") {
    errs.push(`schema 必须为 raw-knowledge/2，收到: ${fm.schema}`);
  }

  // 注册表与 config 真值互验（防串台核心）
  const jobCodes = config.jobCodes || {};
  const jobByName = new Map((config.jobs || []).map((j) => [j.name, j]));
  if (fm.job !== undefined) {
    const job = jobByName.get(fm.job);
    if (!job) {
      errs.push(`frontmatter.job "${fm.job}" 不在配置 jobs[] 中`);
    } else {
      if (fm.job_path !== job.path) {
        errs.push(`frontmatter.job_path 与配置中该任务的 path 不一致（fm=${fm.job_path}, config=${job.path}）`);
      }
      const expectedCode = jobCodes[fm.job];
      if (!expectedCode) {
        errs.push(`任务 "${fm.job}" 缺 jobCodes 注册表条目（在技能 config.json 补登记后再验收）`);
      } else if (fm.job_code !== expectedCode) {
        errs.push(`frontmatter.job_code 与注册表不一致（fm=${fm.job_code}, 注册表=${expectedCode}）`);
      }
    }
  }
  if (fm.base_url !== undefined && config.jenkins?.baseUrl && fm.base_url !== config.jenkins.baseUrl) {
    errs.push(`frontmatter.base_url 与配置 jenkins.baseUrl 不一致（fm=${fm.base_url}, config=${config.jenkins.baseUrl}）`);
  }

  // 文件名语法 + 文件名↔frontmatter 一致（recurrence- 前缀文件跳过身份解析，身份以 frontmatter 为准）
  let fnIdentity = null;
  const isRecurrence = fn.startsWith("recurrence-");
  if (!isRecurrence) {
    const codes = Object.values(jobCodes).sort((a, b) => b.length - a.length);
    for (const code of codes) {
      const re = new RegExp("^" + code + "-(\\d+)(?:-(\\d+))?-([A-Za-z][A-Za-z0-9_]*)-([A-Za-z0-9][A-Za-z0-9-]*)\\.md$");
      const m = fn.match(re);
      if (m) { fnIdentity = { code, start: +m[1], end: m[2] !== undefined ? +m[2] : +m[1], errCode: m[3] }; break; }
    }
    if (!fnIdentity) {
      errs.push(`文件名不符合 v2 命名语法 {{jobCode}-{fail}[-{end}]-{ErrorCode}-{ShortDesc}.md，jobCode 须为注册表中的码`);
    }
  }

  const range = parseFailRange(fm.fail_builds);
  if (!range) {
    errs.push(`frontmatter.fail_builds 须为 "单值" 或 "起-止" 数字区间，收到: ${fm.fail_builds}`);
  }
  if (fnIdentity && range) {
    if (fnIdentity.start !== range.start || fnIdentity.end !== range.end) {
      errs.push(`文件名构建区间 (#${fnIdentity.start}-#${fnIdentity.end}) 与 frontmatter.fail_builds (${fm.fail_builds}) 不一致`);
    }
    if (fnIdentity.code !== fm.job_code) {
      errs.push(`文件名 jobCode (${fnIdentity.code}) 与 frontmatter.job_code (${fm.job_code}) 不一致`);
    }
    if (fnIdentity.errCode !== fm.error_code) {
      errs.push(`文件名 ErrorCode (${fnIdentity.errCode}) 与 frontmatter.error_code (${fm.error_code}) 不一致`);
    }
  }

  const fixBuild = Number(fm.fix_build);
  if (!Number.isInteger(fixBuild) || fixBuild <= 0) {
    errs.push(`frontmatter.fix_build 须为正整数，收到: ${fm.fix_build}`);
  } else if (range && fixBuild <= range.end) {
    errs.push(`frontmatter.fix_build (#${fixBuild}) 必须大于失败组末尾 (#${range.end})`);
  }

  // error_code 字符集 + token 可检索性
  if (fm.error_code !== undefined && !ERROR_CODE_RE.test(fm.error_code)) {
    errs.push(`frontmatter.error_code 字符集非法（[A-Za-z][A-Za-z0-9_]*，禁 ":" "#" 和连字符）: ${fm.error_code}`);
  }

  // score 与目录分档（文件不在 details|scratch 目录下时跳过，如单文件验收临时路径）
  const score = Number(fm.score);
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    errs.push(`frontmatter.score 须为 0-10 整数，收到: ${fm.score}`);
  } else if (dirKind === "details" && score < 8) {
    errs.push(`score=${score} 但文件在 details/（≥8 才入 details）`);
  } else if (dirKind === "scratch" && (score < 5 || score > 7)) {
    errs.push(`score=${score} 但文件在 scratch/（5-7 入 scratch；<5 不落文件）`);
  }

  // result 串 grammar + 三处一致 + token 在正文
  const effectiveResult = opts.expectedResult ?? fm.result;
  if (fm.result !== undefined && !RESULT_PATTERNS.some((re) => re.test(fm.result))) {
    errs.push(`frontmatter.result 不符合结论串 grammar: ${fm.result}`);
  }
  if (opts.expectedResult && fm.result !== opts.expectedResult) {
    errs.push(`frontmatter.result 与 stage --result 不一致（fm=${fm.result}, cli=${opts.expectedResult}）`);
  }
  if (effectiveResult) {
    const token = errorCodeToken(effectiveResult);
    if (token) {
      if (fm.error_code !== undefined && fm.error_code !== token) {
        errs.push(`frontmatter.error_code (${fm.error_code}) 与结论串 token (${token}) 不一致`);
      }
      if (!body.toLowerCase().includes(token.toLowerCase())) {
        errs.push(`正文（frontmatter 之外）不含错误码 token "${token}"——token 只出现在 frontmatter 里等于检查被架空，标题/正文必须可检索可读到`);
      }
    }
    const fixMatch = effectiveResult.match(/fix=#(\d+)/);
    if (fixMatch && Number(fixMatch[1]) !== fixBuild) {
      errs.push(`结论串 fix=#${fixMatch[1]} 与 frontmatter.fix_build (#${fixBuild}) 不一致`);
    }
    const see = effectiveResult.match(/:see=(.+)$/);
    if (see) {
      const seeAbs = resolvePath(see[1]);
      const rawDir = config.knowledgeBase?.rawDir ? expandHome(config.knowledgeBase.rawDir) : null;
      const wikiDir = config.knowledgeBase?.wikiDir ? expandHome(config.knowledgeBase.wikiDir) : null;
      if (!existsSync(seeAbs) || (!isInside(seeAbs, rawDir) && !isInside(seeAbs, wikiDir))) {
        errs.push(`result 的 :see= 必须指向 rawDir/wikiDir 内已存在的知识文件，收到: ${see[1]}`);
      }
    }
  }

  // 可选字段宽松校验
  if (fm.primary_fix_commit !== undefined && !/^[0-9a-f]{7,40}$/.test(fm.primary_fix_commit)) {
    warns.push(`primary_fix_commit 不是 7-40 位 hex SHA: ${fm.primary_fix_commit}`);
  }
  if (fm.recorded_at !== undefined && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(fm.recorded_at)) {
    warns.push(`recorded_at 非本地时间格式 YYYY-MM-DDTHH:mm(:ss): ${fm.recorded_at}`);
  }

  // Warning Trend 生效分界（ISO 字符串字典序与时间序一致，分钟/秒精度可直接比较）
  if (
    fm.recorded_at !== undefined &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(fm.recorded_at) &&
    String(fm.recorded_at) >= WARNING_TREND_EFFECTIVE_AT &&
    !/^##\s+Warning Trend\s*$/m.test(body)
  ) {
    errs.push(
      `缺 "## Warning Trend" 必填节（recorded_at ${fm.recorded_at} ≥ 生效时刻 ${WARNING_TREND_EFFECTIVE_AT} 的新文件必须携带：fail/fix 构建警告计数 + 趋势一句话，见 knowledge-format.md）`
    );
  }

  return { errs, warns, fm, range, isRecurrence };
}

// ---------- CLI ----------
function parseArgs(argv) {
  const args = { config: join(scriptDir, "..", "config.json"), file: null, listCodes: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config") args.config = argv[++i];
    else if (argv[i] === "--file") args.file = argv[++i];
    else if (argv[i] === "--list-codes") args.listCodes = true;
    else { console.error(`未知参数: ${argv[i]}`); process.exit(2); }
  }
  return args;
}

function walkMd(dir, acc) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith(".md")) acc.push(join(dir, e.name));
  }
  return acc;
}

// ---------- CLI（仅当作为主模块运行时执行；被 session.mjs import 时不产生副作用） ----------
function main() {
const { config: configPath, file: fileArg, listCodes } = parseArgs(process.argv.slice(2));
const config = loadConfig(configPath);
const rawDir = expandHome(config.knowledgeBase.rawDir);
const trackFile = expandHome(config.trackFile);
const track = existsSync(trackFile)
  ? JSON.parse(readFileSync(trackFile, "utf8").replace(/^\uFEFF/, ""))
  : null;

// --list-codes：在用 token 清单（词表漂移巡检，token 铸造纪律第 3 条的配套工具）
if (listCodes) {
  const codeFiles = [];
  walkMd(join(rawDir, "details"), codeFiles);
  walkMd(join(rawDir, "scratch"), codeFiles);
  const codes = new Map();
  for (const f of codeFiles) {
    try {
      const { fm } = parseFrontmatter(readFileSync(f, "utf8"));
      if (fm?.error_code) {
        if (!codes.has(fm.error_code)) codes.set(fm.error_code, []);
        codes.get(fm.error_code).push(basename(f));
      }
    } catch { /* 单文件读失败不阻塞清单 */ }
  }
  console.log(`在用 error_code token 共 ${codes.size} 个（${codeFiles.length} 个知识文件）：`);
  for (const [code, fs] of [...codes.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${code.padEnd(28)} ×${fs.length}  ${fs.join(", ")}`);
  }
  process.exit(0);
}

let totalErr = 0;
let totalWarn = 0;
const files = [];

if (fileArg) {
  const abs = resolvePath(fileArg);
  if (!existsSync(abs)) { console.error(`文件不存在: ${fileArg}`); process.exit(2); }
  files.push(abs);
} else {
  walkMd(join(rawDir, "details"), files);
  walkMd(join(rawDir, "scratch"), files);
}

const identities = []; // 唯一性检查用 { jobCode, range, fn }

for (const f of files) {
  const { errs, warns, fm, range, isRecurrence } = validateKnowledgeFile(f, config);
  const rel = relative(process.cwd(), f) || f;

  // 账本交叉核对（单文件与全库都做；无账本/缺键 = warn，值冲突 = error）
  if (fm && track && range) {
    for (let b = range.start; b <= range.end; b++) {
      const key = `${fm.job_path}#${b}`;
      const val = track.analyzed?.[key];
      if (val === undefined) warns.push(`账本缺键 ${key}（未落账或会话进行中）`);
      else {
        const t = errorCodeToken(val);
        if (t && fm.error_code && t !== fm.error_code) errs.push(`账本 ${key} 的 token (${t}) 与文件 error_code (${fm.error_code}) 不一致`);
      }
    }
  }

  for (const e of errs) console.error(`[ERROR] ${rel}: ${e}`);
  for (const w of warns) console.warn(`[WARN]  ${rel}: ${w}`);
  totalErr += errs.length;
  totalWarn += warns.length;

  if (fm && range && !isRecurrence) identities.push({ jobCode: fm.job_code, range, fn: basename(f), jobPath: fm.job_path });
}

// 唯一性：同 jobPath 下失败区间不得被两个非 recurrence 文件认领
for (let i = 0; i < identities.length; i++) {
  for (let j = i + 1; j < identities.length; j++) {
    const a = identities[i], b = identities[j];
    if (a.jobPath !== b.jobPath) continue;
    if (a.range.start <= b.range.end && b.range.start <= a.range.end) {
      console.error(`[ERROR] 唯一性冲突: ${a.fn} 与 ${b.fn} 认领了重叠的失败构建区间`);
      totalErr++;
    }
  }
}

console.log(`\nvalidated: ${files.length} 个知识文件 | ERROR: ${totalErr} | WARN: ${totalWarn}`);
process.exit(totalErr > 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
