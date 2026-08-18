---
title: Home
tags: [meta]
status: reviewed
created: 2026-08-18
updated: 2026-08-18
source: "Andrej Karpathy, 'Intro to Large Language Models' (YouTube talk, ~1h, 2023)"
---

# Karpathy LLM Wiki

A knowledge wiki covering large language model concepts, seeded from Andrej
Karpathy's talk **"Intro to Large Language Models"**. Each page is a
self-contained note on one concept, with links to related pages. The goal is a
durable, interlinked reference that grows as new topics are ingested.

## Topic map

| Area | Page | One-line summary |
|---|---|---|
| Fundamentals | [What are LLMs?](pages/what-are-llms.md) | Neural nets trained to predict the next token on internet text; a lossy compression of the internet. |
| Training | [Pretraining](pages/pretraining.md) | Stage 1: compress a chunk of the internet into a base model over weeks on GPU clusters. |
| Training | [Fine-tuning](pages/fine-tuning.md) | Stage 2: turn the base model into an assistant with curated data (plus RLHF). |
| Capabilities | [Emergent capabilities](pages/emergent-capabilities.md) | Skills like arithmetic flip on as models scale; scaling laws predict loss. |
| Interaction | [Tool use](pages/tool-use.md) | Browsers, calculators, and APIs extend what an LLM can do. |
| Interaction | [System prompts](pages/system-prompts.md) | Inference-time instructions that configure assistant behavior per conversation. |
| Security | [Jailbreaks](pages/jailbreaks.md) | The user talking the model into ignoring its guidelines (e.g., DAN). |
| Security | [Prompt injection](pages/prompt-injection.md) | Third parties planting instructions in content the model reads via tools. |
| Future | [LLM OS](pages/llm-os.md) | The LLM as the kernel/CPU of an emerging kind of operating system. |

Suggested reading order for a newcomer: [What are LLMs?](pages/what-are-llms.md)
→ [Pretraining](pages/pretraining.md) → [Fine-tuning](pages/fine-tuning.md) →
[Emergent capabilities](pages/emergent-capabilities.md) → the rest.

## Conventions

- Content pages live in `pages/`, one concept per page, lowercase-hyphenated
  filenames (e.g., `prompt-injection.md`).
- Every page starts with YAML frontmatter: `title`, `tags`, `status`,
  `created`, `updated`, `source`.
- `status` lifecycle: `stub` (placeholder) → `draft` (content written, not yet
  reviewed) → `reviewed` (checked against sources).
- Cross-link early and often, using relative Markdown links. Every page ends
  with **See also** and **References** sections.
- To add a page: copy `templates/page.md`, fill it in, then link it from this
  page and from the most closely related page(s).

## Backlog (pages not yet written)

- `scaling-laws` — loss vs. compute/data/parameters in detail.
- `tokenization` — how text is split into tokens.
- `rlhf` — reward models and reinforcement learning from human feedback.
- `hallucination` — dedicated page on causes and mitigations.
- `data-poisoning` — attackers planting text that survives into training data.
- `multimodality` — images and audio as additional input/output channels.

## Ingest log

- 2026-08-18 — Initial ingest from Karpathy's "Intro to Large Language Models"
  talk: created this home page, the page template, and 9 content pages covering
  all six topic areas of the talk (fundamentals, training, capabilities,
  tools/system prompts, security, future outlook).
