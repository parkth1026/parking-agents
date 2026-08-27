# design.md — aes-gate 设计依据

## 意图与触发场景

把「踩坑即记门、仓库门禁体检、按模式补门、活看板」做成一个技能：

- **开发中**对话「把刚才这个问题记成 gate」→ 单条沉淀主路径（高频）；
- **显式** `/aes-gate` → 批量检测：盘点门禁基建（测试命令/CI 检查/checks 脚本/evals 基线）、逐门实跑红绿、六维评分、产出**缺口清单**（完整性不可判定，不做完整/不完整二值）；
- **体检后**对话「组装 G1–G3」→ 按模式库生成最小门禁（低频，确认门+硬前提）；
- **被 aes-qa 调用**（`--handoff`）→ 精简回传盘点表+缺口清单，不落盘。

aes-qa 侧的调用契约：AC 来源优先级 **goal-contract＞gate＞显式需求＞惯例推导＞现场问**；gate 与运行态矛盾以运行态证据为准、gate 条目记「疑似过时」（stale）待人审。

## 设计取舍

| 取舍 | 决定 | 为什么 |
| --- | --- | --- |
| 补建边界 | 检测+组装（#41 裁定 B，翻案推荐 A） | 单人+agent 生态里，移交≈搁置；护栏=确认门+selftest+出处注释+最小集 |
| 协议对齐 | 不对齐 gate/v1（Q2=C） | 不为未来 runtime 预付自由度；run.toml 已提供注册标准 |
| 看板形态 | 活看板（翻案推荐静态快照） | 与 aes-worktree-board 已验证模式同构：collect→registry→board 投影，页面零 JS 不推导状态 |
| TOML 解析 | vendor toml-node 4.3.0（MIT，随源保留许可证） | run 标准同款思路；零 npm 依赖、支持完整 TOML 1.0，不写子集猜解析器 |
| 评分 | 档位由保护结构决定、不看总分 | 防 Goodhart；OpenSSF Scorecard 权重不透明的批评点反面 |
| 档案 | registry 原子重写+history 追加 | 跨轮可比（无生态基线→历史序列即自我基线） |
| stale 机械面 | ENOENT（注册在、实体没）与 CI 引用缺失 | 纯本地可判；GitHub 运行态矛盾由 agent 复核补充（须带证据） |

## 验收条件

对齐 goal contract（`.aes-workflow/grilling/2026-08-24-aes-gate/3-contract/contract.md`，三阶段全 done）AC-001…AC-005 与 #42 票面 AC：

| 编号 | 条件 | 类型 |
| --- | --- | --- |
| AC-1 | 技能目录结构完整：SKILL.md+references（weights/pattern-library/api/design）、脚本 .mjs 零依赖（vendor TOML 属随源分发） | script（quick-validate + run-tests） |
| AC-2 | 盘点输出为缺口清单而非二值判定：缺口=带 P 级/owner/可组装性/证据的移交单；空清单时表头仍在（证明扫过） | script（self-test S7 断言空表头） |
| AC-3 | run.toml=注册真源：门 id=action id、registry 不复制命令定义只存运行时事实、缺 run.toml 时 G0 置顶、扫描门标「未注册」 | script（self-test S3 断言 + api.md 锁定约定） |
| AC-4 | 真实自举试用产出的缺口清单非空且可辩护（逐条带证据：文件/命令/退出码） | manual（对本仓跑一轮，报告留档 references/bootstrap-report.md） |
| AC-5 | 通过 parking-skill-creator 既有校验（quick-validate/run-tests 全绿，npm test 七连不破坏） | script |

## 迭代记录

| 日期 | 改了什么 | 轮次结果 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-08-27 | 首版落地（#42）：按 goal contract D-01…D-05 实现技能目录；对本仓完成首轮自举体检（无 run.toml→G0 置顶，纸面档） | 未跑输出评测（gate 联动与 evals 归 #19/#47 后续） | 无 |
