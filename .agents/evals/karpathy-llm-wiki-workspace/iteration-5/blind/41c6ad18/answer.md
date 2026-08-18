# Answers from the LLM Wiki

## (1) How does the attention mechanism's cost scale, and what did Flash Attention change?

**Cost scaling — quadratic in sequence length.**
The wiki's [[Attention Mechanism]] page states that the naive implementation materializes the full N-by-N attention matrix, so memory grows **quadratically** with sequence length — O(N²). The page calls this "the main cost barrier for long sequences" in a [[Transformer]]. Mechanically, attention works by query/key/value dot products producing a distribution over positions that mixes the value vectors; it is that full pairwise (every-token-to-every-token) matrix that makes cost blow up as sequences get longer.

**What Flash Attention changed — memory traffic, not the math.**
Per the [[Flash Attention]] page (attributed to Tri Dao):

- It is **IO-aware exact attention**: it produces the *same mathematical result* as standard attention but with radically cheaper memory traffic.
- It **tiles the computation and never materializes the full attention matrix**, cutting memory from O(N²) to **O(N)** in sequence length, with a **2–4x wall-clock speedup** over standard attention in PyTorch.
- **FlashAttention-2** improves work partitioning across GPU thread blocks.
- The **key insight** is that the bottleneck in attention is memory bandwidth, not FLOPs. This makes long-sequence Transformer models practical **without changing the attention math**.

The [[Transformer]] page corroborates the framing: "long-sequence variants lean on [[Flash Attention]] for tractable memory."

In short: naive attention scales as O(N²) memory because it materializes the full N×N matrix; Flash Attention kept the math exact but restructured the computation (tiling, no full-matrix materialization) to get O(N) memory and a 2–4x speedup by attacking memory-bandwidth cost.

## (2) What does the wiki say about Mamba or RWKV?

**Nothing.** The wiki contains no page, section, or passing mention of Mamba, RWKV, SSMs/state-space models, or any other alternative/linear-attention architecture. I verified this two ways:

- Read every file in the wiki (6 concept pages plus index, log, and schema).
- Ran a case-insensitive search across all wiki files for `mamba`, `rwkv`, `ssm`, and `state-space` — zero matches.

The wiki's full coverage is: Attention Mechanism, Flash Attention, Transformer, Neural Network, Pretraining, and Fine-Tuning. The log shows only two ingests to date — the "Attention Is All You Need" paper and a Flash Attention article — so the knowledge base simply hasn't been extended to recurrent/state-space alternatives yet.

The closest adjacent statement in the wiki is on the [[Transformer]] page, which notes that the Transformer is an attention-based architecture "replacing recurrence" — i.e., the wiki discusses what recurrence was replaced *by*, but never discusses post-Transformer recurrent alternatives like Mamba or RWKV themselves.

Sources (wiki pages): `wiki/concepts/Attention Mechanism.md`, `wiki/concepts/Flash Attention.md`, `wiki/concepts/Transformer.md`, `wiki/index.md`, `wiki/log.md`.
