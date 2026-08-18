---
title: "FlashAttention"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [attention, inference, hardware]
sources: ["Flash Attention"]
---
# FlashAttention

IO-aware, memory-efficient implementation of exact [[Attention Mechanism]] by Tri Dao et al. It computes the same mathematical attention while reducing memory from O(N^2) to O(N), by tiling the computation and never materializing the full N-by-N attention matrix.

## How It Works

Standard attention computes an N-by-N score matrix and writes it to GPU high-bandwidth memory (HBM), which dominates the cost. FlashAttention tiles the query/key/value blocks and keeps intermediate results in fast on-chip SRAM, reloading tiles as needed, so global memory traffic drops from quadratic to linear. It is exact — the numerical result matches standard attention, unlike sparse or low-rank approximations. This yields a 2-4x wall-clock speedup over standard attention in PyTorch.

The guiding insight is that attention is **memory-bandwidth-bound, not FLOP-bound**: the bottleneck is moving the attention matrix to and from HBM, not the arithmetic.

## Variants

- FlashAttention-2 — improves work partitioning across GPU thread blocks, further raising GPU utilization and speed
- Standard multi-head attention as used in the [[Transformer]] — the baseline it optimizes

## History

Introduced by Tri Dao et al. (2022) as an IO-aware exact attention algorithm; FlashAttention-2 (2023) refined the parallelization across thread blocks. The technique is now a default efficient-attention path in major deep-learning frameworks.

## Related

- [[Flash Attention]] — ingested source article summarizing this technique
- [[Attention Mechanism]] — the underlying computation being optimized
- [[Transformer]] — the architecture whose long-context cost this reduces
