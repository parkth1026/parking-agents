---
title: "Flash Attention"
created: 2026-08-11
updated: 2026-08-11
type: concept
tags: [attention]
sources: ["Flash Attention Article"]
---
# Flash Attention

IO-aware exact attention by Tri Dao: same mathematical result as standard attention, radically cheaper memory traffic.

## How It Works
Tiles the computation and never materializes the full attention matrix, cutting memory from O(N^2) to **O(N)** in sequence length; 2-4x wall-clock speedup over standard attention in PyTorch. FlashAttention-2 improves work partitioning across GPU thread blocks.

## Key Insight
The bottleneck in attention is memory bandwidth, not FLOPs. This makes long-sequence [[Transformer]] models practical without changing the [[Attention Mechanism]] math.
