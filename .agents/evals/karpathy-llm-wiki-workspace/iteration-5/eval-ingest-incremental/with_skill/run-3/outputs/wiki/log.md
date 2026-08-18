# Wiki Log

> Append-only record of all wiki operations. Most recent entries at the bottom.

| Date | Operation | Details |
|------|-----------|---------|
| 2026-08-10 | ingest | "Attention Is All You Need" — created Transformer, Attention Mechanism; updated Neural Network |
| 2026-08-18 | ingest | "Flash Attention" (user-provided article, no URL; raw at wiki-raw/articles/2026-08-18-flash-attention.md). Batch mode: takeaway discussion step auto-passed. Derived takeaways: (1) IO-aware exact attention algorithm by Tri Dao; (2) memory O(N^2) to O(N) via tiling, never materializing the full attention matrix; (3) 2-4x wall-clock speedup over standard attention in PyTorch; (4) FlashAttention-2 improves work partitioning across GPU thread blocks; (5) bottleneck is memory bandwidth, not FLOPs. Created: sources/Flash Attention, concepts/FlashAttention, entities/Tri Dao. Updated: Attention Mechanism (FlashAttention variant + bandwidth note), Transformer (efficient-attention bullet). SCHEMA.md: added tags inference, hardware, person (synced from references/tagging-taxonomy.md). Dirs created under batch-mode implied authorization per SKILL.md Phase 0: wiki-raw/, entities/, sources/ (rawDir was configured but missing). Pending page candidates: PyTorch (tool entity, 1 source), Memory Bandwidth / IO-awareness (concept, 1 source). |
