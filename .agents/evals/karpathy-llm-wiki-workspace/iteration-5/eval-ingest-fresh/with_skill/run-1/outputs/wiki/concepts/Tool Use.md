---
title: "Tool Use"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [agents, prompting, emerging]
sources: ["Intro to Large Language Models"]
---

# Tool Use

LLMs are good at language and bad at things ordinary computers do well:
exact arithmetic, browsing the live web, executing code. Tool use closes the
gap by giving the model external capabilities — a browser, a calculator, a
code interpreter, plugin APIs — that it can invoke while answering.

## How It Works

- Tools are declared to the model, commonly via the [[System Prompt]]; the
  model emits a call, an execution harness runs it, and the result re-enters
  the context as tokens for the next [[Next Token Prediction]] step.
- This lets a [[Large Language Model]] fetch fresh information and offload
  exact computation instead of hallucinating both.
- The growing ecosystem of plugins and agent frameworks around models is
  what makes the [[LLM OS]] vision concrete: capabilities added as
  "programs" around a fixed model.

## Variants

- Plugin ecosystems (e.g. the ChatGPT plugins of 2023).
- Agent frameworks that chain tool calls autonomously (AutoGPT-style loops).
- Retrieval-style tools that pull documents into context.

## History

Calculator and browser experiments in 2022 evolved into standardized
function/tool-calling APIs; [[Andrej Karpathy]] treats them as the default
way assistants gain skills without retraining — at the price of a widened
[[Prompt Injection]] attack surface.

## Related

- [[System Prompt]] — where tools are declared
- [[LLM OS]] — tools as the programs of the emerging stack
- [[Prompt Injection]] — tools make injected instructions consequential
