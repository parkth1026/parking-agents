# Process Log — eval-query / with_skill / run-2

Date: 2026-08-18. Skill: karpathy-llm-wiki (Query operation). Batch mode (no user available).

## Resolved configuration (Phase 0)

- Resolution chain per SKILL.md: `SKILL_ENV` env var > `~/.config/parking-agents/skill-env.json`.
  Set `SKILL_ENV=D:\GIT_dev\parking-agents\.agents\evals\karpathy-llm-wiki-workspace\iteration-5\mock-env\eval-query-run2.json`.
- Merged config = skill `config.json` (scoring/page) deep-merged with env layer (knowledgeBase paths only).
  Env layer has no scoring/page keys, so effective values: minScore 9.0, indexCountsAsInbound true, page.maxLines 200, page.minOutboundLinks 2.
- Paths from env layer (absolute Windows paths — no `~`/`./` normalization needed):
  - `knowledgeBase.wikiDir` = `<outputs>\wiki` — exists (verified).
  - `knowledgeBase.rawDir` = `<outputs>\wiki-raw` — MISSING. Decision (autonomous, batch): a Query operation never touches raw sources, so NOT created; recorded here and in log.md. SKILL.md only authorizes creation when the task requires wiki operations that need the dir.

## Protocol steps executed, in order

1. Read SKILL.md fully (skill dir read-only; nothing modified).
2. Read env file `eval-query-run2.json`; read skill `config.json`; deep-merged mentally per chain.
3. Phase 0 path resolution + existence check of wikiDir/rawDir (see above).
4. Session Start Protocol: read `SCHEMA.md` → `index.md` → `log.md` (in that order). Log showed last entry 2026-08-11, no concurrent activity → no re-orientation needed.
5. Query step 1 — read `index.md`; found for Q1: [[Attention Mechanism]], [[Flash Attention]] (+ [[Transformer]] as supporting). Q2: no Mamba/RWKV entry in index.
6. Query step 2 — keyword search of the wiki directory for Q2: `mamba|rwkv|state.space|recurrent|linear.attention|ssm` (case-insensitive) → NO_MATCHES. Also searched `quadratic|O(N|memory|bandwidth|FLOP` to make sure no other page carried cost-scaling content for Q1 (found only the two known pages + one line in Transformer.md).
7. Query step 3 — read `concepts/Attention Mechanism.md` and `concepts/Flash Attention.md` in full; synthesized answer with `[[Page Name]]` citations.
8. Query step 4 — archiving decision (autonomous, batch): classified the answer as a simple lookup ("Simple lookups → don't archive, just answer"), so no `queries/` or `comparisons/` page was created. Q2 is a coverage gap, not archivable content. Decision recorded in log.md.
9. Query step 5 — Q2 answered honestly as "not covered", with suggestion to ingest the Mamba/RWKV papers. No web search used (also prohibited by eval rules).
10. Query step 6 — appended one entry to `log.md` (table row, 2026-08-18, operation `query`, pages consulted, grep result, autonomous decisions). No pages or index.md were written, so the "pages → log → index" write-window rule was trivially satisfied.
11. Post-query validation (requested by the eval harness; not a letter-of-skill Query step — Query omits validation, that is a Lint step): ran `validate-wiki.mjs` with `SKILL_ENV` exported, `--wiki <outputs>\wiki --config <skill>\config.json` (skill config passed because merged config == skill defaults; script ignores SKILL_ENV itself).
12. Wrote final answer verbatim to `<outputs>\answer.md`.
13. Wrote this process log to `<outputs>\process-log.md`.

## Skill-instruction friction (ambiguous / incomplete / forced decisions)

1. **"If the answer is significant"** (Query step 4) — "significant" is undefined; no threshold or rubric for choosing between `queries/`, `comparisons/`, and no archive. Forced to decide myself: treated a two-page direct-lookup answer as simple → no archive. Quote: *"If the answer is significant, consider archiving it: Comparison questions → save to `comparisons/` … Simple lookups → don't archive, just answer"*.
2. **SKILL_ENV is agent-side only.** SKILL.md presents the resolution chain as central (`SKILL_ENV` env var > `~/.config/...`), but `validate-wiki.mjs` takes only `--wiki` / `--config` CLI args and never reads `SKILL_ENV` or the skill-env chain — the merge had to be done by hand and the merged result re-passed as `--config`. A wrong mental merge would silently validate with script defaults (they happen to match skill defaults today, masking drift risk).
3. **Missing configured dir not needed by the operation.** SKILL.md Phase 0: *"Creating a missing directory is a persistent write … In batch/autonomous mode, a task that explicitly requires wiki operations implies authorization for creating the configured directories — proceed and record"*. It does not say what to do when a configured dir (rawDir) is missing but the current operation (Query) doesn't need it. Decision: don't create; record.
4. **Search breadth unspecified.** Query step 2: *"search the wiki directory for keywords from the question"* — no guidance on how broad the keyword set must be before declaring "not covered". Chose the literal terms plus related-vocabulary terms (ssm, state-space, recurrent, linear attention) to reduce false negatives.
5. **Log entry format underspecified.** Query step 6: *"append a brief entry noting the query and which pages were consulted"* — no format; followed the existing table style with plain-text page names (no `[[wikilinks]]`, matching prior rows; also avoids relying on the fact that log.md is validation-excluded, which is only discoverable by reading the script).
6. **Redundant protocol layers.** Session Start Protocol ("before ANY wiki operation") already covers index.md, then Query step 1 says "Read index.md" again — overlap is harmless but mildly confusing about which section governs.
7. **Query has no validation step.** The eval asked for a post-Query validation score; the skill only wires validation into Ingest (step 8) and Lint. Running it after Query required stepping outside the Query protocol (reasonable safety check, but not instructed).

## Commands run

1. `ls -R <skill dir>` && `ls -R <outputs dir>` — inventory.
2. Read (tool): SKILL.md; `eval-query-run2.json`; skill `config.json`; wiki `SCHEMA.md`, `index.md`, `log.md`; `concepts/Attention Mechanism.md`; `concepts/Flash Attention.md`; first 140 lines of `scripts/validate-wiki.mjs`.
3. `grep -rniE "mamba|rwkv|state.space|recurrent|linear.attention|ssm" <wiki>` → NO_MATCHES.
4. `grep -rniE "quadratic|O\(N|memory|bandwidth|FLOP" <wiki>\concepts` → hits only in Attention Mechanism.md / Flash Attention.md / Transformer.md.
5. `ls <outputs>` && `test -d <outputs>\wiki-raw` → rawDir MISSING (not created).
6. Edit (tool): appended query row to `<wiki>\log.md`.
7. `export SKILL_ENV=<mock-env json>` && `node <skill>\scripts\validate-wiki.mjs --wiki <outputs>\wiki --config <skill>\config.json` → exit 0.
8. Write (tool): `<outputs>\answer.md`, `<outputs>\process-log.md`.

## Final validation score

```
Found 6 wiki pages
Broken Links 10/10 · Self References 10/10 · Orphan Pages 10/10 · Index Completeness 10/10
Frontmatter 10/10 · Page Size 10/10 · Outbound Links 10/10 · Tag Compliance 10/10
Total: 10.00 / 10   Threshold: 9 / 10   Status: PASS   (exit 0, zero issues)
```

Wiki unchanged except the appended log.md row — still passes validation after the Query operation.
