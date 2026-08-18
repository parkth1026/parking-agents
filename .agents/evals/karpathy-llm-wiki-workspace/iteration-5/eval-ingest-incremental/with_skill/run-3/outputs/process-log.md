# Process Log — eval-ingest-incremental / with_skill / run-3

Task: ingest a user-provided article about Flash Attention into the existing LLM wiki
and connect it to existing attention/transformer pages. Executed 2026-08-18 in batch
mode (no user available). Skill: karpathy-llm-wiki (read-only; never modified).

## Protocol steps executed, in order

1. **Read SKILL.md** plus `config.json`, `references/page-templates.md`,
   `references/tagging-taxonomy.md`, `references/validation-and-constraints.md`,
   and `scripts/validate-wiki.mjs`.
2. **Phase 0 — config resolution** via the skill's chain:
   `SKILL_ENV` env var (set to `...\iteration-5\mock-env\eval-ingest-incremental-run3.json`)
   > `~/.config/parking-agents/skill-env.json`; deep-merged over skill `config.json`
   defaults; paths normalized (absolute Windows paths, used as-is).
   Result: `wikiDir = <outputs>\wiki` (exists), `rawDir = <outputs>\wiki-raw` (missing).
   Autonomous decision (skill-sanctioned): created `rawDir` without user confirmation —
   SKILL.md: "In batch/autonomous mode, a task that explicitly requires wiki operations
   implies authorization for creating the configured directories — proceed and record
   the decision in `log.md`." Recorded in log.md.
3. **Session Start Protocol** (read in required order): SCHEMA.md -> index.md -> log.md.
   Last log entry 2026-08-10; no concurrent-session activity detected.
4. **Ingest step 1 — raw source saved** to
   `wiki-raw/articles/2026-08-18-flash-attention.md` with the metadata header
   (title/url/author/date/ingested; ingestion date 2026-08-18, publication date unknown
   -> "unknown"). User text stored verbatim as the body. Layer-1 immutability respected.
5. **Ingest step 3 — takeaways discussion auto-passed** (batch mode per SKILL.md:
   "In batch/autonomous mode (no user available): derive the 3-5 takeaways yourself,
   proceed, and record in `log.md` that this discussion step was auto-passed").
   Derived 5 takeaways (IO-aware exact attention; O(N^2)->O(N) via tiling; 2-4x PyTorch
   speedup; FlashAttention-2 work partitioning; memory-bandwidth bottleneck). Recorded in log.md.
6. **Ingest step 4 — existing-page check** against index.md: Transformer, Attention
   Mechanism, Neural Network exist; no FlashAttention/Tri Dao/source pages -> no duplicates.
7. **Ingest step 5 — page writes** (SCHEMA tag additions first, then pages):
   - `wiki/SCHEMA.md`: added tags `inference`, `hardware`, `person` — synced verbatim
     from `references/tagging-taxonomy.md` (its rules require tags be defined before use;
     skill dir untouchable, so the wiki's SCHEMA.md is where they get registered).
   - Created `wiki/concepts/FlashAttention.md` (concept page; meets threshold:
     central to this source).
   - Created `wiki/entities/Tri Dao.md` (entity page; threshold clause:
     "well-known entity in the LLM field").
   - Created `wiki/sources/Flash Attention.md` (source page, named after page title).
   - Updated `wiki/concepts/Attention Mechanism.md`: FlashAttention variant bullet +
     memory-bandwidth note; `sources` frontmatter extended; `updated: 2026-08-18`.
   - Updated `wiki/concepts/Transformer.md`: efficient-attention bullet linking
     [[FlashAttention]]; `sources` frontmatter extended; `updated: 2026-08-18`.
   - FlashAttention-2 kept as a Variants section (one sentence of material — below page
     threshold). PyTorch and Memory-Bandwidth/IO-awareness recorded as **pending page
     candidates** in log.md rather than linked (no broken links allowed).
8. **log.md appended** (before index.md, per Concurrent Sessions ordering rule).
9. **index.md merged**: re-read from disk (unchanged since orientation -> no concurrent
   write), then merged: new `## Entities` section + Tri Dao, FlashAttention under
   Concepts, Flash Attention under Sources.
10. **Ingest step 8 — validation** run and saved to `<outputs>\validation-report.txt`
    (outside wikiDir per the constraint). Result: **10.00 / 10, Status PASS, exit 0**
    (0 broken links, 0 orphans, 0 issues across all 8 dimensions). No fix loop needed.

## Skill ambiguities / judgment calls (with quotes)

1. **Near-collision between source and concept page titles.** SKILL.md: "If a source
   page and a concept/entity page would share the same title, disambiguate the
   **source** page (e.g., use the work's full title or add a qualifier like `(paper)`)".
   It only forbids *identical* basenames. Decision: concept page = "FlashAttention"
   (canonical technique name, one word), source page = "Flash Attention" (the user's
   article title, two words). Distinct basenames, validator-resolvable, but visually
   near-identical — the skill gives no guidance for this "same name, different spacing"
   case. A stricter `(paper)`-style qualifier was considered and rejected because the
   user's text is an article *about* the work, not the paper itself.
2. **Tag registration location is split across two files.** tagging-taxonomy.md says
   "Add new tags to this file before using them in a page", but that file lives in the
   read-only skill dir, while the validator parses only the wiki's SCHEMA.md
   ("All tags must be defined in SCHEMA.md"). Decision: added `inference`, `hardware`,
   `person` to the wiki's SCHEMA.md, copying tokens from the taxonomy reference so the
   two lists do not diverge.
3. **Publication date absent from user text.** Raw header template requires
   `date: "{publication date}"`; none was provided. Decision: `date: "unknown"` in the
   raw header and "not stated in source text" on the source page; the FlashAttention
   concept page deliberately avoids asserting years not present in the source.
4. **Tri Dao page-threshold judgment.** "Well-known entity in the LLM field (e.g., GPT-4,
   Andrej Karpathy, RLHF)" is inherently subjective. Decision: created the page (creator
   of FlashAttention, analogous to the Karpathy example); alternative was plain-text
   mention + pending-page record.
5. **Step-order mismatch between exploration and protocol.** Ingest lists "save raw
   source" as step 1 and Session Start reads as step 2, but I read the Session Start
   files during initial exploration before writing the raw file. Read-only and harmless
   (no writes preceded orientation), but strictly the protocol order was inverted.
6. **rawDir missing despite being configured.** Phase 0 says "Creating a missing
   directory is a persistent write: show the resolved paths and get user confirmation";
   no user available. Decision: relied on the same section's explicit batch-mode
   provision (quoted in step 2 above) and proceeded; also applied to creating the
   wiki's `entities/` and `sources/` directories, which the skill does not call out
   individually.
7. **Minor gap: `entities/`/`sources/` creation is never mentioned.** The wiki
   initialization section covers SCHEMA/index/log but not the canonical subdirectories;
   the validator's SEARCH_DIRS implies them. Decision: created on demand under the same
   batch-mode authorization, recorded in log.md.

## Commands run

1. Config resolution (Phase 0), node one-liner with `SKILL_ENV` exported — printed
   merged `scoring.minScore=9`, `page.minOutboundLinks=2`, `page.maxLines=200`,
   `wikiDir` (exists: true), `rawDir` (exists: false).
2. `find <outputs> -type f` — orientation and final tree verification.
3. Validation:
   `node <skill-dir>\scripts\validate-wiki.mjs --wiki <outputs>\wiki --config <skill-dir>\config.json`
   -> output teed to `<outputs>\validation-report.txt`, exit 0.
4. BOM check: `grep -rlP '\xEF\xBB\xBF' wiki wiki-raw | wc -l` -> 0 (UTF-8 without BOM confirmed).

## Final validation score

**10.00 / 10 — PASS** (threshold 9.0; broken links 0; all 8 dimensions 10/10;
6 pages: Transformer, Attention Mechanism, Neural Network, FlashAttention, Tri Dao,
Flash Attention).
