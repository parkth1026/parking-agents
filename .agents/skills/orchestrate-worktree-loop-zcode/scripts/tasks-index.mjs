// tasks-index.mjs — mirror zcode_threads bridge sessions into the ZCode UI session index (#79).
//
// The desktop app only indexes sessions created by its own process; sessions created
// through this bridge's headless app-server never get a `tasks` row, so the sidebar
// group for their workspace stays empty. These helpers write rows in the exact native
// shape (schema verified 2026-08-27 against a native session row in
// ~/.zcode/v2/tasks-index.sqlite).
//
// All operations are best-effort: any failure is logged once and returns false —
// UI mirroring must never break orchestration. Zero dependencies; node:sqlite is
// feature-detected (Node >= 22.5). DB path overridable via ZCODE_THREADS_TASKS_INDEX
// for offline tests.
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

export const TASKS_INDEX_FILE =
  process.env.ZCODE_THREADS_TASKS_INDEX || join(homedir(), ".zcode", "v2", "tasks-index.sqlite");

let Sqlite = null;
try { Sqlite = createRequire(import.meta.url)("node:sqlite").DatabaseSync; } catch { Sqlite = null; }

let taskDb = null;
let taskDbBroken = false;

function openTaskDb() {
  if (taskDbBroken) return null;
  if (taskDb) return taskDb;
  try {
    if (!Sqlite) throw new Error("node:sqlite unavailable (needs Node >= 22.5)");
    taskDb = new Sqlite(TASKS_INDEX_FILE);
    taskDb.exec("PRAGMA busy_timeout = 3000");
    return taskDb;
  } catch (e) {
    taskDbBroken = true;
    console.error("[tasks-index] unavailable, UI mirroring disabled: " + (e && e.message ? e.message : e));
    return null;
  }
}

const lastUiStatus = new Map();

export function titleFromPrompt(prompt) {
  const firstLine = String(prompt || "").split(/\r?\n/).find((l) => l.trim()) || "";
  const clean = firstLine.replace(/^[#>\s`*]+/, "").trim();
  return (clean || "bridge session").slice(0, 80);
}

export function uiStatusFor(projectionStatus) {
  switch (projectionStatus) {
    case "running":
    case "waiting":
      return "running";
    case "idle":
    case "completed":
      return "completed";
    case "error":
      return "error";
    default:
      return null;
  }
}

export function registerBridgeTask({ sessionId, workspace, title, status, mode, model, createdAt }) {
  const db = openTaskDb();
  if (!db) return false;
  try {
    const exists = db.prepare("SELECT task_id FROM tasks WHERE task_id = ?").get(sessionId);
    if (exists) return syncBridgeTask(sessionId, status, true);
    const now = Date.now();
    const meta = {
      taskId: sessionId,
      traceId: sessionId,
      title,
      workspacePath: workspace,
      createdAt,
      updatedAt: now,
      mode: mode || "build",
      model: model || "builtin:bigmodel-coding-plan/GLM-5.3",
      thoughtLevel: "max",
      provider: "glm",
      status,
      target: null,
      titleOverridden: false,
    };
    db.prepare(`INSERT INTO tasks
      (workspace_key, workspace_path, workspace_identity, task_id, title, task_status,
       provider, mode, model, migration_source, forked_from_task_id, created_at, updated_at,
       unread_at, pinned, archived, deleted, title_overridden, meta_json, searchable_text,
       cron_automation_id, last_unread_at, off_peak_task_id)
      VALUES (?, ?, NULL, ?, ?, ?, 'glm', ?, ?, NULL, NULL, ?, ?, NULL, 0, 0, 0, 0, ?, ?, NULL, ?, NULL)`)
      .run(workspace, workspace, sessionId, title, status, mode || "build",
        model || "builtin:bigmodel-coding-plan/GLM-5.3", createdAt, now,
        JSON.stringify(meta), title, createdAt);
    lastUiStatus.set(sessionId, status);
    return true;
  } catch (e) {
    console.error("[tasks-index] register failed for " + sessionId + ": " + (e && e.message ? e.message : e));
    return false;
  }
}

export function syncBridgeTask(sessionId, status, force = false) {
  if (!status) return false;
  if (!force && lastUiStatus.get(sessionId) === status) return true;
  const db = openTaskDb();
  if (!db) return false;
  try {
    const row = db.prepare("SELECT meta_json FROM tasks WHERE task_id = ?").get(sessionId);
    if (!row) return false;
    const now = Date.now();
    let meta = null;
    try { meta = JSON.parse(row.meta_json); } catch {}
    if (meta && typeof meta === "object") {
      meta.status = status;
      meta.updatedAt = now;
      db.prepare("UPDATE tasks SET task_status = ?, updated_at = ?, meta_json = ? WHERE task_id = ?")
        .run(status, now, JSON.stringify(meta), sessionId);
    } else {
      db.prepare("UPDATE tasks SET task_status = ?, updated_at = ? WHERE task_id = ?")
        .run(status, now, sessionId);
    }
    lastUiStatus.set(sessionId, status);
    return true;
  } catch (e) {
    console.error("[tasks-index] sync failed for " + sessionId + ": " + (e && e.message ? e.message : e));
    return false;
  }
}
