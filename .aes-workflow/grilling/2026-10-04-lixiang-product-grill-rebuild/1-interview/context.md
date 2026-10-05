# Context Snapshot: 2026-10-04-lixiang-product-grill-rebuild

- 创建：2026-10-04T16:40+08:00
- 分片来源：facts/wiki-precedent-repo-rules.md、facts/skill-internal-contracts.md、facts/course-content-structure.md

## 任务陈述

> G:\GIT\AI_WorkFlow\parking-agents-manual\skills\product\lixiang-ceo-grill
> 我期望 完善这个 技能
> 使用 G:\GIT\AI_WorkFlow\product-research\exports\2026-10-04-dedao-lixiang-product-16\ 这里的知识 做成 LLM wiki 融合到 ceo-grill 里
> 你用双向 steelman 帮我 确定一下 最重要的问题是什么？

后续补充指令（同一会话，原话）：

> B. 升级为 16 讲全景产品尺——题库按 16 讲重构，技能身份从「CEO 方向复盘」变为「李想产品方法论全景复盘」；

> 我们用 workflow-interview 来 做完整 流程

## 用户提出的方案

融合方案本体由用户带来：把已购得到课程《李想·产品实战16讲》（19 篇全文存档于 product-research 仓，约 250KB）编译成 LLM wiki，融合进 lixiang-ceo-grill 技能。融合架构经双向钢人后由用户裁定 B 案（整尺更换）。

## 意图假设

用户真正要解决的：现技能的尺子（单篇公开课文章提炼的三层九模块）与其日常产品决策（定价/体验/复盘/节奏）错位；16 讲是同一作者的完整产品方法论，且自带案例弹药。用户是技术型产品经理，实际使用频率高的复盘对象是产品实践而非公司方向——钢人 crux（「同一方法论不同精度 vs 两把不同的尺子」）落在「用户要盘的是产品实践」一侧，故整尺更换而非并存。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 仓内已有 wiki 融合先例：ceo-copilot（references/wiki/ 126 页 + 仓内 karpathy-llm-wiki v7.2 校验器 8 维全 10 分 + slim 运行时分离 + run-tests 结构断言） | facts/wiki-precedent-repo-rules.md | Fact |
| 修改已发布技能无专门流程；门槛=五件套+run-tests 绿；该技能现缺 trigger-evals.json/trigger-benchmark.json | facts/wiki-precedent-repo-rules.md | Fact |
| 改名波及面已全量探明：安装器零改动、ceo-copilot 题库与规范名需同步、symlink 需重建、evals 快照不改 | facts/wiki-precedent-repo-rules.md | Fact |
| 16 讲每讲固定骨架（误区→原则→案例→反例→编号总结），原文自带加粗标准句与跨讲显式依赖，发刊词十五挑战与 14 维度+结语一一对应 | facts/course-content-structure.md | Fact |
| 题库六要素格式、run-tests 断言清单、报告模板七节、web-prompt 压缩模式均已摸清可复用 | facts/skill-internal-contracts.md | Fact |
| 本仓 public（github.com/parkth1026/parking-agents），课程存档页标注「仅限个人使用，请勿外传」 | `gh repo view` 实测 + 存档 00-目录.md 头部 | Fact |
| 仓库无 CI，门禁全本地（npm test / npm run evals / 各技能 run-tests / validator / quick-validate） | facts/wiki-precedent-repo-rules.md | Fact |

## 验证基建候选池

- 各技能结构回归：`node skills/product/<技能>/run-tests.mjs`（现成惯例，重写断言后即用）
- wiki 校验：`node skills/ue/karpathy-llm-wiki/scripts/validate-wiki.mjs --wiki <dir>`（v7.2，PASS=≥9.0 且断链 0；ceo-copilot 同款用法）
- 触发评测：`npm run evals -- --skill <名>`（真跑，本轮已拍板；运维要点见 memory trigger-eval-agent-channel-ops）
- 输出评测：同一 evals 基建（output-evals.json 3 evals 重写后跑）
- 全仓回归：`npm test`（含 test-skill-discovery——改名后自动发现须仍绿；check:repo 不含 product/）
- quick-validate：parking-skill-creator 的触发模式检测（注意其源文件当前有未提交 M，只调用不修改）
- 绝对路径门禁：md+mjs 字面扫描 `:\` 与 `:/`（既定审计口径，fixtures/log 豁免）
- 代价说明：以上全部现成，无「先建基建」项

## 术语冲突

- 「LLM wiki」：用户语境=karpathy 式互链知识页（仓内 karpathy-llm-wiki 技能同名同义），无冲突
- 「尺子」：本技能 design.md 术语=题库中的李想原文标准；重构后指 16 讲标准句。无跨方冲突，仅内部换代，design.md 会重写

## 四分类

- **Fact**：上表全部；wiki 先例架构、验证基建、改名波及面、课程结构、仓库 public 状态
- **User decision**（已裁定，7 项全收口）：
  1. 整尺更换 B 案（钢人 crux 落产品实践侧）
  2. 改名 lixiang-product-grill
  3. 旧公开课原文降为附注保留（推翻「彻底移除」推荐）
  4. 触发评测本轮真跑
  5. 引用无限制：个人仓库自用，原文全文可入仓（用户在「仓库 public」事实已出示于题干的情况下裁定；据此 raw 全文存档层可建，仿旧技能原文存档模式）
  6. wiki 运行时赋能：质疑与回答时用 wiki 知识，复盘各维度读对应 wiki 页（推翻 slim 推荐——本轮三处同向推翻：推荐过度锚定仓内先例、低估用户对能力面的要求）
  7. 触发模式改名字触发（description 只写名字中英双语，按 2026-10-03 三档定案的字款式）
- **Agent-owned**：wiki taxonomy（sources/concepts/cases+S/K/C 前缀）、raw 全文存档文件形态、题库单文件 14 维度组织、层间断点 5 条措辞、附注护栏断言写法、SKILL.md 协议骨架保留、web-prompt 重建压缩比、output-evals 3 场景适配、history.json bank_epoch 2 追加、分批 commit 划分、symlink 重建时机、加餐 2 篇建页方式
- **Blocked**：无

## 边界（明确不做）

- 不动全局 karpathy-llm-wiki 的 knowledgeBase 基建（wiki 只进技能目录）
- 不修 product-adverse-review 本体（触发评测顺带复核其语域边界，仅此而已）
- 不改 karpathy-llm-wiki 校验器本体（只调用）
- 不碰 parking-skill-creator 未提交 M 文件；evals/ 与 .agents/evals/ 历史快照不改
- 不新建 worktree（仓规：以用户指定目录为唯一工作目录）
- 旧九模块题库内容移除（git 历史留底）；旧公开课文章附注化保留但不再是尺子

## 决定边界未知项

- 无

## 未知项

- 无
