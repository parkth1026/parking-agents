# Process Log — eval-lint / with_skill / run-3

Task: "Run a quality check on my LLM wiki... Give me a full report and fix any issues you find."
Skill: karpathy-llm-wiki (Operation 3: Lint). Batch mode (user unavailable).
Skill dir: `D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki` (read-only, not modified)

## Protocol steps executed, in order

1. **Read SKILL.md** in full; read `config.json`, `references/page-templates.md`,
   `references/tagging-taxonomy.md`, `references/validation-and-constraints.md`,
   `scripts/validate-wiki.mjs`.
2. **Phase 0 — config resolution.** Resolution chain per SKILL.md: `SKILL_ENV` env var >
   `~/.config/parking-agents/skill-env.json`. Set `SKILL_ENV` to the mock env file
   (per eval harness instruction; `~/.config` never touched). Deep-merged env layer
   (knowledgeBase paths) over skill defaults (scoring/page rules). Paths in the env file
   are absolute → used as-is (no `~/` or `./` expansion needed).
   - `wikiDir` = `...\run-3\outputs\wiki` — exists (verified via fs.existsSync).
   - `rawDir` = `...\run-3\outputs\wiki-raw` — did NOT exist. Batch-mode authorization
     applies → created with `mkdir -p`, decision recorded in `log.md`.
3. **Session Start Protocol** — read in required order: `SCHEMA.md` → `index.md` → `log.md`.
   Noted valid tags (architecture, training, core-concept, model, attention, paper,
   historical), indexed pages (Transformer, Neural Network, Big Source), last log entry
   (2026-08-10 ingest).
4. **Lint step 1 — baseline validation** (`validate-wiki.mjs`). Result: **8.52/10 FAIL**,
   exit 1. Report saved outside `{wikiDir}` as `before-validation.txt`.
5. **Lint step 2 — reviewed report.** 5 issues (details below).
6. **Lint step 3 — fixes in the skill's priority order** (broken links → orphans →
   frontmatter → under-linked):
   - Broken link: `[[Ghost Network]]` in `Big Source.md` demoted to plain text.
     Rationale: fails page-creation threshold (single passing mention, not central,
     not well-known); "No speculative pages" constraint. Recorded as pending-page
     candidate in `log.md`. `updated` field bumped.
   - Orphan: `Orphan Concept` kept and repaired (frontmatter added with
     `created: 2026-08-18` retro-fill — original date undeterminable; tags `[core-concept]`
     from SCHEMA; `sources: []` — provenance unknown); inbound link added from
     `Neural Network.md` (new Related section); `Neural Network.md` `updated` bumped.
   - Under-linked: `Neural Network` Related section adds `[[Big Source]]` and
     `[[Orphan Concept]]` → 3 outbound links (fixes under-linking AND provides the
     orphan's page-level inbound in one edit).
   - Write ordering per "Concurrent Sessions": page writes → log append → index merge.
     - Page writes: `Big Source.md`, `Orphan Concept.md`, `Neural Network.md`.
     - Log append: lint entry (fixes + decisions) added to `log.md`.
     - Index merge: re-read `index.md` from disk (unchanged — no concurrent writer),
       merged `- [[Orphan Concept]] — ...` entry.
7. **Lint step 4 — re-validation.** Result: **10.00/10 PASS**, all 8 dimensions 10/10,
   broken links 0, exit 0. Saved as `after-validation.txt`. Appended final result row
   to `log.md`; ran one more confirmation pass saved as `final-validation.txt`
   (also 10.00 PASS, exit 0). Loop terminated: score ≥ 9.0 and broken links = 0.
8. **Lint step 5 — log.md updated** (two append-only rows: fixes row + result row —
   see ambiguity #3 for why two).
9. **Full report** written to `outputs\lint-report.md` (user-facing), outside `{wikiDir}`.

## Skill ambiguities / spots that forced a decision

1. **Validator config interface vs config resolution chain.** SKILL.md §Configuration:
   "Resolution chain: `SKILL_ENV` env var > this path" describes the *environment layer*
   (knowledgeBase paths), but the validator's `--config` flag expects the *skill defaults*
   file (scoring/page). Only `references/validation-and-constraints.md` shows this:
   `node {skill-dir}/scripts/validate-wiki.mjs --wiki "{wikiDir}" --config "{skill-dir}/config.json"`.
   Decision: resolved the env layer myself (Node one-liner) to get `wikiDir`, passed
   `--wiki` explicitly and `--config` = skill's config.json. The validator never reads
   `SKILL_ENV` — an agent that skims only SKILL.md might pass the env file to `--config`
   (which would silently work, since the script tolerates a config without scoring keys —
   defaults kick in — but would ignore any env-side scoring overrides).
2. **rawDir creation when the operation never uses it.** SKILL.md §Path Resolution:
   "Creating a missing directory is a persistent write: show the resolved paths and get
   user confirmation before calling `fs.mkdirSync`... In batch/autonomous mode, a task
   that explicitly requires wiki operations implies authorization for creating the
   configured directories — proceed and record the decision in `log.md`." Lint never
   touches rawDir, so creating an empty dir was arguably unnecessary, but the text reads
   as an instruction to proceed. Decision: created it (literal compliance), recorded in
   log.md. Cost: one empty, unused directory in outputs.
3. **Single-pass write ordering vs recording final score in log.** "Concurrent Sessions":
   "Keep each operation's write window short: pages → log append → index merge, in one
   pass" conflicts with Lint step 5: "Update `log.md` — record the lint results and fixes
   applied" — the post-fix score only exists after re-validation, which requires index.md
   already updated. Decision: two append-only log rows (fixes row written before the
   index merge, result row after validation). No guidance exists for whether one
   operation = exactly one log row.
4. **Orphan fix when no parent exists.** Lint fix order: "Orphan pages: Add inbound links
   from related pages, or merge the orphan into a parent page if it's too small to stand
   alone." `Orphan Concept` is explicitly a content-free stub ("A stub page someone
   created and never linked from anywhere") with no parent topic; deletion/merging into
   nothing isn't covered. Decision (conservative, autonomous): kept the page and brought
   it to standard rather than deleting user content. A "how to retire junk pages" rule
   would remove this guesswork.
5. **Dead-link strategy vs creation threshold tension.** Dead Link Fix Strategy option 1
   is "Create missing page — if the link target is a legitimate concept/entity" while
   constraint 9 says "No speculative pages: Only create pages meeting the creation
   threshold". Ghost Network is described as legitimate-ish ("claims trace back to")
   but fails the threshold. Decision: demoted to plain text + pending-page note in
   log.md (SKILL.md's own pending-page mechanism: "When in doubt, mention the concept in
   an existing page as plain text and record it in log.md as a 'pending page' candidate").
   Note the tension: as plain text in a bullet, the mention is not a wikilink, so if a
   page is later created it must be re-linked manually.
6. **Environment friction (not a skill defect):** shell state does not persist between
   tool calls, so `SKILL_ENV` had to be exported inline in every command that needed it.

## Commands run

| # | Command | Purpose / Result |
|---|---------|------------------|
| 1 | `Read SKILL.md` + skill `config.json` + 3 reference files + `validate-wiki.mjs` | Load skill |
| 2 | Node one-liner reading `$SKILL_ENV` env file, resolving + `fs.existsSync` on wikiDir/rawDir | wikiDir exists; rawDir missing |
| 3 | `SKILL_ENV=... node validate-wiki.mjs --wiki <outputs>\wiki --config <skill>\config.json \| tee before-validation.txt` | **Before: 8.52/10 FAIL** (exit 1): 1 broken link, 1 orphan, 1 missing-from-index, 1 missing frontmatter, 1 under-linked page |
| 4 | `mkdir -p <outputs>\wiki-raw` | Create missing rawDir (batch authorization) |
| 5 | Edits: `Big Source.md` (link → plain text, updated bump), `Orphan Concept.md` (+frontmatter), `Neural Network.md` (+Related, updated bump), `log.md` (append), re-Read `index.md` then merge entry | Apply fixes in skill priority order |
| 6 | Same validation command `\| tee after-validation.txt` | **After: 10.00/10 PASS** (exit 0), all dimensions 10/10, broken links 0 |
| 7 | Append result row to `log.md`; final confirmation validation `\| tee final-validation.txt` | **Final: 10.00/10 PASS** (exit 0) |
| 8 | Write `lint-report.md`, `process-log.md` to outputs root (outside wiki) | Deliverables |

## Scores summary

- **Before: 8.52 / 10 — FAIL** (threshold 9.0; 1 broken link trips the hard gate)
- **After: 10.00 / 10 — PASS** (all 8 dimensions 10/10; broken links 0; exit code 0)
- **Final confirmation run: 10.00 / 10 — PASS**
