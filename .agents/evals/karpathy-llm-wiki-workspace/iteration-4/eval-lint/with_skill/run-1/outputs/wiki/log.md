# Wiki Log

> Append-only record of all wiki operations. Most recent entries at the bottom.

| Date | Operation | Details |
|------|-----------|---------|
| 2026-08-10 | ingest | "Attention Is All You Need" — created Transformer, Attention Mechanism; updated Neural Network |
| 2026-08-18 | lint | validate-wiki v5: 8.52/10 FAIL -> 10.00/10 PASS. Fixes: (1) broken link — Big Source.md [[Ghost Network]] converted to plain text (fails page-creation threshold: 1 source, obscure; recorded as pending page candidate — create when a 2nd source mentions it); (2) Orphan Concept.md frontmatter retro-filled (original creation date not determinable, used 2026-08-18) and added to index.md (catalog link counts as inbound per scoring.indexCountsAsInbound=true); (3) Neural Network.md added Related section with [[Big Source]] (was under-linked: 1 outbound < 2). Batch-mode autonomous decisions: rawDir missing and not created (lint requires only wikiDir); no user discussion held. |
