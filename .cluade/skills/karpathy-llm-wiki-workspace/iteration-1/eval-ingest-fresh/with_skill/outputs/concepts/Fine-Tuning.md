---
title: "Fine-Tuning"
created: 2026-04-13
updated: 2026-04-13
type: concept
tags: [training, fine-tuning, alignment, core-concept]
sources: ["Intro to Large Language Models"]
---

# Fine-Tuning

The second stage of LLM training, applied after [[Pretraining]]. Fine-tuning
adapts a base model to behave as a helpful assistant by training on curated
human-written conversations.

## Supervised Fine-Tuning (SFT)

The most common form of fine-tuning:
1. Collect ~100,000 high-quality human-written Q&A examples
2. Format as instruction-response pairs (e.g., "Human: ... Assistant: ...")
3. Continue training the model with the same next-token prediction objective
4. The model learns the **format** of being a helpful assistant

Key insight from Karpathy: SFT changes the *format* and *style* of outputs, not
the underlying knowledge. The knowledge comes from [[Pretraining]]; fine-tuning
teaches the model when and how to apply it.

## Effect on the Model
- Base model: "document completer" — continues text in internet style
- SFT model: "assistant" — answers questions, follows instructions, is helpful

## Cost
Fine-tuning is dramatically cheaper than pretraining. A small SFT dataset
(100k examples) can be processed in hours on a fraction of the pretraining
compute.

## Variants
- **Full fine-tuning**: Update all model parameters
- **LoRA / QLoRA**: Update only small adapter layers (parameter-efficient)
- **Instruction tuning**: SFT specifically on instruction-following tasks
- **Domain adaptation**: Fine-tune on specialized corpora (medical, legal, code)

## Relationship to RLHF
SFT is Stage 1 of the alignment pipeline; [[RLHF]] is Stage 2. Together they
transform a raw pretrained model into a safe, helpful assistant.

## Related
- [[Pretraining]], [[RLHF]], [[GPT-4]], [[OpenAI]], [[Scaling Laws]]
