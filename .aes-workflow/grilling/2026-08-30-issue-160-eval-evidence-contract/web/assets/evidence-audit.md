# 仓库评测证据审计：Creator 是否已经能持续产出好用技能

> 结论基于 2026-08-30 当前 checkout 的持久记录与一次复跑；它回答 steelman 的 crux，不把高分、机械绿测或单次样本自动解释为“好用”。

## 当前可直接确认的证据

| 对象 | 仓库记录 | 能确认什么 | 不能确认什么 / 暴露的缺口 | 与 writing-for-agents 的关系 |
| --- | --- | --- | --- | --- |
| `parking-skill-creator` 自身 | `run-tests.mjs` 当前复跑 `181 passed, 0 failed`，quick-validate PASS；iteration-3 输出评测 `with_skill=100%`、`without_skill=100%`，但 with 为 263.2s/800.6k tokens，without 为 166.8s/242.2k | Creator 的脚手架、校验、聚合、历史、viewer 等机械能力有强回归保护；触发题库也有区分度 | 最近输出题只有 3 条断言且两臂全平，不能证明 Creator 对“产出好用技能”有增益；高成本也未进入质量裁决 | 需要把写作设计从“指南存在”升级为可失败的行为假设；但静态 checklist 仍不能替代行为对照 |
| `ue-log-analysis` iteration-2→3 | iteration-2 三臂都漏掉脚本已算出的 5.2s/3.2s 空窗；记录明确称为“脚本产出→报告的传导断点”。iteration-3 用强制成组空窗表后 with_skill 通过 | 文档结构和完成判据可以直接决定 Agent 是否把已有事实带到最终产物 | iteration-3 的 old_skill 也偶发通过，说明单 run 会把自发行为误当结构保证 | 这是 completion criteria、co-location 与信息层级的直接案例；应转成“报告必须成组呈现”的行为断言并重复采样 |
| `shopping-deep-research` | 四轮 with_skill 都 100%，但真实外部搜索成本持续很高；Issue #160 又暴露 fixture 与 live 搜索没有机械隔离 | 技能在当时真实输入上满足 grader 断言 | 不能复现输入、不能证明不同 gate 同证据、不能把 replay 绿解释成当前新鲜度 | 主缺口在 eval harness 的 evidence plane，不应靠改生产 SKILL.md 或 writing checklist 解决 |
| `workflow-interview-web` | 唯一持久轮 old/with/without 三臂都 100%，timing/token 均未测量 | 该题至少三臂都能完成已写断言 | 题目没有证明 skill 的独立价值，也没有成本与稳定性证据 | 属于 eval 区分度/完成判据不足；不是“再多写规则”就能自动修复 |
| `karpathy-llm-wiki` iteration-14 | with_skill 97.22%，without_skill 97.62%，并有一个 `lost`；记录仍处于新 bank epoch | 两臂绝对分都高 | 高分不等于正增益；跨题库纪元又不能与旧轮连续比较 | Creator 需要独立的 quality verdict：高 pass_rate 仍可能是 `INCONCLUSIVE` 或 `REGRESSED` |
| `steelman-analysis` | with_skill 94.44%，without_skill 33.33% | 当题面与断言能覆盖关键行为时，现有对照框架可以显示显著增益 | 仍是单个技能/题库，不能外推所有技能 | 证明不必推翻现有 eval；应补“假设驱动、区分度、稳定性、成本、证据可比”这几层 |

## 双向钢人后的裁决

### 支持“把 writing-for-agents 的有效原则纳入 Creator 设计”的最强论据

1. `ue-log-analysis` 已出现 eval 能捕捉、但普通结构校验完全捕捉不到的 Agent 文档失效：步骤做了，最终产物没带出来。
2. Creator 自己的 issue #56/#57 已用 pruning、条件性 disclosure 与 context pointer 思路删去约 509 行死能力，并把正文缩小 23.6%；这些原则已在仓库里产生实益。
3. 用户要的不是合法 `.skill`，而是可预测地完成任务；pointer、层级、co-location 与完成判据正作用在这个目标上。

### 反对“把整套写作原则做成硬 lint”的最强论据

1. no-op、leading word、sprawl 与完成判据强度都依赖模型、任务和失败轨迹，无法只看文本可靠裁决。
2. Creator 已经较大；复制 `writing-for-agents` 会制造第二真源、额外 context load 和下一轮 sediment。
3. 仓库里的主要失败不全是写作问题：Issue #160 是外部证据控制，三臂全平是 eval 区分度，跨 epoch 是比较语义。

### 明确结论

`writing-for-agents` 只作为本轮设计调研来源，不成为 Creator 的运行或安装依赖。Creator 必须把经仓库案例验证的最小原则压缩进自己已有的 `references/writing-guide.md`，再转成“失败假设 → 目标技能改动 → 定向 gate/断言 → 重复运行证据”。它不成为一张全量静态打分表，也不产生跨 skill pointer。

质量裁决与单 run 判罚分开：

- run 仍使用 `PASS | FAIL | BLOCKED | NOT_RUN`；
- 聚合新增 `quality_verdict = SUPPORTED | INCONCLUSIVE | REGRESSED | BLOCKED`；
- 结构校验全绿、绝对 pass_rate 高、或单次 with_skill 通过，都不足以单独产生 `SUPPORTED`。

## 修改应落在哪一层

| 层 | 应修改 | 不应承担 |
| --- | --- | --- |
| Creator 流程层 | 只读自身本地 writing guide；记录 `quality_hypotheses`；按假设建议 gates/runs/assertions；阻止无区分度结果冒充质量证明 | 不读取/调用/要求安装其他 skill；不机械替用户改写所有技能 |
| 目标技能文档层 | 只落与真实失败假设有关的 pointer、层级、co-location、完成判据、leading word 或 pruning 变化 | 不放 eval harness、fixture provider、history 聚合逻辑 |
| Eval harness / evidence plane | 固定外部输入；同 digest 对照；定向消融；重复运行；统计差异/成本/稳定性；给 quality verdict | 不改变生产技能的实时搜索/业务语义 |
| Viewer / history | 首屏同时展示 Evidence gate 与 Quality claim；跨 evidence/harness epoch 不比较；保留 `INCONCLUSIVE` 原因 | 不把未知值补成 0，不把 replay 冒充 live |

## 用户架构修正（2026-08-30）

- Creator 必须独立安装、打包、运行；没有 `writing-for-agents` 的宿主也必须全链可用。
- 复用现有 `references/writing-guide.md`，不新增第二个 writing reference 或常驻 pointer。
- 上下文双零增长：`SKILL.md` ≤31,415 UTF-8 bytes 且 ≤312 行；`SKILL.md + writing-guide.md` ≤40,364 bytes 且 ≤475 行。新增质量机制必须以 pruning 抵消。
