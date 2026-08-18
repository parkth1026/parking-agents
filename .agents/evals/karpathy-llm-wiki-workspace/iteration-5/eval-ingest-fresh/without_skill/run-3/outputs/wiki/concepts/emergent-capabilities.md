---
title: Emergent Capabilities
aliases: [emergence]
tags: [capabilities]
source: Karpathy — "Intro to Large Language Models" (Nov 2023)
created: 2026-08-18
status: draft
---

# Emergent Capabilities

> **TL;DR:** As models scale, qualitatively new abilities appear —
> in-context learning, arithmetic, translation, coding — and *which*
> ability appears at *which* scale is not predicted by
> [Scaling Laws](scaling-laws.md). Capability discovery is empirical:
> train first, then probe.

## Examples from the talk's arc

- **In-context learning.** A [pretrained](pretraining.md) base model can
  often perform a task given only a few demonstrations in the prompt —
  no weight updates. This mechanism is the foundation of prompting.
- **Coding and math.** Models trained only on internet text turn out to
  write useful code — a capability nobody explicitly engineered.
- **Multi-step reasoning** over problems that look nothing like any
  single document the model saw.

## Why "emergent"

- The training objective is always the same next-token loss; the
  *capabilities* are side effects of scale.
- Average loss improves smoothly with scale while specific abilities
  switch on unevenly — the curve does not announce them in advance.

## The epistemic problem

Karpathy's point: this makes frontier-model development an experimental
science. You find out what a model can do by training it and testing it;
you cannot fully derive it in advance. Practitioners then map
capabilities by trial, and the next, bigger run reshuffles the map.

## See also

- [Scaling Laws](scaling-laws.md) — the smooth part
- [Pretraining](pretraining.md)
- [Tool Use](tool-use.md) — capabilities extended beyond text
