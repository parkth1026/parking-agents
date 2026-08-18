# Wiki Log

> Append-only record of all wiki operations. Most recent entries at the bottom.

| Date | Operation | Details |
|------|-----------|---------|
| 2026-08-14 | Lint | Baseline validation: 6.1/10 (FAIL). Issues: broken link Transformer→[[Ghost Network]]; self-reference in Transformer; orphan pages (Orphan Concept, Big Source); 3 pages missing from index (Neural Network, Orphan Concept, Big Source); Neural Network missing frontmatter; Big Source oversized (219 lines > 200); Neural Network under-linked (0 < 2); invalid tag 'transformer-arch' in Transformer (not in SCHEMA.md). |
| 2026-08-14 | Fix | Removed broken [[Ghost Network]] link (single mention, no supporting source — not page-worthy) and [[Transformer]] self-link; retagged Transformer 'transformer-arch'→'architecture' (existing schema tag); added full YAML frontmatter (title/created/updated/type/tags/sources) and 2 outbound links to Neural Network; added Related sections linking to Orphan Concept and Big Source from Transformer/Neural Network to resolve orphans; trimmed Big Source filler padding (219→10 lines, padding held no knowledge so a split sub-page was not justified); indexed all pages in index.md (added Sources section). |
| 2026-08-14 | Lint | Re-validation after fixes: 10/10 (PASS), 0 broken links, all 8 dimensions 10/10. |
