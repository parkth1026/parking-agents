# Process Log — wiki query run (without_skill / run-2)

Date: 2026-08-18
Sandbox: `.../iteration-5/eval-query/without_skill/run-2/outputs/` (all reads/writes stayed inside this directory)

## Steps

1. **Inventory the wiki.** Listed every file under `outputs/wiki/` with `find`. Found a small wiki: `index.md`, `log.md`, `SCHEMA.md`, and six concept pages under `concepts/` (Attention Mechanism, Fine-Tuning, Flash Attention, Neural Network, Pretraining, Transformer). No `sources/` entries.

2. **Read the routing + directly relevant pages.** Read `index.md` (page catalog), `concepts/Attention Mechanism.md`, and `concepts/Flash Attention.md` in parallel — these are the two pages question (1) targets. Key facts found: naive attention materializes the full N-by-N matrix → O(N²) memory in sequence length; Flash Attention tiles the computation, never materializes the matrix, cuts memory to O(N), 2–4x wall-clock speedup, FlashAttention-2 improves thread-block partitioning, bottleneck is memory bandwidth not FLOPs, exact same math.

3. **Search exhaustively for Mamba/RWKV (question 2).** Ran `grep -rni` over the whole wiki for: `mamba`, `rwkv`, `state space`, `ssm`, `linear attention`, `recurren`. Single hit: `concepts/Transformer.md` line 11 — "built entirely on [[Attention Mechanism]], replacing recurrence". Conclusion: the wiki has **zero direct coverage** of Mamba or RWKV.

4. **Verify no missed attention-related content.** Read `Transformer.md` in full and grepped all pages for `attention|flash` excluding the two main pages — only cross-references in `index.md`, `log.md`, `Neural Network.md`, and `Pretraining.md` (source attribution), none adding new cost/scaling facts. Also scanned `Fine-Tuning.md` implicitly via the greps (no hits).

5. **Compose the answer.** Grounded strictly in wiki content with per-page attribution. For (2), answered honestly that the wiki says nothing about Mamba/RWKV, quoted the one tangentially related line, and suggested where such pages would link in if the user wants them added.

6. **Write outputs.** Saved the final answer verbatim to `outputs/answer.md`, then this process log to `outputs/process-log.md`.

## Why this approach

The wiki is tiny (9 files), so full enumeration + targeted reads + exhaustive grep is both faster and more reliable than any indexing tooling. The negative result for Mamba/RWKV required proving absence, hence the multi-term grep (alternate names: SSM, state space, linear attention, recurrence) rather than a single keyword search.

## Source pages used

- `wiki/index.md` (catalog / completeness check)
- `wiki/concepts/Attention Mechanism.md` (O(N²) cost scaling)
- `wiki/concepts/Flash Attention.md` (what Flash Attention changed)
- `wiki/concepts/Transformer.md` (cross-reference, "replacing recurrence")
- Negative search across: `Fine-Tuning.md`, `Neural Network.md`, `Pretraining.md`, `log.md`, `SCHEMA.md`
