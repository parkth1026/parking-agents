#!/usr/bin/env node
// Offline verification (layer 3 gate + final acceptance): serve the mirror
// locally, drive the real game in headless Chromium with every non-localhost
// request BLOCKED, record all traffic, emit the three-zero verdict:
//   zero missing local assets / zero external requests / zero console errors.
//
// Interaction is data-driven from a JSON script so any game's flow can be
// described without code changes:
//   [{ "click": "以游客|play as guest" }, { "wait": 4000 },
//    { "press": "Enter" }, { "key": "d", "holdMs": 3000 }, { "shot": "menu" }]
// Regex strings match button text across any language. Absent a script it just
// boots, waits, screenshots, and reports — still enough to catch missing assets.
//
// Usage: node verify-offline.mjs --mirror ./mirror [--port 8123] [--block-external]
//        [--flow flow.json] [--out report.json]
// Requires: playwright installed (npm i -D playwright && npx playwright install chromium).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { chromium } from "playwright";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SITE = arg("mirror");
const PORT = Number(arg("port", 8123));
const BLOCK = process.argv.includes("--block-external");
const FLOW = arg("flow");
const OUT = arg("out", "verify-report.json");
const SHOTS = arg("shots", "shots");
if (!SITE) { console.error("usage: verify-offline.mjs --mirror dir [--flow x.json] [--block-external]"); process.exit(2); }

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".glb": "model/gltf-binary", ".bin": "application/octet-stream",
  ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".data": "application/octet-stream",
  ".wasm": "application/wasm", ".pck": "application/octet-stream", ".atlas": "text/plain",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".ktx2": "image/ktx2", ".txt": "text/plain", ".xml": "application/xml",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (arg("api") && pathname.startsWith(arg("api"))) return; // external mock handles /api
    let file = join(SITE, pathname === "/" ? "index.html" : pathname);
    if (!extname(file)) file += ".html";
    if (!existsSync(file)) { res.writeHead(404); res.end("404"); return; }
    const buf = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(buf);
  } catch { res.writeHead(500); res.end(); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
console.log(`serving ${SITE} → http://127.0.0.1:${PORT}${BLOCK ? " (external BLOCKED)" : ""}`);

const requests = [];
const externals = new Set();
const consoleErrors = [];
const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
if (BLOCK) {
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.includes("127.0.0.1")) return route.continue();
    externals.add(u);
    return route.abort();
  });
}
page.on("response", (r) => requests.push({ url: r.url(), status: r.status() }));
page.on("requestfailed", (r) => {
  if (!r.url().includes("127.0.0.1")) { externals.add(r.url()); return; }
  requests.push({ url: r.url(), status: "FAILED" });
});
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR " + String(e).slice(0, 200)));
mkdirSync(SHOTS, { recursive: true });

const buttons = () => page.locator("button:visible, [role=button]:visible");
const clickText = async (re) => {
  const n = await buttons().count();
  for (let i = 0; i < n; i++) {
    const t = (await buttons().nth(i).textContent().catch(() => "")).trim();
    if (re.test(t)) { console.log(`click: ${t.slice(0, 40)}`); await buttons().nth(i).click({ timeout: 8000 }).catch(() => {}); return true; }
  }
  return false;
};

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(8000);
await page.screenshot({ path: join(SHOTS, "boot.png") });

if (FLOW && existsSync(FLOW)) {
  const steps = JSON.parse(readFileSync(FLOW, "utf8"));
  for (const s of steps) {
    if (s.click) { if (!(await clickText(new RegExp(s.click, "i")))) console.log(`(no button matched: ${s.click})`); }
    else if (s.wait) await page.waitForTimeout(s.wait);
    else if (s.press) await page.keyboard.press(s.press);
    else if (s.key) { await page.keyboard.down(s.key); await page.waitForTimeout(s.holdMs || 2000); await page.keyboard.up(s.key); }
    else if (s.shot) await page.screenshot({ path: join(SHOTS, s.shot + ".png") });
  }
}

const local = requests.filter((r) => r.url.includes("127.0.0.1"));
const missing = local.filter((r) => r.status === 404 || String(r.status).startsWith("FAILED"));
const verdict = {
  when: new Date().toISOString(),
  totalRequests: requests.length,
  missingLocal: [...new Set(missing.map((m) => m.url.split("?")[0]))],
  externalAttempts: [...externals],
  consoleErrors: consoleErrors.slice(0, 50),
  pass: missing.length === 0 && externals.size === 0 && consoleErrors.length === 0,
};
writeFileSync(OUT, JSON.stringify(verdict, null, 2));
console.log(`\nVERDICT: ${verdict.pass ? "PASS" : "FAIL"} | requests=${requests.length} missing=${missing.length} external=${externals.size} errors=${consoleErrors.length}`);
verdict.missingLocal.slice(0, 20).forEach((m) => console.log("  MISS " + m));
verdict.externalAttempts.slice(0, 10).forEach((e) => console.log("  EXT " + e));
consoleErrors.slice(0, 10).forEach((e) => console.log("  ERR " + e.slice(0, 150)));
await browser.close();
server.close();
process.exit(verdict.pass ? 0 : 1);
