// util.mjs — 周编号、数字解析、HTML entity、路径约定。零依赖，Node >= 18。
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const WEEK_RE = /^\d{4}-W\d{2}$/;
export const NAME_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function parseNum(s) {
  // "41,614" -> 41614；非法返回 NaN
  if (typeof s !== "string") return NaN;
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isSafeInteger(n) ? n : NaN;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name] ?? m);
}

export function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

// ISO 周编号：返回 "YYYY-Www"
export function isoWeekId(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // 本周的星期四
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// "YYYY-Www" -> 该周星期一的 UTC Date
export function weekIdToDate(weekId) {
  const m = WEEK_RE.exec(weekId);
  if (!m) throw new Error(`非法周编号: ${weekId}`);
  const [y, w] = [Number(weekId.slice(0, 4)), Number(weekId.slice(6))];
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4.getTime() - (day - 1) * 86400000);
  return new Date(week1Mon.getTime() + (w - 1) * 7 * 86400000);
}

export function prevWeekId(weekId) {
  return isoWeekId(new Date(weekIdToDate(weekId).getTime() - 86400000));
}

// workspace 路径约定
export function paths(ws) {
  const weeks = join(ws, "data", "weeks");
  const repos = join(ws, "data", "repos");
  const report = join(ws, "report");
  const wiki = join(ws, "wiki");
  mkdirSync(weeks, { recursive: true });
  mkdirSync(repos, { recursive: true });
  return { ws, weeks, repos, report, wiki };
}

export function repoFileName(fullName) {
  return `${fullName.replace("/", "__")}.json`;
}

export function fatal(msg) {
  console.error(`[github-trending-weekly] ${msg}`);
  process.exit(1);
}

export function parseArgs(argv, spec) {
  // spec: { name: { required?:bool, default?:any, flag?:bool } }
  const out = {};
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) fatal(`无法识别的参数: ${a}`);
    const key = a.slice(2);
    const s = spec[key];
    if (!s) fatal(`未知参数: ${a}`);
    if (s.flag) { out[key] = true; seen.add(key); continue; }
    const v = argv[++i];
    if (v === undefined) fatal(`参数 ${a} 缺少取值`);
    out[key] = v; seen.add(key);
  }
  for (const [k, s] of Object.entries(spec)) {
    if (s.flag && out[k] === undefined) out[k] = false;
    if (!s.flag && out[k] === undefined) {
      if (s.required && !seen.has(k)) fatal(`缺少必填参数 --${k}`);
      if (s.default !== undefined) out[k] = s.default;
    }
  }
  return out;
}
