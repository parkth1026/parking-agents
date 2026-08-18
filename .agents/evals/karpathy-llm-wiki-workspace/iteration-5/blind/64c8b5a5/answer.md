# Answer

## (1) How does the attention mechanism's cost scale, and what did Flash Attention change?

**Cost scaling.** Per [[Attention Mechanism]] (Cost Scaling section): the naive implementation materializes the full N-by-N attention matrix, so memory grows **quadratically with sequence length (O(N^2))**. This quadratic memory is the main cost barrier for long sequences in a [[Transformer]].

**What Flash Attention changed.** Per [[Flash Attention]]:
- It is an IO-aware, **exact** attention implementation by Tri Dao — same mathematical result as standard attention, radically cheaper memory traffic.
- It tiles the computation and **never materializes the full attention matrix**, cutting memory from O(N^2) to **O(N)** in sequence length.
- This yields a **2-4x wall-clock speedup** over standard attention in PyTorch; FlashAttention-2 further improves work partitioning across GPU thread blocks.
- Key insight: the real bottleneck in attention is **memory bandwidth, not FLOPs**. This makes long-sequence [[Transformer]] models practical without changing the [[Attention Mechanism]] math.

In short: attention's cost was quadratic (O(N^2)) in memory because the whole attention matrix had to be materialized; Flash Attention kept the math identical but restructured the computation (tiling, no full-matrix materialization) to get O(N) memory and 2-4x speedups, by targeting memory-bandwidth rather than FLOP cost.

## (2) What does the wiki say about Mamba or RWKV?

**Nothing.** No page for Mamba or RWKV exists in the wiki, and a full-text search across all wiki pages for "Mamba" and "RWKV" (plus related terms: state space, SSM, linear attention) returns zero hits. The only adjacent statement is on [[Transformer]], which notes that the Transformer is "built entirely on [[Attention Mechanism]], replacing recurrence" — the wiki frames recurrence as what attention-based architectures replaced, but Mamba and RWKV themselves are not covered anywhere.

Rather than making up an answer: if you want Mamba/RWKV in the wiki, a good next step would be ingesting the Mamba paper and/or RWKV paper (the skill's Ingest operation), which would create the corresponding concept and source pages.

---
*Answered via the karpathy-llm-wiki skill, Query operation. Pages consulted: Attention Mechanism, Flash Attention, Transformer (plus index.md/SCHEMA.md/log.md orientation). Not archived to queries/ (simple lookup; batch-mode autonomous decision, recorded in log.md).*
