# Answers from the LLM Wiki

## (1) How does the attention mechanism's cost scale, and what did Flash Attention change?

**Cost scaling — quadratic in sequence length.**
Per the [[Attention Mechanism]] page ("Cost Scaling"): the naive implementation materializes the full N-by-N attention matrix, so memory grows **quadratically** with sequence length — **O(N²)**. The wiki calls this "the main cost barrier for long sequences in a [[Transformer]]."

**What Flash Attention changed — the cost profile, not the math.**
Per the [[Flash Attention]] page:

- It is **IO-aware exact attention** (by Tri Dao): it produces the **same mathematical result** as standard attention — no approximation — but with radically cheaper memory traffic.
- It **tiles the computation and never materializes the full attention matrix**, cutting memory from **O(N²) to O(N)** in sequence length.
- Practical effect: **2–4x wall-clock speedup** over standard attention in PyTorch; FlashAttention-2 further improves work partitioning across GPU thread blocks.
- **Key insight**: the bottleneck in attention is **memory bandwidth, not FLOPs**. This makes long-sequence Transformer models practical **without changing the Attention Mechanism math**.

Supporting context from the [[Transformer]] page: "long-sequence variants lean on [[Flash Attention]] for tractable memory."

## (2) What does the wiki say about Mamba or RWKV?

**Nothing.** The wiki contains no mention of Mamba, RWKV, state-space models, or any attention-alternative architecture. This was verified three ways:

1. **Full-text search** across every wiki file for "Mamba", "RWKV", "state space", "SSM", and "RNN" returned zero matches.
2. **The index** (`index.md`) lists exactly six pages — Attention Mechanism, Flash Attention, Transformer, Neural Network, Pretraining, Fine-Tuning — none covering alternative sequence architectures.
3. **The ingest log** (`log.md`) records only two sources ever ingested: "Attention Is All You Need" (2026-08-10) and a Flash Attention article (2026-08-11) — no Mamba or RWKV source exists in the wiki.

The closest related statement is in the [[Transformer]] page, which notes the Transformer was built on attention "**replacing recurrence**" — so the wiki acknowledges recurrent predecessor architectures conceptually, but has no page or note on Mamba, RWKV, or their state-space/linear-recurrence approach.
