# LLM Wiki — Home

A personal wiki on large language models, seeded from Andrej Karpathy's talk
**"Intro to Large Language Models"** (YouTube, recorded November 2023, ~1 hour):
<https://www.youtube.com/watch?v=zjkBMFhNj_g>

- **Entry point:** this page (`index.md`). All articles live in [`pages/`](pages/).
- **New pages:** copy [`templates/page-template.md`](templates/page-template.md) and follow the conventions below.
- **Conventions:** kebab-case filenames, relative Markdown links, every page carries a
  *Provenance* note (where the content came from) and a *See also* section. Cross-link
  liberally; a wiki is only as good as its links.

## Topic map

| Area | Pages |
|---|---|
| Foundations | [What is an LLM?](pages/what-is-an-llm.md) · [Training: pretraining vs fine-tuning](pages/training-llms.md) |
| Capabilities | [Emergent capabilities at scale](pages/emergent-capabilities.md) |
| Using LLMs | [Tool use](pages/tool-use.md) · [System prompts](pages/system-prompts.md) |
| Security | [Jailbreaks](pages/security-jailbreaks.md) · [Prompt injection](pages/security-prompt-injection.md) |
| Future | [The LLM OS](pages/llm-os.md) |
| Reference | [Glossary](pages/glossary.md) |

## Suggested reading order (new to LLMs)

1. [What is an LLM?](pages/what-is-an-llm.md) — next-token prediction over internet text
2. [Training: pretraining vs fine-tuning](pages/training-llms.md) — the two-stage pipeline
3. [Emergent capabilities at scale](pages/emergent-capabilities.md) — what scale buys, and limits like hallucination
4. [Tool use](pages/tool-use.md) and [System prompts](pages/system-prompts.md) — how products steer and extend models
5. [Jailbreaks](pages/security-jailbreaks.md) and [Prompt injection](pages/security-prompt-injection.md) — the two attack classes
6. [The LLM OS](pages/llm-os.md) — Karpathy's mental model for where this is all heading

## Ingest notes

- The initial ingest covers the six topics from the talk: what LLMs are, training
  (pretraining vs fine-tuning), emergent capabilities, tool use and system prompts,
  security (jailbreaks, prompt injection), and the LLM OS future.
- Figures quoted in articles (model sizes, data volumes, costs) are **as of the talk
  (late 2023)** and are marked as such on each page.
- Candidate pages for future ingest (not yet written): tokenization in depth, scaling
  laws, RLHF details, hallucination mitigations, multimodal tokens, evaluation
  benchmarks.

## Recent changes

| Date | Change |
|---|---|
| 2026-08-18 | Wiki created. Initial ingest from Karpathy's *Intro to Large Language Models*: 8 articles + glossary + page template. |
