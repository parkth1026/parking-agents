# LLM Wiki Quality Check Report

Date: 2026-08-18
Wiki: `outputs\wiki` (resolved via SKILL_ENV → mock-env\eval-lint-run3.json → `knowledgeBase.wikiDir`)
Skill: karpathy-llm-wiki, Operation 3 (Lint), validator `validate-wiki.mjs` v5

## Scores

| | Before | After |
|---|---|---|
| **Total** | **8.52 / 10 — FAIL** | **10.00 / 10 — PASS** |
| Broken Links (25%) | 9.1 | 10 |
| Self References (10%) | 10 | 10 |
| Orphan Pages (10%) | 7.5 | 10 |
| Index Completeness (15%) | 7.5 | 10 |
| Frontmatter (15%) | 7.5 | 10 |
| Page Size (10%) | 10 | 10 |
| Outbound Links (10%) | 7.5 | 10 |
| Tag Compliance (5%) | 10 | 10 |

Threshold: 9.0; hard gate: broken links must be 0. Both satisfied on re-run (exit code 0).

## Issues Found and Fixes Applied

1. **Broken link** — `sources/Big Source.md` linked `[[Ghost Network]]`, which has no page.
   Fix: demoted to plain text ("the obscure Ghost Network literature"). Ghost Network is
   mentioned only once, in passing — below the page-creation threshold (2+ sources, central
   to a source, or well-known entity). Recorded in `log.md` as a pending-page candidate:
   if a second source ever mentions it, create the page then.

2. **Orphan page** — `concepts/Orphan Concept.md` had zero inbound links.
   Fix: added an inbound link from the related `Neural Network` page (new "Related"
   section) and an `index.md` catalog entry (catalog links also count as inbound).

3. **Missing frontmatter** — `Orphan Concept.md` had no YAML frontmatter at all.
   Fix: added frontmatter (`title`, `created`/`updated` 2026-08-18, `type: concept`,
   `tags: [core-concept]`, `sources: []`). Original creation date was undeterminable
   (no log entry exists for its creation), so today's date was used and the retro-fill
   was noted in `log.md` per the skill's instruction.

4. **Missing from index** — `Orphan Concept` was not listed in `index.md`.
   Fix: added under Concepts: `- [[Orphan Concept]] — Concept stub cross-referencing Transformer and Neural Network`.

5. **Under-linked page** — `concepts/Neural Network.md` had only 1 outbound wikilink (min 2).
   Fix: added a "Related" section linking `[[Big Source]]` and `[[Orphan Concept]]`
   (now 3 outbound links).

No issues found for: self-references, oversized pages, invalid tags.

## Files Modified

- `wiki/sources/Big Source.md` — broken link removed, `updated` bumped
- `wiki/concepts/Orphan Concept.md` — frontmatter added
- `wiki/concepts/Neural Network.md` — Related section added, `updated` bumped
- `wiki/index.md` — Orphan Concept entry added
- `wiki/log.md` — lint entry + result entry appended
- `outputs/wiki-raw/` — created (was missing; authorized in batch mode, recorded in log.md)

Validation artifacts (kept outside the wiki so they are not counted as pages):
`before-validation.txt`, `after-validation.txt`, `final-validation.txt`, this report, `process-log.md`.

## Batch-Mode Decisions (user unavailable)

- Ghost Network: link demoted rather than page created (creation threshold not met).
- Orphan Concept: repaired in place rather than deleted/merged (skill offers no deletion
  option; no parent page exists to merge into).
- rawDir created per skill's batch authorization for wiki-operation tasks.
