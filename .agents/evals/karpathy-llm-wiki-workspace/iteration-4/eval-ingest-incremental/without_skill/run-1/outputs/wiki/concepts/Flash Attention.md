---
title: "Flash Attention"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [attention, paper]
sources: ["Flash Attention"]
---
# Flash Attention

IO-aware exact attention algorithm by Tri Dao: computes the same result as standard [[Attention Mechanism]] while reducing memory from O(N^2) to O(N).

## How It Works
- Tiles the attention computation into blocks that stay in fast on-chip memory, so the full N-by-N attention matrix is never materialized
- Exact, not approximate — output matches standard attention; only the memory access pattern changes
- Key insight: the bottleneck in attention is memory bandwidth (IO), not FLOPs

## Performance
- 2-4x wall-clock speedup over standard attention in PyTorch
- FlashAttention-2 improves this further with better work partitioning across GPU thread blocks

## Why It Matters
Removes the quadratic memory cost that limits long sequences in the [[Transformer]], making longer contexts far more practical to train and run.
