---
name: karpathy-llm-wiki
description: |
  Manages a persistent, interlinked markdown wiki for LLM/AI/deep-learning knowledge.
  Provides workflow, page templates, validation scripts, and quality scoring to build
  a Karpathy-style knowledge base.

  **Use this skill when:**
  (1) Create, populate, update, or query an LLM/AI/ML knowledge wiki
  (2) Ingest articles, papers, transcripts, or notes into the wiki
  (3) Validate wikilinks, lint pages, fix broken references, or check wiki quality
  (4) User mentions "wiki", "knowledge base", "Karpathy", "整理到wiki", or "ingest"
---

# Karpathy LLM Wiki

Build and maintain a persistent, interlinked markdown knowledge base. Instead of
rediscovering information through RAG with each query, the wiki compiles knowledge
once and keeps it current — every page cross-references related concepts, creating
a web of understanding that grows more valuable over time.

## Configuration

Configuration is layered (deep-merged; environment overrides skill defaults):

- **Skill defaults** `config.json` (next to this SKILL.md, versioned): holds `scoring` and `page` rules.
- **Environment** `~/.config/parking-agents/skill-env.json` (tool-neutral, never committed): holds the real `knowledgeBase.wikiDir` / `knowledgeBase.rawDir` for this machine (NAS-backed). Resolution chain: `SKILL_ENV` env var > this path.

The `knowledgeBase` namespace is **shared with other skills** on this machine (e.g. jenkins-log-auto-learning) — both point at the same physical wiki/raw directories, so the values live in exactly one place.

Key fields (after merge):
- `knowledgeBase.wikiDir` — **the wiki knowledge base** — all wiki pages (`entities/`, `concepts/`, `SCHEMA.md`, `index.md`, `log.md`) and all output go here.
- `knowledgeBase.rawDir` — raw source materials storage (original articles, papers, transcripts that get ingested). Also feeds the Lint staleness check (raw evidence date vs page `updated`).
- `scoring.minScore` — minimum quality score to pass validation (default: 9.0)
- `scoring.indexCountsAsInbound` — whether `index.md` catalog links count as inbound links for orphan detection (default: `true`; `index.md` is the official catalog per SKILL.md semantics — its links are also checked for breakage regardless of this switch)
- `scoring.stalenessEnforce` — when `true`, any stale page (raw evidence newer than the page's `updated` date) hard-fails validation; default `false` (report-only until the stale backlog is cleared)
- `page.maxLines` — maximum lines per page before splitting (default: 200)
- `page.minOutboundLinks` — minimum `[[wikilinks]]` per page (default: 2)

Do NOT hardcode paths — always read them from the merged config.

### Path Resolution (Phase 0)

After reading config.json, **normalize ALL path values** before using them anywhere. Config paths may use three styles:

1. **`~/...`** (tilde prefix) — expand `~` to the user's home directory. In Node: `path.join(os.homedir(), configPath.replace(/^~[\\/]/, ''))`. Example: `~/memory/jenkins-learnings` → `<home>/memory/jenkins-learnings`
2. **`./...`** (dot-slash relative) — resolve relative to the **current working directory** (NOT the skill directory). In Node: `path.resolve(configPath)`. Example: `./wiki-raw/jenkins-learnings` → `<cwd>/wiki-raw/jenkins-learnings`
3. **Absolute paths** — use as-is. Forward slashes work on Windows.

**Apply this resolution to**: `knowledgeBase.wikiDir`, `knowledgeBase.rawDir`.

After resolving, verify each directory exists with `fs.existsSync`. Creating a missing directory is a persistent write: show the resolved paths and get user confirmation before calling `fs.mkdirSync(dir, { recursive: true })`. If the user does not confirm, report the missing directories and stop. In batch/autonomous mode, a task that explicitly requires wiki operations implies authorization for creating the configured directories — proceed and record the decision in `log.md`.

---

## Three-Layer Architecture

The wiki uses three distinct layers. Respecting these boundaries is essential for
data integrity — raw sources are the "ground truth" and must never be modified after
ingestion.

### Layer 1: Raw Sources (`{rawDir}`)

Immutable files saved exactly as received. Never edit these after ingestion.

```
{rawDir}/
├── articles/     ← blog posts, web articles
├── papers/       ← research papers, arxiv PDFs
├── transcripts/  ← video/podcast transcripts
└── assets/       ← images, diagrams referenced by sources
```

**Naming convention**: `{YYYY-MM-DD}-{slug}.md` — the date is the **ingestion
date** (matching the `ingested` metadata field; the publication date lives in
the header).
Example: `2024-01-15-karpathy-intro-to-llms.md`

### Layer 2: The Wiki (`{wikiDir}`)

Agent-maintained markdown pages with `[[wikilinks]]` connecting related concepts.
This is where knowledge gets compiled, synthesized, and interlinked.

```
{wikiDir}/
├── entities/      ← people, organizations, models, tools (proper nouns)
├── concepts/      ← ideas, techniques, architectures (common nouns)
├── sources/       ← summaries of ingested raw sources
├── comparisons/   ← side-by-side analyses (X vs Y)
├── queries/       ← archived answers to significant questions
├── SCHEMA.md      ← structure conventions, tag taxonomy, domain scope
├── index.md       ← catalog of all pages with one-line descriptions
└── log.md         ← append-only record of all wiki operations
```

### Layer 3: The Schema (`{wikiDir}/SCHEMA.md`)

Defines the wiki's conventions: what tags are valid, how pages are structured,
what the domain boundaries are. All pages must conform to the schema.

---

## Session Start Protocol

Before ANY wiki operation, orient yourself by reading three files in this order:

```
1. SCHEMA.md  → understand the domain, conventions, and tag taxonomy
2. index.md   → learn what pages already exist (prevents duplicates)
3. log.md     → scan the last 20-30 entries for recent activity
```

This three-file orientation prevents the most common wiki problems: creating
duplicate pages, missing cross-references, and contradicting established conventions.
If any of these files don't exist yet (fresh wiki), create them as part of the
initialization in the Ingest operation.

---

## Concurrent Sessions

The wiki may be shared — the NAS-backed `wikiDir` is written by other sessions
and skills (e.g. jenkins-log-auto-learning). `log.md` is the coordination
ledger; `index.md` is the hot spot.

- Append to `log.md` immediately after every page write — **before** touching index.md
- Before writing `index.md`, re-read it from disk and merge your entries into
  the current version; never rewrite it from your in-memory copy
- If `log.md` shows entries newer than your last read, re-run the Session Start
  Protocol before continuing (someone ingested concurrently)
- Keep each operation's write window short: pages → log append → index merge,
  in one pass

---

## Core Operations

### Operation 1: Ingest

Transform raw source material into compiled wiki knowledge.

**Trigger**: User provides an article, paper, transcript, URL, or text to add.

#### Steps

1. **Save raw source** to `{rawDir}/{type}/` (articles, papers, or transcripts).
   If the user provides a URL, fetch the content and save as markdown.
   Add a metadata header to the raw file:
   ```markdown
   ---
   title: "{source title}"
   url: "{original URL if applicable}"
   author: "{author}"
   date: "{publication date}"
   ingested: "{today's date}"
   ---
   ```

2. **Read Session Start files** — SCHEMA.md, index.md, log.md (see protocol above).

3. **Discuss takeaways** with the user — summarize the 3-5 key concepts from the
   source. Ask if there are specific aspects they want emphasized before you write
   pages. This conversation step ensures the wiki captures what the user finds
   valuable, not just what seems important in the abstract.
   In batch/autonomous mode (no user available): derive the 3-5 takeaways yourself,
   proceed, and record in `log.md` that this discussion step was auto-passed.

4. **Check existing pages** — for each key concept and entity, search index.md to
   see if a page already exists. Existing pages get updated; only genuinely new
   topics get new pages.

5. **Create or update wiki pages**:
   - Create a source page summarizing the source, named after the page title
     (see Wikilink Rules: filename = title)
   - For each significant entity or concept:
     - If page exists → update it with new information, add the source to references
     - If page doesn't exist → create it (but only if it meets the creation threshold:
       mentioned in 2+ sources, OR central to this source)
   - Add `[[wikilinks]]` to connect related pages (minimum 2 outbound links per page)
   - Every new page must include proper YAML frontmatter (see Page Format below)

6. **Update log.md** — append a timestamped entry describing what was ingested and
   what pages were created/updated. (Log append comes BEFORE the index write, per
   Concurrent Sessions.) One operation = one entry: the later validation outcome
   (step 8) is folded into this same entry, not appended as a separate result row.

7. **Update index.md** — add entries for every new page created, merging into a
   freshly re-read copy from disk. Each entry is
   `- [[Page Name]] — one-line description` (bracketed, so the validator's
   index-completeness check counts it). Never leave a placeholder bracketed
   example in index.md — every `[[X]]` in the file must reference a real page.

8. **Run validation** — execute `validate-wiki.mjs` to check for broken links,
   missing frontmatter, etc. Fix any issues found.

#### Page Creation Threshold

Don't create pages for every noun mentioned in a source. A concept or entity
earns its own page when:
- It appears in **2+ different sources** (cross-referenced enough to warrant a page), OR
- It is **central to a single source** (e.g., the main subject of a paper), OR
- It is a **well-known entity** in the LLM field (e.g., GPT-4, Andrej Karpathy, RLHF)

When in doubt, mention the concept in an existing page as plain text and record it
in `log.md` as a "pending page" candidate. Do NOT leave a `[[wikilink]]` pointing to
a page that doesn't exist — validation hard-fails on any broken link (count must be
0). When a pending candidate accumulates enough support, create the page and link it
then.

### Operation 2: Query

Answer questions using compiled wiki knowledge.

**Trigger**: User asks a question about LLMs, AI, or topics covered in the wiki.

#### Steps

1. **Read index.md** — find pages relevant to the question.

2. **Search wiki pages** — if index.md doesn't surface an obvious match, search
   the wiki directory for keywords from the question.

3. **Read relevant pages** — synthesize an answer from the wiki content. Cite
   pages using `[[Page Name]]` links so the user can follow up.

4. **If the answer is significant**, consider archiving it. Significance rule of
   thumb: archive when the answer synthesizes 3+ pages, resolves a comparison,
   or joins information across pages; skip for direct lookups restatable from a
   single page:
   - Comparison questions → save to `comparisons/` (e.g., "Transformer vs RWKV")
   - Complex multi-page answers → save to `queries/`
   - Simple lookups → don't archive, just answer

5. **If the wiki doesn't cover the topic**, tell the user honestly. Suggest
   ingesting a source about the topic rather than making up an answer.

6. **Update log.md** — append a brief entry noting the query and which pages were
   consulted.

### Operation 3: Lint

Validate wiki consistency and quality.

**Trigger**: User asks to check quality, validate, or lint the wiki.

#### Steps

1. **Run `validate-wiki.mjs`** — this covers the quantitative checks:
   - Broken `[[wikilinks]]` (links to non-existent pages, **including `index.md` catalog links**)
   - Self-references (page linking to itself)
   - Orphan pages (pages with zero inbound links; `index.md` catalog links count as inbound unless `scoring.indexCountsAsInbound` is `false`)
   - Index completeness (every page listed in index.md)
   - Frontmatter validity (required fields present; `type` must be a base type or declared in SCHEMA.md `## Page Types`)
   - Oversized pages (exceeding `page.maxLines`)
   - Minimum outbound links (below `page.minOutboundLinks`)
   - Tag compliance (tags exist in SCHEMA.md taxonomy; version-style tags like `ue5.5` are valid — dots allowed, lowercase required)
   - **Staleness** (raw evidence newer than a page's `updated` date; pass `--raw` or rely on config `knowledgeBase.rawDir`. Report-only unless `scoring.stalenessEnforce` is `true`)

2. **Review the report** — the script outputs a scored report. If score < 9.0,
   fix issues before declaring the wiki healthy. When saving the report or any
   other working file, keep it OUTSIDE `{wikiDir}` — every `.md` inside the wiki
   is counted and validated as a page.

3. **Fix issues** using this priority order:
   - **Stale pages (recurrence loopback first)**: for every page in the staleness
     section, read the newer raw evidence and re-compile the page — see
     [Recurrence Loopback](#recurrence-loopback-cross-skill-contract). A stale
     page means the wiki is serving outdated knowledge; this outranks cosmetic
     fixes. Never just bump `updated` without actually integrating the evidence
   - **Broken links**: Create the missing page if the link is valid, or fix/remove
     the link if it's wrong
   - **Orphan pages**: Add inbound links from related pages, or merge the orphan
     into a parent page if it's too small to stand alone
   - **Missing frontmatter**: Add the required YAML fields
   - **Oversized pages**: Split into focused sub-pages with cross-references
   - **Under-linked pages**: Add relevant `[[wikilinks]]` to related concepts

4. **Re-run validation** — loop until score >= 9.0, broken links = 0, and the
   staleness section is clear (or explicitly reported as a backlog the user
   accepted).

5. **Update log.md** — record the lint results and fixes applied. One operation
   = one entry: fold the validation outcome into the lint entry itself instead
   of appending a separate result entry.

---

## Recurrence Loopback (cross-skill contract)

The wiki's core promise is *compiled once, kept current*. The highest-signal
moment to update knowledge is when **raw evidence arrives that is newer than
the page** — above all, a recurrence: the same error pattern came back after a
documented fix. The validator's staleness section surfaces exactly these pages;
this section defines what must happen next.

**Contract with raw-side producers** (e.g. jenkins-log-auto-learning, which is
forbidden by its own constraints from writing `wikiDir`):

1. A recurrence record is written to `{rawDir}/details/recurrence-{PageStem}.md`
   with a `recorded_at` frontmatter date and a pointer to the existing wiki
   page. The naming convention is the handoff signal — this skill owns the
   loopback.
2. On the wiki side, loopback for each stale page means:
   - Read the raw evidence (the recurrence record and, if needed, the pair it
     references)
   - Append or update a `## Recurrence` section on the page: date, build(s),
     recurrence count if tracked, and the delta vs the original analysis
     (same root cause? new variant? was the original fix incomplete?)
   - If the new evidence contradicts the page's original analysis, document
     both with dates per [Handling Contradictions](#handling-contradictions) —
     do not silently rewrite history
   - Bump `updated:` to the loopback date (the page must never be older than
     the evidence it cites)
3. Loopback acceptance: for every file matching
   `{rawDir}/**/recurrence-*.md`, the referenced page's `updated` date is
   >= that file's `recorded_at` date. The staleness section of
   `validate-wiki.mjs` enforces this mechanically once
   `scoring.stalenessEnforce` is enabled.
4. One `log.md` entry covers the whole loopback batch (operation:
   `recurrence-loopback`), listing the pages updated and evidence files consumed.

Layer boundaries hold: raw stays immutable, only this skill writes `wikiDir`,
and the recurrence record itself is never edited after being recorded.

---

## Page Format

Every wiki page must include YAML frontmatter and follow a consistent structure.
This makes pages machine-parseable (compatible with Obsidian) and ensures quality.

### Required Frontmatter

```yaml
---
title: "Page Title"
created: 2026-04-13
updated: 2026-04-13
type: entity | concept | source | comparison | query
tags: [tag1, tag2]
sources: ["Source Name 1", "Source Name 2"]
---
```

All tags must be defined in SCHEMA.md. If you need a new tag, add it to SCHEMA.md
first, then use it. Likewise, `type` must be one of the five base types above —
if a deployment needs an extra type (e.g. `jenkins-error`), declare it in a
`## Page Types` section of SCHEMA.md first; the validator accepts base types
plus everything declared there.

When adding frontmatter to an existing page that lacks it (e.g., during Lint
fixes), keep `created` as the page's original creation date if it can be
determined; otherwise use today's date and note the retro-fill in `log.md`.

### Page Structure by Type

Full templates for all five page types live in
[references/page-templates.md](references/page-templates.md) — read it when
creating pages. Summary:

| Type | Lives in | Typical sections |
|------|----------|------------------|
| entity | `entities/` | Key Facts, Significance, Related |
| concept | `concepts/` | How It Works, Variants, History, Related |
| source | `sources/` | Key Takeaways, Concepts Introduced, (Notable Quotes) |
| comparison | `comparisons/` | see full template in references |
| query | `queries/` | see full template in references |

### Wikilink Rules

- All `[[Page Name]]` links must point to an actual `.md` file in the wiki
- Entity pages live in `entities/`, concepts in `concepts/`, sources in `sources/`
- **Do NOT create cross-directory relative paths** (e.g., `../concepts/foo.md`)
  — use plain `[[Page Name]]` and let the validation script resolve locations
- **Filename = page title**: `[[Page Name]]` resolves to a file literally named
  `Page Name.md`. Do not slugify filenames
  (wrong: `sources/attention-is-all-you-need.md`;
  right: `sources/Attention Is All You Need.md`)
- The validator resolves links within the canonical directories plus any
  directories declared in SCHEMA.md `## Page Directories` (a deployment may
  host pages in additional directories, e.g. `details/`; declare them or links
  into them read as broken). A page placed outside all of these reads as a
  broken link
- `[[Page Name]]` must be the exact page title: no alias syntax
  (`[[Page|alias]]` unsupported) and no line wrapping inside the brackets
- If a source page and a concept/entity page would share the same title,
  disambiguate the **source** page (e.g., use the work's full title or add a
  qualifier like `(paper)`); two pages with the same basename in different
  directories make `[[Title]]` resolution ambiguous
- Every page must have at least 2 outbound `[[wikilinks]]`
- Avoid self-references (a page linking to itself)

### Handling Contradictions

When sources disagree (e.g., different parameter counts for a model), don't silently
pick one. Document both with dates and sources:

```markdown
## Parameter Count
- **175B** according to [[GPT-3 Paper]] (2020)
- **~170B** estimated by [[Scaling Laws Analysis]] (2023)
Note: The discrepancy may reflect different counting methodologies (with/without
embedding parameters).
```

### Page Size Limits

If a page exceeds 200 lines, split it. Create focused sub-pages and link them
from a parent page. For example, "Transformer" might split into:
- `[[Transformer]]` — overview and significance
- `[[Transformer Architecture]]` — detailed architecture
- `[[Transformer Training]]` — training techniques

---

## Wiki Initialization

When starting a fresh wiki (no existing files), create these foundation files:

### SCHEMA.md

```markdown
# Wiki Schema

## Domain
LLMs, deep learning, AI research, ML systems, and related topics.

## Tag Taxonomy
<!-- At initialization, copy the FULL tag groups from
     references/tagging-taxonomy.md into this section, REPLACING this comment.
     STRIP the backticks and descriptions: SCHEMA lists bare tokens
     (e.g. `- person`), because that is what the validator parses. That file is
     the single source of truth for tags — do not maintain a second, diverging
     list here. -->

## Page Types
<!-- Optional. Base types (entity/concept/source/comparison/query) are always
     valid; list ONLY deployment-specific extensions here, one per line
     (e.g. `- jenkins-error`). The validator reads this section. -->

## Page Directories
<!-- Optional. List additional page directories beyond the canonical five
     (e.g. `- details/`). The validator resolves [[links]] and counts pages
     there. Leave empty for a standard LLM-domain wiki. -->

## Conventions
- Page titles use Title Case
- Tags use lowercase-kebab-case
- Dates use YYYY-MM-DD format
- Files use UTF-8 without BOM; LF or CRLF line endings both accepted
```

### index.md

```markdown
# Wiki Index

> Auto-maintained catalog. One line per page: `- Page Name — one-line description`

## Entities

## Concepts

## Sources

## Comparisons

## Queries
```

### log.md

```markdown
# Wiki Log

> Append-only record of all wiki operations. Most recent entries at the bottom.

| Date | Operation | Details |
|------|-----------|---------|
```

---

## Advanced reference

For the validation script, detailed references, and operational constraints, read [references/validation-and-constraints.md](references/validation-and-constraints.md) when implementing or reviewing the wiki pipeline.
