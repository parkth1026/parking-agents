# Context Snapshot: 2026-08-16-scoring-system-fixes

- 创建：2026-08-16（本地时间）
- 分片来源：无，宿主直接调查；上游权威需求文件 = `D:/GIT_dev/parking-agents/scoring-audit-2026-08-16/verdict.md`（对抗审查独立验收裁决）

## 任务陈述

针对评分体系对抗审查实锤的所有问题，全部修复，输出改进 goal-contract。

## 用户提出的方案

以 verdict.md 的「存活的结构性缺陷清单（修正后）」9 项 + 「最值得做的改进」为需求底稿，全部修复。

## 意图假设

让 jenkins-pair-analyze 的评分体系从「及格偏好的启发式清单」升级为「语义一致、有验证信号、有反馈仪表、信度可测」的体系；本轮把规范/机制类修完，数据依赖类（权重校准）视用户选择决定是否本轮完成。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 实锤缺陷 9 项（含各条出处行号）：①diff 语义三处矛盾（scoring.md:15 vs :38 vs config.md:42/44）②权重/8-5 阈值无校准 ③真实 diff 与预防建议同价、8 分门禁无分辨力（aes6-329 无 diff 8 分进 details/ 已发生）④评分信度无测量 ⑤效用反馈零落账（:see= 0 条、Recurrences 占位）⑥验证止于结果级 ⑦Commit 维度语义未定义（culprit vs 修复提交；infra 封顶 7 的真因）⑧严格 infra 子类实测封顶 7 ⑨小项：<5 分支从未触发 + knowledge-format.md:47 自例缺 ShortDesc | `scoring-audit-2026-08-16/verdict.md` 三节 | Fact |
| verdict 给出的改进方向：Top1 统一 diff 语义（一处定义三处引用 + 「diff 不可得时等效强归因链」=唯一 pin 变化+提交标题与缺失对象同名+错误消失）；Top2 警告计数接入评分 + :see=/Recurrences 真正落账；Top3 抽样人工盲评测信度 | verdict.md 三.4 | Fact |
| 「真实 diff 作为硬门禁」已被验收否决（aes6-329 反例：无 diff 但强归因链成立，8 分进 details/ 合理）；「infra 单独 rubric」前提降级（真因是 Commit 语义，非结构性禁令） | verdict.md 二/三 | Fact |
| 修复涉及文件：`jenkins-pair-analyze/references/{scoring,analyze,knowledge-format}.md`、`jenkins-log-auto-learning/references/config.md:42-44`、`jenkins-log-auto-learning/scripts/validate-raw.mjs`（已接 session.mjs stage done 门禁） | ls + 记忆 jenkins-kb-on-nas | Fact |
| 语料活跃：NAS x.public 库 details+scratch 共 14 份文件；账本 98 对已分析、队列到 #380；**本工作区无 cron（驱动在别处），无法暂停，规则改动需原子落地、下一轮即用新规** | `ls //nas...`、账本读取、CronList 空 | Fact |
| 账本构成：82 条 failure:score=、2 条 infra:、:see= **0 条**（去重指针从未落账——缺陷⑤仍在扩大）；分数分布：9×7、42×8、25×9、6×10——**8 分恰在 details/ 门禁上占半壁（边界效应）** | 账本 node 统计 | Fact |
| success:w 警告计数已全量落账（审计时 12/12）但未接入评分 | verdict.md + 账本 | Fact |

## 验证基建候选池

- `node .../jenkins-log-auto-learning/scripts/validate-raw.mjs`（全库机械验收，现成，代价：跑一次全库）。
- `node .../scripts/session.mjs list`（账本/队列视图，纯读）。
- 文档一致性 grep 断言（矛盾句消灭、维度名修正——纯读）。
- 重评后语料一致性：node 遍历 NAS 文件 frontmatter score 与落盘目录匹配（纯读）。
- 人工盲评：用户时间（半天级），不可自动化。

## 术语冲突

无。

## 四分类

- **Fact**：上表全部。
- **User decision**（第 1 轮已全部裁决）：
  - ① Q1=A：**9 项全修**——7 项规范/机制类修完；权重与 8/5 阈值本轮不动，只接效用信号仪表（:see=/Recurrences 落账纪律 + 警告计数结构化）并写明校准触发条件；
  - ② Q2=B：**向后兼容设计，存量 14 份不动**（新规则重算不得改变现有分档；等效强归因链是把 aes6-329 已用实践合法化，不是提分通道）；
  - ③ Q3=A：警告计数作**独立验证信号**（Warning Trend 必填节 + details 门禁旁证「恶化须解释」），不进 10 分总分；
  - ④ Q4=B（翻推荐）：**本轮就人工盲评**，结果进契约——执行 Agent 产盲评包（去分副本+维度级评分表+流程），用户盲评，一致率指标落盘；盲评为 [C] 档、操作者=用户，不阻塞其余验收。
- **Agent-owned**：矛盾统一措辞、等效强归因链表述、Commit 维度语义定义（culprit/修复两分）、validate-raw 兼容机制（新字段仅对新文件生效，存量放行）、盲评包具体格式与指标公式、git 提交切分、验收命令写法。
- **Blocked**：无。

## 决定边界未知项

（无——Q1–Q4 已全部裁决；盲评细节按上述分诊归默认/Agent-owned，在对照物阶段供逐处质疑。）

## 未知项

（无。）
