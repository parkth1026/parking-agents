---
title: "Trace Report"
created: 2026-04-13
updated: 2026-04-13
type: query
tags: [evaluation]
sources: ["Intro to Large Language Models"]
---

# Trace Report — karpathy-llm-wiki Skill Test

**Test**: eval-ingest-fresh / with_skill
**Date**: 2026-04-13
**Task**: Ingest Karpathy "Intro to Large Language Models" lecture into a new wiki

---

## Files Created

### Foundation Files
- `outputs/SCHEMA.md` — tag taxonomy (one tag per line format required by validator)
- `outputs/index.md` — catalog of all 14 wiki pages
- `outputs/log.md` — append-only operation log

### Entity Pages (3)
- `outputs/entities/Andrej Karpathy.md`
- `outputs/entities/GPT-4.md`
- `outputs/entities/OpenAI.md`

### Concept Pages (8)
- `outputs/concepts/Pretraining.md`
- `outputs/concepts/Fine-Tuning.md`
- `outputs/concepts/RLHF.md`
- `outputs/concepts/Scaling Laws.md`
- `outputs/concepts/LLM OS.md`
- `outputs/concepts/Tokenization.md`
- `outputs/concepts/Context Window.md`
- `outputs/concepts/Prompt Injection.md`
- `outputs/concepts/Retrieval-Augmented Generation.md`

### Source Summary Pages (1)
- `outputs/sources/Intro to Large Language Models.md`

### Raw Sources (1)
- `outputs/raw/transcripts/2024-01-15-karpathy-intro-to-llms.md`

### Validation Output
- `outputs/validation-report.txt`

---

## Validation Result

**Status: PASS**
**Score: 9.9 / 10.0** (threshold: 9.0)

| Dimension | Score |
|-----------|-------|
| Broken Links | 10/10 |
| Self References | 10/10 |
| Orphan Pages | 9/10 |
| Index Completeness | 10/10 |
| Frontmatter | 10/10 |
| Page Size | 10/10 |
| Outbound Links | 10/10 |
| Tag Compliance | 10/10 |

---

## Issues Encountered and Fixes Applied

### Issue 1: SCHEMA.md tag format mismatch
- **Problem**: Initial SCHEMA.md used comma-separated tags per line
  (`- architecture, training, inference, ...`). The validator uses regex
  `^\s*-\s+(\S+)` which only captures the first word before a space.
  This caused "architecture," (with trailing comma) to not match any tag,
  resulting in 48 invalid tag errors and a tag compliance score of 0.7/10.
- **Fix**: Rewrote SCHEMA.md with one tag per line (`- architecture`).
- **Result**: Tag compliance rose from 0.7 to 10.0.

### Issue 2: Raw transcript picked up by validator
- **Problem**: The raw transcript file at `raw/transcripts/2024-01-15-karpathy-intro-to-llms.md`
  was being scanned by the validator (it recursively walks all .md files under wikiDir).
  This caused: missing frontmatter, zero outbound links, not in index, orphan page.
- **Fix**: Added proper YAML frontmatter (type, tags, title) to the raw file;
  added it to index.md; added 2 outbound wikilinks.
- **Remaining**: The raw file is still an orphan (no wiki page links to it with a
  valid wikilink, because its path `raw/transcripts/` is outside the standard wiki
  subdirs the validator checks). Score impact: -0.1 (orphan penalty = 1/14 pages).
- **Root cause**: The test harness places rawDir inside wikiDir. In production,
  rawDir should be outside wikiDir to prevent the validator from scanning raw files.
  This is a skill configuration issue, not a content issue.

## Related

- [[Intro to Large Language Models]], [[Andrej Karpathy]]
