---
title: "Attention Mechanism"
created: 2026-08-10
updated: 2026-08-18
type: concept
tags: [attention, core-concept]
sources: ["Attention Is All You Need", "Flash Attention (Tri Dao)"]
---
# Attention Mechanism

Compute-then-weight operation letting each token gather information from every other token.

## How It Works
Query/key/value dot products produce a distribution over positions, used to mix value vectors.

## Variants
- Multi-head attention as used in [[Transformer]]
- Can be stacked in any differentiable [[Neural Network]]

## Efficient Implementations
- [[Flash Attention]] computes the same exact attention with O(N) memory and 2-4x speedup by tiling; its key insight is that the bottleneck here is memory bandwidth, not FLOPs
