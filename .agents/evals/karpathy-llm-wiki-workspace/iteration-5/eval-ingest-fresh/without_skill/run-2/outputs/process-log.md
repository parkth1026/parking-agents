# Process log — eval-ingest-fresh / without_skill / run-2

Task: start a fresh LLM wiki seeded from Karpathy's *Intro to Large Language Models* talk; set up wiki structure and create initial pages covering: what LLMs are, pretraining vs fine-tuning, emergent capabilities at scale, tool use and system prompts, security risks (jailbreaks, prompt injection), and the LLM OS future.

## Steps taken and why

1. **Created the workspace.** Made `outputs/wiki/` (task constraint: everything stays under the outputs directory).

2. **Attempted external verification (failed, worked around).** Tried a web search and a fetch of the talk's YouTube page to confirm exact titles/URLs for the sources page. Both timed out (no usable network in this run). Fallback: recorded references from well-established knowledge (the 2023 talk, its two versions, and the arXiv papers it connects to: Attention Is All You Need, GPT-3, InstructGPT, GPT-4 report) and marked in `sources.md` that URLs were not re-verified today. This keeps the wiki honest about provenance instead of silently guessing.

3. **Designed the structure before writing pages.**
   - **Flat namespace** under `wiki/` (no subfolders): with ~15 pages, a flat namespace avoids fragile `../` relative links; the Home page carries the taxonomy. Documented this decision in `conventions.md`.
   - **Page-per-concept mapping** from the user's six topics, splitting where the talk itself splits: pretraining vs fine-tuning as two pages; jailbreaks vs prompt injection as two pages (distinct attacker models: user-attacks-instructions vs data-hijacks-model); tool use and system prompts as two pages (delegation vs steering). Scaling laws and emergent capabilities merged into one page since they're one story.
   - **Meta layer**: `home.md` (map + reading order), `conventions.md` (template, linking rules, status lifecycle), `glossary.md` (30 terms), `sources.md` (provenance), `open-questions.md` (trends + wiki to-do).

4. **Wrote 14 pages.** 10 topic pages + 4 reference pages, each following a consistent template (title, Source/Status line, one-paragraph summary, sections, Related links). Content is a digest of the talk's key concepts — two-file mental model, tokens/next-token prediction, ~10 TB internet / weeks-months / millions-of-dollars pretraining, base model as internet-document simulator, textbook-vs-exam analogy, ~100k QA pairs + RLHF, hallucination-as-improvisation, scaling reliability and the GPT-1→4 timeline, few-shot emergence, tool attachments, system prompts as soft steering, "ignore previous instructions" jailbreaks, hidden-text data exfiltration via image URL, and the LLM-as-kernel OS analogy (context = RAM, tools = peripherals, multimodal = eyes/ears, speculative execution = multithreading). Approximate numbers are phrased as approximate ("on the order of", "rumored") to match how they were given.

5. **Quality check.** Ran a link-integrity scan over all `.md` files in the wiki: every internal markdown link resolves to an existing file. The single flagged link (`page.md` in `conventions.md`) is the intentional placeholder inside the page-template code block, not a real reference. Also confirmed page inventory and sizes (30–52 lines each).

## Deliberate choices

- **Provenance on every page.** Each page carries a `Source:` line; the wiki states upfront that its facts are a late-2023 snapshot from the talk, and `open-questions.md` includes a "what changed since 2023" follow-up so future edits don't blur talk claims with current knowledge.
- **Link graph as a first-class artifact.** Every page links to Home and to related pages with reasons; conventions mandate no orphan pages. This is the difference between a wiki and a notes folder.
- **Security as two pages, not one.** The talk treats jailbreaks and prompt injection as related but distinct (same root cause, different attacker), and the pages cross-reference that explicitly.
- **Kept numbers conservative.** Where memory of exact talk figures was uncertain (e.g., parameter-file sizes), used arithmetically-safe approximations (e.g., "a ~10B-parameter model at 2 bytes/param ≈ 20 GB") instead of risking a wrong quote.

## Files created

- `outputs/wiki/home.md` — entry point, map of content, reading order, status
- `outputs/wiki/what-is-an-llm.md`
- `outputs/wiki/pretraining.md`
- `outputs/wiki/fine-tuning.md`
- `outputs/wiki/scaling-and-emergence.md`
- `outputs/wiki/tool-use.md`
- `outputs/wiki/system-prompts.md`
- `outputs/wiki/jailbreaks.md`
- `outputs/wiki/prompt-injection.md`
- `outputs/wiki/llm-os.md`
- `outputs/wiki/open-questions.md`
- `outputs/wiki/glossary.md`
- `outputs/wiki/sources.md`
- `outputs/wiki/conventions.md`
- `outputs/process-log.md` — this file
