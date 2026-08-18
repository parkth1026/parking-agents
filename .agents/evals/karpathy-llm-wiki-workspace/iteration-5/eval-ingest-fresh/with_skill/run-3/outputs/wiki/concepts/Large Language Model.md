---
title: "Large Language Model"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [language-model, core-concept, training]
sources: ["Intro to Large Language Models"]
---

# Large Language Model

A Large Language Model (LLM) is a neural network (almost always a Transformer)
trained on a large slice of internet text with a single objective: predict the
next token. Everything the model "knows" is compressed into its weights as a
byproduct of that objective — there is no internal database of facts.

## How It Works

- **Training objective**: given a chunk of text, predict the next token. The
  network is trained on random snippets drawn from the training corpus
  (web pages, books, code, forums).
- **Two numbers matter most**: parameter count (the size of the network, on the
  order of 100B+ for frontier models at the time of the [[Intro to Large Language Models]] talk)
  and dataset size (trillions of tokens).
- **Generation is sampling**: to produce text, you give the model a prompt and
  repeatedly sample the next token, append it, and repeat.
- **Hallucination is structural**: because the only objective is plausible
  continuation, an LLM will confidently make up facts it never saw. It is a
  simulator of internet text, not a lookup engine. Mitigations include
  [[Fine-tuning]] and letting the model delegate to [[Tool Use]].
- **No explicit fact store**: knowledge lives in parameters; asking a question
  does not trigger a retrieval step unless the system adds one.

## Variants

- Base model — the raw output of [[Pretraining]]; completes text rather than
  answering questions.
- Assistant/instruct model — the base model after [[Fine-tuning]] (and often
  RLHF-style preference tuning) on curated question-answer data.
- Multimodal models — extend the same next-token machinery to images, audio,
  and video tokens.

## History

Text prediction goes back to n-gram statistics; neural language models (RNN/
LSTM era) scaled it up; the Transformer (2017) made training parallel enough
to consume the internet; GPT-3 (2020) showed that sheer scale produces
surprisingly general behavior ([[Emergent Abilities]]).

## Related

- [[Pretraining]] — the expensive stage that turns random weights into an
  internet-text simulator
- [[Fine-tuning]] — the cheap stage that turns a base model into an assistant
- [[Emergent Abilities]] — what falls out as models and data grow
- [[Andrej Karpathy]] — whose talk is this wiki's founding source on the topic
