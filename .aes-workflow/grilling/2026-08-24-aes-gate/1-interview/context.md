# Context Snapshot: 2026-08-24-aes-gate

- 创建：2026-08-24
- 分片来源：无，宿主直接调查

## 任务陈述

把 aes-gate skill 也纳入计划。aes-qa 会调用 aes-gate 去检测。来 重新走 goal contract 流程

## 用户提出的方案

- aes-qa 开测前调用 aes-gate 检测（gate 盘点+缺口清单）；gate 完整则「gate 测试 + LLM 真实测试」（此半句已并入 aes-qa 地图基线，见 map #15 Notes「gate 联动」）。
- 改用 workflow-interview 三阶段（访谈→对照物→goal contract）锁定 aes-gate 的「要做什么/怎么算做完」，替代 wayfinder ad-hoc grilling。

## 意图假设

表层：给 aes-qa 配一个门禁检测技能。深层：让验收的**确定性 oracle 层可盘点、可指向**（gate 完善→QA 有指向性），并把 gate-builder 蓝图的「检测半程」（Phase 1-3 / M1）先落到 AES 族；通用 gate-builder Skill 仍是长期方向，不在本任务内。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| gate/v1 为规格与一致性包，spec-only（无 Rust CLI/Core/SDK/runner） | `G:\GIT\AI_WorkFlow\aes-gate\README.md` | Fact |
| 协议语义：三态 PASS/BLOCKED/FAILED、不可变 Run、digest 链、`gate.toml→lock→run→verify`、Registrar/Runner Adapter、required profile、evidence 文件 | aes-gate `docs/cli.md`、`docs/architecture.md`、`docs/aes-agents-adapter.md` | Fact |
| adapter 单向依赖缝：agents 侧可依赖 gate/v1，协议侧禁止反向 import | aes-gate `docs/aes-agents-adapter.md` | Fact |
| gate-builder 蓝图：三层切割（引擎=twe-gate／协议=aes-gate／建设者=缺位 Skill）、六阶段工作流（调查→体检→分诊→组装→自举→复诊）、M1 体检先行裁定（只读零风险独立有价值）、六维评分+权重、反模板保险五条 | `docs/research/gate-builder-skill-blueprint.md` | Fact |
| TOP-5 门禁调研 v2（评分维度与权重出处；模式库素材） | `docs/ref-repos-gate-research.md` | Fact |
| evals 门禁两场景框架（设计期验收+发布期回归） | `docs/eval-gates-best-practices.md` | Fact |
| aes-qa 定稿与 gate 联动基线：调用关系、AC 来源优先级（goal-contract＞gate＞显式需求＞惯例＞现场问）、gate 与运行态矛盾以运行态为准 | map #15 Notes、#18 决议评论、#19 评论 | Fact |
| 本仓验证基建：npm test 本地七连（discovery/install/no-tool-names/session-start/pi/harness/bump+check:repo）；**无 CI workflows、无自定义 git hooks**——蓝图「纸面门禁」断言仍成立 | `package.json`、`.github/`、`.git/hooks/` 实查 | Fact |
| aes-* 技能惯例：中文、SKILL.md+references(+agents/scripts) 布局、SKILL_ENV 族级标准 | `.agents/skills/` 实查、parking-skill-creator | Fact |

## 验证基建候选池

（aes-gate 技能自身的验收途径；契约阶段定档）

1. `/aes-gate` 对 parking-agents 自身自举体检一轮，报告断言可人工复核（蓝图 M1 验收口径：「无 CI+本地门禁红=纸面门禁」这类断言）——代价：先跑一次 npm test 核实红绿基线。
2. 被 #19 aes-qa 自举试用真实调用一次（#42 票面要求）——代价：排在 aes-gate 落地之后。
3. npm test 七连不回归（新增技能目录不破坏 discovery/no-tool-names 检查）——代价：低。
4. 触发评测（psc 探针机制）——后续 evals 票口径，本轮只登记。

## 术语冲突

无。`CONTEXT.md` 的 aes-gate 词条（计划中的门禁技能：盘点+缺口清单，供 aes-qa 调用）与本任务对齐；gate/v1 协议包同名不同物，词条 _Avoid_ 已划清（gate-builder=通用名、twe-gate=引擎名）。

## 四分类

- **Fact**：已查事实表全部。
- **User decision**（均已裁定，round 1–2）：①补建边界=**B 检测+组装**（显式会话按模式库生成最小门禁+selftest，经确认落地；终裁前用户要求行业实践对照，两条推荐翻案均记 overturned）②协议对齐=**C 不对齐**（输出自由设计，不绑 gate/v1 词汇）③触发面=**A 双通道**（显式 /aes-gate 独立体检；被 aes-qa 调用时精简回传不落盘）④组装触发=**A 检测归检测**（aes-qa 调用路径纯检测+移交单，生成只在显式会话）。
- **Agent-owned**：报告模板字段与节构、references 组织、盘点实现细节、评分细则措辞、SKILL.md 篇幅与结构、description 措辞收窄方式。
- **Blocked**：无（gate/v1 Rust 运行时缺位因 Q2=C 不构成阻塞）。

## 决定边界未知项

- 补建边界拿不准该归 User decision 还是 Agent-owned：检测 only 与检测+组装的成本结构差异大（技能面翻倍），按 asking.md 归提问区。

## 未知项

- gate/v1 Rust runtime 的孵化排期（跨仓库边界，读不出来）：若走封装路径需要它；语义对齐路径不依赖。
