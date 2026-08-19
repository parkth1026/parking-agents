# 标签分类

wiki 页面打标签的指引。所有标签必须先在此定义，再用于页面。
标签 token 本身是机器契约（写进页面 frontmatter），保持英文原样。

## 规则

1. 标签用 **小写 kebab-case**（如 `language-model`，不是 `Language Model`）
2. 每页 2-5 个标签
3. 至少含一个分类标签（来自下述顶层分组）
4. 新标签先加进本文件，再用到页面上
5. 优先复用既有标签——先查这份清单

## 标签分组

### 核心概念
- `architecture` — 神经网络架构与设计模式
- `training` — 训练方法、目标与流程
- `inference` — 推理优化、serving、部署
- `evaluation` — 基准、指标、测试方法
- `safety` — 对齐、安全、伦理、红队测试
- `alignment` — RLHF、DPO、constitutional AI、价值对齐

### 模型类别
- `model` — 具体模型（GPT-4、Llama 等）
- `language-model` — 以文本为主的语言模型
- `multimodal` — 处理多种模态的模型
- `open-source` — 公开可用的模型权重
- `closed-source` — 仅 API 或专有模型
- `small-model` — 参数量 10B 以下的模型
- `frontier-model` — 最先进能力前沿

### 技术
- `attention` — attention 机制及变体
- `fine-tuning` — 微调方法（LoRA、QLoRA、全量微调等）
- `rlhf` — 基于人类反馈的强化学习
- `prompting` — prompt 工程、chain-of-thought 等
- `retrieval` — RAG、检索增强方法
- `quantization` — 模型压缩与量化
- `distillation` — 知识蒸馏
- `tokenization` — tokenizer、BPE、sentencepiece 等
- `embeddings` — embedding 模型与方法
- `moe` — mixture of experts

### 主题
- `scaling-laws` — scaling laws 与涌现能力
- `emergent-abilities` — 规模化后涌现的能力
- `reasoning` — chain-of-thought、逻辑推理
- `code-generation` — 代码模型与编程
- `agents` — 自主 agent、工具使用
- `long-context` — 长上下文窗口、记忆
- `data` — 训练数据、数据集、数据治理
- `hardware` — GPU、TPU、算力基础设施

### 组织
- `openai` — OpenAI 相关
- `anthropic` — Anthropic 相关
- `google` — Google / DeepMind 相关
- `meta` — Meta AI 相关
- `microsoft` — Microsoft 相关
- `academic` — 高校研究

### 人物
- `person` — 研究者、工程师、教育者或公众人物

### 素材类型
- `paper` — 研究论文
- `blog` — 博客文章
- `talk` — 讲座、演讲、播客
- `tutorial` — 教学材料
- `comparison` — 对比分析

### 元标签
- `core-concept` — 人人该懂的基础概念
- `historical` — 有历史意义但可能过时
- `controversial` — 存在活跃分歧的话题
- `emerging` — 新兴且快速演进的领域
