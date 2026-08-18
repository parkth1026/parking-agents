---
title: System Prompts
aliases: [system message, conditioning, meta-prompting]
tags: [deployment, prompting]
source: Karpathy — "Intro to Large Language Models" (Nov 2023)
created: 2026-08-18
status: draft
---

# System Prompts

> **TL;DR:** The system prompt is a privileged-looking first message
> that conditions the assistant's persona, rules, and available tools for
> the whole conversation. Powerful but advisory — it is not a security
> boundary (see [Jailbreaks](jailbreaks.md)).

## What it is

- A separate role in the chat format produced by
  [Fine-tuning](fine-tuning.md): the `system` message before the
  `user`/`assistant` turns.
- Carries role definition, tone, constraints, task framing, and
  increasingly the descriptions of [Tools](tool-use.md).

## What it is not

- Not enforced isolation. The model treats it as strong context, not as
  a kernel-enforced policy — an adversarial user can often override it
  ([Jailbreaks](jailbreaks.md)), and injected *data* can speak through
  the same channel ([Prompt Injection](prompt-injection.md)).

## Meta-prompting (the talk's demo)

Karpathy's trick: use an LLM to *write* the system prompt. Iteratively
ask a model to draft a prompt for the task, run it, critique the
behavior, and let the model revise. Prompt engineering becomes an outer
optimization loop around the model — an early glimpse of treating
prompts as software that is developed, tested, and versioned like any
other artifact.

## See also

- [Tool Use](tool-use.md)
- [Fine-tuning](fine-tuning.md)
- [Jailbreaks](jailbreaks.md)
- [Prompt Injection](prompt-injection.md)
