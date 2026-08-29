# Known limitation: bridge sessions may not appear in the ZCode UI sidebar (issue #79)

`zcode-threads-mcp.mjs` / `zcode-session-driver.mjs` create REAL top-level ZCode sessions
through a headless app-server child process (`ZCode.exe zcode.cjs app-server --stdio`,
`ELECTRON_RUN_AS_NODE=1`). These sessions are ordinary, fully-functional ZCode sessions —
but the desktop app's sidebar does not reliably show them without a manual nudge. This
document is the evidence chain behind that claim, split into what is verified and what is
not, so nobody re-documents a guess as a fact.

## Verified facts

1. **Bridge sessions are fully persisted in the same shared store the desktop UI reads.**
   Read-only inspection of `~/.zcode/cli/db/db.sqlite` (Node's built-in `node:sqlite`,
   `readOnly: true`) shows every session id present in the bridge's own registry
   (`~/.zcode/bridge/sessions.json`) as a complete row in the `session` table
   (`project_id`, `directory`, `title`, `time_created` all populated correctly). The
   original issue's repro chain step 5 ("grep 不到任何会话 id" — grep finds no session
   ids in db.sqlite/WAL) does not hold up: a plain `grep` over a 630MB SQLite file is not
   a reliable way to confirm absence. Do not repeat that check as evidence of a storage
   gap.

2. **The `directory` → grouping key derivation is path-separator-insensitive.** Compared
   sessions for the same real folder (`parking-agents-dev`) stored with both forward
   slashes (bridge-created) and backslashes (genuine historical UI sessions) — both
   produce the identical `project_id` (`proj_g-git-ai_workflow-parking-agents-dev`). This
   rules out "different slash style ⇒ different sidebar group" as a cause.

3. **The session-listing RPC is a live query, not a stale snapshot, and works correctly
   for bridge sessions.** Decompiled `zcode.cjs` (`resources/glm/zcode.cjs`) to the
   handler for the wire method `session/list`:
   `case rr.sessionList: return await hsn(this.context, t.params)`, where `hsn` calls
   `sessionStore.listSessions({directory, includeArchived, limit, roots: true})` — a
   fresh DB query every call. The client-side wrapper found in `app.asar`
   (`listSessions(m){ ... request(Ge.sessionList, {workspace: Zt(m), ...}) ...}`) confirms
   the desktop UI's own client talks to this same protocol method.

   Confirmed by direct experiment: spawned an independent, throwaway headless app-server
   instance (same launch pattern as the bridge, but not the bridge's own process) and
   called the wire method directly:

   ```
   → session/list { workspace: { workspacePath: "G:\\GIT\\AI_WorkFlow\\parking-agents-worker\\parking-agents-worker-3" }, limit: 50 }
   ← { result: { sessions: [{
         sessionId: "sess_5c353b9a-dcdc-45aa-892f-e6444615784f",
         status: "idle", mode: "build",
         title: "整理 iteration-3 预演目录（issue #9）",
         workspace: { workspacePath: "G:\\GIT\\...\\parking-agents-worker-3", workspaceKey: "..." },
         createdAt: 1787763566799, updatedAt: 1787764163881
       }] } }
   ```

   The bridge session came back complete and correct. Anyone — including a process that
   never created the session — gets the right answer from this RPC.

## Strong circumstantial evidence (not independently verified end-to-end)

4. **Desktop real-time session updates appear scoped to the workspace tabs currently open
   in that window**, not to "every workspace with any session in the DB". Trace in
   `app.asar`:

   ```
   renderer: syncWindowTabs(tabs) --ipc "zcode:sync-window-tabs"--> main process
   main:     windowWorkspaceMap.set(windowId, tabs)
             → syncTaskRealtimeWorkspaceKeys(windowId, tabs)
             → x6.updateHostWorkspaceKeys(host, tabs)
   ```

   This is consistent with: an external process (the bridge's headless app-server)
   writing a new session row never triggers this window-scoped real-time channel, because
   that channel is armed by the renderer telling the main process "these are my currently
   open workspace tabs" — an action the bridge has no way to perform and never performs.

   **What this does NOT establish**: whether the user-visible action of *expanding a
   collapsed workspace group in the sidebar* is the same client-side event as *opening/
   switching to that workspace's tab*. If they're the same interaction, expanding the
   group should refresh and reveal the session. If the sidebar's group-expand is a pure
   client-side tree toggle with no backing IPC call, expanding it will do nothing and a
   tab switch (or app restart) is required instead. Distinguishing these needs live
   DevTools/IPC tracing against the running desktop app, which was out of scope for this
   investigation (no live UI access).

## Known limitation, as documented in the skill

Bridge-created sessions are correctly and completely persisted, and are queryable through
the same protocol the desktop UI uses — but are not guaranteed to appear in the sidebar
without a manual nudge in the desktop app. Do not claim "visible and openable in the
ZCode UI" without this caveat anywhere in this skill's docs or tool descriptions.

## Manual verification checklist (unverified mitigation — do this once, ~10 seconds)

1. Open the ZCode desktop UI and switch to (or open) the workspace tab for
   `G:\GIT\AI_WorkFlow\parking-agents-worker\parking-agents-worker-3` — if the sidebar's
   "workspace group" is a different control than a tab, try expanding that group instead,
   and note which of the two actions (if either) is what actually happened.
2. Check whether the sidebar now shows session `sess_5c353b9a-dcdc-45aa-892f-e6444615784f`
   (title: "整理 iteration-3 预演目录（issue #9）").
3. If it still doesn't appear, restart the ZCode desktop app and check again.

Whatever the outcome, update this file with the confirmed answer (which action, if any,
surfaces the session) so the "known limitation" section above can be upgraded to a
verified mitigation instead of staying open-ended.
