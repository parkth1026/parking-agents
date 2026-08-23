#!/usr/bin/env node
// 通用合并评分：遍历 <iteration>/eval-*/<gate>/run-*/，把 grading-objective.json + grading-manual.json
// 合成 grading.json（aggregate-benchmark 的输入）。缺 objective 的 run 跳过并警告。
// 对账（防判罚虚高）：题库 metadata 声明 manual 断言但缺 grading-manual.json 时显式警告——静默空合并
// 会让漏交 manual 的 run 得 N/N=100%；manual 与 objective 同名断言只保留 objective 一条（评分器把
// manual 断言脚本化后，重跑历史轮时防同一条断言计双份）。
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = (() => {
  const a = process.argv[2];
  if (!a || !existsSync(a)) { console.log("用法: node merge-grading.mjs <iteration目录>"); process.exit(2); }
  return resolve(a);
})();

let merged = 0, skipped = 0;
for (const sc of readdirSync(ROOT, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith("eval-")).map((e) => e.name).sort()) {
  const metaPath = join(ROOT, sc, "eval_metadata.json");
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};
  const manualNames = (Array.isArray(meta.assertions) ? meta.assertions : [])
    .filter((a) => a && typeof a === "object" && a.type === "manual")
    .map((a) => a.name ?? String(a));

  for (const gate of readdirSync(join(ROOT, sc), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
    const gateDir = join(ROOT, sc, gate);
    if (!existsSync(gateDir) || !readdirSync(gateDir).some((n) => /^run-\d+$/.test(n))) continue;
    for (const run of readdirSync(gateDir).filter((n) => /^run-\d+$/.test(n)).sort()) {
      const runDir = join(gateDir, run);
      const objPath = join(runDir, "grading-objective.json");
      if (!existsSync(objPath)) { console.log(`跳过（无 objective）: ${sc}/${gate}/${run}`); skipped++; continue; }
      const obj = JSON.parse(readFileSync(objPath, "utf8"));
      let manual = { results: [], eval_feedback: "" };
      const manPath = join(runDir, "grading-manual.json");
      if (existsSync(manPath)) {
        manual = JSON.parse(readFileSync(manPath, "utf8"));
      } else if (manualNames.length > 0) {
        console.log(`警告: ${sc}/${gate}/${run} 题库含 ${manualNames.length} 条 manual 断言但缺 grading-manual.json——按空合并，pass_rate 将虚高：${manualNames.join("、")}`);
      }
      const objNames = new Set((obj.results ?? []).map((r) => r.name));
      const dup = (manual.results ?? []).filter((r) => objNames.has(r.name));
      if (dup.length > 0) {
        console.log(`警告: ${sc}/${gate}/${run} manual 与 objective 同名断言 ${dup.length} 条，只保留 objective 判罚：${dup.map((r) => r.name).join("、")}`);
      }
      const manualResults = (manual.results ?? []).filter((r) => !objNames.has(r.name));
      const out = { results: [...(obj.results ?? []), ...manualResults], eval_feedback: manual.eval_feedback ?? "" };
      writeFileSync(join(runDir, "grading.json"), JSON.stringify(out, null, 2));
      const ok = out.results.filter((r) => r.passed).length;
      console.log(`${sc} | ${gate} | ${run} | ${ok}/${out.results.length} passed`);
      merged++;
    }
  }
}
console.log(`合并 ${merged} 个 run${skipped ? `，跳过 ${skipped} 个` : ""}`);
