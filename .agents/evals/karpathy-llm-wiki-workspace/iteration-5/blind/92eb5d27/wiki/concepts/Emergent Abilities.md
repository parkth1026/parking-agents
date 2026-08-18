---
title: "Emergent Abilities"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [emergent-abilities, scaling-laws, core-concept]
sources: ["Intro to Large Language Models"]
---

# Emergent Abilities

Capabilities that appear in [[Large Language Model]] systems as they scale
even though nobody explicitly trained for them: arithmetic, trivia question
answering, translation-like skills, code helpers, in-context learning from
examples alone. Since the only specified objective is
[[Next Token Prediction]], everything above it is discovered, not specified —
researchers probe newly trained models to find out what they can do, often
after release.

## How It Works

- More parameters + more data + more compute (see [[Pretraining]]) → lower
  loss → qualitatively new skills appearing. The industry keeps scaling
  because the loss trend is predictably smooth, but *which* abilities appear
  is not scheduled by anyone.
- Capabilities arrive unevenly: a model family may suddenly pass a benchmark
  class it previously failed, which is why evaluation is probing rather than
  spec-checking.
- The flip side of next-token plausibility is **hallucination**: the model
  confidently generates plausible-sounding falsehoods, because nothing in the
  objective distinguishes "likely text" from "true text". Assistant
  [[Fine-Tuning]] teaches some honesty about limits, but does not eliminate
  it.

## Variants

- In-context / few-shot learning — solving tasks from examples in the prompt.
- Abilities arriving via scaffolding rather than scale: [[Tool Use]] and
  [[System Prompt]] add skills the base model lacks.

## History

GPT-3 (2020) made few-shot in-context learning famous; the 2023 assistant
wave made capability-probing (and hallucination) household topics, as
recounted in [[Intro to Large Language Models]].

## Related

- [[Large Language Model]] — the system whose scale produces emergence
- [[Pretraining]] — the phase where scale is bought
- [[Fine-Tuning]] — the phase that shapes raw capability into assistant
  behavior
