# Goal Contract: <short observable outcome>

- Status: Ready | Blocked
- Target: <repository, module, or path>
- Updated: YYYY-MM-DD

## Goal

<Describe one user-observable end state. Do not prescribe an implementation plan.>

## Why

- <Current problem or limitation>
- <Value created when the Goal is achieved>

## Scope

- In: <behavior and boundary included in this Goal>
- Out: <explicit stopping boundary>

## Success Criteria

- AC-01: <one observable, decidable result>
- AC-02: <one observable, decidable result>

## Constraints

- <Compatibility, policy, performance, safety, or behavior that must be preserved>

## Agent Mandate

- May decide: Inspect the repository, choose reversible implementation details, edit code, add or update tests, review the final diff, and simplify without changing behavior.
- Must ask: Only when the Goal, Scope, Success Criteria, or Constraints must change, or when a destructive, credentialed, production, or otherwise unauthorized action is required.
- Must not: Stop at analysis or a plan, ask for discoverable repository facts, expand scope silently, or claim completion without fresh evidence for every AC.

## Completion

- Evidence: All Success Criteria are satisfied with fresh, reproducible evidence.
- Quality: Relevant tests and repository checks pass; unrelated pre-existing failures are separated; the final diff is reviewed and simplified where safe.
- Final report: Map each AC to evidence and state changed files and remaining risks.

## Blockers

- None.
