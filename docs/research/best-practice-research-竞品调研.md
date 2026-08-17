# best-practice-research 竞品深度调研报告

> 调研日期：2026-08-16
> 基准：`G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\best-practice-research\SKILL.md`（89 行，移植自 oh-my-codex 88 行原版）
> 方法：本地 `G:\GIT\AI_WorkFlow_ref` 全量扫描（40+ 仓库，两个探索 agent 交叉）+ 网上官方文档/社区仓库抓取；Top 候选全部一手打开原文核验（行数、机制、预算数值均为直接读取结果，非转述）。

---

## 0. TL;DR

1. **官方阵营结论：两家都没有通用的 best-practice 调研技能。**
   - **Anthropic**：官方 [anthropics/skills](https://github.com/anthropics/skills) 共 17 个技能（本地两份镜像逐一核验：algorithmic-art / brand-guidelines / canvas-design / claude-api / doc-coauthoring / docx / frontend-design / internal-comms / mcp-builder / pdf / pptx / skill-creator / slack-gif-creator / theme-factory / web-artifacts-builder / webapp-testing / xlsx），**全是文档生成与 artifact 类，零调研技能**。Claude Code CLI 内置 bundled 技能（batch/debug/skillify/verify 等 14 个）同样无调研类；web 能力以 WebSearch/WebFetch **工具**形式存在而非技能。
   - **OpenAI Codex**：官方已[废弃 custom prompts、全面转向 skills](https://github.com/openai/codex/issues/4734)；[官方文档](https://learn.chatgpt.com/docs/build-skills)点名的内置系统技能只有 skill-creator / skill-installer / plan（+策展 linear）。但 codex 源码里藏了一个**官方内置的文档考据技能 `openai-docs`**（38 行 + 9 个 references，`codex-rs/skills/src/lib.rs` 用 include_dir 嵌入安装到 `.system` 目录）——这是官方在"调研纪律"上最接近的等价物，只是域限定在 OpenAI 自家文档。
2. **网上最强竞品是 199-biotechnologies/claude-deep-research-skill**（991★）：唯一把"引用验证"做成 Python 脚本（`verify_citations.py` 查 DOI/URL 有效性、检测幻觉引用）的技能，另有 9 项结构验证器 + 3 轮修复循环。
3. **本地参考仓库里最强对标是 oh-my-openagent 的 `ulw-research`**（283 行，一手核验）：反幻觉机制全场最完整——claim graph 五条门（≥2 独立域名、≥2 独立观察组、主动反证搜索、一手来源、时间证据）、跑代码实证、弃权语义。但它与你"轻量、不过度抓取"的哲学相反。
4. **整个调研技能赛道没有一家配了真正的 evals**（本地 40+ 仓库与网上头部项目均无）——这正好接上你已规划的 adversarial iteration-2，是差异化机会而不是短板。
5. 你的技能目前**独有的优势**：终态只读契约、官方源优先的分级规则、显式交接语义（$ralplan/executor）、激活/不激活路由。**明确弱于竞品的点**：引用无验证手段、无置信度分级、停止规则无数值预算、无 Gaps/Conflicts 必填段。

---

## 1. 基准画像：你的 best-practice-research（89 行）

| 设计要素 | 内容 |
|---|---|
| 定位 | 只读、终态的调研 wrapper；路由证据收集与综合，不自己当研究权威 |
| 路由 | `explore`（本地棕地事实）→ `researcher`（官方/上游文档）→ `dependency-expert`（选型决策） |
| 来源质量规则 | 官方文档/上游源/release notes 优先；material claim 必须带 URL；版本/日期上下文；三方摘要只能补充；标记过期/冲突/版本错配证据；不过度抓取 |
| 输出契约 | 7 段固定模板：Direct Recommendation / Evidence Used / Version-Date Context / Repo-Local Context / Boundaries / Handoff |
| 停止规则 | 建议可复用即停；升级为选型/架构/实现则上交；措辞打磨不算继续的理由；永不落盘改仓库 |
| 短板（本次调研确认） | 引用只"要求写 URL"但无验证手段；"标记冲突证据"无强制输出段；停止规则全部是定性描述（对比竞品的"3 次上限""5 波上限"）；无置信度分级；无 evals |

---

## 2. 官方阵营：Codex 与 Claude 的官方技能

### 2.1 OpenAI Codex —— 有官方机制 + 一个域限定的官方范本

| 事实 | 绝对值 |
|---|---|
| 官方技能机制 | skills 遵循 agentskills.io 开放标准；存放于 repo `.agents/skills` / 用户 `~/.agents/skills` / `/etc/codex/skills` / 系统内置；渐进披露，初始列表上限 = 上下文窗口 2% 或 8000 字符 |
| custom prompts 状态 | [官方废弃](https://github.com/openai/codex/issues/4734)，推荐迁移到 skills |
| 官方内置系统技能 | skill-creator、skill-installer、plan（官方文档点名）；策展技能 linear |
| **openai-docs**（源码内置） | `codex-rs/skills/src/assets/samples/openai-docs/SKILL.md`，**38 行 + 9 个 references**，一手核验。核心纪律：① docs-first 源顺序（官方域搜索 → **必须真正 fetch 页面**，"Use the actual fetched page, not a search snippet or an unopened link"）；② **引用域白名单**：只允许 cite `developers.openai.com` / `platform.openai.com` / `learn.chatgpt.com`；③ **"最多读 1 个主参考文件"**的反过度抓取硬规则；④ 官方源不能确证定价/限额时必须声明不确定性；⑤ fallback 必须是 disclosed fallback；⑥ 保留用户指定的模型版本不擅自替换 |
| 官方 docs 查询渠道 | [developers.openai.com/mcp](https://developers.openai.com/mcp) Docs MCP server（技能可在 openai.yaml 声明为 MCP 依赖） |

**评：** `openai-docs` 是"官方优先 + 反过度抓取 + 不确定性声明"三条规则的工业级实现样本，密度极高（38 行塞进了 6 条硬规则 + 路由树）。但它只覆盖 OpenAI 自家文档域，无多源交叉、无冲突标记、无通用输出契约。

### 2.2 Anthropic Claude —— 无官方调研技能，只有机制

| 事实 | 绝对值 |
|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) | 17 个技能（清单见 TL;DR，本地两份镜像逐一核验），全为创意/文档/artifact 类，**无任何 research 类** |
| Claude Code 内置技能 | bundled 清单 14 个（batch、claudeApi、claudeInChrome、debug、keybindings、loop、loremIpsum、remember、scheduleRemoteAgents、simplify、skillify、stuck、updateConfig、verify），无调研类（源码 `src/skills/bundled/` 核验） |
| Web 能力 | WebSearch/WebFetch/ToolSearch 是**工具**不是技能；官方插件市场 36 官方 + 15 外部插件中最接近的只有 context7（纯 MCP 桥接，无 SKILL.md、无方法论） |
| 产品侧 | claude.ai 网页版有 Research 产品功能，但未以 skill 形式开放 |

---

## 3. 网上竞品 Top 5 详细对比

### #1 [199-biotechnologies/claude-deep-research-skill](https://github.com/199-biotechnologies/claude-deep-research-skill)

**绝对值**：991★ / 109 forks / MIT / v1.0(2025-11)→v2.3.1(2026-03-19)，29 commits。

| 维度 | 机制 |
|---|---|
| 流水线 | 8 阶段：Scope→Plan→Retrieve→Triangulate→Outline Refinement→Synthesize→Critique→Refine→Package；Step 0 先 fetch 当前日期防训练数据年份错配 |
| 档位 | Quick 3 阶段 2-5 分钟 / Standard 6 阶段 / Deep 8 阶段 10-20 分钟 / UltraDeep 20-45 分钟 |
| 检索 | 5-10 并发搜索 + 2-3 聚焦 subagent，返回结构化 evidence 对象 |
| 引用验证 | **`verify_citations.py`：查 DOI/URL 有效性 + 检测幻觉引用**；`validate_report.py` 9 项结构检查；验证-修复循环上限 3 轮 |
| 来源评分 | `source_evaluator.py` 来源可信度打分（README 未披露算法细节） |
| 引用要求 | ≥10 个来源、每个主要 claim ≥3 源支撑；引用落盘 `sources.json` **防 context compaction 丢失** |
| 对抗 | Deep/UltraDeep 模式多 persona 红队（Skeptical Practitioner / Adversarial Reviewer / Implementation Engineer）；Critique 阶段可带 delta-query 回跳 Retrieve |
| 输出 | `~/Documents/[Topic]_Research_[Date]/`：MD（真相源）+ McKinsey 风格 HTML（自动开浏览器）+ PDF（WeasyPrint）；>18K 词递归续写 |

**优势**：唯一把引用验证和结构验证做成可执行脚本的竞品；档位-预算映射清晰；sources.json 抗压缩设计聪明。
**劣势**：无 evals（只有 test fixtures）；重、产出导向（写文件到用户目录），与你"只读终态+交接"哲学冲突；无"本地事实先行"路由；英文报告导向。

### #2 [Weizhena/Deep-Research-skills](https://github.com/Weizhena/Deep-Research-skills)

**绝对值**：~2.0k★ / 159 forks / MIT / 46 commits，跨 Claude Code + OpenCode + Codex 三端（en/zh 双语版技能）。

| 维度 | 机制 |
|---|---|
| 工作流 | 两阶段 human-in-the-loop：`/research <topic>` 生成结构化研究大纲（如 17 个待查 AI agent + 每项要收集的字段）→ `/research-add-items` / `/research-add-fields` 人工扩展 → `/research-deep` 每项并行 web-search agent 自动填表 → `/research-report` JSON→带目录 markdown 报告 |
| 理论依据 | 自述基于 RhinoInsight 论文（深研中的行为/上下文控制） |
| 结构 | `skills/`（research-en/zh、research-codex-en/zh）+ `agents/`（web-search-agent + modules）+ `agents-codex/`（web-researcher.toml）+ `tests/` |

**优势**：星标最高；人在环节控制粒度最细（先审大纲再放跑）；三端可移植性与你的 portability 目标一致；适合"枚举型对比调研"（N 个对象 × M 个字段）。
**劣势**：README 与技能文档**无引用格式、无验证/反幻觉机制**（相对 199-bio 是明显退步）；无 evals；填表范式对开放式问题（非枚举型）不适用。

### #3 everything-claude-code 的 research 技能栈（hezaki；本地有完整镜像，一手核验）

这是与你**架构最同构**的竞品——一个 wrapper + 分级技能栈：

| 技能 | 行数 | 核心机制 |
|---|---|---|
| `research-ops`（wrapper） | 112 | 5 步：归一化用户已给证据 → 问题四分类 → **最轻证据路径优先** → 带证据边界汇报 → 判断是否转监控。四分类强制标注：sourced fact / user-provided context / inference / recommendation；freshness 敏感答案必须带具体日期；"本地代码/文档能答的不要开重调研通道" |
| `deep-research` | 155 | 6 步多源综合；6 条反幻觉规则（每 claim 有来源、单源标 unverified、偏好近 12 个月、承认缺口、查不到就写 "insufficient data found"、事实与推断分开）；报告头 Confidence: High/Medium/Low；预算 15-30 唯一来源、深读 3-5 源 |
| `market-research` | 75 | 决策导向：**强制纳入反向证据与下行场景**；4 种模式含"技术与供应商选型"；交付前 Quality Gate 清单 |
| `documentation-lookup` | 90 + agent 68 | Context7 实时文档查询；**硬预算"每问题最多 3 次调用，超限即声明不确定性"**；按版本号/来源声誉选库；agent 版带 prompt-injection 抵抗条款 |
| `search-first` | 161 | 写码前先搜现成方案：并行搜 npm/PyPI/MCP/skills/GitHub → 六维评分 → Adopt/Extend/Compose/Build 决策矩阵 |
| `iterative-retrieval` | 211 | subagent 检索的 DISPATCH→EVALUATE→REFINE→LOOP；**"最多 3 轮然后强制推进"** + 相关度 0-1 评分 |

**优势**：分级路由哲学与你完全同源且更完整（轻→重升级路径）；数值化预算最多（3 次/3 轮/15-30 源）；四级证据标注比你的"官方/补充"二分更细。
**劣势**：无显式停止规则章节（research-ops 无 Stop Rules）；来源质量无"官方优先"排序（只有轻路径优先）；整个栈无 evals；深度依赖 Exa/Firecrawl 等 MCP，可移植性打折。

### #4 deer-flow 的 research 技能（bytedance 系；本地镜像，一手核验）

2.0 架构下计划-搜索-阅读-综合由三层承担：

| 组件 | 绝对值 | 核心机制 |
|---|---|---|
| `skills/public/github-deep-research` | 166 行 | 4 轮研究（GitHub API→Discovery 3-5 搜→Deep Investigation 5-10 搜+fetch→Deep Dive commits/issues/PRs）；**来源优先级 5 级**（官方 docs/repos > 技术博客 > 已核实新闻 > 社区讨论 > 社媒仅作 sentiment）；**置信度打分表**：High 90%+=官方/多源印证，Medium 70-89%=单一可靠源，Low 50-69%=社媒/未核实/过期；9 节报告模板；内联引用 `[citation:Title](URL)` 带正反例 |
| `skills/public/deep-research` | 198 行 | 4 阶段（广撒网识维度→逐维度深读→**六类信息矩阵**：事实/案例/专家观点/趋势/对比/批评→Synthesis Check 门禁清单任一 NO 则继续）；时间感知规则（按 current_date 选日期精度） |
| `backend/.../lead_agent/prompt.py` | 724 行 | **硬并发上限**（每响应最多 N 个 task，超限"系统静默丢弃，你会丢工作"）；citations 段防幻觉核心："NEVER write claims without citations when sources are available"，正文内联引用与文末 Sources 区用不同格式（附正反例） |

**优势**：置信度打分表是全场最量化的冲突/可信度处理；三角验证 2+ 独立源、不隐藏矛盾写成明文 Best Practices；产品级可运行系统而非纯提示词。
**劣势**：deep-research 技能本身无输出契约（服务于内容生成的前置研究）；无逐条版本上下文字段；无 evals。

### #5 oh-my-openagent `ulw-research`（本地镜像，一手核验，283 行）

最大饱和度调研编排，显式激活门槛（仅用户明说 research/deep research 才启动）：

- **EXPAND 循环**：每个 worker 回复必须带 `## EXPAND` 尾巴（LEAD/DEAD END），orchestrator 逐 lead 扩展；**收敛是唯一停止规则**：零未查 lead / 连续 3 波无新 lead / 5 波深度上限暂停问用户。
- **Phase 3 跑代码验证**：争议 claim 写最小自包含脚本，全量 stdout/stderr + 版本 pin，判定 CONFIRMED/REFUTED/PARTIAL。
- **Phase 3b claim graph 五条门**（借鉴 fivetaku/insane-research，一手核验原文）：高危非代码 claim 进 verified-claims 白名单必须同时满足 ≥2 独立源域名（同域两页算一）+ ≥2 独立观察组（或记录一手源例外）+ 一次主动反证搜索未找到更强反证 + 一手来源背书 + 时间证据显式（observed_at/valid_at）。失败进 Unresolved/Refuted 附录——**"abstention is a correct outcome"**。
- 编排私有日志 5 件套（intent-diff / claim-graph / observation-manifest / verification-economics / cause-disappearance）；scaling floor 表（单主题 web-only 6 worker → full due diligence 15 worker）。

**优势**：反幻觉机制全场最强且有明确收敛停止规则。
**劣势**：哲学与你相反——它显式推翻一切抓取预算（"under-exploration is the failure"）；重（5-8 人 team + 红队）；日常 pre-planning 查询用它属于杀鸡用牛刀。

### 落选但值得一提的网上项

- [NVIDIA AI-Q Research skill](https://developer.nvidia.com/blog/add-a-specialized-deep-research-skill-to-agent-harnesses/)：企业 AI-Q 知识框架里的深研技能，产带引用报告；未开源 SKILL.md 细节，无法核验。
- 生态目录：[composio-community/awesome-codex-skills](https://github.com/composio-community/awesome-codex-skills)、[VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)（1000+ 技能）、[travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills)、[claudeskills.info research 榜](https://claudeskills.info/best/research-skills/)（Tavily CLI 系）。均为索引不是竞品本体。

---

## 4. AI_WorkFlow_ref 本地仓库 Top 5

> 40+ 仓库全扫（含 superpowers、anthropics/skills 双镜像、Understand-Anything、gstack、opencode、pi、prime-agent、hermes-agent、open-design、Archon、AionUi、cherry-studio 等）；superpowers 确认 14 个技能全是开发流程类（TDD/debugging/brainstorm），**无调研技能**；anthropics/skills 双镜像无调研技能；Understand-Anything 是代码→知识图谱域，不对标。

### 本地 Top 5 排名

| # | 候选 | 位置与规模 | 一句话 |
|---|---|---|---|
| 1 | **oh-my-openagent `ulw-research`** | `packages/shared-skills/skills/ulw-research/SKILL.md`，283 行 | 反幻觉机制最完整（claim graph 门 + 实证 + 弃权），但重量级 |
| 2 | **deer-flow `github-deep-research` + `deep-research` + lead_agent** | `skills/public/` 166+198 行 + `prompt.py` 724 行 | 产品级引用强制 + 置信度打分表 + 三角验证 |
| 3 | **oh-my-claudecode `external-context` 三件套** | `skills/external-context` 84 行 + `agents/document-specialist.md` 78 行 + `agents/explore.md` 119 行 | 与你的技能架构最同构的 Claude Code 版（wrapper+explore+researcher） |
| 4 | **oh-my-pi `librarian`** | `packages/coding-agent/src/prompts/agents/librarian.md`，119 行（一手核验全文） | 单 agent 证据契约最硬（逐字摘录+行号+版本必填） |
| 5 | **codex `openai-docs`（官方）** | `codex-rs/skills/src/assets/samples/openai-docs/`，38 行 + 9 references | 官方"文档考据"纪律范本：域白名单 + fetch-not-snippet + 单参考预算 |

### 各自详细优劣

**#3 oh-my-claudecode 三件套**（与你的技能最近亲，可直接对照移植）：
- external-context：查询拆 2-5 个 facet，并行 spawn 最多 5 个 document-specialist，spawn prompt 内强制 "Cite all sources with URLs"，固定综合模板。
- document-specialist（researcher 角色完整实现）：来源阶梯 = 本地 repo docs → chub/Context7 curated 后端 → WebSearch/WebFetch 官方文档；>2 年或 deprecated 显式标记；版本兼容显式标注；冲突来源 flag；Failure_Modes 明确禁止 "no citations"、"blog-first"、"stale"、"**over-research（简单 API 查询跑 10 次搜索）**"；haiku/sonnet 两档 effort。
- explore（本地路由对应物）：首轮 ≥3 并行搜索；Grep vs Glob vs ast_grep 交叉验证；2 轮收益递减即停；>200/500 行文件 context budget。
- **强于你**：curated 文档后端、effort 分档、"over-research"的反面失败模式定义。**弱于你**：external-context 无停止规则、版本/日期不在 wrapper 契约里（靠 agent 约束）。

**#4 oh-my-pi librarian**（一手核验）：
- frontmatter 即 JSON output schema：`sources[]{repo, path, line_start, line_end, excerpt(逐字摘录)}` / `api[]{signature 逐字复制}` / `version(必填)` / `breaking_changes[]` / `caveats[]`。
- 信条三连："**Source code is truth. Documentation is aspiration. Training data is history.**"
- 硬规则：至少交叉引用两处（types+实现 或 源码+tests）；默认值要在代码里找到实际赋值处而非文档声称处；API 签名逐字复制禁止凭记忆重构；空结果必须试 2 种 fallback 才能下"不存在"结论。
- **强于你**：逐字摘录+行号+版本必填是全场最硬的单点反幻觉契约。**弱于你**：无多源 web 印证、无冲突检测、无输出边界/交接段。

**本地落选者中的可 stealing 机制**（提名）：

| 来源 | 机制 | 绝对值 |
|---|---|---|
| Archon `agents/web-researcher.md` | **Gaps or Conflicts 为必填输出段**（找不到的 + 来源矛盾的）；质量标准 6 项表；"单一来源不得当定论 without corroboration"；`curl llms.txt` 拿 LLM 优化文档技巧 | 117 行 |
| mattpocock-skills `engineering/research` | "只查一手来源，每个 claim 追溯到拥有它的源" + 后台 agent 异步执行 | 仅 12 行 + 8 行 yaml |
| llm-wiki-skill digest | 跨素材综合三模板；**冲突视角对比表**；≥3 来源才建议持久化；query 生成页降级为二级来源（防自我污染） | 1136 行中的 784-930 段 |
| claude-plugins-official `scan-researcher.md` | "**描述一条你没见过的命令输出就是捏造**"反捏造条款；finding 锚定行号+逐字 snippet；severity 与 confidence 强制分离 | 64 行 |
| hermes-agent `research/llm-wiki` | 矛盾显式化（frontmatter `contrested: true`）；**>90 天 staleness lint**；citation drift 防护（保留实际读到的版本号） | 507 行 |
| oh-my-claudecode `deep-dive` | 正反两向证据按强度排序；leader 与最强替代假设之间跑 **rebuttal round**；低置信 trace 只注入问题不注入结论 | 536 行 |
| oh-my-codex `autoresearch`（同仓库） | **工件门控停止**：完成只看 mission-validator JSON `{"status":"passed"}`，不看模型自称 done | 72 行 |

---

## 5. 全景能力矩阵（绝对值）

| 能力 | 你的技能 | codex openai-docs | omc 三件套 | librarian | Archon | deer-flow gh-dr | ulw-research | ECC research-ops | 199-bio | Weizhena |
|---|---|---|---|---|---|---|---|---|---|---|
| 本地事实先行路由 | ✓ explore-first | ✗ | ✓ explore | 本地 node_modules 优先 | ✗ | ✗ | ✓ explore worker | ✓ "本地能答不开重通道" | ✗ | ✗ |
| 官方源优先排序 | ✓ 显式 | ✓✓ 域白名单 | ✓ 阶梯 | 源码即官方 | site: 权威域 | ✓ 5 级 | ✓ 一手来源门 | ✗（仅轻路径） | ✗ | ✗ |
| 引用 URL 强制 | ✓ | ✓ 白名单域 | ✓ spawn 内强制 | ✓ 逐字摘录+行号 | ✓ 精确原文 | ✓✓ 内联格式正反例 | ✓ 每 claim | ✓ 四级标注 | ✓ ≥10 源/claim≥3 | ✗ |
| **引用验证手段** | ✗ | ✗ | ✗ | ✓ 双位置交叉 | ✗ | 三角验证 2+ 源 | ✓✓ 五条门+反证搜索 | ✗ | ✓✓ verify_citations.py | ✗ |
| 版本/日期上下文 | ✓ 契约字段 | ✓ 保留指定版本 | ✓ >2 年标记 | ✓ version 必填 | ✓ 记录发布日期 | ✓ 时间感知规则 | ✓ observed_at/valid_at | ✓ 敏感答案带日期 | ✓ Step0 取当前日期 | ✗ |
| 冲突/缺口标记 | 要求但无强制段 | 不确定性声明 | flag | caveats 字段 | ✓✅ 必填 Gaps/Conflicts 段 | ✓ 不隐藏矛盾+置信度分层 | ✓ Unresolved/Refuted 附录 | ✗ | 承认缺口（规则级） | ✗ |
| 置信度分级 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓✓ 90/70/50 三档打分表 | risk tier | ✗ | ✗（模式代替） | ✗ |
| 停止规则/预算 | 定性 | ✓ 1 个主参考 | 2 轮递减即停（explore） | 2 种 fallback | ✗ | Synthesis Check 门 | ✓ 3 波/5 波 | ✗ | ✓ 3 轮修复循环 | ✗ |
| 输出契约 | ✓ 7 段 | 路由树 | ✓ 模板 | ✓ JSON schema | ✓ 5 段 | ✓ 9 节 | ✓ SYNTHESIS.md | ✓ 4 段 | ✓ 报告模板 | ✓ 表格+报告 |
| 只读终态 | ✓✓ 显式 | ✓ | agent 禁 Write/Edit | ✓ critical | ✓ | 技能只读（框架写盘） | worker 只读 | ✗ | ✗ 写 ~/Documents | ✗ 写报告 |
| 交接语义 | ✓✓ $ralplan/executor | ✗ | ✗ | yield 结构化 | ✗ | ✗ | ✗ | 监控建议 | ✗ | ✗ |
| evals | ✗ | ✗（有源码快照测试） | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ 仅 fixtures | ✗ tests/ 存在 |
| 轻量性 | ✓✓ 89 行 | ✓✓ 38 行 | ✓ 281 行合计 | ✓✓ 119 行 | ✓✓ 117 行 | ✓ 364 行 | ✗ 283 行+swarm | ✓ 112 行 | ✗ 脚本+PDF 全家桶 | ✓ |

> 全场 10 个候选，**13 个维度里 0 家全绿**；带 evals 的一栏全部为空（唯一例外：codex 源码对 openai-docs 的安装有快照测试，但不评估调研质量）。

---

## 6. 结论与补强建议

### 你的差异化定位（值得保住的东西）

1. **终态只读 + 显式交接**是全场独一份——所有竞品要么落盘写报告，要么没有交接语义。这是"调研服务于规划工作流"（$ralplan）的正确定位，不要为了学竞品把它改成产报告技能。
2. **官方源优先的分级规则**只有 codex openai-docs（域白名单形式）比你更严格，其余竞品全部缺失。
3. 激活/不激活路由（Do Not Activate When 四条）在竞品中只有 ulw-research 的显式激活门槛可媲美。

### 明确的补强点（按性价比排序，全部有竞品原文可抄）

| 优先级 | 补强 | 抄谁 | 绝对值 |
|---|---|---|---|
| 1 | 输出契约加 **Gaps / Conflicts 必填段**（现在是"要求标记"但模板里没有落点） | Archon web-researcher | 模板加 1 段，零成本 |
| 2 | 停止规则数值化：researcher 每问题检索上限 + "超限即声明不确定性" | documentation-lookup / openai-docs | "3 次上限""最多 1 个主参考"两个现成措辞 |
| 3 | 证据段加**置信度三档**（High=官方/多源、Medium=单一可靠源、Low=未核实/过期） | deer-flow github-deep-research | 打分表 3 行 |
| 4 | researcher 契约加**逐字摘录要求**（关键 API 签名/默认值禁凭记忆重构） | oh-my-pi librarian | 2 条 critical 规则 |
| 5 | 高危 claim 的**多源收敛门**（≥2 独立域名 + 一次反证搜索才可写进 Direct Recommendation） | ulw-research Phase 3b | 裁剪成 3 条的轻量版 |
| 6 | 迭代 2 的 adversarial evals 里加入**引用真实性检查**（答案中的 URL 是否真的被 fetch 过） | 199-bio verify_citations.py 思路 | 接上已规划的 iteration-2 |

### 与已规划工作的衔接

本次调研确认：**调研技能赛道无一家有质量 evals**。你已规划的 adversarial iteration-2（冲突证据/版本陷阱用例，见 `docs/eval-gates-best-practices.md` 框架）若做成，best-practice-research 将是本地 40+ 仓库 + 网上头部竞品中**唯一带质量门禁的调研技能**——这比补任何单条机制都更差异化。

---

## 7. 来源清单

**一手核验（本地文件）**：
- `parking-agents/.claude/skills/best-practice-research/SKILL.md`（基准，89 行）
- `AI_WorkFlow_ref/everything-claude-code/skills/research-ops/SKILL.md`（112 行）
- `AI_WorkFlow_ref/codex/codex-rs/skills/src/assets/samples/openai-docs/SKILL.md`（38 行）
- `AI_WorkFlow_ref/oh-my-openagent/packages/shared-skills/skills/ulw-research/SKILL.md`（283 行）
- `AI_WorkFlow_ref/deer-flow/skills/public/github-deep-research/SKILL.md`（166 行）
- `AI_WorkFlow_ref/oh-my-pi/packages/coding-agent/src/prompts/agents/librarian.md`（119 行）
- `AI_WorkFlow_ref/Claude_Skills/skills/skills/`（anthropics/skills 镜像，17 技能清单逐一核验）

**网上来源**：
- [anthropics/skills](https://github.com/anthropics/skills) · [Agent Skills 官方文档](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Codex 官方 skills 文档](https://learn.chatgpt.com/docs/build-skills) · [codex#4734 custom prompts 废弃公告](https://github.com/openai/codex/issues/4734) · [developers.openai.com/mcp](https://developers.openai.com/mcp)
- [199-biotechnologies/claude-deep-research-skill](https://github.com/199-biotechnologies/claude-deep-research-skill)（991★）· [Weizhena/Deep-Research-skills](https://github.com/Weizhena/Deep-Research-skills)（~2.0k★）
- [NVIDIA：Add a Specialized Deep Research Skill to Agent Harnesses](https://developer.nvidia.com/blog/add-a-specialized-deep-research-skill-to-agent-harnesses/)
- 生态索引：[composio-community/awesome-codex-skills](https://github.com/composio-community/awesome-codex-skills) · [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) · [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills) · [claudeskills.info/best/research-skills](https://claudeskills.info/best/research-skills/)
