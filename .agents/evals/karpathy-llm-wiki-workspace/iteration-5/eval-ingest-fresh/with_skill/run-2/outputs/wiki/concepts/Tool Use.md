---
title: "Tool Use"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [agents]
sources: ["Intro to Large Language Models (talk)"]
---

# Tool Use

Letting a [[Large Language Model]] call external tools — a web browser, a
calculator, a Python interpreter — instead of relying purely on its
parameters. Tool use is how assistants get around the model's fixed
knowledge cutoff and its weakness at exact arithmetic.

## How It Works

- The model is fine-tuned (and prompted via a [[System Prompt]]) to emit a
  structured request such as a search query or code block; scaffolding
  code executes it and feeds the result back into the context window.
- Typical tools from the talk: **browsing** (fresh information), a
  **calculator** (exact math the model would otherwise fumble), and **code
  execution** (computation and data processing).
- Tool calls turn a stateless text predictor into the core loop of an
  agent, and are the "peripherals" of the [[LLM OS]] metaphor.

## Variants

- Plugin/tool-calling APIs (the ChatGPT-plugins era and successors).
- Code interpreter notebooks as a general-purpose tool.
- Multi-step agent loops that chain tool calls toward a goal.

## Security Shadow

Every tool widens the attack surface: a browsing model reads web pages it
does not control, which is exactly the vector for [[Prompt Injection]].

## History

Tool use went from research demos to mainstream product feature between
roughly 2022 and 2024; in the talk it is presented as one of the three
scaffolding pieces (with system prompts and fine-tuning) that turn a base
model into a useful assistant.

## Related

- [[Large Language Model]]
- [[System Prompt]]
- [[Prompt Injection]]
- [[LLM OS]]
