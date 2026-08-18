# Process Log

## Task

Answer two questions strictly from the pre-existing wiki at `outputs/wiki`:
1. How does the attention mechanism's cost scale, and what did Flash Attention change?
2. What does the wiki say about Mamba or RWKV?

Constraints honored: worked only inside `outputs`; read no skill, eval, or other iteration directories; used no web search — wiki content only. No wiki files were modified (read-only query run).

## Steps

1. **Inventory the wiki.** Listed all files under `outputs/` with `find`. Result: 6 concept pages (`Attention Mechanism`, `Fine-Tuning`, `Flash Attention`, `Neural Network`, `Pretraining`, `Transformer`) plus `index.md`, `log.md`, `SCHEMA.md`. Small enough to read exhaustively.
2. **Read the index** to confirm the catalog and spot the pages relevant to Q1 (`Attention Mechanism`, `Flash Attention`, `Transformer`).
3. **Read `Attention Mechanism.md` and `Flash Attention.md`** — these directly answer Q1: naive attention materializes the full N×N matrix → O(N²) memory, the "main cost barrier for long sequences"; Flash Attention is IO-aware exact attention that tiles the computation and never materializes the full matrix → O(N) memory, 2–4x wall-clock speedup, FlashAttention-2 improves thread-block partitioning, and the key insight is that the bottleneck is memory bandwidth, not FLOPs.
4. **Search for Mamba/RWKV (Q2).** Ran case-insensitive grep across the whole wiki tree for `mamba|rwkv|ssm|state-space` — zero matches.
5. **Read all remaining pages** (`Transformer`, `Neural Network`, `Pretraining`, `Fine-Tuning`, `log.md`, `SCHEMA.md`) for two reasons: (a) catch indirect discussion of alternative architectures (e.g., recurrence, linear attention) that grep keywords might miss; (b) confirm from `log.md`/`index.md` what the wiki has actually ingested. Findings: the only adjacent statement is Transformer's note that it "replaces recurrence"; the log shows just two ingests (Attention Is All You Need; Flash Attention article), confirming Mamba/RWKV were never covered.
6. **Wrote the final answer** verbatim to `outputs/answer.md`, citing the specific wiki pages for each claim and reporting the verified absence (exhaustive read + grep) for Mamba/RWKV rather than filling the gap with outside knowledge.

## Why this approach

The wiki is 9 files, so exhaustive reading was cheaper and more reliable than keyword-only search, and it guards against false negatives for Q2 (a page could discuss recurrent alternatives without naming Mamba/RWKV). The grep complemented the read to make the "not covered" claim defensible. All answer content is traceable to specific wiki pages; the one clearly-labeled inference is the negative finding for Q2, backed by both the full read and the keyword search.
