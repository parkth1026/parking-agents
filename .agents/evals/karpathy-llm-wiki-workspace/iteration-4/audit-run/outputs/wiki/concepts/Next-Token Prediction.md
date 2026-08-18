---
title: "Next-Token Prediction"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [language-model, core-concept]
sources: ["Karpathy Intro to LLMs Talk"]
---
# Next-Token Prediction

The core objective of an LLM: given a sequence of tokens, predict the most likely next one.

## How It Works
The model is trained on internet-scale text to minimize next-token loss; at inference it repeatedly samples its own prediction to generate text. Simple objective, surprisingly general behavior.

## Why It Matters
All higher-level abilities discussed in the [[Karpathy Intro to LLMs Talk]] — from [[Pretraining]] scale effects to [[Fine-Tuning]]-shaped assistant behavior — grow out of this one training signal, with [[Emergent Capabilities]] appearing as models scale.
