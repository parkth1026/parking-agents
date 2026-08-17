---
title: "Tokenization"
created: 2026-04-13
updated: 2026-04-13
type: concept
tags: [tokenization, training, architecture, core-concept]
sources: ["Intro to Large Language Models"]
---

# Tokenization

The process of converting raw text into integer tokens that a language model
can process. Tokenization determines the vocabulary size, context window
efficiency, and many quirks in model behavior.

## What Is a Token?
A token is a chunk of text — roughly 3-4 characters on average in English.
The model never sees characters directly; it sees sequences of token IDs.

Examples (GPT-2/GPT-4 tokenizer):
- "hello" → [31373]
- "pretraining" → [1762, 477, 1076] (may split)
- " the" → [262] (space included in token)

## Byte Pair Encoding (BPE)
Most modern LLMs use BPE tokenization:
1. Start with a character-level vocabulary
2. Count all adjacent byte pairs in training data
3. Merge the most frequent pair into a new token
4. Repeat until vocabulary size is reached (e.g., 50,257 for GPT-2; ~100k for GPT-4)

## Why It Matters for [[Pretraining]]
The choice of tokenizer affects:
- **Vocabulary size** (larger vocab = fewer tokens per text, but larger embedding table)
- **Context window efficiency** (BPE compresses text ~4:1 vs bytes)
- **Multilingual performance** (non-English text uses more tokens per word)
- **Code handling** (whitespace-aware tokenizers work better for code)

## Known Quirks
- Arithmetic is hard: "1 + 1" may tokenize in unpredictable ways
- Spelling tasks are difficult: models don't see individual letters
- Some tokens are "glitchy" due to rare/garbage training data

## Related
- [[Pretraining]], [[Scaling Laws]], [[Fine-Tuning]]
