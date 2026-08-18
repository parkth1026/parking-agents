---
title: "Tokenization"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [tokenization, core-concept]
sources: ["Karpathy Intro to LLMs Talk"]
---

# Tokenization

LLMs do not read characters or whole words; they read **tokens** — frequent
chunks of text (often ~4 characters on average) mapped to integer IDs from a
fixed vocabulary (roughly 50k-100k entries in modern models).

## How It Works

- A tokenizer (e.g. byte-pair encoding) is fit on the training corpus: common
  strings ("the", "ing", frequent words) become single tokens; rare strings
  decompose into multi-token sequences.
- Every input string becomes a sequence of token IDs; the model's output is a
  distribution over those IDs; decoding maps IDs back to text.
- Tokenization runs before everything else — it defines the units of
  [[Next Token Prediction]] and is how multi-terabyte [[Pretraining]] corpora
  are counted as "tokens".

## Why It Matters

- Vocabulary size trades off sequence length against output-distribution
  size; tokens let a [[Large Language Model]] pack more meaning per position
  than raw characters would.
- Tokens leak into model quirks: the model never sees letters or digits
  directly, so character-level tasks (counting letters, some arithmetic) are
  done through an imperfect token lens.

## Related

- [[Next Token Prediction]]
- [[Large Language Model]]
- [[Pretraining]]
