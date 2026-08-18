# Wiki Log

> Append-only record of all wiki operations. Most recent entries at the bottom.

| Date | Operation | Details |
|------|-----------|---------|
| 2026-08-10 | ingest | "Attention Is All You Need" — created Transformer, Attention Mechanism; updated Neural Network |
| 2026-08-18 | lint | validate-wiki v5 before: 8.52/10 FAIL (1 broken link, 1 orphan, 1 missing-from-index, 1 missing frontmatter, 1 under-linked). Fixes: Big Source.md — removed broken [[Ghost Network]] wikilink (kept as plain text; recorded as pending-page candidate, fails creation threshold: obscure, single-source mention); Orphan Concept.md — retro-filled frontmatter (created date not determinable, used 2026-08-18; retro-fill note per SKILL.md), tags [core-concept]; Neural Network.md — added Related section with [[Big Source]] outbound link (was 1/2 min); Orphan Concept added to index.md (index counts as inbound). Autonomous decisions (batch mode, no user available): (1) rawDir wiki-raw missing and NOT created — Lint reads/writes no raw sources; (2) Orphan Concept normalized rather than deleted or merged — deletion not in the skill's fix menu and content has no natural parent page; (3) log discrepancy flagged, not auto-repaired — 2026-08-10 ingest entry records an "Attention Mechanism" page that does not exist on disk; no inbound links exist so it is invisible to the validator; not recreated to avoid fabricating unsourced content. |
| 2026-08-18 | lint | validate-wiki v5 after: 10.00/10 PASS (exit 0). All 8 dimensions 10/10; broken links 0; no loop iterations needed beyond the first fix pass. |
