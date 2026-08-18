---
title: "System Prompt"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [prompting, inference]
sources: ["Karpathy Intro to LLMs Talk"]
---

# System Prompt

LLM chat interfaces run on two prompt channels: a visible user message and a
hidden **system prompt** the end user typically never sees. The system prompt
carries standing instructions — persona, tone, policies — and, importantly,
which tools the model may call and how.

## How It Works

- The system prompt is prepended to the conversation and steers every
  response; deployed assistants (customer-support bot, SQL expert) are
  largely one base model with different system prompts and/or
  [[Fine-Tuning]] variants.
- System prompts can grant capabilities by convention — for example
  instructing the model when to invoke plugins, which is how [[Tool Use]] is
  typically enabled.
- Only models shaped by [[Fine-Tuning]] and [[RLHF]] reliably follow system
  prompts; a raw base model would just continue them as more text.

## Security Angle

The system prompt is the "trusted" instruction channel — which is exactly
what [[Prompt Injection]] tries to override with planted text read through
tools, and what [[Jailbreaking]] tries to bypass from the user side.

## Related

- [[Tool Use]]
- [[Prompt Injection]]
- [[Large Language Model]]
