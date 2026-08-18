---
title: "Emergent Abilities"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [emergent-abilities, scaling-laws, core-concept]
sources: ["Karpathy Intro to LLMs Talk"]
---

# Emergent Abilities

Scaling has two faces. Aggregate performance (loss on held-out text) improves
*predictably* with parameters, data, and compute — but specific skills appear
*unpredictably*, arriving suddenly at certain scales. Skills nobody explicitly
trains for — arithmetic, translation between languages, multi-step question
answering, following instructions — show up as "sparks" once the model is
large enough.

## How It Works

- Essentially everyone in the field runs the same recipe:
  [[Next Token Prediction]] at scale during [[Pretraining]]. What varies is
  parameters, data, and compute — and performance follows scaling laws.
- Because capabilities are not programmed, they cannot be reliably predicted
  in advance: you train first, benchmark after. Discovering what a new model
  can do is an empirical exercise.
- Later stages ([[Fine-Tuning]], [[RLHF]]) surface and sharpen abilities the
  base model already has; they do not install them from scratch.

## Practical Consequences

- LLM progress looks like "train bigger, then evaluate and be surprised" —
  the frontier is discovered, not designed.
- Benchmarks keep getting saturated by surprise, which continually reshapes
  how [[Large Language Model]] systems are evaluated.

## Related

- [[Large Language Model]]
- [[Pretraining]]
- [[Next Token Prediction]]
