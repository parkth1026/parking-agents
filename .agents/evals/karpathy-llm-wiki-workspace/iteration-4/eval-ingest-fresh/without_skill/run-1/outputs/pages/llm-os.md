---
title: LLM OS
tags: [future, architecture]
status: draft
created: 2026-08-18
updated: 2026-08-18
source: "Andrej Karpathy, 'Intro to Large Language Models' (YouTube talk, ~1h, 2023), closing section"
---

# LLM OS

> Karpathy's framing for where the field is heading: the LLM as the **kernel /
> CPU of a new kind of computer**. The context window is its RAM, tools are
> its peripherals, and the assistant products of today are early versions of
> this operating system.

## The analogy

| Computer concept | LLM OS counterpart |
|---|---|
| CPU / kernel | The LLM itself — the general-purpose processor of language ([What are LLMs?](what-are-llms.md)) |
| RAM | The **context window** — finite working memory; anything the model must use has to be brought into it |
| Peripherals | **Tools** — browser, calculator, code execution, file system ([Tool use](tool-use.md)) |
| I/O devices | Multimodality — images and audio in and out |

Two implications worth internalizing:

- **Context as RAM.** Like a process that must page data into memory, the
  model can only work with what is in its context; retrieval and tools are
  the "loading from disk" operations.
- **The CPU improves by scaling.** Better "hardware" comes from continued
  scaling of the model itself (see
  [Emergent capabilities](emergent-capabilities.md)) — the platform gets
  faster without being rewritten.

## Open problems the analogy makes vivid

- **Reliability.** Hallucination (see [What are LLMs?](what-are-llms.md)) is
  the platform computing confidently wrong results — unacceptable in an OS.
- **Security.** [Jailbreaks](jailbreaks.md) and
  [Prompt injection](prompt-injection.md) are the exploits of this platform:
  there is no privilege separation between operator text and untrusted text.
- **Interoperability.** The plugin/tool ecosystem is still pre-standard —
  analogous to the era before stable OS interfaces.

## Outlook from the talk

- Assistants today are the crude, early mainframes of this platform; the
  trajectory is toward the LLM OS being the general substrate applications are
  built on.
- Today's models are the worst ones you will ever use — the platform improves
  on every axis each generation.
- Practical advice implied: learn to *program* this machine (prompting, tool
  composition, context management) the way an earlier generation learned to
  program computers.

## Open questions

- What are the "system calls" of an LLM OS — stable interfaces tools and
  applications can target?
- Does the analogy break down: is next-token prediction really a general CPU,
  or a special-purpose co-processor needing classic software around it?

## See also

- [What are LLMs?](what-are-llms.md) — the CPU in question.
- [Tool use](tool-use.md) — the peripherals.
- [Emergent capabilities](emergent-capabilities.md) — the scaling engine behind it.
- [Prompt injection](prompt-injection.md) — the platform's signature security hole.

## References

- Andrej Karpathy, "Intro to Large Language Models" (YouTube talk, ~1h, 2023) — closing section: the LLM OS diagram and outlook.
