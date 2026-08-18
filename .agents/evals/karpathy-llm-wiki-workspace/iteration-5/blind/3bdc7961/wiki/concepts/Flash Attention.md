---
title: "Flash Attention"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [attention, paper]
sources: ["Flash Attention"]
---
# Flash Attention

IO-aware exact attention algorithm by Tri Dao: computes the same result as the standard [[Attention Mechanism]] but drops memory from O(N^2) to O(N).

## Key Ideas
- Exact, not approximate — only the execution strategy changes, not the math
- Bottleneck in attention is memory bandwidth, not FLOPs
- Achieves the savings by tiling the computation and never materializing the full attention matrix

## Results
- 2-4x wall-clock speedup over standard attention in PyTorch

## FlashAttention-2
Successor that improves on the original with better work partitioning across GPU thread blocks.

## Connections
- Speeds up the [[Attention Mechanism]] layers inside every [[Transformer]] without changing what they compute
