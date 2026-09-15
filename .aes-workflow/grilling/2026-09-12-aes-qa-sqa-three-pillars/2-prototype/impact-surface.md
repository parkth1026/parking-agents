# 影响面扫描: 2026-09-12-aes-qa-sqa-three-pillars

判据：改完之后，程序在哪些地方跑起来不一样了？谁会看见、谁受影响？

| 影响面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | 无 | aes-qa 无 HTML UI；level-board.html 属 aes-gate（本票不动）；截图与 manifest 是文件系统产物，非界面 | — | — |
| 可观察行为 | 有 | ①最终轮产出 v4 receipt（等级栏三态：referenced/not-onboarded/FAILED）②agent 驱动验收成为 agent-live check，断言逐条托底，无托底降档 humanChecklist ③终态截图 VERIFIED 后冻结进伴随目录，secrets 扫描前置 ④GATE-qa 新增 v4 校验分支与 gate-shortfall 失败类 | 消费仓 merge 流程（GATE-qa 判定）、QA 执行 agent、读 receipt 的人与工具 | behavior.md |
| 可运行输出 | 有 | stage qa 提交后落盘树新增 receipts/&lt;attempt&gt;/shots/ 与 shots-manifest.json；run-tests.mjs 新增 v4 契约 case 输出行 | 消费仓运维、CI/本地跑测试的人 | example-run.md |
| 对外接口报文 | 有 | 新增 aes.qa.receipt/v4 schema：repositoryGate（status 闭集+未接入态）、checks[].kind 新增 agent-live、driver 块、assertions 托底、companionShots、failureClass 新枚举 gate-shortfall；GATE-qa verdict 报文相应扩 v4 理由码 | aes-worktree-board merge-policy（机械消费方）、任何读 receipt 的下游 | api-mock.md |
| 用户配置 | 无 | 不新增配置文件/环境变量/CLI 选项；等级声明（requiredLevel 可空）是 receipt 报文内字段；伴随目录容量上限是 reference 约定非用户配置 | — | —（behavior.md 配置差异节省略） |
| 历史兼容性 | 有 | v1/v2/v3 读法与豁免语义必须逐字节不变；GitLab 截图发布链路零收窄；既有 5 个 screenshot-evidence 契约 case 默认套件语义不变；现状漏洞——merge-policy 只认 /v3 尾缀，v4 会被误判 legacy 豁免，本票必须补上 | 所有已发 v1/v2/v3 receipt 的消费仓 | behavior.md 不变清单 |
| 架构与依赖 | 有 | ①aes-qa 经 reference 组合既有能力技能（browser-use/computer-use/playwright-cli），不内建不新造 ②receipt 伴随目录成为 .aes-worktree-board/receipts/ 下新落点 ③aes-qa↔aes-worktree-board 消费合同从 v3 扩到 v4 | 技能族拓扑读者、后续给 receipt 加字段的维护者 | diagram.html |

## 七面小结

一面无界面、一面无配置；五面有差异，出四份对照物：behavior / api-mock / example-run / diagram。

## 回退补充扫描（2026-09-12，needs_reinterview 循环）

- 用户可见界面：由「无」改「有」——新增 qa-report.html（v4 验收单一等伴随产物：模板复制零 LLM、单文件零外链断网可开、shots/ 相对路径图片引用、随 receipt 同批作废）。
- 未另出独立 mock.html 的理由：其信息结构是 api-mock.md 已确认字段的确定性投影（无独立 schema 自由度），视觉锚=export-dossier 产物形态（用户原话点名参照）；结构要求由契约 AC-007 与强约束承载。此判断入契约「残留风险」。
