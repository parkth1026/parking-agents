# Process Log — Flash Attention Ingest (2026-08-18)

Task: add an article about Flash Attention (Tri Dao) to the existing wiki and connect it to the pages about attention and transformers.

## Step 1 — Survey the existing wiki

Read every file under `wiki/` before touching anything:
- `SCHEMA.md` — domain, tag taxonomy (architecture, training, core-concept, model, attention, paper, historical), conventions (Title Case titles, kebab-case tags, YYYY-MM-DD dates).
- `index.md` — catalog with one `- [[Page]] — description` line per page, sections Concepts / Sources.
- `log.md` — append-only operation table; the prior ingest ("Attention Is All You Need") shows the house convention: a paper is recorded in `sources:` frontmatter and the log, not as its own page.
- `concepts/Transformer.md`, `concepts/Attention Mechanism.md`, `concepts/Neural Network.md` — frontmatter shape (title, created, updated, type, tags, sources) and page style (short, sectioned, `[[wikilinks]]`).

Why: match the existing format exactly rather than inventing a parallel one; the log entry pattern told me how a source article is supposed to be ingested.

## Step 2 — Preserve the raw source

Created `wiki-raw/flash-attention-tri-dao.md` (the dir did not exist yet) containing the article text verbatim under a provenance header, so the exact source wording survives future re-edits of the wiki page.

## Step 3 — Create the Flash Attention page

Created `wiki/techniques/Flash Attention.md`:
- New `techniques/` folder with `type: technique`, mirroring the schema's "Techniques" tag group — FlashAttention is an algorithm/implementation technique, not a foundational concept like the existing `concepts/` pages.
- Tags `[attention, paper]`: `attention` from the Techniques group, `paper` from the Meta group since the page is grounded in a specific paper. Both already existed in the taxonomy, so no schema changes were needed.
- `sources: ["Flash Attention by Tri Dao"]` following the frontmatter convention.
- Content covers only what the article states (IO-aware exact algorithm, tiling, O(N^2) -> O(N) memory, 2-4x PyTorch speedup, FlashAttention-2 thread-block work partitioning, memory-bandwidth-not-FLOPs insight), written in the concise style of the existing pages, with links to [[Attention Mechanism]] and [[Transformer]].

## Step 4 — Connect to existing pages (bidirectional)

- `concepts/Attention Mechanism.md`: added a Variants bullet pointing to [[Flash Attention]] (IO-aware exact implementation, O(N^2) -> O(N)); bumped `updated` to 2026-08-18; appended the source to `sources`.
- `concepts/Transformer.md`: added a sentence under Significance noting that Flash Attention makes long-sequence Transformers practical by avoiding the quadratic memory cost; bumped `updated`; appended the source.
- `concepts/Neural Network.md` left untouched — the article has no substantive connection to it, and an artificial link would be noise.

## Step 5 — Update catalog and log

- `index.md`: added a new `## Techniques` section with `- [[Flash Attention]] — IO-aware exact attention: O(N) memory and 2-4x speedups`, keeping Concepts and Sources as they were.
- `log.md`: appended `| 2026-08-18 | ingest | "Flash Attention by Tri Dao" — created Flash Attention; updated Attention Mechanism, Transformer |` (log is append-only, newest at bottom).

## Step 6 — Verify

- Listed all files: 8 files, all inside the outputs directory.
- Extracted every `[[wikilink]]` across the wiki and checked each resolves to a page file: [[Attention Mechanism]], [[Flash Attention]], [[Neural Network]], [[Transformer]] all OK.
- Confirmed all dates use YYYY-MM-DD, tags are kebab-case, and the title is Title Case per SCHEMA.md.

No files outside the outputs directory were read or written.
