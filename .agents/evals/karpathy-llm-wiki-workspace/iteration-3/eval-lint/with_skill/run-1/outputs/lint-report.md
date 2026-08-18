# LLM Wiki Quality Report — 2026-08-18

Scope: `<outputs>\wiki` (4 pages) — lint per `karpathy-llm-wiki` skill, Operation 3, `validate-wiki.mjs` v5.

## Summary

| | Before | After |
|---|---|---|
| Total score | **8.5 / 10 (FAIL)** | **10 / 10 (PASS)** |
| Broken links | 1 | 0 |
| Orphan pages | 1 | 0 |
| Pages missing from index | 1 | 0 |
| Frontmatter issues | 1 | 0 |
| Under-linked pages | 1 | 0 |

## Issues Found and Fixes Applied

1. **Broken link** — `sources/Big Source.md` linked `[[Ghost Network]]`, which has no page.
   Fix: de-linked (kept the prose mention, dropped the `[[ ]]`). "Ghost Network" is an
   obscure single-source passing mention — it fails the skill's page-creation threshold
   (2+ sources / central to a source / well-known entity), so per the Dead Link Fix
   Strategy it is not worth a page.
2. **Orphan page** — `concepts/Orphan Concept.md` had zero inbound links.
   Fix: added an inbound link from `concepts/Neural Network.md` (Related section) and a
   catalog entry in `index.md` (index links count as inbound per `scoring.indexCountsAsInbound: true`).
   Chose linking over merge/delete: the skill lists "add inbound links" first, and no
   meaningful parent page exists to merge into.
3. **Missing from index** — `Orphan Concept` was not in `index.md`.
   Fix: added under Concepts with a one-line description.
4. **Missing frontmatter** — `Orphan Concept.md` had no YAML frontmatter at all.
   Fix: added full frontmatter (`title`, `created`, `updated`, `type: concept`,
   `tags: [core-concept]` — an existing taxonomy tag — `sources: []`).
5. **Under-linked page** — `Neural Network.md` had only 1 outbound wikilink (min 2).
   Fix: added a Related section linking `[[Orphan Concept]]`, which also resolved issue 2.

Modified files: `wiki/concepts/Neural Network.md`, `wiki/concepts/Orphan Concept.md`,
`wiki/sources/Big Source.md`, `wiki/index.md`, `wiki/log.md` (lint entry appended).
`Transformer.md` and `SCHEMA.md` untouched.

## Observations (not fixed, by design)

- `log.md`'s 2026-08-10 ingest entry claims an "Attention Mechanism" page was created,
  but no such page exists. The log is append-only per the schema, so the entry was left
  as a historical record. If that page should exist, re-ingest the source rather than
  creating it speculatively (constraint: "No speculative pages").
- All wiki files use LF line endings; the skill's constraint 4 specifies CRLF. Kept LF
  for corpus consistency during this lint (validator is line-ending agnostic). Normalize
  deliberately in a dedicated pass if CRLF matters for your tooling.

## Validation Commands

```bash
# Before and after (identical invocation)
node <skill-dir>/scripts/validate-wiki.mjs \
  --wiki "<outputs>/wiki" --config "<skill-dir>/config.json"
# Before: Total 8.5/10, Status FAIL, exit 1
# After:  Total 10/10,  Status PASS, exit 0
```

All 8 dimensions now 10/10: Broken Links, Self References, Orphan Pages, Index
Completeness, Frontmatter, Page Size, Outbound Links, Tag Compliance.
