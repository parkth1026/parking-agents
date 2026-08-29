# ADR-0004：grill → 出口融合 → 派发阶段模型

- 日期：2026-08-29
- 状态：已接受（2026-08-29 用户裁决）
- 关联：parkth1026/parking-agents#147（map）、#155（裁决票，本 ADR 主决议源）；调研底座 #148、#151
- 筛选判据自评：三条全中——阶段模型决定每一张票建出来时的形状与依赖边，票群建成后再改阶段语义等于重拆；「为什么 grill 在 story 级只跑一次、为什么 to-spec/to-tickets 融合在出口、为什么没有阶段票型」是无上下文时的惊讶点；「拆解时刻例子池不可能覆盖全部细化」vs「story 歧义不许逐票重问」是真实权衡。

## Context

- story 级爆掉的缺失层是拆解：AC>7 校验器自要求「拆成几个能独立交付的任务」但拆出的多件事无编排层接管（#148 报告 2.3 放大器 4）；单 issue 三阶段的工作集随 story 体量无界增长（#148 报告 2.3 放大器 1-3）。
- 三阶段门禁在哪一级跑存在三个候选（每票全家桶 / story 级一次 / story 级前两段 + 票级契约）；阶段的 tracker 表达存在票型 / 生命周期属性 / map 阶段线三个候选（#155 Round 1 Q1/Q2）。
- wayfinder「map 是索引不是 store，一个 decision 只活在一个地方」（WF-I01）与 frontier 实时查询（WF-I07）是不可变量；to-spec / to-tickets 技能本体已存在且供 ad-hoc 使用。
- 拆解时刻的例子池不可能预先覆盖每票执行前的全部细化——「票级例子不够补对照物」是合法细化路径（#155 Q1-A 对 C 的否决理由）。

## Decision

**阶段模型 = grill → 出口融合 → 派发（#155 决议①②③④⑤）：**

1. **story 级 grill 一次收敛**：interview + prototype 在 story 级跑一次——例子池 = 确认版对照物在 story 级收敛，不逐票重跑；每票只跑 3-contract，票级契约是「把例子簇分给票」不是重新发明。
2. **拆解出口一次产出两件**：story 契约（to-spec 功能位，承载 contractDigest）+ tracer-bullet 纵切票带 blocked-by 边（to-tickets 功能位）。to-spec/to-tickets 融合在出口、不单独触发；两技能本体保持原样供 ad-hoc 使用。
3. **拆解判据 = to-tickets 规则**：每票 = 单个全新上下文窗口装得下的纵切片、可独立验收；同时作为「拆解粒度与上下文预算」的判据基础。
4. **阶段的 tracker 表达 = 票生命周期属性 + frontier 门禁线**：不新增阶段票型、不设 map 阶段线；票创建即契约进行中，票级 finalize 通过才打 `ready-for-agent` 进 frontier——未 finalize 的票天然不在派发面。
5. **两级契约两处 finalize**：票级 finalize = ready-for-agent 前置闸（冒烟挡 UNRUNNABLE、交接面 = 票 body + contract 路径）；story 级 finalize = 拆解出口闸（story 契约 [A] 冒烟 + 残留风险对账 + 全票 digest 清单回填，跑过才批量建票）。
6. **skipped 语义只留 story 级**（2-prototype 原语义）；票级不开——否则「拆解漏分例子」与「真的无差异」不可区分。
7. **编排脚本是 tracker 状态唯一写入者**（门禁等价物，与 ADR-0002 第 7 条同源）。

## Consequences

- 正：story 级歧义不逐票重问（「同一件事不判两遍」）；票数与依赖边即拆解结构，星图/frontier/门禁全部吃现成数据，零新增票语法；冒烟挂点「派发前最后一刻」使全红判读恰好有效；上下文预算被单窗口纵切判据直接管住。
- 负：拆解质量被前置——切错了只能走 story 级回退（withdraw + Reopens 新票），没有更便宜的纠正通道；story 级 grill 成为单点重会话阶段（靠 ⑨ 会话纪律的阶段边界切割兜底）；to-spec/to-tickets 的独立入口与融合入口并存，用户需理解两者关系。
- 难逆转性：执行票一旦按「单一票型 + 生命周期属性 + blocked-by 边」建成，改回阶段票型或加 map 阶段线要重刷全部票与边；本 ADR 约束 #159 spec ①③ 两节。
