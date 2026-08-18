---
title: Pretraining
aliases: [pre-training, base model training, stage 1]
tags: [training]
source: Karpathy — "Intro to Large Language Models" (Nov 2023)
created: 2026-08-18
status: draft
---

# Pretraining

> **TL;DR:** Stage 1 of the pipeline: download and filter a huge chunk
> of the internet, then train the network for next-token prediction on
> GPU clusters for weeks — compressing that data into weights. The
> output is a **base model**: an internet-document simulator, not an
> assistant.

## The recipe

1. **Data.** Download a large fraction of the web (order of terabytes
   raw, heavily filtered and deduplicated afterwards). Quality
   filtering matters a lot for the final model.
2. **Objective.** Standard next-token (cross-entropy) loss over
   [tokens](tokens.md) — nothing else. See
   [What is an LLM](what-is-an-llm.md).
3. **Optimization.** Gradient-based training over the whole corpus on
   clusters of GPUs, running for weeks.

## Scale of the run

This is the expensive, industrial stage: frontier-scale runs use
thousands of GPUs and cost on the order of millions to tens of millions
of dollars. The fact that cost and final loss can be predicted up front
is what makes such bets rational — see
[Scaling Laws](scaling-laws.md).

## The product: a base model

After pretraining you can sample the model, and it will produce
internet-plausible text — news articles, wiki pages, forum posts — but:

- it does not follow instructions or hold a conversation;
- it continues prompts instead of answering them;
- it fabricates content freely (see
  [Hallucinations](hallucinations.md)).

Turning it into something usable is stage 2:
[Fine-tuning](fine-tuning.md).

## See also

- [What is an LLM](what-is-an-llm.md) — the objective being optimized
- [Scaling Laws](scaling-laws.md) — how the run's outcome can be predicted
- [Fine-tuning](fine-tuning.md) — stage 2
- [Emergent Capabilities](emergent-capabilities.md) — what pretraining alone buys you
