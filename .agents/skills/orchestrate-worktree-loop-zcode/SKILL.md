---
name: orchestrate-worktree-loop-zcode
description: "ZCode-native variant of orchestrate-worktree-loop: orchestrate one REAL top-level ZCode session (visible in the ZCode UI session list, driven through the bundled app-server bridge) per Git worktree, through a strict issue-delivery loop (inspect, implement, test, Standards+Spec review, commit, merge into integration branch, verify, claim next issue). Use in the ZCode harness when the user asks to 总管/巡检多个 worktree, 再来一轮, finish-and-merge issues, or wants parallel per-worktree sessions that are NOT subagents. In Codex, use orchestrate-worktree-loop (Codex thread tools) instead."
---

# Worktree Issue Delivery Loop (top-level ZCode sessions)

Run a state-driven delivery loop with one real top-level ZCode session per worktree, driven through the bundled session bridge. The coordinator (this session) is the master: it creates the sessions, monitors their completion state, evaluates verified evidence, and only then dispatches the next task. Treat repository facts and fresh evidence as authoritative; never advance a worktree because a session merely says it is done.

## Interpret the request

- For status-only requests, inspect and report the state table plus the next action. Do not start the bridge, spawn sessions, edit, commit, merge, or change the issue tracker.
- For "总管", "继续一轮", "完整走下去", or equivalent execution requests, start (or reuse) the bridge and advance every worktree until it reaches the next valid state or a real blocker.
- Treat an explicit request to run this full loop as authorization to claim/update issues, edit the named worktrees, create commits, and merge into the named integration branch. Do not infer permission to push, deploy, publish releases, delete branches/worktrees, or close unrelated issues.

## Non-negotiable rules

1. Preserve dirty worktrees. Never reset, checkout away, clean, stash, or overwrite user changes to manufacture a clean state.
2. Use one active issue and one top-level session per worktree.
3. These sessions are ordinary top-level ZCode sessions: the user can see them in the session list and may open them and chat mid-loop. Never assume exclusive control of a session between your operations — re-check `status` and re-verify evidence before acting. Only the coordinator drives the delivery loop itself.
4. Do not mark a state complete without evidence you verified yourself from the current tree/commit (git commands, test runs), never from a session's summary alone.
5. A code change invalidates affected test evidence. A code change after review invalidates that review. Re-run the affected gates and review.
6. Merge worktrees into the integration branch serially. Choose merge order from dependencies and conflict risk, not arrival time.
7. Never invent an issue claim, remote sync, test pass, review pass, commit, or merge when credentials or tools are unavailable.

## Phase 0: Load repository policy and inventory

1. Read the applicable `AGENTS.md` files completely.
2. Read the repository's issue-tracker, testing, release, domain, and contribution instructions that directly govern the task.
3. Resolve canonical worktree paths. Use user-provided paths first; otherwise run `git worktree list --porcelain` from the repository root.
4. Run the bundled read-only inventory script (cross-platform, zero-dependency Node):

```bash
node scripts/inspect-worktrees.mjs --paths "D:\repo-dev1,D:\repo-dev2" --integration dev
```

5. Also inspect staged, unstaged, and untracked files, recent commits, and identify the active issue from branch/commit references, tracker state, accepted specs, or explicit task prompts.

## Phase 1: Start the bridge and own top-level sessions

Two equivalent control surfaces exist for driving REAL top-level ZCode sessions (not subagents). Sessions created through either are ordinary top-level interactive sessions — persisted in the shared session store, visible and openable in the ZCode UI, sharing the user's configured model provider. Both share the coordinator registry (`~/.zcode/bridge/sessions.json`).

### Surface A — native MCP tools (preferred when present)

If the session has `mcp__zcode_threads__*` tools (MCP server `zcode_threads`, registered in `~/.zcode/cli/config.json` under `mcp.servers`, loaded at session start), use them directly as tool calls — no terminal involved:

| Need | Native tool call |
| --- | --- |
| Create a per-worktree session (+ optional first prompt) | `mcp__zcode_threads__create_session` {workspace, mode:"yolo", tag, prompt} |
| Wait for the turn, get result text | `mcp__zcode_threads__wait` {sessionId, timeoutSeconds} |
| Point-in-time state | `mcp__zcode_threads__status` {sessionId} → `idle / running / waiting / paused / completed / error` |
| Follow-up / next task on the same session (full context retained) | `mcp__zcode_threads__send` {sessionId, text} |
| Read all assistant turns | `mcp__zcode_threads__result` {sessionId, all} |
| Answer an escalated permission request | `mcp__zcode_threads__approve` {sessionId, requestId, deny?} |
| Abort a stuck turn | `mcp__zcode_threads__stop` {sessionId} |
| Coordinator map snapshot | `mcp__zcode_threads__list` {tag?} |
| Unload a finished session from the server | `mcp__zcode_threads__close` {sessionId} |

If the tools are absent (old session, or MCP server not registered), register once and open a new session, or use Surface B for this run.

### Surface B — terminal bridge (fallback)

Start the daemon once per run, in a background shell (it survives across tool calls):

```bash
node scripts/zcode-session-driver.mjs daemon --permission-policy escalate
```

Wait for `BRIDGE_READY`. The CLI subcommands mirror the tools one-to-one: `create / send / wait / status / result / list / stop / close / approve / daemon-stop` (see `--help`-style header comment in the script). `--permission-policy escalate` routes child-session permission requests to you instead of silently allowing them.

### Common rules (both surfaces)

1. Create one session per worktree with a self-contained prompt (the session's cwd is the worktree, but spell out absolute paths anyway). `--mode yolo` / `mode: "yolo"` matches how delivery worktrees normally run; omit to inherit the workspace default. Record the `sessionId` in the coordinator map immediately.
2. **Maintain the coordinator map** `worktree -> sessionId -> issue -> state`. The registry (`~/.zcode/bridge/sessions.json`) and the ZCode session store persist it; after a daemon/server restart the next operation auto-resumes known sessions. If a sessionId is somehow lost, it is recoverable from the registry file or the UI session list — treat as BLOCKED only if the session itself is gone.
3. Prefer `send` on the existing session for follow-up work on the same issue (e.g. after review findings) — the session keeps its context. "A prompt is already running" (-32010) means the turn is still active: `wait`, do not double-send.
4. Do not run delivery-critical implementation inside the coordinator session; the coordinator inspects evidence, reviews, merges, and steers.

Prompt shape (fill every `<...>`; no references to this conversation):

```text
You own the git worktree <absolute-worktree-path> and issue <id>. Work ONLY inside it; never touch other directories.
First run git -C "<worktree>" status and git -C "<worktree>" log --oneline -5 and report current state.
Read <worktree>/AGENTS.md and the accepted spec: <inline acceptance criteria>.
Implement only this issue: <criteria>. Preserve all existing changes; do not reset or revert other work.
Gate: run <exact gate command> from inside the worktree root. All tests must pass; report pass/fail counts and skips.
Then commit exactly your changes with message `<convention, must include issue id>`.
Do NOT merge, push, or edit the issue tracker. Do not claim completion if any gate failed.
Final report: commit hash (git rev-parse HEAD), changed files, gate evidence.
```

## Phase 2: Advance the delivery state machine

Evaluate each worktree independently and advance only one edge at a time:

| State | Required evidence | Next action when not satisfied |
| --- | --- | --- |
| `ISSUE_IDENTIFIED` | Tracker item and accepted spec/criteria are known; ownership is unique | Clarify/triage the issue; do not implement ambiguous scope |
| `IMPLEMENTED` | Every acceptance item is mapped to code or evidence; no declared phase remains | Continue the same issue via `send`; do not pick a new one |
| `TESTED` | Targeted tests and the repository-defined complete gate pass on the current tree — verified by the coordinator | Fix failures and re-run; report skips/ignored/soft passes explicitly |
| `REVIEWED` | Standards and Spec reviews both pass on the current diff | Fix findings, re-test affected areas, then re-review |
| `COMMITTED` | Reviewed diff is committed with compliant message; commit hash exists; tree is clean except explicitly unrelated user files | Commit only the reviewed scope; verify `git show` and `git status` |
| `MERGED` | Integration branch contains the commit; conflicts were resolved semantically | Merge serially; preserve both intents; re-review conflict resolutions |
| `POST_MERGE_VERIFIED` | Required gate passes on the integration branch at the merged HEAD | Fix on the owning branch or integration branch according to repo policy; do not close issue |
| `NEXT_ISSUE_CLAIMED` | Completed issue updated per tracker policy; one eligible next issue is uniquely assigned; the session has started it | Select the next issue or report why none is eligible |

Evidence verification belongs to the coordinator: run `git -C <worktree> log/show/status`, run the gate yourself (or re-run the session's exact commands), and read the session's `result` output only as a claim to check.

### Decide whether implementation is complete

- Build a checklist from the accepted issue/spec, including explicitly deferred phases.
- Compare the checklist against code, tests, generated artifacts, runtime behavior, compatibility promises, and release evidence.
- "Most phases complete", compilation success, static string checks, or session summaries mean `PARTIAL`, not `IMPLEMENTED`.
- If the current implementation intentionally differs from the spec, require a recorded product decision or spec update before passing.

### Decide whether testing is complete

- Run targeted tests first, then the repository's full gate from the required entrypoint.
- Respect required release/production mode, isolated data directories, real process ownership/cleanup, compatibility checks, and browser/desktop layers.
- Record exact commands, exit codes, counts, evidence paths, skips, ignored tests, retries, and unverified boundaries.
- Distinguish product failure, test-fixture failure, environment failure, timeout, and baseline failure. A baseline failure still blocks a "full gate passed" claim unless the accepted policy explicitly allows it.

### Perform code review

- Use the available code-review skill when present; otherwise run two independent axes (in the coordinator, or delegated to a bounded session that gets the exact diff):
  - **Standards:** repository rules, safety, maintainability, resource policy, compatibility, and relevant code smells.
  - **Spec:** missing/partial requirements, wrong behavior, and scope creep against the accepted issue/spec.
- Pin the reviewed base and record the exact diff.
- Treat any material fix after review as requiring affected tests and review again.
- Report `PASS`, `REQUEST CHANGES`, or `BLOCKED`; never convert review suggestions into a silent pass.

### Commit

- Include only the issue's reviewed changes and preserve unrelated user edits.
- Follow repository message rules, language, and required issue ID.
- Verify the commit hash, subject, changed files, and clean/expected status after commit.
- Do not push unless the user explicitly authorized it.

### Merge and verify

1. Resolve the integration branch from user/repository policy; use `dev` only when it exists and is the documented target.
2. Confirm both integration and worker states are safe and identify any uncommitted changes before merging.
3. Choose order by dependency graph and overlapping files. When branches overlap, update and re-test the later branch before merging it.
4. Resolve conflicts semantically, preserving both feature intents. Use the merge-conflict skill when available.
5. Verify the worker commit is an ancestor of the integration HEAD (`git merge-base --is-ancestor`).
6. Run the required post-merge gate on the integration branch. A clean Git merge alone is not delivery proof.

## Phase 3: Select and claim the next issue

Only enter this phase after `POST_MERGE_VERIFIED`.

1. Query the repository's authoritative tracker using its documented CLI/API (for file-based trackers, edit the tracked file on the integration branch).
2. Prefer issues marked ready for agents. Exclude needs-info, ready-for-human, wontfix, already-owned, blocked-by-dependency, duplicate, and issues that conflict with another active worktree.
3. Rank candidates by product priority, dependency readiness, risk, available acceptance criteria, and independence from other active worktrees. Do not choose merely by smallest issue number.
4. Claim/assign the chosen issue and update labels/comments according to repository policy. If credentials or tracker tooling are unavailable, report `BLOCKED` and do not fabricate ownership.
5. Bring the now-clean worktree to the latest verified integration state using the repository's safe update policy.
6. Re-dispatch on the SAME session via `send` (it already knows the worktree, rules, and gate) with the new issue's acceptance criteria, and begin Phase 0 again for that worktree.
7. Never assign the same issue to two worktrees. Keep the coordinator map current.

## Reporting contract

Always lead with a current table:

| Worktree | Session (sessionId) | Branch/HEAD | Issue | Implementation | Tests | Review | Commit | Merge | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Use only `PASS`, `PARTIAL`, `FAIL`, `BLOCKED`, and `NOT STARTED`, followed by compact evidence. Include sessionIds, commit hashes, test evidence paths, and blockers. State explicitly whether a new issue was actually claimed.

At the end of an execution round, summarize: what advanced; what could not advance and why; which evidence is current; which sessions are active/idle/waiting; whether any commit, merge, tracker update, or next-issue claim occurred; whether the bridge is still running.

## Stop conditions

Stop advancing a worktree, but continue other independent worktrees, when:

- accepted requirements are ambiguous enough to change product behavior;
- issue-tracker credentials/authority are missing;
- a destructive or external action exceeds the user's authorization;
- the same blocker repeats and no safe in-scope work remains;
- no eligible next issue exists;
- a session is stuck (`running` far beyond plausibility): `stop` it, inspect the worktree state yourself, and only then decide to re-dispatch or report BLOCKED — never reset the worktree.

Never call the overall loop complete merely because one worktree finished. The coordinator is complete only for the requested round when every named worktree is either actively progressing at its correct state or has a clearly evidenced blocker. At end of round, `close` finished sessions (Surface A) or run `daemon-stop` (Surface B) — sessions persist in the ZCode session store and can be resumed later.
