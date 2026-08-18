---
title: "Flash Attention"
created: 2026-08-18
updated: 2026-08-18
type: source
tags: [paper, attention]
sources: []
---
# Flash Attention

> **Authors**: Tri Dao (subject) | **Year**: not stated in source text | **Type**: Article (user-provided summary)
> **URL**: none — provided as inline text

## Key Takeaways

- FlashAttention is an IO-aware exact attention algorithm: exact output, radically fewer memory reads/writes
- Memory goes from O(N^2) to O(N) by tiling the computation and avoiding materializing the full attention matrix
- Achieves 2-4x wall-clock speedup over standard attention in PyTorch
- FlashAttention-2 further improves this with better work partitioning across GPU thread blocks
- Key insight: the bottleneck in attention is memory bandwidth, not FLOPs

## Concepts Introduced or Covered

- [[FlashAttention]] — the algorithm this article is about
- [[Attention Mechanism]] — the computation being optimized
- [[Transformer]] — the architecture that benefits

## Notable Quotes

> "Key insight: the bottleneck in attention is memory bandwidth, not FLOPs."

## Critical Notes

- Short user-provided text; no URL, venue, or publication date given. Details beyond the source text are not asserted here; see [[FlashAttention]] for the compiled view.
