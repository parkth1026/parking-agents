# Process Log

## Task

Answer two questions strictly from the pre-existing wiki in `<outputs>\wiki`:
1. How does the attention mechanism's cost scale, and what did Flash Attention change about it?
2. What does the wiki say about Mamba or RWKV?

## Steps

1. **Surveyed the wiki structure.** Listed all files under `<outputs>\wiki`. Found a small wiki: 6 concept pages (`concepts/`), plus `index.md`, `log.md`, `SCHEMA.md`. This told me the read budget was tiny — full reads were feasible.

2. **Read the index first.** `index.md` cataloged the six pages and their one-line descriptions, confirming which pages were relevant to question 1 (Attention Mechanism, Flash Attention, Transformer) and hinting there was no Mamba/RWKV page.

3. **Searched exhaustively for question 2 before concluding absence.** Ran a case-insensitive full-text `grep` across the entire wiki for `mamba|rwkv|state space|ssm` → **no matches**. Followed up with a broader sweep for adjacent terms (`rnn|recurren|linear attention|subquadratic|quadratic`) → only two hits, both on unrelated pages (the O(N²) note in Attention Mechanism; "replacing recurrence" in Transformer). This ruled out hidden mentions in any file, including `log.md`.

4. **Read the two key pages in full** for question 1:
   - `concepts/Attention Mechanism.md` — the "Cost Scaling" section gives the O(N²) memory growth of the naive N×N materialization.
   - `concepts/Flash Attention.md` — gives the IO-aware/exact framing, O(N²)→O(N) memory via tiling, 2–4x PyTorch speedup, FlashAttention-2 thread-block partitioning, and the "memory bandwidth, not FLOPs" key insight.

5. **Read supporting/context files** to double-check question 2 and enrich question 1: `concepts/Transformer.md` (confirms Flash Attention is what makes long-sequence variants tractable; contains the "replacing recurrence" note), `log.md` (only two ingests ever: "Attention Is All You Need" and a Flash Attention article — proves no Mamba/RWKV source exists), and `SCHEMA.md` (confirmed the domain/tag taxonomy has no alternative-architecture entries).

6. **Wrote the final answer** verbatim to `<outputs>\answer.md`, citing wiki pages as `[[wikilinks]]` to mirror the wiki's own convention, and clearly separating evidence-backed statements from the explicit "not covered" finding for Mamba/RWKV.

## Why this approach

- The wiki is tiny, so exhaustive full-text search + reading every potentially relevant page was cheap and gave certainty — important because question 2's honest answer is "the wiki says nothing," which should only be claimed after a verifiable exhaustive search (index + grep + ingest log triangulation).
- No files were created outside `<outputs>`; no web search was used; no restricted directories (`.agents/skills/`, other iterations, etc.) were read.
