---
title: Tool Use & System Prompts
tags: [tools, system-prompt, agents, capabilities]
status: seed
source: "Karpathy, 'Intro to Large Language Models' (2023)"
created: 2026-08-18
---

# Tool Use & System Prompts

> The LLM itself is frozen at fixed capability — tools give it eyes, hands,
> and a calculator; the system prompt tells it who to be.

## Why tools at all

The network's weights are fixed after training, so it stays bad at exactly
the things internet text was bad at:

- **Arithmetic and precise computation** → calculator or Python
  interpreter.
- **Current events** (training data has a cutoff) → browser / search.
- **Private data** (emails, files) → file system and API access.

## How tool use works

- Tools are exposed to the model as callable interfaces: "search the web",
  "run code", "read file".
- The model decides during generation when to emit a tool call; the
  surrounding harness executes it, pastes the result back into the context
  window, and generation continues.
- This turns the LLM into the *orchestrator* of the software around it —
  the first sketch of the [LLM OS](llm-os.md) picture, where tools are
  peripherals.

## System prompts

- A **system prompt** is a persistent block of instructions prepended to
  the context, before any user message: persona, rules, allowed tools,
  output format.
- It is steering *inside* the context window — the cheapest way to program
  behavior without touching weights.
- It also matters for safety: the instructions in the system prompt are
  precisely what attackers try to override — see
  [Security Risks](security-risks.md).

## Caveats

- Tool outputs flow back into the context window. Untrusted web content
  arriving there is the setup for indirect prompt injection — again, see
  [Security Risks](security-risks.md).

## See also

- [The LLM OS](llm-os.md) — tools as peripherals of an emerging OS
- [Emergent Capabilities at Scale](emergent-capabilities.md) — prompting as
  programming
- [Security Risks](security-risks.md) — the new attack surface tools open

## References

- Andrej Karpathy,
  [*Intro to Large Language Models*](https://www.youtube.com/watch?v=zjkBMFhNj_g)
  (2023) — tool use and the LLM OS diagram.
