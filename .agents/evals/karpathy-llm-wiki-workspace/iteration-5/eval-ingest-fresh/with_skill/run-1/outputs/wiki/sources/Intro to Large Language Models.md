---
title: "Intro to Large Language Models"
created: 2026-08-18
updated: 2026-08-18
type: source
tags: [talk, tutorial]
sources: []
---

# Intro to Large Language Models

> **Authors**: Andrej Karpathy | **Year**: 2023 | **Type**: Talk (1hr)
> **URL**: not captured at ingestion — user-supplied summary (talk published
> on YouTube; raw record in wiki-raw/transcripts/)

## Key Takeaways

1. An LLM is one simple thing: a neural network trained for
   [[Next Token Prediction]] over a large slice of internet text — shipped
   as a "parameters file + run file".
2. Building one is two stages: expensive internet-scale [[Pretraining]],
   then cheap, high-quality [[Fine-Tuning]] that turns a document simulator
   into an assistant (ChatGPT-style).
3. Capabilities at scale are [[Emergent Abilities]] — discovered by probing,
   not specified by engineers; hallucination is the flip side of
   next-token plausibility.
4. Assistants gain new abilities via scaffolding — the [[System Prompt]] and
   [[Tool Use]] (browser, calculator, plugins, frameworks) — not via
   retraining.
5. Security is the open wound: [[Prompt Injection]] and jailbreaking subvert
   assistants, and grow more dangerous as tool use expands.
6. The trajectory is an [[LLM OS]]: the model as kernel, context window as
   RAM, tools as programs, modalities as peripherals.

## Concepts Introduced or Covered

- [[Next Token Prediction]] — the single training objective
- [[Pretraining]] — internet-scale stage one
- [[Fine-Tuning]] — curated Q&A stage two
- [[Emergent Abilities]] — capabilities discovered at scale
- [[System Prompt]] — the hidden configuration block
- [[Tool Use]] — browser, calculator, plugins
- [[Prompt Injection]] — injection plus jailbreaking, the security risks
- [[LLM OS]] — the future framing
- [[Andrej Karpathy]] — the speaker
- [[Large Language Model]] — the talk's subject, in one definition

## Notable Quotes

> "An LLM is just next token prediction on a large amount of internet text."

Fidelity note: this wiki was ingested from the user's topic summary of the
talk, not a transcript — treat the wording above as a paraphrase and verify
against the video before quoting.

## Critical Notes

- Ingested from a user-provided topic summary; depth is limited to the six
  topic areas the user listed, with no verbatim transcript to check against.
- The talk is from late 2023: product examples (plugins, model names, cost
  figures) are historical snapshots and may be outdated.
