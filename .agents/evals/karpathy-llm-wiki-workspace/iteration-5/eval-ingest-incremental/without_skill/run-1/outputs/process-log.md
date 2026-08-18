# Process Log — Incremental ingest: Flash Attention (2026-08-18)

Task: add a user-provided article about Flash Attention to the existing wiki and connect it to the pages about attention and transformers. All work confined to this outputs directory.

## Step 1 — Survey the existing wiki
Read every file first to learn the conventions instead of guessing:
- `wiki/SCHEMA.md`: tag taxonomy (`attention`, `paper`, `architecture`, `core-concept`, ...), Title Case page names, kebab-case tags, YYYY-MM-DD dates.
- `wiki/concepts/*.md` (Attention Mechanism, Transformer, Neural Network): YAML frontmatter (`title/created/updated/type/tags/sources`), concise definition-first body, `##` sections, `[[wikilink]]` cross-references.
- `wiki/index.md`: auto-maintained catalog, one line per page, em-dash description; entries appear to be in creation order.
- `wiki/log.md`: append-only table `| Date | Operation | Details |`.

Noted convention from the previous ingest: when an existing page is updated during an ingest, the new source is appended to that page's `sources` frontmatter (Neural Network carries "Attention Is All You Need" for this reason), and the `## Sources` section of the index was left empty — no standalone source pages exist, so I kept that practice.

## Step 2 — Decide page structure
- One new concept page `Flash Attention` (Title Case per schema), placed in `concepts/` alongside the others. FlashAttention-2 is covered as a section of the same page rather than a separate page — the article treats it as an improvement of the same technique, and the wiki style favors small interlinked pages over fragmentation.
- `type: concept`, `tags: [attention, paper]` — both already in the SCHEMA taxonomy, so no schema change was needed.
- Source named "Flash Attention (Tri Dao)" since the article credits the author.

## Step 3 — Archive the raw source
The stated `wiki-raw/` directory did not exist in the sandbox, so I created it and saved the verbatim article text to `wiki-raw/flash-attention.md` for provenance before paraphrasing anything.

## Step 4 — Create the new page
`wiki/concepts/Flash Attention.md`, matching existing page shape: one-line definition linking [[Attention Mechanism]], then `## How It Works` (tiling, no N x N matrix, O(N^2) -> O(N) memory, exact not approximate), `## Why It Is Fast` (bottleneck is memory bandwidth, not FLOPs; IO-aware), `## FlashAttention-2` (better work partitioning across GPU thread blocks), `## Impact` (2-4x wall-clock speedup in PyTorch, long-sequence [[Transformer]] practicality). Content stays close to the source article; the only glosses are framing "IO-aware" in terms of minimizing data movement and noting "exact" means same math in a different order.

## Step 5 — Connect to existing pages (bidirectional links)
- `Attention Mechanism.md`: new `## Efficient Implementations` section pointing to [[Flash Attention]] with the O(N) memory / 2-4x speedup / bandwidth-not-FLOPs takeaway.
- `Transformer.md`: extended `## Significance` — the O(N^2) attention cost is mitigated in practice by [[Flash Attention]].
- Both pages: appended "Flash Attention (Tri Dao)" to `sources` and bumped `updated` to 2026-08-18, mirroring the ingest convention observed on Neural Network.
- `Neural Network.md` left untouched: Flash Attention relates to it only transitively through attention/transformer pages, and adding a link there would dilute the graph rather than help it.

## Step 6 — Update catalog and log
- `wiki/index.md`: added `- [[Flash Attention]] — IO-aware exact attention with O(N) memory and 2-4x speedup` at the end of Concepts (creation order).
- `wiki/log.md`: appended `| 2026-08-18 | ingest | "Flash Attention (Tri Dao)" — created Flash Attention; updated Attention Mechanism, Transformer |`, matching the prior row's format.

## Step 7 — Validate
One-off Node check across all wiki files: every `[[wikilink]]` in bodies and the index resolves to an existing page title; all tags are within the SCHEMA taxonomy; all four concept pages have well-formed `title` frontmatter. (index/log/SCHEMA are meta files without frontmatter by design — pre-existing condition, unchanged.) Result: all links resolve, all tags valid.

## Files touched
- created: `wiki/concepts/Flash Attention.md`, `wiki-raw/flash-attention.md`
- updated: `wiki/concepts/Attention Mechanism.md`, `wiki/concepts/Transformer.md`, `wiki/index.md`, `wiki/log.md`
