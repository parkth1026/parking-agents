---
title: "Flash Attention Article"
created: 2026-04-13
updated: 2026-04-13
type: source
tags: [paper, attention, optimization]
sources: []
---

# Flash Attention Article

> Author: Tri Dao | Year: 2022 | Type: Article/Paper Summary

## Key Takeaways

- Flash Attention is an **IO-aware exact attention algorithm** — produces identical
  results to standard attention, but with different memory access patterns
- Memory complexity reduced from **O(N²) to O(N)** by tiling computation and
  never materializing the full N×N attention matrix
- Achieves **2-4x wall-clock speedup** over standard PyTorch attention (v1)
- The fundamental bottleneck in [[Attention Mechanism]] is **memory bandwidth**, not FLOPs
- **FlashAttention-2** further improves performance via better work partitioning
  across GPU thread blocks

## Concepts Introduced

- [[Flash Attention]] — the IO-aware tiled attention algorithm
- [[Attention Mechanism]] — context: the standard attention this improves upon
- [[Transformer]] — context: the architecture Flash Attention accelerates

## Core Insight

Modern GPUs have a memory hierarchy: large slow HBM vs. small fast SRAM.
Standard attention is bottlenecked by HBM bandwidth because it reads/writes
the N×N attention matrix repeatedly. Flash Attention tiles computation to keep
intermediate results in SRAM, reducing HBM traffic dramatically.

## Versions

- **FlashAttention v1** (NeurIPS 2022): 2-4x speedup, O(N) memory
- **FlashAttention v2** (2023): better thread-block partitioning, higher GPU utilization
