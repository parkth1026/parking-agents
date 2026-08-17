---
name: analyze
description: Run read-only deep repository analysis and return a ranked synthesis with explicit confidence, concrete file references, and clear evidence-vs-inference boundaries. Use when the user says 'analyze', 'investigate', 'why does', 'what's causing', 帮我分析/梳理/排查, 怎么坏了/查查失败原因, asks how a feature is wired across files, wants an impact (影响面) analysis before a change, or needs conflicting repository evidence judged and ranked before any changes are proposed. Not for simple one-file fact lookups or requests that want code edits instead of an explanation.
---

# Analyze — Read-Only Deep Analysis

Answer the user's question through **read-only repository analysis**: explain what the codebase most likely says about it, with explicit confidence and concrete file references — not implementation plans, debugging theater, or generic fix advice.

## Contract

The value of this skill is trust: conclusions the user can act on, from a repo that was not touched, with certainty never overstated.

- **Read-only.** Do not edit files. If a next step helps, offer at most a discriminating read-only probe that would reduce uncertainty.
- **Analysis is the deliverable.** A fix direction is worth at most one sentence. Never an implementation plan, step list, or diff — a plan invites execution, and execution is a different task.
- **Stop at the evidence.** Label every material claim Evidence / Inference / Unknown; never present an inference as evidence or a guess as an inference. When the repository does not settle the question, say so explicitly.
- **Know when to hand off.** When the user actually wants edits, a fix, or a plan, say that implementation is a different lane and stop.

## Evidence rules

Prefer stronger evidence over weaker:

1. direct code paths, contracts, tests, generated artifacts, configs, or docs with concrete file references
2. multiple independent files pointing to the same conclusion
3. localized behavioral inference from well-supported code structure
4. weaker contextual clues, explicitly marked tentative

Unsupported speculation is not evidence. When several explanations compete, rank them by support instead of flattening them into a list. Before citing a file, confirm it is the authoritative copy — repositories can carry same-named stale duplicates, and citing the wrong one silently invalidates the answer.

## Question-aligned synthesis

Answer the user's actual question first, not a generic debugger template.

- Start from the asked question and keep the synthesis scoped to what the user needs to know.
- Scale depth to the request: simple or obvious questions get answered directly after enough reading; broader questions expand the search surface but keep the final answer tightly synthesized.

## Parallel exploration

Parallelism is allowed when it improves quality and stays runtime-safe.

- Do not open parallel lanes for simple questions — read and answer directly.
- For broader questions, prefer the host's native subagents, or equivalent in-session parallel exploration when available. Keep lanes bounded: each lane answers one concrete sub-question or inspects one subsystem.
- A good default split: one lane for the primary code path and contracts, one for config / orchestration / generated surfaces, one for tests / docs / secondary corroboration.

## Execution

- State the question, evidence, inference boundaries, and stop condition before adding process detail.
- If the user says `continue`, resume from the current analysis state instead of restarting discovery.

## Working method

1. Restate the question in one sentence.
2. Identify the smallest set of files most likely to answer it.
3. Read for direct evidence first.
4. If needed, open bounded parallel exploration lanes.
5. Compare competing explanations.
6. Rank the explanations by support.
7. Return a synthesis that clearly separates evidence from inference.

## Output contract

Scale the format to the question.

**Simple, single-answer questions** — one settled fact or one obviously sufficient explanation: answer directly with the key file references. Keep the evidence-vs-inference distinction in the wording. A full template would bury the answer.

**Competing explanations or broader questions** — use the full structure:

### Question
[Restate the user's question briefly]

### Ranked synthesis
| Rank | Explanation | Confidence | Basis |
|------|-------------|------------|-------|
| 1 | ... | High / Medium / Low | strongest supporting evidence |
| 2 | ... | High / Medium / Low | why it trails |
| 3 | ... | High / Medium / Low | why it remains possible |

### Evidence
- `path/to/file:line-line` — what this artifact directly shows
- `path/to/file:line-line` — corroborating evidence

### Inference
- What the evidence most strongly implies
- Why weaker alternatives were down-ranked

### Unknowns / limits
- What the repository evidence does not establish
- What read-only check would reduce uncertainty next

## Quality bar

- question-aligned: answers what was asked, at the depth it needs
- ranked rather than flat, confidence explicit, file references concrete
- evidence vs inference never blurred; uncertainty said out loud
- no unsupported speculation, no normative filler, no fix planning
