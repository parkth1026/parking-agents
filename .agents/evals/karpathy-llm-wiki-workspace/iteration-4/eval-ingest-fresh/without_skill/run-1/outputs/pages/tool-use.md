---
title: Tool use
tags: [tools, agents]
status: draft
created: 2026-08-18
updated: 2026-08-18
source: "Andrej Karpathy, 'Intro to Large Language Models' (YouTube talk, ~1h, 2023)"
---

# Tool use

> An LLM alone can only emit text conditioned on its context — it cannot
> browse, cannot do reliable arithmetic, and cannot touch the world. Tool use
> fixes this: give the model access to browsers, calculators, code execution,
> and APIs, and let it decide when to call them.

## Key ideas

- **The limitation.** Next-token prediction (see
  [What are LLMs?](what-are-llms.md)) gives you fluent text but no
  side effects and no guarantees — arithmetic done "in the weights" is
  unreliable, and the model's knowledge is frozen at training time.
- **The fix.** Wrap the model with tools it can invoke: web search / browsing,
  calculators, code interpreters, arbitrary APIs. The model reads the tool
  results and continues generating.
- **Learning to call tools.** Research like Toolformer showed models can learn
  *when and how* to call APIs from data; product ecosystems (e.g., ChatGPT
  plugins at the time of the talk) packaged the same idea — a marketplace of
  tools the assistant can reach for.

## Consequences

- **Correctness.** Offloading arithmetic to a calculator and facts to search
  removes whole classes of errors without retraining the model.
- **Agent shape.** With tools, the loop becomes: perceive → decide (call a
  tool) → read result → continue. This is the skeleton of LLM agents.
- **Attack surface.** The moment the model ingests content it did not control
  — web pages, emails, documents — third parties can speak to it through that
  content. That is [Prompt injection](prompt-injection.md).
- **The OS analogy.** In the [LLM OS](llm-os.md) framing, tools are the
  *peripherals* of the computer the LLM is the CPU of.

## Open questions

- How should models decide *when* to trust a tool result over their own prior?
- What is the right division of labor between fine-tuning tool-use behavior
  ([Fine-tuning](fine-tuning.md)) and prompting for it
  ([System prompts](system-prompts.md))?

## See also

- [Prompt injection](prompt-injection.md) — the security cost of ingesting external content.
- [LLM OS](llm-os.md) — tools as peripherals in the LLM-as-computer picture.
- [System prompts](system-prompts.md) — declaring and configuring behavior around tools.
- [Emergent capabilities](emergent-capabilities.md) — what the model itself brings before tools.

## References

- Andrej Karpathy, "Intro to Large Language Models" (YouTube talk, ~1h, 2023) — tool use, Toolformer, plugins.
