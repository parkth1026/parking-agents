import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { decodeEntities, repoFileName } from './util.mjs';

export function coreImage(readme, name) {
  const text = (readme || '').replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '');
  const candidates = [];
  for (const m of text.matchAll(/!\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)|<img\b[^>]*>/gi)) {
    const src = m[2]?.replace(/^<|>$/g, '') ?? /\bsrc\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1];
    const alt = m[1] ?? /\balt\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1] ?? '';
    if (!src || /badge|shields\.io|logo|icon|avatars\.|visitor|stargazers|hits[./?]|counter|mascot|sponsor|ko-fi|\/actions\/|\/workflows\//i.test(src + ' ' + alt)) continue;
    if (/\b(?:width|height)=["']?([1-4]?\d)["'\s>]/i.test(m[0])) continue;
    try {
      const url = new URL(decodeEntities(src).replace(/^\/(?!\/)/, ''), `https://raw.githubusercontent.com/${name}/HEAD/`);
      if (!['https:', 'http:'].includes(url.protocol)) continue;
      if (url.hostname === 'github.com' && /^\/[^/]+\/[^/]+\/(blob|raw)\//.test(url.pathname)) { url.hostname = 'raw.githubusercontent.com'; url.pathname = url.pathname.replace(/\/(blob|raw)\//, '/'); }
      candidates.push({ url: url.href, priority: /hero|screenshot|banner|preview|demo|\bui\b/i.test(src + ' ' + alt) ? 1 : 0 });
    } catch { /* invalid image URL: continue to next candidate */ }
  }
  return candidates.sort((a,b) => b.priority - a.priority)[0]?.url;
}
export function acceleration(reposDir, repo, week) {
  const file = join(reposDir, repoFileName(repo.full_name));
  if (!existsSync(file)) return undefined;
  const snapshots = JSON.parse(readFileSync(file, 'utf8')).snapshots ?? [];
  const current = snapshots.find(s => s.week === week);
  const base = snapshots.filter(s => s.week < week).sort((a,b) => a.week.localeCompare(b.week)).at(-1);
  if (!current || !base || !(base.stars_week > 0)) return undefined;
  return { ratio: Math.round(repo.stars_week / base.stars_week * 10) / 10, baseWeek: base.week };
}
export function loadPresence(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => /^\d{4}-W\d{2}\.presence\.json$/.test(f)).sort().map(f => JSON.parse(readFileSync(join(dir,f), 'utf8')));
}
export function presenceFor(docs, name, week) {
  // Latest available daily-presence week at or before the selected report; never borrow future data.
  for (const doc of docs.filter(d => d.week <= week).reverse()) {
    const r = doc.repos?.find(r => r.full_name === name);
    if (r) return { days: r.days_on_list, best: r.best_rank, week: doc.week };
  }
}
