# Glossary

Short definitions of terms used across this wiki, as used in Karpathy's
*Intro to Large Language Models* (2023). Terms with their own page link to it.

**A – C**

- **Autoregressive** — generating one token at a time, appending each prediction to
  the input and re-running the model.
- **Base model** — the model produced by pretraining alone; an internet-document
  simulator, not yet an assistant. See [Training](training-llms.md).
- **Benchmark** — a standard test suite with a public leaderboard used to score and
  compare models before release.
- **Context window** — the maximum number of tokens the model can hold "in mind" at
  once; the RAM of the [LLM OS](llm-os.md).

**D – I**

- **DAN ("Do Anything Now")** — a well-known jailbreak persona prompt. See
  [Jailbreaks](security-jailbreaks.md).
- **Emergent capability** — an ability that appears as models scale up rather than
  being explicitly trained; e.g. in-context learning. See
  [Emergent capabilities](emergent-capabilities.md).
- **Fine-tuning** — the second training stage: adapting a base model on a small,
  high-quality dataset to produce a helpful assistant. See [Training](training-llms.md).
- **Hallucination** — a fluent, confident statement that is simply wrong; a
  consequence of imitating the texture of training text. See
  [Emergent capabilities](emergent-capabilities.md#limitations-from-the-talk).
- **In-context learning (few-shot prompting)** — teaching the model a pattern by
  putting examples in the prompt, with no weight updates. See
  [Emergent capabilities](emergent-capabilities.md).

**J – N**

- **Jailbreak** — a user-crafted prompt that overrides the model's guidelines. See
  [Jailbreaks](security-jailbreaks.md).
- **Knowledge cutoff** — the date after which the model's training data ends; fresh
  information requires browsing tools.
- **LLM (large language model)** — a neural network trained on internet text to
  predict the next token. See [What is an LLM?](what-is-an-llm.md).
- **LLM OS** — Karpathy's mental model of the LLM ecosystem as a new operating
  system: model as kernel, context as RAM, tools as peripherals. See
  [The LLM OS](llm-os.md).
- **Next-token prediction** — the entire training objective: output a probability
  distribution over the vocabulary for the next token. See
  [What is an LLM?](what-is-an-llm.md).

**P – R**

- **Parameters** — the learned numbers inside the network; ~100 billion for a
  2023-era frontier model, stored in a file of roughly 100+ GB.
- **Pretraining** — the first training stage: next-token prediction over ~10 TB of
  internet text on GPU clusters for months. See [Training](training-llms.md).
- **Prompt injection** — hijacking the model via instructions hidden in data it reads
  (web pages, emails, PDFs). See [Prompt injection](security-prompt-injection.md).
- **RLHF (reinforcement learning from human feedback)** — improving a fine-tuned
  model using human preference comparisons between its answers.

**S – V**

- **SFT (supervised fine-tuning)** — fine-tuning on human-written ideal answers; the
  first half of the standard fine-tuning recipe (SFT + RLHF).
- **System prompt (developer message)** — the hidden instructions a product prepends
  to every conversation to steer behavior. See [System prompts](system-prompts.md).
- **Token** — a subword text unit, roughly 4 characters or 3/4 of a word; the model's
  basic currency for input and output.
- **Tokenizer** — the component that splits text into tokens from a fixed vocabulary
  (~50,000 entries).
- **Tool use** — letting the model call external capabilities (browser, calculator,
  DALL-E, Python) during generation. See [Tool use](tool-use.md).
- **Transformer** — the neural network architecture underlying current LLMs.
- **Vocabulary** — the fixed set of tokens the tokenizer can emit.

---
Part of the [LLM Wiki](../index.md).
