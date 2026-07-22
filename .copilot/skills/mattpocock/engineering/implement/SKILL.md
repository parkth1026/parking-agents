---
name: implement
description: "Implement confirmed work from the current shared understanding, a spec, or a set of tickets."
disable-model-invocation: true
---

Implement the work described by the user's confirmed shared understanding, spec, or tickets.

A confirmed shared understanding is a valid input when the work is one coherent current-context unit and its seam and success evidence are already settled. Treat that conversation as the source of truth; do not require a spec or reopen the interview. For multi-session or independently sliced work, require the durable spec/ticket path instead.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.
