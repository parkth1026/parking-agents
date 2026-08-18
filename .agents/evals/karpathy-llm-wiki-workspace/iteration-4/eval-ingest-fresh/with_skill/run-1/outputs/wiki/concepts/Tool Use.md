---
title: "Tool Use"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [agents, fine-tuning]
sources: ["Intro to Large Language Models"]
---

# Tool Use

Giving a fine-tuned LLM the ability to call external programs mid-conversation:
a browser, a calculator, a Python interpreter. In Karpathy's framing, tools
are the **peripherals of the emerging LLM computer** (see [[LLM OS]]) — the
model is the CPU/kernel, and tools are how it touches the outside world.

## How It Works

- The model is fine-tuned (see [[Fine-Tuning]]) to emit structured requests ("run
  this code", "fetch this page") instead of only plain text; the runtime
  executes them and feeds results back into the context.
- Tools fix concrete weaknesses of raw [[Next Token Prediction]]: arithmetic
  and precise computation are offloaded to a calculator/interpreter rather
  than approximated in weights; current information comes from browsing
  instead of frozen [[Pretraining]] data.
- Tool-enabled assistants are strictly more capable, but every new channel
  is a new attack surface: fetched web pages can carry [[Prompt Injection]],
  and tool protocols interact with the safety rules set in the
  [[System Prompt]].

## Variants

- ChatGPT-style plugins/tools, code interpreters, browsing, function/API
  calling — all instances of the same pattern.
- "Agents" as the generalization: models that plan multi-step tool chains.

## History

Tool use arrived in mainstream assistants during 2023 (calculator, browsing,
code interpreter plugins), which is why the talk treats it as part of the
standard assistant picture rather than a research novelty.

## Related

- [[Fine-Tuning]] — how models learn tool protocols
- [[System Prompt]] — runtime steering of tool-enabled behavior
- [[Prompt Injection]] — the security cost of tools that read external content
- [[Intro to Large Language Models]] — the source talk for this page
