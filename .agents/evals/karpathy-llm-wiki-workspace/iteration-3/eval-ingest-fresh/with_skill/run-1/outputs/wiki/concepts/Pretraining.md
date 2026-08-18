---
title: "Pretraining"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [training, data, core-concept]
sources: ["Intro to Large Language Models"]
---

# Pretraining

Stage 1 of building a [[Large Language Model]]: train from scratch on a huge crawl of internet text, optimizing a single loss — predict the next token.

## How It Works

- Data: terabytes of web text (encyclopedias, books, forums, code) — noisy but enormous
- Compute: frontier-scale pretraining runs occupy clusters of tens to hundreds of thousands of GPUs for weeks to months, at costs in the millions of dollars; most organizations cannot afford it and instead start from someone else's base model
- Output: a base model that plausibly continues any document it is given

## The Base Model Is Not an Assistant

Karpathy describes the base model as a simulator of random internet documents — a kind of compressed sketch of the internet. Asked a question, it may simply continue with more questions, because pages full of questions exist in the training data. Making it answer as an assistant requires [[Fine-tuning]].

## Relation to Scale

Pretraining loss falls smoothly with scale, but interesting abilities arrive unevenly and somewhat unpredictably — see [[Emergent Capabilities]].

## Related

- [[Large Language Model]]
- [[Fine-tuning]]
- [[Emergent Capabilities]]
