---
title: "LLM OS"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [agents, multimodal, emerging]
sources: ["Intro to Large Language Models"]
---

# LLM OS

Karpathy's framing of where the field is heading: LLMs become the kernel of a new kind of computer, and everything else becomes a peripheral.

## The Analogy

- CPU — the [[Large Language Model]] itself: tokens in, tokens out
- RAM — the context window: limited working memory, paged in via retrieval
- Peripherals — tools: browser, calculator, Python interpreter (see [[Tool Use]])
- Eyes and ears — multimodal encoders for images and audio
- The OS runs many agent processes that talk to each other in natural language

## Implications

- The interface to everything becomes natural language
- Security is inherited, not solved: an OS this open is exposed to [[Prompt Injection]], and its kernel is the target of [[Jailbreaking]]
- Ecosystem prediction: a few very large closed models, a healthy open-source ecosystem, and many verticalized fine-tuned models on top

## Related

- [[Large Language Model]]
- [[Tool Use]]
- [[System Prompt]]
- [[Andrej Karpathy]]
