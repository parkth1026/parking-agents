# Process Log — Incremental ingest: "Flash Attention"

Date: 2026-08-18
Scope: `<outputs>` only (wiki + wiki-raw). No files outside this directory were read or written.

## Step 1 — Survey the existing wiki

Read all existing files to learn the conventions before writing anything:

- `wiki/SCHEMA.md` — domain, tag taxonomy (`attention`, `core-concept`, `paper`, ...), conventions (Title Case titles, kebab-case tags, YYYY-MM-DD dates)
- `wiki/index.md` — auto-maintained catalog, one line per page under `## Concepts`
- `wiki/log.md` — append-only operations table; previous entry showed the ingest pattern: `"source" — created X, Y; updated Z`
- `wiki/concepts/Attention Mechanism.md`, `Transformer.md`, `Neural Network.md` — YAML frontmatter (`title/created/updated/type/tags/sources`), `[[wikilinks]]`, terse sectioned prose

Conclusions: pages live in `concepts/`, links are page-title wikilinks, sources are cited by quoted article name, and ingests touch the log, index, and related pages.

## Step 2 — Preserve the raw source

The described `wiki-raw/` directory did not exist, so I created it and saved the verbatim article text as `wiki-raw/flash-attention.md`. This keeps the original source material distinct from the distilled wiki page.

## Step 3 — Create the new page

Created `wiki/concepts/Flash Attention.md` with the same structure as existing pages:

- Frontmatter: `type: concept`, `tags: [attention, paper]` (both from the existing taxonomy), `sources: ["Flash Attention"]`, created/updated 2026-08-18
- Content preserves every fact from the source: Tri Dao authorship, IO-aware exact algorithm, O(N^2) → O(N) memory via tiling without materializing the attention matrix, 2-4x wall-clock speedup in PyTorch, FlashAttention-2's better work partitioning across GPU thread blocks, and the memory-bandwidth-not-FLOPs insight
- Outgoing links to `[[Attention Mechanism]]` (it computes the same attention result) and `[[Transformer]]` (it removes the quadratic long-context limit), keeping inferences minimal and flagged as significance rather than source fact

## Step 4 — Connect to existing pages (bidirectional links)

The task explicitly asked for connections to the attention and transformer pages, so:

- `Attention Mechanism.md`: added a Variants bullet for `[[Flash Attention]]` (O(N) vs O(N^2) memory, bandwidth-not-FLOPs bottleneck), bumped `updated` to 2026-08-18, added `"Flash Attention"` to `sources` — mirroring how the previous ingest annotated the pages it touched
- `Transformer.md`: extended Significance with `[[Flash Attention]]` taming attention's quadratic memory cost (2-4x speedup) and enabling long-context Transformers; bumped `updated`; added the source
- `Neural Network.md` left unchanged — it is neither an attention nor a transformer page and the source adds nothing to it

## Step 5 — Update catalog and log

- `index.md`: inserted `- [[Flash Attention]] — IO-aware exact attention with O(N) memory and 2-4x speedup` under `## Concepts`, placed next to `[[Attention Mechanism]]` for topical grouping; left the empty `## Sources` section as-is to match prior ingest behavior
- `log.md`: appended `| 2026-08-18 | ingest | "Flash Attention" — created Flash Attention; updated Attention Mechanism, Transformer |` following the existing row format

## Step 6 — Verify

Listed all files and cross-checked every `[[wikilink]]` against actual page titles: `[[Attention Mechanism]]` (4 uses), `[[Flash Attention]]` (3), `[[Neural Network]]` (3), `[[Transformer]]` (4) — all resolve to existing pages; no broken or orphan links. All four pages have intact frontmatter and taxonomy-conformant tags.

## Resulting file changes

| File | Change |
|------|--------|
| `wiki-raw/flash-attention.md` | created (verbatim source text) |
| `wiki/concepts/Flash Attention.md` | created (new page) |
| `wiki/concepts/Attention Mechanism.md` | link + source + updated date |
| `wiki/concepts/Transformer.md` | link + source + updated date |
| `wiki/index.md` | catalog line added |
| `wiki/log.md` | ingest entry appended |
