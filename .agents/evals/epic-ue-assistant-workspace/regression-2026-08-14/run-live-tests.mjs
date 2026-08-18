#!/usr/bin/env node
// epic-ue-assistant 在线测试 — 真实 dev.epicgames.com 全链路。
// 覆盖：csrf / answer / ask / follow-up（会话绑定）/ 错误契约（不存在的会话）、
// check_limit 端点（SKILL.md 文档有效性）、guestId 缓存状态、header dump 清理、技能目录零写入。
// 问题请求之间 sleep 2s，照顾未认证用户的限流。

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(here, "..", "..", "epic-ue-assistant");
const SCRIPT = join(SKILL, "scripts", "epic-assistant.mjs");
const CONFIG = join(SKILL, "config.json");
const api = JSON.parse(readFileSync(CONFIG, "utf8").replace(/^\uFEFF/, "")).api;

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(args, timeoutMs = 150000) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
  return { code: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", err: r.error };
}

function snapshotSkill() {
  const out = {};
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out[relative(SKILL, p)] = createHash("sha1").update(readFileSync(p)).digest("hex");
    }
  })(SKILL);
  return out;
}
const skillBefore = snapshotSkill();
const guestIdFile = join(tmpdir(), "epic_assistant_guest_id.txt");
const dumpsBefore = new Set(readdirSync(tmpdir()).filter((n) => n.startsWith("epic_assistant_headers_")));

// ============ 1. csrf（真实端点） ============
console.log("\n[1] csrf 真实端点");
let r = run(["csrf"], 30000);
let token = null;
try { token = JSON.parse(r.stdout).token; } catch {}
check("csrf → 拿到 token，exit 0", r.code === 0 && !!token && token.length > 10, `code=${r.code} stdout=${r.stdout.slice(0, 100)}`);

// ============ 2. answer ============
console.log("\n[2] answer（等待 15-60s 生成）");
r = run(["answer", "--question", "What does UPROPERTY() do in Unreal Engine 5? Answer in 2 sentences."]);
check("answer → exit 0 且输出实质性答案文本", r.code === 0 && r.stdout.trim().length >= 40, `code=${r.code} stdout=${r.stdout.slice(0, 120)}`);
await sleep(2000);

// ============ 3. ask（完整 JSON） ============
console.log("\n[3] ask（完整 JSON，等待 15-60s）");
r = run(["ask", "--question", "How to fix LNK2019 unresolved external symbol in a UE5 plugin?"]);
let parsed = null;
try { parsed = JSON.parse(r.stdout); } catch {}
check("ask → exit 0 且输出合法 JSON", r.code === 0 && !!parsed, `code=${r.code} stdout=${r.stdout.slice(0, 120)}`);
let convId = null;
if (parsed) {
  convId = parsed.ConversationId;
  check("ConversationId 非空（可作 follow-up 句柄）", typeof convId === "string" && convId.length > 8, JSON.stringify(parsed.ConversationId));
  check("AgentAnswer 或 HtmlAnswer 至少一个非空", !!(parsed.AgentAnswer || parsed.HtmlAnswer), `agent=${(parsed.AgentAnswer ?? "").length}ch html=${(parsed.HtmlAnswer ?? "").length}ch`);
  check("References 是数组（字段存在）", Array.isArray(parsed.References), JSON.stringify(parsed.References?.length));
  check("Error 为 null", parsed.Error === null, JSON.stringify(parsed.Error));
  if (parsed.References?.length) {
    check("Reference 结构含 Title/Url", typeof parsed.References[0].Title === "string" && /^https?:\/\//.test(parsed.References[0].Url ?? ""), JSON.stringify(parsed.References[0]));
  }
}

// ============ 4. follow-up（同一会话 + guestId 绑定） ============
if (convId) {
  console.log("\n[4] follow-up（同会话追问，等待 15-60s）");
  await sleep(2000);
  r = run(["ask", "--question", "Summarize the key fix in one sentence.", "--conversation-id", convId]);
  let fu = null;
  try { fu = JSON.parse(r.stdout); } catch {}
  check("follow-up → exit 0（会话存在，guestId 绑定有效）", r.code === 0 && !!fu?.ConversationId, `code=${r.code} stdout=${r.stdout.slice(0, 150)}`);
  check("follow-up 拿到答案", !!(fu?.AgentAnswer || fu?.HtmlAnswer), JSON.stringify(fu?.Error));
  const cached = existsSync(guestIdFile) ? readFileSync(guestIdFile, "utf8").trim() : "";
  check("guestId 缓存文件存在且非空", cached.length > 5, cached.slice(0, 40));
} else {
  console.log("\n[4] follow-up 跳过（上一步未取得 ConversationId）");
  fail++;
}

// ============ 5. 错误契约：不存在的会话 ============
console.log("\n[5] 错误契约（不存在的会话）");
await sleep(15000);
r = run(["ask", "--question", "test", "--conversation-id", "00000000-0000-0000-0000-000000DEAD42"]);
let errBody = null;
try { errBody = JSON.parse(r.stdout); } catch {}
check("不存在的会话 → exit 1 且 Error 点名原因", r.code === 1 && /does not exist|conversation/i.test(String(errBody?.Error)), `code=${r.code} stdout=${r.stdout.slice(0, 150)}`);

// ============ 6. check_limit 端点（SKILL.md 文档声明验证） ============
console.log("\n[6] check_limit 端点");
// 限流时段该端点会挂连接，必须带 -m；连续问题请求后留 20s 冷却
await sleep(20000);
const curlR = spawnSync("curl.exe", [
  "-s", "-m", "15", "-w", "\n%{http_code}", `${api.baseUrl}/assistant/questions/check_limit`,
  "-H", `User-Agent: ${api.userAgent}`, "-H", `Origin: ${api.origin}`, "-H", `Referer: ${api.referer}`,
], { encoding: "utf8", timeout: 30000 });
const httpCode = (curlR.stdout ?? "").trim().split("\n").pop();
check("GET check_limit → HTTP 200", httpCode === "200", `code=${httpCode} body=${(curlR.stdout ?? "").slice(0, 120)}`);

// ============ 7. 清理与零写入 ============
console.log("\n[7] 清理与零写入");
const dumpsAfter = new Set(readdirSync(tmpdir()).filter((n) => n.startsWith("epic_assistant_headers_")));
check("%TEMP% 无新增 header dump 残留", [...dumpsAfter].every((n) => dumpsBefore.has(n)),
  `新增残留: ${[...dumpsAfter].filter((n) => !dumpsBefore.has(n)).join(", ")}`);
const skillAfter = snapshotSkill();
const keys = new Set([...Object.keys(skillBefore), ...Object.keys(skillAfter)]);
const diffs = [...keys].filter((k) => skillBefore[k] !== skillAfter[k]);
check("全部在线测试跑完，技能目录零变化", diffs.length === 0, `差异: ${diffs.join(", ")}`);

console.log(`\n在线测试: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
