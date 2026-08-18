---
title: Fine-Tuning
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: training
tags: [fine-tuning, assistant, supervised-data]
created: 2026-08-14
status: seed
---

# Fine-Tuning

The second stage of the [training process](Training-Process.md): converting a
**base model** into an **assistant**.

## What happens

- Replace the giant pretraining corpus with a **small, high-quality dataset**
  — on the order of thousands of curated examples.
- The examples are **ideal assistant responses**: paid labelers, following
  detailed guidelines, write model answers to prompts and questions.
- Continue training the base model on this dataset (same
  [next-token prediction](../fundamentals/Next-Token-Prediction.md)
  mechanics, now on assistant-style transcripts).

## What it does and does not do

- **Does**: teach the format and behavior of an assistant — answer
  questions, follow instructions, ask clarifying questions, refuse when
  appropriate.
- **Does not**: add much knowledge. The knowledge came from
  [pretraining](Pretraining.md). Fine-tuning shapes *how* existing knowledge
  is expressed.
- Pushing new facts through fine-tuning is unreliable: the model learns to
  *always produce an answer*, which feeds
  [hallucinations](../capabilities/Hallucinations.md) when the knowledge is
  actually missing.

## Economics

Fine-tuning is cheap and fast compared to pretraining — which is why many
teams fine-tune released base models rather than pretraining their own, and
why it can be repeated as guidelines evolve. See
[RLHF](RLHF.md) for the optional third stage built on top of this.

## Related

- [Training Process](Training-Process.md)
- [Pretraining](Pretraining.md)
- [RLHF](RLHF.md)
- [Hallucinations](../capabilities/Hallucinations.md)
- [System Prompts](../usage/System-Prompts.md)
