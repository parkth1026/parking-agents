# Deep Research 全领域调研报告

> 调研日期：2026-08-16
> 方法：4 个并行调研 agent 分头覆盖 ①商业闭源产品 ②开源框架/引擎 ③学术方法论与评测基准 ④工具生态与社区实践；优先官方一手来源（官方博客/GitHub 实抓/arXiv），二手信息单独标注，查不到的如实标注"未查到"。
> 姊妹篇：`best-practice-research-竞品调研.md`（技能层竞品，2026-08-16）。本篇把视野扩展到整个 deep-research 领域。

---

## 0. TL;DR

1. **领域已分四层收敛**：商业产品（OpenAI/Gemini/Claude/Perplexity/Grok/Manus/MS）→ 开源框架（deer-flow 80k★ / storm 31k★ / gpt-researcher 29k★…）→ 学术（RL 路线把行为训练进权重）→ 工具层（搜索/抓取 API + MCP）。**风向标**：deer-flow v2 放弃"深研框架"定位、重写为 super-agent harness（skills 渐进加载 + 上下文压缩 + sandbox）——领域正在从"深研框架"收敛到"harness + skills"，与你 parking-agents 的路线同向。
2. **引用幻觉是全行业系统性问题，但有便宜解法**：工业级深研产品引用准确率仅 77–93%（DeepResearch Bench/FACT）；deep research agent 的 URL 幻觉率 10.7%（普通 RAG 4.8%，[arXiv:2604.03173](https://arxiv.org/html/2604.03173v1)）；但 **agentic self-correction 可把不可解析率压到 <1%**（GPT-5.1 16.0%→0.6%）——验证动作本身比模型选择更值钱。
3. **Claude 生态特有坑：WebFetch 有损压缩**（r/ClaudeAI 976 赞帖：小模型压缩网页导致 30 篇论文 17 处错误、2 篇结论报反；社区共识解法 = 禁 WebFetch 改 curl 原文）——直接影响你 researcher subagent 的实现选型。
4. **RL vs prompt 的差距是量级的**（同一底座：端到端 RL 最高 +28.9 分；HLE 8.6%→26.9%），但 RL 涌现出的四个行为——**规划、跨源交叉验证、反思重定向、找不到答案时诚实拒答**——正是 prompt/skill 层可以显式规则化的东西。
5. **评测缺口再次确认**：开源框架里只有 langchain open_deep_research 有规范 evals（DRB RACE 0.4943 + 成本/token 全透明）；技能圈几乎无人有 evals。**DRB 的 RACE/FACT 双维分离（报告质量 vs 引用可信度分开测）是最值得抄进你 eval-gates 框架的设计**。

---

## 1. 领域地图

```
┌─ 商业产品层 ──── OpenAI DR / Gemini DR(+NotebookLM) / Claude Research / Perplexity / Grok / Manus(→Meta) / MS Researcher / Kimi-Researcher
│                  特征：RL 训练 agent 化、API 化、多模型委员会、并行 subagent
├─ 开源框架层 ──── deer-flow / storm / gpt-researcher / dexter / owl / Tongyi DeepResearch / dzhng / open_deep_research / smolagents ODR
│                  特征：planner-executor 分层、递归 learnings、上下文压缩管线、test-time scaling
├─ 学术层 ──────── RL 路线（Search-R1/DeepResearcher/WebThinker/Kimi/Tongyi）+ 引用专项（CiteGuard/LongCite）+ 幻觉专项（DeepHalluBench）
│                  特征：行为内化进权重；引用质量可测量（Citation F1/CiteME）
└─ 工具生态层 ──── 搜索/抓取 API（Exa/Tavily/Firecrawl/Brave/Perplexity/Context7）+ 深研 MCP + 社区技能/prompt 模板
                   特征：成本工程、内容质量评分、LLM 友好分块
```

---

## 2. 商业产品线全景

### 2.1 横向对比

| 产品 | 首发 | 底层模型（官方口径） | 单任务时长 | 官方 benchmark | 限额/价格（官方） | API 可编程 |
|---|---|---|---|---|---|---|
| OpenAI Deep Research | 2025-02-02 | 定制 o3（browse+Python RL 后训练）；2026 起 GPT-5.2 系（二手） | 5–30 min | HLE 26.6%；GAIA 78.09%；BrowseComp 51.5% | Pro 250/月、Plus 25/月（2025-04 口径）；API `o3-deep-research` $10/$40 per 1M | 高（Responses API + MCP + apps） |
| Gemini Deep Research | 2024-12（1.5 Pro）→ Gemini 3；Max 2026-04-21（3.1 Pro） | Gemini 3/3.1 Pro | App 分钟级；API ~20 min、上限 60 min | **官方未为 DR 公布基准分**（Gemini 3 本体 HLE 37.5%） | App：Free 5/月、Pro 20/天；API 标准 $1–3、Max $3–7/任务 | 高（Interactions API + MCP；无 function calling） |
| Claude Research/Advanced | 2025-05 | 官方未披露（Opus 4.5 增强） | 5–15 min，最多 45 min | BrowseComp-Plus(fetch) **85.30%**（vs Gemini 3 56.7 / GPT-5.1 48.6） | 与对话共享限额；数字未披露 | **无 API**（产品功能；SDK 自建） |
| Perplexity Deep Research | 2025-02 | 自研微调（细节未披露） | **2–4 min**（最快） | HLE 21.1% | App 数字未披露；API 实测 ~$0.82/任务；Sonar 2026-09-27 弃用→Agent API | 中 |
| Grok DeepSearch / 4.1 Fast | 2025-02（随 Grok 3） | Grok 4.1 Fast（2M ctx） | 未披露（"lightning-fast"） | Reka 63.9 / FRAMES 87.6 / X Browse 56.3；幻觉率较前代"减半" | 限额未披露；API $0.2/$0.5 per 1M | 高（Agent Tools API + 服务端 MCP） |
| Manus（→Meta） | 2025-03；Wide Research 2025-07 | 官方未披露（社区分析 Claude+Qwen 微调，二手） | 未披露 | GAIA L1 86.5 / L2 70.1 / L3 57.7（自报，有争议） | 未披露；2025-12-29 被 Meta 收购（~$2–3B，媒体口径） | 未查到 |
| M365 Researcher / GitHub Copilot | 2025-03-25；2026-03-30 多模型版 | GPT-5.2 + Grok 4.1F + Claude 4.6 + Gemini 3.1F 委员会 | ≤10 min | 自建 DRACO 71.34%（+13.88pp vs Perplexity/Claude Opus 4.6，GPT-5.2 judge） | 需 M365 Copilot 授权；消费版旧 DR 2026-08-18 退役 | 中；Copilot CLI `/research` 搜代码+repos+web |
| Kimi-Researcher | 2025-06-20 | Kimi 内模 + 纯端到端 agentic RL | 未披露（均值 23 步推理/任务） | HLE 8.6%→**26.9%**；GAIA 69%；xbench-DS 69% | 候补制；数字未披露 | 未查到 |

### 2.2 各家机制上最值得借鉴的点

| 产品 | 借鉴点 | 绝对值 |
|---|---|---|
| OpenAI | 深研**模型化/API 化**；搜索范围可收敛到受信任站点 + MCP 连接器 | Sync$1 复现案例：16:29 单任务、16 次搜索、52 URL、36 文件 |
| Gemini | **计划外置 + 协作规划**（用户可编辑研究计划）；任务级成本分档量化预期 | 标准 80 次搜索 $1–3 vs Max 160 次 $3–7；NotebookLM 证明"开卷/闭卷"应分家 |
| Anthropic | 多 agent 并行 + citations 直链原文；85.30% 提升全来自上下文管理/记忆/子代理协调等**工程技巧而非换模型** | 白皮书：token 消耗解释力 3.28×；90.2% 的性能差距超 8K tokens |
| Perplexity | 极致速度 + 过程全透明可中断 + 按 token 类型拆分计价 | 2–4 min；$2/$8/$2/$3 per 1M（input/output/citation/reasoning） |
| xAI | 独占 X 实时语料；服务端工具按成功调用计费；FActScore 式幻觉自量化 | 工具 $5/1K 次成功调用 |
| Manus | **同构并行 subagent**（无固定角色，每个都是全功能实例）+ 每会话 VM 沙箱 | Wide Research 目标 per-user compute ×100 |
| Microsoft | **Critique & Council 多模型交叉质询**（异构模型互评 + LLM judge + 自建基准驱动迭代） | 4 家模型池；critic 环节 5–10 min |
| Kimi | 纯 RL 训出深研行为；奖励设计（γ-decay 鼓励短轨迹） | HLE 提升 3.1 倍，无蒸馏 |

### 2.3 商业产品的失败模式（官方承认 + 权威报道）

- OpenAI 官方 Limitations 段自认：换措辞后难辨真伪、偶发幻觉、"引用权威来源≠结论正确"（[官方公告](https://openai.com/index/introducing-deep-research/)）。
- 学术界抽检：arXiv 2602.05930 分析 100 条伪造引用中 **66% 完全捏造**；NeurIPS 2025 论文检出 100 条幻觉引用/51 篇（GZero 扫描，经 Fortune 报道）——问题不限于单一厂商。
- Grok：2025-02 system prompt 屏蔽风波、2025-07 sycophancy 事件（Guardian/AP，二手）——**提示词层的可操纵性**是深研可信度的暗雷。

---

## 3. 开源框架线全景

### 3.1 横向对比（star 为 2026-08-16 GitHub API 快照）

| 框架 | Stars / 活跃度 | 循环设计 | 验证与反幻觉 | evals |
|---|---|---|---|---|
| [bytedance/deer-flow](https://github.com/bytedance/deer-flow) | **80,045** / 日更 | v1：Coordinator→Planner→Researcher+Coder→Reporter；v2 重写为 super-agent harness（skills 渐进加载 + 手动上下文压缩 + sandbox） | 无引用校验；human-in-loop | 无 |
| [stanford-oval/storm](https://github.com/stanford-oval/storm) | 31,010 / **停更**（2025-09-30） | 两阶段写维基：多视角提问（Perspective-Guided QA）+ 模拟专家对话；Co-STORM 协作话语 + mind map | 检索 grounding 强制；无后验校验 | 论文级（FreshWiki） |
| [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | 29,000 / 2026-07-18 | planner/execution/publisher 三段；深研参数 breadth=4 × depth=2 × concurrency=2（实抓默认值） | source tracking；20+ 源聚合 | 无 |
| [virattt/dexter](https://github.com/virattt/dexter) | 27,519 / 2026-08-04 | 金融垂直：计划→执行→自检迭代；loop detection + step limits | Self-Validation | **有**（LangSmith + LLM-judge） |
| [camel-ai/owl](https://github.com/camel-ai/owl) | 20,079 / 2026-08-14 | 多 agent 协作 workforce | 细节未披露 | 有（GAIA 69.09） |
| [Alibaba-NLP/DeepResearch](https://github.com/Alibaba-NLP/DeepResearch)（Tongyi） | 19,831 / 2026-02-27 | 30.5B MoE 权重开源；ReAct 轻模式 + IterResearch Heavy（test-time scaling 多 agent）双范式 | **RL 涌现 cross-validation/诚实拒答（内化进权重）** | 有（HLE/BrowseComp 等 7 项） |
| [dzhng/deep-research](https://github.com/dzhng/deep-research) | 19,555 / 2026-04-11 | 极简递归 depth×breadth；Learnings+Directions 滚雪球；全仓 <500 LoC | 无 | 无 |
| [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research) | 12,617 / **本周仍活跃** | research brief→supervisor→5 并行 researcher；每 researcher ≤6 轮、≤10 次工具调用；四角色模型分工（summarize/research/compress/final） | 无引用校验；structured output | **有，最规范**（DRB RACE 0.4943、成本 $45.98/5800 万 tokens 全透明） |
| [huggingface/smolagents ODR](https://github.com/huggingface/smolagents/tree/main/examples/open_deep_research) | 28,814（主仓）/ 2026-07-21 | **<100 行**单 CodeAgent 复刻 OpenAI DR；文本+视觉双模式浏览 | 无 | 有（GAIA 55% pass@1） |
| [PeterGriffinJin/Search-R1](https://github.com/PeterGriffinJin/Search-R1) | 5,296 / 2025-11-13 | RL 训练框架（PPO/GRPO，检索 token masking） | reward=答案正确性 | 有（NQ/HotpotQA 等） |
| [pat-jj/harness-1](https://github.com/pat-jj/harness-1) | 981 / 2026-06-15 | policy × **有状态 harness**：candidate docs、curated evidence、**verification records**、budget-aware context | **证据验证记录做成一等公民状态**（全场唯一） | 有（BrowseComp+） |
| [GAIR-NLP/DeepResearcher](https://github.com/GAIR-NLP/DeepResearcher) | 794 / 2026-05-10 | 真实网页环境端到端 RL；7B checkpoint 开源 | RL 涌现 cross-validate/self-reflection/honesty | 有（8 基准） |
| [pminervini/deep-research-mcp](https://github.com/pminervini/deep-research-mcp) | 102 / 2026-08-05 | 不实现循环，聚合 5 家后端（OpenAI/Gemini/DR-Tulu/ODR/Codex OAuth） | 继承各后端 | 无 |

### 3.2 Top 3 值得借鉴的开源框架

1. **langchain-ai/open_deep_research——工程化黄金标准**：唯一把"可复现评测 + 成本透明"做成默认工作流（DRB RACE 0.4943、GPT-5 组合 $45.98/5,800 万 tokens，LangSmith 一键复跑）。三层上下文管理（sub-agent 隔离 + summarization + compression 模型）是"深研循环上下文爆炸"的最成熟解；`max_concurrent_research_units=5 / max_researcher_iterations=6 / max_react_tool_calls=10` 的预算参数化最清晰。**自研任何深研流程都应先抄它的 evaluation harness 与预算模型。**
2. **Tongyi DeepResearch——把循环内化进权重 + 双档 test-time scaling**：同一权重跑 ReAct 轻模式或 IterResearch Heavy 多 agent 模式（HLE 32.9→38.3），证明运行时编排可以退化为模型的能力选项；cross-validation、诚实拒答等行为是 RL 涌现而非提示词约束——回答了"验证机制该做在 harness 还是做进模型"的方向问题。
3. **bytedance/deer-flow v2——长程上下文工程最佳实践**：**Skills 渐进加载**（SKILL.md 按需载入而非全量塞 prompt）、Manual Context Compaction、Session Goals、sandbox 文件系统。与其余框架的"压缩摘要"式上下文管理形成代差；且它把 Claude Code 式 skills 生态引入研究型 agent，等于为你的路线投了票。
4. 特别提名 **pat-jj/harness-1**（981★）：唯一把"验证记录 + evidence links + budget-aware context"做成 harness 一等公民状态的运行时设计，与 GAIR DeepResearcher 的 RL 涌现行为互为印证——**"由 policy 决定验证哪些 claim、证据何时充分"** 是下一代设计。

---

## 4. 学术方法论与评测基准

### 4.1 综述给出的领域框架

- [Deep Research Agents: A Systematic Examination and Roadmap](https://arxiv.org/abs/2506.18096)（2025-06）：按能力模块组织——信息获取（API 检索 vs 浏览器探索）/ 工具使用 / 工作流架构（静态 vs 动态、单 vs 多 agent、记忆）/ 调优（SFT/RL）/ 非参数持续学习。结论：**HLE 与 BrowseComp 是最未解决的挑战**。
- [Deep Research: A Survey of Autonomous Research Agents](https://arxiv.org/abs/2508.12752)（2025-08）：四阶段流水线 planning → question development → web exploration → report generation。
- 关键观察：**"验证（verification）"在两篇主综述中都不是独立流水线阶段**——它以 RL 涌现行为、引用评测框架（FACT/CiteME）、幻觉专项基准的形式存在。把它显式做成流程阶段，正是当前的结构性空白（也是你 gate-builder 的理论立足点）。
- 引用专项综述：[Attribution, Citation, and Quotation](https://arxiv.org/abs/2508.15396)（134 篇论文）。

### 4.2 RL vs Prompt 工程的效果差（同一底座对照，绝对值）

| 研究 | 对照 | 结果 |
|---|---|---|
| [DeepResearcher](https://arxiv.org/abs/2504.03160)（EMNLP 2025） | 端到端 RL vs prompt 工程 | **最高 +28.9 分**；vs RAG-RL +7.2 分 |
| [Search-R1](https://arxiv.org/abs/2503.09516) | RL(PPO) vs RAG prompt | 平均 EM 0.431 vs 0.304（7B 相对 **+41%**，3B +20%） |
| Kimi-Researcher | 纯端到端 RL | HLE 8.6%→**26.9%**（3.1 倍） |
| [WebThinker](https://arxiv.org/abs/2504.21776)（NeurIPS 2025） | 迭代在线 DPO vs 不训练 | 4 基准均值 42.1→45.4；vs 离线 DPO +2.2 |
| R1-Searcher | 7B 开源 RL vs GPT-4o-mini prompt 基线 | HotpotQA EM 0.654 vs 0.468（**+48.22%**） |

**RL 涌现的四个可规则化行为**（DeepResearcher §6.2 定性证据 + Kimi 观察）：规划制定、跨源交叉验证、自我反思重定向、**找不到答案时诚实拒答**——prompt/skill 层做不到"训练"，但可以把这四个行为写成显式契约与门禁。

### 4.3 被实验证明能改善引用/幻觉的机制（绝对值）

| 机制 | 证据 | 数字 |
|---|---|---|
| 工业产品引用准确率现状 | [DeepResearch Bench/FACT](https://arxiv.org/abs/2506.11763)（ICLR 2026） | Perplexity DR 90.24% > Gemini-2.5-Pro DR 81.44% > OpenAI DR 77.96%；Claude-3.7+Search 93.68%——**全部 <94%** |
| 检索增强引用验证（CiteGuard） | [arXiv:2510.17853](https://arxiv.org/abs/2510.17853) | CiteME 65.4→**68.1%（+10pp）**，逼近人类 69.2–69.7% |
| agentic self-correction | [arXiv:2604.03173](https://arxiv.org/html/2604.03173v1) | 不可解析 URL 率：GPT-5.1 16.0%→**0.6%**、Gemini 6.1%→0.1%、Claude 4.9%→0.8% |
| 深研 agent 本底的 URL 幻觉 | 同上 | 引用量 41.2–113.1 URL/查询（普通 3.0–24.3），但幻觉率 10.7% vs 4.8%——**引用越多幻觉绝对数越多** |
| 链接点击导航（Deep Web Explorer） | WebThinker 消融 | 去掉后 4 基准均值 45.4→38.3（**-7.1**，最大消融项） |
| 检索器质量（隐藏变量） | [BrowseComp-Plus](https://arxiv.org/abs/2508.06600) | 同一 GPT-5 agent 换检索器：55.9%→**70.1%**——相当部分"幻觉"其实是检索失败 |
| 检索 grounding + 干净语料 | [DeepResearchGym](https://arxiv.org/abs/2505.19253) | GPT-Researcher 换其 API：引用 precision/recall 94.29/90.82（商业 API 下 85.36/90.82） |

### 4.4 评测基准地图（给你的 eval 设计用）

| 基准 | 出处 | 测什么 | 关键数字 / SOTA |
|---|---|---|---|
| GAIA | [arXiv:2311.12983](https://arxiv.org/abs/2311.12983) | 466 道通用助手任务；人类 92% vs GPT-4+插件 15% | OpenAI DR 78.66%（验证集，2025-02） |
| BrowseComp | [arXiv:2504.12516](https://arxiv.org/abs/2504.12516) | 1266 道需持久浏览的难题 | GPT-4o+浏览 1.9% → DR 训练后 51.5% |
| BrowseComp-Plus | [arXiv:2508.06600](https://arxiv.org/abs/2508.06600) | 固定人工核验语料 + 难负例，**解耦检索器与 agent** | GPT-5 55.9%→70.1%（换检索器） |
| **DeepResearch Bench**（ICLR 2026） | [arXiv:2506.11763](https://arxiv.org/abs/2506.11763) | 100 道 PhD 级任务；**RACE（报告质量）+ FACT（引用可信度）双维分离** | RACE 领先 48.88（Gemini-2.5-Pro DR）；RACE 与人类一致性 72.56% |
| Deep Research Bench（FutureSearch） | [arXiv:2506.06287](https://arxiv.org/abs/2506.06287) | 89 任务；**RetroSearch 冻结网页环境**保证可复现；轨迹级幻觉/工具误用分析 | 各模型分数未查到 |
| DeepResearchGym | [arXiv:2505.19253](https://arxiv.org/abs/2505.19253) | 免费可复现沙盒（ClueWeb22-B 8700 万页）+ LLM-judge 引用 precision/recall | 引用指标 LLM-人一致率 κ=0.86 |
| InfoDeepSeek | [arXiv:2505.15872](https://arxiv.org/abs/2505.15872) | 245 道**新出现的**问题（多跳 77%、长尾 77%、时效 66%） | 最佳 Gemini-2.5-Pro ACC **22.45%**（换 Google 34.29%）——**全场 <35%** |
| DeepHalluBench | [arXiv:2601.22984](https://arxiv.org/abs/2601.22984)（2026-01） | 100 道幻觉易发任务；**PING 四类幻觉分类**（Propagation/Intent/Noise/Grounding），轨迹逐段核查 | 6 个代表系统均有显著可靠性缺口 |
| DeepResearch Bench II | [arXiv:2601.08536](https://arxiv.org/abs/2601.08536) | 132 任务、9,430 条细粒度二值 rubric | **最强系统满足的 rubric 不足 50%** |
| xbench-DeepSearch | [arXiv:2506.13651](https://arxiv.org/abs/2506.13651) | 常青实时产业级评测 | Tongyi DR 75.0 |
| HLE（深研上限侧写） | [arXiv:2501.14249](https://arxiv.org/abs/2501.14249) | 学科极限题 | OpenAI DR 26.6% → Kimi 26.9% → Tongyi Heavy **38.3%**（2025-10） |

---

## 5. 工具生态与社区实践

### 5.1 搜索/抓取 API 对比（定价为官方页 2026-08 快照）

| API | 定位 | 定价起点 | agent 深研特性 | AIMultiple Agent Score（2025-12 数据） |
|---|---|---|---|---|
| [Brave Search](https://api-dashboard.search.brave.com/documentation/pricing) | **独立索引**传统搜索 | Free 5K/月；Base AI $5/千次；AI Grounding $4/千次（主打降幻觉） | 独立索引是唯一差异化卖点（[HN](https://news.ycombinator.com/item?id=46261768)） | **14.89**（第 1，延迟最低 669ms） |
| [Firecrawl](https://www.firecrawl.dev/pricing) | scrape/crawl 引擎（非搜索） | Free 1K credits/月；$16/月 5K | JS 页转干净 Markdown"flawless"（社区实测） | 14.58（第 2） |
| [Exa](https://exa.ai/pricing) | neural/semantic 搜索，"built for LLM agents" | Search $7/千次；**Deep Search $12/千次、Deep-Reasoning $15/千次（唯一把深研做成端点）** | Contents 端点直接回干净正文 | 14.39（第 3） |
| [Tavily](https://www.tavily.com/pricing) | search-first，返回预清洗分块 | **Free 1,000 credits/月**；PAYG $0.008/credit | 返回"低噪音 context blocks"最 agent 友好（[r/Rag 实测](https://www.reddit.com/r/Rag/comments/1v4q7wp/)） | 13.67（第 5） |
| [Perplexity Sonar](https://docs.perplexity.ai/docs/getting-started/pricing) | 唯一直接返回研究报告的 API | sonar-deep-research $2/$8 per 1M + 搜索费 | 引用准确率 90.24%（DRB FACT 第一） | 12.96（第 8） |
| [Context7](https://github.com/upstash/context7) | 最新版**代码文档**注入（60.8k★） | 免费 key；付费 $10/千次（超 5K/月/seat） | 解决训练数据过时与 API 幻觉；**2026-01 免费层从 ~200/天砍到 500/月（-92%）** | —（不同类） |

社区生产栈共识：**Tavily 快搜 + Exa 概念式找 URL + Firecrawl 转全文**（r/Rag 实测帖，注意该帖被质疑为推广帖，数据需打折）。

### 5.2 新发现的社区深研技能（补充技能层调研）

| 技能 | Stars | 独有机制 |
|---|---|---|
| [daymade/claude-code-skills 的 deep-research](https://github.com/daymade/claude-code-skills/blob/main/deep-research/SKILL.md) | 仓库 1.3k★ | P0–P7 八阶段；**来源可及性分类**（public/semi-public/exclusive-user-provided/private，防"circular verification"）；**硬性质量门槛**：Standard ≥12 源、≥5 唯一域名、官方源 ≥30%、单源份额 ≤25%；**AS_OF 时效规则**（研究源 >3 年、快讯 >6 个月自动降置信）；P6 强制反方评审 ≥3 问题（4 个专项代理）；**子代理写笔记文件、lead 只读蒸馏**（自称省 60–70% context） |
| [rohunvora/x-research-skill](https://github.com/rohunvora/x-research-skill) | 1,218★ | X API 垂直：成本透明（每搜显花费，~$1.50/次深研）+ TTL 文件缓存防重复计费 |
| [917Dhj/DeepPaperNote](https://github.com/917Dhj/DeepPaperNote) | 615★ | 单篇论文深读→Obsidian；**"fails closed"歧义处理**（宁可拒绝不猜）；**自带回归评测 + note-quality-rubric**（技能圈罕见的量化 rubric） |
| [lingzhi227/agent-research-skills](https://github.com/lingzhi227/agent-research-skills) | 275★ | 31 个学术技能成管线；**BibTeX 引用采集/验证/去重**（比 verify_citations.py更进一步：管格式与溯源） |
| [mixelpixx/Nimrod](https://github.com/mixelpixx/Nimrod) | 252★ | MCP 工具层做质量评分搜索；**search-coach hooks**（Claude Code hook 拦截坏查询，不在 prompt 层约束） |

### 5.3 社区痛点 Top 5 与缓解办法（按帖子上赞数与出现频次）

| # | 痛点 | 证据（帖子/研究） | 社区缓解 |
|---|---|---|---|
| 1 | **引用幻觉/编造来源** | r/singularity 210 赞帖（Perplexity 幻觉来源+未来日期；prompt 里写"double check"**无效**）；r/LocalLLaMA 帖：~20% 引用论文不存在 | URL 存在性检查进管线（HEAD+Wayback，[urlhealth](https://arxiv.org/html/2604.03173v1) 83 行 Python）；agentic self-correction（压到 <1%）；"引不出逐字原文就当编造" |
| 2 | **抓取/摘要层信息失真** | r/ClaudeAI **976 赞** PSA 帖（WebFetch 小模型有损压缩：30 篇论文 17 处错、2 篇结论报反）；simonw：PDF 扫描件 fallback 到训练数据幻觉 | 禁 WebFetch 改 curl/Trafilatura/Firecrawl 读原文；PreToolUse hook 强制"只摘录不推断，没有就返回 NOT PRESENT" |
| 3 | **来源不加权、SEO 污染** | Ben Evans HN 302 赞（模型按 SEO 选二手源）；[Help Net Security](https://www.helpnetsecurity.com/2026/06/23/reddit-ai-search-poisoning-research/)：**13 个词的 Reddit 评论就能影响 AI research agents**；超 40% AI 引用指向 Reddit | 白名单/来源分级；域名多样性硬门槛（≥5 域名、单源 ≤25%）；重要结论回一手源核对 |
| 4 | **来源过时/日期意识差** | r/ClaudeAI "thinks it is 2024"；WebFetch 缓存旧页不带日期 | 显式 AS_OF 日期；每条时效 claim 附来源日期；过期降级规则（>3 年/>6 个月） |
| 5 | **成本高、耗时长、产出浅** | ChatGPT DR 单次 8–10 分钟、Pro $200/月；o3 满血单查询可超 $1,000（Futurism）；r/LocalLLaMA 171 赞"underwhelmed"帖：不下载政府 PDF、不跑代码模拟 | 分层策略（日常 Perplexity 2 分钟，重活才上 DR）；详尽 prompt（1–2 段）显著提升产出；人工抽查不可省 |

### 5.4 被反复验证有效的 prompt/方法论结构

- [ai-boost/awesome-prompts](https://github.com/ai-boost/awesome-prompts)（8.7k★）"Deep Research Agent" 模板：六阶段 PLAN→SEARCH→FETCH→ANALYZE→SYNTHESIZE→**VERIFY**；硬数字 ≥10 权威来源/每子问题 ≥5 源/报告 1,500–2,500 词；**输出强制含 "Conflicting Evidence" 独立章节**。
- [fainir/most-capable-agent-system-prompt](https://github.com/fainir/most-capable-agent-system-prompt)（868★）：**research mode 与 action mode 显式分离**（研究态优化广度/引用/不确定性，行动态优化安全/审批/回滚）；Goal cards（title/owner/status/risk/cost/next step）。
- [Manus context engineering](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)（社区引用最广）：KV-cache prefilling 成本 $3→$0.30/MTok（10 倍）；prompt append-only；**文件系统即上下文**（todo.md 持久任务板）。与 Anthropic [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 同源。
- mini-spec 五要素（r/PromptEngineering 千小时帖）：Goal / Inputs / Constraints / **Format** / **Verify**——Verify 独立成环。

---

## 6. 跨层综合洞察

1. **"验证"是全领域的结构性空白**：商业产品不后验校验引用；开源框架 12 家里 10 家无验证机制；两篇主综述都没把 verification 列为流水线阶段；唯一把它做成一等公民的是 pat-jj/harness-1（981★，小众）。而实验证据（self-correction 压 <1%、CiteGuard +10pp）说明验证动作的边际收益极高。**这是 gate-builder/skill 层最大的机会窗口。**
2. **深研产品引用越多，幻觉绝对数越多**（41–113 URL/查询、幻觉率 10.7%）——"广度"本身不产生可信度，验证才产生。你在 best-practice-research 里坚持"最小证据集"（不过度抓取）的哲学有数据支撑。
3. **失败常在检索与抓取层而非模型层**：换检索器 55.9%→70.1%；WebFetch 有损压缩制造"假幻觉"。对 skill 设计的含义：**证据入口的质量规则（fetch 原文、不用 snippet、检索源分级）比综合提示词更重要**——这正是 codex openai-docs "fetch-not-snippet" 规则的价值所在。
4. **评测的正确拆法是 RACE/FACT 双维**（报告质量与引用可信度分开测）+ 轨迹级幻觉分析（DeepHalluBench 的 PING 分类）。加上 RetroSearch 式冻结环境保证可复现。这三件套直接映射到你的 eval-gates 框架：设计期验收 evals 用场景三件套，回归用基线棘轮——补一个"引用真实性 sentinel"即可。
5. **领域路线收敛验证了 parking-agents 方向**：deer-flow v2（80k★、最活跃）从深研框架转向"harness + skills 渐进加载 + 上下文工程"；Microsoft 用 Critique & Council（本质是 gate/评审）拿差异化；Manus 方法论的核心是文件即上下文。**"把研究纪律做成 skills + gates 而非做成框架"** 是 2026 年的主流流向。
6. **成本工程是被忽视的竞争力**：x-research-skill 的每搜显花费、Gemini 的任务级成本分档（$1–3 vs $3–7）、langchain 的 token 成本透明——你的 eval 已测出 -49% tokens，把成本作为一等输出维度（每研究任务的搜索次数/URL 数/token 预算）是顺手且少有人做的。

---

## 7. 对我们工作的具体启示（行动清单）

| # | 行动 | 依据 | 落点 |
|---|---|---|---|
| 1 | iteration-2 adversarial evals 增加**引用真实性门**：答案中每个 URL 必须来自实际 fetch 的来源清单；虚构即 fail | self-correction 压 <1%；社区痛点 #1；全场技能无此 eval | best-practice-research iteration-2 |
| 2 | researcher 契约加 **fetch-not-snippet**（禁用摘要作证据）+ 考虑用 curl/干净抓取替代 WebFetch 摘要 | codex openai-docs 同款规则；r/ClaudeAI 976 赞帖 | researcher subagent 定义 |
| 3 | 输出契约加 **AS_OF 时效规则**（研究源 >3 年、快讯 >6 个月自动降置信并打标） | daymade 技能实测规则；社区痛点 #4 | SKILL.md 输出契约 |
| 4 | 来源多样性硬门槛：**≥2 独立域名、单源份额 ≤25%**（轻量版收敛门，替代完整 claim-graph） | daymade ≥5 域名/≤25%；ulw-research ≥2 域名 | Source-Quality Rules |
| 5 | eval-gates 框架借鉴 **RACE/FACT 双维分离**：报告质量与引用可信度分开打分，各设棘轮 | DeepResearch Bench（ICLR 2026） | docs/eval-gates-best-practices.md |
| 6 | gate-builder 蓝图可吸收 **Pat-jj harness-1 的 verification records**：验证记录作为 gate 的工件而非口头声明 | 唯一把验证做成状态的运行时设计 | docs/research/gate-builder-skill-blueprint.md |

---

## 8. 未查到清单（如实声明）

- Gemini Deep Research 官方 benchmark 分数（官方只给"leap"定性）；Claude Research 底层模型/搜索次数/限额数字；Perplexity App 端限额；Grok DeepSearch 迭代轮数与限额；Manus 模型与 API 细节；ScienceAgentBench 的任何厂商官方成绩。
- GAIA 官方 HF 榜当日实时第一名（JS 渲染未抓到）；FutureSearch 版 DRB 各模型分数；LongCite 具体 Citation F1 数值；DeepHalluBench 各系统幻觉率。
- Tavily deep research 模式 credit 系数；Exa 免费层"2 万次/月"的官方确认（仅第三方）；"GOAL/CONSTRAINTS/PLAN"字面模板原始出处。

## 9. 主要来源

- 官方：[OpenAI DR](https://openai.com/index/introducing-deep-research/) · [OpenAI DR 帮助中心](https://help.openai.com/en/articles/10500283-deep-research-in-chatgpt) · [o3-deep-research API](https://developers.openai.com/api/docs/models/o3-deep-research) · [BrowseComp](https://openai.com/index/browsecomp/) · [Gemini DR 产品页](https://gemini.google/overview/deep-research/) · [Gemini DR API](https://ai.google.dev/gemini-api/docs/deep-research) · [Deep Research Max](https://blog.google/innovation-and-ai/models-and-research/gemini-models/next-generation-gemini-deep-research/) · [Claude integrations/Research](https://claude.com/blog/integrations) · [Claude Research 帮助中心](https://support.claude.com/en/articles/11088861-use-research-on-claude) · [Opus 4.5](https://www.anthropic.com/news/claude-opus-4-5) · [Anthropic 多agent研究系统白皮书](https://www.anthropic.com/engineering/multi-agent-research-system) · [Perplexity DR](https://www.perplexity.ai/hub/blog/introducing-perplexity-deep-research) · [Sonar DR API](https://docs.perplexity.ai/docs/sonar/models/sonar-deep-research) · [Grok 4.1 Fast](https://x.ai/news/grok-4-1-fast) · [Kimi-Researcher](https://moonshotai.github.io/Kimi-Researcher/) · [MS Researcher](https://techcommunity.microsoft.com/blog/microsoft365copilotblog/introducing-multi-model-intelligence-in-researcher/4506011) · [Copilot CLI /research](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/research) · [Manus Wide Research](https://manus.im/blog/introducing-wide-research) · [Manus context engineering](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)
- 学术：arXiv [2506.18096](https://arxiv.org/abs/2506.18096) · [2508.12752](https://arxiv.org/abs/2508.12752) · [2508.15396](https://arxiv.org/abs/2508.15396) · [2503.09516](https://arxiv.org/abs/2503.09516) · [2503.05592](https://arxiv.org/abs/2503.05592) · [2504.21776](https://arxiv.org/abs/2504.21776) · [2504.03160](https://arxiv.org/abs/2504.03160) · [2510.24701](https://arxiv.org/abs/2510.24701) · [2510.17853](https://arxiv.org/abs/2510.17853) · [2311.12983](https://arxiv.org/abs/2311.12983) · [2504.12516](https://arxiv.org/abs/2504.12516) · [2508.06600](https://arxiv.org/abs/2508.06600) · [2506.11763](https://arxiv.org/abs/2506.11763) · [2506.06287](https://arxiv.org/abs/2506.06287) · [2505.19253](https://arxiv.org/abs/2505.19253) · [2505.15872](https://arxiv.org/abs/2505.15872) · [2601.22984](https://arxiv.org/abs/2601.22984) · [2601.08536](https://arxiv.org/abs/2601.08536) · [2604.03173](https://arxiv.org/html/2604.03173v1) · [2409.02897](https://arxiv.org/abs/2409.02897)
- 社区：[r/singularity Perplexity 幻觉帖](https://www.reddit.com/r/singularity/comments/1iqjmng/) · [HN Ben Evans](https://news.ycombinator.com/item?id=43133207) · [r/LocalLLaMA underwhelmed](https://www.reddit.com/r/LocalLLaMA/comments/1jbrwqf/) · [r/ClaudeAI WebFetch PSA](https://www.reddit.com/r/ClaudeAI/comments/1vim8b7/) · [r/Rag 搜索 API 实测](https://www.reddit.com/r/Rag/comments/1v4q7wp/) · [Help Net Security 投毒研究](https://www.helpnetsecurity.com/2026/06/23/reddit-ai-search-poisoning-research/) · [AIMultiple agentic search 榜](https://aimultiple.com/agentic-search)
