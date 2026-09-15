# Context Snapshot: 2026-09-12-aes-qa-sqa-three-pillars

- 创建：2026-09-12
- 分片来源：facts/aes-qg-gate.md、facts/aes-qa-logic.md、facts/coupling-and-gap.md

## 任务陈述

用户原话：「按前面的顺序，我们开始走正式的 interview 流程，最后走到 goal contract。」

任务实体（前序对话确立）：执行 GitHub issue #171「aes-qa: SQA 优化三支柱——AES-QG 标准化收口 + 业务真实验收档 + 最终截图留存」，含本会话 steelman 裁决的形态修正。

## 用户提出的方案

#171 三支柱（用户今日开票）：
1. AES-QG 标准化收口：最终轮 receipt 给所达门级、原子引用同 candidate gate receipt、automated 档跑既有回归并映射门级、「未达声明门级」成显式失败类；
2. 业务真实验收档：live 档 reference 级操作定义（真实栈+配对浏览器真实 UI+真实 provider/模型、正反例必验、证据四分层、BLOCKED 口径、成本控制、tracker 无关手法配方）；
3. 最终截图保留：终态截图成 receipt 一等伴随产物、tracker 无关保留、final candidate 变更后旧图随 STALE_EVIDENCE 作废。

Steelman 裁决修正（用户背书「没毛病」）：
- 协议进 aes-qa（reference），不新造独立 skill，运行时组合既有能力技能（browser-use/computer-use/playwright-cli）；
- agent 断言必须证据分层托底（server trace/read model/DOM 报文断言），无托底降档 humanChecklist；
- agent 驱动验收用新 evidence kind，与 manual 档 AWAITING_HUMAN 词表隔离（红线：agent 不得代答人工验收保持）；
- agent 驱动 check 记驱动执行者标识（模型+底层数据源指针），防换模型重跑被误判 reused；
- 独立 skill 重开条件（非 AES 高频独立调用/能力封装超出既有技能表达）写进 reference。

回退补入（2026-09-12 needs_reinterview 循环，用户原话）：
「AES QA 的完整验收单要像 workflow interview 最后输出的那个 HTML 一样，能在 HTML 里看到所有测试结果以及对应的截图资源。而且这个 HTML 是直接用模板 copy 的，不会消耗 LLM，也会直接带上图片引用。」——qa-report.html 一等伴随产物·必产；人类可读格式仅 HTML（机器消费走 qa-receipt.json）。

## 意图假设

表层任务是三支柱实装；真正要解决的是：消费仓接入 AES 引擎时验收侧「各说各话」——普通 QA 结论无等级语言、live 验收每仓手工摸索（aes-agent real-provider 手册是一次性沉淀未回流）、视觉证据绑死 GitLab tracker。深层目标：SQA 整体视图收口到统一可机械审计的语言，且不为此破坏既有 fail-closed 语义与 v1/v2/v3 冻结惯例。与任务陈述的差：陈述只说「开测走流程到契约」，实体范围由 #171+steelman 共同界定。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| AES-QG/1 标准、L0-L5、三轴判级、五维 identity 复用、所有权归 aes-gate | facts/aes-qg-gate.md | Fact |
| achievedLevel 只能出自引擎累计 receipt，单项不得自称等级 | facts/aes-qg-gate.md（aes-qg.md:42-43,98） | Fact |
| 五维 identity 不含驱动执行者标识（LLM 门复用盲区） | facts/aes-qg-gate.md（aes-qg.mjs:278-280 闭集实证） | Fact |
| aes-qa 三形态/三档位/红线；live 档仅一行定义（缺口实证） | facts/aes-qa-logic.md（SKILL.md:64） | Fact |
| QaReceipt v1/v2/v3 schema 与冻结兼容先例；v3=opt-in 门强度声明 | facts/aes-qa-logic.md（SKILL.md:105-139） | Fact |
| 消费端以 schemaVersion.endsWith('/v3') 判别，非 v3→legacy 豁免 | facts/coupling-and-gap.md（merge-policy.mjs:86-89） | Fact |
| 跨技能真实耦合仅 repository-gate.contract.mjs + v3 digest 引用；等级语言零渗透普通轮 | facts/coupling-and-gap.md | Fact |
| QaReceipt 落 .aes-worktree-board/receipts/（Git 忽略）；截图链路终点=GitLab note+marker | facts/coupling-and-gap.md | Fact |
| gate receipt 命名碰撞（判级收据 vs 截图批次回执）需在 reference 写作中消歧 | facts/coupling-and-gap.md（screenshot-evidence-core.mjs:14） | Fact |
| 本仓库无 CI（无 .github/workflows）；验证=各技能自带 run-tests.mjs 契约套件 | 宿主调查（ls .github/workflows 空）；aes-qa/run-tests.mjs:10-34 | Fact |
| AC-2 允许直接引用 aes-agent #153 F-1 作首个验证实例 | issue #171 原文 | Fact |
| 各消费仓 v3 receipt 实发情况未知（跨仓边界） | facts/coupling-and-gap.md 未知项 | Blocked（不影响方向，影响 Q4 代价真实性） |

## 验证基建候选池

- aes-qa run-tests.mjs 契约套件：新增 case 代价低（CONTRACTS 注册表扩项，run-tests.mjs:13-34）
- repository-gate.contract.mjs：跨技能同一证据合同，补分支断言（生成侧引擎真实参与）
- aes-worktree-board merge-policy 测试：若含消费侧同步，GATE-qa 子门加 case（代价：动第二技能回归面）
- 消费仓真实一轮验收：引用 aes-agent #153 F-1 零成本（issue 允许）；新跑一轮=高成本（真实付费模型+浏览器），本票默认不新跑
- 无仓库级 CI/覆盖率工具：不存在该途径，不列入

## 术语冲突

- 「gate receipt」双义：aes.gate.receipt/v1（判级收据）vs qa-gate-receipt.json（截图批次回执，screenshot-evidence-core.mjs:14）——reference 写作必须消歧
- 「人工复测」用户词 vs 仓库 manual 档：用户语境「像人一样复测」=agent 驱动，属 live 档新 evidence kind；仓库词「人工」专指真人（humanChecklist/AWAITING_HUMAN）——已按 steelman 裁决隔离，契约沿用此口径
- 「映射到门级」（#171 支柱 1 原文）歧义：引擎同源判级 vs 事后机械映射——两种读法通向不同架构，列为提问 Q2

## 四分类

- **Fact**：见已查事实表
- **User decision**（均已裁决，round 1）：
  - ①交付边界 → **一票全含**：三支柱 + steelman 修正 + aes-worktree-board GATE-qa/merge-policy 消费侧同步；各消费仓自身接入迁移不在本票
  - ②等级收口强度 → **引擎同源 + 显式未接入**：等级只能出自引擎 receipt 原子引用；未做门禁建设的仓等级栏显式记「未接入门禁」+原因，验收单仍有效；「未达声明门级」仅在仓声明目标级时为失败类（用户以「建设问用户、执行自主」双使命框架亲自确认）
  - ③支柱 3 保留位置 → **验收单伴随目录**：终态截图随 receipt 同目录同生命周期冻结（STALE_EVIDENCE 同源作废），GitLab 发布链路并行不收窄
  - ④receipt 版本演进 → **v4 新档**：等级义务+截图伴随产物+agent 驱动 evidence kind 全进 aes.qa.receipt/v4；v1/v2/v3 冻结
  - ⑤qa-report.html 定位（回退轮）→ **一等伴随产物·必产**：随 receipt 同生命周期同批作废，出票管线必经组件
  - ⑥人类可读格式（回退轮）→ **仅 HTML**：模板复制零 LLM、单文件零外链断网可开、图片相对路径引用；不另做 Markdown 渲染件
  - ⑦AC-004 验证深度（回退轮）→ **[D] 六要素文件检查 + [C] 用户对照 #153 F-1 人工复核**
- **Agent-owned**：reference 文本结构与篇幅、evidence kind 命名、托底证据类型清单、secrets 扫描实现、驱动执行者标识字段形态、「未接入门禁」枚举与原因字段形态、伴随目录布局与容量上限数值、qa-report.html 模板与渲染器实现（形态锚=export-dossier 产物：单文件、系统字体、相对图片引用）、契约测试 case 编写、SKILL.md 触发描述更新
- **Blocked**：消费仓 v3 实发盘点（跨仓，不阻塞本票方向，仅影响兼容叙述精度）

## 决定边界未知项

- 「SQA 整体视图」是否需要额外可视化产物：#171 AC 未列，按默认不做出图（见默认区第 8 条），若用户实则想要看板需翻掉该默认

## 未知项

- 各消费仓 v3/v2/v1 receipt 实发数量与分布（跨仓边界，必须问或标 Blocked；当前标 Blocked，仅影响 Q4 代价描述精度）
