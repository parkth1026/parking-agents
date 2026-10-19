#!/usr/bin/env node
// Generic reference-closure site mirrorer for web games / heavy SPAs.
//
// Layer 1 of three (see references/methodology.md): recursively fetches every
// same-origin URL reachable via LITERAL references in HTML/JS/CSS/JSON text.
// Handles the extraction pitfalls that break naive crawlers (see pitfalls.md):
// unquoted CSS url(), template-literal pairing shifts (solved via hash-anchored
// same-quote regex), per-request timeout + retry + rate-limit backoff.
//
// Layers 2 (family enumeration) and 3 (runtime capture) feed extra URLs via
// --urls-file; this script only downloads, it never guesses families.
//
// Usage:
//   node mirror.mjs --origin https://example.com --out ./mirror
//                   [--urls-file extra-urls.txt] [--seeds /,/legal] [--build-id vX]
//                   [--concurrency 10] [--report report.json]
// Resume-safe: existing non-empty files are kept (and still parsed for refs).
import { writeFileSync, mkdirSync, existsSync, statSync, readFileSync, appendFileSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ORIGIN = arg("origin");
const OUT = arg("out", "./mirror");
const URLS_FILE = arg("urls-file");
const BUILD_ID = arg("build-id", "");      // optional suffix in hashed names, e.g. "-mvexvs3z"
const CONC = Number(arg("concurrency", 10));
const REPORT = arg("report");
const SEEDS = (arg("seeds", "/") || "/").split(",").map((s) => s.trim()).filter(Boolean);
if (!ORIGIN) { console.error("usage: mirror.mjs --origin https://... | file:///dir --out dir"); process.exit(2); }
// file:// origin: read from a local directory instead of HTTP (re-processing an
// existing local copy, and sandbox-proof regression tests)
const FILE_MODE = ORIGIN.startsWith("file:");
const ORIGIN_URL = new URL(ORIGIN);
const BASE_DIR = FILE_MODE ? ORIGIN_URL.pathname.replace(/\/?$/, "/") : null;
const inScope = (u) => FILE_MODE
  ? u.protocol === "file:" && decodeURIComponent(u.pathname).startsWith(BASE_DIR)
  : u.origin === ORIGIN_URL.origin;

const TEXT_EXT = new Set(["js", "mjs", "css", "html", "htm", "xml", "txt", "json", "webmanifest", "vtt", "svg"]);
const ASSET_EXT = new Set([...TEXT_EXT, "png", "jpg", "jpeg", "webp", "avif", "gif", "ico", "glb", "gltf", "bin",
  "mp3", "ogg", "oga", "wav", "m4a", "aac", "flac", "opus", "woff", "woff2", "ttf", "otf",
  "ktx2", "basis", "hdr", "exr", "mp4", "webm", "wasm", "data", "pck", "atlas"]);
const UA = "Mozilla/5.0 webgame-offline-mirror/1.0";

const queue = [];
const seen = new Set();
const done = new Map();
const externals = new Set();
const failures = [];
let fetched = 0;

const enqueue = (urlStr) => {
  if (FILE_MODE && (urlStr === "/" || urlStr === "")) urlStr = ORIGIN; // base dir root
  let u;
  try { u = new URL(urlStr, ORIGIN); } catch { return; }
  if (!inScope(u)) { if (/^https?:/.test(u.protocol)) externals.add(u.href); return; }
  u.hash = "";
  if (seen.has(u.href)) return;
  seen.add(u.href);
  queue.push({ url: u, retries: 0 });
};

const filePathFor = (u) => {
  let p = u.pathname;
  if (FILE_MODE) p = decodeURIComponent(p).slice(BASE_DIR.length);
  if (p === "" ) p = "index.html";
  if (p.endsWith("/")) p += "index.html";
  const last = p.split("/").pop();
  if (last && !last.includes(".")) p += ".html"; // extensionless page routes
  return join(OUT, p.replace(/^\/+/, ""));
};

function extractRefs(text, baseUrl) {
  const refs = new Set();
  const push = (s) => { if (s && s.length <= 500) refs.add(s.trim()); };
  for (const m of text.matchAll(/"([^"\n]{1,500})"|'([^'\n]{1,500})'/g)) push(m[1] ?? m[2]);
  // hash-anchored, same-quote pattern: immune to backtick pairing shifts caused
  // by ${} templates; catches hashed chunk names inside template literals
  const hashSuffix = BUILD_ID ? `(?:-${BUILD_ID})?` : "?";
  const reH = new RegExp(`(["'\`])([^'"\`\\n]{0,200}?-[A-Za-z0-9_]{6,12}${hashSuffix}\\.(?:${[...ASSET_EXT].join("|")}))\\1`, "g");
  for (const m of text.matchAll(reH)) push(m[2]);
  for (const m of text.matchAll(/`([^`\n]{1,500})`/g)) if (!m[1].includes("${")) push(m[1]);
  for (const m of text.matchAll(/url\(\s*(['"]?)([^'")]{1,500})\1\s*\)/gi)) push(m[2]); // unquoted CSS url()
  for (const m of text.matchAll(/(?:src|href|content)=\s*(['"])([^'"]{1,500})\1/gi)) push(m[2]);
  for (const m of text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) push(m[1]); // sitemap
  const out = [];
  for (const raw of refs) {
    if (/^(data|blob|#|mailto:|javascript:)/i.test(raw)) continue;
    const looksPath = /^(\/|\.{1,2}\/)/.test(raw);
    const ext = raw.split(/[?#]/)[0].split(".").pop().toLowerCase();
    if (looksPath || ASSET_EXT.has(ext)) {
      try {
        // file:// has no origin root: emulate http semantics by anchoring
        // root-absolute refs (/x) at the base directory (new URL would send
        // them to the drive root no matter which base is passed)
        const href = FILE_MODE && raw.startsWith("/") && !raw.startsWith("//")
          ? new URL(ORIGIN + raw.slice(1)).href // ORIGIN ends with "/": concat makes a valid absolute URL
          : new URL(raw, baseUrl).href;
        out.push(href);
      } catch { /* skip */ }
    }
  }
  return out;
}

async function fetchAndSave(job) {
  const { url } = job;
  const path = filePathFor(url);
  const isText = (f) => TEXT_EXT.has(extname(f).slice(1).toLowerCase());
  if (existsSync(path) && statSync(path).size > 0) {
    done.set(url.href, { status: "cached" });
    return { url: url.href, text: isText(path) ? readFileSync(path, "utf8") : null };
  }
  if (FILE_MODE) {
    try {
      let src = fileURLToPath(url); // pathname alone is "/G:/..." on Windows and does not exist as a path
      if (src.endsWith("/") || src.endsWith("\\")) src = join(src, "index.html");
      if (!existsSync(src)) { failures.push(`${url.href} FILE 404`); done.set(url.href, { status: 404 }); return null; }
      mkdirSync(dirname(path), { recursive: true });
      const buf = readFileSync(src);
      writeFileSync(path, buf);
      fetched++;
      done.set(url.href, { status: 200, bytes: buf.length });
      return { url: url.href, text: isText(path) ? buf.toString("utf8") : null };
    } catch (e) {
      failures.push(`${url.href} FILE ERROR ${e.code || e.message}`);
      return null;
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  let res = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30000); // no-timeout fetch = dead workers (pitfall #4)
    try {
      res = await fetch(url.href, { headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow", signal: ac.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status === 403) { // rate limited: back off and retry
        const ra = parseInt(res.headers.get("retry-after") || "0", 10);
        await new Promise((r) => setTimeout(r, Math.max(ra * 1000, 4000 + Math.random() * 4000)));
        if (job.retries++ < 5) continue;
      }
      break;
    } catch {
      clearTimeout(timer);
      if (attempt === 3) { failures.push(`${url.href} ERROR`); return null; }
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1) * (attempt + 1)));
    }
  }
  if (!res || !res.ok) {
    failures.push(`${url.href} HTTP ${res?.status}`);
    done.set(url.href, { status: res?.status ?? "ERR" });
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(path, buf);
  fetched++;
  done.set(url.href, { status: res.status, bytes: buf.length });
  return { url: url.href, text: isText(path) ? buf.toString("utf8") : null };
}

for (const s of SEEDS) enqueue(s);
if (URLS_FILE && existsSync(URLS_FILE)) {
  for (const line of readFileSync(URLS_FILE, "utf8").split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#")) enqueue(t);
  }
}

let round = 0;
while (queue.length) {
  round++;
  const batch = queue.splice(0, queue.length);
  const results = [];
  const pool = [...batch];
  let n = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: Math.min(CONC, pool.length) }, async () => {
    while (pool.length) {
      const r = await fetchAndSave(pool.shift());
      if (r) results.push(r);
      if (++n % 250 === 0) console.log(`  round ${round}: ${n}/${batch.length} (${(n / ((Date.now() - t0) / 1000)).toFixed(1)}/s)`);
    }
  }));
  let added = 0;
  for (const r of results) {
    if (!r.text) continue;
    for (const ref of extractRefs(r.text, r.url)) { const b = seen.size; enqueue(ref); if (seen.size > b) added++; }
  }
  console.log(`round ${round}: +${added} refs, ${failures.length} failures`);
}

if (REPORT) {
  writeFileSync(REPORT, JSON.stringify({
    origin: ORIGIN, finishedAt: new Date().toISOString(), uniqueUrls: seen.size, fetched,
    failures, externals: [...externals], files: [...done.entries()],
  }, null, 2));
}
console.log(`done: ${seen.size} urls, ${fetched} fetched, ${failures.length} failures (404s are normal for probe lists)`);
