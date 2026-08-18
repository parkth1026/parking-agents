# Process log — LLM wiki initial ingest (eval run)

Task: start a fresh LLM wiki seeded with the key concepts from Karpathy's
"Intro to Large Language Models" talk; set up wiki structure and initial pages.
Executed 2026-08-18. All work confined to this outputs directory.

## Steps

1. **Scoped the work.** The user listed six talk topics (what LLMs are; pretraining
   vs fine-tuning; emergent capabilities; tool use and system prompts; jailbreaks and
   prompt injection; LLM OS future). I mapped these to a page plan before writing
   anything, so the wiki covers exactly the requested topics plus structural pages.

2. **Chose the wiki structure.** Created:

   ```text
   outputs/
   ├── index.md                  # home: topic map, reading order, conventions, changelog
   ├── pages/                    # all articles (kebab-case filenames)
   │   ├── what-is-an-llm.md
   │   ├── training-llms.md      # pretraining vs fine-tuning (one page: the
   │   │                         #   comparison IS the topic)
   │   ├── emergent-capabilities.md
   │   ├── tool-use.md
   │   ├── system-prompts.md
   │   ├── security-jailbreaks.md
   │   ├── security-prompt-injection.md
   │   ├── llm-os.md
   │   └── glossary.md
   ├── templates/page-template.md  # conventions + skeleton for future pages
   └── process-log.md            # this file
   ```

   Rationale for granularity: the user grouped "tool use and system prompts" and
   "jailbreaks, prompt injection", but each of those is a distinct wiki-grow-able
   concept that the talk itself separates (user-side vs data-side attacks; steering
   vs extending). Separate pages with heavy cross-linking serve a wiki better than
   merged mega-pages, while the index groups them under the user's topic headings so
   the mapping back to the request stays visible.

3. **Wrote the pages** (11 files, ~4,600 words total). Each page follows the same
   template-in-spirit: H1 title, TL;DR blockquote, a *Provenance* line naming the
   talk section the content came from, body sections, *See also* cross-links,
   *References*, and a "Part of the LLM Wiki" home link. Content is drawn from the
   talk (Nov 2023) as I know it: the two-ingredients framing (data + parameters),
   tokens/tokenizer rules of thumb, ~10 TB pretraining corpus, Llama 2 70B and its
   ~140 GB parameters file, SFT + RLHF fine-tuning recipe, the "grandma exploit" and
   DAN, prompt injection via browsed pages, and the LLM OS analogy table
   (CPU/kernel, context window as RAM, tools as peripherals).

4. **Marked provenance and staleness.** Because the talk is from 2023 and today is
   2026, every page notes that figures are "as of the talk (late 2023)". The
   capabilities page also carries a caveat on the "emergence" debate being deferred,
   and the LLM OS page flags itself as a 2023-era prediction. The index lists future
   ingest candidates so the wiki has a growth path.

5. **Verified.**
   - File listing: all 11 intended files exist, nothing extra.
   - Link check: a shell pass extracted every relative `.md` link from every file
     and resolved it against the linking file's directory — all targets exist, zero
     missing (the template's `<page-slug>` placeholder is intentionally exempt).
   - Anchor check: the single anchor used
     (`emergent-capabilities.md#limitations-from-the-talk`) matches the existing
     `## Limitations from the talk` heading.
   - Word counts sanity-checked (roughly 340–560 words per page; substantial but
     not bloated for a seed wiki).

## Constraints respected

- Worked only inside this outputs directory; no files were read from or written to
  `.claude/skills/`, `skills/`, `docs/`, or other `iteration-*` directories.
- The YouTube URL on the index page is cited by title as well, so the wiki remains
  usable even if the link format changes.
