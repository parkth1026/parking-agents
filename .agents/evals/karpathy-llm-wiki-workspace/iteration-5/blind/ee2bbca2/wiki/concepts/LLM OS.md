---
title: "LLM OS"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [emerging, agents, architecture]
sources: ["Intro to Large Language Models"]
---

# LLM OS

Karpathy's forward-looking metaphor from [[Intro to Large Language Models]]:
the [[Large Language Model]] is becoming the CPU/kernel of a new kind of
computer, with the rest of the classic operating-system architecture growing
around it.

## How It Works

The mapping, element by element:

- **CPU/kernel** — the LLM itself: a general-purpose text-processing core that
  everything else serves. Frontier models fill the role mainframe CPUs once
  did (see [[Emergent Abilities]] for why the core keeps getting more capable).
- **RAM / working memory** — the context window. It is finite, volatile, and
  the only thing the model can "see" right now; long-term storage must be
  engineered around it (retrieval, files).
- **Peripherals / I/O** — modalities (images, audio, video) entering as tokens,
  plus [[Tool Use]]: browser, calculator, Python interpreter as attached
  devices.
- **Processes** — agents: the kernel scheduling and coordinating multiple
  running tasks rather than answering one prompt at a time.
- The platform is explicitly pre-paradigmatic — the equivalent stage is early
  Unix or the 1960s mainframe era, with interface conventions still unsettled.

## Variants

- Single-assistant products (one kernel, one conversation).
- Agent frameworks where a model spawns and supervises sub-agents, sharing a
  tool and memory substrate.

## History

Proposed by [[Andrej Karpathy]] in late 2023 (the talk, plus companion posts)
as a synthesis of existing trends: growing context windows, tool APIs, and
multimodal input. Its security mirror is [[Prompt Injection]] — an OS whose
kernel cannot separate instructions from data inherits that weakness at every
layer.

## Related

- [[Large Language Model]] — the kernel of the metaphor
- [[Tool Use]] — the peripherals
- [[Andrej Karpathy]] — who proposed the framing
