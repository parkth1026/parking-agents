# Wiki conventions

> **Status:** initial ingest · [Home](home.md)

How this wiki is organized, and the rules for extending it without it turning into a pile of orphan files.

## Structure

- Everything lives **flat in this directory** (`wiki/`). No subfolders — with tens of pages, a flat namespace plus a curated [Home](home.md) map is simpler than a taxonomy that has to be reorganized later. Revisit if page count exceeds ~50.
- **File names:** lowercase, hyphen-separated, topic-noun based (`fine-tuning.md`, not `03-how-models-get-smarter.md`). No date or number prefixes — pages get reorganized, names shouldn't.
- **Entry point:** [Home](home.md) holds the map of content and the suggested reading order. Every new page must be linked from Home (or from a page that is).
- **Reference pages:** [Glossary](glossary.md) (one-line definitions with links), [Sources](sources.md) (citations), this page (rules).

## Page template

Every content page uses this skeleton:

```markdown
# <Title>

> **Source:** <where the content came from> · **Status:** <initial ingest | stub | expanding | stable> · [Home](home.md)

**Summary:** one paragraph a future-you can read instead of the page.

## <Sections of substance>

## Related

- [Page](page.md) — why it's related.
```

## Rules

1. **Every page links back to Home**; every page is linked *from* somewhere. No orphans.
2. **Cross-link on first meaningful mention**, using relative markdown links (`[Tool use](tool-use.md)`). Links carry a short reason, not just a bare word.
3. **Provenance is mandatory.** The `Source:` line says where content came from. Facts from the seeded talk are "as of the talk (2023)"; anything newer must be marked. Numbers stay approximate the way the source gave them ("on the order of ~10 TB", "rumored ~1T").
4. **Status lifecycle:** `stub` (created, thin) → `initial ingest` (first full draft from one source) → `expanding` (multiple sources) → `stable` (trusted, maintained). Update the tag as the page grows.
5. **Summaries before sections.** Each page opens with a paragraph that stands alone.
6. **Glossary stays in sync.** New recurring term → add a row (definition ≤ 2 lines + link).
7. **Gaps go to [Open questions](open-questions.md).** Don't silently half-write a future topic inside an unrelated page — list it there, then create the page when ready.
8. **No pasted dumps.** Pages are digested notes in complete sentences, not transcript fragments.

## Why these choices

- A wiki's value is its **link graph** — rules 1–2 keep the graph connected, which is the whole point versus a notes folder.
- Provenance (rule 3) because the seed source is a snapshot of 2023; without dating, future edits will blur what the talk claimed vs. what is currently known.
- Flat naming (structure) because renames break links; choose boring, stable names up front.
