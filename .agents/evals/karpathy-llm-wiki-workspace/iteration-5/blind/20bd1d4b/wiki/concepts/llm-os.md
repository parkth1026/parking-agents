---
title: LLM OS
aliases: [LLM operating system, LLM-centric OS, kernel analogy]
tags: [future, architecture]
source: Karpathy — "Intro to Large Language Models" (Nov 2023)
created: 2026-08-18
status: draft
---

# LLM OS

> **TL;DR:** Karpathy's closing analogy: the LLM is emerging as the
> kernel/CPU of a new kind of operating system. Context window = RAM,
> tools = peripherals, and everything computer science knows — memory
> management, scheduling, *security* — gets reimagined around tokens.

## The analogy table

| OS concept | LLM-OS counterpart |
|---|---|
| CPU / kernel | the LLM (a [next-token predictor](what-is-an-llm.md)) |
| RAM (working memory) | the context window (see [Tokens](tokens.md)) |
| Disk / cold storage | the weights (compressed knowledge) |
| Peripherals | [Tools](tool-use.md): browser, calculator, code interpreter |
| Eyes and ears | multimodal inputs (images, audio) |
| Processes / userspace | agents and applications built on the model |

## What follows from the analogy

- **Context management = memory management.** Limited working memory
  forces summarization, retrieval, and paging strategies — a new systems
  problem.
- **Agents = the model in a loop.** Give the kernel peripherals and a
  goal; it plans, calls tools, observes, repeats.
- **Security inherits OS stakes.** No privilege separation between code
  and data means [Prompt Injection](prompt-injection.md) is the
  buffer-overflow-class problem of this paradigm (see also
  [Jailbreaks](jailbreaks.md)).
- **Platform shift.** Applications stop being hand-written logic and
  become orchestration around the model — prompting,
  [system prompts](system-prompts.md), tool wiring, and evaluation.

## Reading note

The analogy is a *prediction scaffold*, not shipping software: it tells
you where the hard systems problems — and the interesting engineering —
will show up as models get cheaper and more capable.

## See also

- [What is an LLM](what-is-an-llm.md) — the "hardware" of the analogy
- [Tool Use](tool-use.md) — the peripherals
- [Prompt Injection](prompt-injection.md) — the security problem
- [Tokens](tokens.md) — the context window as RAM
