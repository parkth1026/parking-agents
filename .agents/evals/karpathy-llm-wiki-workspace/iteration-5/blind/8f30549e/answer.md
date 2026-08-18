# Wiki Query Results (2026-08-18)

## (1) How does attention's cost scale, and what did Flash Attention change?

**Cost scaling — quadratic.** The naive attention implementation materializes the full N-by-N attention matrix (query/key/value dot products produce a distribution over positions, used to mix value vectors), so memory grows **quadratically with sequence length, O(N²)**. The wiki calls this "the main cost barrier for long sequences" in a Transformer ([[Attention Mechanism]]).

**What Flash Attention changed — memory, not math.** [[Flash Attention]] (IO-aware exact attention by Tri Dao) leaves the mathematics of attention unchanged and attacks the memory traffic instead:

- **Exact, not approximate**: it produces the same mathematical result as standard attention.
- **O(N²) → O(N) memory**: it tiles the computation and never materializes the full attention matrix, cutting memory to **linear** in sequence length.
- **2–4× wall-clock speedup** over standard attention in PyTorch; FlashAttention-2 improves work partitioning across GPU thread blocks.
- **Key insight**: the bottleneck in attention is **memory bandwidth, not FLOPs** — which is why reducing IO traffic (rather than FLOPs) is what makes long-sequence Transformer models practical without changing the attention math ([[Flash Attention]]). [[Transformer]] also notes that long-sequence variants "lean on Flash Attention for tractable memory."

## (2) What does the wiki say about Mamba or RWKV?

**Nothing — the wiki does not cover either.** There are no pages for Mamba or RWKV, no index entries, and a full-text search of the wiki for "Mamba", "RWKV", "recurrence/recurrent", "state space", and "SSM" returned zero hits. The only tangentially related statement is on [[Transformer]]: it is "built entirely on [[Attention Mechanism]], **replacing recurrence**" — i.e., the wiki mentions recurrence only as the thing Transformers replaced, and records nothing about recurrent/state-space alternatives such as Mamba or RWKV.

If you'd like the wiki to cover them, the recommended next step is to ingest a source (e.g., the Mamba or RWKV paper) rather than answer from outside the wiki — this answer is drawn only from wiki pages.
