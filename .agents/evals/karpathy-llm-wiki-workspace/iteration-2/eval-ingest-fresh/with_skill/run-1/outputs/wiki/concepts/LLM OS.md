---
title: "LLM OS"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [agents, emerging]
sources: ["Karpathy Intro to LLMs Talk"]
---

# LLM OS

Karpathy's framing of where the field is converging: the LLM as the **kernel**
of an emerging operating system, orchestrating everything around it.

## The Mapping

| OS concept | LLM counterpart |
|------------|-----------------|
| CPU / kernel process | the [[Large Language Model]] |
| RAM | the context window (limited working memory) |
| Peripherals | tools: browser, calculator, Python, image generation, retrieval ([[Tool Use]]) |
| File system | retrieved and uploaded documents |
| New senses | multimodal inputs: images, audio |
| Apps | domain-specific [[Fine-Tuning]] variants of the same kernel |

## Why It Matters

- It explains the industry pattern: everyone is bolting the same set of tools
  around ever-larger context windows.
- It predicts an OS-like security profile — a huge attack surface, with
  [[Jailbreaking]] at the keyboard and [[Prompt Injection]] through every
  tool and document the kernel touches.
- It sets the engineering agenda: context-window pressure is memory
  management for the kernel, tool reliability is driver development,
  multimodality is adding senses.

## Status

A 2023 vision, not a shipping system — best treated as a mental model for
where LLM-centric computing is heading, proposed by [[Andrej Karpathy]].

## Related

- [[Tool Use]]
- [[System Prompt]]
- [[Andrej Karpathy]]
