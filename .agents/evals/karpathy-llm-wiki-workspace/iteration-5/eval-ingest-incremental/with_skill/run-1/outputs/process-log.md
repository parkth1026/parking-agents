# Process Log — eval-ingest-incremental / with_skill / run-1

- Date: 2026-08-18
- Skill: karpathy-llm-wiki (`D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki`) — read-only, unmodified
- Task (verbatim): ingest the user-provided Flash Attention article into the pre-existing wiki and connect it to existing attention/transformer pages.
- SKILL_ENV: `D:\GIT_dev\parking-agents\.agents\evals\karpathy-llm-wiki-workspace\iteration-5\mock-env\eval-ingest-incremental-run1.json`
- Resolved paths (Phase 0): wikiDir = `<outputs>\wiki` (exists), rawDir = `<outputs>\wiki-raw` (exists)
- Final validation (this pass, own run): **10.00 / 10 — PASS**, exit code 0, 6 pages, 0 broken links, 0 issues

## 0. Run-integrity note (what actually happened)

On entry, the output directory already contained a complete, protocol-conformant result of this
exact task, written today 23:25–23:33 by a prior pass of this run that evidently never delivered
its final report (its ingest + lint rows were already in `log.md`, and an earlier draft of this
process log existed). Evidence used to reconstruct this: file mtimes, `log.md` rows dated
2026-08-18 matching the task 1:1, and content audit below. Decision (autonomous, batch mode):
**do not redo** — the skill's own duplicate guard ("Existing pages get updated; only genuinely
new topics get new pages") forbids re-creating existing pages, and re-ingesting would corrupt the
append-only ledger. Instead this pass executed the full protocol as a **verification pass**:
Session Start re-read, step-by-step audit of every ingest artifact against SKILL.md and the
reference templates, fresh Phase 0 config resolution, fresh validator run, and this rewritten
process log. The audit found nothing to fix; only one append was made to `log.md` (the
verification row, per Operation 3 step 5 "record the lint results").

All artifact writes listed below were performed by the prior pass; **this pass verified each one**
(read every file, checked every rule). Page contents are quoted/summarized only where load-bearing.

## 1. Protocol steps executed, in order

### Phase 0 — Configuration & path resolution
1. Read `SKILL.md`, `config.json`, `references/page-templates.md`, `references/tagging-taxonomy.md`,
   `references/validation-and-constraints.md`, `scripts/validate-wiki.mjs` (all under the skill dir; read-only).
2. Resolved config via the documented chain `SKILL_ENV env var > ~/.config/parking-agents/skill-env.json`.
   Set `SKILL_ENV` to the mock env file; chain hit at the first link, so `~/.config` was never read
   (also a task constraint).
3. Deep-merged env layer (only `knowledgeBase`) over skill defaults. Merged result:
   `scoring.minScore=9.0`, `scoring.indexCountsAsInbound=true`, `page.minOutboundLinks=2`,
   `page.maxLines=200`, weights as in skill config.
4. Normalized paths (mock env uses absolute Windows paths → used as-is). Verified existence:
   both `wikiDir` and `rawDir` exist. (In the prior pass `rawDir` was missing and was auto-created
   under the SKILL.md autonomous rule: "In batch/autonomous mode, a task that explicitly requires
   wiki operations implies authorization for creating the configured directories — proceed and
   record the decision in `log.md`." Recorded in its ingest row.)

### Session Start Protocol (before any wiki operation)
5. Read `SCHEMA.md` — domain OK; tag taxonomy is a reduced set (10 tags), not the full
   reference taxonomy.
6. Read `index.md` — prior pass state: 6 pages (3 pre-existing concepts + Flash Attention concept,
   Tri Dao entity, Flash Attention (article) source).
7. Read `log.md` — pre-existing 2026-08-10 ingest row; prior-pass 2026-08-18 ingest + lint rows;
   no concurrent-session activity (fewer than 20-30 entries).

### Operation 1: Ingest — audit of each step's outcome
8. **Step 1 (save raw source)** — VERIFIED: `wiki-raw\articles\2026-08-18-flash-attention.md`
   contains the user's text verbatim plus the required metadata header
   (`title` / `url` / `author` / `date` / `ingested: 2026-08-18`); file untouched since 23:31:52
   (immutability constraint respected). Type dir `articles/` matches the user's own word.
   Naming `{ingestion-date}-{slug}.md` conforms.
9. **Step 2 (session-start files)** — VERIFIED read-before-write ordering was respected in the
   prior pass (mtimes: pages 23:32:12 > orientation reads; the stricter "Before ANY wiki
   operation" reading satisfied).
10. **Step 3 (discuss takeaways)** — VERIFIED: batch mode auto-pass recorded in `log.md`
    ("takeaway-discussion step auto-passed") with the 5 derived takeaways, exactly as SKILL.md
    prescribes ("derive the 3-5 takeaways yourself, proceed, and record in `log.md` that this
    discussion step was auto-passed").
11. **Step 4 (check existing pages)** — VERIFIED against pre-existing `index.md` state (from
    `log.md` 2026-08-10 row + mtimes): no Flash Attention / Tri Dao pages existed before. Creation
    calls: `Flash Attention` concept (central to the source — threshold met), `Tri Dao` entity
    (well-known entity bullet), `FlashAttention-2` / `PyTorch` / memory-bandwidth-vs-FLOPs kept as
    plain text and recorded as pending candidates (single mention, below threshold) — conforms to
    the "No speculative pages" constraint.
12. **Step 5 (create/update pages)** — VERIFIED against `references/page-templates.md`:
    - `wiki\concepts\Flash Attention.md` — concept template (How It Works / Variants / History /
      Related), frontmatter complete, tags `[attention, inference]`, 3 distinct outbound targets,
      captures all 5 source claims (IO-aware exact algorithm; O(N^2)→O(N) via tiling without
      materializing the matrix; 2-4x PyTorch speedup; FlashAttention-2 thread-block partitioning;
      bandwidth-not-FLOPs insight).
    - `wiki\entities\Tri Dao.md` — entity template (Key Facts / Significance / Related), tags
      `[person, attention]`, 3 outbound links.
    - `wiki\sources\Flash Attention (article).md` — source template (Key Takeaways / Concepts
      Introduced / Critical Notes), tags `[paper, attention]`, `sources: []` per template,
      4 outbound links.
    - `wiki\concepts\Attention Mechanism.md` — updated: Flash Attention added under Variants,
      memory-bound note added, source added to frontmatter, `updated` bumped to 2026-08-18
      (`created` preserved at 2026-08-10).
    - `wiki\concepts\Transformer.md` — updated: long-context/Flash Attention line in Key Ideas,
      efficiency line in Significance, source added, `updated` bumped.
    - Tag discipline: `inference` and `person` were added to `SCHEMA.md` **before** the pages used
      them ("add it to SCHEMA.md first"); both already existed in
      `references/tagging-taxonomy.md`.
    - User's connection requirement satisfied bidirectionally:
      Attention Mechanism ⇄ Flash Attention and Transformer ⇄ Flash Attention.
13. **Step 6 (update index.md)** — VERIFIED: all 6 pages listed (Entities / Concepts / Sources
    sections), every `[[X]]` in `index.md` resolves to a real page, no placeholder brackets.
14. **Step 7 (update log.md)** — VERIFIED: timestamped ingest row with decisions + pending
    candidates; this pass appended the verification lint row afterward.
15. **Step 8 (run validation)** — re-executed fresh by this pass (command below): PASS 10.00/10.

### Operation 3: Lint (verification pass)
16. Ran `validate-wiki.mjs` fresh (see §3) → PASS, exit 0, no issues, no fixes needed.
17. Appended verification row to `log.md` including a minor non-acting observation
    (pre-existing frontmatter `sources` cites "Attention Is All You Need" with no matching source
    page — plain metadata, not a wikilink, no validation impact; creating a page for an unavailable
    source would violate the no-speculative-pages rule).
18. Validation report kept OUTSIDE `{wikiDir}` — captured to `%TEMP%\validation-eval-run1-verify.txt`;
    this process log lives in `<outputs>`, also outside the wiki.

## 2. Ambiguities / gaps / forced decisions (with quotes)

1. **Resume-vs-redo when a prior pass's complete output is already on disk.**
   SKILL.md has "Concurrent Sessions" guidance keyed to `log.md` ("If `log.md` shows entries newer
   than your last read, re-run the Session Start Protocol before continuing") but says nothing
   about resuming a run whose artifacts are complete but whose final report was never delivered.
   Decision: treat `log.md` as the source of truth (it showed the ingest recorded), verify rather
   than redo, append one lint row. Redoing would have violated "Existing pages get updated; only
   genuinely new topics get new pages" and corrupted the append-only ledger.

2. **Raw-source type dir: "articles" vs "papers".**
   SKILL.md: "Save raw source to `{rawDir}/{type}/` (articles, papers, or transcripts)." The user
   called the input an "article", though it summarizes research papers (FlashAttention 1/2).
   Decision (prior pass, endorsed): `articles/` — follow the user's own word; the source page tag
   `paper` records the paper-ness.

3. **Source-page title collision with concept page.**
   SKILL.md: "disambiguate the **source** page (e.g., use the work's full title or add a qualifier
   like `(paper)`)" — but the artifact is an article *about* the papers, not a paper, and no full
   title was given. Decision (prior pass, endorsed): `Flash Attention (article)`; bare
   `Flash Attention` for the concept.

4. **Tri Dao page-creation threshold.**
   Threshold bullets allow "a **well-known entity** in the LLM field (e.g., GPT-4, Andrej
   Karpathy, RLHF)" while "When in doubt, mention the concept in an existing page as plain text".
   Tri Dao is named once in the source. Decision (prior pass, endorsed): created the entity page —
   "well-known entity" plausibly covers people (the Karpathy example), and he is the subject's
   author.

5. **Reduced SCHEMA taxonomy vs reference taxonomy.**
   Initialization says SCHEMA should "copy the FULL tag groups from
   references/tagging-taxonomy.md … that file is the single source of truth for tags — do not
   maintain a second, diverging list here" — yet the pre-existing wiki's SCHEMA.md contains a
   reduced set, and SKILL.md gives no rule for reconciling an existing reduced taxonomy.
   Decision (prior pass, endorsed): add only the two tags needed (`inference`, `person`, both
   present in the reference file) rather than re-syncing the full list — minimal change, though
   the "single source of truth" wording cuts the other way.

6. **Raw metadata fields with unknown values.**
   "Add a metadata header to the raw file: title/url/author/date/ingested" — no guidance for
   unknowns (user gave no URL, author, or publication date). Decision (prior pass, endorsed):
   explicit `"unknown"` / `"n/a"` strings rather than omitting fields or guessing.

7. **Validator config asymmetry.**
   The Configuration section builds a merged config (skill defaults + env), but
   `validate-wiki.mjs` takes a single `--config` plus `--wiki`; the documented usage passes the
   **skill** config.json. The SKILL_ENV file carries only `knowledgeBase` (no scoring keys), so
   merged scoring == skill defaults and the documented invocation is exactly equivalent.
   Decision: follow the documented usage (done), noting the validator has no env-layer counterpart.

8. **Minor order ambiguity.** Ingest step 1 (save raw) precedes step 2 (read session-start files),
   while the Session Start Protocol says read them "Before ANY wiki operation". Decision (prior
   pass, verified by mtimes): orientation reads happened before any write — the stricter reading.

## 3. Commands run (this pass)

```bash
# Phase 0: config resolution (chain + deep merge + normalization + existence check)
#   helper script written to $TEMP (temp artifact, per repo AGENTS.md; never inside outputs/wiki)
SKILL_ENV="D:\...\mock-env\eval-ingest-incremental-run1.json" node "$TEMP/resolve-skill-env-eval-run1.mjs"
# → chain: SKILL_ENV (hit); wikiDir exists=true; rawDir exists=true;
#   minScore=9, indexCountsAsInbound=true, minOutboundLinks=2, maxLines=200

# Validation (Ingest step 8 / Lint step 1) — per references/validation-and-constraints.md usage;
# report captured to $TEMP (outside wikiDir)
node "D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki\scripts\validate-wiki.mjs" \
  --wiki "D:\...\run-1\outputs\wiki" \
  --config "D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki\config.json"
# → EXIT CODE: 0
```

Read-only inspection commands: `find` over outputs (file inventory + mtimes), `git status` on the
iteration-5 workspace (untracked, as expected for eval outputs). All file reads via dedicated
read tool. The only write this pass performed: `log.md` verification row + this process log.
(The prior pass performed: raw source file, 3 new wiki pages, 2 updated wiki pages, SCHEMA.md
tag additions, index.md merge, log.md ingest + lint rows.)

## 4. Final validation output (fresh run, this pass)

```
=== Wiki Validation Script v5 ===
Found 6 wiki pages

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

## 5. Result summary

- Pages created (3, prior pass — verified this pass): `wiki\concepts\Flash Attention.md`,
  `wiki\entities\Tri Dao.md`, `wiki\sources\Flash Attention (article).md`
- Pages updated (2): `wiki\concepts\Attention Mechanism.md`, `wiki\concepts\Transformer.md`
  (both now bidirectionally linked with Flash Attention and citing the new source)
- Structure updated (3): `wiki\SCHEMA.md` (+`inference`, `person` tags), `wiki\index.md`
  (3 new entries + Entities section), `wiki\log.md` (ingest row, lint row, + this pass's
  verification row)
- Raw saved (1): `wiki-raw\articles\2026-08-18-flash-attention.md` (verbatim, immutable)
- Pending page candidates recorded in `log.md`: FlashAttention-2, PyTorch, memory-bandwidth-vs-FLOPs
- Final validation: 10.00/10 PASS (6 pages, 0 broken links, 0 issues)
