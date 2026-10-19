#!/usr/bin/env node
// Closure audit: scan every text file already in a mirror, extract every
// referenced path, and report references whose target file is MISSING locally.
// Run after mirror.mjs; a clean run (0 real misses) closes layer 1.
//
// Usage: node audit-closure.mjs --mirror ./mirror [--origin https://example.com] [--out missing.txt]
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SITE = arg("mirror");
const ORIGIN = arg("origin", "https://example.invalid"); // only used to resolve relative refs
const OUT = arg("out");
if (!SITE) { console.error("usage: audit-closure.mjs --mirror dir [--origin url] [--out file]"); process.exit(2); }
// file:// origins need http-semantics emulation (root-absolute refs anchor at
// the base dir, not the drive root); http(s) origins resolve natively
const FILE_MODE = ORIGIN.startsWith("file:");
const ORIGIN_URL = new URL(ORIGIN);
const BASE_DIR = FILE_MODE ? ORIGIN_URL.pathname.replace(/\/?$/, "/") : null;
const resolveRef = (raw, relUrl) => {
  try {
    return FILE_MODE && raw.startsWith("/") && !raw.startsWith("//")
      ? new URL(ORIGIN_URL.href.replace(/\/?$/, "/") + raw.slice(1))
      : new URL(raw, relUrl);
  } catch { return null; }
};

const EXT_OK = /\.(js|mjs|css|html|json|xml|txt|webmanifest|vtt|png|jpe?g|webp|gif|svg|ico|glb|gltf|bin|ogg|mp3|wav|m4a|woff2?|ttf|otf|ktx2|wasm|data|pck)$/i;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const pathToLocal = (u) => {
  let p = u.pathname;
  if (FILE_MODE) p = decodeURIComponent(p).slice(BASE_DIR.length);
  if (p === "" || p === "/") p = "index.html";
  if (p.endsWith("/")) p += "index.html";
  const last = p.split("/").pop();
  if (last && !last.includes(".")) p += ".html";
  const f = join(SITE, p.replace(/^\/+/, ""));
  return existsSync(f) && statSync(f).size > 0 ? f : null;
};

const TEXT_EXT = new Set([".js", ".mjs", ".css", ".html", ".json", ".xml", ".txt", ".webmanifest"]);
const files = existsSync(SITE) ? walk(SITE).filter((f) => TEXT_EXT.has(extname(f))) : [];
const missing = new Map();

for (const f of files) {
  const relUrl = new URL(ORIGIN_URL.href.replace(/\/?$/, "/") + f.slice(SITE.length + 1).replace(/\\/g, "/"));
  const text = readFileSync(f, "utf8");
  const refs = new Set();
  const push = (s) => { if (s && s.length <= 500) refs.add(s.trim()); };
  for (const m of text.matchAll(/"([^"\n]{1,500})"|'([^'\n]{1,500})'/g)) push(m[1] ?? m[2]);
  for (const m of text.matchAll(/`([^`\n]{1,500})`/g)) if (!m[1].includes("${")) push(m[1]);
  for (const m of text.matchAll(/url\(\s*(['"]?)([^'")]{1,500})\1\s*\)/gi)) push(m[2]);
  for (const m of text.matchAll(/(?:src|href|content)=\s*(['"])([^'"]{1,500})\1/gi)) push(m[2]);

  for (const raw of refs) {
    if (!/^(\/|\.{1,2}\/)/.test(raw)) continue;     // only explicit path-like refs
    if (/[$`{}()<>,'";|\\]/.test(raw) || /[%\s]/.test(raw)) continue; // code fragments / prose
    const u = resolveRef(raw, relUrl);
    if (!u) continue;
    if (!FILE_MODE && u.origin !== ORIGIN_URL.origin) continue;
    const name = decodeURIComponent(u.pathname.split("/").pop() || "");
    if (!name.includes(".") || !EXT_OK.test(name)) continue;
    if (!pathToLocal(u)) {
      if (!missing.has(u.pathname)) missing.set(u.pathname, []);
      if (missing.get(u.pathname).length < 3) missing.get(u.pathname).push(f.slice(SITE.length + 1));
    }
  }
}

if (OUT) writeFileSync(OUT, [...missing.keys()].sort().join("\n") + "\n");
console.log(`scanned ${files.length} text files; missing referenced targets: ${missing.size}`);
for (const [url, from] of [...missing.entries()].sort().slice(0, 40)) console.log(`  ${url}  <- ${from[0]}`);
