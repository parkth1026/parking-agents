---
title: "Emergent Capabilities"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [emergent-abilities, scaling-laws]
sources: ["Intro to Large Language Models"]
---

# Emergent Capabilities

Capabilities that appear only past some threshold of parameters, data, and compute. In the talk Karpathy shows successive model generations gaining abilities nobody explicitly programmed: multi-step arithmetic, translation across many languages, broad world knowledge, in-context learning from examples, and useful code completion.

## Key Points

- The only reliable recipe so far for a more capable model is a bigger [[Large Language Model]] trained on more text — capability comes from [[Pretraining]] scale, not from new hand-written features
- Abilities are hard to predict in advance and hard to attribute to any single component; they arrive as the network grows
- After [[Fine-tuning]], these raw abilities get shaped into products: coding assistants, browsing agents (see [[Tool Use]])

## Open Question

Whether the abilities are truly emergent thresholds or artifacts of how capability is measured remains debated; for practical purposes, scale keeps paying off.

## Related

- [[Large Language Model]]
- [[Pretraining]]
- [[Tool Use]]
