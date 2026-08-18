---
title: "Flash Attention"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [attention, paper]
sources: ["Flash Attention (Tri Dao)"]
---
# Flash Attention

IO-aware exact algorithm for computing [[Attention Mechanism]] with less memory and 2-4x wall-clock speedup over standard attention in PyTorch.

## How It Works
Tiles the computation and avoids materializing the full N x N attention matrix, reducing memory from O(N^2) to O(N). The result is exact attention — same math as standard attention, computed in a different order rather than approximated.

## Why It Is Fast
The bottleneck in attention is memory bandwidth, not FLOPs. Because the algorithm is IO-aware — organized around moving data as little as possible — it turns attention from a compute-bound-looking operation into a much faster memory-efficient one.

## FlashAttention-2
Successor with better work partitioning across GPU thread blocks, improving hardware utilization further.

## Impact
Makes long-sequence [[Transformer]] training and inference cheaper; a drop-in acceleration of the [[Attention Mechanism]] at the heart of modern LLMs.
