---
title: Wiki Conventions
aliases: [Conventions, Contributing]
tags: [meta, conventions]
source: internal
created: 2026-08-18
status: stable
---

# Wiki Conventions

House rules that keep the wiki navigable as it grows.

## Layout

```
wiki/
  index.md          # hub: reading order, themes, sources
  concepts/         # one page per concept, kebab-case file names
  meta/             # pages about the wiki itself
```

## Page anatomy

Every concept page uses the same skeleton:

1. YAML frontmatter: `title`, `aliases`, `tags`, `source`, `created`,
   `status`.
2. A `> **TL;DR:**` blockquote — the one-sentence version of the page.
3. Body sections: prose-first, short paragraphs, concrete examples.
4. A `## See also` section of cross-links.
5. References where a claim needs provenance.

## Naming

- Files: `kebab-case.md` under `concepts/`.
- One concept per page; split a page when any section grows past ~150
  lines.
- Prefer adding `aliases` in frontmatter over renaming files once pages
  are linked.

## Linking

- Use relative Markdown links between files — `../concepts/fine-tuning.md`
  when linking from `meta/`, plain `fine-tuning.md` between concept
  pages — so the wiki renders in any Markdown viewer or editor.
- Every new page must be reachable from `index.md` and link out to at
  least two neighbors — no orphan pages.
- Prefer linking a concept's own page over repeating its explanation.

## Status lifecycle

`stub` → `draft` → `stable`. A page moves to `stable` when it has been
re-read once, all its links resolve, and the TL;DR matches the body.

## Ingesting new sources

When adding material from a talk, paper, or article:

1. One page per distinct concept, not one page per source.
2. Record the source in the `source:` frontmatter of every page it
   seeds.
3. Extend existing pages instead of duplicating them; add a note when a
   second source confirms or updates a claim.
4. Hedge numbers you cannot verify — provenance beats false precision.
