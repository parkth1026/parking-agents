---
title: "Attention Mechanism"
created: 2026-08-10
updated: 2026-08-18
type: concept
tags: [attention, core-concept]
sources: ["Attention Is All You Need", "FlashAttention (article)"]
---
# Attention Mechanism

Compute-then-weight operation letting each token gather information from every other token.

## How It Works
Query/key/value dot products produce a distribution over positions, used to mix value vectors.

## Variants
- Multi-head attention as used in [[Transformer]]
- [[FlashAttention]] — IO-aware exact attention: tiling avoids materializing the N×N matrix, cutting memory to O(N) with 2-4x speedup; the bottleneck is memory bandwidth, not FLOPs
- Can be stacked in any differentiable [[Neural Network]]
