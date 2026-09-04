// report-data.mjs — 从 data/ 目录构建 viewer/API 载荷。build-report 与 serve 共用，保证两条出口数据一致。
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { extractNotes, analysisIsStale } from './analysis.mjs';
import { coreImage, acceleration, loadPresence, presenceFor } from './report-extras.mjs';

export function listWeekFiles(weeksDir) {
  return readdirSync(weeksDir).filter((f) => /^\d{4}-W\d{2}\.json$/.test(f)).sort();
}

export function buildPayload(weeksDir, { readmeCap = 2400 } = {}) {
  if (!Number.isInteger(readmeCap) || readmeCap < 0) throw new Error('readme-cap 必须是非负整数');
  readmeCap = Math.min(readmeCap, 2400);
  const reposDir = join(dirname(weeksDir), 'repos');
  const presenceDocs = loadPresence(join(dirname(dirname(weeksDir)), 'backfill'));
  const weekFiles = listWeekFiles(weeksDir);
  if (!weekFiles.length) throw new Error(`${weeksDir} 下没有周快照`);
  const weeks = weekFiles.map((f) => {
    const doc = JSON.parse(readFileSync(join(weeksDir, f), "utf8"));
    const analysisFile = join(weeksDir, f.replace(".json", ".analysis.md"));
    const analysis = existsSync(analysisFile) ? readFileSync(analysisFile, 'utf8') : null;
    const notes = extractNotes(analysis ?? '');
    const counts = { new: 0, recurring: 0, returning: 0 };
    const repos = doc.repos.map((r) => {
      if (r.entry_status && counts[r.entry_status] !== undefined) counts[r.entry_status]++;
      const extra = {};
      const img = coreImage(r.readme_excerpt, r.full_name);
      if (img) extra.coreImg = img;
      const accel = acceleration(reposDir, r, doc.week);
      if (accel) extra.accel = accel;
      const presence = presenceFor(presenceDocs, r.full_name, doc.week);
      if (presence) extra.presence = presence;
      if (notes.has(r.full_name)) extra.note = notes.get(r.full_name);
      if (r.source_status) extra.source_status = r.source_status;
      for (const [from,to] of Object.entries({created_at:'created', pushed_at:'pushed', license:'license', open_issues:'issues'})) {
        if (r[from] !== undefined) extra[to] = r.api_ok === false ? '' : (r[from] ?? '');
      }
      return {
        rank: r.rank,
        full_name: r.full_name,
        url: r.url,
        description: r.description,
        language: r.language,
        stars_total: r.stars_total,
        stars_week: r.stars_week,
        entry_status: r.entry_status ?? null,
        stars_prev: r.stars_prev ?? null,
        stars_delta: r.stars_delta ?? null,
        topics: r.topics ?? [],
        homepage: r.homepage || null,
        created_at: r.created_at ?? null,
        pushed_at: r.pushed_at ?? null,
        forks: r.forks ?? null,
        api_ok: r.api_ok ?? null,
        readme_excerpt: r.readme_excerpt ? r.readme_excerpt.slice(0, readmeCap) : "",
        readme: r.readme_excerpt ? r.readme_excerpt.slice(0, readmeCap) : "",
        ...extra,
      };
    });
    return {
      week: doc.week,
      captured_at: doc.captured_at,
      analysis,
      capturedAt: doc.captured_at,
      analyzed: !!analysis,
      ...(analysisIsStale(doc, analysis) ? { staleAt: doc.staleAt, staleReason: doc.staleReason } : {}),
      counts,
      repos,
    };
  });
  return { schema: "trending-report/1", generated_at: new Date().toISOString(), weeks };
}

export function weekSummary(weeksDir, file) {
  const doc = JSON.parse(readFileSync(join(weeksDir, file), "utf8"));
  const counts = { new: 0, recurring: 0, returning: 0 };
  for (const r of doc.repos) if (r.entry_status && counts[r.entry_status] !== undefined) counts[r.entry_status]++;
  return {
    week: doc.week,
    captured_at: doc.captured_at,
    repos: doc.repos.length,
    counts,
    top1: doc.repos[0]?.full_name ?? null,
    top1_stars_week: doc.repos[0]?.stars_week ?? null,
    has_analysis: existsSync(join(weeksDir, file.replace(".json", ".analysis.md"))),
  };
}
