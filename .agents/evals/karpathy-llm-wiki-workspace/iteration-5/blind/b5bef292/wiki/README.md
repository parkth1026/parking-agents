---
title: LLM Wiki — Conventions
tags: [meta]
status: growing
created: 2026-08-18
---

# LLM Wiki — Conventions

A personal knowledge wiki for LLM / AI / deep-learning concepts, in the
spirit of Andrej Karpathy's teaching: small precise mental models, concrete
numbers, honest about limitations.

Seeded from Karpathy's talk *Intro to Large Language Models* (2023).
See [index.md](index.md) for the page map.

## Directory layout

| Path | Purpose |
|---|---|
| `index.md` | Wiki home page — entry point and page map |
| `pages/*.md` | One concept per page, kebab-case filenames |
| `glossary.md` | Quick-reference definitions, linked to full pages |
| `templates/page-template.md` | Copy this to start a new page |

## Page conventions

1. **Filename**: `kebab-case.md` under `pages/`, one concept per page.
2. **Frontmatter** (YAML) on every page:
   - `title` — human-readable title
   - `tags` — lowercase list, used for grouping
   - `status` — `seed` (freshly ingested, unreviewed) → `growing` → `mature`
   - `source` — where the content came from
   - `created` / `updated` — ISO dates
3. **Structure**: start with a one-sentence mental model in a `>` blockquote,
   then body sections, then `See also`, then `References`.
4. **Links**: standard relative Markdown links that resolve from the
   linking file's location, e.g. `[Pretraining](pages/pretraining.md)`
   from this README or `[Pretraining](pretraining.md)` from another page
   in `pages/`, so any renderer and GitHub work. Every page must be
   reachable from `index.md` and linked from at least one related page.
   Placeholder links in `templates/page-template.md` are exempt.
5. **Sourcing**: content ingested from a talk/paper is attributed in
   `source` and `References`. Speculation or outlooks are labeled as such.
6. **Numbers**: orders of magnitude ("~10 TB", "a few million dollars") are
   fine for mental models; exact figures get a reference or are omitted.

## Adding a page

1. Copy `templates/page-template.md` to `pages/<name>.md`.
2. Fill in frontmatter and content; mark status `seed`.
3. Add the page to the right group in `index.md`.
4. Add at least one `See also` link from a related page back to it.
