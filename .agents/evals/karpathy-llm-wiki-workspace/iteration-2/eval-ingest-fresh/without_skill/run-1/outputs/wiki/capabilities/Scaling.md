---
title: Scaling
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: capabilities
tags: [scaling, benchmarks, compute]
created: 2026-08-14
status: seed
---

# Scaling

## The observation

Increase a model's size (parameter count), training data, and compute, and
benchmark performance improves. The talk's example: the Llama 2 model card
plots — 7B, 13B, 34B, 70B parameters — with larger models scoring higher
across benchmarks.

## Why it drives the field

- If capability grows fairly predictably with scale, then **spending more on
  compute and data buys better models** — the core economic engine of the
  LLM industry, and the reason [pretraining](../training/Pretraining.md)
  costs keep rising.
- Scaling applies along three axes: **parameters, data, and compute** — they
  move together.

## The caveat

Improvement is smooth on many benchmarks, but not all capabilities behave
that way — some appear suddenly and unpredictably. That is the subject of
[Emergent Capabilities](Emergent-Capabilities.md).

## Related

- [Emergent Capabilities](Emergent-Capabilities.md)
- [Pretraining](../training/Pretraining.md)
- [What is an LLM?](../fundamentals/What-is-an-LLM.md)
