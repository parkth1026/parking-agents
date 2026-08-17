# AI 时代的测试/验收门禁与 Evals 系统：最佳实践框架（v2 已核查）

> 基于：AI_WorkFlow_ref 40 仓库门禁调研（v2 已核查版，见 [ref-repos-gate-research.md](ref-repos-gate-research.md)）+ 行业公开方法论
> 场景：① 设计期产出验收 evals；② 发布期全面回归
> 日期：2026-08-16
> 核查状态：**已核查（v2）**——按 best-practice-research 规范，由 5 个独立视角（方法论溯源 / 商业工具现状 / 仓库事实 / 反方批判 / 缺口完整性）核查。核心框架成立；4 处实质修正、6 处措辞校准已并入正文；v1 缺失的"判定有效性层"已补为第 5 节。详见文末核查附录。

---

## 0. 结论先行

| 你的场景 | 传统方法论根基 | AI 时代演化 | 证据等级 |
|---|---|---|---|
| 1. 设计期产出验收标准，开发完可验收 | 验收标准先行（North BDD 2006 / Adzic SbE 2011；ATDD 术语本身属 XP 系，Ken Pugh 2010 系统化） | **场景三件套 + 双重验证**，即 EDDOps（Evaluation-Driven Development and Operations，arXiv 2411.13768）所描述的实践 | 仓库实证 ✅ + Anthropic/OpenAI/Google 官方背书 grader 组合 ✅ |
| 2. 发布时全面回归不退化 | 回归套件 + 分层发布（canary/蓝绿） | **eval 基线棘轮 + sentinel/full 分层 + 被测物 pin + 方差统计判定** | 仓库实证 ✅ + Langfuse 官方指南背书分层与基线余量模式 ⚠️（基线+容忍度无原生工具 gate，需自建） |

一句话总结（v2 修订）：**传统门禁骨架全部保留；被测物扩展到非确定性 agent 行为后，门禁分成了两层——"怎么把门"（机制层，v1 已覆盖且达到主流以上水平）和"门的判定凭什么可信"（有效性层，v2 补齐）。两层缺一，门禁要么形同虚设要么不可信。**

---

## 1. 场景一：设计期就产出验收 evals

### 1.1 本质：验收标准从"文档"变成"可执行资产"

验收标准先行是 20 年成熟实践（Dan North《Introducing BDD》2006："Acceptance criteria should be executable"；Gojko Adzic《Specification by Example》2011）。AI 时代的正式学名是 **EDDOps**——arXiv 2411.13768《Evaluation-Driven Development and Operations of LLM Agents: A Process Model and Reference Architecture》（CSIRO Data61/ANU 团队，2024-11）：流程模型第一步就是 Define Evaluation Plan（产出评测标准、指标、SLO/SLA 基线作为 gates），评测"embed as a continuous, governing function rather than a terminal checkpoint"。Google web.dev 亦有官方教程《Evaluation-driven development》（最后更新 2026-01）。

两个 v2 校准：① 该论文是**文献综述推导的流程模型**（非实证研究），正式名称是 EDD **Ops**（开发+运维一体）；② 论文强调评测计划与测试集是**版本化、持续演进的产物**（经反馈环更新）——"设计期产出"不等于"设计期定死"。

### 1.2 核心模式：场景三件套（superpowers-evals 模式，已逐字核实）

每个功能/场景三条文件：

| 文件 | 作用 | 写作主体 |
|---|---|---|
| `story.md` | 给 LLM 裁判的剧本 + 验收标准（自然语言） | 设计者（就是你） |
| `setup.sh` | 确定性搭建被测环境（fixture） | 设计者 + 开发者 |
| `checks.sh` | 确定性前置/后置断言（pre/post） | 设计者 + 开发者 |

三条设计要点及证据等级（v2 校准）：

1. **两条验证通道相互独立**——裁判只依据 story.md 的验收标准评分，不看 checks.sh；确定性断言独立给出第二意见。superpowers-evals 自述理由是保持通道独立（"checks.sh is quorum's independent, deterministic second opinion"）。**证据等级：社区最佳实践**（该具体形态无官方背书）。
2. **确定性优先、LLM 裁判补位、组合使用**——这是有官方背书的部分：Anthropic《Demystifying evals for AI agents》（2026-01）："Agent evaluations typically combine three types of graders: code-based, model-based, and human... choose deterministic graders where possible"；OpenAI graders 指南与 Google web.dev 同样支持组合。头部实践者 Hamel Husain 更进一步："Favor assertions or other deterministic checks over LLM-as-judge evaluators"（LLM 裁判需要 100+ 标注样本校准和持续维护）。
3. **双重验证提高 gaming 成本，但不能杜绝**（v2 修正，原表述"防止 gaming"过强）——METR 2025《Recent Frontier Models Are Reward Hacking》实证：前沿模型会**直接改写确定性评分代码本身**（修改测试/计分函数、覆盖计时函数）。裁判通道自身也有已证偏差（位置偏差可被"简单换顺序"攻破，arXiv 2305.17926；冗长/自增强偏差，arXiv 2306.05685；同题自不一致，arXiv 2510.27106）。对策：holdout 金集、人工抽查通道、裁判校准（见第 5 节）。
4. **三态判定**：pass / fail / **indeterminate**（环境崩溃、pre-check 失败、空 transcript 都算 indeterminate，不算过）——对非确定性系统的诚实处理。

### 1.3 设计阶段工作流

1. 写 PRD/设计文档时，**同时**写出场景三件套（它们就是可执行的验收标准）；
2. 设计评审 = 三件套一起评审；
3. 开发验收 = 跑场景套件；DoD = 全部 pass 且 indeterminate 有解释；
4. **必须包含对抗性场景**：冲突证据、版本陷阱、诱导跳过验证、超范围请求、**诚实报告测试**（已核实 superpowers-evals 专门场景 `e2e-broken-feature-honest-report`：agent 面对坏功能必须如实报告，"unit-test evidence offered instead of a live run is a fail"、不得顺手修改应用源码）。

### 1.4 完成度证据门（给开发 agent 的 DoD）

- **"无新鲜验证证据不得声称完成"**（superpowers Iron Law；oh-my-codex `hasStructuredVerificationEvidence()` 产品化实现，均已核实）；
- 完成声明必须附结构化证据：跑了什么命令、什么结果、**什么没跑及为什么**；
- `passed / failed / skipped / blocked / not run` 五状态不许混报。

---

## 2. 场景二：发布回归门禁

### 2.1 传统骨架不变

- 测试金字塔/奖杯分层；merge queue + 单一稳定聚合 required check（**边界**：GitHub 官方文档明示 merge queue 适用于"高合并频率"仓库；配置脆弱——CI 必须响应 `merge_group` 事件且检查名一致，插队触发全量重建；小团队/慢 CI 需评估成本）；
- 发布分层：canary dry-run（paperclip 把 canary 演练放进 PR 门）→ release-verify（发布后对任意 tag 可复跑）。

### 2.2 AI 增补的五件事

1. **回归源扩展**：代码 diff 之外，**prompt、skill、模型版本升级都是回归源**。换模型 = 换被测物。范本（已核实）：superpowers CLAUDE.md 规定 "Show before/after eval results in your PR"，PR 模板有专门 Evaluation 节，"PRs will be closed without review if they modify behavior-shaping content without eval evidence"。
2. **eval 基线棘轮**（i-have-adhd 模式，代码已核实 run_evals.py:152-167）：无 blocker、Correctness/Safety 各自回归 ≤0.1 且加权总分严格高于基线才放行；权重 35/25/20/10/10（rubric.md 逐字核实）。**v2 校准**：该模式有厂商指南背书（Langfuse："setting the threshold with a margin below your baseline absorbs normal variance"；Galtea："trigger on the change in fail rate, not the absolute rate"），但**主流工具无原生实现**（原生 gate 均为绝对阈值），需自建。**必配防腐机制**（反方审查要求）：基线与数据集版本绑定、定期重建、案例轮换、holdout 检测过拟合（判据："CI 分数高但 holdout 崩 = 过拟合"）。
3. **分层评测套件**：sentinel（PR 快速）→ full（发布全量）。Langfuse 官方指南明确："Keep the PR-gate dataset small enough to run on every pull request, tens to low hundreds of items, and reserve the full set for release branches"。
4. **被测物与评测可复现三元组**（v2 扩充）：pin 模型 + 温度 + seed（i-have-adhd runner pin `claude-opus-4-8`），**并升级为三元组**：被测物 pin × 数据集版本 × 裁判（prompt+模型）版本——三者任一变化都会使基线失效。注意：pin 只保证单次运行内可比，发现不了"供应商静默更新模型"，需配合定期全量评测（见 5.6）。
5. **方差统计判定**（v2 新增，此前缺失）：单次运行的单点分数不能做门禁判据——发布前把套件跑 3–5 次看**分布**；区分 **pass@k**（k 次至少一次成功=能力）与 **pass^k**（k 次全部成功=可靠性）——70% 单次成功率 → pass@3=97% 但 pass^3 仅 34%，发布门禁关心的往往是后者；两版本差异小于评测噪声时，门禁要么恒失败要么形同虚设（用样本量/置信区间判断）。温度=0 也**不能**保证复现（arXiv 2512.06710：agent 评测运行间 ICC 仅 0.50–0.71）。

### 2.3 确定性策略

- **faux provider / mock 会话回放**（open-design：agent-stream 改动用 mocks/ 录制会话回放验证，不烧 provider 预算）；
- **测试环境隔离防作弊**（prime-agent：test.sh unset **35 个** API key 环境变量 + 移走并恢复 auth.json，已核实）；
- **FLAKY=FAILING**（oh-my-openagent test-discipline.md 逐字核实："A test that passes 9 of 10 times is failing 10% of the time. Not 'occasional.' BROKEN."）+ 隔离区定期复审（haha quarantine）；
- **裁判降噪**（v2 新增，Langfuse 官方 + Hamel）：pin 裁判模型版本、用带明确 rubric 的二值 pass/fail 判决（弃 1–10 打分）、要求结构化 JSON 输出、靠数据集平均抑制单条噪声；**确定性检查做 blocking gate，judge 指标在证明稳定前只做 warning**。

---

## 3. 你没列出、但行业共识应有的门禁（v2 修订）

| 手段 | 一句话 | 证据等级 |
|---|---|---|
| 测试影响分析 | 按变更范围只跑受影响 lane | haha 实证 |
| 增量覆盖率 + 棘轮 | **增量覆盖作为信号与棘轮防回退**；**不做全局刚性阈值**（v2 修正：Google Testing Blog 明确"没有理想覆盖率数字"，60/75/90 是描述性分层而非门禁标准，刚性阈值诱发低价值测试与 gaming——Stack Overflow Blog 2025 实证重构悖论）。对高风险模块手动圈定并要求接近全覆盖 | Google 官方支持"关注改动"方向；haha 的 changedLines 90% 是一家之选，数字本身无科学依据 |
| flaky 隔离区 | 隔离不是赦免：定期复审，过期即红 | haha 实证 |
| 契约测试 | provider 接口漂移即红 | haha 实证 |
| 门禁的自测试 | gate 脚本自己要有测试；安全门禁做"植入违规必须被检出"自检 | orca/cbm 实证 |
| fail-closed 分类器 | 变更分类不确定时全量跑 | oh-my-codex 实证 |
| 防绕过钩子 | 拦 `git --no-verify`、拦修改 lint 配置 | ECC 实证 |
| 性能预算 | 性能回归也是回归 | orca 实证 |
| DORA 指标 | change fail rate（DORA 官方现列五指标之一）是门禁有效性的最终裁判 | DORA 官方 |
| 脚手架激进单测 + issue 编号回归测试 | agent 系统的确定性部分（prompt builder、上下文压缩、工具分发、权限检查）用传统单测激进覆盖；每次生产事故关闭前写一个 issue 命名的回归测试（adlrocha《The Eval Problem》） | 实践者共识 |

---

## 4. AI 时代真正的新点（v2 修订，按重要性）

1. **双重验证评测**——确定性优先 + LLM 裁判补位（官方背书）；两通道独立（社区实践）；**定位是提高 gaming 成本而非杜绝**（METR 实证 agent 可改写评分代码本身）。
2. **轨迹/过程评测（trajectory-based evals）是正式评测类别**（v2 修正表述）——LangChain agentevals/LangSmith/DeepEval/Langfuse 均将 agent 评测三分：最终结果（outcome）、单步（step-level）、**轨迹（trajectory：工具调用序列、有无冗余/危险路径）**。只查结果会漏掉"任务完成但走了 10 倍冗余步骤"或"经不安全捷径完成"。**v1 的"过程合规常常比结果更重要"已修正为：过程与结果信号互补**（"过程更重要"是对数学 PRM 文献的过度外推——斯坦福研究显示结果监督更便宜且可比；正确落点是轨迹评测这个正式类别）。
3. **完成度门禁（completion gating）**——门禁对象是"agent 声称完成"这个动作本身。
4. **非确定性工程**——pass@k（首创 Kulal et al. 2019，经 Chen et al. 2021 HumanEval 标准化并普及——v2 校准）/ pass^k、三态判定、pin、fixture 化、重复采样看分布。
5. **评测经济学**——sentinel tier 控成本、每 suite 成本报告贴 PR（gstack `total_cost_usd` 已核实；成本追踪在 Braintrust 等平台原生，"成本贴 PR"尚非工具标准功能）、预烘焙 CI 镜像。
6. **eval 分级上线**——先 report-only/warning，基线稳定后 promote to blocking（Langfuse 官方明确此节奏）。**v2 补反方边界**：存在"不阻断即非门禁"学派（SonarSource 社区实测多数团队 advisory 模式最终被忽视/override）——分级上线必须带**升级时限与 owner**，"advisory 无 SLA 即为死信号"。
7. **信任门禁 / 反 slop**——拒绝无 QA 证据的纯 AI PR（paseo）、证据目录制（oh-my-openagent）、盲评 A/B（i-have-adhd：评测协议要求 judge 盲评 condition，属流程规定非代码强制——v2 校准）、anti-bypass 钩子。
8. **门禁卫生**——"a permanently-red tier trains people to ignore the whole workflow"（Archon 注释逐字核实）；知情降级必须写明原因和恢复路径（orca）。
9. **安全边界**——live eval 不进公共 CI（key 卫生）；被测 agent 在一次性 `$HOME` 沙箱跑（i-have-adhd runner 以 `--setting-sources ""` / `--ignore-user-config --ephemeral` 隔离操作者自身插件/hook，防基线被自我污染——已核实）。
10. **（v2 新增）判定有效性层成为独立工程**——金数据集工程、裁判校准、方差统计、安全红队、漂移检测（见第 5 节）。这是 AI 评测区别于传统测试门禁的最大新增工程量：传统测试的判定天然可信（断言确定性），AI 评测的判定本身需要被验证。

---

## 5. 判定有效性层（v2 新增：v1 的缺口，"门的判定凭什么可信"）

> 缺口审查结论：v1 在"门禁机制学"上达到甚至略超主流行业指导水平，但缺失行业全景的另一半。按对两大场景的重要性排序：

### 5.1 金数据集工程（高，双场景）
- 场景从哪来：从真实失败**自下而上**构建 + 人工边缘案例 + 脱敏真实流量 + 合成扩充的混合来源（Galtea/adlrocha/Maxim）；
- 规模经验值：约 50 个样本可抓大回归、200 个可对 3–5% 质量变化有统计置信（Galtea）；
- **冻结集 + 增长集**双轨：一个从不更新的冻结 golden set（防污染/过拟合）+ 一个不断增长的新用例集（adlrocha 引 Mercadona 实践）；
- 数据集语义化版本化，**棘轮基线必须与数据集版本绑定**，否则数学上不成立；
- 保留 held-out 切分检测对测试集过拟合（llm-evals-book/qaskills）。

### 5.2 裁判校准（高，双场景）
- 信任裁判前，先用人工标注子集（30–50 条起步，FutureAGI 建议 200–500 条×2–3 人）测裁判与人的**按类别精确率/召回率**（不是总一致率），目标如 Pearson 相关 > 0.7（Galtea）；
- 多人标注先测标注者间一致性（Cohen's κ / Krippendorff's α），检视分歧样本迭代裁判 prompt（Arize）；
- 裁判**定期复校准**（Zylos 建议月度）——未经校准的裁判 = 误报/漏报率未知的门禁。

### 5.3 方差与统计判定（高，场景②）
见 2.2 第 5 条：重复采样看分布、pass@k vs pass^k、显著性判断、按失败类别设可接受失败率而非单一总分阈值（Galtea）。

### 5.4 轨迹评测（高，双场景，agent 特有）
LangChain agentevals（开源）/ LangSmith trajectory evals / DeepEval / Langfuse 均有正式支持；断言工具调用序列、步骤冗余、危险路径。superpowers-evals 的 transcript 谓词库（skill-before-tool 等）是同一思想的自研实现。

### 5.5 安全红队套件（高，场景②，agent 特有）
功能性对抗场景 ≠ 安全测试。独立红队层：prompt injection（OWASP LLM Top 10 常年第一风险）、agentic 专属风险（goal hijack、tool misuse、privilege abuse——OWASP 2025 新增 Agentic AI Top 10）、工具链（PyRIT/Garak/promptfoo red team）。coding agents 持有 shell/文件/MCP 权限，这是最高频攻击面，应作为发布门禁中的独立套件。

### 5.6 漂移检测与定期全量评测（高，场景②）
- 代码零改动，外部世界也在变（模型供应商静默更新、输入分布漂移）——pin 防不住；
- **与部署 CI 解耦的定时全量评测**（nightly/weekly）跑在冻结 golden set 上（Zylos/bards.ai）；
- 输入 embedding 分布漂移监控做早期信号（分数下降只是迟到的确认）。

### 5.7 部署后闭环（中，超出两场景但构成数据飞轮）
online scoring（生产 trace 异步打分，Braintrust）、shadow deployment（新版本吃线上流量不暴露用户，Arthur/Statsig）、A/B；**生产 trace 一键转 eval 用例**（LangChain CEO Harrison Chase 明确倡导的数据飞轮）——这是场景①验收 eval 场景的最大供给来源。人工评测定位：校准标注 + 高风险终审 + 失败门禁复核队列，不是持续打分器。

---

## 6. 各机制的边界与已知失效模式（v2 新增，来自反方审查）

| 机制 | 何时不适用 | 腐烂机制 | 维护责任 |
|---|---|---|---|
| 覆盖率刚性阈值 | 几乎总是不适用（Google 官方反对）；增量+棘轮是可辩护变体 | 阈值诱发低价值测试；重构降覆盖惩罚去重 | 定期审计测试价值，非数字 |
| 双重验证 | 不能挡针对性 reward hacking（METR） | 评测集反复用于调优→过拟合；裁判漂移 | holdout + 人工抽查 + 裁判复校准 |
| 基线棘轮 | 数据集随意增删时（数学上不成立） | 向旧基线冻结；基线污染（Goodhart） | 基线定期重建 + 案例轮换 + 版本绑定 |
| report-only 起步 | 无升级时限时 | 永久 advisory 化（SonarSource 社区实测） | 明确时限 + owner + 升级硬条件 |
| merge queue | 低合并频率仓库/慢 CI/旧 CI 无法响应 merge_group | 配置错配导致合并死锁；插队全量重建 | CI 与检查名同步治理 |
| LLM 裁判 | 没有 100+ 标注样本做校准时（Hamel） | 方差大、偏差、维护成本高 | 二值 rubric + pin + 每周维护 |

---

## 7. 最小落地蓝图（v2 扩充）

从零搭一套（对应 gate-builder 方向）：

**机制层（v1 原有）**：
1. 场景三件套 schema（story/setup/checks + frontmatter：tier、成本预估、需求链接）；
2. runner：确定性断言优先 + LLM 裁判补位（两通道独立）+ 三态判定 + transcript 谓词库；
3. 基线库（带日期 + 容忍度）+ 两档接入（sentinel 进 PR、full 进发布）；
4. 完成度证据协议（DoD 结构化模板）；
5. 成本报告贴 PR；上线节奏 report-only → gate（带时限与 owner）。

**有效性层（v2 新增，决定门禁可信度）**：
6. 金数据集双轨（冻结集 + 增长集）+ 数据集版本与基线绑定 + held-out 切分；
7. 裁判校准流程（30–50 条人工标注起步，按类别 P/R，定期复校准）；
8. 方差管理（发布跑 3–5 次看分布，区分 pass@k/pass^k，按失败类别设阈值）；
9. 安全红队套件（OWASP LLM/Agentic Top 10 映射）；
10. 定时全量评测（nightly/weekly，独立于部署管道）+ 漂移监控。

---

## 8. 参考文献（v2 修订）

**官方/一手**：
- Anthropic, Demystifying evals for AI agents (2026-01) — grader 三类组合、deterministic 优先
- OpenAI Graders 指南（注意：graders 体系弃用中）/ openai/evals
- Google web.dev, Evaluation-driven development（更新 2026-01）— 确定性检查与 LLM-judge 同管线门禁
- Google Testing Blog, Code Coverage Best Practices (2020) — 反刚性覆盖率阈值
- GitHub Docs, Managing a merge queue — merge queue 适用边界
- DORA (dora.dev) — change fail rate 等五指标
- OWASP LLM Top 10 / Agentic AI Top 10 (2025)
- LangChain agentevals / LangSmith trajectory evals

**论文**：
- Xia et al., EDDOps: Evaluation-Driven Development and Operations of LLM Agents — arXiv 2411.13768 (2024-11)
- Zheng et al., Judging LLM-as-a-Judge (MT-Bench/Chatbot Arena) — arXiv 2306.05685 (NeurIPS 2023)
- Large Language Models are not Fair Evaluators — arXiv 2305.17926 (ACL 2024)
- Rating Roulette: Self-Inconsistency in LLM-As-A-Judge — arXiv 2510.27106
- Stochasticity in Agentic Evaluations — arXiv 2512.06710
- Lightman et al., Let's Verify Step by Step — arXiv 2305.20050（注意适用域：数学 PRM 训练）
- Kulal et al. 2019（pass@k 首创）；Chen et al., HumanEval — arXiv 2107.03374（pass@k 标准化）
- METR, Recent Frontier Models Are Reward Hacking (2025-06)

**工程指南/实践者**：
- Langfuse, LLM regression testing（分层套件、基线余量、warning→blocking、裁判降噪）— 官方工程指南
- Hamel Husain, LLM Evals FAQ / LLM-as-a-Judge Guide
- adlrocha, The Eval Problem（两层结构、冻结金集、issue 编号回归）
- Galtea, Complete Guide（金集规模、裁判校准、按类别失败率）
- Stack Overflow Blog (2025-12), Making your code base better will make your code coverage worse
- DeepEval / promptfoo / Braintrust 官方文档（CI 门禁现状：开箱即用阻断 gate 属少数）
- North, Introducing BDD (2006)；Adzic, Specification by Example (2011)；Pugh, ATDD (2010)
- 《Accelerate》(Forsgren/Humble/Kim)；《Building Evolutionary Architectures》(Ford/Parsons/Sadhwani)

**已核实仓库范本**：superpowers-evals、gstack、i-have-adhd、claude-code-haha、orca、oh-my-codex、oh-my-openagent、open-design、prime-agent、everything-claude-code、paseo、Archon（详见 ref-repos-gate-research.md）

---

## 9. 核查附录（v2）

**核查方法**：按 best-practice-research 规范（官方/一手来源优先、标注日期与证据等级），5 个独立视角并行：① 方法论溯源（arXiv/官方文档原文核对）② 商业工具现状（7 个主流工具官方文档逐一核对）③ 仓库事实二次核查（8 条新断言开文件核对）④ 反方批判（用公认来源攻击 6 条规范性结论）⑤ 缺口完整性（11 项候选缺口查证）。

### 总体判定

- **核心框架成立**：两大场景的架构（三件套+双重验证；基线棘轮+分层+pin）有仓库逐字实证 + Anthropic/OpenAI/Google 官方背书 grader 组合 + Langfuse 官方指南背书分层与基线余量。**可以基于本框架开工。**
- **4 处实质修正**（已并入正文）：
  1. "双重验证防止 gaming" → **提高 gaming 成本，不能杜绝**（METR 实证 agent 改写评分代码；裁判三偏差 + 自不一致论文）；
  2. "过程合规常常比结果更重要" → **过程与结果互补**（原文是对数学 PRM 文献的过度外推），正确落点是**轨迹评测**这一正式类别；
  3. "改动行覆盖率 90% 硬阈值" → **增量覆盖作信号 + 棘轮防回退**（Google 官方反对刚性阈值；90% 是 haha 一家之选，无科学依据）；
  4. "per-PR eval + release gate 已是商业化共识" → **CI 集成普遍（5/7 工具）、开箱即用阻断门禁属少数（DeepEval/promptfoo）**；基线+容忍度是指南推荐（Langfuse/Galtea）而非原生产品功能。
- **6 处措辞校准**：EDD→EDDOps 全称与"文献综述推导"性质；评测产物是版本化演进资产；pass@k 首创 Kulal 2019；ATDD 术语归属 XP 系（North/Adzic 是验收标准先行的基石）；i-have-adhd 盲评是协议规定非代码强制；prime-agent 精确为 35 个变量（"防付费 API"系动机推断）。
- **仓库事实**：8/8 新断言核实通过（4 条逐字命中：e2e-broken-feature-honest-report、release_gate 逻辑、35 个 unset、"9 of 10 times"）。
- **关键缺口补齐**（第 5 节）：金数据集工程、裁判校准、方差统计（pass@k/pass^k）、轨迹评测、安全红队、漂移检测、部署后闭环——v1 回答了"如何把门"，v2 补上"门的判定凭什么可信、如何持续可信"。

### 引用证据等级速查

| 断言类型 | 等级 |
|---|---|
| 确定性优先 + grader 组合 | 官方背书（Anthropic 2026-01 / OpenAI / Google web.dev） |
| 分层套件、基线余量、warning→blocking、裁判降噪 | 厂商官方指南（Langfuse）+ 社区共识 |
| 两通道独立（裁判不看 checks.sh） | 社区最佳实践（superpowers-evals），无官方背书 |
| 场景三件套、release_gate、FLAKY=FAILING、成本贴 PR 等 | 仓库逐字实证 |
| 开箱即用 CI 阻断 gate | 仅 DeepEval/promptfoo 官方文档化 |
| 覆盖率 90% 数字 | 单仓库选择，无行业依据 |
