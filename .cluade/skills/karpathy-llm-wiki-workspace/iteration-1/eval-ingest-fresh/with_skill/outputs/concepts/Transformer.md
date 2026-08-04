---
title: "Transformer"
created: 2026-04-13
updated: 2026-04-13
type: concept
tags: [architecture, core-concept, attention]
sources: ["Intro to Large Language Models"]
---

# Transformer

The dominant neural network architecture for language models, introduced by
Vaswani et al. in "Attention Is All You Need" (2017). Virtually all modern
large language models — GPT, LLaMA, PaLM, Gemini — are Transformer-based.

## Core Idea

The Transformer replaces recurrent connections (RNNs, LSTMs) with a
self-attention mechanism, allowing every token to directly attend to every
other token in the sequence. This enables:
- **Parallelization**: unlike RNNs, all tokens are processed simultaneously
- **Long-range dependencies**: attention can connect tokens far apart in text
- **Scalability**: the architecture scales effectively with compute and data

## Architecture Components

A typical Transformer decoder (used in GPT-style LLMs) consists of:
1. **Token embeddings** — convert integer token IDs to dense vectors
2. **Positional encodings** — inject token position information
3. **Stacked transformer blocks**, each containing:
   - [[Attention Mechanism]] (multi-head self-attention)
   - Feed-forward network (MLP)
   - Layer normalization and residual connections
4. **Output projection** — map final hidden states to vocabulary logits

## Scaling

Transformers exhibit strong [[Scaling Laws]]: doubling compute, data, or
parameters yields predictable performance improvements. This property has
driven the trend toward ever-larger models (GPT-3 at 175B, GPT-4, LLaMA 2
at 70B, etc.).

## Memory Bottleneck

The standard self-[[Attention Mechanism]] requires O(N²) memory in the
sequence length N, because it materializes a full N×N attention matrix.
For long contexts, this becomes prohibitive — addressed by [[Flash Attention]].

## History

- 2017: "Attention Is All You Need" (Vaswani et al., Google)
- 2018: GPT-1 (OpenAI), BERT (Google) — first large Transformer LMs
- 2020: GPT-3 (175B parameters) demonstrates few-shot learning
- 2022-present: scaling continues; Transformer remains the dominant architecture

## Related

- [[Attention Mechanism]], [[Flash Attention]], [[Pretraining]], [[Scaling Laws]], [[Context Window]]
