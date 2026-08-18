# Process Log — eval-ingest-fresh / with_skill / run-1

Task: fresh LLM wiki; ingest key concepts from Karpathy's "Intro to Large
Language Models" talk; set up wiki structure and initial pages.
Date: 2026-08-18. Skill: `.agents/skills/karpathy-llm-wiki` (read-only).

## Protocol steps executed, in order

1. **Read skill** — SKILL.md, config.json, references/page-templates.md,
   references/tagging-taxonomy.md, references/validation-and-constraints.md,
   scripts/validate-wiki.mjs. Nothing in the skill dir was modified.
2. **Phase 0 config resolution** — resolved the layered config through the
   chain `SKILL_ENV` > `~/.config/parking-agents/skill-env.json`. SKILL_ENV
   was set to the mock env file (exists), so the home-config fallback was
   never touched. Deep-merged skill defaults (scoring/page) with the env
   layer (knowledgeBase paths), normalized both paths (absolute Windows
   paths -> used as-is). Verified existence: wikiDir and rawDir both missing.
3. **Directory creation (persistent-write decision, batch mode)** — created
   `outputs/wiki/{entities,concepts,sources,comparisons,queries}` and
   `outputs/wiki-raw/transcripts`. Per SKILL.md Phase 0: "In batch/autonomous
   mode, a task that explicitly requires wiki operations implies
   authorization for creating the configured directories — proceed and record
   the decision in log.md." Recorded in log.md (init entry).
4. **Ingest step 1 — save raw source** — user supplied a topic summary, no
   URL/transcript. Saved verbatim to
   `wiki-raw/transcripts/2026-08-18-karpathy-intro-to-large-language-models.md`
   with metadata header (title/author/date 2023-11-16/ingested 2026-08-18;
   url marked "n/a (user-provided topic summary...)").
5. **Session Start Protocol** — checked SCHEMA.md, index.md, log.md in the
   resolved wikiDir; all missing -> fresh wiki, so per SKILL.md they were
   created as part of Ingest initialization:
   - SCHEMA.md: full tag taxonomy copied from references/tagging-taxonomy.md
     as bare `- token` lines (backticks/descriptions stripped, template
     comment removed).
   - log.md: append-only table skeleton.
   - index.md: section skeleton, later filled.
6. **Ingest step 3 — takeaways discussion, auto-passed (batch mode)** —
   SKILL.md: "In batch/autonomous mode (no user available): derive the 3-5
   takeaways yourself, proceed, and record in log.md that this discussion
   step was auto-passed." Derived 6 takeaways (objective -> two-stage
   training -> emergence -> scaffolding -> security -> LLM OS), recorded on
   the source page and in log.md.
7. **Ingest step 4 — existing-page check** — index.md empty (fresh wiki), no
   duplicate candidates.
8. **Ingest step 5 — create pages (11)**, all with YAML frontmatter, 2-5
   tags from the taxonomy, and >= 2 outbound wikilinks:
   - entities/Andrej Karpathy.md (threshold: well-known entity + central)
   - concepts/Large Language Model.md
   - concepts/Next Token Prediction.md
   - concepts/Pretraining.md
   - concepts/Fine-Tuning.md
   - concepts/Emergent Abilities.md
   - concepts/System Prompt.md
   - concepts/Tool Use.md
   - concepts/Prompt Injection.md
   - concepts/Large Language Model -> concepts/LLM OS.md
   - sources/Intro to Large Language Models.md
   Below-threshold topics were kept as plain text and logged as pending
   candidates (Scaling Laws, RLHF, Jailbreaking) per the Page Creation
   Threshold section.
9. **Write ordering (Concurrent Sessions rule)** — pages -> log.md append
   (4 entries: init, ingest, pages-created, pending-candidates) -> index.md
   merge (re-read from disk first, then wrote the 11 catalog entries).
10. **Ingest step 8 / Lint — validation** — ran validate-wiki.mjs (command
    below). First run: **Total 10.00/10, PASS**, all 8 dimensions 10/10,
    broken links 0, exit code 0. No fixes needed, no re-run loop required.
    Report saved OUTSIDE wikiDir at `outputs/validation-report.txt` per
    Lint step 2 ("keep it OUTSIDE {wikiDir}").
11. **log.md lint entry** — appended the validation result.
12. **This process log** — written to `outputs/process-log.md`.

## Ambiguities / judgment calls (with quotes)

1. **Conflicting order between Ingest steps 6-7 and the Concurrent Sessions
   section.** Ingest says "6. **Update index.md** ... 7. **Update log.md**",
   but Concurrent Sessions says "Append to `log.md` immediately after every
   page write — **before** touching index.md". Decision: followed the
   Concurrent Sessions rule (pages -> log -> index), treating it as the
   more specific/operational constraint.
2. **Raw source form when the user gives neither URL nor document.** Step 1
   assumes an article/paper/transcript/URL ("If the user provides a URL,
   fetch the content"), but here the only material is the user's topic
   summary. Decision: saved the user summary verbatim as the raw record
   under `transcripts/`, explicitly marked in its header and in the source
   page's Critical Notes/quotes sections that this is a summary, not a
   transcript. Page content beyond the six listed topics comes from general
   knowledge of the talk (eval context has no transcript to ingest), and the
   source page carries a fidelity caveat.
3. **Source page naming.** The talk's full title is "[1hr Talk] Intro to
   Large Language Models"; square brackets would collide with the
   `[[wikilink]]` syntax and the "Filename = page title" rule. Decision:
   titled the source page "Intro to Large Language Models"; recorded in
   log.md. (The SKILL only says to disambiguate source titles vs same-named
   concept/entity pages, not how to handle bracketed titles.)
4. **Page granularity for "security risks (jailbreaks, prompt injection)".**
   The threshold rule ("mentioned in 2+ sources, OR central to this source")
   could justify separate Jailbreaking and Prompt Injection pages from one
   source. Decision: one Prompt Injection page covering jailbreaking as a
   variant, with "Jailbreaking" logged as a pending-page candidate —
   follows "When in doubt, mention the concept in an existing page as plain
   text and record it in log.md as a 'pending page' candidate." Same
   treatment for Scaling Laws and RLHF.
5. **SCHEMA.md template comment.** The template embeds an HTML comment with
   copy instructions ("At initialization, copy the FULL tag groups from
   references/tagging-taxonomy.md into this section, STRIPPING the
   backticks and descriptions..."). Ambiguous whether the comment itself
   stays in the generated SCHEMA.md. Decision: removed the comment (it is
   authoring guidance, not schema content); the bare-token list is what the
   validator parses.
6. **Validator config argument.** references/validation-and-constraints.md
   shows `--config {skill-dir}/config.json`; the validator reads only
   scoring/page keys and ignores the knowledgeBase/env layer entirely.
   Followed the reference verbatim; noted that the env layer is irrelevant
   to the script (paths are passed via `--wiki`), so no ambiguity in
   outcome, only in documentation.
7. **Ingest step ordering vs initialization.** Step 2 says read the Session
   Start files, and "If any of these files don't exist yet (fresh wiki),
   create them as part of the initialization in the Ingest operation" — it
   does not say where in the step sequence initialization belongs.
   Decision: initialized foundation files right after the Session Start
   check, before creating content pages.
8. **Empty scaffolding dirs.** Created comparisons/ and queries/ empty to
   "set up the wiki structure" as the user asked, even though the validator
   ignores empty dirs. Harmless; noted here for transparency.

## Commands run

```bash
# 1. Config resolution (deep-merge skill defaults with SKILL_ENV layer, normalize paths)
SKILL_ENV="<mock-env>/eval-ingest-fresh-run1.json" node -e "<deep-merge + path-norm + existsSync print script>"

# 2. Structure
mkdir -p outputs/wiki/{entities,concepts,sources,comparisons,queries} outputs/wiki-raw/transcripts

# 3. Session Start existence check
for f in SCHEMA.md index.md log.md; do [ -f "$W/$f" ] ...; done   # all MISSING

# 4. log.md appends (bash heredoc >> append-only)
cat >> outputs/wiki/log.md <<'EOF' ... EOF    # x2 (ingest entries, then lint entry)

# 5. Validation (report tee'd outside wikiDir; exit via PIPESTATUS)
cd outputs && node "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/scripts/validate-wiki.mjs" \
  --wiki "outputs/wiki" \
  --config "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/config.json" \
  2>&1 | tee validation-report.txt; echo "exit=${PIPESTATUS[0]}"
```

## One in-flight fix

- `concepts/System Prompt.md` initially contained a line-wrapped wikilink
  (`[[Andre\nKarpathy]]` — also a typo, "Andre" not "Andrej"). SKILL.md
  forbids wrapping inside brackets ("no line wrapping inside the brackets"),
  and the validator would have read it as a broken link. Fixed before
  validation; final run was clean.

## Final validation score

- **Total: 10.00 / 10 — PASS** (threshold 9.0; broken links 0; exit code 0)
- All 8 dimensions at 10/10: Broken Links, Self References, Orphan Pages,
  Index Completeness, Frontmatter, Page Size, Outbound Links, Tag Compliance.
- 11 pages validated; report at `outputs/validation-report.txt`.

## Resulting artifacts (all inside outputs/)

- `wiki/SCHEMA.md`, `wiki/index.md`, `wiki/log.md` (5 entries)
- `wiki/entities/Andrej Karpathy.md`
- `wiki/concepts/{Large Language Model, Next Token Prediction, Pretraining,
  Fine-Tuning, Emergent Abilities, System Prompt, Tool Use,
  Prompt Injection, LLM OS}.md`
- `wiki/sources/Intro to Large Language Models.md`
- `wiki-raw/transcripts/2026-08-18-karpathy-intro-to-large-language-models.md`
- `validation-report.txt`, `process-log.md` (this file)
