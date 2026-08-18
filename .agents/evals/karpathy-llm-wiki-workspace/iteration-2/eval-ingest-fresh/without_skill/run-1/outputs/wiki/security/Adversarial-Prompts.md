---
title: Adversarial Prompts
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: security
tags: [security, jailbreak, prompt-injection, adversarial-inputs]
created: 2026-08-14
status: seed
---

# Adversarial Prompts

## The problem

LLMs are trained on text and follow instructions written in text — they
cannot reliably tell **data** from **instructions**. Attackers exploit this
by crafting inputs that hijack the model's behavior.

## Attack types from the talk

- **Jailbreaks**: user inputs crafted to make the model ignore its
  guidelines and produce content it should refuse (e.g. via role-play,
  clever phrasing, or padding tricks).
- **Prompt injection**: instructions hidden in content the model *reads*
  rather than the user's message — classically, a web page with white text
  on a white background saying "disregard previous instructions and ...",
  read by an assistant with [browsing](../usage/Tool-Use.md). The model may
  follow them as if they were the user's or the
  [system prompt's](../usage/System-Prompts.md) instructions.

## Why it is hard

- The same flexibility that makes LLMs useful (do what the text says) is
  what makes them attackable; there is no clean boundary between the two.
- Defenses are an ongoing **cat-and-mouse game** — classifiers, filtering,
  model-based guard layers — not a solved problem. Karpathy's stance: expect
  this to remain a live security frontier.

## Related

- [Data Poisoning](Data-Poisoning.md) — attacks on the training pipeline
- [System Prompts](../usage/System-Prompts.md)
- [Tool Use](../usage/Tool-Use.md)
