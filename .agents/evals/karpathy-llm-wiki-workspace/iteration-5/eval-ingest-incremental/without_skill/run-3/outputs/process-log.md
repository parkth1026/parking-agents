# Process Log — Incremental Ingest: Flash Attention

Date: 2026-08-18
Task: Add a user-provided Flash Attention article to the existing LLM wiki and connect it to existing attention/transformer pages.

## Step 1 — Surveyed the existing wiki

Read every file in `wiki/` before writing anything:

- `index.md` — auto-maintained catalog, one line per page, with an (empty) Sources section
- `SCHEMA.md` — domain scope, tag taxonomy (architecture, training, core-concept, model, attention, paper, historical), conventions (Title Case page names, lowercase-kebab-case tags, YYYY-MM-DD dates)
- `concepts/Attention Mechanism.md`, `concepts/Transformer.md`, `concepts/Neural Network.md` — all pages follow the same shape: frontmatter (title/created/updated/type/tags/sources), H1 title, one-line summary, short `##` sections, `[[wikilinks]]` for cross-references
- `log.md` — append-only operations table, most recent entries at the bottom

This told me the conventions to match: page location (`concepts/`), frontmatter fields, wikilink style, and that catalog/log updates are part of every ingest (the 2026-08-10 entry shows the pattern).

## Step 2 — Preserved the raw source

`wiki-raw/` did not exist yet, so I created it and saved the article verbatim as
`wiki-raw/Flash Attention.md`, with a provenance header noting it was supplied by the user on 2026-08-18. This keeps the source text separate from the distilled wiki page, mirroring the stated layout of the workspace.

## Step 3 — Created the new page

Created `wiki/concepts/Flash Attention.md`:

- Frontmatter matches house style: `type: concept` (the only type in use), `tags: [attention, paper]` (both in SCHEMA.md's taxonomy — "attention" for the technique, "paper" since it distills a specific paper), `sources: ["Flash Attention"]`, dates 2026-08-18
- Content stays faithful to the source text only — IO-aware exact attention, O(N^2) → O(N) memory via tiling without materializing the attention matrix, 2-4x PyTorch speedup, FlashAttention-2 thread-block work partitioning, memory-bandwidth-not-FLOPs insight. No facts added beyond the article
- Links out to `[[Attention Mechanism]]` and `[[Transformer]]` in the body

## Step 4 — Connected it to existing pages (backlinks)

- `concepts/Attention Mechanism.md` — added Flash Attention as a third bullet under "Variants" (the natural home; the section already lists multi-head attention). Bumped `updated` to 2026-08-18
- `concepts/Transformer.md` — added a sentence under "Significance" explaining that its attention layers are memory-bandwidth-bound and Flash Attention addresses that. Bumped `updated` to 2026-08-18
- `concepts/Neural Network.md` — deliberately left untouched: the task asked for connections to attention/transformer pages, and over-linking from a generic page would dilute it

This makes the graph bidirectional: Flash Attention → Attention Mechanism / Transformer, and each of those points back.

## Step 5 — Updated catalog and log

- `index.md` — added `- [[Flash Attention]] — IO-aware exact attention with O(N) memory and 2-4x speedup` under Concepts, and logged the source under the previously empty Sources section
- `log.md` — appended an ingest row for 2026-08-18 in the same format as the existing row

## Step 6 — Validated

Grepped all `[[...]]` links across the wiki and checked each target has a matching file in `concepts/`. All 17 link occurrences resolve to one of the 4 concept pages; no dangling links. Final structure:

```
wiki/
  index.md                      (4 pages + 1 source listed)
  log.md                        (2 entries)
  SCHEMA.md                     (unchanged)
  concepts/
    Attention Mechanism.md      (updated 2026-08-18)
    Flash Attention.md          (new)
    Neural Network.md           (unchanged)
    Transformer.md              (updated 2026-08-18)
wiki-raw/
  Flash Attention.md            (verbatim source, new)
```

## Decisions and rationale

- Matched existing conventions exactly rather than inventing new sections/types — an incremental ingest should be indistinguishable in style from prior pages
- Kept the page content strictly within the facts of the supplied article; contextual glue (e.g. "same math, different execution") is interpretation of the source, not new claims
- One page, not two for FlashAttention / FlashAttention-2: the source covers the successor in a single sentence, so it lives as a section of the same page
