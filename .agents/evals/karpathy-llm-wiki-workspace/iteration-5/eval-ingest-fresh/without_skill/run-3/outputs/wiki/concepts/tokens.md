---
title: Tokens
aliases: [tokenization, token]
tags: [foundations, mechanics]
source: Karpathy — "Intro to Large Language Models" (Nov 2023)
created: 2026-08-18
status: draft
---

# Tokens

> **TL;DR:** LLMs do not read words or characters; they read **tokens** —
> frequent sub-word chunks from a fixed vocabulary of a few thousand
> entries. Next-token prediction happens over this vocabulary.

## Why sub-words

- Whole **words** would make the vocabulary enormous and would fail on
  rare or unseen words.
- Single **characters** make sequences long and statistics sparse.
- **Sub-words** (from algorithms in the byte-pair-encoding family) are
  the compromise: common words stay whole, rare words split into pieces.

## Mechanics

- Text is converted to tokens, tokens to integer IDs, and IDs to
  embedding vectors; the network then outputs a probability for every
  vocabulary entry as the next token.
- Sequence length is capped by the **context window** — the model's
  working memory (in the [LLM OS](llm-os.md) picture, the context window
  plays the role of RAM).

## Consequences worth remembering

- Arithmetic is awkward: numbers tokenize unpredictably, one reason LLMs
  benefit from [Tool Use](tool-use.md) (calculators).
- Odd string-level behavior (counting letters, reversing strings) is
  often a tokenization artifact, not a reasoning failure.
- Cost and context limits are denominated in tokens, not words.

## See also

- [What is an LLM](what-is-an-llm.md)
- [Tool Use](tool-use.md)
- [LLM OS](llm-os.md)
