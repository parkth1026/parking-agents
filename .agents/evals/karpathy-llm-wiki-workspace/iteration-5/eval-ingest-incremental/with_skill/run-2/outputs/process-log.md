# Process Log — eval-ingest-incremental / with_skill / run-2

- Date: 2026-08-18
- Skill: karpathy-llm-wiki (read-only; nothing in the skill dir was modified)
- Config env layer: `SKILL_ENV=D:\GIT_dev\parking-agents\.agents\evals\karpathy-llm-wiki-workspace\iteration-5\mock-env\eval-ingest-incremental-run2.json`
- Mode: batch (user unavailable); all "discuss/confirm" steps auto-passed with recorded decisions

## 1. Protocol steps executed, in order

| # | Step (per SKILL.md) | Action taken |
|---|---------------------|--------------|
| 0 | Phase 0: read + resolve config | Read skill `config.json`; resolved env layer via `SKILL_ENV` (chain: `SKILL_ENV` > `~/.config/parking-agents/skill-env.json`; the home fallback was never touched); deep-merged env over skill defaults; normalized paths (absolute Windows paths → used as-is). Verified existence: `wikiDir` = true, `rawDir` = **false** |
| 0b | Baseline validation (extra, read-only) | `validate-wiki.mjs` on the pre-existing wiki: 3 pages, 10.00/10 PASS |
| 1 | Ingest step 1: save raw source | Created missing `rawDir` and its `articles/` subdir, plus `wiki/sources/` (batch authorization, see friction F1); saved `wiki-raw/articles/2026-08-18-flash-attention.md` — user text verbatim + metadata header (title/author/date/ingested) |
| 2 | Ingest step 2: Session Start Protocol | Read `SCHEMA.md` → `index.md` → `log.md` (first pass before planning; re-read from disk after the raw save — unchanged, no concurrent writer) |
| 3 | Ingest step 3: discuss takeaways | Batch mode → auto-passed per the skill's own clause; derived 4 takeaways: (a) IO-aware exact attention, O(N^2)→O(N) memory via tiling, never materializes the N×N matrix; (b) 2-4x wall-clock speedup over standard attention in PyTorch; (c) FlashAttention-2 = better work partitioning across GPU thread blocks; (d) bottleneck is memory bandwidth, not FLOPs. Recorded in `log.md` |
| 4 | Ingest step 4: check existing pages | `index.md` lists only Transformer / Attention Mechanism / Neural Network. No FlashAttention or Tri Dao page exists. Creation-threshold verdicts: FlashAttention = central to this source → new concept page; Tri Dao, PyTorch, FlashAttention-2, memory-bandwidth = single mention → plain text + "pending page" candidates in `log.md` |
| 5 | Ingest step 5: create/update pages | Created `concepts/FlashAttention.md` (tags [attention, inference, hardware], 3 outbound links) and `sources/FlashAttention (article).md` (tags [blog, attention], 3 outbound links). Updated `concepts/Attention Mechanism.md` (new Variants bullet linking FlashAttention; `updated` date; sources += "FlashAttention (article)") and `concepts/Transformer.md` (new Key Ideas bullet on O(N^2)→O(N) attention memory; same frontmatter updates). Added tags `inference`/`hardware`/`blog` to `SCHEMA.md` FIRST (tag discipline: schema before use). `Neural Network` untouched (no relevant new info) |
| 6 | Concurrent-sessions write order | Appended one consolidated entry to `log.md` immediately after the page-write pass and BEFORE touching `index.md`; then re-read `index.md` from disk and merged 2 new catalog lines into the current version |
| 7 | Ingest steps 6-7: index + log | `index.md`: + `[[FlashAttention]]` (Concepts), + `[[FlashAttention (article)]]` (Sources). `log.md`: ingest entry (with auto-passed discussion + autonomous decisions + pending candidates) and lint entry |
| 8 | Ingest step 8: validation | `validate-wiki.mjs --wiki <wikiDir> --config <skill>/config.json` → 5 pages, 0 broken links, all 8 dimensions 10/10, **Total 10.00/10 PASS** (threshold 9.0). No fixes needed, no re-run loop |
| 9 | Encoding hygiene (extra) | Node check: all 8 touched .md files are UTF-8 without BOM; pages start with `---` |
| 10 | Report placement | Full validation report embedded below (kept OUTSIDE `{wikiDir}`); no report .md written inside the wiki |

## 2. Ambiguities / spots that forced an autonomous decision

**F1 — Missing configured dirs & who authorizes them.**
SKILL.md Phase 0: "Creating a missing directory is a persistent write: show the resolved paths and get user confirmation before calling `fs.mkdirSync`... In batch/autonomous mode, a task that explicitly requires wiki operations implies authorization for creating the configured directories — proceed and record the decision in `log.md`."
The clause covers "the configured directories", but the wiki was also missing its canonical `sources/` subdir (Layer 2 layout shows it, yet no rule says who creates it for an EXISTING wiki). Decision: batch ingest implies authorization for both; created `wiki-raw/articles/` and `wiki/sources/`, recorded in `log.md`.

**F2 — Contradictory write order: log vs index.**
Ingest steps say: "6. **Update index.md** ... 7. **Update log.md** — append a timestamped entry..." but Concurrent Sessions says: "Append to `log.md` immediately after every page write — **before** touching index.md".
Decision: followed the Concurrent Sessions ordering (log append before index merge), since that section explicitly exists to protect the coordination ledger. Also fuzzy: "immediately after every page write" read literally means one log row per page; I appended one consolidated entry after the page-write pass (matches step 7's single-entry phrasing).

**F3 — Source page title vs near-collision.**
Wikilink Rules: "If a source page and a concept/entity page would share the same title, disambiguate the **source** page (e.g., use the work's full title or add a qualifier like `(paper)`)". The user's text has no explicit title; "Flash Attention" (source) vs "FlashAttention" (concept) are not *literally* identical, so the rule doesn't strictly trigger — but a one-space-difference pair is human-confusing, and the rule's example qualifier `(paper)` doesn't fit (the artifact is a user-provided article summary, not the paper PDF).
Decision: named the source page `FlashAttention (article)`; concept stays `FlashAttention`. Recorded in `log.md`.

**F4 — Raw metadata header with missing values.**
Ingest step 1 template: `title / url / author / date / ingested` with "url: {original URL if applicable}" — only url is marked optional. This source has no URL, no author, no publication date.
Decision: omitted the url line; `author: "Unattributed user-provided summary (subject work authored by Tri Dao)"`; `date: "unknown"`; `ingested: 2026-08-18` (which is also the filename date, per the naming convention).

**F5 — Creation threshold tension for well-known entities.**
Threshold: a page is earned if "mentioned in 2+ different sources ... OR central to a single source ... OR a **well-known entity** in the LLM field (e.g., GPT-4, Andrej Karpathy, RLHF)" — yet also: "When in doubt, mention the concept in an existing page as plain text and record it in `log.md` as a 'pending page' candidate."
Tri Dao and PyTorch arguably pass the "well-known entity" branch, but a 1-paragraph source gives almost no page material. Decision: conservative path — plain-text mentions + pending candidates in `log.md`; revisit when a second source lands.

**F6 — Which file is the tag authority for an existing wiki.**
SKILL.md: "All tags must be defined in SCHEMA.md. If you need a new tag, add it to SCHEMA.md first" vs tagging-taxonomy.md rule 4: "Add new tags to this file before using them in a page" (and the SCHEMA init comment calls taxonomy "the single source of truth for tags"). The sandbox wiki's SCHEMA has a reduced 7-tag taxonomy; the skill dir is read-only for this run.
Decision: added new tags to the *wiki's* SCHEMA.md, choosing tokens that already exist in `references/tagging-taxonomy.md` (`inference`, `hardware`, `blog`) so the two lists stay compatible; taxonomy file untouched. Note: the sandbox SCHEMA lumps `paper` under "Meta" while canonical has a "Source Types" group — I placed `blog` beside `paper` to preserve the local structure.

**F7 — Where to save the validation report.**
Lint step 2: "keep it OUTSIDE `{wikiDir}` — every `.md` inside the wiki is counted and validated as a page" — but no concrete destination is given (repo AGENTS.md would say `docs/reports/`, which this sandbox forbids).
Decision: embedded the full report in this process log at the outputs root; no extra .md inside the wiki.

**F8 (minor, observed only) — validator/skill drift.**
`validate-wiki.mjs` SEARCH_DIRS includes `details`, `scratch`, `patterns` and the wiki root (`""`), none of which appear in the SKILL.md Layer 2 layout; conversely the validator ignores files in any `raw/` dir. No action needed for this run.

## 3. Commands run (chronological)

```bash
# 1. Phase 0 config resolution (SKILL_ENV chain; merged config + dir existence)
SKILL_ENV='D:\...\iteration-5\mock-env\eval-ingest-incremental-run2.json' node - <<'EOF' ... EOF
#    -> wikiDir exists: true; rawDir exists: false

# 2. Baseline validation
node "D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki\scripts\validate-wiki.mjs" \
  --wiki "D:\...\outputs\wiki" \
  --config "D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki\config.json"
#    -> 3 pages, Total 10.00/10 PASS (exit 0)

# 3. Create missing dirs (batch authorization)
mkdir -p "...\outputs\wiki-raw\articles" "...\outputs\wiki\sources"

# 4-7. File writes via editor tools (not shell):
#    wiki-raw/articles/2026-08-18-flash-attention.md   (new, raw layer)
#    wiki/SCHEMA.md                                    (tags +inference +hardware +blog)
#    wiki/concepts/FlashAttention.md                   (new)
#    wiki/sources/FlashAttention (article).md          (new)
#    wiki/concepts/Attention Mechanism.md              (updated)
#    wiki/concepts/Transformer.md                      (updated)
#    wiki/log.md                                       (ingest + lint entries appended)
#    wiki/index.md                                     (2 catalog lines merged)

# 8. Post-ingest validation (same command as #2)
#    -> 5 pages, Total 10.00/10 PASS (exit 0)

# 9. BOM/encoding hygiene check (node script over all 8 touched files)
#    -> all "ok", no BOM; pages start with "---"
```

## 4. Final validation report (verbatim)

```
=== Wiki Validation Script v5 ===
Found 5 wiki pages

=== Dimension Scores ===
  Broken Links              10/10  (weight: 25%)
  Self References           10/10  (weight: 10%)
  Orphan Pages              10/10  (weight: 10%)
  Index Completeness        10/10  (weight: 15%)
  Frontmatter               10/10  (weight: 15%)
  Page Size                 10/10  (weight: 10%)
  Outbound Links            10/10  (weight: 10%)
  Tag Compliance            10/10  (weight: 5%)

=== Issues ===
(none)

=== Final Score ===
  Total: 10.00 / 10
  Threshold: 9 / 10
  Status: PASS
```

**Final validation score: 10.00 / 10 — PASS** (0 broken links, 0 issues, 5 pages, exit code 0).
