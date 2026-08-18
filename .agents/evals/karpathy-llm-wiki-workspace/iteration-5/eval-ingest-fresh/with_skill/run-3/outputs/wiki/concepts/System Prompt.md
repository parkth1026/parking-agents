---
title: "System Prompt"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [prompting, inference]
sources: ["Intro to Large Language Models"]
---

# System Prompt

A special instruction channel that steers a [[Large Language Model]] into a
desired operating mode for a whole conversation. It is prepended invisibly to
the user's messages and, in deployed products, is the primary behavior-control
surface — no weights change, only context.

## How It Works

- The system prompt sets standing rules: persona ("you are a helpful
  assistant", or a pirate), scope (topics to refuse or emphasize), output
  format, and tool policy.
- Because the model is a next-token predictor, a system prompt effectively
  conditions all subsequent generation — it is "steering" in the literal
  sense: the same weights produce very different behavior under different
  system prompts.
- In the [[Intro to Large Language Models]] talk, Karpathy demonstrates this
  by switching the assistant between modes (e.g., a pirate persona), making
  the point that products are largely prompt-conditioned behavior over a
  fine-tuned base (see [[Fine-tuning]]).

## Variants

- Persona/role prompts — "act as X" style mode switching.
- Policy prompts — safety and scope rules the product wants enforced.
- Tool-policy prompts — which of the model's [[Tool Use]] capabilities are
  enabled and how results should be treated.

## History

Descends from GPT-3-style task instructions and "meta-prompts". As assistants
productized, the system prompt hardened into a distinct API role, and it is
now also an attack surface: both [[Jailbreaking]] and [[Prompt Injection]]
are, at bottom, ways of overriding or forging instruction context.

## Related

- [[Tool Use]] — capabilities the system prompt typically enables or disables
- [[Jailbreaking]] — attacking the model through its instruction channel
- [[Prompt Injection]] — forging instructions through the data channel
