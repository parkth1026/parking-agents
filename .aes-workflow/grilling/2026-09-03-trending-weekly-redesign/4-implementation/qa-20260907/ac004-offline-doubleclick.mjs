#!/usr/bin/env node
// ac004-offline-doubleclick.mjs — AC-004 [C] 档实测（2026-09-07 QA 复验）
// 「双击打开」= 以 file:// 协议直开 report/index.html（不经 serve.mjs），与 OS 双击同协议同安全上下文；
// 「断网」= Playwright context.setOffline(true)，先断网再打开（等同拔线后双击）。
// 前置：report/ 产物必须来自真实管线 build-report.mjs（黄金快照 fixtures），非手写。
// 断言：20 行、首字母色块 .fb 可见 20、无未隐藏图片、console error 与未捕获异常为 0。
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const out = resolve(process.argv[2] ?? ".");
mkdirSync(out, { recursive: true });
const skill = resolve(fileURLToPath(new URL("../../../../../skills/pub/github-trending-weekly/", import.meta.url)));

// 1) 真实管线构建 report：golden 快照 → build-report.mjs → report/index.html + data.js
const temp = mkdtempSync(join(tmpdir(), "qa-ac004-"));
const weeks = join(temp, "data", "weeks"), repos = join(temp, "data", "repos");
mkdirSync(weeks, { recursive: true }); mkdirSync(repos, { recursive: true });
copyFileSync(join(skill, "fixtures", "golden", "2026-W36.json"), join(weeks, "2026-W36.json"));
copyFileSync(join(skill, "fixtures", "golden", "2026-W36.analysis.md"), join(weeks, "2026-W36.analysis.md"));
copyFileSync(join(skill, "fixtures", "golden", "tt-a1i__archify.history.json"), join(repos, "tt-a1i__archify.json"));
copyFileSync(join(skill, "fixtures", "old-week", "2026-W28.json"), join(weeks, "2026-W28.json"));
copyFileSync(join(skill, "fixtures", "old-week", "legacy.analysis.md"), join(weeks, "2026-W28.analysis.md"));
const build = spawnSync(process.execPath, [join(skill, "scripts", "build-report.mjs"), "--workspace", temp], { encoding: "utf8" });
if (build.status !== 0) { console.error("build-report 失败:\n" + build.stdout + build.stderr); process.exit(1); }
for (const f of ["report/index.html", "report/data.js"]) if (!existsSync(join(temp, f))) { console.error("产物缺失: " + f); process.exit(1); }
const dataJs = readFileSync(join(temp, "report", "data.js"), "utf8");
const coreImgs = [...dataJs.matchAll(/"coreImg":"(https:[^"]+)"/g)].map((m) => m[1]);
console.log("report 管线构建 OK；data.js 含 coreImg " + coreImgs.length + " 条（外网绝对 URL，断网必失败→回落色块）");

// 2) playwright-cli 断网打开 file://（与 assert-browser.mjs 相同的调用模式）
function cliPath() {
  for (const p of (process.env.PATH || "").split(delimiter)) {
    const candidate = join(p, "node_modules", "@playwright", "cli", "playwright-cli.js");
    if (existsSync(candidate)) return candidate;
    const bin = join(p, "playwright-cli");
    if (existsSync(bin)) { const real = realpathSync(bin); if (/\.[cm]?js$/.test(real)) return real; }
  }
  throw Error("需要已安装的 playwright-cli");
}
const cli = cliPath(), session = "qa-ac004-" + process.pid;
function run(argv) {
  const r = spawnSync(process.execPath, [cli, "-s=" + session, ...argv], { cwd: temp, encoding: "utf8", windowsHide: true, timeout: 55000, maxBuffer: 4 * 1024 * 1024 });
  if (r.status !== 0 || /### Error/.test(r.stdout || "")) throw Error((r.stdout || "") + (r.stderr || ""));
  return r.stdout;
}
const url = pathToFileURL(join(temp, "report", "index.html")).href;
const shot = join(out, "ac004-offline-doubleclick.png");
const codeFile = join(temp, "check.js");
writeFileSync(codeFile, "async page => {\n" + `
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.context().setOffline(true);            // 先断网再打开
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(${JSON.stringify(url)});          // file:// 直开，等同双击
  await page.locator('.row').first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.rthumb img')].every(img => img.complete), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);                   // 留足 onerror 处理时间
  const facts = await page.evaluate(() => ({
    weeks: window.TRENDING_DATA?.weeks?.length,
    rows: document.querySelectorAll('.row').length,
    visibleInitials: [...document.querySelectorAll('.fb')].filter(e => e.getBoundingClientRect().height > 0).length,
    unhiddenImgs: [...document.querySelectorAll('.rthumb img')].filter(i => !i.hidden).length,
    offlineNote: navigator.onLine === false ? 'navigator.onLine=false' : 'navigator.onLine=true',
  }));
  await page.screenshot({ path: ${JSON.stringify(shot)} });
  return { ...facts, errors, url: page.url() };
` + "}");
try {
  run(["open", "--browser=chrome"]);
  const stdout = run(["run-code", "--filename=" + codeFile]);
  const m = /### Result\s*\n([\s\S]*?)(?:\n### |$)/.exec(stdout);
  if (!m) throw Error("浏览器未返回结果: " + stdout);
  const r = JSON.parse(m[1]);
  console.log(JSON.stringify(r, null, 2));
  const pass = r.rows === 20 && r.visibleInitials === 20 && r.unhiddenImgs === 0 && r.errors.length === 0 && String(r.url).startsWith("file:");
  console.log(pass ? "AC-004[C] PASS" : "AC-004[C] FAIL");
  process.exitCode = pass ? 0 : 1;
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { try { run(["close"]); } catch { /* 会话已关 */ } }
