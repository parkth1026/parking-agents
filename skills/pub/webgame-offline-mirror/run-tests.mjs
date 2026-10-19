#!/usr/bin/env node
// run-tests.mjs — webgame-offline-mirror 的回归测试（升级/改动后必跑）
// 黑盒执行三个脚本：fixture 站点走 file:// 传输（零网络、沙箱无关）。
// 覆盖：闭包抓取（嵌套引用/无引号 url()/hash 锚定 vs 反引号位移/JSON 绝对路径）、
// 审计收敛与缺失检出、CLI 契约。
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const TMP = join(SKILL_DIR, ".test-tmp");

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}
const run = (args) => execFileSync("node", args, { encoding: "utf8", cwd: SKILL_DIR });

// ---------- fixture mini-site ----------
rmSync(TMP, { recursive: true, force: true });
const FIX = join(TMP, "fixture");
mkdirSync(join(FIX, "assets"), { recursive: true });
mkdirSync(join(FIX, "data"), { recursive: true });
mkdirSync(join(FIX, "icons"), { recursive: true });
writeFileSync(join(FIX, "index.html"),
  `<html><head><link rel=stylesheet href="./assets/style-Xy98765432.css">
<script type=module src="./assets/app-Ab12cd34Ef.js"></script></head><body></body></html>`);
writeFileSync(join(FIX, "assets", "app-Ab12cd34Ef.js"),
  // the ${} template deliberately shifts naive backtick pairing; the lang chunk
  // name must still be caught by the hash-anchored extractor. Root-absolute
  // paths because relative specifiers resolve against the module's own URL.
  "const t=`x ${1+1} y`;import(`./en-Q1w2e3r4Ty.js`);fetch(`/data/items.json`);"
  + "const hero=`/assets/hero-9zXy876AbC.png`;");
writeFileSync(join(FIX, "assets", "style-Xy98765432.css"),
  "@font-face{src:url(./font-Zz99887765.woff2)format('woff2')}body{color:red}");
writeFileSync(join(FIX, "data", "items.json"),
  JSON.stringify({ items: [{ icon: "/icons/1.png" }, { icon: "/icons/2.png" }] }));
for (const f of ["assets/en-Q1w2e3r4Ty.js", "assets/hero-9zXy876AbC.png", "assets/font-Zz99887765.woff2", "icons/1.png", "icons/2.png"]) {
  writeFileSync(join(FIX, f), Buffer.from("x"));
}
const ORIGIN = pathToFileURL(FIX + "/").href;

// ---------- mirror.mjs: closure over the fixture via file:// transport ----------
run(["scripts/mirror.mjs", "--origin", ORIGIN, "--out", join(TMP, "mirror"), "--report", join(TMP, "report.json")]);
const have = (p) => existsSync(join(TMP, "mirror", p)) && readFileSync(join(TMP, "mirror", p), "utf8").length > 0;
check("mirror: 抓到入口 HTML", have("index.html"));
check("mirror: 嵌套 JS chunk", have("assets/app-Ab12cd34Ef.js"));
check("mirror: CSS 无引号 url() 字体", have("assets/font-Zz99887765.woff2"));
check("mirror: 反引号位移下 hash 锚定仍抓到语言 chunk", have("assets/en-Q1w2e3r4Ty.js"));
check("mirror: 模板字面量资源", have("assets/hero-9zXy876AbC.png"));
check("mirror: JSON 数据文件", have("data/items.json"));
check("mirror: JSON 内绝对路径引用的图标", have("icons/1.png") && have("icons/2.png"));
const report = JSON.parse(readFileSync(join(TMP, "report.json"), "utf8"));
check("mirror: 报告含 uniqueUrls 与 fetched", report.uniqueUrls >= 8 && report.fetched >= 8);

// ---------- audit-closure.mjs: convergence on the mirrored copy ----------
const audit = run(["scripts/audit-closure.mjs", "--mirror", join(TMP, "mirror"), "--origin", ORIGIN, "--out", join(TMP, "missing.txt")]);
check("audit: 完整镜像报零缺失", /missing referenced targets: 0/.test(audit));

// ---------- audit catches a removed file ----------
rmSync(join(TMP, "mirror", "icons", "2.png"), { force: true });
const audit2 = run(["scripts/audit-closure.mjs", "--mirror", join(TMP, "mirror"), "--origin", ORIGIN]);
check("audit: 删除引用目标后被点名", /icons\/2\.png/.test(audit2));

// ---------- CLI contracts ----------
let rc = 0;
try { run(["scripts/mirror.mjs"]); } catch (e) { rc = e.status; }
check("mirror: 缺 --origin 报用法错(退出码 2)", rc === 2);
rc = 0;
try { run(["scripts/audit-closure.mjs"]); } catch (e) { rc = e.status; }
check("audit: 缺 --mirror 报用法错(退出码 2)", rc === 2);

rmSync(TMP, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
