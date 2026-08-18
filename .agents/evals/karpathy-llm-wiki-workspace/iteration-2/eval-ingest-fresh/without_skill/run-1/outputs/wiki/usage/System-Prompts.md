---
title: System Prompts
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: usage
tags: [system-prompt, custom-instructions, configuration]
created: 2026-08-14
status: seed
---

# System Prompts

## What they are

A block of instructions prepended to **every conversation** with an
assistant, defining its persona, rules, tone, and defaults. End users of a
chat product usually never see it — Karpathy highlights this invisibility as
something worth knowing.

## What they do

- Configure behavior without changing the model: the same
  [fine-tuned assistant](../training/Fine-Tuning.md) can serve different
  roles depending on its system prompt.
- Act as lightweight programming: rules written in natural language that
  steer outputs ("always answer in the user's language", "refuse X",
  "use these formats").
- Complement [fine-tuning](../training/Fine-Tuning.md): guidelines that
  change often live in prompts; stable behavior can be baked in by
  fine-tuning.

## Limits and risks

- A system prompt is instructions, not a security boundary — see
  [Adversarial Prompts](../security/Adversarial-Prompts.md): injected
  content can attempt to override it, and the model cannot reliably tell
  trusted instructions from untrusted ones.
- Effectiveness varies; prompts are an unreliable control surface compared
  to code.

## Related

- [Fine-Tuning](../training/Fine-Tuning.md)
- [Tool Use](Tool-Use.md)
- [Adversarial Prompts](../security/Adversarial-Prompts.md)
