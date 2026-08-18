# Process Log — Fresh LLM Wiki Ingest (Karpathy "Intro to LLMs")

Date: 2026-08-18
Output root: `.../eval-ingest-fresh/without_skill/run-3/outputs`

## What the task asked for

Start a fresh LLM wiki seeded with the key concepts of Karpathy's
"Intro to Large Language Models" talk: what LLMs are (next-token
prediction on internet text), pretraining vs fine-tuning, emergent
capabilities at scale, tool use and system prompts, security risks
(jailbreaks, prompt injection), and the LLM OS future — including the
wiki structure itself and initial pages.

## Step-by-step record

1. **Scoped the workspace.** Created everything under `outputs/wiki/`;
   nothing outside `outputs/` was read or written.

2. **Designed the structure before writing content.**
   - `wiki/index.md` — hub page: reading order (follows the talk's arc),
     a by-theme map, and sources.
   - `wiki/concepts/` — one page per concept, kebab-case filenames
     (12 pages).
   - `wiki/meta/conventions.md` — house rules so future ingests stay
     consistent: page anatomy (frontmatter, TL;DR, See also), naming,
     linking, status lifecycle, and an "ingesting new sources" recipe.
   - Rationale: a wiki's value is navigability and cross-links, so the
     hub + conventions + per-concept-page shape was decided up front.

3. **Mapped the user's topic list to pages.**
   - "What LLMs are" → `what-is-an-llm.md`.
   - "Pretraining vs fine-tuning" → split into `pretraining.md` and
     `fine-tuning.md` (two distinct pipeline stages, each deep enough to
     stand alone), plus a supporting `scaling-laws.md` because the talk
     explains run-scale economics through scaling laws.
   - "Emergent capabilities" → `emergent-capabilities.md`.
   - "Tool use and system prompts" → split into `tool-use.md` and
     `system-prompts.md` (a deployment mechanism vs a conditioning
     convention).
   - "Security (jailbreaks, prompt injection)" → split into
     `jailbreaks.md` (user-channel attacks) and `prompt-injection.md`
     (data-channel attacks); the talk's other attack classes (backdoors,
     model-in-the-middle) are noted inside these pages rather than
     given their own pages.
   - "Future of LLM OS" → `llm-os.md`.
   - Two additional supporting pages justified by the talk content:
     `tokens.md` (prediction operates on tokens — referenced everywhere)
     and `hallucinations.md` (the talk's reliability caveats:
     hallucination, knowledge cutoff, errors and biases — they motivate
     tool use and frame the security pages).

4. **Wrote the 14 pages** with a shared skeleton: YAML frontmatter
   (`title`, `aliases`, `tags`, `source`, `created`, `status`), a TL;DR
   blockquote, prose sections, and a `See also` section. All pages carry
   provenance (`source: Karpathy — "Intro to Large Language Models"
   (Nov 2023)`).

5. **Cross-linked aggressively.** Every concept page links to 2-5
   neighbors; bidirectional pairs include what-is-an-llm ↔ tokens,
   pretraining ↔ scaling-laws ↔ emergent-capabilities, fine-tuning ↔
   system-prompts, tool-use ↔ system-prompts ↔ llm-os, jailbreaks ↔
   prompt-injection ↔ tool-use/llm-os, hallucinations ↔ what-is-an-llm /
   tool-use.

6. **Quality assurance (scripted).** Ran an inline Node check over all
   `.md` files that resolves every relative Markdown link target:
   - First run: 115 links, 1 broken — the example link in
     `conventions.md` used the wrong relative path. Fixed it; also
     reworded the in-code-span example so naive link checkers stay
     clean.
   - Final run: 114 relative links, 0 broken, 14 md files; all 12
     concept pages reachable from `index.md` (no orphans).

7. **Fact discipline.** Content written from knowledge of the talk;
   numbers kept to confident ones (70B params ≈ 140 GB fp16; LIMA-style
   ~1000 curated SFT examples; terabyte-scale pretraining data;
   millions-of-dollars / thousands-of-GPUs / weeks, phrased as orders of
   magnitude). Where precision was uncertain, claims were hedged rather
   than invented.

## Final inventory

```
outputs/
  process-log.md                     (this file)
  wiki/
    index.md                         hub: reading order, themes, sources
    meta/conventions.md              house rules for future growth
    concepts/
      what-is-an-llm.md              next-token prediction, two-file view
      tokens.md                      sub-word units, why they matter
      pretraining.md                 stage 1: base model from internet data
      scaling-laws.md                predictable loss vs scale (stub)
      fine-tuning.md                 stage 2: SFT, RLHF, verification
      emergent-capabilities.md       unpredictable abilities at scale
      tool-use.md                    browser/calculator/code peripherals
      system-prompts.md              conditioning; meta-prompting demo
      hallucinations.md              confabulation, cutoff, biases
      jailbreaks.md                  user-channel safety bypass
      prompt-injection.md            data-channel attacks, exfiltration
      llm-os.md                      LLM as kernel; context=RAM, tools=IO
```

Statuses: `scaling-laws.md` intentionally left `stub` (supporting page,
thin on the talk's specifics); hub and conventions `stable`; the rest
`draft` per the lifecycle in conventions.
