#!/usr/bin/env node
// zcode-threads-mcp.mjs — MCP server exposing REAL top-level ZCode sessions as native tools.
//
// Registers in ~/.zcode/cli/config.json under mcp.servers. Once loaded (new session),
// the coordinator gets native tool calls: mcp__zcode_threads__create_session / send /
// wait / status / result / list / stop / close / approve — same experience as Codex's
// codex_app__create_thread, no terminal involved.
//
// Internally this server owns a headless ZCode app-server (same NDJSON protocol as the
// bundled zcode-session-driver.mjs daemon). Child sessions are ordinary top-level
// interactive sessions: persisted in the shared session store, visible and openable
// in the ZCode UI. Permission requests from child sessions are surfaced through the
// status/wait tools and answered via the approve tool (escalation policy).
//
// Zero dependencies (Node >= 20). Wire: MCP stdio = NDJSON JSON-RPC 2.0.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STATE_DIR = join(homedir(), ".zcode", "bridge");
const REGISTRY_FILE = join(STATE_DIR, "sessions.json");
const isWin = platform() === "win32";

// ---------- locate ZCode / model runtime ----------
function findZCodeExe() {
  if (process.env.ZCODE_EXE) return process.env.ZCODE_EXE;
  const candidates = isWin
    ? ["D:\\Program Files\\ZCode\\ZCode.exe", join(homedir(), "AppData", "Local", "Programs", "ZCode", "ZCode.exe"), "C:\\Program Files\\ZCode\\ZCode.exe"]
    : platform() === "darwin"
      ? ["/Applications/ZCode.app/Contents/MacOS/ZCode"]
      : ["/opt/ZCode/zcode", "/usr/local/bin/zcode"];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error("ZCode executable not found; set ZCODE_EXE");
}

function buildRuntimeModel(modelIdWanted) {
  const cfgPath = join(homedir(), ".zcode", "v2", "config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  const providers = cfg.provider || {};
  const pid = Object.keys(providers).find((k) => providers[k].enabled) || Object.keys(providers)[0];
  const pcfg = providers[pid];
  const ids = Object.keys(pcfg.models || {});
  if (!ids.length) throw new Error("provider " + pid + " has no models");
  const modelId = ids.includes(modelIdWanted) ? modelIdWanted : (ids.includes("GLM-5.3") ? "GLM-5.3" : ids[0]);
  const kind = pcfg.kind || "anthropic";
  return {
    revision: "mcp-" + Date.now(),
    generatedAt: Date.now(),
    model: { providerId: pid, modelId },
    provider: {
      providerId: pid,
      kind,
      apiFormat: kind === "anthropic" ? "anthropic-messages" : "openai-chat-completions",
      label: pcfg.name,
      source: pcfg.source || "custom",
      baseURL: pcfg.options?.baseURL,
      apiKey: { source: "inline", value: pcfg.options?.apiKey },
      models: ids.map((id) => ({ modelId: id, label: pcfg.models[id]?.name || id })),
    },
    thoughtLevel: "max",
  };
}

function readRegistry() { try { return JSON.parse(readFileSync(REGISTRY_FILE, "utf8")); } catch { return {}; } }
function writeRegistry(r) { try { writeFileSync(REGISTRY_FILE, JSON.stringify(r, null, 2)); } catch {} }

// ---------- headless app-server child ----------
const appServer = (() => {
  const exe = findZCodeExe();
  const cjs = join(dirname(exe), "resources", "glm", "zcode.cjs");
  const runtimeModel = buildRuntimeModel(process.env.ZCODE_THREADS_MODEL);
  const child = spawn(exe, [cjs, "app-server", "--stdio"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    windowsHide: true,
  });
  const state = { child, runtimeModel, pending: new Map(), nextId: 1, permissionWaiters: new Map() };

  let acc = "";
  child.stdout.on("data", (d) => {
    acc += d.toString("utf8");
    let i;
    while ((i = acc.indexOf("\n")) >= 0) { const line = acc.slice(0, i); acc = acc.slice(i + 1); if (line.trim()) handleLine(line); }
  });
  child.on("exit", () => process.exit(0));

  function handleLine(line) {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.method !== undefined && msg.id !== undefined) return handleServerRequest(msg);
    if (msg.method !== undefined) return; // notifications ignored
    const r = state.pending.get(msg.id);
    if (r) { state.pending.delete(msg.id); r(msg); }
  }

  function handleServerRequest(msg) {
    if (msg.method === "session/requestRuntimePreferences") {
      child.stdin.write(JSON.stringify({ id: msg.id, result: { nativeSearchEnhancementsEnabled: true, memoryEnabled: false, askUserQuestionAutoResolutionEnabled: true, modelContextBudgetStrategy: "preflight-v1" } }) + "\n");
      return;
    }
    if (msg.method === "interaction/requestPermission") {
      const sessionId = msg.params?.sessionId;
      const req = msg.params?.request ?? msg.params ?? {};
      const requestId = String(req.requestId ?? req.id ?? (req.toolName ?? "perm") + ":" + Date.now());
      state.permissionWaiters.set(requestId, { serverRequestId: msg.id, sessionId, request: req, arrivedAt: Date.now() });
      return; // answered asynchronously via approve
    }
    child.stdin.write(JSON.stringify({ id: msg.id, result: {} }) + "\n");
  }

  return state;
})();

function callAppServer(method, params, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const id = "s" + appServer.nextId++;
    const timer = setTimeout(() => { appServer.pending.delete(id); resolve({ error: { code: -1, message: "app-server timeout: " + method } }); }, timeoutMs);
    appServer.pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
    appServer.child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
  });
}

// ---------- session ops (shared with the CLI driver semantics) ----------
const registry = readRegistry();

async function ensureSession(sessionId) {
  const r = await callAppServer("session/read", { sessionId });
  if (!r.error) return true;
  const reg = registry[sessionId];
  if (!reg) return false;
  const res = await callAppServer("session/resume", { sessionId, workspace: reg.workspace });
  return !res.error;
}

async function readProjection(sessionId) {
  const r = await callAppServer("session/read", { sessionId });
  if (r.error) throw new Error("session/read: " + JSON.stringify(r.error).slice(0, 300));
  return r.result.projection ?? r.result.session ?? r.result;
}

function escalatedFor(sessionId) {
  return [...appServer.permissionWaiters.entries()].filter(([, w]) => !sessionId || w.sessionId === sessionId).map(([id, w]) => ({ requestId: id, sessionId: w.sessionId, request: w.request }));
}

const ops = {
  create_session: async (p) => {
    if (!p.workspace) throw new Error("workspace (absolute path) required");
    const params = { workspace: { workspacePath: p.workspace, workspaceKey: p.workspace }, runtimeModel: appServer.runtimeModel };
    if (p.mode) params.mode = p.mode;
    if (p.title) params.title = p.title;
    const r = await callAppServer("session/create", params);
    if (r.error) throw new Error("session/create: " + JSON.stringify(r.error).slice(0, 400));
    const sessionId = r.result.session.sessionId;
    registry[sessionId] = { workspace: p.workspace, tag: p.tag || "", mode: p.mode || "default", createdAt: Date.now(), promptCount: 0 };
    let send = null;
    if (p.prompt) {
      registry[sessionId].lastSendAt = Date.now();
      registry[sessionId].promptCount = 1;
      const s = await callAppServer("session/send", { sessionId, content: p.prompt });
      send = s.error ? { error: s.error } : { accepted: true };
    }
    writeRegistry(registry);
    return { sessionId, send };
  },
  send: async (p) => {
    if (!p.sessionId || !p.text) throw new Error("sessionId and text required");
    if (!(await ensureSession(p.sessionId))) throw new Error("session not known: " + p.sessionId);
    const r = await callAppServer("session/send", { sessionId: p.sessionId, content: p.text });
    if (r.error) throw new Error("session/send: " + JSON.stringify(r.error).slice(0, 300));
    registry[p.sessionId].promptCount = (registry[p.sessionId].promptCount || 0) + 1;
    registry[p.sessionId].lastSendAt = Date.now();
    writeRegistry(registry);
    return { accepted: true };
  },
  status: async (p) => {
    if (!p.sessionId) throw new Error("sessionId required");
    if (!(await ensureSession(p.sessionId))) throw new Error("session not known: " + p.sessionId);
    const pr = await readProjection(p.sessionId);
    return { status: pr.status, mode: pr.mode, turnCount: pr.turnCount, pendingPermissions: pr.pendingPermissions ?? [], activeToolCalls: pr.activeToolCalls ?? [], escalatedPermissions: escalatedFor(p.sessionId) };
  },
  wait: async (p) => {
    if (!p.sessionId) throw new Error("sessionId required");
    if (!(await ensureSession(p.sessionId))) throw new Error("session not known: " + p.sessionId);
    const timeoutMs = Math.min(Number(p.timeoutSeconds) || 600, 1800) * 1000;
    const guardMs = 5000; // session/read can serve a stale snapshot right after send
    const sentAt = registry[p.sessionId]?.lastSendAt || 0;
    const t0 = Date.now();
    let stable = 0;
    for (;;) {
      const pr = await readProjection(p.sessionId);
      const sinceSend = Date.now() - sentAt;
      if (pr.status !== "running" && sinceSend > guardMs) {
        stable++;
        if (stable >= 2) {
          const out = { status: pr.status, turnCount: pr.turnCount, escalatedPermissions: escalatedFor(p.sessionId) };
          if (p.includeResult !== false) out.result = await resultText(p.sessionId, false);
          return out;
        }
      } else stable = 0;
      if (Date.now() - t0 > timeoutMs) return { timeout: true, status: pr.status, turnCount: pr.turnCount };
      if (pr.status === "waiting" && sinceSend > guardMs) return { status: "waiting", escalatedPermissions: escalatedFor(p.sessionId) };
      await new Promise((r) => setTimeout(r, 2000));
    }
  },
  result: async (p) => {
    if (!p.sessionId) throw new Error("sessionId required");
    if (!(await ensureSession(p.sessionId))) throw new Error("session not known: " + p.sessionId);
    const all = await resultText(p.sessionId, true);
    return { turns: p.all === true ? all : all.slice(-1), totalTurns: all.length };
  },
  list: async (p) => {
    const out = [];
    for (const [sessionId, meta] of Object.entries(registry)) {
      if (p.tag && meta.tag !== p.tag) continue;
      out.push({ sessionId, ...meta });
    }
    return { sessions: out };
  },
  stop: async (p) => {
    if (!p.sessionId) throw new Error("sessionId required");
    const r = await callAppServer("session/stop", { sessionId: p.sessionId });
    return r.error ? { stopped: false, error: r.error } : { stopped: true };
  },
  close: async (p) => {
    if (!p.sessionId) throw new Error("sessionId required");
    const r = await callAppServer("session/close", { sessionId: p.sessionId });
    return r.error ? { closed: false, error: r.error } : { closed: true };
  },
  approve: async (p) => {
    const w = appServer.permissionWaiters.get(String(p.requestId));
    if (!w) throw new Error("no escalated permission with id " + p.requestId + "; check status.escalatedPermissions");
    appServer.permissionWaiters.delete(String(p.requestId));
    appServer.child.stdin.write(JSON.stringify({ id: w.serverRequestId, result: p.deny === true ? { decision: "deny", reason: "coordinator denied" } : { decision: "allow" } }) + "\n");
    return { answered: true, denied: p.deny === true };
  },
};

async function resultText(sessionId, all) {
  const r = await callAppServer("session/messages", { sessionId });
  if (r.error) throw new Error("session/messages: " + JSON.stringify(r.error).slice(0, 300));
  const turns = [];
  for (const m of r.result.messages || []) {
    if (m.info?.role !== "assistant") continue;
    const texts = (m.parts || []).filter((x) => typeof x.text === "string" && x.text.trim()).map((x) => x.text);
    if (texts.length) turns.push(texts.join("\n"));
  }
  return all ? turns : turns.slice(-1);
}

// ---------- MCP tool descriptors ----------
const TOOLS = [
  { name: "create_session", description: "Create a REAL top-level ZCode session for a workspace (typically a git worktree). Returns sessionId. The session is visible and openable in the ZCode UI session list. Optionally sends the first prompt immediately.", inputSchema: { type: "object", properties: { workspace: { type: "string", description: "Absolute path to the workspace/worktree" }, mode: { type: "string", enum: ["yolo", "build", "plan", "edit"], description: "Permission mode; yolo = no permission prompts (recommended for autonomous delivery)" }, tag: { type: "string", description: "Label for the coordinator map, e.g. wt1" }, title: { type: "string", description: "Optional session title" }, prompt: { type: "string", description: "Optional fully self-contained first task prompt" } }, required: ["workspace"] } },
  { name: "send", description: "Send a follow-up prompt to an existing session. Keeps full context. Fails with -32010 while a turn is still running (use wait first).", inputSchema: { type: "object", properties: { sessionId: { type: "string" }, text: { type: "string" } }, required: ["sessionId", "text"] } },
  { name: "wait", description: "Wait for the session's current turn to settle (idle/waiting/error) and return the final status plus the last assistant message. Guards against the stale-snapshot race right after send.", inputSchema: { type: "object", properties: { sessionId: { type: "string" }, timeoutSeconds: { type: "number", description: "Default 600, max 1800" }, includeResult: { type: "boolean", description: "Include last assistant text (default true)" } }, required: ["sessionId"] } },
  { name: "status", description: "Point-in-time session state: idle/running/waiting/paused/completed/error, active tool calls, and permission requests escalated to the coordinator.", inputSchema: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] } },
  { name: "result", description: "Read assistant text turns from the session (last turn by default, all with all=true).", inputSchema: { type: "object", properties: { sessionId: { type: "string" }, all: { type: "boolean" } }, required: ["sessionId"] } },
  { name: "list", description: "List sessions created through this server (coordinator map), optionally filtered by tag.", inputSchema: { type: "object", properties: { tag: { type: "string" } } } },
  { name: "stop", description: "Abort a session's active turn.", inputSchema: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] } },
  { name: "close", description: "Unload a finished session from this server's memory (history persists in the ZCode session store).", inputSchema: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] } },
  { name: "approve", description: "Answer a permission request escalated from a child session (allow, or deny with deny=true). Request ids come from status/wait escalatedPermissions.", inputSchema: { type: "object", properties: { sessionId: { type: "string" }, requestId: { type: "string" }, deny: { type: "boolean" } }, required: ["sessionId", "requestId"] } },
];

// ---------- MCP stdio server ----------
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) handleMcp(line); }
});
process.stdin.on("end", () => process.exit(0));
process.on("exit", () => { try { appServer.child.kill(); } catch {} });

function send(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }

async function handleMcp(line) {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id === undefined) return; // notifications (initialized, cancelled) — ignore
  try {
    if (msg.method === "initialize") {
      return send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: msg.params?.protocolVersion || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "zcode_threads", version: "1.0.0" } } });
    }
    if (msg.method === "ping") return send({ jsonrpc: "2.0", id: msg.id, result: {} });
    if (msg.method === "tools/list") return send({ jsonrpc: "2.0", id: msg.id, result: { tools: TOOLS } });
    if (msg.method === "tools/call") {
      const name = msg.params?.name;
      const args = msg.params?.arguments || {};
      const fn = ops[name];
      if (!fn) return send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "unknown tool: " + name }], isError: true } });
      try {
        const data = await fn(args);
        return send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(data, null, 1) }] } });
      } catch (e) {
        return send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: String(e.message || e) }], isError: true } });
      }
    }
    return send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found: " + msg.method } });
  } catch (e) {
    send({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: String(e.message || e) } });
  }
}
