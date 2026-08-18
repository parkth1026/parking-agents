# What is an LLM?

> **TL;DR** A large language model is a neural network trained on internet-scale
> text to do exactly one thing: predict the next token. Everything else it appears
> to do emerges from that single objective at scale.

**Provenance:** Karpathy, *Intro to Large Language Models* (2023), part 1 "What is an LLM".
Figures are as of the talk (late 2023).

## The two ingredients

Karpathy breaks an LLM into just two ingredients:

1. **Data** — a large corpus of internet text: web pages, Wikipedia, books, code,
   forums. After cleaning, roughly **10 TB of text** (trillions of tokens; for
   reference, Llama 2 was pretrained on ~2 trillion tokens).
2. **A neural network** — a transformer whose learned knowledge lives in a
   **parameters file**. A 2023-era model has on the order of **100 billion
   parameters**; Llama 2 70B's parameters file is about **140 GB** (2 bytes per
   parameter at fp16).

Training is the process of adjusting those parameters so the network becomes good at
next-token prediction on that data. In this framing an LLM is *just* `{data,
parameters}` plus the training process that connects them.

## Tokens and the tokenizer

- Text is never fed to the network as raw characters or whole words. A **tokenizer**
  splits text into **tokens** — subword pieces drawn from a fixed **vocabulary** of
  roughly **50,000** entries (model-dependent; tens of thousands is typical).
- Rule of thumb: **1 token ≈ 4 characters ≈ 3/4 of a word**.
- The model's input and output are token sequences. It outputs a probability
  distribution over the vocabulary for the *next* token; the chosen token is appended
  and the process repeats (**autoregressive** generation).

## Next-token prediction

Give the network the tokens so far; it returns probabilities for the next token
(e.g. "the": 6%, "a": 4%, "of": 2%, ...). Sample one, append it, repeat. There is no
planner, no lookup table, and no explicit database inside — prediction over internet
text is the entire training signal.

## Lossy compression of the internet

Pretraining compresses ~10 TB of text into ~100 GB of parameters: a **lossy,
statistical compression of the internet**. Two consequences worth remembering:

- A **base model** (pretraining only, see [Training](training-llms.md)) is an
  *internet-document simulator*. Ask it a question and it may answer with more
  questions or continue as a forum thread, because that is what internet documents
  look like. Karpathy describes sampling from a base model as the model "dreaming"
  plausible internet text — e.g. drifting into a made-up but convincing Wikipedia-style
  article.
- Only the patterns that helped prediction survive compression. This is why models are
  strong on common patterns and unreliable on rare details — the root of
  [hallucination](emergent-capabilities.md#limitations-from-the-talk).

## Why prediction produces "knowledge"

To predict text well, the network must implicitly model what the text is *about*:
grammar, facts, styles, even some reasoning. Nothing in the architecture hard-codes
this — it falls out of the objective and scale. That is the core surprise of LLMs,
and the reason capability keeps improving with size
([Emergent capabilities](emergent-capabilities.md)).

## See also

- [Training: pretraining vs fine-tuning](training-llms.md) — the two stages that turn this raw predictor into a product
- [Emergent capabilities at scale](emergent-capabilities.md)
- [Glossary](glossary.md)

## References

- Andrej Karpathy, *Intro to Large Language Models* (YouTube, Nov 2023).

---
Part of the [LLM Wiki](../index.md).
