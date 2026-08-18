---
title: "Attention Mechanism"
created: 2026-08-10
updated: 2026-08-18
type: concept
tags: [attention, core-concept]
sources: ["Attention Is All You Need", "Flash Attention"]
---
# Attention Mechanism

Compute-then-weight operation letting each token gather information from every other token.

## How It Works
Query/key/value dot products produce a distribution over positions, used to mix value vectors.

## Variants
- Multi-head attention as used in [[Transformer]]
- [[FlashAttention]] — IO-aware exact attention: O(N) memory, 2-4x wall-clock speedup by never materializing the full matrix
- Can be stacked in any differentiable [[Neural Network]]
