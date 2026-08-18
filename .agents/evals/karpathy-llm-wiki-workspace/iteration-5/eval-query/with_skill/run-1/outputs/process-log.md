# Process Log — eval-query / with_skill / run-1 (2026-08-18)

Task: answer (1) attention cost scaling + Flash Attention, (2) Mamba/RWKV coverage, using the pre-existing LLM wiki at `<outputs>/wiki`, following `karpathy-llm-wiki` SKILL.md Query operation.

## Protocol steps executed (in order)

1. **Read SKILL.md** — `D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki\SKILL.md`.
2. **Configuration resolution (Phase 0)** — merged layers:
   - Skill defaults: `<skill>/config.json` (scoring.minScore=9.0, indexCountsAsInbound=true, page.maxLines=200, page.minOutboundLinks=2).
   - Environment layer via resolution chain `SKILL_ENV > ~/.config/...`: set `SKILL_ENV=D:\GIT_dev\parking-agents\.agents\evals\karpathy-llm-wiki-workspace\iteration-5\mock-env\eval-query-run1.json`, which supplies `knowledgeBase.wikiDir` = `<outputs>\wiki` and `knowledgeBase.rawDir` = `<outputs>\wiki-raw` (absolute paths, no `~`/`./` normalization needed).
   - Existence check: `wikiDir` exists (6 pages + SCHEMA.md/index.md/log.md). `rawDir` does NOT exist — **not created** (see decision D2).
3. **Session Start Protocol** (in the prescribed order): read SCHEMA.md → index.md → log.md (2 existing entries; no concurrent-session entries newer than read time).
4. **Query step 1 — read index.md**: found relevant pages for Q1 ([[Attention Mechanism]], [[Flash Attention]], [[Transformer]]); no Mamba/RWKV entries.
5. **Query step 2 — keyword search** (index had no match for Q2 topics): `grep -rni "mamba" "rwkv"` over the whole wikiDir → 0 hits. Broadened search (`state space`, `SSM`, `linear attention`, `recurren`, `linear time`) → only hit: `Transformer.md` line 11 "replacing recurrence".
6. **Query step 3 — read relevant pages and synthesize**: read `concepts/Attention Mechanism.md`, `concepts/Flash Attention.md`, `concepts/Transformer.md` (and `concepts/Neural Network.md` for cross-context). Answer cites pages as `[[Page Name]]` links.
7. **Query step 4 — archiving decision**: NOT archived (see decision D1).
8. **Query step 5 — honest coverage gap**: Q2 answered as "not covered" + ingestion suggestion instead of a fabricated answer.
9. **Query step 6 — update log.md**: appended one timestamped row (2026-08-18, operation `query`) naming the question, pages consulted, and both batch-mode decisions. log.md append happened before any other wiki write; index.md untouched (no new pages → no index merge needed).
10. **Validation** — ran `validate-wiki.mjs` (see commands). Result: **Total 10.00/10, threshold 9, Status PASS, exit 0**, 0 broken links, 6 pages found. Wiki still passes after the Query operation.
11. **Saved final answer verbatim** to `<outputs>\answer.md`.
12. **Wrote this process log** to `<outputs>\process-log.md`.

## Autonomous decisions (batch mode — user unavailable)

- **D1 — Archiving (Query step 4 "consider archiving")**: decided NOT to save the answer to `queries/`. Reasoning: Q1's facts are stated nearly verbatim on two existing pages (Attention Mechanism "Cost Scaling" section; Flash Attention page) — this is a "simple lookup" per the skill's own taxonomy ("Simple lookups → don't archive, just answer"), not a "complex multi-page answer" producing new synthesis; Q2 is a negative result. Decision recorded in log.md.
- **D2 — Missing rawDir (Phase 0 existence check)**: Phase 0 says to verify dirs and (batch mode) implies authorization to create configured directories. Decided NOT to create `wiki-raw/`: the Query operation never reads or writes raw sources, so creating it would be an unnecessary persistent write. Recorded in log.md.

## Skill-instruction friction (ambiguous / incomplete / forced a decision)

1. **"If the answer is significant, consider archiving it" (Operation 2, step 4)** — "significant" is undefined and the categories overlap: my Q1 answer draws from 2-3 pages (suggesting "complex multi-page answer → queries/") yet each page directly states its part (suggesting "simple lookup"). Forced decision D1. A quantitative rule (e.g., "archive only if the answer synthesizes ≥3 pages or produces a comparison") would remove the ambiguity.
2. **Validator config vs. skill config semantics (Operation 3 / scripts)** — the skill mandates the layered config (`SKILL_ENV` chain) but `validate-wiki.mjs` takes `--config <file>` with no documented convention for which layer to pass; it silently ignores `knowledgeBase.*` entirely (paths come from `--wiki`). Had to decide to pass the skill's `config.json` (scoring/page defaults) plus `--wiki` from the env layer, i.e., re-implement the merge by hand. Also, the script has no `--help` (unknown-arg error exit 2); usage lives only in a source comment.
3. **Phase 0 wording vs. Query reality** — "After resolving, verify each directory exists... a task that explicitly requires wiki operations implies authorization for creating the configured directories" reads as if both dirs should be created when missing, even when the operation at hand (Query) cannot ever use rawDir. Forced decision D2; the instruction would be cleaner scoped as "create dirs required by the operation you are about to perform".
4. **Minor: Query step 6 log format** — log.md rows are `| Date | Operation | Details |` but the skill never states the row schema (it's only inferable from the initialization template / existing rows); also `[[...]]` links inside log.md are fine (validator excludes log.md), which I had to confirm from script source rather than SKILL.md.

## Commands run

```
ls -la <skill> ; ls -la <outputs>
find <outputs>\wiki -type f | sort
grep -rni -e "mamba" -e "rwkv" <outputs>\wiki            # 0 hits (exit 1)
grep -rni -e "state.space" -e "state space" -e "SSM" -e "linear attention" -e "recurren" -e "linear time" <outputs>\wiki   # 1 hit: Transformer.md:11
ls <skill>\scripts ; node <skill>\scripts\validate-wiki.mjs --help   # exit 2: no --help
node <skill>\scripts\validate-wiki.mjs --wiki <outputs>\wiki --config <skill>\config.json   # PASS 10.00/10, exit 0
```

Files written (all inside `<outputs>`): `wiki/log.md` (one appended row), `answer.md`, `process-log.md`. Nothing in the skill directory was modified; nothing outside `<outputs>` and the skill dir was read or written.

## Final validation score

**10.00 / 10 (threshold 9.0) — PASS**, 0 broken links, 6/6 pages indexed. The wiki still passes validation after the Query operation.
