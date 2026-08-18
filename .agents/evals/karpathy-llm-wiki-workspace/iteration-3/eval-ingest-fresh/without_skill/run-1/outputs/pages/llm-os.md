# The LLM OS

> **TL;DR** Karpathy's mental model for where the ecosystem is converging: the LLM is
> the CPU/kernel of a new kind of computer — context window as RAM, tools as
> peripherals, chat as the console — which turns model security into kernel security.

**Provenance:** Karpathy, *Intro to Large Language Models* (2023), closing section on
the future. It is a 2023-era prediction, not a shipped architecture.

## The analogy

| Traditional computer | LLM OS |
|---|---|
| CPU / kernel | the LLM |
| RAM (working memory) | the context window |
| Console / terminal | the chat interface |
| Keyboard input | text tokens |
| Camera / microphone | images and audio, tokenized |
| Software and peripherals | tools: browser, file system, calculator, DALL-E, Python interpreter |

## What the analogy explains

- **Tool use is "plugging in peripherals."** Browser, calculator, image generator, and
  interpreter hang off the model like devices off a computer
  ([Tool use](tool-use.md)).
- **The context window is scarce memory.** Only what fits "in RAM" is usable at once;
  anything outside the window is forgotten. Longer contexts are like more RAM.
- **Everything becomes tokens.** Text, images, and audio are all tokenized on the way
  in (and images can come out the other side, e.g. via DALL-E). Token count is the
  unit of compute cost, so richer modalities mean richer "instruction streams."
- **Security becomes kernel security.** The model is the central component that
  everything flows through, so attacks on it matter like attacks on a kernel:
  [jailbreaks](security-jailbreaks.md) are user-side attacks;
  [prompt injection](security-prompt-injection.md) is malicious data reaching the
  kernel through its peripherals.

## Implications as of the talk (2023)

- Models keep scaling and improving; expect the analogy to feel more apt over time.
- The ecosystem consolidates around a few foundation models, with apps, tools, and
  fine-tunes layered on top ([Training](training-llms.md)).
- Kernel-grade security work — red-teaming, privilege separation for tools, defenses
  against injection — becomes a first-class requirement, not an afterthought.

## Caveats

This is an *analogy*, not a literal operating system: the LLM does not schedule
processes or manage memory pages, and the mapping is lossy at the edges. Its value is
organizational — it cleanly explains tools, context limits, multimodality, and the
security model as aspects of one picture.

## See also

- [Tool use](tool-use.md) — the peripherals
- [Jailbreaks](security-jailbreaks.md) and [Prompt injection](security-prompt-injection.md) — the security model
- [What is an LLM?](what-is-an-llm.md) — the "CPU" itself

## References

- Andrej Karpathy, *Intro to Large Language Models* (YouTube, Nov 2023).

---
Part of the [LLM Wiki](../index.md).
