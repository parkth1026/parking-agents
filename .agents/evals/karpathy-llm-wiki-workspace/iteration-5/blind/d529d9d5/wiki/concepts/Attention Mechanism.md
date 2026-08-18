---
title: "Attention Mechanism"
created: 2026-08-10
updated: 2026-08-18
type: concept
tags: [attention, core-concept]
sources: ["Attention Is All You Need", "Flash Attention (article)"]
---
# Attention Mechanism

Compute-then-weight operation letting each token gather information from every other token.

## How It Works
Query/key/value dot products produce a distribution over positions, used to mix value vectors.
Naively this materializes the full N x N attention matrix (O(N^2) memory); the operation is
memory-bandwidth-bound rather than FLOP-bound.

## Variants
- Multi-head attention as used in [[Transformer]]
- [[Flash Attention]] — IO-aware exact attention: tiles the computation to cut memory to O(N), 2-4x faster in PyTorch
- Can be stacked in any differentiable [[Neural Network]]
