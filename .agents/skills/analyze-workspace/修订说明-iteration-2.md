# `analyze` 技能修订说明与 iteration-2 验证 — 2026-08-16

修订对象：`parking-agents/.claude/skills/analyze/SKILL.md`（v1 147 行 → v2 95 行，快照存于 `analyze-workspace/skill-snapshot/`）

## 一、修订内容（5 条违规 + 1 条观察的全部落地）

| # | 违规 | 修订动作 | v2 落点 |
|---|---|---|---|
| 1 | 「何时使用」写成正文节（writing-guide：该信息属 description） | `Use $analyze when` / `Do not use $analyze when` 两节删除；near-miss 边界并入 description（Not for simple one-file fact lookups / code edits） | description 尾句 |
| 2 | 正文引用不存在的外来技能（$plan/$ralplan/$team/OMX） | 全部替换为动作描述「用户要 edits/fix/plan 时，声明实现是另一条车道并停止」；Parallel exploration 改宿主中立措辞 | Contract 第 4 条 / Parallel exploration |
| 3 | 九连 Do not 禁令、无理由、与 Evidence rules 重复 | 合并为 4 条带「为什么」的 Contract；重复项删除；Evidence rules 保留证据阶梯 | Contract 节 |
| 4 | Execution policy 外来语系死指令 | 压缩为 2 行（outcome-first + continue 续查），删除 workflow branch/local overrides 术语 | Execution 节 |
| 5 | Output contract 无条件模板硬套所有问题 | 改条件分支：简单单答案问题直接作答+文件引用（保留证据措辞），竞态解释才用全量模板 | Output contract 节 |
| 6 | （观察）description 无中文相邻说法 | 补入「帮我分析/梳理/排查、怎么坏了/查查失败原因、影响面」 | description |
| 附 | iteration-1 发现：未提示同名多副本风险 | Evidence rules 加「引用前确认权威副本，同名多副本时显式指出哪份生效」 | Evidence rules 节尾 |

quick-validate：PASS（description 547/1024，无尖括号，键白名单合规）。

## 二、iteration-2 验证结果（2 用例 × v2/v1 快照，同回合并行）

### 输出评测

| 配置 | runs | 断言通过率 | 耗时 | tokens |
|---|---|---|---|---|
| with_skill（v2） | 2 | **100% ±0%** | 345.8s ±131.5 | **352.1k ±104.8** |
| old_skill（v1 快照） | 2 | 63% ±18% | 342.1s ±103.4 | 402.5k ±132.2 |
| delta（v2−v1） | — | **+37pp** | -3.8s | **-50.4k（-12.5%）** |

- **简单问题用例**：v1 复现 iteration-1 失败形态（给单一事实问题套 Ranked synthesis 表）；v2 以「直接回答+清单+行号」通过全部 4 断言（含新增的「降格式不降证据」断言）——修复实证。
- **只读契约用例（回归守卫）**：v1 本次新鲜 run 滑入 4 步修复计划+参数代码块（2/4）——说明 v1 的只读纪律本身不稳定（iteration-1 时守住属侥幸）；v2 的合并版 Contract 守住 4/4。
- **成本方向逆转**：v2 更准的同时更省（-12.5% tokens）——精简与质量同向。

### 触发评测（description 换 v2 后整轮重跑 60 探针）

| 轮次 | train 触发率/误触发 | test 触发率/误触发 |
|---|---|---|
| 第 1 轮（v1 description） | 1.00 / 0.00 | 1.00 / 0.00 |
| 第 2 轮（v2 description） | 1.00 / 0.00 | 1.00 / 0.00 |

两轮等价，无回退；聚合器平局规则保留第 1 轮为 best_description，v2 因标准符合性保留在 frontmatter。新 description 的中文触发词在探针理由中被显式引用（如「命中分析触发词」），说明中文覆盖在起作用。

### 遗留（不阻塞）

- v2 报告一处小幻觉（「pub/ 5 个」实为 4 个顶层条目），grader 已记 claims；直接作答形态下幻觉检测更依赖断言覆盖，下轮可加「运行时实证论断须可复现」类断言。
- 探针协议变形累计 14/120（均「技能：」中文冒号），语义全对；下轮探针 prompt 可加首行反例。
- iteration-1 的另两用例（冲突证据、配置解析链）本轮未重跑：其对应正文（Evidence rules/Working method）在 v2 中近乎原样保留，回归风险低；如需全量确认可补跑。

## 三、产物

| 产物 | 位置 |
|---|---|
| 修订版技能 | `.claude/skills/analyze/SKILL.md`（v2，95 行） |
| v1 快照 | `analyze-workspace/skill-snapshot/SKILL.md` |
| iteration-2 全套 | `analyze-workspace/iteration-2/`（eval_metadata ×2、4 run 的 outputs/timing/transcript/grading、benchmark.{json,md} 含 notes） |
| 触发评测两轮 | `analyze-workspace/probe-results.jsonl`（120 行）、`trigger-benchmark.json` |
| 评审页 | `analyze-workspace/iteration-2/review.html`（静态自包含，含与 iteration-1 对照） |
