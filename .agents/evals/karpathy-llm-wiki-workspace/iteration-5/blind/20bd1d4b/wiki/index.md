---
title: LLM Wiki — Home
aliases: [Home, Wiki Home]
tags: [hub, index]
source: Karpathy — "Intro to Large Language Models" (Nov 2023)
created: 2026-08-18
status: stable
---

# LLM Wiki

A personal, interlinked knowledge base about large language models.
The wiki was seeded from Andrej Karpathy's one-hour talk
**"Intro to Large Language Models"** (November 2023); the initial pages
cover the talk end to end. See [Wiki Conventions](meta/conventions.md)
for house rules.

## Suggested reading order

The order follows the arc of the talk: what the model *is*, how it is
*trained*, what it can *do*, how it *fails* and can be *attacked*, and
where it is *going*.

| # | Page | One-line summary |
|---|------|------------------|
| 1 | [What is an LLM](concepts/what-is-an-llm.md) | A next-token predictor trained on internet text — just two files: parameters plus the code that runs them. |
| 2 | [Tokens](concepts/tokens.md) | The sub-word units LLMs actually read, predict, and generate. |
| 3 | [Pretraining](concepts/pretraining.md) | Stage 1: compress a filtered chunk of the internet into weights on a GPU cluster. |
| 4 | [Scaling Laws](concepts/scaling-laws.md) | Why loss falls predictably as parameters, data, and compute grow. |
| 5 | [Fine-tuning](concepts/fine-tuning.md) | Stage 2: turn the raw internet simulator into an assistant (SFT, RLHF, verification). |
| 6 | [Emergent Capabilities](concepts/emergent-capabilities.md) | Abilities (in-context learning, coding, ...) that appear unpredictably as models scale. |
| 7 | [Tool Use](concepts/tool-use.md) | Browsers, calculators, code interpreters: peripherals for the LLM. |
| 8 | [System Prompts](concepts/system-prompts.md) | Conditioning the assistant's behavior — a convention, not a security boundary. |
| 9 | [Hallucinations and Limitations](concepts/hallucinations.md) | Why LLMs confabulate, plus the knowledge-cutoff / bias caveats. |
| 10 | [Jailbreaks](concepts/jailbreaks.md) | Adversarial user prompts that bypass safety guidelines. |
| 11 | [Prompt Injection](concepts/prompt-injection.md) | Malicious instructions smuggled in through *data* the model reads. |
| 12 | [LLM OS](concepts/llm-os.md) | Karpathy's analogy: the LLM as the kernel of a new kind of operating system. |

## By theme

- **Foundations** — [What is an LLM](concepts/what-is-an-llm.md), [Tokens](concepts/tokens.md)
- **Training** — [Pretraining](concepts/pretraining.md), [Scaling Laws](concepts/scaling-laws.md), [Fine-tuning](concepts/fine-tuning.md)
- **Capabilities** — [Emergent Capabilities](concepts/emergent-capabilities.md), [Tool Use](concepts/tool-use.md), [System Prompts](concepts/system-prompts.md)
- **Reliability and Security** — [Hallucinations and Limitations](concepts/hallucinations.md), [Jailbreaks](concepts/jailbreaks.md), [Prompt Injection](concepts/prompt-injection.md)
- **Outlook** — [LLM OS](concepts/llm-os.md)

## Sources

- Andrej Karpathy, *"[1hr Talk] Intro to Large Language Models"*
  (YouTube, November 2023). Page-level provenance is recorded in each
  page's `source` frontmatter.
