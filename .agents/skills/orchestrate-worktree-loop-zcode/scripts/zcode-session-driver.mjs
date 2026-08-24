#!/usr/bin/env node
// zcode-session-driver.mjs — master-agent control plane for REAL top-level ZCode sessions.
//
// Architecture: a long-lived `daemon` bridges a headless ZCode app-server (NDJSON JSON-RPC
// over stdio) to a local TCP port. Short-lived CLI subcommands talk to the daemon, so a
// coordinator session can create / drive / monitor visible top-level sessions across many
// Bash invocations. Child sessions are ordinary interactive ZCode sessions: persisted in
// the shared session store, visible in the ZCode UI, and resumable by the user.
//
// Zero dependencies (Node >= 20). Windows/macOS/Linux best-effort.
//
// Usage:
//   node zcode-session-driver.mjs daemon [--state-dir DIR] [--port N] [--permission-policy allow|deny|escalate]
//                                        [--exe PATH] [--model ID]        # run in background; writes bridge.json
//   node zcode-session-driver.mjs create --workspace DIR [--mode yolo|build|plan|edit] [--tag NAME]
//                                        [--prompt TEXT | --file F]
//   node zcode-session-driver.mjs send <sessionId> [--text TEXT | --file F]
//   node zcode-session-driver.mjs status <sessionId>            # -> state, pendingPermissions, activeToolCalls
//   node zcode-session-driver.mjs wait <sessionId> [--timeout S] [--text]   # poll to completion, print result
//   node zcode-session-driver.mjs result <sessionId> [--all]    # assistant text of last turn (or all turns)
//   node zcode-session-driver.mjs list [--tag NAME]             # sessions created through this bridge
//   node zcode-session-driver.mjs stop <sessionId>              # abort active turn
//   node zcode-session-driver.mjs close <sessionId>             # unload from daemon memory (keeps history)
//   node zcode-session-driver.mjs approve <sessionId> <requestId> [--deny]   # answer escalated permission
//   node zcode-session-driver.mjs daemon-stop
//
// Env: ZCODE_EXE overrides the ZCode executable path.

import { spawn } from "node:child_process";
import { createServer, connect } from "node:net";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

// ---------- args ----------
function parseArgs(argv) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) opts[key] = true;
      else { opts[key] = next; i++; }
    } else pos.push(a);
  }
  return { pos, opts };
}

function die(msg, code = 1) { console.error("ERROR: " + msg); process.exit(code); }
const isWin = platform() === "win32";

// ---------- locate ZCode ----------
function findZCodeExe(override) {
  if (override) return override;
  if (process.env.ZCODE_EXE) return process.env.ZCODE_EXE;
  const candidates = isWin
    ? ["D:\\Program Files\\ZCode\\ZCode.exe", join(homedir(), "AppData", "Local", "Programs", "ZCode", "ZCode.exe"), "C:\\Program Files\\ZCode\\ZCode.exe"]
    : platform() === "darwin"
      ? ["/Applications/ZCode.app/Contents/MacOS/ZCode"]
      : ["/opt/ZCode/zcode", "/usr/local/bin/zcode"];
  for (const c of candidates) if (existsSync(c)) return c;
  die("ZCode executable not found; pass --exe or set ZCODE_EXE");
}

function findAppServerCjs(exePath) {
  const cjs = join(dirname(exePath), "resources", "glm", "zcode.cjs");
  if (!existsSync(cjs)) die("app-server bundle not found next to executable: " + cjs);
  return cjs;
}

// ---------- model runtime from v2 config ----------
function buildRuntimeModel(modelIdWanted) {
  const cfgPath = join(homedir(), ".zcode", "v2", "config.json");
  if (!existsSync(cfgPath)) die("missing " + cfgPath + " (log into ZCode once so providers exist)");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  const providers = cfg.provider || {};
  const pid = Object.keys(providers).find((k) => providers[k].enabled) || Object.keys(providers)[0];
  if (!pid) die("no providers configured in v2 config");
  const pcfg = providers[pid];
  const ids = Object.keys(pcfg.models || {});
  if (!ids.length) die("provider " + pid + " has no models");
  const modelId = ids.includes(modelIdWanted) ? modelIdWanted : (ids.includes("GLM-5.3") ? "GLM-5.3" : ids[0]);
  const kind = pcfg.kind || "anthropic";
  return {
    revision: "bridge-" + Date.now(),
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

// ---------- bridge state ----------
function defaultStateDir() {
  const base = process.env.ZCODE_BRIDGE_DIR || join(homedir(), ".zcode", "bridge");
  mkdirSync(base, { recursive: true });
  return base;
}
const stateFile = (dir) => join(dir, "bridge.json");
const registryFile = (dir) => join(dir, "sessions.json");
const logFile = (dir) => join(dir, "bridge.log");

function readBridge(dir) {
  const f = stateFile(dir);
  if (!existsSync(f)) die("bridge not running (no " + f + "); start it with the `daemon` subcommand in a background shell");
  return JSON.parse(readFileSync(f, "utf8"));
}
function readRegistry(dir) {
  try { return JSON.parse(readFileSync(registryFile(dir), "utf8")); } catch { return {}; }
}
function writeRegistry(dir, reg) { writeFileSync(registryFile(dir), JSON.stringify(reg, null, 2)); }
function logLine(dir, obj) {
  try { appendFileSync(logFile(dir), JSON.stringify({ t: new Date().toISOString(), ...obj }) + "\n"); } catch {}
}

// ============================================================
// DAEMON
// ============================================================
async function runDaemon(opts) {
  const stateDir = defaultStateDir();
  mkdirSync(stateDir, { recursive: true });
  const exe = findZCodeExe(opts.exe);
  const cjs = findAppServerCjs(exe);
  const permissionPolicy = opts["permission-policy"] || "escalate";
  if (!["allow", "deny", "escalate"].includes(permissionPolicy)) die("--permission-policy must be allow|deny|escalate");

  // refuse to double-start on the same state dir
  const existing = existsSync(stateFile(stateDir)) ? readBridge(stateDir) : null;
  if (existing) {
    try {
      const alive = await tcpRoundtrip(existing, { op: "ping", params: {} }, 1500);
      if (alive?.ok) die("bridge already running on port " + existing.port + " (pid " + existing.pid + "); reuse it or daemon-stop first");
    } catch { /* stale state file; proceed */ }
  }

  const runtimeModel = buildRuntimeModel(opts.model);
  const child = spawn(exe, [cjs, "app-server", "--stdio"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    windowsHide: true,
  });

  const srv = { pending: new Map(), nextId: 1, permissionWaiters: new Map() };
  let acc = "";
  child.stdout.on("data", (d) => {
    acc += d.toString("utf8");
    let i;
    while ((i = acc.indexOf("\n")) >= 0) { const line = acc.slice(0, i); acc = acc.slice(i + 1); handleAppServerLine(line); }
  });
  child.stderr.on("data", (d) => logLine(stateDir, { kind: "appserver-stderr", text: d.toString("utf8").slice(0, 500) }));
  child.on("exit", (code) => { logLine(stateDir, { kind: "appserver-exit", code }); shutdown(code ?? 0); });

  function sendToAppServer(obj) { child.stdin.write(JSON.stringify(obj) + "\n"); }
  function callAppServer(method, params, timeoutMs = 120000) {
    return new Promise((resolve) => {
      const id = "c" + srv.nextId++;
      const timer = setTimeout(() => { srv.pending.delete(id); resolve({ error: { code: -1, message: "app-server timeout: " + method } }); }, timeoutMs);
      srv.pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
      sendToAppServer({ id, method, params });
    });
  }

  function handleAppServerLine(line) {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { logLine(stateDir, { kind: "appserver-nonjson", text: line.slice(0, 300) }); return; }
    if (msg.method !== undefined && msg.id !== undefined) return handleServerRequest(msg);
    if (msg.method !== undefined) {
      if (/state\.updated|permission/i.test(msg.method || "")) logLine(stateDir, { kind: "notify", method: msg.method, params: JSON.stringify(msg.params || {}).slice(0, 400) });
      return;
    }
    const r = srv.pending.get(msg.id);
    if (r) { srv.pending.delete(msg.id); r(msg); }
  }

  async function handleServerRequest(msg) {
    const m = msg.method;
    logLine(stateDir, { kind: "srv-req", method: m, params: JSON.stringify(msg.params || {}).slice(0, 400) });
    if (m === "session/requestRuntimePreferences") {
      return sendToAppServer({ id: msg.id, result: { nativeSearchEnhancementsEnabled: true, memoryEnabled: false, askUserQuestionAutoResolutionEnabled: true, modelContextBudgetStrategy: "preflight-v1" } });
    }
    if (m === "interaction/requestPermission") {
      const sessionId = msg.params?.sessionId;
      const req = msg.params?.request ?? msg.params ?? {};
      const requestId = req.requestId ?? req.id ?? randomUUID();
      if (permissionPolicy === "allow") return sendToAppServer({ id: msg.id, result: { decision: "allow" } });
      if (permissionPolicy === "deny") return sendToAppServer({ id: msg.id, result: { decision: "deny", reason: "bridge policy deny" } });
      // escalate: record it; `approve` answers later; park this server request
      srv.permissionWaiters.set(String(requestId), { serverRequestId: msg.id, sessionId, request: req, arrivedAt: Date.now() });
      logLine(stateDir, { kind: "permission-escalated", sessionId, requestId });
      return; // answered asynchronously by approve
    }
    // generic ack for anything else
    sendToAppServer({ id: msg.id, result: {} });
  }

  // known session registry (persisted for `list`)
  const registry = readRegistry(stateDir);

  async function ensureSession(sessionId) {
    const r = await callAppServer("session/read", { sessionId });
    if (!r.error) return true;
    const reg = registry[sessionId];
    if (!reg) return false;
    // session/resume expects workspace as an object (same shape as session/create);
    // passing the raw path string is a schema error.
    const res = await callAppServer("session/resume", {
      sessionId,
      workspace: { workspacePath: reg.workspace, workspaceKey: reg.workspace },
    });
    return !res.error;
  }

  const ops = {
    ping: async () => ({ ok: true, policy: permissionPolicy, model: runtimeModel.model }),
    create: async (p) => {
      if (!p.workspace) throw new Error("workspace required");
      const params = { workspace: { workspacePath: p.workspace, workspaceKey: p.workspace }, runtimeModel };
      if (p.mode) params.mode = p.mode;
      const r = await callAppServer("session/create", params);
      if (r.error) throw new Error("session/create: " + JSON.stringify(r.error).slice(0, 400));
      const sessionId = r.result.session.sessionId;
      registry[sessionId] = { workspace: p.workspace, tag: p.tag || "", mode: p.mode || "default", createdAt: Date.now(), promptCount: 0 };
      let sendRes = null;
      if (p.prompt) {
        registry[sessionId].lastSendAt = Date.now();
        registry[sessionId].promptCount = 1;
        const s = await callAppServer("session/send", { sessionId, content: p.prompt });
        sendRes = s.error ? { error: s.error } : { accepted: true };
      }
      writeRegistry(stateDir, registry);
      return { sessionId, send: sendRes };
    },
    send: async (p) => {
      if (!await ensureSession(p.sessionId)) throw new Error("session not known to bridge: " + p.sessionId);
      const r = await callAppServer("session/send", { sessionId: p.sessionId, content: p.text });
      if (r.error) throw new Error("session/send: " + JSON.stringify(r.error).slice(0, 300));
      registry[p.sessionId].promptCount = (registry[p.sessionId].promptCount || 0) + 1;
      registry[p.sessionId].lastSendAt = Date.now();
      writeRegistry(stateDir, registry);
      return { accepted: true };
    },
    readProjection: async (sessionId) => {
      const r = await callAppServer("session/read", { sessionId });
      if (r.error) throw new Error("session/read: " + JSON.stringify(r.error).slice(0, 300));
      return r.result.projection ?? r.result.session ?? r.result;
    },
    status: async (p) => {
      if (!await ensureSession(p.sessionId)) throw new Error("session not known to bridge: " + p.sessionId);
      const pr = await ops.readProjection(p.sessionId);
      const escalated = [...srv.permissionWaiters.entries()].filter(([, w]) => w.sessionId === p.sessionId).map(([id, w]) => ({ requestId: id, request: w.request }));
      return { status: pr.status, mode: pr.mode, turnCount: pr.turnCount, currentTurnId: pr.currentTurnId ?? null, pendingPermissions: pr.pendingPermissions ?? [], activeToolCalls: pr.activeToolCalls ?? [], backgroundJobs: pr.backgroundJobs ?? [], escalatedPermissions: escalated };
    },
    wait: async (p) => {
      if (!await ensureSession(p.sessionId)) throw new Error("session not known to bridge: " + p.sessionId);
      const timeoutMs = p.timeoutMs || 600000;
      const guardMs = 5000; // session/read can serve a stale snapshot right after send
      const sentAt = registry[p.sessionId]?.lastSendAt || 0;
      const t0 = Date.now();
      let stable = 0;
      let last;
      for (;;) {
        const pr = await ops.readProjection(p.sessionId);
        last = pr;
        const sinceSend = Date.now() - sentAt;
        const settled = pr.status !== "running" && sinceSend > guardMs;
        if (settled) {
          stable++;
          if (stable >= 2) {
            const escalated = [...srv.permissionWaiters.entries()].filter(([, w]) => w.sessionId === p.sessionId).map(([id, w]) => ({ requestId: id, request: w.request }));
            return { status: pr.status, mode: pr.mode, turnCount: pr.turnCount, pendingPermissions: pr.pendingPermissions ?? [], activeToolCalls: pr.activeToolCalls ?? [], escalatedPermissions: escalated };
          }
        } else stable = 0;
        if (Date.now() - t0 > timeoutMs) return { timeout: true, status: pr.status, turnCount: pr.turnCount };
        if (pr.status === "waiting" && sinceSend > guardMs) {
          // needs a decision; report immediately, coordinator resolves via approve
          const escalated = [...srv.permissionWaiters.entries()].filter(([, w]) => w.sessionId === p.sessionId).map(([id, w]) => ({ requestId: id, request: w.request }));
          return { status: "waiting", pendingPermissions: pr.pendingPermissions ?? [], escalatedPermissions: escalated };
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    },
    result: async (p) => {
      if (!await ensureSession(p.sessionId)) throw new Error("session not known to bridge: " + p.sessionId);
      const r = await callAppServer("session/messages", { sessionId: p.sessionId });
      if (r.error) throw new Error("session/messages: " + JSON.stringify(r.error).slice(0, 300));
      const msgs = r.result.messages || [];
      const turns = [];
      for (const m of msgs) {
        const role = m.info?.role;
        const texts = (m.parts || []).filter((x) => typeof x.text === "string" && x.text.trim()).map((x) => x.text);
        if (role === "assistant" && texts.length) turns.push(texts.join("\n"));
      }
      const pick = p.all ? turns : turns.slice(-1);
      return { turns: pick, totalTurns: turns.length };
    },
    list: async (p) => {
      const out = [];
      for (const [sessionId, meta] of Object.entries(registry)) {
        if (p.tag && meta.tag !== p.tag) continue;
        let status = "unknown";
        try { const s = await ops.status({ sessionId }); status = s.status; } catch {}
        out.push({ sessionId, ...meta, status });
      }
      return { sessions: out };
    },
    stop: async (p) => {
      const r = await callAppServer("session/stop", { sessionId: p.sessionId });
      return r.error ? { stopped: false, error: r.error } : { stopped: true };
    },
    close: async (p) => {
      const r = await callAppServer("session/close", { sessionId: p.sessionId });
      return r.error ? { closed: false, error: r.error } : { closed: true };
    },
    approve: async (p) => {
      const w = srv.permissionWaiters.get(String(p.requestId));
      if (!w) throw new Error("no escalated permission with id " + p.requestId);
      srv.permissionWaiters.delete(String(p.requestId));
      sendToAppServer({ id: w.serverRequestId, result: p.deny ? { decision: "deny", reason: "coordinator denied" } : { decision: "allow" } });
      return { answered: true, denied: !!p.deny };
    },
    daemonStop: async () => { setTimeout(() => shutdown(0), 100); return { stopping: true }; },
  };

  // TCP server
  const server = createServer((sock) => {
    let buf = "";
    sock.on("data", async (d) => {
      buf += d.toString("utf8");
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        let req;
        try { req = JSON.parse(line); } catch { sock.write(JSON.stringify({ id: null, ok: false, error: "bad json" }) + "\n"); continue; }
        if (req.auth !== bridge.token) { sock.write(JSON.stringify({ id: req.id, ok: false, error: "bad auth" }) + "\n"); continue; }
        try {
          const fn = ops[req.op];
          if (!fn) throw new Error("unknown op " + req.op);
          const data = await fn(req.params || {});
          sock.write(JSON.stringify({ id: req.id, ok: true, data }) + "\n");
        } catch (e) {
          sock.write(JSON.stringify({ id: req.id, ok: false, error: String(e.message || e) }) + "\n");
        }
      }
    });
  });

  const bridge = { token: randomUUID(), port: 0, pid: process.pid, startedAt: Date.now() };
  await new Promise((res) => server.listen(opts.port ? Number(opts.port) : 0, "127.0.0.1", res));
  bridge.port = server.address().port;
  writeFileSync(stateFile(stateDir), JSON.stringify(bridge, null, 2));

  let shuttingDown = false;
  function shutdown(code) {
    if (shuttingDown) return;
    shuttingDown = true;
    try { server.close(); } catch {}
    try { child.kill(); } catch {}
    try { if (existsSync(stateFile(stateDir))) unlinkSync(stateFile(stateDir)); } catch {}
    process.exit(code);
  }
  process.on("SIGTERM", () => shutdown(0));
  process.on("SIGINT", () => shutdown(0));
  process.on("exit", () => { try { child.kill(); } catch {} });

  console.log("BRIDGE_READY port=" + bridge.port + " stateDir=" + stateDir + " policy=" + permissionPolicy + " model=" + runtimeModel.model.providerId + "/" + runtimeModel.model.modelId);
  // keep alive
  setInterval(() => {}, 60000);
}

// ============================================================
// CLIENT
// ============================================================
function tcpRoundtrip(bridge, payload, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const sock = connect(bridge.port, "127.0.0.1");
    let buf = "";
    const timer = setTimeout(() => { sock.destroy(); reject(new Error("bridge timeout (" + timeoutMs + "ms)")); }, timeoutMs);
    sock.on("connect", () => sock.write(JSON.stringify({ id: 1, auth: bridge.token, ...payload }) + "\n"));
    sock.on("data", (d) => {
      buf += d.toString("utf8");
      const i = buf.indexOf("\n");
      if (i < 0) return;
      clearTimeout(timer);
      let msg;
      try { msg = JSON.parse(buf.slice(0, i)); } catch (e) { sock.destroy(); return reject(e); }
      sock.destroy();
      resolve(msg);
    });
    sock.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

async function callBridge(op, params, timeoutMs) {
  const stateDir = defaultStateDir();
  const bridge = readBridge(stateDir);
  const res = await tcpRoundtrip(bridge, { op, params }, timeoutMs);
  if (!res.ok) die("bridge op " + op + " failed: " + res.error);
  return res.data;
}

async function readStdinOrFile(opts) {
  if (typeof opts.text === "string" && opts.text !== true) return opts.text;
  if (typeof opts.file === "string" && opts.file !== true) return readFileSync(opts.file, "utf8");
  return null;
}

async function main() {
  const [sub, ...rest] = process.argv.slice(2);
  const { pos, opts } = parseArgs(rest);
  if (!sub) {
    console.log("subcommands: daemon | create | send | status | wait | result | list | stop | close | approve | daemon-stop");
    process.exit(sub === undefined && !process.argv[2] ? 0 : 2);
  }
  const num = (v, d) => (v === undefined || v === true ? d : Number(v));

  switch (sub) {
    case "daemon":
      return runDaemon(opts);
    case "create": {
      const workspace = opts.workspace;
      if (!workspace || workspace === true) die("--workspace <absolute path> required");
      if (opts.title) die("--title is not supported by the app-server session protocol; omit it");
      const prompt = typeof opts.prompt === "string" ? opts.prompt : await readStdinOrFile(opts);
      const data = await callBridge("create", { workspace, mode: opts.mode, tag: opts.tag, prompt }, 60000);
      console.log(JSON.stringify(data));
      return;
    }
    case "send": {
      const sessionId = pos[0];
      if (!sessionId) die("usage: send <sessionId> --text ... | --file F");
      const text = await readStdinOrFile(opts);
      if (!text) die("--text or --file required");
      console.log(JSON.stringify(await callBridge("send", { sessionId, text }, 60000)));
      return;
    }
    case "status": {
      const sessionId = pos[0];
      if (!sessionId) die("usage: status <sessionId>");
      console.log(JSON.stringify(await callBridge("status", { sessionId }, 30000)));
      return;
    }
    case "wait": {
      const sessionId = pos[0];
      if (!sessionId) die("usage: wait <sessionId> [--timeout S]");
      const timeoutMs = num(opts.timeout, 600) * 1000;
      const s = await callBridge("wait", { sessionId, timeoutMs }, timeoutMs + 60000);
      if (opts.text) {
        const r = await callBridge("result", { sessionId }, 30000);
        s.result = r.turns;
      }
      console.log(JSON.stringify(s));
      if (s.timeout) process.exit(3);
      return;
    }
    case "result": {
      const sessionId = pos[0];
      if (!sessionId) die("usage: result <sessionId> [--all]");
      const data = await callBridge("result", { sessionId, all: !!opts.all }, 30000);
      for (const t of data.turns) console.log(t);
      if (!data.turns.length) console.log("(no assistant text yet)");
      return;
    }
    case "list": {
      console.log(JSON.stringify(await callBridge("list", { tag: opts.tag }, 60000)));
      return;
    }
    case "stop": {
      const sessionId = pos[0];
      if (!sessionId) die("usage: stop <sessionId>");
      console.log(JSON.stringify(await callBridge("stop", { sessionId }, 30000)));
      return;
    }
    case "close": {
      const sessionId = pos[0];
      if (!sessionId) die("usage: close <sessionId>");
      console.log(JSON.stringify(await callBridge("close", { sessionId }, 30000)));
      return;
    }
    case "approve": {
      const [sessionId, requestId] = pos;
      if (!sessionId || !requestId) die("usage: approve <sessionId> <requestId> [--deny]");
      console.log(JSON.stringify(await callBridge("approve", { sessionId, requestId, deny: !!opts.deny }, 30000)));
      return;
    }
    case "daemon-stop": {
      console.log(JSON.stringify(await callBridge("daemonStop", {}, 15000)));
      return;
    }
    default:
      die("unknown subcommand: " + sub, 2);
  }
}

main().catch((e) => die(e.stack || e.message));
