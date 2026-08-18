---
title: Scaling Laws
aliases: [scaling]
tags: [training, empirical]
source: Karpathy — "Intro to Large Language Models" (Nov 2023)
created: 2026-08-18
status: stub
---

# Scaling Laws

> **TL;DR:** Validation loss decreases smoothly and *predictably* as you
> scale model parameters, data, and compute together — which is why labs
> can plan billion-dollar [Pretraining](pretraining.md) runs with
> confidence. What the laws do **not** tell you is which capabilities
> appear where (see [Emergent Capabilities](emergent-capabilities.md)).

## The three dials

- number of parameters
- amount of training data (tokens)
- total compute

Empirically, loss falls as a smooth, power-law-like function of each
when they are scaled in tandem; models in a family are often trained at
several sizes to fit the curve and extrapolate to the next run.

## Why it matters

- **Planning.** Big runs are budgeted with extrapolations from small
  runs.
- **The bitter lesson.** "Bigger, trained longer, on more data" has
  repeatedly beaten clever hand-engineering.
- **The blind spot.** Smooth average loss says nothing about
  *qualitative* jumps — a model can be slightly better on average yet
  newly capable at a specific task.

## See also

- [Pretraining](pretraining.md)
- [Emergent Capabilities](emergent-capabilities.md)
