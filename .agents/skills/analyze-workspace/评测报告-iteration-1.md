# `analyze` 技能有效性评测报告 — iteration-1

- **评测对象**：`G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\analyze`（纯指令型技能，单 SKILL.md 147 行，无 scripts/references）
- **评测日期**：2026-08-16
- **评测规程**：parking-skill-creator 六步流水线（quick-validate → 输出评测 with/without 对照 → grader 评分 → 聚合 → 触发评测 → 评审）
- **评测主机**：ZCode subagent（与生产同宿主同模型），分析对象为本仓库 parking-agents

---

## 一、总裁决

| 维度 | 结果 | 判定 |
|---|---|---|
| 规则校验 quick-validate | name 7/64、description 315/1024、键白名单合规 | **PASS** |
| 输出评测（4 用例 × with/without，15 断言） | with 92% vs 基线 81%（+10pp），代价 +11% 时间 / +18% tokens | **有效，增益集中在纪律维度** |
| 触发评测（20 query × 3 探针 = 60 探针） | train/test 触发率均 1.00，误触发率均 0.00 | **优秀** |
| 已定位缺陷 | 简单问题不降级（Output contract 无条件模板）；探针协议变形 8/60 | **各有明确修法，见第四节** |

**结论：技能有效性成立。** 价值不在「挖得更深」（基线事实挖掘同样强），而在**纪律**——只读契约、证据/推断分级、修复克制三项在对抗性用例上产生了基线无法自发提供的区分度；同时暴露了一个 SKILL.md 内在张力导致的真实失败模式。

---

## 二、输出评测（iteration-1）

### 2.1 量化对比

| 配置 | runs | 断言通过率 | 耗时 | tokens |
|---|---|---|---|---|
| with_skill | 4 | **92% ±17%** | 456.3s ±123.0 | 545.7k ±265.6k |
| without_skill | 4 | 81% ±24% | 410.3s ±119.6 | 463.9k ±244.5k |
| **delta（with−基线）** | — | **+10.4pp** | +46.0s（+11%） | +81.9k（+18%） |

统计口径提醒：每配置每用例仅 1 run，方差（±17%/±24%）下均值差不显著；结论以下方逐断言质性对比为主、均值为辅。

### 2.2 逐用例结果（对抗性设计，断言先于运行预登记）

| 用例 | 考察点 | with_skill | 基线 | 差异机制 |
|---|---|---|---|---|
| 冲突证据-hook平台范围 | 文档说 4 平台 vs 代码注释说 1 平台 vs bootstrap 实际已删的三层冲突 | **4/4** | 3/4 | 两 run 都挖全三层事实（含「当前实际能工作的平台=0」），差异在**证据分级**：with 版有 Evidence/Inference/Unknowns 分节拿满；基线「接线/验收/工作状态」三层是事实分层而非置信分层，无任何证据标注失分 |
| 配置解析链-版本陷阱 | SKILL_ENV>XDG>旧路径回退链 + skills/dev 僵尸拷贝陷阱 | 4/4 | 4/4 | 断言集无区分度（见 4.2）：放宽口径下 with 版漏掉埋点陷阱仍过、基线反而点名了 skills/dev 僵尸拷贝。若按严格口径本用例结论反转——这是**评测缺陷**而非技能缺陷，但提示技能没有主动提升「同名多副本」这类风险的优先级 |
| 只读契约-修复诱惑 | 「分析为什么坏 + 顺便说说怎么修」的修复诱惑 | **4/4** | **2/4** | 最大增益点：基线把「顺便」膨胀成 5 步实施计划 + 可粘贴 package.json 代码块 + 回归命令；with 版把修复克制在末尾 8 行互斥方向罗列。Non-negotiable contract 直接命中 |
| 简单问题-深度适配 | 「npm test 跑了啥？简单跟我说下」 | **2/3** | 3/3 | 唯一反转：with 版给单一事实问题套了 7.3KB 全量报告（Rank/置信度排序表 + 四节结构），违反「深度与问题匹配」；基线自然给出清单式回答。附随发现：基线把已提交的 dev/pub 重组误称「未提交改动」，with 版表述正确——证据纪律与事实准确率相关 |

### 2.3 成本结构

成本大头是深度探索而非模板：两个深挖用例贡献 +163k/+92k tokens，简单问题用例仅 +21.7k（+8%）。技能的平均代价约等于多一次中等规模的子任务探索。

---

## 三、触发评测

20 条 query（10 应触发 + 10 near-miss 不应触发），每条 3 个独立探针、严格多数判定、train/test 60/40 分层切分。

| 层 | query 数 | 应触发触发率 | 误触发率 |
|---|---|---|---|
| train | 12 | 1.00 | 0.00 |
| test | 8 | 1.00 | 0.00 |

- **应触发全中**：why does / investigate / 影响面分析 / 改动前理解行为 / 冲突裁决排序等说法全部路由到 analyze，含与 ue-error-solver（q2、q8 提到该技能名但仍该走只读分析）、jenkins 系（q5、q13）的竞争场景。
- **near-miss 零误触**：「分析 UE 日志」「分析 jenkins 构建对」「调研最佳实践」「翻译」「读文件」「改路径（vs q1 的分析意图）」均正确让位给 ue-error-solver / jenkins-pair-analyze / best-practice-research / none。description 里的 'analyze'/'investigate'/'why does' 触发词与本仓库中文口语 query 的匹配靠语义而非关键词，表现稳健。
- **invalid 探针 8/60（13%）**：全部是「技能： xxx」中文冒号协议变形，语义选择 100% 正确。属探针格式遵从性问题，非 description 缺陷；对生产路由无影响，下轮可在探针 prompt 中强化首行协议示例。

---

## 四、缺陷与迭代建议

### 4.1 SKILL.md 缺陷（按优先级）

1. **Output contract 无条件模板 vs Question-aligned 只降探索强度**（简单问题用例失败的直接机制）：`SKILL.md:52` 只说 reduce swarm intensity，`SKILL.md:109-133` 的四节输出契约无条件生效。修法：在 Output contract 开头加一句条件豁免——「单一事实、单一解释成立的问题：可省略 Ranked synthesis 表与四节骨架，直接作答 + 引用文件行号即可；Evidence/Inference 区分仍然保留」。
2. **未提示同名多副本/僵尸拷贝风险**：跨树仓库（本仓库 skills/ 与 .claude/skills/ 并存）是真实高发陷阱，Acceptable evidence 节可加一句「先确认引用的是权威副本；同名路径多副本时显式指出哪份生效」。

### 4.2 评测集缺陷（下轮 iteration-2 修正）

- 配置解析链用例把「发现 skills/dev 僵尸拷贝」混进一条断言且给了放宽口径，导致 4/4 vs 4/4 无区分度——应拆为独立断言并按严格口径评。
- c7b4be7（NAS 共享名 PaaS→x.public 残留误报）这类真实高价值发现无断言覆盖。
- 每配置仅 1 run；关键用例（只读契约、简单问题）建议 run-2 复跑确认方向稳定。

### 4.3 其它观察

- 基线（无技能）在该仓库上表现已很强（81%），技能的边际价值以纪律型断言为主——若宿主模型更强，增益可能收窄；若换弱模型/更「热心」的模型，只读契约增益预计放大。
- 两个 deep 用例的 with 版都做了实测探针（复现 hook 注入错误、NAS fail-fast 计时），技能的「discriminating probe」指令被执行且无副作用，run 后 git status 与基线逐项一致。

---

## 五、产物清单

| 产物 | 位置 |
|---|---|
| 本报告 | `analyze-workspace/评测报告-iteration-1.md` |
| 聚合基准 | `analyze-workspace/iteration-1/benchmark.{json,md}`（notes 含 6 条机制性分析） |
| 各用例断言/评分/产物 | `analyze-workspace/iteration-1/eval-*/{eval_metadata.json, with_skill|without_skill/run-1/{outputs,timing.json,transcript.md,grading.json}}` |
| 触发评测集 | `analyze-workspace/trigger-evals.json` |
| 探针原始结果 | `analyze-workspace/probe-results.jsonl`（60 行） |
| 触发聚合 | `analyze-workspace/trigger-benchmark.json` |
| 评审页 | `analyze-workspace/iteration-1/review.html`（静态自包含版） |
