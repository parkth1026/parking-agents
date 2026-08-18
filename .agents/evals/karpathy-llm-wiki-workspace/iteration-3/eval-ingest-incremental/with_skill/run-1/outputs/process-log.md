# Process Log — eval-ingest-incremental / with_skill / run-1

Date: 2026-08-18 · Skill: karpathy-llm-wiki · Operation: Ingest (incremental into existing wiki)

## 1. Protocol steps executed, in order

1. **Read SKILL.md** (`D:\GIT_dev\parking-agents\.claude\skills\karpathy-llm-wiki\SKILL.md`), skill `config.json`, `references/page-templates.md`, `references/tagging-taxonomy.md`, `scripts/validate-wiki.mjs` (read-only; nothing in the skill dir was modified).
2. **Phase 0 (path resolution)** — set `SKILL_ENV=...\iteration-3\mock-env\eval-ingest-incremental.json`; resolved the layered config with a Node one-liner implementing the documented chain (`$SKILL_ENV` > `~/.config/parking-agents/skill-env.json`; env layer deep-merged over skill defaults). Resolved absolute `wikiDir` (existed) and `rawDir` (missing → created per "If any directory does not exist, create it with `fs.mkdirSync(dir, { recursive: true })`", plus the four Layer-1 subdirs articles/papers/transcripts/assets).
3. **Session Start Protocol** — read `SCHEMA.md` → `index.md` → `log.md` (all existed; wiki had 3 concept pages from a prior 2026-08-10 ingest).
4. **Ingest step 1 (save raw source)** — wrote the user's article text verbatim with the required metadata header to `wiki-raw/articles/2026-08-18-flash-attention.md`. Immutable from here on.
5. **Ingest step 3 (takeaways)** — batch mode, user unavailable; derived 5 takeaways autonomously (see decision D1).
6. **Ingest step 4 (check existing pages)** — searched `index.md`: no Flash Attention, no Tri Dao; Transformer / Attention Mechanism / Neural Network exist and are related.
7. **Ingest step 5 (create/update pages)**:
   - Added `### People / - person` tag to `SCHEMA.md` first (tag discipline).
   - Created `wiki/concepts/Flash Attention.md` (central subject → meets creation threshold).
   - Created `wiki/entities/Tri Dao.md` (well-known entity / introducer of the subject).
   - Created `wiki/sources/Flash Attention Overview.md` (source summary; `sources: []` per template).
   - Updated `wiki/concepts/Attention Mechanism.md` (new Flash Attention variant bullet; `sources` += "Flash Attention Overview"; `updated: 2026-08-18`).
   - Updated `wiki/concepts/Transformer.md` (new Key Idea connecting Flash Attention; `sources` +=; `updated:`).
   - Deliberately did NOT create pages for PyTorch, FlashAttention-2, memory bandwidth (below threshold; see D5).
8. **Ingest step 6** — updated `index.md`: added missing `## Entities` section (Tri Dao), Flash Attention under Concepts, Flash Attention Overview under Sources.
9. **Ingest step 7** — appended timestamped ingest row to `log.md`.
10. **Constraint 4 enforcement** — normalized every touched file to UTF-8 without BOM + CRLF (pre-existing files were LF; see D8).
11. **Ingest step 8 (validation)** — ran `validate-wiki.mjs`: **10/10 PASS**, 0 issues (run 1). Appended a `validate` row to `log.md` (lint step 5 convention), re-normalized `log.md` to CRLF, re-ran validation: **10/10 PASS**, exit code 0 (final).

## 2. Ambiguities / forced decisions (with quotes)

- **D1 — Interactive step impossible (batch mode).** SKILL.md Ingest step 3: "Discuss takeaways with the user — summarize the 3-5 key concepts from the source. Ask if there are specific aspects they want emphasized before you write pages." User unavailable → derived takeaways autonomously (IO-aware exact attention; O(N²)→O(N) via tiling; 2-4x speedup in PyTorch; FA-2 work partitioning across GPU thread blocks; bottleneck = memory bandwidth not FLOPs) and recorded the skip in `log.md`.
- **D2 — articles/ vs papers/.** Layer 1 says "articles ← blog posts, web articles" and "papers ← research papers, arxiv PDFs". The content is *about* papers but the user literally said "this article" and provided article-style text (not the paper). Decision: `articles/`.
- **D3 — filename date prefix.** "Naming convention: `{YYYY-MM-DD}-{slug}.md`" does not say whether the date is publication or ingestion; the example (`2024-01-15-karpathy-intro-to-llms.md`) is ambiguous. No publication date was provided → used ingestion date `2026-08-18`.
- **D4 — source page title.** User provided no title. The source page cannot share the basename "Flash Attention" with the concept page (validator resolves `[[links]]` by filename across directories — same-basename files would be ambiguous). Invented "Flash Attention Overview"; the raw-file `title:` metadata records it as untitled.
- **D5 — "dead link as signal" vs "broken links = 0" tension.** "When in doubt, mention the concept in an existing page with a `[[wikilink]]` — if the link becomes a dead link, that's a signal it deserves its own page later" conflicts with the Completion Standard "Broken link count = 0" (weight 25%). Decision: PyTorch / FlashAttention-2 / memory-bandwidth stay plain text (no wikilink) until a second source justifies a page.
- **D6 — Tri Dao meets threshold?** Threshold requires "2+ sources, OR central to a single source, OR a well-known entity". Tri Dao appears in one source and is not the main subject; justified via the well-known-entity clause (introducer of the subject). Decision: created a short entity page.
- **D7 — no person tag in taxonomy.** The skill's Concept template expects "[[Key Person or Org]]" links and entities/ holds people, yet neither the wiki `SCHEMA.md` nor `references/tagging-taxonomy.md` defines any person tag. Per "If you need a new tag, add it to SCHEMA.md first, then use it" → added `person` before using it. Related: the wiki SCHEMA is a trimmed subset of the reference taxonomy (e.g. `inference`/`hardware` exist only in the reference); chose existing tags `[attention, core-concept]` for the new concept page rather than extending the taxonomy further ("Prefer existing tags over creating new ones").
- **D8 — CRLF contradiction.** Constraint 4: "UTF-8 without BOM: All output files, CRLF line endings", but every pre-existing sandbox wiki file was LF-only. Decision: normalized all wiki + raw files I touched to CRLF (including content-untouched `Neural Network.md`, formatting-only, for wiki-wide consistency). Note: the Write/Edit tools emit LF, so a manual normalization pass was needed after every write.
- **D9 — validation report destination unspecified.** Completion Standard: "Validation report generated", but the script prints to stdout only and SKILL.md names no report path. Decision: report captured below and recorded in `log.md`; no extra file created inside the wiki.
- **D10 — pre-existing inconsistency (observation, not fixed).** `log.md` records a 2026-08-10 ingest of "Attention Is All You Need", but no `sources/` page or raw file exists for it, and `index.md` had no `## Entities` section. Out of scope for this ingest; not fabricated retroactively (raw sources are immutable ground truth).

## 3. Commands run

1. `find <outputs>` — inspect sandbox tree (wiki 3 concepts + SCHEMA/index/log; no wiki-raw).
2. Node one-liner — check BOM/line endings of existing files (result: all LF, no BOM).
3. `SKILL_ENV=...mock-env\eval-ingest-incremental.json node -e <resolve+merge+normalize config, create rawDir + subdirs>` — Phase 0.
4. File writes/edits (Write/Edit tools): raw source; 3 new pages; edits to Attention Mechanism, Transformer, SCHEMA, index, log (details in section 1).
5. `node -e <normalize to CRLF / strip BOM across 10 touched files>` — constraint 4.
6. **Validation run 1**: `SKILL_ENV=... node <skill-dir>\scripts\validate-wiki.mjs --wiki <outputs>\wiki --config <skill-dir>\config.json` → 10/10 PASS, exit 0.
7. `node -e <re-normalize log.md>` + **Validation run 2 (final)**: same command → 10/10 PASS, exit 0.

## 4. Final validation score

```
=== Wiki Validation Script v5 ===
Found 6 wiki pages
Broken Links 10/10 | Self References 10/10 | Orphan Pages 10/10 |
Index Completeness 10/10 | Frontmatter 10/10 | Page Size 10/10 |
Outbound Links 10/10 | Tag Compliance 10/10
Total: 10 / 10   Threshold: 9 / 10   Status: PASS   (exit code 0)
```

## 5. Result summary

- Created: `wiki/concepts/Flash Attention.md`, `wiki/entities/Tri Dao.md`, `wiki/sources/Flash Attention Overview.md`, `wiki-raw/articles/2026-08-18-flash-attention.md`.
- Updated: `wiki/concepts/Attention Mechanism.md`, `wiki/concepts/Transformer.md` (Flash Attention cross-links both ways), `wiki/SCHEMA.md` (+person tag), `wiki/index.md`, `wiki/log.md`.
- Untouched content-wise: `wiki/concepts/Neural Network.md` (no new info in source).
