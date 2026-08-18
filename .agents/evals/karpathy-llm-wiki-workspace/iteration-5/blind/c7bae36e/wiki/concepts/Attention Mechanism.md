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
Query/key/value dot products produce a distribution over positions, used to mix value vectors. The naive implementation materializes the full attention matrix, which makes memory bandwidth (not FLOPs) the practical bottleneck; [[FlashAttention]] addresses exactly this.

## Variants
- Multi-head attention as used in [[Transformer]]
- [[FlashAttention]] — IO-aware exact attention: O(N) memory via tiling, 2-4x wall-clock speedup
- Can be stacked in any differentiable [[Neural Network]]
