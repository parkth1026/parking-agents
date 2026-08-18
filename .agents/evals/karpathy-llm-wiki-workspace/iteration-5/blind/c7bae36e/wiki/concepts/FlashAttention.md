---
title: "FlashAttention"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [attention, inference, hardware]
sources: ["Flash Attention"]
---
# FlashAttention

IO-aware exact [[Attention Mechanism]] algorithm introduced by [[Tri Dao]]. It produces the same output as standard attention while reducing memory from O(N^2) to O(N) by tiling the computation and never materializing the full attention matrix.

## How It Works

- Standard attention materializes the full N-by-N attention matrix in high-bandwidth memory (HBM); FlashAttention instead tiles the computation into blocks that are computed in fast on-chip SRAM.
- Because the full matrix is never written out, activation memory drops from O(N^2) to O(N).
- It is exact, not an approximation: the tiled computation reproduces standard attention output.
- Key insight: attention is bottlenecked by memory bandwidth, not FLOPs. Cutting HBM traffic yields a 2-4x wall-clock speedup over standard attention in PyTorch.

## Variants

- FlashAttention (original) — IO-aware tiled exact attention
- FlashAttention-2 — improves work partitioning across GPU thread blocks for better hardware utilization

## History

Introduced by [[Tri Dao]] as part of the hardware-aware efficiency line of work that made long-context [[Transformer]] training and serving practical.

## Related

- [[Attention Mechanism]] — the computation FlashAttention accelerates
- [[Transformer]] — the architecture whose quadratic attention cost it tames
- [[Flash Attention]] — ingested source summary
