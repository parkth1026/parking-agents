---
title: "LLM OS"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [agents, emerging, multimodal]
sources: ["Intro to Large Language Models"]
---

# LLM OS

[[Andrej Karpathy]]'s forward-looking framing of where the ecosystem is
converging: the central kernel/CPU of a new kind of computer is a
[[Large Language Model]], and the rest of a classic operating system maps
onto pieces of the assistant stack.

## How It Works

| OS concept | LLM-stack counterpart |
|---|---|
| CPU / kernel | the [[Large Language Model]] itself |
| RAM | the context window |
| Disk / filesystem | retrieved documents, long-term memory |
| Peripherals | vision, audio, and other modalities |
| Programs / skills | [[Tool Use]]: browser, calculator, plugins, frameworks |
| Boot configuration | the [[System Prompt]] |

- The model is general-purpose; capabilities are added around it as
  "programs" rather than retrained into the weights — consistent with how
  [[Emergent Abilities]] are discovered rather than specified.
- Its security model is unsolved: [[Prompt Injection]] is the buffer
  overflow of this new OS.

## Variants

- Assistant-shaped stacks (model + plugins + framework) vs agent-shaped
  stacks (autonomous tool loops).
- Multimodal "peripherals" plugged into the same token stream.

## History

Articulated in [[Intro to Large Language Models]] (late 2023) as a
description of where ChatGPT-style products, plugin ecosystems, and agent
frameworks were visibly heading — a prediction of the platform layer, not a
shipped system.

## Related

- [[Tool Use]] — the "programs" of the OS
- [[System Prompt]] — the "boot configuration"
- [[Prompt Injection]] — its unsolved security flaw
