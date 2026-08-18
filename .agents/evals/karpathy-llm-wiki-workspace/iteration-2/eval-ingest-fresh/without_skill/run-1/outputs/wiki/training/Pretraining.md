---
title: Pretraining
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: training
tags: [pretraining, base-model, compute, internet-scale]
created: 2026-08-14
status: seed
---

# Pretraining

The first and by far the most expensive stage of the
[training process](Training-Process.md).

## What happens

- Assemble a corpus on the order of **terabytes of internet text** (e.g.
  filtered Common Crawl, plus other sources).
- Train the network with [next-token prediction](../fundamentals/Next-Token-Prediction.md)
  across that entire corpus: predict the next token everywhere on the
  internet, adjusting billions of parameters.
- Run for **months on large GPU clusters**; costs on the order of millions of
  dollars.

## Consequences

- Only a **handful of organizations worldwide** can afford to pretrain
  frontier models. Everyone else starts from released base models.
- The result is a **base model**: a "[dreamer](../fundamentals/What-is-an-LLM.md)"
  of internet documents — enormous knowledge of language and facts, but no
  notion of being an assistant.
- Because data comes from the internet, its quirks, errors, and even
  deliberate attacks flow into the weights — see
  [Data Poisoning](../security/Data-Poisoning.md).

## After pretraining

A base model needs [fine-tuning](Fine-Tuning.md) before it behaves like a
chat assistant.

## Related

- [Training Process](Training-Process.md)
- [Fine-Tuning](Fine-Tuning.md)
- [Next-Token Prediction](../fundamentals/Next-Token-Prediction.md)
- [Scaling](../capabilities/Scaling.md)
