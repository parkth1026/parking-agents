---
title: "LLM OS"
created: 2026-04-13
updated: 2026-04-13
type: concept
tags: [architecture, inference, core-concept, emergent-abilities]
sources: ["Intro to Large Language Models"]
---

# LLM OS

A conceptual framework introduced by [[Andrej Karpathy]] that likens a large
language model to the kernel of a new kind of operating system — coordinating
memory, tools, I/O, and processes around an LLM at its core.

## The Analogy

| Traditional OS | LLM OS |
|----------------|--------|
| CPU | LLM (the central processor) |
| RAM | Context window (working memory) |
| Hard disk | External memory (files, databases, retrieval) |
| Processes | Agent loops / sub-tasks |
| Syscalls | Tool calls (browser, calculator, code interpreter) |
| I/O devices | Multimodal inputs (images, audio, video, sensors) |

## Components of an LLM OS

### Context Window as RAM
The context window (e.g., 128K tokens) is the model's working memory. Information
must be "paged in" to the context to be reasoned over — analogous to RAM in a CPU.
See [[Context Window]].

### Tools
LLMs gain new capabilities by calling external tools:
- **Web browser**: fetch live information
- **Code interpreter**: execute Python
- **Calculator**: arithmetic precision
- **Memory systems**: retrieve past context via [[Retrieval-Augmented Generation]]
- **API calls**: interact with external services

### Multimodal Inputs
Future LLM OS accepts any modality: text, images, audio, video, computer states.
Already demonstrated in GPT-4V, Gemini, and similar models.

### Agent Loops
The LLM can run as an agent — perceive, plan, act, observe in a loop. This enables:
- Long-horizon task completion
- Self-correction and reflection
- Spawning sub-agents

## Significance
This framing recontextualizes LLMs from "chatbots" to foundational computing
infrastructure. Just as a kernel abstracts hardware for programs, the LLM
abstracts reasoning for applications. Karpathy argues this is a new computing
paradigm, not merely a new app.

## Current Limitations
- Context window size (finite RAM)
- Hallucination (unreliable read/write to "memory")
- Slow inference speed for agent loops
- Security: prompt injection attacks can hijack tool use (see [[Prompt Injection]])

## Related
- [[Andrej Karpathy]], [[Pretraining]], [[Context Window]], [[Prompt Injection]], [[Scaling Laws]]
