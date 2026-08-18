---
title: "FlashAttention (article)"
created: 2026-08-18
updated: 2026-08-18
type: source
tags: [blog, attention]
sources: []
---
# FlashAttention (article)

> **Authors**: Unattributed user-provided summary; subject work by Tri Dao | **Year**: unknown | **Type**: Article
> **URL**: not provided — ingested verbatim from a user message
> **Raw file**: `wiki-raw/articles/2026-08-18-flash-attention.md`

## Key Takeaways
- FlashAttention is an IO-aware **exact** attention algorithm: same results as standard attention, but memory drops from O(N^2) to O(N) via tiling and never materializing the full attention matrix.
- It achieves 2-4x wall-clock speedup over standard attention in PyTorch.
- FlashAttention-2 improves on it with better work partitioning across GPU thread blocks.
- Key insight: the bottleneck in attention is memory bandwidth, not FLOPs.

## Concepts Introduced or Covered
- [[FlashAttention]] — the algorithm this article is about
- [[Attention Mechanism]] — the underlying computation being optimized
- [[Transformer]] — the architecture whose long-sequence efficiency benefits

## Critical Notes
- One-paragraph summary with no URL, author, or publication date; benchmark details are not included. Named entities (Tri Dao, PyTorch, FlashAttention-2) are recorded as plain text pending a second source.
