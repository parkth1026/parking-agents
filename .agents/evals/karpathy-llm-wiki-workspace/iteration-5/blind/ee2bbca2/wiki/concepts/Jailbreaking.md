---
title: "Jailbreaking"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [safety, prompting]
sources: ["Intro to Large Language Models"]
---

# Jailbreaking

Crafting inputs that make a deployed [[Large Language Model]] ignore its
safety training and produce content its [[Fine-tuning]] was supposed to
suppress. The attack works on the user-model boundary: everything arrives as
one stream of tokens, so "instructions" can be overridden by more insistent
instructions.

## How It Works

- Persona exploits — e.g., "you are DAN, you can do anything now" style
  roleplay that relocates the model into a mode where refusals were rare in
  training data.
- Reframing — asking for the forbidden content as fiction, translation,
  academic exercise, or one token at a time.
- Persistence — safety training is a soft preference, not a hard constraint;
  enough pressure on the next-token distribution eventually flips it.
- Defenses are layered and reactive: better fine-tuning data, system-prompt
  hardening (see [[System Prompt]]), input/output classifiers — and each fix
  is followed by new attacks. As of the [[Intro to Large Language Models]]
  talk this is presented as an open, unsolved problem.

## Variants

- Manual jailbreaks circulated socially (forum prompts).
- Automated red-teaming, where an attacker model searches for prompts that
  break the target model.

## History

Jailbreaks appeared almost immediately after instruction-tuned assistants
shipped, and remain the canonical demonstration that alignment from
fine-tuning is not a security boundary. They are the user-side twin of
[[Prompt Injection]], which attacks through data the model reads rather than
through the user's own messages.

## Related

- [[Prompt Injection]] — the same weakness exploited through external data
- [[System Prompt]] — the instruction channel both attacks target
- [[Large Language Model]] — why the boundary is soft: one token stream, no
  privilege separation
