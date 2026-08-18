---
title: Tool Use
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: usage
tags: [tools, plugins, browsing, calculator, code-interpreter]
created: 2026-08-14
status: seed
---

# Tool Use

## The idea

LLMs have inherent limitations — a knowledge cutoff, fuzzy memory (see
[Tokens and Context Window](../fundamentals/Tokens-and-Context-Window.md)),
weak exact arithmetic, and [hallucinations](../capabilities/Hallucinations.md).
Tools patch these gaps by letting the model call out to external systems
instead of generating from memory.

## Tools from the talk

- **Browsing / search** — fetch fresh information beyond the training data
  cutoff.
- **Calculator** — exact arithmetic instead of approximate generation.
- **Code interpreter / Python** — run real programs for precise computation
  and data handling.
- **Image generation** and other plugins, connected through similar
  mechanisms.

## Why it matters

- Each tool extends the model's reach without retraining — capability via
  composition rather than [scaling](../capabilities/Scaling.md).
- It changes the failure profile: facts and math can come from authoritative
  sources rather than plausible generation.
- Tools are also an attack surface: content the model reads while browsing
  can carry injected instructions — see
  [Adversarial Prompts](../security/Adversarial-Prompts.md).
- In the [LLM OS](../future/LLM-OS.md) vision, tools are the model's "eyes
  and hands."

## Related

- [Tokens and Context Window](../fundamentals/Tokens-and-Context-Window.md)
- [Hallucinations](../capabilities/Hallucinations.md)
- [LLM OS](../future/LLM-OS.md)
- [Adversarial Prompts](../security/Adversarial-Prompts.md)
