---
title: Emergent Capabilities at Scale
tags: [capabilities, scaling, in-context-learning, prompting]
status: seed
source: "Karpathy, 'Intro to Large Language Models' (2023)"
created: 2026-08-18
---

# Emergent Capabilities at Scale

> Bigger models trained on more data get *predictably* better at guessing
> the next token — and capabilities nobody explicitly programmed show up
> along the way.

## Scaling works

- Loss on next-token prediction falls smoothly as you scale parameters,
  data, and compute together.
- Downstream benchmark scores (e.g., MMLU) climb accordingly across a
  family like Llama 2 7B → 13B → 70B.
- This predictability is why labs race to scale: capability is, to first
  order, a function of scale.

## Emergent capabilities

Phenomena that appear with scale but were never explicitly built:

1. **Multi-task competence.** One model does translation, summarization,
   coding, Q&A — all downstream of a single training objective.
2. **In-context learning (few-shot).** Show the model two or three solved
   examples in the prompt and it continues the pattern — *learning at
   inference time*, with no weight updates.
3. **Knowledge composition.** Facts absorbed separately during training
   get combined in new ways at inference time.

## Prompting as programming

Because of in-context learning, the prompt becomes the interface:
instructions, examples, and formats steer the same frozen model. This is
why system prompts and prompt engineering matter at all — see
[Tool Use & System Prompts](tool-use.md).

## Limits that remain at scale

- **Hallucination** — see [Fine-Tuning & RLHF](fine-tuning.md). Scale
  alone does not fix it.
- **Rote computation** — precise arithmetic is weak, hence
  [Tool Use](tool-use.md).
- **Knowledge cutoff** — training data is frozen in time, hence browsing
  tools.

## See also

- [What Are LLMs?](what-are-llms.md) — the objective being scaled
- [Pretraining](pretraining.md) — where scale is spent
- [Tool Use & System Prompts](tool-use.md) — working around the limits
- [The LLM OS](llm-os.md) — the platform this scales into

## References

- Andrej Karpathy,
  [*Intro to Large Language Models*](https://www.youtube.com/watch?v=zjkBMFhNj_g)
  (2023) — scaling charts and in-context learning demo.
