# Wiki Log

> Append-only record of all wiki operations. Most recent entries at the bottom.

| Date | Operation | Details |
|------|-----------|---------|
| 2026-08-10 | ingest | "Attention Is All You Need" — created Transformer, Attention Mechanism; updated Neural Network |
| 2026-08-18 | ingest | "FlashAttention (article)" (raw: wiki-raw/articles/2026-08-18-flash-attention.md) — batch mode: takeaway discussion with user auto-passed (4 takeaways derived: exact IO-aware attention O(N^2)→O(N) via tiling; 2-4x speedup in PyTorch; FlashAttention-2 work partitioning; memory-bandwidth-not-FLOPs insight). Autonomous decisions: created missing rawDir and wiki/sources/ per batch authorization (SKILL.md Phase 0); source page disambiguated to "FlashAttention (article)" to avoid basename collision with concept "FlashAttention". Created concepts/FlashAttention, sources/FlashAttention (article); updated Attention Mechanism (new variant + inbound link), Transformer (efficiency key idea + inbound link); SCHEMA.md tags +inference +hardware +blog. Pending page candidates (1 mention each): Tri Dao (person), PyTorch (entity), FlashAttention-2, Memory Bandwidth / memory hierarchy. |
| 2026-08-18 | lint | validate-wiki.mjs after FlashAttention ingest: 5 pages, 0 broken links, all 8 dimensions 10/10, total 10.00/10 — PASS (threshold 9.0). No fixes needed. |
