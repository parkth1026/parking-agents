#!/usr/bin/env node
// 受控限流实验：打满配额 → 探针 csrf/check_limit/question → 轮询恢复时长。
// 输出全部落到 rate-limit-experiment.log 同步打印。
import { spawn, spawnSync } from "node:child_process";

const SCRIPT = "D:/GIT_dev/Claude_skills/.agents/skills/epic-ue-assistant/scripts/epic-assistant.mjs";
const BASE = "https://dev.epicgames.com/community/api";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(0)}s`;

function probeCurl(name, args, timeoutMs) {
  const r = spawnSync("curl.exe", args, { encoding: "utf8", timeout: timeoutMs });
  const out = (r.stdout ?? "").trim();
  console.log(`[${ts()}] ${name}: curl_exit=${r.status} ${out.slice(-200)}`);
  return r;
}

async function runScript(name, args, timeoutMs) {
  const child = spawn(process.execPath, [SCRIPT, ...args], { windowsHide: true });
  let so = "", se = "";
  child.stdout.on("data", (d) => (so += d));
  child.stderr.on("data", (d) => (se += d));
  const code = await new Promise((res) => {
    const t = setTimeout(() => { child.kill(); res("KILLED"); }, timeoutMs);
    child.on("close", (c) => { clearTimeout(t); res(c); });
  });
  console.log(`[${ts()}] ${name}: exit=${code} stdout=${so.trim().slice(0, 150)}`);
  return { code, so };
}

// ---- Phase A: 打满配额（5 个小问题，--timeout 25 提前断流省时间）----
console.log(`[${ts()}] === Phase A: 打满配额 ===`);
for (let i = 1; i <= 5; i++) {
  await runScript(`burst-q${i}`, ["ask", "--question", "hi", "--timeout", "25"], 40000);
  if (i < 5) await sleep(3000);
}

// ---- Phase B: 限流态探针 ----
console.log(`[${ts()}] === Phase B: 限流态探针 ===`);
probeCurl("csrf 探针(-m 90)", [
  "-s", "-m", "90", "-w", "\nHTTP=%{http_code} time_total=%{time_total}s",
  `${BASE}/csrf_protection/token.json`, "-X", "POST",
  "-H", `User-Agent: ${UA}`, "-H", "Content-Type: application/json", "-H", "Origin: https://dev.epicgames.com",
  "-d", '{"create_csrf_token_request":"true"}',
], 100000);
probeCurl("check_limit 探针(-m 15)", [
  "-s", "-m", "15", "-w", "\nHTTP=%{http_code} time_total=%{time_total}s",
  `${BASE}/assistant/questions/check_limit`,
  "-H", `User-Agent: ${UA}`, "-H", "Origin: https://dev.epicgames.com",
], 25000);
await runScript("ask 探针(--timeout 30)", ["ask", "--question", "hi", "--timeout", "30"], 45000);

// ---- Phase C: 轮询恢复 ----
console.log(`[${ts()}] === Phase C: 轮询恢复（30s 间隔，上限 6 分钟）===`);
const recoverStart = Date.now();
for (let i = 1; i <= 12; i++) {
  await sleep(30000);
  const r = probeCurl(`check_limit poll#${i}`, [
    "-s", "-m", "15", "-w", "\nHTTP=%{http_code}",
    `${BASE}/assistant/questions/check_limit`,
    "-H", `User-Agent: ${UA}`, "-H", "Origin: https://dev.epicgames.com",
  ], 25000);
  const body = (r.stdout ?? "").split("\n")[0];
  if (/limit_exceeded":\s*false/.test(body)) {
    console.log(`[${ts()}] *** 限流解除，恢复耗时 ${((Date.now() - recoverStart) / 1000 / 60).toFixed(1)} 分钟 ***`);
    process.exit(0);
  }
}
console.log(`[${ts()}] 6 分钟内未观察到解除`);
