# Process Log — eval-ingest-fresh / without_skill / run-1

Task: start a fresh LLM wiki and ingest the key concepts from Karpathy's
*Intro to Large Language Models* talk; set up the wiki structure and create
the initial pages.

## Step-by-step

### 1. Parsed the task
The user enumerated six topic areas: (1) what LLMs are (next-token
prediction on internet text), (2) training (pretraining vs fine-tuning),
(3) emergent capabilities at scale, (4) tool use and system prompts,
(5) security risks (jailbreaks, prompt injection), (6) the future of the
LLM OS. I treated these as the required coverage set for the initial
ingest.

### 2. Verified the source reference
Ran one web search to confirm the canonical URL for the talk:
https://www.youtube.com/watch?v=zjkBMFhNj_g (confirmed). Used it as the
founding source citation on the index page and in every page's References
section.

### 3. Designed the wiki structure
Decisions and why:

- `wiki/pages/` with one concept per kebab-case file — keeps URLs stable
  and diff-friendly.
- Split "training" into two pages (`pretraining.md`,
  `fine-tuning.md`) — the talk presents them as distinct stages with
  distinct mental models (internet simulator vs assistant), and separate
  pages give better cross-link targets. Both are grouped under "Training"
  in the index so the user's topic list still maps 1:1.
- `index.md` — home page + page map grouped to mirror the user's topic
  list (Foundations / Training / Capabilities / Systems / Safety).
- `README.md` — wiki conventions (frontmatter schema, status lifecycle
  seed→growing→mature, linking rules, how to add a page).
- `templates/page-template.md` — copy-to-start skeleton so future pages
  stay consistent.
- `glossary.md` — one-line definitions for ~19 terms, each linking to its
  full page; cheap entry point for lookup.
- Frontmatter on every page: title, tags, status, source, created.
  All ingest pages marked `status: seed` per the conventions.
- Links: standard relative Markdown links (work in GitHub/VS Code/any
  renderer), not wiki-style `[[...]]`.

### 4. Wrote the seven content pages
Content reconstructed from the talk's own framing and metaphors:

- `pages/what-are-llms.md` — two-file mental model (~10 TB internet text,
  ~100–140 GB parameters for Llama 2 70B), tokens (~32k vocab, ~4 chars),
  autoregressive next-token rollout, "dreaming" framing.
- `pages/pretraining.md` — stage 1 recipe (thousands of GPUs, weeks,
  order of a few million dollars), base model as "internet document
  generator" / random internet text simulator, why prompting a base model
  with a question yields more questions.
- `pages/fine-tuning.md` — SFT on thousands–100k curated Q&A, RLHF loop
  (rankings → reward model → RL), verification bottleneck (code easy,
  taste/facts hard), hallucination explanation (humans always answer, no
  "I don't know" in internet text; RLHF reduces but cannot eliminate).
- `pages/emergent-capabilities.md` — smooth scaling of loss/benchmarks
  (Llama 2 7B→13B→70B), emergence (multi-task, in-context learning /
  few-shot, knowledge composition), prompting as programming, and the
  limits scale does not fix (hallucination, rote computation, cutoff).
- `pages/tool-use.md` — why frozen weights need tools
  (calculator/interpreter, browsing, file/API access), how tool calls
  round-trip through the context window, system prompts as in-context
  steering.
- `pages/security-risks.md` — jailbreaks (DAN persona, adversarial
  suffixes), direct vs indirect prompt injection (confused deputy: model
  can't separate instructions from data in one token stream), data
  poisoning / trojans (the "turkey" example), partial defenses
  (filtering, least privilege, treat fetched content as untrusted).
- `pages/llm-os.md` — kernel analogy table + ASCII sketch (LLM=kernel,
  context window=RAM, tools=peripherals, multimodal=sensors,
  multi-agent=processes), explicitly labeled an outlook, not a dated
  prediction.

Every page follows the template shape: mental-model blockquote → sections
→ See also → References. Cross-links connect all seven pages (e.g.
tool-use ↔ security-risks ↔ llm-os; pretraining ↔ fine-tuning ↔
what-are-llms).

### 5. Validation pass
Wrote an inline Node checker (no files created) that walks the wiki,
verifies frontmatter, and resolves every Markdown link relative to the
linking file.

- First run found 3 issues: README missing frontmatter; README's example
  link written as a live (broken) link; template placeholder link.
- Fixes: added frontmatter to README; reworded the linking convention and
  exempted `templates/` placeholders (documented in README).
- Improved the checker to skip fenced code blocks and inline code spans
  (example links in docs are literal text, not real links).
- Final result: 11 markdown files, 70 internal links checked, 0 broken;
  8 external links; 0 missing frontmatter.

### 6. Final deliverable tree

```
outputs/
  process-log.md          (this file)
  wiki/
    README.md             conventions & structure
    index.md              home page / page map
    glossary.md           19 terms -> full pages
    templates/page-template.md
    pages/
      what-are-llms.md
      pretraining.md
      fine-tuning.md
      emergent-capabilities.md
      tool-use.md
      security-risks.md
      llm-os.md
```

## Notes / limitations

- Content is a faithful reconstruction from memory of the talk, not a
  transcript; numbers are kept as order-of-magnitude mental models
  (consistent with the wiki's own conventions).
- No skill was loaded for this run (without_skill arm); structure and
  conventions were judged from first principles.
