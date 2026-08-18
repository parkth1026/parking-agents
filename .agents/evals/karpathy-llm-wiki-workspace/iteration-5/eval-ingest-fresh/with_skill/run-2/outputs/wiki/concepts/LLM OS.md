---
title: "LLM OS"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [agents, emerging, language-model]
sources: ["Intro to Large Language Models (talk)"]
---

# LLM OS

[[Andrej Karpathy]]'s metaphor for where the ecosystem is heading: the
[[Large Language Model]] as the kernel/CPU of a new kind of computer, with
the rest of the stack growing around it the way operating systems grew
around early CPUs.

## How It Works

The analogy maps model-stack concepts onto classical OS concepts:

| Computer | LLM OS |
|---|---|
| CPU / kernel | the LLM itself |
| RAM | the context window (working memory) |
| Peripherals | tools: browser, calculator, code execution ([[Tool Use]]) |
| Eyes and ears | multimodal inputs (images, audio) |
| Long-term storage | retrieval over external knowledge (embeddings) |
| Apps | agents and domain assistants |

- Boot sequence of the stack: [[Pretraining]] builds the kernel,
  [[Fine-Tuning]] plus a [[System Prompt]] shape it into an assistant, and
  tools extend its reach.
- The ecosystem mirrors desktop OS history: proprietary, closed-weight
  models play the Windows/macOS role; open-weight models are the Linux
  branch — inspectable, self-hostable, commoditizing.

## Why It Matters

If the metaphor holds, "using a computer" increasingly means mediating
everything through a [[Large Language Model]] — which makes the model's
reliability and security ([[Jailbreaking]], [[Prompt Injection]]) a
civilizational-scale concern, and makes growing the model's
[[Emergent Abilities]] the central engineering project of the decade.

## Related

- [[Large Language Model]]
- [[Tool Use]]
- [[Emergent Abilities]]
- [[System Prompt]]
