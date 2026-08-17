---
title: "Pretraining"
created: 2026-04-13
updated: 2026-04-13
type: concept
tags: [training, language-model, core-concept]
sources: ["Intro to Large Language Models"]
---

# Pretraining

The first and most computationally intensive stage of training a large language
model. The model learns to predict the next token from a massive corpus of
internet text, acquiring broad world knowledge in the process.

## How It Works
1. Collect a large text dataset (~10TB for a 70B-parameter model)
2. Tokenize all text into integer tokens (e.g., using BPE tokenization)
3. Train the neural network to predict the next token given all prior tokens
4. Use the cross-entropy loss: minimize the negative log-probability of the correct next token
5. Iterate over the dataset for one or more epochs

## Scale
A [[Scaling Laws]]-class model like Llama 70B requires:
- ~6,000 GPUs running for ~12 days
- Approximately $2M in compute costs
- ~1.4 trillion tokens of training data

The result is stored as two files: a **parameters file** (weights, ~140GB) and a
**run file** (inference code, ~500 lines of C).

## What the Model Learns
Pretraining produces a **base model** — a powerful "document completer" that has
implicitly compressed world knowledge into its weights. It learns:
- Grammar, facts, reasoning patterns
- Multilingual knowledge
- Code, math, and logic structures

However, a base model is NOT an assistant — it will continue any prompt in the
style of internet text, not respond helpfully to questions. [[Fine-Tuning]] is
required to shape it into an assistant.

## The "Zip File" Analogy
Karpathy describes pretraining as creating a "lossy compression of the internet."
The model cannot retrieve exact source text, but it has internalized patterns
from trillions of tokens.

## Related
- [[Fine-Tuning]], [[RLHF]], [[Scaling Laws]], [[Tokenization]], [[Andrej Karpathy]]
