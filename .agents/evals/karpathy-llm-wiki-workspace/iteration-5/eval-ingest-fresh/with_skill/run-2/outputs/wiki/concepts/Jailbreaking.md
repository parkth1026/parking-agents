---
title: "Jailbreaking"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [safety]
sources: ["Intro to Large Language Models (talk)"]
---

# Jailbreaking

Attacks in which an adversarial **user** crafts inputs that make a
[[Large Language Model]] ignore its safety rules or its [[System Prompt]] —
extracting harmful content the deployed assistant would otherwise refuse.
Classic patterns include persona games (the "Do Anything Now" style
personas that circulated for ChatGPT) and roleplay framings that relocate
the request into fiction.

## How It Works

- The model has no hard boundary between "rules" and "requests" — both are
  just text in the context window — so a cleverly framed prompt can
  outweigh the system prompt.
- Defenses are layered: safety [[Fine-Tuning]] teaches refusal, system
  prompts state rules, and classifiers filter both prompts and outputs.
  None are airtight; deployment is a cat-and-mouse game.

## Contrast With Prompt Injection

Jailbreaking and [[Prompt Injection]] are the two security risks the
talk highlights, distinguished by *who* the attacker is:

| | Attacker | Vector |
|---|---|---|
| Jailbreaking (this page) | the user typing | the prompt itself |
| [[Prompt Injection]] | a third party | content the model reads via [[Tool Use]] |

## Related

- [[Prompt Injection]]
- [[System Prompt]]
- [[Large Language Model]]
