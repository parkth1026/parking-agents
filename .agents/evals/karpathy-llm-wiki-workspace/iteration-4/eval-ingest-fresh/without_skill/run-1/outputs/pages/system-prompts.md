---
title: System prompts
tags: [interaction, prompting]
status: draft
created: 2026-08-18
updated: 2026-08-18
source: "Andrej Karpathy, 'Intro to Large Language Models' (YouTube talk, ~1h, 2023)"
---

# System prompts

> A system prompt is a special (usually hidden) message prepended to the
> conversation that conditions the assistant's behavior for that session —
> persona, tone, rules, and available tools. It is the main inference-time
> "programming interface" for LLM assistants.

## Key ideas

- **Where it sits.** Before any user message, the client or developer supplies
  a system message: "You are a helpful assistant," custom instructions
  ("answer concisely; I'm a developer"), or constraints ("use only the
  provided documents"). The model generates everything after it, conditioned
  on it.
- **Fine-tuning vs. system prompt.**
  - [Fine-tuning](fine-tuning.md) changes *weights*: expensive, global,
    persistent.
  - A system prompt changes only *this conversation*: free, instant,
    per-application. It is how the same underlying model is customized into
    many different products.
- **Beyond persona.** System prompts also gate features and tools (see
  [Tool use](tool-use.md)) and carry operational rules the developer wants
  enforced on every turn.

## Limitations

- **It is conditioning, not a boundary.** The system prompt is "just text" in
  the same context as everything else — there is no hardware-level separation
  between it and later messages. [Jailbreaks](jailbreaks.md) and
  [Prompt injection](prompt-injection.md) both exploit exactly this: anything
  that can influence the context can influence the model.
- **It competes for context.** The context window is finite working memory
  (see [LLM OS](llm-os.md)); long system prompts crowd out conversation and
  documents.

## Open questions

- How faithful are models to long, contradictory, or adversarial system
  prompts?
- Should instruction-following move into fine-tuning once an application's
  rules stabilize?

## See also

- [Fine-tuning](fine-tuning.md) — the weight-changing counterpart.
- [Tool use](tool-use.md) — behavior and tools declared per application.
- [Jailbreaks](jailbreaks.md) — users attacking past the system prompt.
- [Prompt injection](prompt-injection.md) — third parties attacking past it.

## References

- Andrej Karpathy, "Intro to Large Language Models" (YouTube talk, ~1h, 2023) — system prompts as the way assistants are configured and (attempt to be) protected.
