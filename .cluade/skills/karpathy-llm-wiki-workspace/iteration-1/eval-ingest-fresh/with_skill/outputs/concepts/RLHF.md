---
title: "RLHF"
created: 2026-04-13
updated: 2026-04-13
type: concept
tags: [training, rlhf, alignment, fine-tuning, core-concept]
sources: ["Intro to Large Language Models"]
---

# RLHF

Reinforcement Learning from Human Feedback. A technique for aligning language
models with human preferences by training a reward model from human comparisons
and then optimizing the LLM against that reward signal.

## The Three-Stage Pipeline

### Stage 1: Supervised Fine-Tuning (SFT)
Train the model on human-written demonstrations. See [[Fine-Tuning]].

### Stage 2: Reward Model Training
1. Sample two different model responses for the same prompt
2. Ask human labelers: "Which response is better?"
3. Collect thousands of such comparisons
4. Train a separate **reward model** (RM) to predict human preferences
5. The RM outputs a scalar score for any given (prompt, response) pair

### Stage 3: RL Optimization (PPO)
1. Use the reward model as the "environment"
2. Optimize the LLM policy using **Proximal Policy Optimization (PPO)**
3. The LLM learns to generate responses that score highly on the reward model
4. A KL penalty keeps the fine-tuned model close to the SFT model (prevents "reward hacking")

## Origin
Introduced for LLMs in the **InstructGPT** paper (Ouyang et al., 2022, [[OpenAI]]).
The same pipeline with variations is used in GPT-4, Claude, Gemini, and Llama 2.

## Why It Works
Human preference comparisons are easier to collect than demonstrations.
It is easier to say "response A is better than B" than to write a perfect
response from scratch. This makes RLHF more scalable than pure SFT.

## Limitations
- Reward hacking: model learns to game the reward model
- Human labeler disagreement introduces noise
- Reward model may not generalize beyond training distribution
- Expensive: requires human labelers at scale

## Variants
- **RLAIF**: Replace human feedback with AI-generated feedback
- **DPO** (Direct Preference Optimization): Eliminates the separate RM step
- **Constitutional AI**: Uses AI-written critique + revision

## Related
- [[Fine-Tuning]], [[Pretraining]], [[Scaling Laws]], [[OpenAI]], [[GPT-4]]
