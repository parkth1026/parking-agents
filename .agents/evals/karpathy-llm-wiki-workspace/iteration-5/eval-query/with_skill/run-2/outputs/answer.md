# Answers from your LLM wiki

## (1) How does the attention mechanism's cost scale, and what did Flash Attention change about it?

**Cost scaling.** The naive implementation materializes the full N-by-N attention matrix, so memory grows **quadratically with sequence length — O(N²)**. Per [[Attention Mechanism]], this quadratic memory is "the main cost barrier for long sequences" in a [[Transformer]].

**What Flash Attention changed.** Per [[Flash Attention]]:
- It is **IO-aware exact attention** (by Tri Dao): the same mathematical result as standard attention, with radically cheaper memory traffic.
- It **tiles the computation and never materializes the full attention matrix**, cutting memory from **O(N²) to O(N)** in sequence length, and delivering a **2–4× wall-clock speedup** over standard attention in PyTorch. FlashAttention-2 further improves work partitioning across GPU thread blocks.
- Key insight: the bottleneck in attention is **memory bandwidth, not FLOPs**.
- Net effect: long-sequence [[Transformer]] models become practical **without changing the [[Attention Mechanism]] math** — long-sequence variants lean on Flash Attention for tractable memory.

In short: the wiki frames the change as a memory/IO change, not a math change — same exact attention, but O(N) memory instead of O(N²) and far less memory traffic.

## (2) What does the wiki say about Mamba or RWKV?

**Your wiki does not cover Mamba or RWKV.** I checked `index.md` (no matching pages) and searched the entire wiki for "mamba", "rwkv", "ssm", "state-space", "recurrent", and "linear attention" — zero matches. The only adjacent note is that the Transformer is "built entirely on [[Attention Mechanism]], replacing recurrence", which is about the Transformer itself, not about recurrent/state-space alternatives like Mamba or RWKV.

Per the wiki's honesty rule I won't make up an answer: if you'd like this covered, a good next step is to **ingest the Mamba paper** ("Mamba: Linear-Time Sequence Modeling with Selective State Spaces") **and/or RWKV material**, after which the wiki can grow `Mamba` / `RWKV` pages and a comparison page (e.g., "Attention vs SSM").

---
*Pages consulted: Attention Mechanism, Flash Attention, Transformer (wiki validation after query: PASS, 10.00/10).*
