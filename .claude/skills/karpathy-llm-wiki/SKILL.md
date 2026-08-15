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
- **Environment** `~/.claude/skill-env.json` (never committed): holds the real `knowledgeBase.wikiDir` / `knowledgeBase.rawDir` for this machine. Override the path with the `SKILL_ENV` env var.

The `knowledgeBase` namespace is **shared with other skills** on this machine (e.g. jenkins-log-auto-learning) — both point at the same physical wiki/raw directories, so the values live in exactly one place.

Key fields (after merge):
- `knowledgeBase.wikiDir` — **the wiki knowledge base** — all wiki pages (`entities/`, `concepts/`, `SCHEMA.md`, `index.md`, `log.md`) and all output go here.
- `knowledgeBase.rawDir` — raw source materials storage (original articles, papers, transcripts that get ingested).
- `scoring.minScore` — minimum quality score to pass validation (default: 9.0)
- `page.maxLines` — maximum lines per page before splitting (default: 200)
- `page.minOutboundLinks` — minimum `[[wikilinks]]` per page (default: 2)

Do NOT hardcode paths — always read them from the merged config.

### Path Resolution (Phase 0)

After reading config.json, **normalize ALL path values** before using them anywhere. Config paths may use three styles:

1. **`~/...`** (tilde prefix) — expand `~` to the user's home directory. In Node: `path.join(os.homedir(), configPath.replace(/^~[\\/]/, ''))`. Example: `~/memory/jenkins-learnings` → `<home>/memory/jenkins-learnings`
2. **`./...`** (dot-slash relative) — resolve relative to the **current working directory** (NOT the skill directory). In Node: `path.resolve(configPath)`. Example: `./wiki-raw/jenkins-learnings` → `<cwd>/wiki-raw/jenkins-learnings`
3. **Absolute paths** — use as-is. Forward slashes work on Windows.

**Apply this resolution to**: `knowledgeBase.wikiDir`, `knowledgeBase.rawDir`.

After resolving, verify each directory exists with `fs.existsSync`. If any directory does not exist, create it with `fs.mkdirSync(dir, { recursive: true })`.

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

**Naming convention**: `{YYYY-MM-DD}-{slug}.md`
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

4. **Check existing pages** — for each key concept and entity, search index.md to
   see if a page already exists. Existing pages get updated; only genuinely new
   topics get new pages.

5. **Create or update wiki pages**:
   - Create a `sources/{slug}.md` page summarizing the source
   - For each significant entity or concept:
     - If page exists → update it with new information, add the source to references
     - If page doesn't exist → create it (but only if it meets the creation threshold:
       mentioned in 2+ sources, OR central to this source)
   - Add `[[wikilinks]]` to connect related pages (minimum 2 outbound links per page)
   - Every new page must include proper YAML frontmatter (see Page Format below)

6. **Update index.md** — add entries for every new page created.

7. **Update log.md** — append a timestamped entry describing what was ingested and
   what pages were created/updated.

8. **Run validation** — execute `validate-wiki.mjs` to check for broken links,
   missing frontmatter, etc. Fix any issues found.

#### Page Creation Threshold

Don't create pages for every noun mentioned in a source. A concept or entity
earns its own page when:
- It appears in **2+ different sources** (cross-referenced enough to warrant a page), OR
- It is **central to a single source** (e.g., the main subject of a paper), OR
- It is a **well-known entity** in the LLM field (e.g., GPT-4, Andrej Karpathy, RLHF)

When in doubt, mention the concept in an existing page with a `[[wikilink]]` — if
the link becomes a dead link, that's a signal it deserves its own page later.

### Operation 2: Query

Answer questions using compiled wiki knowledge.

**Trigger**: User asks a question about LLMs, AI, or topics covered in the wiki.

#### Steps

1. **Read index.md** — find pages relevant to the question.

2. **Search wiki pages** — if index.md doesn't surface an obvious match, search
   the wiki directory for keywords from the question.

3. **Read relevant pages** — synthesize an answer from the wiki content. Cite
   pages using `[[Page Name]]` links so the user can follow up.

4. **If the answer is significant**, consider archiving it:
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
   - Broken `[[wikilinks]]` (links to non-existent pages)
   - Self-references (page linking to itself)
   - Orphan pages (pages with zero inbound links)
   - Index completeness (every page listed in index.md)
   - Frontmatter validity (required fields present)
   - Oversized pages (exceeding `page.maxLines`)
   - Minimum outbound links (below `page.minOutboundLinks`)
   - Tag compliance (tags exist in SCHEMA.md taxonomy)

2. **Review the report** — the script outputs a scored report. If score < 9.0,
   fix issues before declaring the wiki healthy.

3. **Fix issues** using this priority order:
   - **Broken links**: Create the missing page if the link is valid, or fix/remove
     the link if it's wrong
   - **Orphan pages**: Add inbound links from related pages, or merge the orphan
     into a parent page if it's too small to stand alone
   - **Missing frontmatter**: Add the required YAML fields
   - **Oversized pages**: Split into focused sub-pages with cross-references
   - **Under-linked pages**: Add relevant `[[wikilinks]]` to related concepts

4. **Re-run validation** — loop until score >= 9.0 and broken links = 0.

5. **Update log.md** — record the lint results and fixes applied.

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
first, then use it.

### Page Structure by Type

**Entity** (people, orgs, models):
```markdown
---
title: "GPT-4"
type: entity
tags: [model, openai, multimodal]
sources: ["GPT-4 Technical Report"]
---
# GPT-4
Brief description (1-2 sentences).
## Key Facts
- Release date, parameters, capabilities
## Significance
Why this matters in the LLM landscape.
## Related
- [[OpenAI]], [[Transformer]], [[RLHF]]
```

**Concept** (techniques, architectures):
```markdown
---
title: "Attention Mechanism"
type: concept
tags: [architecture, transformer, core-concept]
sources: ["Attention Is All You Need"]
---
# Attention Mechanism
Clear explanation of the concept.
## How It Works
Technical details, accessible but accurate.
## Variants
- [[Multi-Head Attention]], [[Flash Attention]]
## History
Where it came from and how it evolved.
```

**Source** (summaries of ingested material):
```markdown
---
title: "Attention Is All You Need"
type: source
tags: [paper, google, transformer]
sources: []
---
# Attention Is All You Need
> Authors: Vaswani et al. | Year: 2017 | Type: Paper
## Key Takeaways
- 3-5 bullet points
## Concepts Introduced
- [[Transformer]], [[Multi-Head Attention]], [[Positional Encoding]]
## Notable Quotes
(optional — only if genuinely illuminating)
```

See [references/page-templates.md](references/page-templates.md) for comparison
and query page templates.

### Wikilink Rules

- All `[[Page Name]]` links must point to an actual `.md` file in the wiki
- Entity pages live in `entities/`, concepts in `concepts/`, sources in `sources/`
- **Do NOT create cross-directory relative paths** (e.g., `../concepts/foo.md`)
  — use plain `[[Page Name]]` and let the validation script resolve locations
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
### Core
- architecture
- training
- inference
- evaluation
- safety
- alignment

### Models
- model
- language-model
- multimodal
- open-source
- closed-source

### Techniques
- attention
- fine-tuning
- rlhf
- prompting
- retrieval
- quantization

### Topics
- scaling-laws
- emergent-abilities
- tokenization
- embeddings

### Meta
- paper
- blog
- talk
- tutorial
- core-concept
- historical

## Conventions
- Page titles use Title Case
- Tags use lowercase-kebab-case
- Dates use YYYY-MM-DD format
- All files use UTF-8 without BOM, CRLF line endings
```

### index.md

```markdown
# Wiki Index

> Auto-maintained catalog. One line per page: `- [[Page Name]] — one-line description`

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

## Validation Script

The `scripts/validate-wiki.mjs` script performs comprehensive quality checks.

### Usage

```bash
# {skill-dir} 是包含此 SKILL.md 的目录；{wikiDir} 来自 config.json
node {skill-dir}/scripts/validate-wiki.mjs --wiki "{wikiDir}" --config "{skill-dir}/config.json"
```

### What It Checks (8 dimensions)

| Dimension | Weight | What It Checks |
|-----------|--------|----------------|
| Broken Links | 25% | `[[wikilinks]]` pointing to non-existent pages |
| Self References | 10% | Pages linking to themselves |
| Orphan Pages | 10% | Pages with zero inbound links |
| Index Completeness | 15% | Every page listed in index.md |
| Frontmatter | 15% | Required YAML fields present and valid |
| Page Size | 10% | No page exceeds maxLines |
| Outbound Links | 10% | Every page has >= minOutboundLinks |
| Tag Compliance | 5% | All tags defined in SCHEMA.md |

### Completion Standard

The wiki passes validation when:
- [ ] Validation script runs without errors
- [ ] Broken link count = 0
- [ ] Total score >= 9.0/10
- [ ] Validation report generated

### Dead Link Fix Strategy

When broken links are found:
1. **Create missing page** — if the link target is a legitimate concept/entity
2. **Remove the link** — if the link target is not worth a page
3. **Correct the link** — if the target exists but with a different name

---

## Detailed References

| Topic | File |
|-------|------|
| Page templates (all types) | [references/page-templates.md](references/page-templates.md) |
| Tag taxonomy and guidelines | [references/tagging-taxonomy.md](references/tagging-taxonomy.md) |

Read the reference file when you need template details or tag guidance.

---

## Constraints

1. **Never modify raw sources**: Files in `{rawDir}` are immutable after ingestion
2. **Session start protocol**: Always read SCHEMA.md → index.md → log.md before operating
3. **Config-driven paths**: All paths from config.json, no hardcoding
4. **UTF-8 without BOM**: All output files, CRLF line endings
5. **Obsidian compatible**: Wikilinks use `[[Page Name]]` format, YAML frontmatter in every page
6. **Update index + log**: Every operation that creates or modifies pages must update both files
7. **Page quality gates**: Minimum 2 outbound wikilinks, maximum 200 lines, valid frontmatter
8. **Tag discipline**: Only use tags defined in SCHEMA.md; add new tags to schema first
9. **No speculative pages**: Only create pages meeting the creation threshold (2+ sources or central to one)
10. **Graceful on empty wiki**: If wiki is uninitialized, create SCHEMA.md, index.md, and log.md first
