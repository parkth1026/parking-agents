#!/usr/bin/env node
// epic-assistant.mjs — 查询 Epic Games UE5 官方知识库
// （EpicAssistant.psm1 的 Node ESM 移植，行为保持一致）
//
// 使用 dev.epicgames.com 社区助手 API（SSE 流式响应）。
// 使用 curl.exe 绕过 Cloudflare 挑战（Node fetch 会被拦截）。
// API 端点与请求头全部来自上级目录 config.json，脚本内无硬编码 URL。
//
// 会话归属：服务端通过 Cb-Guest-Id 响应头分配 guestId，follow-up 提问必须回传同名请求头，
// 否则服务端返回 {"error":"conversation does not exist"}。网页端把它存 localStorage（cbGuestId），
// 本脚本等价地缓存在临时目录 epic_assistant_guest_id.txt。
//
// 用法:
//   node epic-assistant.mjs csrf
//       获取 CSRF token，输出 JSON: { "token": "..." } 或 { "error": "..." }
//   node epic-assistant.mjs ask --question "..." [--conversation-id ID] [--timeout 120] [--app unreal_engine]
//       完整查询，输出 JSON: { AgentAnswer, HtmlAnswer, References, ConversationId, Error, ... }
//   node epic-assistant.mjs answer --question "..."
//       高层封装：优先 agent_code（markdown），回退 html，只输出答案文本
//   公共参数: --config <config.json>（默认取脚本上级目录）

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));

// ---- CLI 参数 ----
function parseArgs(argv) {
  const args = {
    command: argv[0],
    config: join(scriptDir, "..", "config.json"),
    question: null,
    conversationId: null,
    timeout: 120,
    app: "unreal_engine",
  };
  for (let i = 1; i < argv.length; i++) {
    switch (argv[i]) {
      case "--config": args.config = argv[++i]; break;
      case "--question": case "-q": args.question = argv[++i]; break;
      case "--conversation-id": args.conversationId = argv[++i]; break;
      case "--timeout": args.timeout = parseInt(argv[++i], 10); break;
      case "--app": args.app = argv[++i]; break;
      default:
        console.error(`未知参数: ${argv[i]}`);
        process.exit(2);
    }
  }
  if (!["csrf", "ask", "answer"].includes(args.command)) {
    console.error(`未知子命令: ${args.command}（可用: csrf | ask | answer）`);
    process.exit(2);
  }
  if (args.command !== "csrf" && !args.question) {
    console.error(`缺少 --question 参数`);
    process.exit(2);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

// 读取 config（baseUrl/origin/referer/userAgent 全部来自这里）
// 容错：strip UTF-8 BOM（历史 config 可能带 BOM，JSON.parse 不接受）
let api;
try {
  api = JSON.parse(readFileSync(args.config, "utf8").replace(/^\uFEFF/, "")).api;
} catch (e) {
  console.error(`读取 config 失败 (${args.config}): ${e.code === "ENOENT" ? "文件不存在" : e.message}`);
  process.exit(1);
}
const missingKeys = ["baseUrl", "origin", "referer", "userAgent"].filter((k) => !api?.[k]);
if (missingKeys.length) {
  console.error(`config 缺少必需字段: ${missingKeys.map((k) => `api.${k}`).join(", ")} (${args.config})`);
  process.exit(1);
}

const cookieFile = join(tmpdir(), "epic_assistant_cookies.txt");
const guestIdFile = join(tmpdir(), "epic_assistant_guest_id.txt");
const headerDumpFile = join(tmpdir(), `epic_assistant_headers_${process.pid}.txt`);

// ---- curl 封装 ----
function curl(curlArgs, input) {
  return new Promise((resolve) => {
    const child = spawn("curl.exe", curlArgs, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => resolve({ stdout: "", stderr: String(e), code: null }));
    child.on("close", (code) => resolve({ stdout, stderr, code }));
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

function commonHeaders() {
  return [
    "-H", `User-Agent: ${api.userAgent}`,
    "-H", "Content-Type: application/json",
    "-H", `Origin: ${api.origin}`,
    "-H", `Referer: ${api.referer}`,
  ];
}

// ---- Guest ID（会话归属，等价网页端 localStorage 的 cbGuestId） ----
function readCachedGuestId() {
  try { return readFileSync(guestIdFile, "utf8").trim() || null; } catch { return null; }
}

function saveGuestId(id) {
  if (!id) return;
  try { writeFileSync(guestIdFile, id); } catch { /* 缓存失败不影响当次请求 */ }
}

function headerValue(dumpText, name) {
  const m = dumpText.match(new RegExp(`^${name}:\\s*(.+)\\s*$`, "mi"));
  return m ? m[1].trim() : null;
}

// 从响应头 dump（curl -D）里提取并持久化服务端最新分配的 guestId
function captureGuestIdFromHeaders() {
  try {
    saveGuestId(headerValue(readFileSync(headerDumpFile, "utf8"), "Cb-Guest-Id"));
  } catch { /* 响应头不可读时保留旧值 */ }
  try { rmSync(headerDumpFile, { force: true }); } catch {}
}

// 兜底：无缓存且需要 follow-up 时，向 /assistant/guest_id 申请一个（响应头 Cb-Guest-Id）
async function fetchGuestId() {
  const { code } = await curl([
    "-s", "-o", "NUL", "-D", headerDumpFile,
    "-b", cookieFile, "-c", cookieFile,
    `${api.baseUrl}/assistant/guest_id`,
    ...commonHeaders(),
  ]);
  if (code !== 0) return null;
  let id = null;
  try { id = headerValue(readFileSync(headerDumpFile, "utf8"), "Cb-Guest-Id"); } catch {}
  try { rmSync(headerDumpFile, { force: true }); } catch {}
  if (id) saveGuestId(id);
  return id;
}

// ---- Get-EpicCsrfToken 等价 ----
async function getCsrfToken() {
  const url = `${api.baseUrl}/csrf_protection/token.json`;
  const { stdout } = await curl([
    "-s", "-b", cookieFile, "-c", cookieFile,
    url, "-X", "POST",
    ...commonHeaders(),
    "-H", "Accept: application/json",
    "-d", '{"create_csrf_token_request":"true"}',
  ]);
  try {
    const json = JSON.parse(stdout);
    if (json.public_csrf_token) return { token: json.public_csrf_token };
    return { error: `No token in response: ${stdout.slice(0, 200)}` };
  } catch {
    return { error: `Failed to parse CSRF response: ${stdout.slice(0, 200)}` };
  }
}

// ---- ParseSSEResponse 等价 ----
function emptyResult() {
  return {
    ConversationId: null,
    ConversationName: null,
    QuestionId: null,
    AnswerId: null,
    AgentAnswer: "",
    HtmlAnswer: "",
    References: [],
    Error: null,
  };
}

function parseSSEResponse(raw) {
  const result = emptyResult();

  // SSE 事件以空行分隔
  for (const event of raw.split("\n\n")) {
    let eventType = null;
    let eventData = null;
    for (const line of event.split("\n")) {
      let m = line.match(/^event:\s*(.+)$/);
      if (m) { eventType = m[1].trim(); continue; }
      m = line.match(/^data:\s*(.+)$/);
      if (m) { eventData = m[1].trim(); }
    }
    if (!eventType || !eventData) continue;

    let data;
    try { data = JSON.parse(eventData); } catch { continue; }

    switch (eventType) {
      case "conversation_loaded":
        result.ConversationId = data.id;
        result.ConversationName = data.name;
        break;
      case "question_created":
        result.QuestionId = data.id;
        break;
      case "answer_created":
        result.AnswerId = data.id;
        break;
      case "reference":
        result.References.push({
          Title: data.title,
          Url: data.content,
          Description: data.description,
          Type: data.type,
        });
        break;
      case "agent_code":
        result.AgentAnswer = data.content;
        break;
      case "answer_update":
        result.HtmlAnswer = data.content;
        break;
      case "error":
        result.Error = typeof data === "string" ? data : String(data.error ?? data.message ?? JSON.stringify(data));
        break;
    }
  }
  return result;
}

// ---- Invoke-EpicAssistantQuery 等价 ----
async function invokeQuery(question, { conversationId, timeoutSec, application }) {
  const { token, error } = await getCsrfToken();
  if (!token) return { ...emptyResult(), Error: `Failed to obtain CSRF token (${error})` };

  // follow-up 依赖 guestId 定位会话；无缓存时惰性申请一个（新会话本身不强制需要）
  let guestId = readCachedGuestId();
  if (!guestId && conversationId) guestId = await fetchGuestId();

  const body = { content: question, application, format: "html" };
  if (conversationId) body.conversation_id = conversationId.toUpperCase();

  const url = `${api.baseUrl}/assistant/questions`;
  const curlArgs = [
    "-s", "-b", cookieFile, "-c", cookieFile,
    "-D", headerDumpFile,
    url, "-X", "POST",
    ...commonHeaders(),
    "-H", "Accept: text/event-stream",
    "-H", `PUBLIC-CSRF-TOKEN: ${token}`,
  ];
  if (guestId) curlArgs.push("-H", `Cb-Guest-Id: ${guestId}`);

  const { stdout, code } = await curl([...curlArgs, "--data-binary", "@-", "--max-time", String(timeoutSec)], JSON.stringify(body));

  // 服务端可能在任意响应里轮换 guestId，跟进最新值供后续 follow-up 使用
  captureGuestIdFromHeaders();

  if (!stdout || stdout.length < 10) {
    return { ...emptyResult(), Error: `Empty response from Epic Assistant API (curl exit ${code})` };
  }

  const result = parseSSEResponse(stdout);

  // 错误场景（限流、Cloudflare 挑战页、conversation 不存在等）下服务端返回的是
  // 非 SSE 的纯 JSON/HTML/文本体，上面解析不到任何事件。必须转成显式 Error 并
  // 非零退出，否则调用方拿到 Error:null + 退出码 0 会误判为成功
  if (!result.Error && !result.ConversationId && !result.AgentAnswer && !result.HtmlAnswer && result.References.length === 0) {
    let detail = stdout.trim().slice(0, 200);
    try {
      const j = JSON.parse(stdout);
      if (j && j.error) detail = String(j.error);
    } catch { /* 非 JSON 体，保留原文截断 */ }
    return { ...result, Error: `Epic Assistant API error: ${detail}` };
  }
  return result;
}

// ---- 主分发 ----
if (args.command === "csrf") {
  const r = await getCsrfToken();
  console.log(JSON.stringify(r, null, 2));
  if (r.error) process.exitCode = 1;
} else if (args.command === "ask") {
  const r = await invokeQuery(args.question, {
    conversationId: args.conversationId,
    timeoutSec: args.timeout,
    application: args.app,
  });
  console.log(JSON.stringify(r, null, 2));
  if (r.Error) process.exitCode = 1;
} else {
  // answer: 高层封装，只输出答案文本
  const r = await invokeQuery(args.question, { conversationId: null, timeoutSec: args.timeout, application: args.app });
  if (r.Error) {
    console.error(`Epic Assistant error: ${r.Error}`);
    process.exitCode = 1;
  } else if (r.AgentAnswer) {
    console.log(r.AgentAnswer);
  } else if (r.HtmlAnswer) {
    console.log(r.HtmlAnswer);
  } else {
    console.error("Epic Assistant returned no answer");
    process.exitCode = 1;
  }
}
