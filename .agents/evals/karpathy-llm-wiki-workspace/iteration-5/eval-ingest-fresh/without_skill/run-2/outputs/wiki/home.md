# LLM Wiki — Home

A personal knowledge wiki about large language models: what they are, how they are built, what they can do, what can go wrong, and where they are going.

**Origin:** This wiki was seeded on 2026-08-18 by ingesting the key concepts from Andrej Karpathy's talk *Intro to Large Language Models* (2023). All initial pages are grounded in that talk; facts and numbers are "as of the talk" and may be dated. See [Sources](sources.md) for references and [Conventions](conventions.md) for how the wiki is organized and extended.

## Map of content

### 1. Fundamentals
- [What is an LLM?](what-is-an-llm.md) — next-token prediction on internet text; the two-file mental model; tokens, parameters, transformers.

### 2. How LLMs are made
- [Pretraining](pretraining.md) — stage 1: compressing the internet into a base model.
- [Fine-tuning and alignment](fine-tuning.md) — stage 2: turning a base model into an assistant (SFT + RLHF).

### 3. Capabilities
- [Scaling and emergence](scaling-and-emergence.md) — why models keep getting better, and abilities that appear at scale.
- [Tool use](tool-use.md) — browsers, calculators, and code interpreters as attachments.
- [System prompts](system-prompts.md) — steering the model with pre-filled instructions.

### 4. Security
- [Jailbreaks](jailbreaks.md) — "ignore the previous instructions" attacks.
- [Prompt injection](prompt-injection.md) — adversarial data that hijacks the model.

### 5. Future
- [The LLM OS](llm-os.md) — the kernel-process analogy for the emerging ecosystem.
- [Open questions](open-questions.md) — trends, implications, and this wiki's to-do list.

### Reference
- [Glossary](glossary.md) — short definitions of terms used across the wiki.
- [Sources](sources.md) — the talk and related references.
- [Conventions](conventions.md) — wiki structure, page template, linking rules.

## Suggested reading order

A single linear pass that mirrors the talk:

1. [What is an LLM?](what-is-an-llm.md)
2. [Pretraining](pretraining.md)
3. [Fine-tuning and alignment](fine-tuning.md)
4. [Scaling and emergence](scaling-and-emergence.md)
5. [Tool use](tool-use.md)
6. [System prompts](system-prompts.md)
7. [Jailbreaks](jailbreaks.md)
8. [Prompt injection](prompt-injection.md)
9. [The LLM OS](llm-os.md)
10. [Open questions](open-questions.md)

## Wiki status

- **Day one (2026-08-18):** initial ingest from the Karpathy talk. All ten topic pages are first drafts; [Glossary](glossary.md), [Sources](sources.md), and [Conventions](conventions.md) define the reference frame.
- Known gaps and next steps are tracked in [Open questions](open-questions.md).
