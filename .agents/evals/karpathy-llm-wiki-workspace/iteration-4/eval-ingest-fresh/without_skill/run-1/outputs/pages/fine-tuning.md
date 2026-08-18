---
title: Fine-tuning
tags: [training, assistants]
status: draft
created: 2026-08-18
updated: 2026-08-18
source: "Andrej Karpathy, 'Intro to Large Language Models' (YouTube talk, ~1h, 2023), part 2"
---

# Fine-tuning

> Fine-tuning is stage 2 of building an LLM: keep the network but swap the
> training data from raw internet to a small, high-quality set of
> assistant-style conversations, and continue training — cheaply (hours to
> days, far fewer GPUs). The result is an assistant that answers questions,
> follows instructions, and refuses disallowed requests.

## The process

1. **Swap the dataset.** Replace the internet-scale corpus of
   [Pretraining](pretraining.md) with a much smaller collection of
   *assistant-format* data: prompts paired with ideal responses written or
   curated by people (labelers working to company guidelines).
2. **Continue training.** Same next-token objective, new distribution of text.
   Because the dataset is small, this takes hours to days on far fewer GPUs —
   a rounding error next to pretraining's millions of dollars.
3. **(Optional) RLHF.** The talk's pipeline also includes a further stage:
   humans *compare* pairs of responses, a reward model is trained on those
   preferences, and the LLM is tuned with reinforcement learning against the
   reward model. Conceptually: preference data → reward model → RL fine-tune.

## What changes in behavior

- **Asking vs. completing.** The base model completes documents; the
  fine-tuned model recognizes the question/answer genre and answers.
- **Instruction following.** Behavior like following directions, adopting
  formats, and staying on task comes largely from the fine-tuning data.
- **Refusals.** Safety behavior — declining disallowed requests — is
  substantially instilled here (and defended at inference time by
  [System prompts](system-prompts.md)). Attackers pushing back against
  exactly this is the subject of [Jailbreaks](jailbreaks.md).
- **Hallucination management.** The base model *always* answers, fluently
  making things up when it doesn't know (see
  [What are LLMs?](what-are-llms.md)). With careful fine-tuning data, models
  can be taught to hedge or say "I don't know" — imperfectly, and it remains
  an open problem.

## Relation to system prompts

Fine-tuning changes *weights* (expensive, global, persistent).
[System prompts](system-prompts.md) change only the current conversation
(free, per-use). Deployed assistants combine both: fine-tuning for the bulk of
behavior, system prompts for per-application configuration.

## Open questions

- How large can fine-tuning datasets get before pretraining-quality data
  matters less than labeler quality?
- When does RLHF start rewarding what raters *like* rather than what is
  *correct* (reward hacking)?

## See also

- [Pretraining](pretraining.md) — the stage that produces the model being fine-tuned.
- [System prompts](system-prompts.md) — inference-time behavioral configuration.
- [Jailbreaks](jailbreaks.md) — attacks against fine-tuned safety behavior.
- [What are LLMs?](what-are-llms.md) — the unchanged underlying objective.

## References

- Andrej Karpathy, "Intro to Large Language Models" (YouTube talk, ~1h, 2023) — part 2: fine-tuning datasets, labelers, the assistant stage, RLHF sketch.
