---
title: "Karpathy Intro to LLMs Transcript"
created: 2026-04-13
updated: 2026-04-13
type: source
tags: [talk, tutorial]
sources: ["Intro to Large Language Models"]
---

# Karpathy Intro to LLMs — Raw Transcript Notes

> Ingested: 2026-04-13 | Original URL: https://www.youtube.com/watch?v=zjkBMFhNj_g
> Author: Andrej Karpathy | Date: 2023-11-22

This is the raw source file for the lecture. The compiled wiki summary is at
[[Intro to Large Language Models]].

## Metadata
- title: "Intro to Large Language Models"
- url: "https://www.youtube.com/watch?v=zjkBMFhNj_g"
- author: "Andrej Karpathy"
- date: "2023-11-22"
- ingested: "2026-04-13"

## Transcript Summary (Key Topics)

### 1. What is an LLM?
- Two files: parameters file (weights, e.g. ~140GB for Llama 70B) + run file (C code ~500 lines)
- A "zip file of the internet" analogy — lossy compression of web text
- Neural network doing next-token prediction
- Training is computationally expensive; inference is cheap

### 2. Pretraining
- Collect massive internet text dataset (e.g. ~10TB of text)
- Train a neural network to predict the next token
- ~6000 GPUs for ~12 days for a Llama-70B-class model (~$2M compute cost)
- The model learns facts, reasoning, and world knowledge implicitly
- Base model = "document completer," not yet an assistant

### 3. Fine-Tuning (Supervised Fine-Tuning / SFT)
- Swap internet documents for high-quality human-written Q&A conversations
- Typically ~100k manually labeled examples
- Changes the FORMAT of the model's outputs, not fundamentally new knowledge
- Produces an "assistant model" that follows instructions

### 4. RLHF (Reinforcement Learning from Human Feedback)
- Stage 2 of fine-tuning after SFT
- Human labelers compare two model responses and pick the better one
- Comparison data trains a reward model
- Reward model used with PPO (Proximal Policy Optimization) to optimize the LLM
- Produces more helpful, harmless, honest responses
- InstructGPT paper introduced this pipeline

### 5. Scaling Laws
- Neural scaling laws (Kaplan et al., Chinchilla paper)
- Performance improves predictably with: compute, data, parameters
- Chinchilla result: models were being trained with too few tokens
- Optimal ratio: ~20 tokens per parameter
- Emergent abilities appear at scale thresholds

### 6. The LLM OS Concept
- LLMs as the "kernel" of a new computing paradigm
- Context window as "RAM" (working memory)
- Tools: browser, calculator, code interpreter, memory
- Multi-modal inputs: text, images, audio, video
- Agent loops: planning, tool use, self-reflection
- LLMs can run programs, browse the web, use APIs

### 7. Security Considerations
- Prompt injection attacks: adversarial instructions embedded in web content
- Jailbreaks: user manipulations to bypass safety training
- Data poisoning: malicious content in training data
- Sleeper agents: backdoored models activated by triggers

### 8. Future Directions
- System 1 vs System 2 thinking — LLMs are fast "System 1," need deliberate "System 2"
- Self-play reinforcement learning (like AlphaGo for language)
- Partial information / multimodal future

## Related
- [[Intro to Large Language Models]], [[Andrej Karpathy]]
