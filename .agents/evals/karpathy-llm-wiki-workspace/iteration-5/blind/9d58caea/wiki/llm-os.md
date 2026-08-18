# The LLM OS

> **Source:** Karpathy, *Intro to Large Language Models* (2023) · **Status:** initial ingest · [Home](home.md)

**Summary:** Karpathy's mental model for where all of this is heading: the LLM as the **kernel process of an emerging operating system**. Context window as RAM, tools as peripherals, multimodal encoders as eyes and ears. The analogy compresses everything else in this wiki into one picture.

## The analogy

| Operating system | LLM OS counterpart | Notes |
|---|---|---|
| CPU / kernel process | **the LLM itself** | the coordinator everything flows through |
| RAM (working memory) | **context window** | finite; whatever isn't in context effectively doesn't exist for the model |
| Peripherals / drivers | **[tools](tool-use.md):** browser, calculator, Python interpreter | the kernel calls out to devices to do exact work |
| Eyes and ears | **multimodal encoders** (image, audio → tokens) | and increasingly mouth: generated image/audio/video |
| Multithreading / multiprocessing | **parallel model calls, speculative execution** | fan a query out to several models/attempts, use the first good answer |
| The platform | an ecosystem of many models, many sizes, open and closed | software written for the "OS" (prompts, tools) becomes portable-ish across kernels |

## The picture

```
            ┌──────────────┐   ┌─────────────┐   ┌───────────┐
 images ──▶ │              │◀─▶│   browser   │◀─▶│  python   │
 audio  ──▶ │      LLM     │   └─────────────┘   └───────────┘
 video  ──▶ │  (kernel)    │   ┌─────────────┐   ┌───────────┐
 files  ──▶ │              │◀─▶│ calculator  │◀─▶│  more...  │
            └──────┬───────┘   └─────────────┘   └───────────┘
                   │
            context window = RAM
```

## Why "oper system" is the right frame

- **The model alone is not the product.** Just as a CPU is useless without memory and I/O, the raw network ([What is an LLM?](what-is-an-llm.md)) becomes useful when wrapped in context management, [tools](tool-use.md), and [system prompts](system-prompts.md) — i.e., an environment.
- **The economics of an OS.** Because [pretraining](pretraining.md) is expensive but running is cheap, expect a few big "kernels" plus a thriving ecosystem of smaller, specialized, and open models — like a hardware market with both mainframes and microcontrollers.
- **The OS runs everywhere.** Smaller LLMs already run on laptops and phones; the trajectory is always-on, local, private models in every device — Karpathy's phrase: **"full self-driving computers"**, computers that operate themselves on your behalf rather than waiting for keystrokes.

## The catch

An OS needs a security model — privilege separation, protected memory — and today's LLM stack has none, because instructions and data share one token stream. [Jailbreaks](jailbreaks.md) are user-mode code grabbing kernel privileges; [prompt injection](prompt-injection.md) is hostile data inside a trusted driver call. Building the LLM OS's security model is one of the defining open problems (see [Open questions](open-questions.md)).

## Related

- [Tool use](tool-use.md) · [System prompts](system-prompts.md) — the peripherals and the boot flags.
- [Scaling and emergence](scaling-and-emergence.md) — why the kernel keeps improving.
- [Open questions](open-questions.md) — what to build into the wiki next.
- [Glossary](glossary.md) — context window, LLM OS.
