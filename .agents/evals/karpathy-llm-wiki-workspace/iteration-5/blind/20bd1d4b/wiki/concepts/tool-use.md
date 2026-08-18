---
title: Tool Use
aliases: [plugins, tool calling]
tags: [capabilities, deployment]
source: Karpathy — "Intro to Large Language Models" (Nov 2023)
created: 2026-08-18
status: draft
---

# Tool Use

> **TL;DR:** Give the LLM peripherals — a browser, calculator, code
> interpreter — and let it call them mid-conversation. Tools patch the
> model's known weaknesses (arithmetic, freshness of knowledge) and are a
> core pillar of the [LLM OS](llm-os.md).

## Why tools

A pure LLM:

- does unreliable arithmetic (see [Tokens](tokens.md));
- is frozen at its training cutoff (see
  [Hallucinations](hallucinations.md));
- cannot act on the world.

Tools address each: **calculator**, **browsing / retrieval**, and
**code execution** — the most general one, since the model writes and
runs a program and then reads the output.

## How it works mechanically

1. The developer advertises tools (name, description, arguments) in the
   context — conceptually an extension of the
   [System Prompt](system-prompts.md).
2. The model emits a structured *call* instead of (or inside) its
   reply.
3. The harness executes the call and appends the result to the context.
4. The model continues with the observations.

From the model's perspective it is still only doing next-token
prediction — over a context that now contains tool results.

## Karpathy's framing

Tools are to an LLM what peripherals are to a computer: in the
[LLM OS](llm-os.md) picture, plugins are the I/O devices hanging off the
CPU. Note the security surface this opens: everything the model reads
becomes potential attacker-controlled input
([Prompt Injection](prompt-injection.md)).

## See also

- [System Prompts](system-prompts.md)
- [LLM OS](llm-os.md)
- [Prompt Injection](prompt-injection.md) — the cost of letting models read the world
- [Hallucinations](hallucinations.md)
