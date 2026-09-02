// validate.mjs — 数据契约校验器。返回错误数组（空 = 合法），退出码门禁由调用方决定。
import { NAME_RE, WEEK_RE } from "./util.mjs";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T/;

function isInt(n) { return Number.isInteger(n); }

export function validateWeek(doc, { expectedCount = 20 } = {}) {
  const errs = [];
  const where = (i) => (i === undefined ? "" : `repos[${i}] `);
  if (doc?.schema !== "trending-week/1") errs.push(`schema 必须是 "trending-week/1"，实际 ${JSON.stringify(doc?.schema)}`);
  if (!WEEK_RE.test(doc?.week ?? "")) errs.push(`week 格式非法: ${doc?.week}（期望 YYYY-Www）`);
  if (typeof doc?.captured_at !== "string" || !ISO_DATE_RE.test(doc.captured_at)) errs.push("captured_at 缺失或非 ISO 时间");
  if (!Array.isArray(doc?.repos)) { errs.push("repos 不是数组"); return errs; }
  if (doc.repos.length !== expectedCount) errs.push(`repos 条数 ${doc.repos.length} ≠ ${expectedCount}`);

  doc.repos.forEach((r, i) => {
    const w = where(i);
    if (!isInt(r.rank)) errs.push(`${w}rank 非整数: ${r.rank}`);
    if (!NAME_RE.test(r.full_name ?? "")) errs.push(`${w}full_name 非法: ${r.full_name}`);
    if (!isInt(r.stars_total) || r.stars_total <= 0) errs.push(`${w}stars_total 非法: ${r.stars_total}`);
    if (!isInt(r.stars_week) || r.stars_week <= 0) errs.push(`${w}stars_week 非法: ${r.stars_week}`);
    if (r.language !== null && typeof r.language !== "string") errs.push(`${w}language 必须是字符串或 null`);
    if (typeof r.description !== "string") errs.push(`${w}description 必须是字符串`);
    // enrich 阶段可选字段：出现即校验
    if (r.api_ok !== undefined && typeof r.api_ok !== "boolean") errs.push(`${w}api_ok 必须是布尔`);
    if (r.topics !== undefined && !Array.isArray(r.topics)) errs.push(`${w}topics 必须是数组`);
    if (r.readme_excerpt !== undefined && typeof r.readme_excerpt !== "string") errs.push(`${w}readme_excerpt 必须是字符串`);
    if (r.entry_status !== undefined && !["new", "recurring", "returning"].includes(r.entry_status)) {
      errs.push(`${w}entry_status 非法: ${r.entry_status}`);
    }
    if (r.stars_prev !== undefined && (!isInt(r.stars_prev) || r.stars_prev < 0)) errs.push(`${w}stars_prev 非法: ${r.stars_prev}`);
    if (r.stars_delta !== undefined && !isInt(r.stars_delta)) errs.push(`${w}stars_delta 非法: ${r.stars_delta}`);
  });

  const ranks = doc.repos.map((r) => r.rank).filter(isInt).sort((a, b) => a - b);
  const expectRanks = Array.from({ length: ranks.length }, (_, k) => k + 1);
  if (JSON.stringify(ranks) !== JSON.stringify(expectRanks)) errs.push(`rank 序列不连续或有重复: ${ranks.join(",")}`);
  const names = new Set(doc.repos.map((r) => r.full_name));
  if (names.size !== doc.repos.length) errs.push("存在重复 full_name");
  return errs;
}

export function validateHistory(doc) {
  const errs = [];
  if (doc?.schema !== "repo-history/1") errs.push(`schema 必须是 "repo-history/1"，实际 ${JSON.stringify(doc?.schema)}`);
  if (!NAME_RE.test(doc?.full_name ?? "")) errs.push(`full_name 非法: ${doc?.full_name}`);
  if (!WEEK_RE.test(doc?.first_seen_week ?? "")) errs.push(`first_seen_week 格式非法: ${doc?.first_seen_week}`);
  if (!Array.isArray(doc?.snapshots) || doc.snapshots.length === 0) { errs.push("snapshots 缺失或为空"); return errs; }
  const weeks = new Set();
  doc.snapshots.forEach((s, i) => {
    const w = `snapshots[${i}] `;
    if (!WEEK_RE.test(s.week ?? "")) errs.push(`${w}week 格式非法: ${s.week}`);
    if (!isInt(s.rank) || s.rank <= 0) errs.push(`${w}rank 非法: ${s.rank}`);
    if (!isInt(s.stars_total) || s.stars_total <= 0) errs.push(`${w}stars_total 非法: ${s.stars_total}`);
    if (!isInt(s.stars_week) || s.stars_week <= 0) errs.push(`${w}stars_week 非法: ${s.stars_week}`);
    if (weeks.has(s.week)) errs.push(`${w}week ${s.week} 重复出现（快照必须每周至多一条）`);
    weeks.add(s.week);
  });
  return errs;
}

// --full 模式追加：周文件 entry_status 齐备 + 历史文件与周快照互相咬合
export function crossCheckWeekHistory(weekDoc, historyDoc) {
  const errs = [];
  const repo = weekDoc.repos.find((r) => r.full_name === historyDoc.full_name);
  if (!repo) return [`历史文件 ${historyDoc.full_name} 不属于本周榜单`];
  if (!repo.entry_status) errs.push(`${repo.full_name} 缺 entry_status（update-history 未跑或中断）`);
  const snap = historyDoc.snapshots.find((s) => s.week === weekDoc.week);
  if (!snap) errs.push(`${repo.full_name} 历史中缺本周 ${weekDoc.week} 快照`);
  else if (snap.stars_total !== repo.stars_total) {
    errs.push(`${repo.full_name} 历史快照 stars_total(${snap.stars_total}) 与周文件(${repo.stars_total}) 不一致`);
  }
  return errs;
}
