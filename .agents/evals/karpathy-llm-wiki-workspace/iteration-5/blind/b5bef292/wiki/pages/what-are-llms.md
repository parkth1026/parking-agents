---
title: What Are LLMs?
tags: [foundations, llm-basics, tokens, inference]
status: seed
source: "Karpathy, 'Intro to Large Language Models' (2023)"
created: 2026-08-18
---

# What Are LLMs?

> An LLM is just two files: a chunk of the internet, and a big blob of
> numbers. Training squeezes the first into the second; inference repeatedly
> predicts the next token.

## The two-file mental model

Karpathy's framing: an LLM (e.g., Llama 2 70B) reduces to two files:

| File | Order of magnitude | What it is |
|---|---|---|
| Training data | ~10 TB | Text scraped from the internet |
| Parameters | ~100–140 GB | The trained neural network weights |

- Llama 2 70B has ~70 billion parameters; at 2 bytes per parameter that is
  roughly 140 GB.
- Training is a *lossy compression* of the internet text into those
  parameters.
- The neural network architecture itself is only a few hundred lines of
  code — everything interesting lives in the weights.

## Tokens: the unit of text

- Text is chopped into **tokens** (subword pieces), not characters or words.
- Typical vocabularies are ~32k–100k tokens (Llama 2 uses ~32k).
- An average token is about 4 characters; rare words split into pieces
  (e.g., `un` + `believ` + `able`). The model reads and writes in these
  units only.

## Inference: next-token prediction

1. Feed a sequence of tokens into the network.
2. It outputs a probability distribution over the *next* token (~32k
   options in Llama 2's case).
3. Sample one token from that distribution.
4. Append it and repeat.

This loop is **autoregressive generation**. There is no plan and no lookup
table — just the same one-token-ahead prediction applied over and over.
Karpathy likens the results to "dreaming": plausible continuations sampled
from a learned statistical model of the internet.

## Why this is remarkable

- Nobody labels anything. The objective is trivial (guess the next token),
  yet at internet scale it produces a *general-purpose* technology: the
  same blob of weights answers questions, writes code, translates, and
  summarizes.
- LLMs are an **emerging standard** technology — one model, many uses —
  which is why so many companies are building them.

## Caveats (covered on later pages)

- The raw trained model is an "internet document generator", not an
  assistant — see [Pretraining](pretraining.md).
- Making it useful and truthful requires [Fine-Tuning & RLHF](fine-tuning.md).
- Capabilities grow with scale in surprising ways — see
  [Emergent Capabilities at Scale](emergent-capabilities.md).

## See also

- [Pretraining](pretraining.md) — how the blob of parameters is produced
- [Fine-Tuning & RLHF](fine-tuning.md) — how it becomes an assistant
- [Emergent Capabilities at Scale](emergent-capabilities.md) — why scale matters
- [Glossary](../glossary.md) — terms used above

## References

- Andrej Karpathy,
  [*Intro to Large Language Models*](https://www.youtube.com/watch?v=zjkBMFhNj_g)
  (1-hour talk, 2023) — opening section, "two files" and next-token
  prediction.
