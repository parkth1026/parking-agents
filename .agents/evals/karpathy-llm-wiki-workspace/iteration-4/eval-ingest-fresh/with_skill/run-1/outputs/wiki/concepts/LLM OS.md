---
title: "LLM OS"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [agents, emerging]
sources: ["Intro to Large Language Models"]
---

# LLM OS

Karpathy's metaphor for where the field is heading: the [[Large Language Model]]
as the **kernel of an emerging operating system** for language-based
computing, with everything else in the computer arranged around it.

## How It Works

The analogy maps LLM-stack components onto OS components:

| OS part | LLM-stack counterpart |
|---|---|
| Kernel / CPU | the LLM itself |
| RAM | the context window |
| File system | documents and data in context |
| Peripherals | browser, calculator, Python ([[Tool Use]]) |
| Multimodal input | vision/audio "drivers" |
| Security model | protection against [[Jailbreaking]] and [[Prompt Injection]] |

- On this view, hallucinations are the platform's *bugs* and
  jailbreaks/injections are its *security vulnerabilities* — the OS is under
  active development, and everyone is simultaneously user, developer, and
  security researcher.
- Scaling the kernel ([[Emergent Abilities]]) upgrades everything built on
  top, which is why the talk ends on the note that this is an exceptionally
  fast-moving, strategically central area.

## Variants

Not covered in the talk, but natural extensions for future pages:
agent frameworks as "processes", retrieval as "paging" to larger memory.

## History

Proposed in the Nov 2023 talk as a synthesis of existing trends (tool-using
assistants, multimodality, growing context windows) rather than a product
announcement — a framing device that has since become common shorthand.

## Related

- [[Large Language Model]] — the kernel of this OS
- [[Tool Use]] — the peripherals
- [[Prompt Injection]] / [[Jailbreaking]] — the security problems of the OS
- [[Intro to Large Language Models]] — the source talk for this page
