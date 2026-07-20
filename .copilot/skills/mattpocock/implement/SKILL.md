---
name: implement
description: "Implement a piece of work based on a Goal Contract, spec, or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user's Goal Contract, spec, or tickets.

When the input is a ticket, read its **Goal Contract Flow** field first:

- `yes` — require the stable parent path or canonical URL, `Source Revision`, related AC IDs, and necessary authority or constraint references. Load and verify the parent Goal Contract before editing. Obey its Scope, related AC, authority, constraints, validation, and complete/blocked conditions; the ticket may narrow but never override it. Missing fields, an unloadable Contract, or a revision mismatch is a blocker.
- `no` — treat it as the legacy approved-spec, plan, conversation, or standalone-ticket flow. Do not invent a parent Contract; implement against the declared legacy source.
- Field absent on a historical ticket — remain legacy-compatible unless other fields indicate Contract flow, such as a Parent Goal Contract, Contract `Source Revision`, related Contract AC IDs, or Contract authority references. If any such indicator exists, treat the ticket as `yes` and require the complete Contract reference set before editing.

When the input is a Goal Contract:

- Treat its Outcome, Scope, constraints, AC, validation matrix, authority boundaries, and complete/blocked conditions as the execution contract. Do not widen them silently.
- Before editing, verify that the source revision, approval, applicability, environment, fixtures, cleanup, and rollback still match the current workspace. Stop under the contract's blocked conditions if they do not.
- Ask before any action marked `Ask First`; never perform an action marked forbidden or out of scope.
- Implement only the contracted scope and validate every AC at its declared seam. Preserve the requested evidence artifact, then perform the declared cleanup or rollback when applicable.
- Mark complete only after every AC has fresh evidence from the current implementation and every completion condition is satisfied. Mark blocked only under the contract's blocked conditions after exhausting its safe alternatives, and return the required escalation package.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end. Evidence from before the final implementation change is stale; rerun every completion-critical validation before finishing.

Once done, use /code-review to review the work.

Commit your work to the current branch.
