---
title: "Tool Use"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [agents, inference]
sources: ["Intro to Large Language Models"]
---

# Tool Use

Extending a [[Large Language Model]] beyond pure text prediction by letting it
call external systems mid-generation: search the web, run a calculator, execute
Python. The model emits special tokens requesting a tool call, the harness
executes it, and the result is appended to the context for the next step.

## How It Works

- **Browser/search** — the model fetches current information it could not have
  memorized, mitigating staleness (not hallucination itself: the page may
  still be wrong).
- **Calculator** — arithmetic is delegated instead of predicted; next-token
  arithmetic is unreliable, so products route it out.
- **Python interpreter** — the model writes and runs code, then reads the
  output; this is how data analysis and precise computation actually ship.
- The pattern generalizes: any callable wrapped in a protocol the model can
  request. In practice models learn tool-call formats during [[Fine-tuning]],
  and per-product behavior is steered by the [[System Prompt]].

## Variants

- Vendor tool suites (browser, code interpreter, function calling) exposed in
  chat products.
- Custom function/tool calling, where developers register schemas and the
  model fills arguments.
- Multi-step agent loops that chain tool calls toward a goal.

## History

Pre-LLM systems had tool plug-ins, but the LLM-era shift is that tool use is
*learned*, not hard-coded: fine-tuning on tool-use traces taught models when
to call what. Karpathy's [[Intro to Large Language Models]] presents tools as
the natural patch for structural weaknesses of prediction, and as the
peripherals of the [[LLM OS]].

## Related

- [[System Prompt]] — where tool policy is configured
- [[LLM OS]] — tools as the peripherals of the LLM-centric computer
- [[Prompt Injection]] — the security cost of letting models read external data
