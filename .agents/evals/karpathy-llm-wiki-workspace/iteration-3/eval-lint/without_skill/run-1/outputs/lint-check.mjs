// Wiki quality checker — run: node lint-check.mjs
// Checks: broken wiki-links, frontmatter presence/fields, title/filename match,
// date format, type/directory consistency, tag taxonomy, sources references,
// index coverage, orphan pages. Exits non-zero if problems found.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'wiki');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p) : files.push(p);
  }
})(root);

const md = files.filter(f => f.endsWith('.md'));
const pages = md.map(f => path.basename(f, '.md'));
const infra = ['index.md', 'log.md', 'SCHEMA.md']; // structural files, no frontmatter required
const taxonomy = ['architecture', 'training', 'core-concept', 'model', 'attention', 'paper', 'historical'];
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
let problems = 0;

const inbound = {};

for (const f of md) {
  const txt = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

  // 1. Broken wiki-links
  for (const m of txt.matchAll(/\[\[([^\]|#]+?)(?:[|#][^\]]*)?\]\]/g)) {
    const target = m[1].trim();
    (inbound[target] = inbound[target] || []).push(path.basename(f));
    if (!pages.includes(target)) { console.log('BROKEN LINK:', path.basename(f), '->', target); problems++; }
  }

  if (infra.includes(path.basename(f))) continue;

  // 2. Frontmatter presence and required fields
  const fm = txt.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) { console.log('NO FRONTMATTER:', f); problems++; continue; }
  const get = k => { const m = fm[1].match(new RegExp('^' + k + ':\\s*(.*)$', 'm')); return m ? m[1].trim() : undefined; };
  for (const k of ['title', 'created', 'updated', 'type', 'tags', 'sources'])
    if (get(k) === undefined) { console.log('MISSING FIELD:', k, 'in', path.basename(f)); problems++; }

  // 3. Title matches filename (quoted, Title Case per SCHEMA)
  const title = (get('title') || '').replace(/^"|"$/g, '');
  if (title !== path.basename(f, '.md')) { console.log('TITLE MISMATCH:', path.basename(f), 'vs', title); problems++; }

  // 4. Date format YYYY-MM-DD
  for (const k of ['created', 'updated'])
    if (get(k) !== undefined && !dateRe.test(get(k))) { console.log('BAD DATE:', k, '=', get(k), 'in', path.basename(f)); problems++; }

  // 5. type matches directory
  const dir = path.basename(path.dirname(f));
  const expectedType = dir === 'concepts' ? 'concept' : dir === 'sources' ? 'source' : null;
  if (expectedType && get('type') !== expectedType) { console.log('TYPE/DIR MISMATCH:', path.basename(f)); problems++; }

  // 6. Tags in taxonomy, lowercase-kebab-case
  const tags = (get('tags') || '').replace(/[[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
  for (const t of tags)
    if (!taxonomy.includes(t) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t)) { console.log('BAD TAG:', t, 'in', path.basename(f)); problems++; }

  // 7. sources reference existing pages
  const srcs = (get('sources') || '').replace(/[[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean);
  for (const s of srcs)
    if (!pages.includes(s)) { console.log('SOURCE PAGE MISSING:', s, 'in', path.basename(f)); problems++; }
}

// 8. Index coverage: every content page listed in index.md
const idx = fs.readFileSync(path.join(root, 'index.md'), 'utf8');
for (const p of pages)
  if (!infra.includes(p + '.md') && !idx.includes('[[' + p + ']]')) { console.log('NOT IN INDEX:', p); problems++; }

// 9. Orphans: content pages with no inbound links at all (index counts as catalog link)
for (const p of pages)
  if (!infra.includes(p + '.md') && !(inbound[p] || []).length) { console.log('ORPHAN PAGE:', p); problems++; }

console.log(problems === 0 ? 'RESULT: CLEAN — all checks pass' : 'RESULT: PROBLEMS FOUND: ' + problems);
process.exit(problems === 0 ? 0 : 1);
