#!/usr/bin/env node
// 复现实验 2：真实密度（长答案完整问题，连发 4 个）是否触发限流/挂死。
import { spawn, spawnSync } from "node:child_process";

const SCRIPT = "D:/GIT_dev/Claude_skills/.agents/skills/epic-ue-assistant/scripts/epic-assistant.mjs";
const BASE = "https://dev.epicgames.com/community/api";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(0)}s`;

function probe(name, args, timeoutMs) {
  const r = spawnSync("curl.exe", args, { encoding: "utf8", timeout: timeoutMs });
  console.log(`[${ts()}] ${name}: curl_exit=${r.status} ${(r.stdout ?? "").trim().slice(0, 120)}`);
  return r;
}

async function runScript(name, args, timeoutMs) {
  const child = spawn(process.execPath, [SCRIPT, ...args], { windowsHide: true });
  let so = "";
  child.stdout.on("data", (d) => (so += d));
  const code = await new Promise((res) => {
    const t = setTimeout(() => { child.kill(); res("KILLED"); }, timeoutMs);
    child.on("close", (c) => { clearTimeout(t); res(c); });
  });
  let brief = "";
  try { const j = JSON.parse(so); brief = `conv=${j.ConversationId} err=${j.Error ?? "null"} htmlLen=${(j.HtmlAnswer ?? "").length}`; } catch { brief = so.trim().slice(0, 80); }
  console.log(`[${ts()}] ${name}: exit=${code} ${brief}`);
  return code;
}

const QS = [
  "How to fix LNK2019 unresolved external symbol when referencing a UFUNCTION in a UE5 plugin?",
  "What causes C2061 syntax error identifier missing type specifier in Slate widget code?",
  "How does the UE5 BuildGraph system determine module dependencies for monolithic builds?",
  "Explain the difference between PrimaryAssetId and SoftObjectPath for asset management in UE5.",
];

console.log(`[${ts()}] === 复现实验2: ${QS.length} 个真实完整问题连发（默认超时）===`);
for (let i = 0; i < QS.length; i++) {
  await runScript(`full-q${i + 1}`, ["ask", "--question", QS[i]], 200000);
  if (i < QS.length - 1) await sleep(2000);
}

console.log(`[${ts()}] === 限流态探针 ===`);
probe("csrf(-m 30)", ["-s", "-m", "30", "-w", "\nHTTP=%{http_code} t=%{time_total}s", `${BASE}/csrf_protection/token.json`, "-X", "POST",
  "-H", `User-Agent: ${UA}`, "-H", "Content-Type: application/json", "-H", "Origin: https://dev.epicgames.com",
  "-d", '{"create_csrf_token_request":"true"}'], 40000);
probe("check_limit(-m 15)", ["-s", "-m", "15", "-w", "\nHTTP=%{http_code} t=%{time_total}s", `${BASE}/assistant/questions/check_limit`,
  "-H", `User-Agent: ${UA}`, "-H", "Origin: https://dev.epicgames.com"], 25000);
await runScript("ask 追加探针(--timeout 30)", ["ask", "--question", "hi", "--timeout", "30"], 45000);
console.log(`[${ts()}] === 实验2结束 ===`);
