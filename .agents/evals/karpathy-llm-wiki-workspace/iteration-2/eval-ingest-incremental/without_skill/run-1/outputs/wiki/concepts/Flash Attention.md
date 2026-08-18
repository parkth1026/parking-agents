---
title: Flash Attention
type: concept
tags: [attention, paper, architecture]
sources:
  - "Dao et al., 2022 — FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness (NeurIPS)"
  - "Dao, 2023 — FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning"
---
# Flash Attention
An IO-aware exact attention algorithm by Tri Dao that reduces attention memory usage and wall-clock time without sacrificing accuracy.

## How It Works
Flash Attention tiles the attention computation so the full N x N attention matrix is never materialized in high-bandwidth memory (HBM). This drops memory from O(N^2) to O(N) while remaining an *exact* (not approximate) computation. Because the bottleneck in attention is memory bandwidth rather than FLOPs, minimizing HBM reads/writes yields a 2-4x wall-clock speedup over standard attention in PyTorch.

FlashAttention-2 extends this with better work partitioning across GPU thread blocks, improving hardware utilization further.

## Key Insight
The bottleneck in attention is memory bandwidth, not FLOPs.

## Related
- [[Attention Mechanism]]
- [[Transformer]]
- [[Neural Network]]
