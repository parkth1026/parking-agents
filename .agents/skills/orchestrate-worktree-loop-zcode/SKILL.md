---
name: orchestrate-worktree-loop-zcode
description: "ZCode-native variant of orchestrate-worktree-loop: orchestrate one background ZCode agent per Git worktree through a strict issue-delivery loop (inspect, implement, test, Standards+Spec review, commit, merge into integration branch, verify, claim next issue). Use in the ZCode harness when the user asks to 总管/巡检多个 worktree, 再来一轮, finish-and-merge issues, or wants parallel per-worktree background agents. In Codex, use orchestrate-worktree-loop (Codex thread tools) instead."
---

# Worktree Issue Delivery Loop (ZCode background agents)

Run a state-driven delivery loop with one background ZCode agent per worktree. Treat repository facts and fresh evidence as authoritative; never advance a worktree because an agent merely says it is done.

## Interpret the request

- For status-only requests, inspect and report the state table plus the next action. Do not spawn agents, edit, commit, merge, or change the issue tracker.
- For “总管”, “继续一轮”, “完整走下去”, or equivalent execution requests, spawn or reuse background agents and advance every worktree until it reaches the next valid state or a real blocker.
- Treat an explicit request to run this full loop as authorization to claim/update issues, edit the named worktrees, create commits, and merge into the named integration branch. Do not infer permission to push, deploy, publish releases, delete branches/worktrees, or close unrelated issues.

## Non-negotiable rules

1. Preserve dirty worktrees. Never reset, checkout away, clean, stash, or overwrite user changes to manufacture a clean state.
2. Use one active issue and one background ZCode agent per worktree.
3. ZCode background agents are visible to the user in the task list (`/tasks`) but the user cannot chat with them directly; only the coordinator can steer them. Never claim Codex-app-style interactive thread visibility. State this difference once when the user asks for "visible tasks".
4. Do not mark a state complete without evidence you verified yourself from the current tree/commit (git commands, test runs), never from an agent's summary alone.
5. A code change invalidates affected test evidence. A code change after review invalidates that review. Re-run the affected gates and review.
6. Merge worktrees into the integration branch serially. Choose merge order from dependencies and conflict risk, not arrival time.
7. Never invent an issue claim, remote sync, test pass, review pass, commit, or merge when credentials or tools are unavailable.

## Phase 0: Load repository policy and inventory

For every repository and worktree:

1. Read the applicable `AGENTS.md` files completely.
2. Read the repository’s issue-tracker, testing, release, domain, and contribution instructions that directly govern the task.
3. Resolve canonical worktree paths. Use user-provided paths first; otherwise run `git worktree list --porcelain` from the repository root.
4. Run the bundled read-only inventory script (cross-platform, zero-dependency Node):

```bash
node scripts/inspect-worktrees.mjs --paths "D:\repo-dev1,D:\repo-dev2" --integration dev
```

   Output is always a JSON array with per-worktree branch, HEAD, dirty state, upstream ahead/behind, whether HEAD is merged into the integration branch, and in-progress git operations.

5. Also inspect staged, unstaged, and untracked files, recent commits, and identify the active issue from branch/commit references, tracker state, accepted specs, or explicit task prompts. Do not guess from filenames alone.

## Phase 1: Spawn and own background agents

ZCode has no `create_thread`/`list_threads` tool surface. The equivalent mapping, verified to work:

| Need | ZCode mechanism |
| --- | --- |
| Create a per-worktree task | `Agent` tool with `run_in_background: true` (returns an `agentId` immediately) |
| Steer a running task | `SendMessage` to the agentId — delivered into its active turn |
| Wait for a task / get its result | `TaskOutput` with `block: true` (set a generous `timeout`) |
| Continue a finished task (follow-up, re-review) | `SendMessage` to the completed agentId — resumes it in the background with full context |
| Stop a stuck task | `TaskStop` with the agentId |

Rules:

1. Spawn agents in a single message with multiple `Agent` tool calls so they run concurrently.
2. **Every prompt must be fully self-contained.** Background agents start in the ZCode workspace root, NOT in the worktree: all paths in prompts must be absolute; tell the agent to use `git -C <worktree>` or `cd "<worktree>"` explicitly. Include the issue, acceptance criteria, gate commands, commit convention, and boundaries in the prompt itself — the agent sees nothing from this conversation.
3. **Maintain a coordinator map** `worktree -> agentId -> issue -> state` for the whole run. There is no agent-side task enumeration; the map is the only thread registry. If an agentId is lost, report `BLOCKED` for that worktree — do not spawn a duplicate agent for the same worktree.
4. Prefer resuming the existing agent (SendMessage) for follow-up work on the same issue — e.g. after review findings — instead of spawning a fresh one; the resumed agent keeps its context.
5. Do not run delivery-critical implementation inside the coordinator session; the coordinator inspects evidence, reviews, merges, and steers.

Use this task prompt shape (fill every `<...>`; no references to this conversation):

```text
You own the git worktree <absolute-worktree-path> and issue <id>. Work ONLY inside it via absolute paths; never touch other directories or repositories.
First run `git -C "<worktree>" status` and `git -C "<worktree>" log --oneline -5` and report current state.
Read <worktree>/AGENTS.md and the accepted spec: <inline acceptance criteria>.
Implement only this issue: <criteria>. Preserve all existing changes; do not reset or revert other work.
Gate: from inside the worktree run <exact gate command, e.g. node --test test/>. All tests must pass; report pass/fail counts and skips.
Then commit exactly your changes with message `<convention, must include issue id>`.
Do NOT merge, push, or edit the issue tracker. Do not claim completion if any gate failed.
Final report: commit hash (git rev-parse HEAD), changed files, gate evidence.
```

## Phase 2: Advance the delivery state machine

Evaluate each worktree independently and advance only one edge at a time:

| State | Required evidence | Next action when not satisfied |
| --- | --- | --- |
| `ISSUE_IDENTIFIED` | Tracker item and accepted spec/criteria are known; ownership is unique | Clarify/triage the issue; do not implement ambiguous scope |
| `IMPLEMENTED` | Every acceptance item is mapped to code or evidence; no declared phase remains | Continue the same issue via SendMessage; do not pick a new one |
| `TESTED` | Targeted tests and the repository-defined complete gate pass on the current tree — verified by the coordinator | Fix failures and re-run; report skips/ignored/soft passes explicitly |
| `REVIEWED` | Standards and Spec reviews both pass on the current diff | Fix findings, re-test affected areas, then re-review |
| `COMMITTED` | Reviewed diff is committed with compliant message; commit hash exists; tree is clean except explicitly unrelated user files | Commit only the reviewed scope; verify `git show` and `git status` |
| `MERGED` | Integration branch contains the commit; conflicts were resolved semantically | Merge serially; preserve both intents; re-review conflict resolutions |
| `POST_MERGE_VERIFIED` | Required gate passes on the integration branch at the merged HEAD | Fix on the owning branch or integration branch according to repo policy; do not close issue |
| `NEXT_ISSUE_CLAIMED` | Completed issue updated per tracker policy; one eligible next issue is uniquely assigned; a background agent has started it | Select the next issue or report why none is eligible |

Evidence verification belongs to the coordinator: run `git -C <worktree> log/show/status`, run the gate yourself (or re-run the agent's exact commands), and read the agent's final report only as a claim to check.

### Decide whether implementation is complete

- Build a checklist from the accepted issue/spec, including explicitly deferred phases.
- Compare the checklist against code, tests, generated artifacts, runtime behavior, compatibility promises, and release evidence.
- “Most phases complete”, compilation success, static string checks, or agent summaries mean `PARTIAL`, not `IMPLEMENTED`.
- If the current implementation intentionally differs from the spec, require a recorded product decision or spec update before passing.

### Decide whether testing is complete

- Run targeted tests first, then the repository’s full gate from the required entrypoint.
- Respect required release/production mode, isolated data directories, real process ownership/cleanup, compatibility checks, and browser/desktop layers.
- Do not substitute quick gates, unit tests, mocks, or HTTP adapters for required product-surface evidence.
- Record exact commands, exit codes, counts, evidence paths, skips, ignored tests, retries, and unverified boundaries.
- Distinguish product failure, test-fixture failure, environment failure, timeout, and baseline failure. A baseline failure still blocks a “full gate passed” claim unless the accepted policy explicitly allows it.

### Perform code review

- Use the available code-review skill when present; otherwise run two independent axes (in the coordinator, or delegated to a bounded agent that gets the exact diff):
  - **Standards:** repository rules, safety, maintainability, resource policy, compatibility, and relevant code smells.
  - **Spec:** missing/partial requirements, wrong behavior, and scope creep against the accepted issue/spec.
- Pin the reviewed base and record the exact diff.
- Treat any material fix after review as requiring affected tests and review again.
- Report `PASS`, `REQUEST CHANGES`, or `BLOCKED`; never convert review suggestions into a silent pass.

### Commit

- Include only the issue’s reviewed changes and preserve unrelated user edits.
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

1. Query the repository’s authoritative tracker using its documented CLI/API (for file-based trackers, edit the tracked file on the integration branch).
2. Prefer issues marked ready for agents. Exclude needs-info, ready-for-human, wontfix, already-owned, blocked-by-dependency, duplicate, and issues that conflict with another active worktree.
3. Rank candidates by product priority, dependency readiness, risk, available acceptance criteria, and independence from other active worktrees. Do not choose merely by smallest issue number.
4. Claim/assign the chosen issue and update labels/comments according to repository policy. If credentials or tracker tooling are unavailable, report `BLOCKED` and do not fabricate ownership.
5. Bring the now-clean worktree to the latest verified integration state using the repository’s safe update policy.
6. Spawn (or resume) a background agent for the new issue with a fresh self-contained prompt, and begin Phase 0 again.
7. Never assign the same issue to two worktrees. Keep the coordinator map current.

## Reporting contract

Always lead with a current table:

| Worktree | Agent (agentId) | Branch/HEAD | Issue | Implementation | Tests | Review | Commit | Merge | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Use only `PASS`, `PARTIAL`, `FAIL`, `BLOCKED`, and `NOT STARTED`, followed by compact evidence. Include agentIds, commit hashes, test evidence paths, and blockers. State explicitly whether a new issue was actually claimed.

At the end of an execution round, summarize:

- what advanced;
- what could not advance and why;
- which evidence is current;
- which background agents are active/resumed/finished;
- whether any commit, merge, tracker update, or next-issue claim occurred.

## Stop conditions

Stop advancing a worktree, but continue other independent worktrees, when:

- accepted requirements are ambiguous enough to change product behavior;
- issue-tracker credentials/authority are missing;
- a destructive or external action exceeds the user’s authorization;
- the same blocker repeats and no safe in-scope work remains;
- no eligible next issue exists;
- the per-worktree agent dies or its agentId is lost and its tree state cannot be safely attributed (then treat as a user worktree: inspect and report, never reset).

Never call the overall loop complete merely because one worktree finished. The coordinator is complete only for the requested round when every named worktree is either actively progressing at its correct state or has a clearly evidenced blocker.
