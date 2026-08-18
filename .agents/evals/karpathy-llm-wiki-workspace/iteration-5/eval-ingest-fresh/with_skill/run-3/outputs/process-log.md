# Process Log — eval-ingest-fresh / with_skill / run-3

Date: 2026-08-18. Skill: `karpathy-llm-wiki` (read-only use; skill dir untouched).
SKILL_ENV: `D:\GIT_dev\parking-agents\.agents\evals\karpathy-llm-wiki-workspace\iteration-5\mock-env\eval-ingest-fresh-run3.json`.
Batch mode: user unavailable; autonomous decisions marked [AUTONOMOUS] and also recorded in the wiki's own `log.md`.

## 1. Protocol steps executed, in order

| # | Step (per SKILL.md) | What happened |
|---|----------------------|---------------|
| 0 | Read SKILL.md, config.json, references/ (page-templates, tagging-taxonomy, validation-and-constraints), scripts/validate-wiki.mjs | Read all 6 skill files before acting |
| 1 | Phase 0 config resolution: `SKILL_ENV` > `~/.config/...`, deep-merge over skill `config.json`, normalize paths | Node one-liner resolved `wikiDir`/`rawDir` (absolute, used as-is); merged values: minScore 9.0, indexCountsAsInbound true, maxLines 200, minOutboundLinks 2 |
| 2 | Phase 0 dir verification | Both dirs absent → [AUTONOMOUS] batch-mode rule applied: created `wiki/{entities,concepts,sources,comparisons,queries}` and `wiki-raw/{articles,papers,transcripts,assets}`; decision logged |
| 3 | Operation 1 (Ingest) step 1 — save raw source | Wrote `wiki-raw/transcripts/2026-08-18-karpathy-intro-to-llms.md` (ingestion-date naming) with required metadata header; content = user-provided topic list verbatim + provenance note; no URL fetch performed |
| 4 | Ingest step 2 — Session Start Protocol | SCHEMA.md/index.md/log.md absent → fresh-wiki initialization: SCHEMA.md with full tag taxonomy (bare tokens, backticks/descriptions stripped), index.md skeleton, log.md table header |
| 5 | Ingest step 3 — discuss takeaways | [AUTONOMOUS] auto-passed per skill's explicit batch clause; derived 5 takeaways, recorded in log.md |
| 6 | Ingest step 4 — check existing pages | index.md empty (fresh wiki): no duplicates possible; all topics new |
| 7 | Ingest step 5 — create pages | 11 pages in 4 batches, templates followed per type; YAML frontmatter with title/created/updated/type/tags/sources; every page >= 2 outbound wikilinks; no self-references; filenames = exact titles |
| 8 | Concurrent-Sessions rule — log before index | After each page batch: appended log.md rows; only after the last batch re-read index.md from disk and merged all 11 entries |
| 9 | Ingest step 6 — update index.md | One `- [[Page Name]] — description` line per page under type sections; every `[[X]]` references a real page |
| 10 | Ingest step 7 — update log.md | Timestamped rows for every page write, both autonomous decisions, index update, ingest summary |
| 11 | Ingest step 8 — run validation | `node validate-wiki.mjs --wiki <wikiDir> --config <skill>/config.json` → exit 0. Loop not needed: zero issues, no fixes |
| 12 | Operation 3 (Lint) step 5 — record lint | Lint result row appended to log.md; report saved outside wikiDir as `outputs/validation-report.txt` |

Pages created (11): sources/Intro to Large Language Models; entities/Andrej Karpathy; concepts/{Large Language Model, Pretraining, Fine-tuning, Emergent Abilities, System Prompt, Tool Use, Jailbreaking, Prompt Injection, LLM OS}.

## 2. Ambiguities / incomplete spots / forced decisions

1. **Raw-source branch missing for "user provides a topic summary"** — Ingest step 1 only says: "If the user provides a URL, fetch the content and save as markdown." No branch exists for a user-provided description with no fetchable payload. [AUTONOMOUS] Saved the user's topic list verbatim as talk notes under `transcripts/`, put the canonical YouTube URL in the metadata header, and added an in-file provenance note that no fetch was performed. The wiki source page correspondingly has no Notable Quotes and says so in Critical Notes.
2. **"Immediately after every page write"** (Concurrent Sessions: "Append to `log.md` immediately after every page write — before touching `index.md`") — "immediately" is not operationally precise for an agent that batches tool calls. Interpreted as an ordering guarantee (log rows for a page exist before index.md is touched, and index is merged from a fresh disk read). I appended per batch of 2-3 pages; recorded as process deviation in this log.
3. **Metadata `date` field with unknown publication date** — header spec: `date: "{publication date}"`. The user gave none. [AUTONOMOUS] Supplied 2023-11-07 from general knowledge of the talk; flagged the talk as 2023 in the wiki page and marked figures as era-specific in Critical Notes.
4. **Creation threshold judgment** — "only if it meets the creation threshold: mentioned in 2+ sources, OR central to this source." "Central" is subjective; only one source exists. [AUTONOMOUS] Treated the six user-enumerated topics as central (the user explicitly listed them as the talk's main topics), plus Andrej Karpathy under the skill's "well-known entity in the LLM field" clause. Everything else (Transformer, RLHF, GPT-3, scaling-law papers) stayed plain text per the "pending page" rule — zero broken links by construction.
5. **SCHEMA.md init comment is an instruction, not content** — the init template embeds `<!-- At initialization, copy the FULL tag groups ... STRIPPING the backticks ... -->`. Interpreted as a directive to the agent: replaced the comment with the actual bare-token list (harmless either way for the validator, which filters backticked/non-lowercase entries, but the instruction explicitly demands the copied list).
6. **Report location conflict** — validation reference: report "saved OUTSIDE `{wikiDir}`"; repo AGENTS.md: reports go to `docs/reports/<name>-<date>/`. Resolved in favor of the eval's containment rule (nothing outside outputs dir): saved to `outputs/validation-report.txt`.
7. **Alias/wrap link discipline** (self-inflicted friction, listed because it recurred) — SKILL.md: "`[[Page Name]]` must be the exact page title: no alias syntax (`[[Page|alias]]` unsupported) and no line wrapping inside the brackets." While drafting prose I produced three violations (one `[[Large Language Model|hallucinate]]`, two line-wrapped `[[...]]`, one `[[Fine-tuning|trained]]`); caught all four before validation via Edit + grep sweep. The validator's broken-link dimension would have failed them (hard gate), so the protocol's safety net works, but the format actively fights natural sentence flow — the single biggest content-authoring friction.
8. Minor wording: "Create a source page summarizing the source, named after the page title (see Wikilink Rules: filename = title)" — "named after" could read as "derive a name from"; resolved via the cited rule to exact-title filename `Intro to Large Language Models.md` (no slugification).

## 3. Commands run (chronological, condensed)

1. Config resolution (Phase 0): `SKILL_ENV=<mock-env.json> node -e '<deep-merge skill config.json + env; normalize paths; print existence>'` → wikiDir/rawDir resolved, both non-existent, thresholds printed.
2. `mkdir -p $OUT/wiki/{entities,concepts,sources,comparisons,queries} $OUT/wiki-raw/{articles,papers,transcripts,assets}`
3. Raw source + SCHEMA.md + index.md + log.md via file writes; log rows via `cat >> log.md <<'EOF' ... EOF` appends after each page batch.
4. Link hygiene sweep: `grep -rn '\[\[[^]]*|[^]]*\]\]' --include=*.md .` and `grep -rn '\[\[[^]]*$' --include=*.md .` → no violations remaining in pages (only a literal documentation string inside log.md, which is excluded from validation).
5. Validation (twice; second run only to save an ANSI-stripped report):
   `node "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/scripts/validate-wiki.mjs" --wiki "<outputs>/wiki" --config "D:/GIT_dev/parking-agents/.agents/skills/karpathy-llm-wiki/config.json"` → exit 0.

## 4. Final validation score

```
Found 11 wiki pages
Broken Links 10/10 | Self References 10/10 | Orphan Pages 10/10 | Index Completeness 10/10
Frontmatter 10/10 | Page Size 10/10 | Outbound Links 10/10 | Tag Compliance 10/10
Total: 10.00 / 10   Threshold: 9 / 10   Status: PASS   (exit code 0)
```

Full report: `outputs/validation-report.txt`. Raw source untouched post-ingestion (immutability constraint respected). Skill directory unmodified.
