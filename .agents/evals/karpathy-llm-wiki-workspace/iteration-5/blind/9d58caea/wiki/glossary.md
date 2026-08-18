# Glossary

> **Status:** initial ingest · [Home](home.md)

Short definitions of terms used across this wiki. Long-form explanation lives on the linked pages.

| Term | Definition | See |
|---|---|---|
| **Alignment** | Making an AI system do what its operators/users intend rather than something adjacent but harmful. Fine-tuning and RLHF are the current practical tools. | [Fine-tuning](fine-tuning.md) |
| **Autoregressive generation** | Producing text one token at a time, feeding each prediction back into the input to predict the next. | [What is an LLM?](what-is-an-llm.md) |
| **Base model** | The network that results from pretraining — an internet-document simulator, not yet an assistant. | [Pretraining](pretraining.md) |
| **Context window** | The token span the model can currently attend to; its working memory ("RAM" in the LLM OS analogy). | [LLM OS](llm-os.md) |
| **Custom instructions** | Persistent user preferences injected into the conversation by the product — implemented as system-prompt text. | [System prompts](system-prompts.md) |
| **Data exfiltration** | Attack outcome where private data leaves the system through a side channel, e.g. an image URL that carries conversation text. | [Prompt injection](prompt-injection.md) |
| **Emergent capability** | An ability (e.g., few-shot learning, arithmetic) that appears at scale without being an explicit training target. | [Scaling and emergence](scaling-and-emergence.md) |
| **Few-shot learning** | Learning a task from a handful of examples placed in the prompt — no weight updates. | [Scaling and emergence](scaling-and-emergence.md) |
| **Fine-tuning** | Stage 2 of training: cheap adaptation of a base model to high-quality assistant-style data. | [Fine-tuning](fine-tuning.md) |
| **Grounding** | Anchoring model outputs in retrieved documents or executed computation rather than parametric memory. | [Tool use](tool-use.md) |
| **Hallucination** | The model producing fluent but false content instead of expressing uncertainty — "jazz improvisation" under pressure to answer. | [Fine-tuning](fine-tuning.md) |
| **In-context learning** | Same as few-shot learning; the model "learns" from the prompt itself. Emerged prominently with GPT-3. | [Scaling and emergence](scaling-and-emergence.md) |
| **Jailbreak** | User input crafted to override the model's instructions, e.g. "ignore all previous instructions and do X." | [Jailbreaks](jailbreaks.md) |
| **LLM OS** | Mental model of the LLM as kernel process of an emerging operating system: context = RAM, tools = peripherals. | [LLM OS](llm-os.md) |
| **Lossy compression** | Framing of pretraining: internet text compressed into parameters "in spirit," not stored verbatim. | [Pretraining](pretraining.md) |
| **Multimodality** | Models consuming/producing more than text — images, audio, video ("eyes and ears"). | [Scaling and emergence](scaling-and-emergence.md) |
| **Parameters** | The learned numbers inside the network (billions to trillions); "a big pile of numbers" shipped as one file. | [What is an LLM?](what-is-an-llm.md) |
| **Plugin** | An external service exposed to the model as a callable tool (e.g., Wolfram as ChatGPT plugin). | [Tool use](tool-use.md) |
| **Prefilling** | Steering by writing the beginning of the assistant's reply, constraining how it can continue. | [System prompts](system-prompts.md) |
| **Pretraining** | Stage 1: next-token prediction over ~TB of internet text on a GPU cluster for weeks/months, ~millions of dollars. | [Pretraining](pretraining.md) |
| **Prompt injection** | Hostile instructions hidden in data the model reads (web pages, emails), hijacking it from the inside. | [Prompt injection](prompt-injection.md) |
| **Red-teaming** | Systematically attacking your own model to find jailbreaks/injections before deployment. | [Jailbreaks](jailbreaks.md) |
| **Reward model** | A second neural network trained on human preference comparisons, used as the training signal in RLHF. | [Fine-tuning](fine-tuning.md) |
| **RLHF** | Reinforcement learning from human feedback: humans compare answers → reward model → optimize the LLM against it. | [Fine-tuning](fine-tuning.md) |
| **Scaling laws** | The empirical regularity that more parameters + data + compute predictably improves performance. | [Scaling and emergence](scaling-and-emergence.md) |
| **Speculative execution** | Running several models/queries in parallel and using the first good answer ("multithreading" the LLM OS). | [LLM OS](llm-os.md) |
| **System prompt** | Developer-written instructions placed before user input; the main steering mechanism — a request, not a boundary. | [System prompts](system-prompts.md) |
| **Token** | The chunk of text (subword) the model actually reads and emits; the atomic unit of everything. | [What is an LLM?](what-is-an-llm.md) |
| **Tool use** | Letting the model call attachments — browser, calculator, code interpreter — for exact or fresh results. | [Tool use](tool-use.md) |
| **Transformer** | The neural network architecture behind LLMs (*Attention Is All You Need*, 2017). Important, but secondary to objective + scale. | [What is an LLM?](what-is-an-llm.md) |
