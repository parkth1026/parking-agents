#!/usr/bin/env node
// epic-ue-assistant 离线回归测试 — 黑盒，零外网请求。
// 覆盖：CLI 参数契约、config 读取（默认路径/--config/缺文件/缺字段/BOM）、
// 请求头与请求体是否真用了 config 值、SSE 解析、错误转译（非 SSE 体 → Error + 非零退出）、
// 状态更新（guestId 捕获持久化/cookies 携带/临时 header dump 清理）、技能目录零写入。
//
// 机制：本地起 http 服务器（随机端口）扮演 Epic API，把 config.json 指过去，
// 记录脚本发出的每个请求逐头断言。真实 %TEMP% 状态文件先备份、测完还原。

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  readFileSync, writeFileSync, readdirSync, existsSync, rmSync, mkdirSync, cpSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(hareSafe(), "epic-ue-assistant");
function hareSafe() { return resolve(here, "..", ".."); }
const SCRIPT = join(SKILL, "scripts", "epic-assistant.mjs");

if (!existsSync(join(SKILL, "SKILL.md"))) {
  console.error(`找不到技能目录: ${SKILL}`);
  process.exit(2);
}

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

// 异步 spawn（不能用 spawnSync：同步等待会冻结本进程事件循环，mock 服务器无法响应）
function run(args, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: null, stdout, stderr, err: String(e) }); });
  });
}

// ---- 技能目录快照（零写入断言的判定源）----
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

// ---- %TEMP% 真实状态备份（测完还原，不污染在线会话）----
const cookieFile = join(tmpdir(), "epic_assistant_cookies.txt");
const guestIdFile = join(tmpdir(), "epic_assistant_guest_id.txt");
const backup = {};
for (const f of [cookieFile, guestIdFile]) {
  backup[f] = existsSync(f) ? readFileSync(f) : null;
  try { rmSync(f, { force: true }); } catch {}
}
const dumpsBefore = new Set(readdirSync(tmpdir()).filter((n) => n.startsWith("epic_assistant_headers_")));

// ---- mock 服务器 ----
const requests = [];
let questionMode = "sse"; // sse | error | empty
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    requests.push({ method: req.method, url: req.url, headers: req.headers, body });
    if (req.url === "/csrf_protection/token.json") {
      res.setHeader("Set-Cookie", "mockcsrf=abc123; Path=/");
      res.setHeader("Content-Type", "application/json");
      res.end('{"public_csrf_token":"mock-token-1"}');
      return;
    }
    if (req.url === "/assistant/questions") {
      if (questionMode === "error") {
        res.setHeader("Content-Type", "application/json");
        res.end('{"error":"conversation does not exist"}');
        return;
      }
      if (questionMode === "empty") {
        res.setHeader("Content-Type", "text/html");
        res.end("<html><body>Just a challenge page</body></html>");
        return;
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cb-Guest-Id", "mock-guest-new");
      res.end(
        'event: conversation_loaded\ndata: {"id":"conv-7f3a","name":"Test Conversation"}\n\n' +
        'event: question_created\ndata: {"id":"q-1"}\n\n' +
        'event: answer_created\ndata: {"id":"a-1"}\n\n' +
        'event: reference\ndata: {"content":"https://docs.example/lnk2019","title":"LNK Docs","description":"d","type":"doc"}\n\n' +
        'event: agent_code\ndata: {"content":"markdown answer **bold**"}\n\n' +
        'event: answer_update\ndata: {"content":"<p>html answer</p>"}\n\n' +
        'event: end\ndata: {}\n\n',
      );
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

// ---- fixtures ----
const fixtures = join(here, "fixtures");
mkdirSync(fixtures, { recursive: true });
const fullConfig = {
  api: {
    baseUrl: `http://127.0.0.1:${port}`,
    origin: "https://mock-origin.example",
    referer: "https://mock-referer.example/assistant",
    userAgent: "MockUA/1.0 (epic-test)",
  },
};
const cfgFull = join(fixtures, "config-full.json");
writeFileSync(cfgFull, JSON.stringify(fullConfig, null, 2));
const cfgBom = join(fixtures, "config-bom.json");
writeFileSync(cfgBom, "\uFEFF" + JSON.stringify(fullConfig, null, 2));
const cfgMissing = join(fixtures, "config-missing-fields.json");
writeFileSync(cfgMissing, JSON.stringify({ api: { baseUrl: fullConfig.api.baseUrl } }, null, 2));
const cfgAbsent = join(fixtures, "config-absent.json");

try {
  // ============ 1. CLI 参数契约 ============
  console.log("\n[1] CLI 参数契约");
  let r = await run([]);
  check("无参数 → exit 2", r.code === 2, `code=${r.code} stderr=${r.stderr.slice(0, 80)}`);
  r = await run(["bogus"]);
  check("未知子命令 → exit 2 且提示可用子命令", r.code === 2 && r.stderr.includes("csrf"), r.stderr.slice(0, 80));
  r = await run(["ask"]);
  check("ask 缺 --question → exit 2", r.code === 2 && r.stderr.includes("--question"), r.stderr.slice(0, 80));
  r = await run(["answer"]);
  check("answer 缺 --question → exit 2", r.code === 2 && r.stderr.includes("--question"), r.stderr.slice(0, 80));
  r = await run(["csrf", "--bogus"]);
  check("未知参数 → exit 2 且提示未知参数", r.code === 2 && r.stderr.includes("未知参数"), r.stderr.slice(0, 80));

  // ============ 2. config 读取 ============
  console.log("\n[2] config 读取");
  r = await run(["csrf", "--config", cfgAbsent]);
  check("config 文件不存在 → exit 1 且报文件不存在", r.code === 1 && r.stderr.includes("文件不存在"), `code=${r.code} stderr=${r.stderr.slice(0, 100)}`);
  r = await run(["csrf", "--config", cfgMissing]);
  check("config 缺必需字段 → exit 1 且逐个点名缺失字段",
    r.code === 1 && r.stderr.includes("origin") && r.stderr.includes("referer") && r.stderr.includes("userAgent"),
    `code=${r.code} stderr=${r.stderr.slice(0, 120)}`);
  r = await run(["csrf", "--config", cfgBom]);
  let tok = null;
  try { tok = JSON.parse(r.stdout).token; } catch {}
  check("带 BOM 的 config 仍可解析（strip 生效）", r.code === 0 && tok === "mock-token-1", `code=${r.code} stdout=${r.stdout.slice(0, 80)}`);

  requests.length = 0;
  r = await run(["csrf", "--config", cfgFull]);
  try { tok = JSON.parse(r.stdout).token; } catch { tok = null; }
  check("--config 指定完整 config → csrf 成功", r.code === 0 && tok === "mock-token-1", `code=${r.code} stdout=${r.stdout.slice(0, 80)}`);
  const csrfReq = requests.find((q) => q.url === "/csrf_protection/token.json");
  check("请求路径来自 config.baseUrl", !!csrfReq, "mock 未收到 /csrf_protection/token.json");
  if (csrfReq) {
    check("请求头 User-Agent 来自 config", csrfReq.headers["user-agent"] === "MockUA/1.0 (epic-test)", String(csrfReq.headers["user-agent"]));
    check("请求头 Origin 来自 config", csrfReq.headers.origin === "https://mock-origin.example", String(csrfReq.headers.origin));
    check("请求头 Referer 来自 config", csrfReq.headers.referer === "https://mock-referer.example/assistant", String(csrfReq.headers.referer));
  }

  // 默认路径：整份技能目录复制到沙箱，改其 config.json，不带 --config 跑副本
  const sandbox = join(here, "sandbox-skill-copy");
  rmSync(sandbox, { recursive: true, force: true });
  mkdirSync(sandbox, { recursive: true });
  cpSync(SKILL, join(sandbox, "epic-ue-assistant"), { recursive: true });
  writeFileSync(join(sandbox, "epic-ue-assistant", "config.json"), JSON.stringify(fullConfig, null, 2));
  const r2 = await new Promise((resolveP) => {
    const child = spawn(process.execPath, [join(sandbox, "epic-ue-assistant", "scripts", "epic-assistant.mjs"), "csrf"], { windowsHide: true });
    let so = "", se = "";
    child.stdout.on("data", (d) => (so += d));
    child.stderr.on("data", (d) => (se += d));
    const timer = setTimeout(() => child.kill(), 30000);
    child.on("close", (code) => { clearTimeout(timer); resolveP({ status: code, stdout: so, stderr: se }); });
  });
  let tok2 = null;
  try { tok2 = JSON.parse(r2.stdout).token; } catch {}
  check("默认读取脚本上级目录 config.json（副本不带 --config）", r2.status === 0 && tok2 === "mock-token-1", `code=${r2.status} stdout=${(r2.stdout ?? "").slice(0, 80)}`);

  // ============ 3. ask：SSE 解析 + 请求构造 + 状态更新 ============
  console.log("\n[3] ask 全链路（mock SSE）");
  // 预置旧 guestId：证明「读缓存 → 随请求回传 → 响应头新值覆盖缓存」整条链
  writeFileSync(guestIdFile, "mock-guest-old");
  try { rmSync(cookieFile, { force: true }); } catch {}
  requests.length = 0;
  r = await run(["ask", "--question", "How to fix LNK2019?", "--conversation-id", "conv-lower-1", "--config", cfgFull]);
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch {}
  check("ask → exit 0 且输出合法 JSON", r.code === 0 && !!parsed, `code=${r.code} stdout=${r.stdout.slice(0, 100)}`);
  if (parsed) {
    check("conversation_loaded 解析出 ConversationId", parsed.ConversationId === "conv-7f3a", JSON.stringify(parsed.ConversationId));
    check("agent_code 解析出 AgentAnswer（markdown）", parsed.AgentAnswer === "markdown answer **bold**", JSON.stringify(parsed.AgentAnswer));
    check("answer_update 解析出 HtmlAnswer", parsed.HtmlAnswer === "<p>html answer</p>", JSON.stringify(parsed.HtmlAnswer));
    check("reference 解析进 References（Title/Url 映射正确）",
      Array.isArray(parsed.References) && parsed.References[0]?.Title === "LNK Docs" && parsed.References[0]?.Url === "https://docs.example/lnk2019",
      JSON.stringify(parsed.References));
    check("无错误时 Error 为 null", parsed.Error === null, JSON.stringify(parsed.Error));
  }
  const askReq = requests.find((q) => q.url === "/assistant/questions");
  check("问题请求到达 config.baseUrl/assistant/questions", !!askReq);
  if (askReq) {
    check("PUBLIC-CSRF-TOKEN 头随问题请求发送（取自本进程刚申请的 token）", askReq.headers["public-csrf-token"] === "mock-token-1", String(askReq.headers["public-csrf-token"]));
    check("Accept: text/event-stream", askReq.headers.accept === "text/event-stream", String(askReq.headers.accept));
    check("Cb-Guest-Id 头回传缓存的 guestId", askReq.headers["cb-guest-id"] === "mock-guest-old", String(askReq.headers["cb-guest-id"]));
    check("cookies 从 csrf 步骤延续（Set-Cookie → Cookie 携带）", String(askReq.headers.cookie ?? "").includes("mockcsrf=abc123"), String(askReq.headers.cookie));
    let body = null;
    try { body = JSON.parse(askReq.body); } catch {}
    check("请求体 content 为问题原文", body?.content === "How to fix LNK2019?", askReq.body?.slice(0, 80));
    check("conversation-id 转大写后入请求体", body?.conversation_id === "CONV-LOWER-1", JSON.stringify(body?.conversation_id));
    check("默认 application=unreal_engine", body?.application === "unreal_engine", JSON.stringify(body?.application));
  }
  const cachedId = existsSync(guestIdFile) ? readFileSync(guestIdFile, "utf8").trim() : null;
  check("响应头 Cb-Guest-Id 新值覆盖写入缓存文件", cachedId === "mock-guest-new", String(cachedId));

  // ============ 4. answer：markdown 优先 ============
  console.log("\n[4] answer 高层封装");
  requests.length = 0;
  r = await run(["answer", "--question", "What is UPROPERTY?", "--app", "ue5-test-app", "--timeout", "30", "--config", cfgFull]);
  check("answer 输出 markdown 而非 HTML（agent_code 优先）", r.code === 0 && r.stdout.trim() === "markdown answer **bold**", `code=${r.code} stdout=${r.stdout.slice(0, 80)}`);
  const ansReq = requests.find((q) => q.url === "/assistant/questions");
  let ansBody = null;
  try { ansBody = JSON.parse(ansReq?.body ?? ""); } catch {}
  check("--app 覆盖 application 字段", ansBody?.application === "ue5-test-app", JSON.stringify(ansBody?.application));

  // ============ 5. 错误转译 ============
  console.log("\n[5] 错误转译契约");
  questionMode = "error";
  r = await run(["ask", "--question", "x", "--config", cfgFull]);
  let err1 = null;
  try { err1 = JSON.parse(r.stdout).Error; } catch {}
  check("服务端纯 JSON 错误体 → Error 字段点名 + exit 1", r.code === 1 && /conversation does not exist/.test(String(err1)), `code=${r.code} stdout=${r.stdout.slice(0, 120)}`);
  questionMode = "empty";
  r = await run(["ask", "--question", "x", "--config", cfgFull]);
  let err2 = null;
  try { err2 = JSON.parse(r.stdout).Error; } catch {}
  check("非 SSE 的 HTML/挑战页 → 转成 Epic Assistant API error + exit 1", r.code === 1 && /Epic Assistant API error/.test(String(err2)), `code=${r.code} stdout=${r.stdout.slice(0, 120)}`);

  // ============ 6. 临时文件清理 ============
  console.log("\n[6] 临时文件清理");
  const dumpsAfter = new Set(readdirSync(tmpdir()).filter((n) => n.startsWith("epic_assistant_headers_")));
  check("%TEMP% 无 header dump 残留（每次请求后自清理）",
    [...dumpsAfter].every((n) => dumpsBefore.has(n)),
    `新增残留: ${[...dumpsAfter].filter((n) => !dumpsBefore.has(n)).join(", ")}`);
} finally {
  server.close();
  // 还原真实状态
  for (const [f, data] of Object.entries(backup)) {
    if (data === null) { try { rmSync(f, { force: true }); } catch {} }
    else { try { writeFileSync(f, data); } catch {} }
  }
}

// ============ 7. 技能目录零写入 ============
console.log("\n[7] 技能目录零写入");
const skillAfter = snapshotSkill();
const keys = new Set([...Object.keys(skillBefore), ...Object.keys(skillAfter)]);
const diffs = [...keys].filter((k) => skillBefore[k] !== skillAfter[k]);
check("全部离线测试跑完，技能目录文件树与内容零变化", diffs.length === 0, `差异: ${diffs.join(", ")}`);

// 状态还原自检
const restoredOk = (backup[cookieFile] === null ? !existsSync(cookieFile) : readFileSync(cookieFile).equals(backup[cookieFile]))
  && (backup[guestIdFile] === null ? !existsSync(guestIdFile) : readFileSync(guestIdFile).equals(backup[guestIdFile]));
check("%TEMP% 真实状态文件已还原到测试前", restoredOk);

console.log(`\n离线测试: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
