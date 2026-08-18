# Tool use

> **TL;DR** An LLM can be given **tools** it may invoke while answering — browser,
> calculator, image generator, code interpreter. The model is fine-tuned to emit tool
> calls as part of its output; the host application executes them and feeds the
> results back into the conversation.

**Provenance:** Karpathy, *Intro to Large Language Models* (2023), sections on tool
use and the LLM OS.

## How it works

- Fine-tuning data includes conversations that contain **tool invocations**, so the
  model learns when to emit a call and in what format (via special tokens or
  conventions in the output).
- The runtime loop: model emits a tool call → the host application executes it → the
  result is appended to the context → the model continues its answer.
- In 2023, ChatGPT **plugins** were the flagship consumer-facing example of this
  pattern.

## Tools from the talk

| Tool | What it adds |
|---|---|
| Browser / internet search | Fresh information beyond the training cutoff |
| Calculator | Exact arithmetic — a weak spot for a lossy neural predictor |
| DALL-E | Image generation from text |
| Python interpreter | Exact computation and data processing via code execution |

## Why tools matter

- **Offload the exact to the deterministic.** Next-token prediction is lossy; a
  calculator or interpreter is not ([What is an LLM?](what-is-an-llm.md)).
- **Escape the knowledge cutoff.** Browsing replaces stale parametric knowledge with
  current sources ([Emergent capabilities](emergent-capabilities.md#limitations-from-the-talk)).
- **They are the "peripherals" of the LLM OS.** In Karpathy's mental model, tools hang
  off the model like devices hang off a computer ([The LLM OS](llm-os.md)).

## Security note

Every tool widens the attack surface. A browsing tool feeds untrusted web pages
straight into the model's context, enabling [prompt injection](security-prompt-injection.md).
Grant tools least privilege and confirm consequential actions out-of-band.

## See also

- [The LLM OS](llm-os.md) — tools as peripherals
- [System prompts](system-prompts.md) — the other way products steer model behavior
- [Prompt injection](security-prompt-injection.md) — tools as an attack vector

## References

- Andrej Karpathy, *Intro to Large Language Models* (YouTube, Nov 2023).

---
Part of the [LLM Wiki](../index.md).
