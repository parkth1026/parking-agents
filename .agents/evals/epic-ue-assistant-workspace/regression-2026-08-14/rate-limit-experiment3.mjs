#!/usr/bin/env node
// 复现实验 3：并发竞争假说 —— 3 个 ask 同时跑，共享 %TEMP% cookie jar 是否触发挂死/空响应。
// （14:52 事故现场是并行 subagent 评测，这是唯一未排除的差异变量。）
import { spawn, spawnSync } from "node:child_process";

const SCRIPT = "D:/GIT_dev/Claude_skills/.agents/skills/epic-ue-assistant/scripts/epic-assistant.mjs";
const BASE = "https://dev.epicgames.com/community/api";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(0)}s`;

async function runScript(name, args, timeoutMs) {
  const start = Date.now();
  const child = spawn(process.execPath, [SCRIPT, ...args], { windowsHide: true });
  let so = "";
  child.stdout.on("data", (d) => (so += d));
  const code = await new Promise((res) => {
    const t = setTimeout(() => { child.kill(); res("KILLED"); }, timeoutMs);
    child.on("close", (c) => { clearTimeout(t); res(c); });
  });
  let brief = "";
  try { const j = JSON.parse(so); brief = `conv=${j.ConversationId} err=${j.Error ?? "null"} htmlLen=${(j.HtmlAnswer ?? "").length}`; } catch { brief = so.trim().slice(0, 80); }
  console.log(`[${ts()}] ${name}: exit=${code} elapsed=${((Date.now() - start) / 1000).toFixed(0)}s ${brief}`);
  return code;
}

console.log(`[${ts()}] === 实验3: 3 个 ask 并发（共享 cookie jar）===`);
const QS = [
  "What is TSharedRef in UE5 and when to use it over raw pointers?",
  "How to set up async asset loading with StreamableManager in UE5?",
  "What does UCLASS(Config) do for a subsystem in UE5?",
];
await Promise.all(QS.map((q, i) => runScript(`par-q${i + 1}`, ["ask", "--question", q], 200000)));

console.log(`[${ts()}] === 并发后探针 ===`);
const r = spawnSync("curl.exe", ["-s", "-m", "30", "-w", "\nHTTP=%{http_code} t=%{time_total}s",
  `${BASE}/csrf_protection/token.json`, "-X", "POST",
  "-H", `User-Agent: ${UA}`, "-H", "Content-Type: application/json", "-H", "Origin: https://dev.epicgames.com",
  "-d", '{"create_csrf_token_request":"true"}'], { encoding: "utf8", timeout: 40000 });
console.log(`[${ts()}] csrf 探针: curl_exit=${r.status} ${(r.stdout ?? "").trim().slice(0, 120)}`);
await runScript("串行追问探针", ["ask", "--question", "hi", "--timeout", "30"], 45000);
console.log(`[${ts()}] === 实验3结束 ===`);
