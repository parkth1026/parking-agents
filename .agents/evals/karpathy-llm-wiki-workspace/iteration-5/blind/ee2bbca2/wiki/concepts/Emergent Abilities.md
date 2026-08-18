---
title: "Emergent Abilities"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [emergent-abilities, scaling-laws, frontier-model]
sources: ["Intro to Large Language Models"]
---

# Emergent Abilities

Capabilities that are present in small models only barely or not at all, but
appear (often sharply) as models, data, and compute scale up. Nobody programs
few-shot learning or multi-step reasoning into the network; they fall out of
next-token prediction at scale (see [[Large Language Model]]).

## How It Works

- The training objective never changes; only scale does — more parameters,
  more tokens of [[Pretraining]] data, more compute.
- Across many benchmarks, performance rises with scale and keeps rising;
  certain abilities (in-context/few-shot learning, arithmetic, multi-step
  reasoning, instruction following in base models) are effectively absent
  below a scale threshold.
- Practically, this is why the field keeps scaling: capability growth has been
  a reliable return on compute spent, and it underwrites bets like the
  [[LLM OS]] vision — abilities that seem marginal today become the platform's
  core features at the next scale.

## Variants

- **Smooth scaling** — benchmark scores improve roughly predictably with
  compute (the scaling-laws view; Kaplan et al. 2020, Hoffmann et al. 2022).
- **Threshold emergence** — abilities that look step-like, appearing only past
  a model-size or training-compute threshold. Whether they are truly
  discontinuous or artifacts of discontinuous metrics remains debated.

## History

GPT-3 (2020) made the phenomenon famous: few-shot in-context learning was not
an explicitly trained feature, yet it appeared and drove the API-era product
wave. Since then, "what will emerge next" has been the central open question
used to justify frontier-scale training runs.

## Related

- [[Large Language Model]] — the substrate whose scaling produces emergence
- [[Pretraining]] — the stage where scale is applied
- [[LLM OS]] — the bet that emergence continues into general-purpose capability
