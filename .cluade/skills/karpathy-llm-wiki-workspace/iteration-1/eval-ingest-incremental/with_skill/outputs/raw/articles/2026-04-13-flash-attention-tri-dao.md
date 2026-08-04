---
title: "Flash Attention by Tri Dao"
url: ""
author: "Tri Dao"
date: "2022"
ingested: "2026-04-13"
---

Flash Attention by Tri Dao introduces an IO-aware exact attention algorithm that reduces memory from O(N^2) to O(N) by tiling the computation and avoiding materializing the full attention matrix. It achieves 2-4x wall-clock speedup over standard attention in PyTorch. FlashAttention-2 further improves this with better work partitioning across GPU thread blocks. Key insight: the bottleneck in attention is memory bandwidth, not FLOPs.
