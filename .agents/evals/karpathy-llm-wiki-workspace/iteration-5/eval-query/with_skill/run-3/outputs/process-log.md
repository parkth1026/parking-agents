# Process Log — Query operation (eval-query / with_skill / run-3)

Date: 2026-08-18. Skill: karpathy-llm-wiki. Operation: **Operation 2 (Query)**.
Config resolution: `$SKILL_ENV` → `mock-env/eval-query-run3.json` (per resolution chain: `SKILL_ENV` > `~/.config/...`).

## 1. Protocol steps executed, in order

1. **Read SKILL.md** (skill dir, read-only) — identified the task as the Query operation.
2. **Config resolution (Phase 0)** — exported `SKILL_ENV`, deep-merged skill `config.json` with the env layer, normalized paths (absolute already; no `~/` or `./` present), verified existence with `fs.existsSync`:
   - `wikiDir` = `...\run-3\outputs\wiki` — EXISTS
   - `rawDir` = `...\run-3\outputs\wiki-raw` — DOES NOT EXIST (not created; see decision D2)
   - Merged config: `scoring.minScore=9.0`, `indexCountsAsInbound=true`, `page.maxLines=200`, `page.minOutboundLinks=2`.
3. **Session Start Protocol** (before any wiki operation), in order:
   - Read `SCHEMA.md` — domain + tag taxonomy (architecture, training, core-concept, model, attention, paper, historical).
   - Read `index.md` — 6 concept pages; identified `Attention Mechanism`, `Flash Attention` as Q1 matches; no Mamba/RWKV entries.
   - Read `log.md` — only 2 entries total (both scanned; ≤ 20-30 threshold).
4. **Query Step 1 (read index.md)** — done as part of orientation; found Q1 pages; nothing for Q2.
5. **Query Step 2 (keyword search)** — `grep -rni -E "mamba|rwkv|recurrence|recurrent|state.space|ssm"` over the whole wiki dir: only hit was `concepts/Transformer.md` line 11 ("replacing recurrence"). Confirmed: no Mamba/RWKV coverage.
6. **Query Step 3 (read pages + synthesize with citations)** — read `concepts/Attention Mechanism.md`, `concepts/Flash Attention.md`, `concepts/Transformer.md` in full; synthesized answer citing `[[Attention Mechanism]]`, `[[Flash Attention]]`, `[[Transformer]]`.
7. **Query Step 4 (consider archiving)** — decided NOT to archive (decision D1).
8. **Query Step 5 (honest gap reporting)** — Q2 answered as "not covered", with suggestion to ingest a source instead of making up an answer. No web search used (also prohibited by eval rules).
9. **Query Step 6 (update log.md)** — appended one timestamped table row describing the query, pages consulted, result, and autonomous decisions.
10. **Wrote final answer** verbatim to `outputs\answer.md` (eval requirement; kept OUTSIDE wikiDir per the constraint "every `.md` inside the wiki is counted and validated as a page").
11. **Ran validation** — `node {skill-dir}/scripts/validate-wiki.mjs --wiki <wikiDir> --config {skill-dir}/config.json` exactly as documented in `references/validation-and-constraints.md`.
12. **Wrote this process log** to `outputs\process-log.md` (eval requirement; outside wikiDir).

## 2. Ambiguities / forced decisions (with quotes)

- **D1 — Archiving judgment (Query Step 4).** Quote: *"If the answer is significant, consider archiving it: Comparison questions → save to `comparisons/` … Complex multi-page answers → save to `queries/`; Simple lookups → don't archive, just answer."* "Significant" is undefined and no user is available in batch mode. Decision: treat Q1/Q2 as simple lookups (Q1 restates two directly-on-topic pages; Q2 is a "not covered" report) → no archive, no index.md write. Recorded in log.md.
- **D2 — Missing rawDir.** Quote (Phase 0): *"Creating a missing directory is a persistent write: show the resolved paths and get user confirmation… In batch/autonomous mode, a task that explicitly requires wiki operations implies authorization for creating the configured directories — proceed and record the decision."* Ambiguity: a Query operation doesn't "require" rawDir at all. Decision: NOT created — Query never touches raw sources; creating it would be an unnecessary persistent write. Recorded in log.md.
- **D3 — Query Step 6 is an unconditional wiki write.** Quote: *"Update log.md — append a brief entry noting the query and which pages were consulted."* This contradicts the general principle that persistent writes need confirmation, but batch-mode latitude (same Phase 0 clause) covers it, and the Query operation explicitly mandates it. Decision: performed the append (log.md is also excluded from page validation by the script, so it cannot break the score).
- **D4 — log.md entry format unspecified.** Quote (Query Step 6): *"append a brief entry"* — no format given for Query rows. Decision: matched the existing ingest-row table format (pipe-table, same columns), used plain page names without wikilinks to match existing entries.
- **D5 — "Read Session Start files" ordering vs Query Step 1.** The Session Start Protocol reads SCHEMA→index→log; Query Step 1 says "Read index.md" first. Not actually conflicting (orientation subsumes it), noted only because the Query steps repeat it.
- **D6 — Validation not part of Query.** Query has no validation step (only Ingest step 8 and Lint do). The eval task asked for a final validation score, so validation was run as an extra, read-only check. It writes nothing into the wiki and the report was not saved to a file at all (console only), satisfying "keep it OUTSIDE {wikiDir}".

## 3. All commands run

```bash
# Config resolution check (Node, printed merged paths + existence)
export SKILL_ENV="D:\GIT_dev\parking-agents\.agents\evals\karpathy-llm-wiki-workspace\iteration-5\mock-env\eval-query-run3.json" && node -e "...read SKILL_ENV json + skill config.json, deep-merge, normalize paths, fs.existsSync..."

# File listing
find "<outputs>\wiki" -type f | sort
find "D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki" -type f | sort

# Query Step 2 keyword search
cd "<outputs>\wiki" && grep -rni -E "mamba|rwkv|recurrence|recurrent|state.space|ssm" .   # → only Transformer.md line 11

# Final validation
export SKILL_ENV="...mock-env\eval-query-run3.json" && node "D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki\scripts\validate-wiki.mjs" --wiki "<outputs>\wiki" --config "D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki\config.json"
```

Files written: `wiki/log.md` (one appended row — the only wiki mutation), `outputs/answer.md`, `outputs/process-log.md`.

## 4. Final validation score

**Total: 10.00 / 10 — Status: PASS** (threshold 9.0, broken links 0, all 8 dimensions 10/10, exit code 0).
Wiki state after Query: 6 pages, unchanged except the log.md append.
