# Flash Attention (source text)

> Verbatim article provided by the user on 2026-08-18, ingested into the wiki as [[Flash Attention]].

Flash Attention by Tri Dao introduces an IO-aware exact attention algorithm that reduces memory from O(N^2) to O(N) by tiling the computation and avoiding materializing the full attention matrix. It achieves 2-4x wall-clock speedup over standard attention in PyTorch. FlashAttention-2 further improves this with better work partitioning across GPU thread blocks. Key insight: the bottleneck in attention is memory bandwidth, not FLOPs.
