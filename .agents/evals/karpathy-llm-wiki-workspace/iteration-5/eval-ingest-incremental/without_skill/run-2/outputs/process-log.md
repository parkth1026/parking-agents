# Process Log — eval-ingest-incremental / without_skill / run-2

Date: 2026-08-18. Task: ingest a Flash Attention article into the existing wiki and connect it to the pages about attention and transformers.

## 1. Surveyed the existing wiki

Listed `outputs\wiki` (the `wiki-raw` directory referenced by the harness does not exist in this sandbox; the article text came entirely from the user message). Found:

- `SCHEMA.md` — domain, tag taxonomy (core / models / techniques / meta), conventions: Title Case page names, kebab-case tags, YYYY-MM-DD dates
- `index.md` — auto-maintained catalog, one line per page under `## Concepts`, plus an empty `## Sources` section
- `log.md` — append-only table of operations; prior entry showed the ingest pattern used for "Attention Is All You Need"
- `concepts/Attention Mechanism.md`, `concepts/Transformer.md`, `concepts/Neural Network.md` — pages with YAML frontmatter (`title`, `created`, `updated`, `type`, `tags`, `sources`), terse body sections, `[[wikilinks]]`

Decision: mirror the established ingest pattern — the article becomes a new concept page, and existing pages get backlinks plus frontmatter updates, rather than inventing a new directory or page type.

## 2. Created `wiki/concepts/Flash Attention.md`

Extracted the article's claims and organized them into the wiki's page shape (one-line definition, Key Ideas, variant, significance):

- IO-aware exact attention algorithm by Tri Dao
- Key insight: attention is memory-bandwidth-bound, not FLOP-bound
- Tiling avoids materializing the N^2 attention matrix → memory O(N^2) → O(N)
- 2-4x wall-clock speedup over standard attention in PyTorch
- FlashAttention-2: better work partitioning across GPU thread blocks

Frontmatter follows the house style: `type: concept`, `tags: [attention]` (taken from the SCHEMA taxonomy; `core-concept`/`architecture` felt wrong for an implementation technique, and prior paper-derived pages don't use the `paper` meta tag), `sources: ["FlashAttention (Tri Dao)"]` matching how the first source was cataloged. Links out to `[[Attention Mechanism]]` and `[[Transformer]]`. Mild enrichment beyond the article text (exact-vs-approximate contrast, SRAM/HBM framing, adoption status) is standard knowledge about FlashAttention and is consistent with the article's claims.

## 3. Connected existing pages (bidirectional links)

- `concepts/Attention Mechanism.md` — added a Variants bullet for Flash Attention ("IO-aware tiling that keeps the math exact while cutting memory to O(N)"); bumped `updated` to 2026-08-18; added the new source to `sources`
- `concepts/Transformer.md` — appended a Significance sentence noting long-context transformers rely on Flash Attention to make the attention mechanism memory- and bandwidth-efficient; bumped `updated`; added the source

`Neural Network.md` was left untouched: the article has nothing to say at that abstraction level, and adding a link there would be noise.

## 4. Updated catalog and log

- `index.md` — appended `- [[Flash Attention]] — IO-aware exact attention with O(N) memory and 2-4x speedup` under Concepts (kept the existing creation-order listing)
- `log.md` — appended an ingest row matching the table's format: `| 2026-08-18 | ingest | "FlashAttention (Tri Dao)" — created Flash Attention; updated Attention Mechanism, Transformer |`

Left the empty `## Sources` section of the index alone — the prior ingest also created no source page, so a source page is evidently not part of this wiki's convention.

## 5. Validated

Ran a throwaway Node check (no files created) confirming that (a) every `[[wikilink]]` across all pages resolves to an existing page title and (b) the index references every page. Both passed: 4 pages, 4 distinct link targets, no broken links, no index gaps.

## Files touched

- Created: `wiki/concepts/Flash Attention.md`, `process-log.md`
- Updated: `wiki/concepts/Attention Mechanism.md`, `wiki/concepts/Transformer.md`, `wiki/index.md`, `wiki/log.md`
