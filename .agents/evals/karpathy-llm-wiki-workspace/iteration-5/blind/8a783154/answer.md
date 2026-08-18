# Answers from your LLM wiki

## (1) How does the attention mechanism's cost scale, and what did Flash Attention change about it?

**Cost scaling.** Per your wiki's *Attention Mechanism* page, the naive implementation materializes the full **N-by-N attention matrix**, so memory grows **quadratically with sequence length — O(N²)**. Your wiki calls this "the main cost barrier for long sequences in a Transformer."

**What Flash Attention changed.** Per your *Flash Attention* page:

- It is **IO-aware exact attention by Tri Dao**: it computes the *same mathematical result* as standard attention but with radically cheaper memory traffic.
- It **tiles the computation and never materializes the full attention matrix**, cutting memory from **O(N²) to O(N)** in sequence length, and delivering a **2–4x wall-clock speedup** over standard attention in PyTorch.
- **FlashAttention-2** further improves work partitioning across GPU thread blocks.
- **Key insight your wiki records:** the bottleneck in attention is **memory bandwidth, not FLOPs**. This is what makes long-sequence Transformer models practical — without changing the attention math at all.

(Cross-referenced from your *Transformer* page: "long-sequence variants lean on Flash Attention for tractable memory.")

## (2) What does my wiki say about Mamba or RWKV?

**Nothing, directly.** Your wiki currently has no page for Mamba, RWKV, state-space models, or any recurrent/linear-attention alternative. I searched every page for "Mamba", "RWKV", "state space", "SSM", "linear attention", and "recurrence" — the only hit is on the *Transformer* page:

> "Sequence-to-sequence architecture built entirely on attention, **replacing recurrence**..."

That's the closest related content: your wiki notes the Transformer *replaced recurrence*, which is the architectural family Mamba/RWKV revive — but neither is named anywhere in the wiki. Your index lists exactly six concept pages: Attention Mechanism, Flash Attention, Transformer, Neural Network, Pretraining, Fine-Tuning.

If you want Mamba/RWKV covered, they'd slot in naturally as new concept pages linked from *Transformer* (as recurrence-based alternatives to attention) and from *Attention Mechanism* (as attempts to escape the O(N²) barrier from a different direction than Flash Attention).
