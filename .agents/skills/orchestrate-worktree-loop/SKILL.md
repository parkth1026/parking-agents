---
name: orchestrate-worktree-loop
description: "Orchestrate one visible Codex task per Git worktree through a strict issue-delivery loop: inspect current state, verify specification completion, run complete tests, perform Standards and Spec code review, commit, merge into the integration branch, verify after merge, claim the next eligible issue, and repeat. Use when the user asks to 总管/巡检多个 worktree, 再来一轮, determine what each worktree should do next, finish-and-merge completed issues, or explicitly wants user-visible Codex tasks instead of hidden subagents."
---

# Worktree Issue Delivery Loop

Run a state-driven delivery loop. Treat repository facts and fresh evidence as authoritative; never advance a worktree because an agent merely says it is done.

## Interpret the request

- For status-only requests, inspect and report the state table plus the next action. Do not create tasks, edit, commit, merge, or change the issue tracker.
- For “总管”, “继续一轮”, “完整走下去”, or equivalent execution requests, create or reuse visible Codex tasks and advance every worktree until it reaches the next valid state or a real blocker.
- Treat an explicit request to run this full loop as authorization to claim/update issues, edit the named worktrees, create commits, and merge into the named integration branch. Do not infer permission to push, deploy, publish releases, delete branches/worktrees, or close unrelated issues.

## Non-negotiable rules

1. Preserve dirty worktrees. Never reset, checkout away, clean, stash, or overwrite user changes to manufacture a clean state.
2. Use one active issue and one user-visible Codex task per worktree.
3. Internal subagents may help with bounded implementation or review, but never substitute for a visible task when the user asked to see tasks in the Codex UI.
4. Do not mark a state complete without evidence from the current tree/commit.
5. A code change invalidates affected test evidence. A code change after review invalidates that review. Re-run the affected gates and review.
6. Merge worktrees into the integration branch serially. Choose merge order from dependencies and conflict risk, not arrival time.
7. Never invent an issue claim, remote sync, test pass, review pass, commit, or merge when credentials or tools are unavailable.

## Phase 0: Load repository policy and inventory

For every repository and worktree:

1. Read the applicable `AGENTS.md` files completely.
2. Read the repository’s issue-tracker, testing, release, domain, and contribution instructions that directly govern the task.
3. Resolve canonical worktree paths. Use user-provided paths first; otherwise run `git worktree list --porcelain` from the repository root.
4. Run the bundled read-only inventory script when on Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/inspect-worktrees.ps1 `
  -Path D:\repo-dev1,D:\repo-dev2 -IntegrationBranch dev -Json
```

5. Also inspect staged, unstaged, and untracked files, the current branch/HEAD, upstream ahead/behind, in-progress Git operations, recent commits, and whether the current HEAD is already contained in the integration branch.
6. Identify the active issue from branch/commit references, issue tracker state, accepted specs, or explicit task prompts. Do not guess from filenames alone.

## Phase 1: Ensure visible Codex task ownership

Use the app’s thread tools, not only collaboration subagents:

1. Call `list_projects` and match each canonical worktree path to a saved project.
2. Call `list_threads`. Reuse an active task whose `cwd` exactly matches the worktree and whose scope matches the active issue; continue it with `send_message_to_thread`.
3. If no matching task exists, call `create_thread`:
   - For an existing permanent/user-named worktree project, target that saved project directly with a local environment and `working-tree` starting state so current uncommitted changes remain visible.
   - Create a Codex-managed worktree only when the user asked for a new disposable worktree/task rather than an existing path.
4. Give each task one issue, its accepted spec/contract, explicit boundaries, required gates, commit convention, and the rule that it must not claim completion before review.
5. After creation, emit the returned `::created-thread{threadId="..."}` directive. A background agent that is absent from `list_threads` is not a substitute.
6. Use `wait_threads` for compact progress snapshots. Avoid repeatedly reading unchanged tasks.

Use this task prompt shape:

```text
Own <worktree-path> and issue <id>. Preserve all existing changes; do not reset or revert other work.
Read AGENTS.md and <accepted-spec>. First report current state and missing acceptance criteria.
Implement only this issue. Run targeted tests, the repository full gate, and Standards+Spec review.
Do not commit or recommend merge until all findings are fixed and evidence is current.
Use the repository commit convention and include <issue-id>.
```

## Phase 2: Advance the delivery state machine

Evaluate each worktree independently and advance only one edge at a time:

| State | Required evidence | Next action when not satisfied |
| --- | --- | --- |
| `ISSUE_IDENTIFIED` | Tracker item and accepted spec/criteria are known; ownership is unique | Clarify/triage the issue; do not implement ambiguous scope |
| `IMPLEMENTED` | Every acceptance item is mapped to code or evidence; no declared phase remains | Continue the same issue; do not pick a new one |
| `TESTED` | Targeted tests and the repository-defined complete gate pass on the current tree | Fix failures and re-run; report skips/ignored/soft passes explicitly |
| `REVIEWED` | Standards and Spec reviews both pass on the current diff | Fix findings, re-test affected areas, then re-review |
| `COMMITTED` | Reviewed diff is committed with compliant message; commit hash exists; tree is clean except explicitly unrelated user files | Commit only the reviewed scope; verify `git show` and `git status` |
| `MERGED` | Integration branch contains the commit; conflicts were resolved semantically | Merge serially; preserve both intents; re-review conflict resolutions |
| `POST_MERGE_VERIFIED` | Required gate passes on the integration branch at the merged HEAD | Fix on the owning branch or integration branch according to repo policy; do not close issue |
| `NEXT_ISSUE_CLAIMED` | Completed issue updated per tracker policy; one eligible next issue is uniquely assigned; a visible task has started | Select the next issue or report why none is eligible |

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

- Use the available code-review skill when present; otherwise run two independent axes:
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
5. Verify the worker commit is an ancestor of the integration HEAD.
6. Run the required post-merge gate on the integration branch. A clean Git merge alone is not delivery proof.

## Phase 3: Select and claim the next issue

Only enter this phase after `POST_MERGE_VERIFIED`.

1. Query the repository’s authoritative tracker using its documented CLI/API.
2. Prefer issues marked ready for agents. Exclude needs-info, ready-for-human, wontfix, already-owned, blocked-by-dependency, duplicate, and issues that conflict with another active worktree.
3. Rank candidates by product priority, dependency readiness, risk, available acceptance criteria, and independence from other active worktrees. Do not choose merely by smallest issue number.
4. Claim/assign the chosen issue and update labels/comments according to repository policy. If credentials or tracker tooling are unavailable, report `BLOCKED` and do not fabricate ownership.
5. Bring the now-clean worktree to the latest verified integration state using the repository’s safe update policy.
6. Create or reuse a visible Codex task for the new issue, send the scoped prompt, and begin Phase 0 again.
7. Never assign the same issue to two worktrees. Maintain a coordinator map of `worktree -> visible task -> issue -> state`.

## Reporting contract

Always lead with a current table:

| Worktree | Visible task | Branch/HEAD | Issue | Implementation | Tests | Review | Commit | Merge | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Use only `PASS`, `PARTIAL`, `FAIL`, `BLOCKED`, and `NOT STARTED`, followed by compact evidence. Include task IDs/links, commit hashes, test evidence paths, and blockers. State explicitly whether a new issue was actually claimed.

At the end of an execution round, summarize:

- what advanced;
- what could not advance and why;
- which evidence is current;
- which visible tasks are active;
- whether any commit, merge, tracker update, or next-issue claim occurred.

## Stop conditions

Stop advancing a worktree, but continue other independent worktrees, when:

- accepted requirements are ambiguous enough to change product behavior;
- issue-tracker credentials/authority are missing;
- a destructive or external action exceeds the user’s authorization;
- the same blocker repeats and no safe in-scope work remains;
- no eligible next issue exists.

Never call the overall loop complete merely because one worktree finished. The coordinator is complete only for the requested round when every named worktree is either actively progressing at its correct state or has a clearly evidenced blocker.
