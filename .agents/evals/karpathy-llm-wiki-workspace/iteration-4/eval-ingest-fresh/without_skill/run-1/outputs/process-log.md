# Process log — eval-ingest-fresh / without_skill / run-1

Task: start a fresh LLM wiki and ingest the key concepts of Karpathy's
"Intro to Large Language Models" talk; set up the wiki structure and create
the initial pages. Everything was created inside this `outputs/` directory
only.

## What I did, step by step

1. **Planned the page decomposition from the user's six topic areas.**
   The user listed: (a) what LLMs are, (b) pretraining vs fine-tuning,
   (c) emergent capabilities, (d) tool use and system prompts, (e) jailbreaks
   and prompt injection, (f) the LLM OS future. A wiki works best with one
   concept per page, so I split each compound area into two pages:
   - (b) → `pretraining` + `fine-tuning`
   - (d) → `tool-use` + `system-prompts`
   - (e) → `jailbreaks` + `prompt-injection` (they are genuinely different
     attacks — user-driven vs. third-party — and cross-reference each other)
   Result: 9 content pages covering all 6 areas.

2. **Chose the structure.**
   - `Home.md` — entry point with a topic map table, suggested reading order,
     conventions, a backlog of pages not yet written, and an ingest log.
   - `pages/` — all content pages, flat, lowercase-hyphenated filenames.
   - `templates/page.md` — a fill-in skeleton so future pages stay consistent.
   - Rationale: flat `pages/` is simple for 9 pages and avoids over-categorizing
     a young wiki; the template bakes in the conventions instead of leaving
     them implicit.

3. **Defined page conventions** (documented in `Home.md`):
   - YAML frontmatter on every page: `title`, `tags`, `status`, `created`,
     `updated`, `source`.
   - `status` lifecycle: `stub` → `draft` → `reviewed`. All initial content
     pages are `draft` (written but not yet reviewed against the source
     video); `Home` is `reviewed`; the template defaults to `stub`.
   - Every page ends with **See also** + **References**; cross-link on first
     mention; relative Markdown links (not `[[wikilinks]]`) so pages render on
     GitHub and any plain Markdown viewer.

4. **Wrote the 9 content pages** from the talk's content:
   - `what-are-llms.md` — next-token prediction on internet text, the
     two-artifact view (parameters + small runner; Llama 2 70B ≈ 140 GB fp16),
     the autoregressive loop, lossy-compression framing, hallucination.
   - `pretraining.md` — stage 1: ~TBs of internet text, weeks on thousands of
     GPUs, millions of dollars; the base model as an internet simulation that
     completes documents rather than taking direction.
   - `fine-tuning.md` — stage 2: swap to small, curated assistant-format
     datasets (labeler-written ideal responses), hours–days of training;
     refusals and hallucination management via data; RLHF sketch
     (preference data → reward model → RL).
   - `emergent-capabilities.md` — scaling laws vs. emergence (arithmetic /
     word-unscrambling-style threshold graphs), in-context learning, caveats
     about metrics.
   - `tool-use.md` — browsers/calculators/APIs, Toolformer and plugins, the
     agent loop, and the security cost of ingesting external content.
   - `system-prompts.md` — inference-time conditioning vs. weight changes,
     what system prompts can and cannot enforce, context-window pressure.
   - `jailbreaks.md` — user-driven attacks, DAN, cat-and-mouse dynamics, and
     a comparison table of the three attack vectors (jailbreak / prompt
     injection / data poisoning).
   - `prompt-injection.md` — third-party instructions hidden in browsed
     content; the code-vs.-data analogy; why prompt-based defenses are
     self-referentially attackable.
   - `llm-os.md` — the analogy table (LLM = CPU/kernel, context = RAM, tools
     = peripherals, multimodality = I/O), reliability/security as the
     platform's open problems, outlook.

5. **Verified the result** with a link check (grep + `test -f` over every
   relative `.md` link in every file): all 92 real internal links resolve;
   the only flagged link is the intentional `<related-page>.md` placeholder
   in `templates/page.md`.

## Decisions and trade-offs

- **Two security pages instead of one** — the talk treats jailbreaks (attacker
  = user) and prompt injection (attacker = third party) as distinct, and the
  distinction carries the threat model; splitting also gives cleaner link
  targets.
- **Markdown links over wikilinks** — portability across renderers beats
  wiki-syntax purity for a file-based wiki.
- **Backlog instead of stub pages** — `Home.md` lists 6 future pages
  (scaling-laws, tokenization, rlhf, hallucination, data-poisoning,
  multimodality) as a roadmap without creating empty files that would need
  pruning later.
- **Kept numbers soft** — figures from the talk are quoted approximately
  ("~10 TB", "weeks / thousands of GPUs") and each page cites the talk as its
  source, since this ingest is from memory of the talk rather than a
  transcript.

## Final inventory

```
Home.md                         wiki entry, topic map, conventions, ingest log
pages/what-are-llms.md
pages/pretraining.md
pages/fine-tuning.md
pages/emergent-capabilities.md
pages/tool-use.md
pages/system-prompts.md
pages/jailbreaks.md
pages/prompt-injection.md
pages/llm-os.md
templates/page.md               new-page template
process-log.md                  this file
```
