# What is an LLM?

> **Source:** Karpathy, *Intro to Large Language Models* (2023) · **Status:** initial ingest · [Home](home.md)

**Summary:** A large language model is "just" a neural network that has been trained on a large chunk of the internet to do one thing: predict the next token. That single, simple objective, applied at massive scale, produces systems that can converse, write code, and reason — even though we can't fully inspect how.

## The two-file mental model

Karpathy's most compact way to see an LLM: shipping one is shipping **two files**.

| File | Contents | Typical size |
|---|---|---|
| **Parameters file** | the learned weights of the network — "a big pile of numbers" | tens to hundreds of GB (e.g., a ~10B-parameter model at 2 bytes per parameter is roughly 20 GB) |
| **Run file** | code that executes the network, e.g., ~500 lines of plain C with no dependencies | a few KB |

Everything the model "knows" lives in the parameters. They start out random, and training adjusts them until the network becomes good at the prediction objective below. Notably, once trained, running the model requires no infrastructure beyond these files — the hard part is producing the parameters, not running them.

## Tokens and next-token prediction

- Text is chopped into **tokens** (chunks of words / subwords). Everything the model does operates on token sequences.
- The training objective is exactly one line of description: given some tokens, **predict the next token**. Repeat over huge amounts of text; nudge parameters each time to be slightly less wrong.
- **Generation is autoregressive:** the model predicts one token, appends it to the input, and predicts again. Sampling token by token is how a prompt turns into a paragraph.

This is why LLMs feel like autocomplete — they literally are — and why their outputs are so sensitive to the wording of the prompt: the prompt is just the beginning of a document whose continuation the model is improvising.

## What is inside the parameters

- The network architecture is the **Transformer** (from the 2017 paper *Attention Is All You Need*). Karpathy's framing: the architecture is a real but *secondary* detail — the essence of an LLM is the objective and the scale, not the specific wiring.
- Internally the model is hundreds of layers of matrix multiplications over learned representations. We can inspect every number, yet we have only a limited, science-in-progress understanding of what they compute — the network is largely **inscrutable**.

## Scale examples (as of the talk)

- **Llama 2** (Meta, 2023): open-weights family at 7B / 13B / 70B parameters — small enough to run yourself.
- **GPT-4** (OpenAI, 2023): size never disclosed; rumored around a **trillion parameters** (speculation at the time, treat as such).

## Properties worth internalizing

- **It is not a database.** Training is a *lossy compression* of internet text into the parameters — most of the internet fits "in spirit," none of it verbatim.
- **It is a simulator, not an oracle.** Ask it a question and it continues the document in the style of an answer; correctness is not guaranteed (see [Fine-tuning](fine-tuning.md) and [Scaling and emergence](scaling-and-emergence.md) for hallucination).
- **Simple objective, complex behavior.** Nothing in the training objective mentions conversation or reasoning; those are what the objective produces at scale.

## Related

- [Pretraining](pretraining.md) — how the parameters get that way.
- [Scaling and emergence](scaling-and-emergence.md) — why more parameters keep helping.
- [Glossary](glossary.md) — token, parameter, transformer, autoregressive.
