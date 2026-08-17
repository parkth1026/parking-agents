---
title: "Attention Mechanism"
created: 2026-04-13
updated: 2026-04-13
type: concept
tags: [architecture, attention, core-concept]
sources: ["Intro to Large Language Models", "Flash Attention Article"]
---

# Attention Mechanism

The core computational primitive of the [[Transformer]] architecture. Attention
allows each token in a sequence to gather information from all other tokens
by computing weighted sums over their representations.

## How It Works

Given a sequence of token embeddings, attention computes three projections:
- **Query (Q)**: what information does this token want?
- **Key (K)**: what information does each token offer?
- **Value (V)**: what content does each token contribute?

The attention output for each token is:

```
Attention(Q, K, V) = softmax(Q·Kᵀ / √d_k) · V
```

The term `Q·Kᵀ` produces an N×N **attention matrix** (where N is sequence
length) storing a similarity score between every pair of tokens. This matrix
is the central memory bottleneck: it requires **O(N²) memory**.

## Memory Complexity

Standard attention materializes the full N×N attention matrix in GPU HBM
(high-bandwidth memory). For a sequence of 1,024 tokens, that's ~1M entries.
At 4K tokens, it's ~16M entries — scaling quadratically. This makes long
contexts extremely memory-intensive.

Key insight: the bottleneck in attention is **memory bandwidth**, not FLOPs.
[[Flash Attention]] addresses this by tiling computation to avoid materializing
the full matrix.

## Multi-Head Attention

In practice, attention is computed in parallel across multiple "heads,"
each learning different relational patterns:

```
MultiHead(Q, K, V) = Concat(head₁, ..., headₙ) · Wᴼ
where headᵢ = Attention(Q·Wᵢᴬ, K·Wᵢᴷ, V·Wᵢᵛ)
```

A typical large model uses 32–96 attention heads.

## Variants

- **Self-attention**: Q, K, V all come from the same sequence (used in GPT)
- **Cross-attention**: Q from one sequence, K/V from another (used in encoders)
- **Causal (masked) attention**: tokens can only attend to previous positions
- **[[Flash Attention]]**: IO-aware implementation reducing memory to O(N)
- **Sliding window attention**: limits each token to attending a local window

## History

- 2015: Bahdanau et al. — attention for neural machine translation
- 2017: Vaswani et al. — [[Transformer]] replaces RNNs with attention-only architecture
- 2022: [[Flash Attention]] (Tri Dao) — IO-aware exact attention with O(N) memory

## Related

- [[Transformer]], [[Flash Attention]], [[Context Window]], [[Pretraining]]
