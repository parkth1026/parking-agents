# Context Snapshot: 2026-08-17-bpr-skill-improve

- 创建：2026-08-17
- 分片来源：无，宿主直接调查

## 任务陈述

"[$workflow-interview] 基于上面调研信息 我们开始 改进 G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\best-practice-research\SKILL.md 技能"

（"上面调研信息" = 本会话产出的两份报告：`docs/research/best-practice-research-竞品调研.md` 与 `docs/research/deep-research-领域调研.md`）

## 用户提出的方案

未提出具体方案，仅指定：以 workflow-interview 流程驱动改进，输入依据为两份调研报告。

## 意图假设

表层任务是修订技能文本；真实意图是把两轮调研发现的机制缺口（含 iteration-2 对抗 eval 暴露的唯一 FAIL）转化为技能修订，并按仓库已建立的 eval 方法论证明改进有效——不是重写技能，而是有证据驱动的定向补强。用户此前已裁定方向：adversarial iteration-2 是既定下一步（memory: best-practice-research port status）。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 技能正本 = `.claude/skills/best-practice-research/SKILL.md`，89 行单文件，无 references/scripts；`skills/dev\|pub` 是第三方参考技能不含本技能 | `ls` 两目录 | Fact |
| 路由引用 `explore/researcher/dependency-expert` 子代理与 `$ralplan/$ultragoal/$team` 是 OMX 残留：本仓库 `.claude/agents/` 为空，这些 subagent 不存在；eval transcript 显示模型把 researcher 步骤解释为自查动作照常执行 | `.claude/skills/best-practice-research/SKILL.md:27,34,51`；`.claude/agents/` 空；iteration-2 transcript.md 步骤 1-3 | Fact |
| OMX 审计把该技能列为 6 个"纯通用"可直接移植之一；但移植静态检查未达"中文+兼容"两个目标（正文全英文、OMX 绑定引用未清） | `docs/research/oh-my-codex-skills-调研.md:46,56`；memory | Fact |
| iteration-1（3 常规案例）：pass 100% vs 100%，时间 -154.8s（-32%），tokens -280k（-49%）——效率大赚、质量持平（简单案例无区分度） | `.claude/skills/best-practice-research-workspace/iteration-1/benchmark.md` | Fact |
| iteration-2（3 对抗案例，已跑）：pass **92% vs 83%（+8pp）**，时间 +32s（+16%），tokens +21k（+10%） | `iteration-2/benchmark.md` | Fact |
| iteration-2 唯一 FAIL：CRA 断言 3"把仍推荐 CRA 的旧教程识别为过时证据"——**with/without 双失败**，两组都纠正了用户结论但未回应"用户认知的来源"（系统性盲区，非 skill 差异） | `iteration-2/eval-CRA脚手架现状/with_skill/run-1/grading.json` 断言 3 + eval_feedback | Fact |
| 判分 feedback 给出三个具体口径：①包发布日期以 **npm registry time 字段**为准（moment 案例 GitHub Release published_at=2026-07-26 系重新发布，npm 实际 2023-12-27，without_skill 在此翻车）②引用**就近标注**而非集中文末（Tailwind 断言 4 区分度弱）③上游提案现状以 TC39 仓库为准而非可能陈旧的第三方官方页 | 三个 grading.json 的 eval_feedback | Fact |
| 仓库原生通用技能语言惯例 = 英文正文 + description 含中文触发词 + 输出跟随用户语言（analyze 同款）；编排类技能（workflow-interview 等）为纯中文 | `.claude/skills/analyze/SKILL.md:1-15` | Fact |
| 静态测试 `tests/skills/*` 只查 `skills/`（dev/pub），**不覆盖 `.claude/skills/` 技能体**；npm test 的 check:repo 路径指向 `skills/making-skills-cross-platform/`（实际在 `skills/dev/` 下，疑似路径漂移，非本任务核心） | `tests/skills/test-skill-discovery.mjs:23-25`；`package.json` scripts | Fact |
| 验证基建：iteration-1/2 的 eval 模式 = eval_metadata.json（prompt/adversarial_design/ground_truth_anchors/assertions）+ with/without_skill/run-1（transcript/outputs/grading/timing）+ benchmark 聚合；**无自动化 runner，runs 为 agent 驱动执行 + 判分人现场核对 registry**；此模式与 analyze-workspace 同款，是仓库已验证的验收途径 | workspace 目录结构；transcript.md 头部 | Fact |
| 竞品调研补强清单（6 条）：Gaps/Conflicts 必填段、停止规则数值化、置信度三档、逐字摘录规则、轻量多源收敛门、引用真实性 eval；独有优势 = 只读终态+交接语义+官方源分级+激活路由，建议保住 | `docs/research/best-practice-research-竞品调研.md` §6 | Fact |
| 领域调研行动清单（6 条）：引用真实性门、fetch-not-snippet、AS_OF 时效（研究源>3年/快讯>6个月降置信）、≥2 域名多样性、RACE/FACT 双维分离、verification records | `docs/research/deep-research-领域调研.md` §7 | Fact |
| eval-gates 框架 v2：场景三件套+双重验证（裁判/确定性两通道独立）+对抗场景+三态判定+基线棘轮；iteration-2 的 eval 已是此模式（assertions=裁判通道，registry 现场核对=确定性通道） | `docs/eval-gates-best-practices.md` §1.2-1.3, §9 | Fact |
| 竞品技能规模参照：research-ops 112 行、deep-research 155 行、openai-docs 38 行+9 references、ulw-research 283 行 | 竞品调研报告 §3-4 | Fact |

## 验证基建候选池

1. **既有 eval 模式（iteration-3）**——复用 workspace 三件套模式跑 with/without 对抗案例：无先建成本，但每 run 为真实搜索（约 3-4 分钟/组），判分含 registry 现场核对的 agent 工时；iteration-2 共 6 runs。
2. **静态检查**——`node tests/skills/test-skill-discovery.mjs` 等不覆盖 `.claude/skills`，对本任务无门禁力；可选用 `skills/dev/making-skills-cross-platform/scripts/check-skill-repo.mjs` 手动跑（代价：路径与覆盖范围需先确认，非为本技能设计）。
3. **用户真实测试**——用户拿日常真实问题试用修订版（代价：主观、不可回归）。
4. 新建自动化 runner——不在本任务范围（代价含先建，且与既定 gate-builder 方向重叠，不宜在技能修订任务里夹带）。

## 术语冲突

- "改进"：用户语境 = 基于调研的定向补强（非重写、非改定位）。本轮按此理解，已在意图假设写明。

## 四分类

- **Fact**：上表全部。
- **User decision**：①改动形态（单文件 vs references 分层 vs scripts）②验收方式（是否含 iteration-3 eval、是否加新案例）③正文语言（英文惯例 vs 中文化目标）④轻量多源收敛门是否引入（与"最小证据集"哲学有张力）。
- **Agent-owned**：各机制的落点措辞、输出契约字段命名、数值参数默认值（如检索上限次数）、行数控制（目标 ≤160 行）、OMX 残留的具体改写方式（方向为 harness 中立）。
- **Blocked**：无。

## 决定边界未知项

- 正文语言归 User decision 还是默认区（记忆冲突：移植目标含中文 vs 仓库通用技能英文惯例）→ 已列提问区。

## 未知项

- 无跨仓库边界未知项（改进对象、依据、验证途径都在本仓库内）。
