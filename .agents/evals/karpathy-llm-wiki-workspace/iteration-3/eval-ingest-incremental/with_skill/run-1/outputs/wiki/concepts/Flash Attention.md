---
title: "Flash Attention"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [attention, core-concept]
sources: ["Flash Attention Overview"]
---
# Flash Attention

An IO-aware, exact (non-approximate) implementation of the [[Attention Mechanism]], introduced by [[Tri Dao]]. It reduces attention memory from O(N^2) to O(N) and achieves a 2-4x wall-clock speedup over standard attention in PyTorch.

## How It Works
- Standard attention materializes the full N x N attention matrix; Flash Attention instead **tiles** the computation so the matrix is never fully written out, cutting memory from O(N^2) to O(N).
- The algorithm is **exact** — it computes the same result as standard attention, only with a different memory access pattern.
- Key insight: attention is bottlenecked by **memory bandwidth, not FLOPs**, so reducing memory traffic matters more than reducing arithmetic.

## Variants
- **FlashAttention-2** — improves work partitioning across GPU thread blocks, raising utilization further.

## History
- Introduced by Tri Dao as an IO-aware rethinking of the attention kernel; FlashAttention-2 later refined it with better work partitioning across GPU thread blocks.

## Related
- [[Attention Mechanism]] — the computation Flash Attention accelerates
- [[Transformer]] — whose practical efficiency at long context depends on attention kernels like this
- [[Flash Attention Overview]] — ingested source summary
