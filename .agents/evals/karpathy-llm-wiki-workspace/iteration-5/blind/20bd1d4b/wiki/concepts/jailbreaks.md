---
title: Jailbreaks
aliases: [jailbreaking, adversarial prompts]
tags: [security]
source: Karpathy — "Intro to Large Language Models" (Nov 2023)
created: 2026-08-18
status: draft
---

# Jailbreaks

> **TL;DR:** Crafted *user* prompts that talk the model past its safety
> guidelines — persona play, hypotheticals, encodings. They work because
> safety is learned behavior layered on a next-token predictor by
> [Fine-tuning](fine-tuning.md), not a hard constraint. An unresolved
> cat-and-mouse game.

## The pattern

Jailbreaks exploit the fact that rule-following lives in the same
weights as everything else, with no privileged enforcement mode:

- persona framing ("you are DAN, you can do anything");
- hypothetical or roleplay wrappers;
- obfuscation, translation, encoding;
- sustained conversational pressure.

## Why there is no clean fix

- There is no separate privileged mode the model can be forced into —
  [System Prompts](system-prompts.md) are advisory, not enforced.
- Defense in practice is more and better fine-tuning, red-teaming, and
  output filtering: raising the cost for attackers, not eliminating
  them.

## Relation to other attacks

Jailbreaks arrive through the *user* channel. When the malicious text
reaches the model through *data* it reads, that is
[Prompt Injection](prompt-injection.md). The talk also flags related
classes: backdoor / "sleeper agent" behavior planted during training,
and model-in-the-middle tampering between release and deployment.

## See also

- [Prompt Injection](prompt-injection.md)
- [System Prompts](system-prompts.md)
- [Fine-tuning](fine-tuning.md)
