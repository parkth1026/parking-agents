---
title: "Flash Attention Overview"
created: 2026-08-18
updated: 2026-08-18
type: source
tags: [paper, attention]
sources: []
---
# Flash Attention Overview

> **Authors**: unattributed summary (subject: Tri Dao's FlashAttention) | **Year**: unknown | **Type**: Article (user-provided)
> **URL**: n/a (provided as text)

## Key Takeaways
- [[Flash Attention]] by [[Tri Dao]] is an **IO-aware exact attention algorithm**: same result as standard attention, far less memory traffic
- Memory drops from **O(N^2) to O(N)** by tiling the computation and never materializing the full attention matrix
- Achieves a **2-4x wall-clock speedup** over standard attention in PyTorch
- **FlashAttention-2** improves on it with better work partitioning across GPU thread blocks
- Key insight: the bottleneck in attention is **memory bandwidth, not FLOPs**

## Concepts Introduced or Covered
- [[Flash Attention]] — the central subject
- [[Attention Mechanism]] — the computation being optimized
- [[Transformer]] — the architecture that benefits

## Critical Notes
- Short summary covering both FlashAttention and FlashAttention-2 at a high level; no publication date, URL, or venue provided for the underlying papers.
