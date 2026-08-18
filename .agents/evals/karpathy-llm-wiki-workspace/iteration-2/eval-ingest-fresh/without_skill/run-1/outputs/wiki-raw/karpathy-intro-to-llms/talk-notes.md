# Talk notes — Andrej Karpathy, "Intro to Large Language Models"

> **Provenance note.** These notes were reconstructed for this wiki's first
> ingestion. The ingestion input was the user's topic list (quoted verbatim in
> [`ingestion-log.md`](ingestion-log.md)) plus the publicly documented content
> of this well-known talk. They are **not a transcript**; numbers are
> approximate, as stated in the talk. Verify details against the video before
> citing them elsewhere.

- Speaker: Andrej Karpathy (OpenAI founding member; at the time of the talk working at Tesla)
- Talk: "Intro to Large Language Models" (general-audience talk with slides), ~1 hour, November 2023
- Intended audience: broad, non-specialist — the talk is the canonical "one hour intro to LLMs"

## 1. What is an LLM?

- An LLM is "just two things": a **parameters file** (the neural network
  weights) and a **dataset** (a large slice of internet text).
- Concrete numbers used in the talk: Llama 2 base = 70B parameters, a file of
  roughly 40 GB; training data on the order of terabytes (e.g. a filtered
  Common Crawl dump).
- The entire training objective is **predict the next token** everywhere in
  the corpus. Gradient descent nudges billions of parameters to get slightly
  better at this one prediction, across the whole internet-scale dataset.
- Mental model: the parameters are a **lossy compression of the internet** —
  a "zip file" that, when unpacked by sampling, regurgitates internet-like text.
- Sampling a **base model** makes it "dream" internet documents: random web
  pages, Stack Overflow answers, wiki entries. A base model is a document
  simulator, not an assistant.

## 2. Training: pretraining vs fine-tuning

- **Pretraining**: the expensive stage — months of training on large GPU
  clusters, costs on the order of millions of dollars. Only a handful of
  organizations worldwide can do it. Produces a **base model**.
- **Fine-tuning**: swap the giant corpus for a small, high-quality dataset
  (order of tens of thousands of examples) of ideal assistant responses
  written by paid labelers following detailed guidelines. Continue training
  on this dataset — cheap and fast. Produces an **assistant model**.
- Knowledge comes from pretraining; fine-tuning mostly teaches the *format
  and behavior* of an assistant.
- Optional third stage (**RLHF** — reinforcement learning from human
  feedback): collect human *comparisons* between candidate answers, train a
  reward model on those comparisons, then optimize the LLM against the reward
  model with reinforcement learning.

## 3. Scaling and emergent capability

- Benchmark performance improves with scale; example shown in the talk: the
  Llama 2 model card plots (7B / 13B / 34B / 70B) rising across benchmarks.
- Many capabilities improve gradually and somewhat predictably with size,
  but some appear **unpredictably** once scale crosses a threshold —
  motivating both the industry's scaling race and the difficulty of
  forecasting future capabilities (and risks).

## 4. Using LLMs

- **Tokens**: models read and emit text in tokens.
- **Context window**: a limited working memory — on the order of ~8,000
  tokens around the time of the talk. Anything outside the window is
  invisible to the model.
- **Hallucinations**: fine-tuned assistants are trained to always answer;
  when knowledge is missing they generate plausible text instead of saying
  "I don't know." Verify important outputs.
- **Tool use**: browsing (fresh information), calculator (exact math), code
  interpreter / Python (precise computation), image generation — plugins
  extend what the raw model can do.
- **System prompts**: custom instructions prepended to every conversation
  that define persona and rules; end users of a product usually never see
  them.

## 5. Security

- **Adversarial inputs / jailbreaks**: inputs crafted to make the model
  ignore its guidelines.
- **Prompt injection**: malicious instructions hidden in content the model
  reads while browsing (e.g. white text on a white background) that hijack
  the assistant. The model cannot reliably distinguish data from
  instructions.
- **Data poisoning**: attacks inserted into training data can persist in the
  weights and be triggered by specific phrases later. Data provenance is
  hard to audit at internet scale.
- Overall stance: security is an ongoing cat-and-mouse game, not a solved
  problem.

## 6. The future: LLM OS

- Karpathy's metaphor: the LLM is the **kernel / CPU of an emerging operating
  system**:
  - context window = RAM (limited working memory)
  - tools = eyes and hands (browser, Python / terminal, calculator, image generation)
  - multimodal I/O = peripherals (images and audio in; images and audio out)
  - "programs" = prompts — **Software 2.0**: writing software in natural language
- Outlook: everyone gets a personalized assistant; the platform will grow
  apps, security problems, and administration the way an OS does. Karpathy
  also frames LLMs as artifacts like "simulated humans," so studying them
  (their psychology, their failures) becomes a kind of new humanities
  discipline.

## Topic list from the user (the ingestion trigger)

1. What LLMs are (next token prediction on internet text)
2. How training works (pretraining vs fine-tuning)
3. Emergent capabilities at scale
4. Tool use and system prompts
5. Security risks such as adversarial prompts
6. The future of LLM OS
