# Tool use

> **Source:** Karpathy, *Intro to Large Language Models* (2023) · **Status:** initial ingest · [Home](home.md)

**Summary:** LLMs are fuzzy at exactly the things computers are exact at. Tool use fixes this by letting the model call out to attachments — a browser, a calculator, a Python interpreter — instead of improvising. This is how products ground the model against reality, and it is a load-bearing part of the [LLM OS](llm-os.md) analogy.

## Why tools at all

- Models **hallucinate** facts and can't know anything past their pretraining data.
- They do approximate, pattern-based arithmetic — fine for vibes, wrong for ledgers.
- Anything requiring exact, auditable computation or fresh information is a poor fit for pure next-token prediction.

The fix is not "make the model bigger" but "let the model delegate": the LLM becomes the orchestrator, and classical software becomes its instruments.

## The canonical attachments

| Tool | Compensates for | Example |
|---|---|---|
| **Browser / search** | knowledge cutoff, hallucinated citations | look up current events before answering |
| **Calculator** | fuzzy arithmetic | compute exact numbers instead of guessing digits |
| **Code interpreter (Python)** | anything requiring exact execution | write and run a program, use its output |

Karpathy demoed this via ChatGPT plugins: the model emits something like a function call, e.g. `calculator(...)` or a search query, the environment executes it and returns the result into the context, and the model continues its answer with grounded data. An ecosystem of plugins turned this into a platform — Wolfram and similar services exposing themselves as callable tools.

## What tool use buys you

- **Grounding:** answers anchored in retrieved documents or executed code, not improvised memory. This is one of the main practical mitigations for hallucination.
- **Capabilities beyond the weights:** the model's "knowledge" becomes whatever it can reach and compute, not just what was compressed into [pretraining](pretraining.md).
- **Safety property:** exact work happens in a sandbox where it can be checked, instead of inside an [inscrutable network](what-is-an-llm.md).

## The dark side

A model that follows instructions found in retrieved content is a model that can be hijacked by retrieved content. Handing the model a browser is what makes [prompt injection](prompt-injection.md) a real attack class, not a curiosity. Tools and security must be designed together.

## Related

- [System prompts](system-prompts.md) — the other main steering mechanism.
- [The LLM OS](llm-os.md) — tools as peripherals of the kernel.
- [Prompt injection](prompt-injection.md) — the cost of giving the model eyes.
- [Glossary](glossary.md) — tool use, plugin, grounding.
