# System prompts

> **Source:** Karpathy, *Intro to Large Language Models* (2023) · **Status:** initial ingest · [Home](home.md)

**Summary:** A system prompt is text that sits *before* the user's input — instructions and context the developer controls and the user typically never sees. It is the main steering wheel for a deployed LLM: persona, constraints, rules, and pre-filling all happen here.

## Mechanism

- Recall from [What is an LLM?](what-is-an-llm.md): the model just continues a token sequence. A conversation is a single token stream with role markers (`system`, `user`, `assistant`).
- The **system prompt** is simply the first segment of that stream, written by the developer instead of the user. The model has been [fine-tuned](fine-tuning.md) to treat it as higher-priority context.
- **Pre-filling** generalizes this: you can also append the *beginning of the assistant's reply* to constrain where it can go. The model completes whatever document it is handed — so shape the document, shape the behavior.

## What system prompts are used for

- **Persona and format** — "answer like a pirate" (Karpathy's example), "always reply in JSON", "be terse".
- **Task constraints** — e.g. for an exam-taking bot: "you may only answer with A, B, C, or D".
- **Custom instructions** — product features (like ChatGPT's) that persist user preferences across chats are implemented as injected system text.
- **Policy** — refusal rules, scope limits, safety instructions live here too.

## Why it matters

- It is the *de facto programming language* of LLM applications: behavior is changed by writing instructions, not by touching weights. Cheap, flexible, and versionable — but soft.
- "Soft" is the key word: a system prompt is a **request, not a boundary**. Because system instructions and user data share the same context window and the same token stream, nothing structurally prevents other text in the conversation from competing with or overriding it. That is exactly what [Jailbreaks](jailbreaks.md) exploit, and why [Prompt injection](prompt-injection.md) is hard: the model has no enforced separation between "code" (instructions) and "data".

## Rules of thumb

- Treat anything that must be *guaranteed* (auth, privacy, exact computation) as application code or [tool use](tool-use.md), not as system-prompt text.
- Treat the system prompt as strong default steering that a sufficiently motivated input can attempt to override.

## Related

- [Tool use](tool-use.md) — steering via delegation instead of instruction.
- [Jailbreaks](jailbreaks.md) · [Prompt injection](prompt-injection.md) — when steering fails.
- [Glossary](glossary.md) — system prompt, prefilling, custom instructions.
