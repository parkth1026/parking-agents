---
title: "Flash Attention"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [attention, inference]
sources: ["Flash Attention (article)"]
---
# Flash Attention

IO-aware exact [[Attention Mechanism]] algorithm created by [[Tri Dao]]. It reduces attention memory from O(N^2) to O(N) while staying exact (lossless), and achieves 2-4x wall-clock speedup over standard attention in PyTorch.

## How It Works

- **Tiling**: the attention computation is split into blocks (tiles) that fit into fast GPU memory (SRAM), so the full N x N attention matrix is never materialized. Memory footprint drops from O(N^2) to O(N).
- **IO-awareness**: the key insight is that attention is bounded by memory bandwidth, not FLOPs — the arithmetic is cheap relative to the cost of moving data through the GPU memory hierarchy. Runtime wins therefore come from reducing memory traffic, not from reducing computation.
- **Exactness**: unlike approximate/sparse attention variants, Flash Attention computes the same mathematical attention output; only the execution order (tiling + online updates) changes.

## Variants

- FlashAttention-2 — improves on the original with better work partitioning across GPU thread blocks, further increasing wall-clock speed and GPU utilization.

## History

Standard [[Attention Mechanism]] as introduced for the [[Transformer]] materializes the full attention matrix, which dominates memory at long sequence lengths. Flash Attention (Tri Dao) reframed attention as a memory-bandwidth problem and made exact long-context attention practical in PyTorch.

## Related

- [[Attention Mechanism]] — the computation Flash Attention optimizes
- [[Transformer]] — the architecture whose self-attention layers benefit directly
- [[Tri Dao]] — creator of Flash Attention and FlashAttention-2
