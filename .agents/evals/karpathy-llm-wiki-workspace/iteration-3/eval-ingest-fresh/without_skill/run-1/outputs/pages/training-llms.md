# Training: pretraining vs fine-tuning

> **TL;DR** LLM training has two stages with wildly different economics.
> **Pretraining** turns the internet into a base model (months of GPU-cluster time,
> millions of dollars). **Fine-tuning** turns a base model into an assistant (a tiny
> curated dataset, hours of compute). One expensive base model seeds many cheap
> specializations.

**Provenance:** Karpathy, *Intro to Large Language Models* (2023), part 1.
Figures are as of the talk (late 2023).

## The two stages at a glance

| | Pretraining | Fine-tuning |
|---|---|---|
| Data | ~10 TB of raw internet text | On the order of 100k high-quality Q&A conversations (orders of magnitude less) |
| Objective | Next-token prediction on documents | Next-token prediction on assistant conversations, then preference optimization |
| Compute | Large GPU clusters, months, on the order of millions of dollars | Hours on comparatively little compute |
| Output | **Base model** — an "internet-document simulator" | **Assistant / chat model** |

## Stage 1 — Pretraining

Take a cleaned snapshot of internet text (~10 TB) and train the transformer to predict
the next token across all of it, on a cluster of GPUs for months. The result is the
**base model**: a statistical model of internet text. It can continue any document in
a plausible style, but it is not an assistant — prompt it with a question and it
"knows" what question-shaped text looks like, yet has no notion of *answering* you.
See [What is an LLM?](what-is-an-llm.md) for what a base model feels like to sample
from, and why pretraining is a form of lossy compression of the internet.

## Stage 2 — Fine-tuning

To get a usable assistant, replace the data, not the scale:

1. **Collect high-quality Q&A data.** Humans on a labeling platform write ideal
   assistant answers to real user questions (e.g. "how do I boil an egg" answered
   clearly and accurately).
2. **Fine-tune the base model** on those assistant-format conversations (supervised
   fine-tuning, **SFT**).
3. **Improve with preferences.** Show labelers pairs of model answers, have them pick
   the better one, and optimize the model toward preferred answers — reinforcement
   learning from human feedback (**RLHF**). Karpathy names SFT + RLHF as the standard
   fine-tuning recipe.

Because fine-tuning data is small and the base model already has the capability, this
stage takes hours rather than months. One consequence visible across 2023's product
landscape: many chat products are fine-tunes of the same handful of base models
(e.g. the open Llama family) — the differentiation is largely in the fine-tune.

## Evaluation

Before release, models are scored on **benchmarks** — standard test suites with
public leaderboards measuring knowledge, reasoning, coding, and safety. Companies
iterate against these benchmarks when preparing and selecting models for release.

## Why two stages?

- **Economics:** pretraining buys general capability once; fine-tuning specializes it
  cheaply and repeatedly.
- **Separation of concerns:** pretraining determines what the model *can do*;
  fine-tuning shapes how it *behaves* — persona, refusals, answer format. That is also
  why behavior steering is statistical rather than absolute, which has security
  consequences ([Jailbreaks](security-jailbreaks.md)).

## See also

- [What is an LLM?](what-is-an-llm.md) — the ingredients and objective behind pretraining
- [System prompts](system-prompts.md) — steering behavior at inference time, no training needed
- [Emergent capabilities at scale](emergent-capabilities.md)

## References

- Andrej Karpathy, *Intro to Large Language Models* (YouTube, Nov 2023).

---
Part of the [LLM Wiki](../index.md).
