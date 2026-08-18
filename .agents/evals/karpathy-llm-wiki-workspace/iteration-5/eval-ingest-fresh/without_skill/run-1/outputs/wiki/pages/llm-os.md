---
title: The LLM OS
tags: [future, llm-os, agents, architecture]
status: seed
source: "Karpathy, 'Intro to Large Language Models' (2023)"
created: 2026-08-18
---

# The LLM OS

> Karpathy's outlook for where this goes: the LLM becomes the *kernel* of a
> new kind of operating system, with the context window as RAM, tools as
> peripherals, and other models as cooperating processes.

## The analogy

| Computer | LLM OS |
|---|---|
| CPU / kernel | The LLM (~100 GB of parameters) |
| RAM (working memory) | The context window (limited tokens) |
| Peripherals: disk, network | Tools: file system, browser/search, APIs |
| Sensors: camera, microphone | Multimodal inputs: images, audio |
| Processes / userspace programs | Multiple LLMs talking to each other |

ASCII sketch of Karpathy's diagram:

```
              +------------------------------+
              |        LLM (kernel)          |
              |   ~100 GB of parameters      |
              +---------------+--------------+
                              |   context window (RAM)
              +---------------+----------------+
              |        tokens flowing in/out   |
              +---------------+----------------+
        +-----------+-----------+-----------+-----------+
      files      browser     calculator/  audio/     other
      (disk)     (web)       code         vision     agents
```

## Points the analogy captures

1. **Context window = RAM.** The model only "sees" what fits in context;
   deciding what goes in and out (retrieval, tool results, summaries) is
   memory management.
2. **Tools = peripherals.** The LLM orchestrates them but does not contain
   them — see [Tool Use & System Prompts](tool-use.md).
3. **Multimodality = sensors.** The same token machinery learns to consume
   images and audio, not just text.
4. **Multi-agent = processes.** Multiple LLM instances can delegate and
   talk to each other like cooperating programs.

## Why it matters

- Reframes LLMs from "a chat product" to a *platform* others build on — a
  new kind of computer.
- Makes the security stakes obvious: the kernel of this OS can be
  jailbroken or prompt-injected — see [Security Risks](security-risks.md).

## Caveats

- Presented in the talk as an *outlook*, not a dated prediction. Revisit
  as the field moves.

## See also

- [Tool Use & System Prompts](tool-use.md) — the peripherals
- [Security Risks](security-risks.md) — securing the kernel
- [What Are LLMs?](what-are-llms.md) — what sits in the middle
- [Emergent Capabilities at Scale](emergent-capabilities.md) — why the
  kernel keeps improving

## References

- Andrej Karpathy,
  [*Intro to Large Language Models*](https://www.youtube.com/watch?v=zjkBMFhNj_g)
  (2023) — final section, the LLM OS diagram.
