# Process Log — eval-lint / with_skill / run-1

Date: 2026-08-18. Mode: batch/autonomous (no user available).
Skill: karpathy-llm-wiki. Operation executed: **Operation 3 — Lint** (trigger: user asked for a quality check / broken links / metadata fixes).

## 1. Protocol steps executed, in order

1. **Read SKILL.md** (`D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki\SKILL.md`) in full; also read `config.json`, `references/validation-and-constraints.md`, `scripts/validate-wiki.mjs`. (Did not modify anything in the skill dir.)
2. **Configuration layered resolution** — per SKILL.md "Resolution chain: `SKILL_ENV` env var > this path". Exported `SKILL_ENV=D:\GIT_dev\parking-agents\.agents\evals\karpathy-llm-wiki-workspace\iteration-5\mock-env\eval-lint-run1.json` and deep-merged environment layer over skill defaults (`config.json`). Result:
   - `knowledgeBase.wikiDir` = `D:\GIT_dev\parking-agents\.agents\evals\karpathy-llm-wiki-workspace\iteration-5\eval-lint\with_skill\run-1\outputs\wiki`
   - `knowledgeBase.rawDir` = `...\outputs\wiki-raw`
   - `scoring.minScore` 9.0, `scoring.indexCountsAsInbound` true, `page.minOutboundLinks` 2, `page.maxLines` 200 (all from skill defaults; env layer holds only knowledgeBase paths).
3. **Phase 0 path normalization / existence check** — both paths are absolute (style 3, used as-is). `fs.existsSync`: wikiDir = true; rawDir = **false** (see decision D1).
4. **Session Start Protocol** — read in order: `wiki\SCHEMA.md` → `wiki\index.md` → `wiki\log.md` (last entries scanned; log has 1 entry).
5. **Lint step 1 — ran `validate-wiki.mjs`** (command C2 below). Before score: **8.52 / 10, FAIL** (exit 1).
6. **Lint step 2 — reviewed report.** 5 issues found (details in §3).
7. **Lint step 3 — fixed issues** in the skill's priority order, writing pages first, then log append, then index merge (per "Concurrent Sessions: pages → log append → index merge"):
   - Fix 1 (priority: broken links): `sources\Big Source.md` — removed the broken `[[Ghost Network]]` wikilink, kept the mention as plain text; bumped `updated:` to 2026-08-18.
   - Fix 2 (priorities: frontmatter/orphan/index): `concepts\Orphan Concept.md` — retro-filled full YAML frontmatter (`title/created/updated/type/tags/sources`), tags `[core-concept]` (valid per SCHEMA.md taxonomy); content unchanged.
   - Fix 3 (priority: under-linked): `concepts\Neural Network.md` — added a `## Related` section containing an outbound `[[Big Source]]` link; bumped `updated:` to 2026-08-18.
   - Appended lint entry to `log.md` (immediately after page writes, before touching index.md).
   - Re-read `index.md` from disk, merged one new entry: `- [[Orphan Concept]] — Stub concept page normalized during 2026-08-18 lint; retained for future elaboration`.
8. **Lint step 4 — re-ran validation**: **10.00 / 10, PASS**, broken links = 0, exit 0. One loop iteration sufficed (no further fixes needed).
9. **Lint step 5 — updated log.md** with the final PASS result entry.
10. Wrote this process log OUTSIDE `{wikiDir}` (per Lint step 2: "keep it OUTSIDE `{wikiDir}` — every `.md` inside the wiki is counted and validated as a page").

## 2. Ambiguities / gaps in the skill, and the decisions I made

- **A1 — rawDir missing: create or not?** SKILL.md Phase 0: "verify each directory exists with `fs.existsSync`. Creating a missing directory is a persistent write: show the resolved paths and get user confirmation... In batch/autonomous mode, a task that explicitly requires wiki operations implies authorization for creating the configured directories — proceed and record the decision in `log.md`." The skill does not distinguish operations that never touch rawDir. **Decision (D1):** Lint reads/writes no raw sources, so creating an empty `wiki-raw` would be a pointless persistent write; did NOT create it, recorded the decision in `log.md`.
- **A2 — when is a broken link "valid" enough to create the missing page?** Lint step 3: "Broken links: Create the missing page if the link is valid, or fix/remove the link if it's wrong" — "valid" is undefined here; I had to apply the separate Page Creation Threshold ("mentioned in 2+ sources, OR central to this source... well-known entity"). `[[Ghost Network]]` is described as "obscure", appears in 1 source, is not central. **Decision (D2):** removed the link, kept plain text, recorded it in `log.md` as a pending-page candidate (per "mention the concept in an existing page as plain text and record it in `log.md` as a 'pending page' candidate").
- **A3 — orphan fix menu has no delete option.** "Orphan pages: Add inbound links from related pages, or merge the orphan into a parent page if it's too small to stand alone." The orphan was a contentless stub ("A stub page someone created and never linked from anywhere") with no natural parent; merging would add zero knowledge, and deletion is not sanctioned by the skill. Also, relying on index-as-inbound to de-orphan could look like gaming, but SKILL.md explicitly blesses it ("`index.md` is the official catalog... its links count as inbound"). **Decision (D3):** normalized the page (frontmatter + catalog entry) instead of deleting/merging; recorded in `log.md`.
- **A4 — retro-filled `created` date.** SKILL.md: "keep `created` as the page's original creation date if it can be determined; otherwise use today's date and note the retro-fill in `log.md`." log.md contains no record of Orphan Concept's creation. **Decision (D4):** used 2026-08-18 and noted the retro-fill in `log.md`.
- **A5 — validator never reads SKILL_ENV.** SKILL.md defines a config resolution chain, but `validate-wiki.mjs` only accepts `--wiki` / `--config` and only consumes `page.*` / `scoring.*` from `--config` (never `knowledgeBase.*`). The env-layer resolution is purely agent-side. **Decision (D5):** resolved wikiDir manually from the merged config and passed it via `--wiki`; passed the skill `config.json` via `--config` (identical merged result since the env layer holds no scoring/page overrides).
- **A6 — log-vs-filesystem discrepancy is invisible to the validator.** log.md's 2026-08-10 ingest entry records an "Attention Mechanism" page that does not exist on disk; no page links to it, so no validator dimension catches it, and the skill has no step for cross-checking log claims against the filesystem. **Decision (D6):** flagged it in `log.md` and the final report for the user; did NOT recreate the page — the raw source is unavailable and inventing content would violate the no-speculative-pages spirit.
- **A7 — no rule for the `updated:` frontmatter field when editing pages during Lint.** **Decision (D7):** set `updated: 2026-08-18` on every page modified, by frontmatter convention.

## 3. Issues found (before) and fixes

| # | Issue (validator output) | Fix applied |
|---|---|---|
| 1 | Broken link: `Big Source.md -> [[Ghost Network]]` | Wikilink removed, mention kept as plain text; pending-page candidate recorded in log.md |
| 2 | Orphan page: `Orphan Concept` (0 inbound) | Added to index.md (index counts as inbound per `indexCountsAsInbound: true`) |
| 3 | Missing from index: `Orphan Concept` | Index entry added |
| 4 | Frontmatter: `Orphan Concept.md` missing frontmatter (title/type/tags) | Full frontmatter retro-filled, `created` = today (retro-fill noted in log.md) |
| 5 | Under-linked: `Neural Network` 1 outbound link (min 2) | `## Related` section with `[[Big Source]]` added |

Non-validator observation: log.md records "Attention Mechanism" as created on 2026-08-10 but no such file exists (flagged, not auto-repaired — see A6).

## 4. Commands run

1. Config resolution + existence check (Git Bash, `node -e` with `SKILL_ENV` exported): printed merged config; `wikiDir` exists, `rawDir` ENOENT (script exited 1 on the rawDir stat — expected, decision D1).
2. `node "D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki\scripts\validate-wiki.mjs" --wiki "<...>\outputs\wiki" --config "D:\GIT_dev\parking-agents\.agents\skills\karpathy-llm-wiki\config.json"` — **before: 8.52/10, FAIL** (1 broken link, 1 orphan, 1 missing-from-index, 1 missing frontmatter, 1 under-linked; exit 1).
3. Same command after fixes — **after: 10.00/10, PASS** (all 8 dimensions 10/10, broken links 0; exit 0).

## 5. Final validation score

**10.00 / 10 — PASS** (threshold 9.0; broken links 0; exit code 0).
