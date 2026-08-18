# Ingestion log — 2026-08-14

## What was ingested

- **User-provided topic list** (the only input supplied), quoted verbatim:
  > "what LLMs are (next token prediction on internet text), how training
  > works (pretraining vs fine-tuning), emergent capabilities at scale, tool
  > use and system prompts, security risks such as adversarial prompts, and
  > the future of LLM OS"
- **Context**: the topics summarize Andrej Karpathy's talk "Intro to Large
  Language Models" (November 2023). No transcript, video, or notes file was
  provided, so [`talk-notes.md`](talk-notes.md) reconstructs the talk's
  content from the topic list plus publicly documented knowledge of the talk.

## What was produced

- Wiki root: `outputs/wiki` — 1 index page (`Home.md`) plus 15 topic pages
  (16 Markdown files) organized into 6 sections (fundamentals, training,
  capabilities, usage, security, future).
- All pages follow the conventions described in the wiki's
  `Home.md`: YAML frontmatter (`title`, `category`, `tags`, `created`,
  `status: seed`), relative Markdown links, and a Related section.

## Caveats

- Content is **not sourced from a transcript**: approximate numbers (model
  sizes, context lengths, example counts, costs) reflect the talk's public
  slides and discussion; verify before citing.
- The talk is from late 2023; absolute numbers have moved on since. Pages
  deliberately describe concepts and framings rather than current
  state-of-the-art records.
- `talk-notes.md` is the only raw source; when the actual video/transcript
  becomes available, ingest it here and reconcile pages against it.

## Quality checks performed

- Link check: every relative Markdown link inside the wiki resolves to an
  existing file (including links from `Home.md` into this `wiki-raw` folder).
- Frontmatter check: every page carries `title`, `category`, `tags`,
  `created`, `status`.
- Content check: every page is non-empty and has body content beyond the
  frontmatter.
