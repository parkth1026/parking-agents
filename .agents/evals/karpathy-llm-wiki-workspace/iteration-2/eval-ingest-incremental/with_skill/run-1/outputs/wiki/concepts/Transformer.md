---
title: "Transformer"
created: 2026-08-10
updated: 2026-08-14
type: concept
tags: [architecture, core-concept]
sources: ["Flash Attention Article Summary"]
---
# Transformer
Stacked attention + feed-forward blocks.
## Efficiency
Long-context training and serving depend on efficient attention kernels such as
[[Flash Attention]], which keeps attention memory at O(N) without approximation.
## Related
- [[Attention Mechanism]]
- [[Neural Network]]
