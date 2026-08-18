---
title: "Next Token Prediction"
created: 2026-08-18
updated: 2026-08-18
type: concept
tags: [training, core-concept]
sources: ["Intro to Large Language Models"]
---

# Next Token Prediction

The deceptively simple training objective behind every [[Large Language Model]]:
given a sequence of tokens, predict the probability distribution over the
next token. Text is chopped into token-sized pieces, the model guesses the
continuation, and errors correct the parameters via backpropagation.

## How It Works

- The network outputs a probability for every token in its vocabulary
  (e.g. 50,000 entries) at each step.
- During training the correct next token is known (it's the actual text), so
  the model can be graded on every position of every document.
- At inference, sample from the distribution, append the chosen token, and
  repeat — generation is just next-token prediction in a loop.
- Because internet text includes questions followed by answers, code followed
  by outputs, and stories followed by endings, learning to predict the next
  token forces the model to implicitly learn grammar, facts, and reasoning
  patterns — the seed of [[Emergent Abilities]].

## Why It Explains Hallucination

A base model asked a question has only one learned behavior: continue with
plausible internet-like text. If it doesn't know the answer, it still
produces something that *looks like* an answer — a confident-sounding
fabrication. Hallucination is not a bug in sampling; it's the base objective
doing exactly what it was trained to do. [[Fine-Tuning]] reduces (but does
not eliminate) this, because a fine-tuned model still cannot truly verify
what it doesn't know.

## History

Language modeling by next-word prediction dates back to statistical n-gram
models; scaling the same idea into neural networks with internet data and
massive compute is what produced modern LLMs (see [[Pretraining]]).

## Related

- [[Large Language Model]] — the artifact this objective trains
- [[Pretraining]] — where the objective is applied at internet scale
- [[Intro to Large Language Models]] — the source talk for this page
