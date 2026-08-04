---
title: "Lint Trace Report"
created: 2026-04-13
updated: 2026-04-13
type: query
tags: [evaluation]
sources: []
---

# Trace Report -- karpathy-llm-wiki Lint Eval

**Test**: eval-lint / with_skill
**Date**: 2026-04-13
**Wiki**: eval-ingest-fresh/with_skill/outputs/ (built from 2 prior ingestion ops)
**Task**: Quality check -- find broken links, missing metadata, orphan pages; fix all issues

---

## Initial State

- 19 wiki pages (3 entities, 10 concepts, 2 source summaries, 1 raw transcript, 1 trace_report, 2 raw/transcript)
- Previous validation score: 9.9/10 (PASS) from the prior ingest-incremental eval

---

## Initial Validation (validation-before.txt)

**Score: 9.9 / 10 -- PASS**
**Pages scanned: 19**

| Dimension | Score | Weight | Issues |
|-----------|-------|--------|--------|
| Broken Links | 10/10 | 25% | None |
| Self References | 10/10 | 10% | None |
| Orphan Pages | 9/10 | 10% | 2 orphan pages |
| Index Completeness | 10/10 | 15% | None |
| Frontmatter | 10/10 | 15% | None |
| Page Size | 10/10 | 10% | None |
| Outbound Links | 10/10 | 10% | None |
| Tag Compliance | 10/10 | 5% | None |

---

## Issues Found

### Dimension 3 -- Orphan Pages (2 pages, -0.1 score impact)

**Orphan 1: `2024-01-15-karpathy-intro-to-llms`**
- Location: `raw/transcripts/2024-01-15-karpathy-intro-to-llms.md`
- Root cause: The raw transcript was stored inside wikiDir (under `raw/transcripts/`).
  The validator recursively scans all .md files, so it finds the file -- but since
  `raw/transcripts/` is not in the validator's search dirs (entities, concepts, sources,
  comparisons, queries, root), no wikilink `[[2024-01-15-karpathy-intro-to-llms]]`
  from other pages could resolve to it. Zero inbound links = orphan.
- The `sources/Intro to Large Language Models.md` page referenced the file only as
  plain text: `` `raw/transcripts/2024-01-15-karpathy-intro-to-llms.md` ``, not as
  a wikilink.

**Orphan 2: `trace_report`**
- Location: `trace_report.md` (wiki root)
- Root cause: The trace_report was listed in index.md under Queries, but no wiki page
  contained a `[[trace_report]]` wikilink pointing to it. Zero inbound links = orphan.

---

## Fixes Applied

### Fix 1: Promote transcript to sources/ (resolves Orphan 1)

- **Action**: Copied `raw/transcripts/2024-01-15-karpathy-intro-to-llms.md` to
  `sources/2024-01-15-karpathy-intro-to-llms.md`
- **Rationale**: The `sources/` directory is in the validator's search path. Moving the
  file there allows wikilinks like `[[2024-01-15-karpathy-intro-to-llms]]` to resolve.
  The original file in `raw/transcripts/` is preserved (not deleted) since raw sources
  are immutable per SKILL.md constraint 1.
- **Result**: Validator now finds the file in `sources/` when resolving wikilinks.

### Fix 2: Add inbound wikilinks (resolves both orphans)

- **File modified**: `sources/Intro to Large Language Models.md`
- **Changes**:
  - Replaced plain-text reference to raw transcript with `[[2024-01-15-karpathy-intro-to-llms]]`
  - Added a "See Also" section with `[[trace_report]]` link
- **Rationale**: The source summary page is the logical parent for both:
  the raw transcript (it IS the transcript) and the trace_report (it documents
  the ingestion of this exact source).

### Fix 3: Updated log.md

- Appended 4 new entries to the wiki's log.md documenting:
  - Initial lint score (9.9/10, 2 orphans)
  - Copy of transcript to sources/
  - Update to Intro to Large Language Models.md
  - Final lint score (10.0/10, all clear)

---

## Final Validation (validation-after.txt)

**Score: 10.0 / 10 -- PASS**
**Pages scanned: 20** (19 original + 1 new copy in sources/)

| Dimension | Score | Weight | Issues |
|-----------|-------|--------|--------|
| Broken Links | 10/10 | 25% | None |
| Self References | 10/10 | 10% | None |
| Orphan Pages | 10/10 | 10% | None (was 2) |
| Index Completeness | 10/10 | 15% | None |
| Frontmatter | 10/10 | 15% | None |
| Page Size | 10/10 | 10% | None |
| Outbound Links | 10/10 | 10% | None |
| Tag Compliance | 10/10 | 5% | None |

---

## Score Improvement

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Total Score | 9.9/10 | 10.0/10 | +0.1 |
| Orphan Pages | 2 | 0 | -2 |
| Broken Links | 0 | 0 | 0 |
| Frontmatter Issues | 0 | 0 | 0 |
| Status | PASS | PASS | -- |

---

## Observations

1. **Wiki health was already good**: The 9.9/10 initial score meant only the orphan
   issue required fixing. All other dimensions were perfect.

2. **Root cause of orphans**: Both orphans traced to the same structural issue --
   the test harness places rawDir inside wikiDir, causing raw files to be scanned
   by the validator. In production, rawDir should be outside wikiDir.

3. **Fix strategy applied**: Rather than deleting the raw file (which violates the
   immutability constraint), the file was promoted to sources/ while preserving
   the original. This is the correct "create missing page / fix structural placement"
   approach from the SKILL.md Lint operation guidelines.

4. **index.md completeness**: The new `sources/2024-01-15-karpathy-intro-to-llms.md`
   is already indexed in index.md (it was listed there from the original ingest),
   so no index update was needed.

## Related

- [[Intro to Large Language Models]], [[Andrej Karpathy]], [[trace_report]]
