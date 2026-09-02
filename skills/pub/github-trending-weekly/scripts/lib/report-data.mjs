// report-data.mjs — 从 data/ 目录构建 viewer/API 载荷。build-report 与 serve 共用，保证两条出口数据一致。
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function listWeekFiles(weeksDir) {
  return readdirSync(weeksDir).filter((f) => /^\d{4}-W\d{2}\.json$/.test(f)).sort();
}

export function buildPayload(weeksDir, { readmeCap = 900 } = {}) {
  const weekFiles = listWeekFiles(weeksDir);
  if (!weekFiles.length) throw new Error(`${weeksDir} 下没有周快照`);
  const weeks = weekFiles.map((f) => {
    const doc = JSON.parse(readFileSync(join(weeksDir, f), "utf8"));
    const analysisFile = join(weeksDir, f.replace(".json", ".analysis.md"));
    const counts = { new: 0, recurring: 0, returning: 0 };
    const repos = doc.repos.map((r) => {
      if (r.entry_status && counts[r.entry_status] !== undefined) counts[r.entry_status]++;
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
      };
    });
    return {
      week: doc.week,
      captured_at: doc.captured_at,
      analysis: existsSync(analysisFile) ? readFileSync(analysisFile, "utf8") : null,
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
