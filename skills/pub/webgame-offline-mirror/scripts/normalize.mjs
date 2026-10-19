#!/usr/bin/env node
// Filename normalizer: strip content-hash (+build-id) suffixes from mirrored
// Vite-style asset names so the repo keeps stable, readable paths across
// upstream version bumps (main-CNPvahTq-mvexvs3z.js -> main.js). Layer 5 of the
// pipeline (see references/normalize.md): run AFTER the fetch layers converge
// and BEFORE the final offline verification, which must exercise the
// normalized tree.
//
// What it does, idempotently:
//   1. detect the build id (flag or most-repeated trailing token) and hash
//      length (shortest hash run across build-id-suffixed names; Vite emits
//      8 base64url chars — dashes and underscores included, e.g. B-giygOW)
//   2. rename `stem-<hash>-<buildid>.ext` -> `stem.ext` (lazy stem + exact
//      hash length, anchored by the build id — the only split that survives
//      hashes containing dashes and stems containing semantic dashes)
//   3. collision groups (several hashes stripping to one name): the entry
//      referenced by index.html <script src> keeps the name, others get -2/-3;
//      --alias for pretty names. `.orig` patch backups rename along.
//   4. no-build-id hashed chunks are NEVER pattern-matched (never-melt-ice.png
//      is a legal name) — they need an explicit --rule
//   5. rewrite literal references in text assets (basenames are hash-unique;
//      ?v= queries survive; .orig backups stay pristine)
//   6. keep pristine server bytes in --cache, the cumulative rename map in
//      --map, and self-check: roundtrip(cache) === site, zero leftover
//      filename-shaped hash literals, zero hashed files left on disk
//
// Usage:
//   node normalize.mjs --mirror ./mirror [--build-id ID] [--hash-len N]
//     [--rule '^three-[A-Za-z0-9_-]{8}\\.js$=three.js'] [--alias 'server=repo']
//     [--map rename-map.json] [--cache .mirror-cache] [--dry]
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, copyFileSync } from "node:fs";
import { join, dirname, extname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const flags = (k) => process.argv.filter((_, i, a) => a[i - 1] === "--" + k);
const MIRROR = resolve(arg("mirror", "./mirror"));
const MAP = resolve(arg("map", join(MIRROR, "..", "rename-map.json")));
const CACHE = resolve(arg("cache", join(MIRROR, "..", ".mirror-cache")));
const DRY = process.argv.includes("--dry");
if (!existsSync(MIRROR)) { console.error("usage: normalize.mjs --mirror <dir> [--build-id ID] [--hash-len N] [--rule re=name] [--alias s=r] [--dry]"); process.exit(2); }

const TEXT_EXT = new Set([".js", ".mjs", ".css", ".html", ".htm", ".json", ".xml", ".txt", ".webmanifest", ".svg", ".vtt"]);
const RULES = flags("rule").map((s) => { const i = s.lastIndexOf("="); return { re: new RegExp(s.slice(0, i)), to: s.slice(i + 1) }; });
const ALIASES = new Map(flags("alias").map((s) => s.split("=", 2)));

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(MIRROR);

// ---------- 1. detect build id + hash length ----------
function detectBuildId(names) {
  const counts = new Map();
  for (const n of names) {
    const m = n.match(/-([A-Za-z0-9_-]+)-([A-Za-z0-9_-]{4,16})\.[a-z0-9]+$/i);
    if (m) counts.set(m[2], (counts.get(m[2]) || 0) + 1);
  }
  const [id, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  return n >= 3 ? id : undefined; // a build id repeats across many assets
}
const BID = arg("build-id") || detectBuildId(files.map((f) => basename(f)));
if (!BID) {
  console.log("no build-id suffixes detected — nothing to strip (pass --build-id if you know one exists)");
  process.exit(0);
}
const hashRuns = files.map((f) => basename(f).match(new RegExp(`-([A-Za-z0-9_-]+)-${BID}\\.[a-z0-9]+$`, "i"))).filter(Boolean).map((m) => m[1].length);
const HASH_LEN = Number(arg("hash-len", 0)) || Math.min(...hashRuns);
if (HASH_LEN < 5 || HASH_LEN > 32 || hashRuns.some((l) => l < HASH_LEN)) { console.error(`implausible hash length ${HASH_LEN} (runs: ${[...new Set(hashRuns)].join(",")}) — pass --hash-len if the site really is shaped like this`); process.exit(1); }

// ---------- 2. plan renames ----------
const stemRe = new RegExp(`^(.*?)-[A-Za-z0-9_-]{${HASH_LEN}}-${BID}(\\.[^.]+)$`);
const entryScripts = new Set();
if (existsSync(join(MIRROR, "index.html"))) {
  for (const m of readFileSync(join(MIRROR, "index.html"), "utf8").matchAll(/(?:src|href)\s*=\s*["'][^"']*\/([^/"']+\.js)["']/g)) entryScripts.add(m[1]);
}
const strip = (name) => {
  const isOrig = name.endsWith(".orig");
  const stem = isOrig ? name.slice(0, -5) : name;
  let m = stem.match(stemRe);
  if (m) return { key: m[1] + m[2], to: m[1] + m[2] + (isOrig ? ".orig" : "") };
  for (const r of RULES) if (r.re.test(stem)) return { key: r.to, to: r.to + (isOrig ? ".orig" : "") };
  return null;
};
const byKey = new Map();
for (const f of files) {
  const s = strip(basename(f));
  if (!s) continue;
  if (!byKey.has(s.key)) byKey.set(s.key, new Map());
  const stem = basename(f).replace(/\.orig$/, "");
  byKey.get(s.key).set(stem, s.to);
}
const plan = new Map(); // server basename -> repo basename
for (const [key, stems] of byKey) {
  if (stems.size === 1) { for (const [s, t] of stems) plan.set(s, t); continue; }
  // collision: index.html entry keeps the name, others get -2/-3 (or --alias)
  let n = 2;
  for (const s of [...stems.keys()].sort((a, b) => (entryScripts.has(a) ? -1 : entryScripts.has(b) ? 1 : 0))) {
    const to = entryScripts.has(s) ? key : ALIASES.get(s) || key.replace(/(\.[^.]+)$/, `-${n++}$1`);
    plan.set(s, to);
    if (stems.has(s + ".orig")) plan.set(s + ".orig", to + ".orig");
  }
}
for (const [s, t] of ALIASES) if (plan.has(s)) plan.set(s, t);
// a stripped name must not land on an existing unhashed file
const onDisk = new Set(files.map((f) => basename(f)));
for (const [s, t] of plan) if (onDisk.has(t) && !plan.has(t)) { console.error(`"${t}" (from ${s}) already exists as a real file`); process.exit(1); }

if (DRY) {
  console.log(`[dry] build id ${BID}, hash length ${HASH_LEN}`);
  if (process.env.NORM_DEBUG) console.log("[debug] entryScripts:", JSON.stringify([...entryScripts]), "byKey:", JSON.stringify([...byKey].map(([k, v]) => [k, [...v.keys()]])), "plan:", JSON.stringify([...plan]));
  for (const [s, t] of [...plan].sort()) console.log(`  ${s} -> ${t}`);
  process.exit(0);
}

// ---------- 3. rename + cache pristine bytes ----------
let cached = 0;
if (plan.size) {
  for (const f of files) {
    const s = basename(f);
    if (!plan.has(s)) continue;
    const orig = s.endsWith(".orig") ? f : f + ".orig";
    const pristine = existsSync(orig) ? orig : f; // patched chunks cache their pre-patch backup
    const cachePath = join(CACHE, f.slice(MIRROR.length + 1));
    if (!existsSync(cachePath)) { mkdirSync(dirname(cachePath), { recursive: true }); copyFileSync(pristine, cachePath); cached++; }
    renameSync(f, join(dirname(f), plan.get(s)));
  }
}

// ---------- 4. rewrite literal references in text assets ----------
const rewrite = (text, map) => {
  let n = 0;
  for (const [from, to] of map) if (text.includes(from)) { n += text.split(from).length - 1; text = text.split(from).join(to); }
  return { text, n };
};
let rewritten = 0, replacements = 0;
for (const f of walk(MIRROR)) {
  if (f.endsWith(".orig") || !TEXT_EXT.has(extname(f))) continue;
  const { text, n } = rewrite(readFileSync(f, "utf8"), plan);
  if (n) { writeFileSync(f, text); rewritten++; replacements += n; }
}

// ---------- 5. cumulative map + self-check ----------
const prev = existsSync(MAP) ? JSON.parse(readFileSync(MAP, "utf8")) : {};
const diskNow = new Set(walk(MIRROR).map((f) => basename(f)));
const map = { ...prev };
for (const [s, t] of plan) map[s] = t;
for (const k of Object.keys(map)) if (!diskNow.has(map[k])) delete map[k];
writeFileSync(MAP, JSON.stringify(map, null, 2) + "\n");

// leftover filename-shaped hash literals / hashed files on disk -> hard fail
let bad = 0;
const leftoverRe = new RegExp(`-[A-Za-z0-9_-]{${HASH_LEN}}-${BID}\\.[a-z0-9]+`, "i");
for (const f of walk(MIRROR)) {
  const s = basename(f);
  if (s.endsWith(".orig")) continue;
  if (leftoverRe.test(s)) { console.error(`HASHED FILE STILL ON DISK: ${s}`); bad++; }
  if (TEXT_EXT.has(extname(f)) && (readFileSync(f, "utf8").match(new RegExp(leftoverRe.source, "gi")) || []).length) {
    console.error(`LEFTOVER HASH LITERAL in ${f.slice(MIRROR.length + 1)} (a reference was not rewritten)`); bad++;
  }
}
// roundtrip: every cached pristine byte must reproduce the site file
let rtOk = 0, rtBad = 0;
if (existsSync(CACHE)) {
  for (const cf of walk(CACHE)) {
    const server = basename(cf);
    const repo = map[server];
    if (!repo) continue;
    const siteFile = join(MIRROR, cf.slice(CACHE.length + 1).slice(0, -server.length), repo);
    if (!existsSync(siteFile)) { console.error(`ROUNDTRIP: repo file for ${server} missing`); rtBad++; continue; }
    const a = readFileSync(cf), b = readFileSync(siteFile);
    const ok = TEXT_EXT.has(extname(siteFile)) && !siteFile.endsWith(".orig") ? a.equals(b) || Buffer.from(rewrite(a.toString("utf8"), new Map(Object.entries(map))).text).equals(b) : a.equals(b);
    ok ? rtOk++ : (console.error(`ROUNDTRIP: ${server} differs from rewrite(cache)`), rtBad++);
  }
}
console.log(`normalized ${plan.size} files, rewrote refs in ${rewritten} files (${replacements} replacements), cached ${cached}; build id ${BID}, hash length ${HASH_LEN}`);
console.log(`self-check: leftovers ${bad}, roundtrip ok ${rtOk} bad ${rtBad}`);
if (bad || rtBad) process.exit(1);
