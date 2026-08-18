# LLM Wiki Quality Check Report — 2026-08-18

Operation: Lint (karpathy-llm-wiki skill, validate-wiki.mjs v5)
Wiki: `D:\GIT_dev\parking-agents\.agents\evals\karpathy-llm-wiki-workspace\iteration-4\eval-lint\with_skill\run-1\outputs\wiki`
Result: **8.52/10 FAIL → 10.00/10 PASS** (0 broken links, all 8 dimensions at 10/10)

## Overall Scores

| Dimension | Weight | Before | After |
|---|---|---|---|
| Broken Links | 25% | 9.1 | 10 |
| Self References | 10% | 10 | 10 |
| Orphan Pages | 10% | 7.5 | 10 |
| Index Completeness | 15% | 7.5 | 10 |
| Frontmatter | 15% | 7.5 | 10 |
| Page Size | 10% | 10 | 10 |
| Outbound Links | 10% | 7.5 | 10 |
| Tag Compliance | 5% | 10 | 10 |
| **Total** | | **8.52 (FAIL)** | **10.00 (PASS)** |

The before-run also tripped the hard gate (broken links must be 0 regardless of score).

## Issues Found and Fixes Applied

### 1. Broken link (hard gate) — `sources/Big Source.md`
- Issue: `Big Source.md -> [[Ghost Network]]` pointed to a page that does not exist.
- Analysis: "Ghost Network" is described as *obscure literature* — mentioned in exactly 1 source, not central to it, not a well-known entity. It fails the skill's Page Creation Threshold (2+ sources / central / well-known), so creating a page would violate the "no speculative pages" constraint.
- Fix: converted `[[Ghost Network]]` to plain text and recorded it in `log.md` as a **pending page candidate** — create the page when a second source mentions it. Bumped `updated` to 2026-08-18.

### 2. Orphan page + missing from index + missing frontmatter — `concepts/Orphan Concept.md`
- Issue: the page had zero inbound links, was absent from `index.md`, and had no YAML frontmatter at all (the "missing metadata" you suspected).
- Fix: retro-filled frontmatter (`title`, `created`/`updated` 2026-08-18 — original date not determinable, noted in log.md, `type: concept`, `tags: [core-concept]` from the SCHEMA taxonomy, `sources: []`) and added a catalog entry to `index.md`. With `scoring.indexCountsAsInbound: true`, the official catalog link counts as its inbound link, resolving the orphan status. (Decision: catalog-link-as-inbound was chosen over fabricating a cross-link from Transformer/Neural Network, since neither genuinely relates to this stub.)
- Note: the page body is a self-describing stub ("never linked from anywhere") whose prose is now stale; left untouched pending enrichment or deletion at your discretion.

### 3. Under-linked page — `concepts/Neural Network.md`
- Issue: only 1 outbound wikilink (`[[Transformer]]`), minimum is 2.
- Fix: added a template-conformant `## Related` section linking `[[Transformer]]` and `[[Big Source]]` (Big Source is already listed in the page's `sources` frontmatter, so the link is substantive). Bumped `updated` to 2026-08-18.

### 4. Bookkeeping
- `index.md`: added the Orphan Concept catalog line.
- `log.md`: appended a lint entry (scores, all fixes, pending-page note, retro-fill note, batch-mode decisions).
- No changes to `SCHEMA.md` (all tags already compliant), `concepts/Transformer.md` (already clean), or any raw source.

## Clean Checks (before and after)
Self references: 0. Page size: all pages far below the 200-line max. Tag compliance: all tags (`architecture`, `core-concept`, `paper`) defined in SCHEMA.md. All files UTF-8 without BOM. `index.md` catalog links all resolve.

## Environment Notes
- Config resolved via the skill's chain (`SKILL_ENV` > default env path), deep-merged over the skill's `config.json`: `minScore 9.0`, `indexCountsAsInbound true`, `minOutboundLinks 2`, `maxLines 200`.
- `knowledgeBase.rawDir` (`...\outputs\wiki-raw`) does not exist. Lint only needs `wikiDir`, so it was not created (directory creation is a persistent write requiring your confirmation). Create it before the next Ingest.
- Raw validation output: `validation-before.txt` / `validation-after.txt` next to this report (kept outside the wiki dir so they are not counted as pages).
