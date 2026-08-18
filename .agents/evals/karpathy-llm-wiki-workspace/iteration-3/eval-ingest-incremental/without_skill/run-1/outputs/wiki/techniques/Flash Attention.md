---
title: "Flash Attention"
created: 2026-08-18
updated: 2026-08-18
type: technique
tags: [attention, paper]
sources: ["Flash Attention by Tri Dao"]
---
# Flash Attention

IO-aware exact attention algorithm by Tri Dao that makes the [[Attention Mechanism]] inside a [[Transformer]] dramatically faster and more memory-efficient.

## Key Ideas
- The bottleneck in attention is memory bandwidth, not FLOPs
- Tiling the computation avoids materializing the full N-by-N attention matrix, reducing memory from O(N^2) to O(N)
- Still exact attention: same computation as standard [[Attention Mechanism]], no approximation

## Performance
- 2-4x wall-clock speedup over standard attention in PyTorch

## FlashAttention-2
Refines the original with better work partitioning across GPU thread blocks.

## Why It Matters
Removes the quadratic memory barrier of naive attention, making long-sequence [[Transformer]] training and inference practical.
