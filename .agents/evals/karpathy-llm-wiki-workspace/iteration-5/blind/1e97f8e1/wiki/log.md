# Wiki Log

> Append-only record of all wiki operations. Most recent entries at the bottom.

| Date | Operation | Details |
|------|-----------|---------|
| 2026-08-10 | ingest | "Attention Is All You Need" — created Transformer, Attention Mechanism; updated Neural Network |
| 2026-08-18 | lint | Baseline validate: 8.52/10 FAIL (1 broken link, 1 orphan, 1 missing frontmatter, 1 missing from index, 1 under-linked). Fixes: Big Source.md — removed [[Ghost Network]] wikilink (kept as plain text; target fails page-creation threshold, dead-link strategy "remove link"); Orphan Concept.md — retro-filled frontmatter (created date unknown, set to 2026-08-18) and indexed it (index link counts as inbound per indexCountsAsInbound=true); Neural Network.md — added [[Big Source]] outbound link (was 1, min 2). Autonomy notes (batch mode, no user available): kept Orphan Concept stub rather than merging/deleting — nothing to merge and deletion is destructive; recommend user review it for possible removal. Phase 0: created missing rawDir (wiki-raw) per SKILL.md batch-mode authorization clause. Post-fix validate: 10/10 PASS, broken links 0. |
