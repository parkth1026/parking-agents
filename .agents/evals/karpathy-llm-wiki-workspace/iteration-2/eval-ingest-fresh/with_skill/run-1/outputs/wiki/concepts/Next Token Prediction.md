---
title: "Next Token Prediction"
created: 2026-08-14
updated: 2026-08-14
type: concept
tags: [training, inference, core-concept]
sources: ["Karpathy Intro to LLMs Talk"]
---

# Next Token Prediction

The single objective that defines LLMs: given a sequence of tokens, predict a
probability distribution over the next token. At training time the model is
scored on how well it predicts the actual next token of real text; at
generation time a token is sampled from the distribution, appended, and the
process repeats (autoregression).

## How It Works

1. Text is encoded into token IDs ([[Tokenization]]).
2. The network outputs a distribution over the vocabulary (roughly 100k
   tokens in modern models).
3. During [[Pretraining]], the loss pushes probability onto the observed next
   token across enormous amounts of training text.
4. During generation, sampling continues token by token — the model writes by
   repeatedly predicting its own next token.

## Why It Is Powerful

- Simple enough to train at internet scale, yet sufficient to induce
  grammar, facts, style, and — at scale — [[Emergent Abilities]] such as
  translation, arithmetic, and multi-step question answering.
- One mechanism for everything: there is no separate module for facts, code,
  or jokes; it all flows through the same distribution over tokens.

## Why It Is Dangerous

- The objective rewards *plausibility*, not truth — the root cause of
  [[Hallucination]].
- Prompt text is the only interface, which is also why [[Jailbreaking]] and
  [[Prompt Injection]] work: instructions, data, and attacks all travel the
  same channel.

## Related

- [[Tokenization]]
- [[Pretraining]]
- [[Large Language Model]]
