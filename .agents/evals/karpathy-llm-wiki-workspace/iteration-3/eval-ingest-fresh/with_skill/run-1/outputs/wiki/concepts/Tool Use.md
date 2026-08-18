---
title: "Tool Use"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [agents, prompting]
sources: ["Intro to Large Language Models"]
---

# Tool Use

An LLM by itself only emits text. Wrap it in a loop that lets it call tools — a web browser, a calculator, a Python interpreter, or an internal API — and it can act: search, compute exactly, run code, and feed the results back into its own context.

## How It Works

- The model is prompted to emit a structured tool-call request instead of a plain answer
- The surrounding harness executes the call and appends the result to the context; the model then continues
- Browsing and code execution partially mitigate hallucination for factual and arithmetic tasks: the tool, not the weights, holds the ground truth

## Caveats

- Granting tools expands the attack surface: web pages or emails the model reads can carry hostile instructions — see [[Prompt Injection]]
- Karpathy's endgame for this pattern is the [[LLM OS]], where tools become the peripherals of an LLM-centric computer

## Related

- [[Large Language Model]]
- [[Prompt Injection]]
- [[LLM OS]]
