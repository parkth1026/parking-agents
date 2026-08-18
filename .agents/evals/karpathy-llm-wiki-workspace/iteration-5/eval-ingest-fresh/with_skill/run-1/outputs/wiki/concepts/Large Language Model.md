---
title: "Large Language Model"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [language-model, model, core-concept]
sources: ["Intro to Large Language Models"]
---

# Large Language Model

A Large Language Model (LLM) is, in [[Andrej Karpathy]]'s compressed
definition, just next token prediction on a large amount of internet text.
Mechanically it is a neural network whose entire "knowledge" lives in its
learned weights. Karpathy's favorite framing: an LLM ships as two artifacts —
a **parameters file** (the learned weights, e.g. a 100 GB blob of numbers)
and a **run file** (a few hundred lines of code that executes the network).
There is no explicit fact database, no per-question logic.

## How It Works

- Text is chopped into **tokens** (roughly 4 characters on average), and the
  network's only job is predicting the next token given everything so far.
  See [[Next Token Prediction]].
- Because internet text is written by humans, predicting the next token well
  forces the network to internalize grammar, facts, and reasoning patterns —
  compressed into the parameters rather than stored as retrievable records.
- A base LLM is a "document simulator": it continues any prompt plausibly in
  the style of its training data. Turning it into an assistant requires
  [[Fine-Tuning]] on top of [[Pretraining]].
- Novel capabilities appear as models grow rather than being specified by
  engineers — see [[Emergent Abilities]].

## Variants

- Base (pretrained) models vs assistant (fine-tuned) models.
- Multimodal models fold images/audio into the same token-prediction loop.
- Open-weight vs API-only deployments.

## History

Descends from n-gram language modeling through neural LMs to transformer-era
scaling: GPT-2 and GPT-3 made "internet-scale next-token prediction" the
dominant recipe for the field.

## Related

- [[Next Token Prediction]] — the single training objective
- [[Pretraining]] and [[Fine-Tuning]] — the two-stage recipe
- [[LLM OS]] — this "new kind of computer" as the kernel of a future stack
