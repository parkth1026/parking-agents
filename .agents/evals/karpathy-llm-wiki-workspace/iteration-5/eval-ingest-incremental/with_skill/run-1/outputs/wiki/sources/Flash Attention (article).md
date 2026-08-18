---
title: "Flash Attention (article)"
created: 2026-08-18
updated: 2026-08-18
type: source
tags: [paper, attention]
sources: []
---
# Flash Attention (article)

> **Authors**: unknown (user-provided article; subject work by Tri Dao) | **Year**: unknown | **Type**: Article
> **URL**: n/a — provided as text; raw copy at `wiki-raw/articles/2026-08-18-flash-attention.md`

## Key Takeaways

- Flash Attention (Tri Dao) is an IO-aware **exact** attention algorithm — it reduces memory from O(N^2) to O(N) by tiling the computation and never materializing the full attention matrix.
- It achieves 2-4x wall-clock speedup over standard attention in PyTorch.
- FlashAttention-2 further improves performance with better work partitioning across GPU thread blocks.
- Key insight: the bottleneck in attention is memory bandwidth, not FLOPs.

## Concepts Introduced or Covered

- [[Flash Attention]] — the article's central subject
- [[Tri Dao]] — creator of Flash Attention / FlashAttention-2
- [[Attention Mechanism]] — the computation being optimized
- [[Transformer]] — the architecture whose self-attention layers benefit

## Critical Notes

- Short summary with no benchmarks, citations, or links; the quantitative claims (O(N) memory, 2-4x speedup) are taken as reported by the article.
