---
title: LLM OS
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: future
tags: [llm-os, future, operating-system, software-2-0, multimodal]
created: 2026-08-14
status: seed
---

# LLM OS

Karpathy's metaphor for where the field is heading: the LLM as the
**kernel / CPU of an emerging kind of operating system**.

## The analogy

| Operating system | LLM ecosystem |
|---|---|
| CPU / kernel | The LLM itself |
| RAM (limited working memory) | The [context window](../fundamentals/Tokens-and-Context-Window.md) |
| Eyes and hands: devices, I/O | [Tools](../usage/Tool-Use.md): browser, Python / terminal, calculator, image generation |
| Peripherals (keyboard, mouse, screen, speakers) | Multimodal I/O: images and audio in; images and audio out |
| Programs | **Software 2.0** — "programs" written as natural-language prompts |
| System administration, security | Guardrails, policies, [adversarial-prompt defenses](../security/Adversarial-Prompts.md) |

## What the metaphor predicts

- **Natural language becomes a programming interface**: anyone who can
  describe a task can "write software" for the LLM — the programs are
  prompts and [system prompts](../usage/System-Prompts.md).
- **Personalized assistants for everyone**, orchestrating tools on the
  user's behalf.
- The platform will grow an ecosystem the way operating systems did — apps,
  interfaces, administration, and persistent security problems.
- LLMs are also strange artifacts to study: "simulated humans" with their
  own psychology — Karpathy suggests studying them will resemble a new
  humanities discipline.

## Status

This is a vision, not a shipped system — flagged in the talk as a way to
organize thinking about the future rather than a prediction with dates.

## Related

- [Tool Use](../usage/Tool-Use.md)
- [Tokens and Context Window](../fundamentals/Tokens-and-Context-Window.md)
- [System Prompts](../usage/System-Prompts.md)
- [Adversarial Prompts](../security/Adversarial-Prompts.md)
