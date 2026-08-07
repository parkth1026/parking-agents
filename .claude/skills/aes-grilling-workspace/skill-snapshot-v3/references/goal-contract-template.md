# Goal Contract: <short observable outcome>

- Status: Ready | Blocked
- Target: <repository, module, or path>
- Updated: YYYY-MM-DD

## Goal

<Describe one user-observable end state. Do not prescribe an implementation plan.>

## Why

- <Current problem or limitation>
- <Value created when the Goal is achieved>

## Read First

<!-- Optional section: omit entirely when there is nothing worth pointing at.
     Point, do not summarize: sources the interview actually relied on.
     UI-facing goals: include the user-approved mock HTML path here. -->
- <file path, issue link, or design doc the executing agent should read before starting>

## Scope

- In: <behavior and boundary included in this Goal>
- Out: <explicit stopping boundary>

## Deliverables

<!-- Optional section: omit entirely when Success Criteria already name every artifact.
     Required when any Verify uses tier [B]: fixtures must live on disk to be checkable. -->
- D-01: <file path>: <content requirement>

## Success Criteria

<!-- Every AC has exactly one indented Verify line. Tiers:
     [A] automated command → exit code or threshold
     [B] golden case: on-disk input fixture → matches on-disk expected output
     [C] reproducible manual steps → observable result
     [D] named file content check
     Verify comes from repository best practice by default, or from a user-supplied
     real test when judgment (which data, which threshold, which scenario) is involved.
     UI-facing goals: include one mock-comparison AC — delivered UI matches the approved
     mock in structure and key interactions; Verify [C] names the mock path (upgrade to
     [A] when visual-regression tooling exists). The approved mock is read-only. -->
- AC-01: <one observable, decidable result>
  - Verify: [A] `<command>` → <expected exit code or threshold>
- AC-02: <one observable, decidable result>
  - Verify: [B] <input fixture path> → matches <expected output fixture path>

## Constraints

- <Compatibility, policy, performance, safety, or behavior that must be preserved>

## Agent Mandate

- May decide: <concrete named actions, e.g.: create branches, edit code under <path>, add or update tests, install devDependencies already declared. Abstract grants like "reversible details" are undecidable at the permission boundary.>
- Must ask: <when the Goal, Scope, Success Criteria, or Constraints must change, or when a destructive, credentialed, production, or otherwise unauthorized action is required>
- Must not: <concrete named actions, e.g.: push, delete files, change CI config, modify the approved mock HTML (UI-facing goals). Plus: stop at analysis, ask for discoverable repository facts, expand scope silently, or claim completion without fresh evidence for every AC.>

## Iteration Strategy

<!-- Optional section. One sentence of attack order, not steps: strategy never goes
     stale, step lists do. e.g. "Module by module; keep tests green before moving on." -->
<one sentence>

## Completion

- Evidence: All Success Criteria are satisfied; every Verify line passes with fresh, reproducible evidence from the current worktree.
- Quality: Relevant tests and repository checks pass; unrelated pre-existing failures are separated; the final diff is reviewed and simplified where safe.
- Final report: <report file path, e.g. docs/goal-contracts/<slug>-report.md>: map each AC to its Verify evidence, list changed files and remaining risks. A chat summary is not a deliverable.

## Blockers

- None.
