---
title: "Flash Attention"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [attention]
sources: ["FlashAttention (Tri Dao)"]
---
# Flash Attention

IO-aware exact [[Attention Mechanism]] algorithm by Tri Dao: same attention math, but organized to slash memory traffic.

## Key Ideas
- The bottleneck in attention is memory bandwidth, not FLOPs — so minimizing HBM reads/writes beats minimizing arithmetic
- Tiling: attention is computed block-by-block in fast on-chip SRAM, never materializing the full N^2 attention matrix
- Memory drops from O(N^2) to O(N); 2-4x wall-clock speedup over standard attention in PyTorch
- Exact, not approximate: unlike sparse or linear-attention variants, it changes the implementation, not the computation

## FlashAttention-2
Successor with better work partitioning across GPU thread blocks (and warps), improving utilization and pushing the speedup further.

## Significance
Makes long-sequence [[Transformer]] training and inference practical; widely adopted as the standard attention kernel in modern LLM stacks.
