---
title: Emergent Capabilities
source: "Andrej Karpathy — Intro to Large Language Models (Nov 2023)"
category: capabilities
tags: [emergence, scaling, forecasting, evaluation]
created: 2026-08-14
status: seed
---

# Emergent Capabilities

## The idea

As models [scale](Scaling.md), most capabilities improve gradually and
somewhat predictably. But some abilities appear to **switch on
unpredictably** once scale crosses some threshold — capabilities nobody
explicitly programmed and that smaller models simply do not show.

The talk uses this to explain two things at once:

- The excitement around scaling: bigger models are not just "more of the
  same"; they can qualitatively do new things.
- The difficulty of **forecasting**: if abilities emerge unpredictably, it is
  hard to know what the next scale-up will be able to do — a core concern
  for safety and for planning.

## Examples of abilities tied to scale

- Following instructions and answering in context, with few or no examples
- Multi-step reasoning and question answering
- Skills like arithmetic and translation improving sharply with size

(Note: the exact inventory of "emergent" abilities and how to measure them
is an open research question — a known gap listed on [Home](../Home.md).)

## Practical implication

You cannot fully test for tomorrow's capabilities on today's models; you
must re-evaluate as models scale. Capability evaluation becomes a recurring
discipline, not a one-time check.

## Related

- [Scaling](Scaling.md)
- [Training Process](../training/Training-Process.md)
- [Hallucinations](Hallucinations.md)
