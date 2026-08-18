# Process Log — eval-lint / with_skill / run-1 (2026-08-18)

Task: "Run a quality check on my LLM wiki... broken links and pages missing proper
metadata. Give me a full report and fix any issues." Batch mode (user unavailable);
autonomous decisions flagged inline as [DECISION].

## Protocol steps executed, in order

1. **Read SKILL.md** (`D:\GIT_dev\parking-agents\.claude\skills\karpathy-llm-wiki\SKILL.md`) in full;
   read skill `config.json`, `scripts/validate-wiki.mjs` (to understand scoring mechanics).
   References (`page-templates.md`, `tagging-taxonomy.md`) not needed — no new page
   templates beyond the concept/source shapes already shown in SKILL.md were required.
2. **Config resolution (Phase 0)** — set `SKILL_ENV` to the mock env file
   (`...\iteration-3\mock-env\eval-lint.json`) per the resolution chain
   (`SKILL_ENV` > `~/.config/...`; the latter was NOT touched, per sandbox rules).
   Merged config = skill defaults (scoring/page) + env `knowledgeBase.wikiDir`/`rawDir`
   (absolute Windows paths → "use as-is" per Path Resolution style 3).
   Verified `wikiDir` exists; `rawDir` (`<outputs>\wiki-raw`) did not exist → created it
   with `fs.mkdirSync(..., {recursive:true})` per Phase 0 ("If any directory does not
   exist, create it"). Left empty — lint does not use raw sources.
3. **Session Start Protocol** — read `SCHEMA.md` → `index.md` → `log.md` in that order
   (all existed). Then read all 4 content pages for a manual audit before running the script.
4. **Operation 3 (Lint), step 1 — run `validate-wiki.mjs`** (baseline; command below).
   Result: 8.5/10 FAIL (exit 1), 5 issues — matching the manual audit exactly.
5. **Step 2 — review report**: score 8.5 < 9.0 → fixes required.
6. **Step 3 — fix issues** in skill priority order (no oversized pages; tag compliance
   was already 10/10, so no tag fixes needed):
   - Broken link (priority 1): `Big Source.md` → `[[Ghost Network]]`. [DECISION — batch
     mode] Chose "remove the link" branch of the Dead Link Fix Strategy over creating a
     page: the target is an "obscure" single-source passing mention, failing the page
     creation threshold ("2+ different sources... OR central... OR well-known entity").
     Kept the prose mention, dropped `[[ ]]`; bumped `updated` to 2026-08-18.
   - Orphan + missing frontmatter + missing from index (one page, three issues):
     `concepts/Orphan Concept.md`. [DECISION] Chose "Add inbound links from related
     pages" (the skill's first-listed remedy) over merging into a parent: the stub has
     no meaningful parent page, and deletion is destructive. Added full YAML frontmatter
     (`type: concept`, `tags: [core-concept]` — an existing taxonomy tag, per "Only use
     tags defined in SCHEMA.md"), added an index.md catalog line (index links also count
     as inbound, `indexCountsAsInbound: true`), and adjusted the now-false body
     sentence ("never linked from anywhere") to past tense.
   - Under-linked (priority 5): `Neural Network.md` had 1 outbound link (min 2). Added a
     Related section linking `[[Orphan Concept]]` — same edit also de-orphans that page.
   - `created: 2026-08-10` for Orphan Concept's new frontmatter: [DECISION] backdated to
     match the corpus (all other pages created 2026-08-10; the stub predated this lint).
7. **Step 4 — re-run validation**: 10/10 PASS, 0 broken links, exit 0. Loop converged in
   one iteration. Completion standard met: script ran clean, broken links = 0,
   score ≥ 9.0, report generated (`lint-report.md`).
8. **Step 5 — update log.md**: appended a dated lint row summarizing results and fixes
   (append-only; prior rows untouched).
9. **Write user-facing report** → `<outputs>\lint-report.md`, this process log →
   `<outputs>\process-log.md`.

## Commands run

```bash
# Phase 0 + hygiene audit (node -e): resolve SKILL_ENV paths, verify/create rawDir,
#   BOM + line-ending audit of all wiki files
#   -> wikiDir exists; rawDir created; all 7 files: no BOM, LF-only
# Baseline validation
SKILL_ENV=<mock-env>\eval-lint.json node <skill-dir>\scripts\validate-wiki.mjs \
  --wiki <outputs>\wiki --config <skill-dir>\config.json
#   -> Found 4 pages; Broken Links 9.1, Orphans 7.5, Index 7.5, Frontmatter 7.5,
#      Outbound 7.5, others 10; Total 8.5/10 FAIL, exit 1
# Issues: Big Source.md -> [[Ghost Network]]; orphan "Orphan Concept";
#   "Orphan Concept" missing from index; "Orphan Concept.md: Missing frontmatter";
#   "Neural Network: 1 links (min: 2)"
# Post-fix validation (identical invocation)
#   -> All 8 dimensions 10/10; Total 10/10 PASS, exit 0
```

Before: **8.5 / 10, FAIL** → After: **10 / 10, PASS** (final validation score).

Files modified: `wiki\concepts\Orphan Concept.md`, `wiki\concepts\Neural Network.md`,
`wiki\sources\Big Source.md`, `wiki\index.md`, `wiki\log.md`. Created: `wiki-raw\`
(empty), `lint-report.md`, `process-log.md`. Skill directory: read-only, untouched.
Nothing outside `<outputs>` + skill dir was read or written (AGENTS.md was injected by
the harness, not read from disk beyond that).

## Ambiguities / gaps in SKILL.md, and how I resolved them

1. **"all output go here" vs validator page discovery** — SKILL.md says of wikiDir:
   "all wiki pages ... and all output go here", and the completion standard requires
   "Validation report generated". But `validate-wiki.mjs` counts every `.md` under
   wikiDir (except SCHEMA/index/log) as a *page* — dropping `lint-report.md` into the
   wiki would itself create an unindexed, frontmatter-less page and tank the score.
   [DECISION] Durable summary goes in `log.md` (per Operation 3 step 5); the full report
   lives beside this log in `<outputs>\`. The skill should define a sanctioned,
   validator-excluded location for reports.
2. **CRLF constraint vs existing corpus** — Constraint 4: "UTF-8 without BOM: All output
   files, CRLF line endings", but every existing wiki file is LF-only (audited). Writing
   my edits as CRLF would leave a mixed-endings corpus; wholesale conversion is out of
   scope for a lint. [DECISION] Matched the corpus (LF), noted in lint-report; the
   validator is line-ending agnostic, so the score is unaffected.
3. **Dead-link remedy needs user taste** — "Create missing page if the link target is a
   legitimate concept/entity / Remove the link if not worth a page". "Ghost Network"
   sits in judgment-call territory (the skill says "When in doubt, mention the concept
   in an existing page with a `[[wikilink]]` — if the link becomes a dead link, that's a
   signal it deserves its own page later", which arguably favors *keeping* dead links as
   growth signals, in direct tension with "Broken link count = 0" as a pass condition).
   [DECISION — batch] Removed the link but kept the prose, and logged the choice; the
   pass condition ("broken links = 0") took precedence.
4. **Orphan remedy ordering** — "Add inbound links from related pages, or merge the
   orphan into a parent page if it's too small to stand alone" gives no tie-breaker for
   a stub that is both tiny and parentless. [DECISION] Linked rather than deleted
   (non-destructive, first-listed); flagged in lint-report.
5. **`created` date for retroactive frontmatter** — Required Frontmatter lists
   `created`/`updated`, but the skill never says what to do when adding frontmatter to
   a pre-existing undated page. [DECISION] `created` backdated to the corpus date
   (2026-08-10), `updated` = today.
6. **Minor**: "If any of these files don't exist yet (fresh wiki), create them as part
   of the initialization in the Ingest operation" — silent on whether Lint may create
   them (moot here; all three existed). Also Operation 3 step 3 lists fix priorities
   but no priority for "tag non-compliance" fixes (moot; tags were compliant).

## Friction points (top 3, for the iteration retrospective)

1. Report placement contradiction (ambiguity #1) — "all output go here" actively fights
   the validator; the agent must invent a safe location.
2. Dead-link philosophy contradiction (ambiguity #3) — "dead links deserve pages later"
   vs "broken links = 0 to pass" forces an unstated judgment call.
3. Environment/format constraints unenforced and unaligned (ambiguity #2) — CRLF mandate
   vs LF corpus, plus no guidance for retroactive `created` dates; small but each one
   forces an undocumented decision in batch mode.
