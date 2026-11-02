# 当前验证范围

2026-11-02，优化后结构校验通过，6项静态分发检查通过。实际执行示范使用用户已确认的两票本地Story，票1实现姓名规范化，票2实现stdin/stdout命令；第二票从planned恢复，主会话分别通过collaboration.spawn_agent、fork_turns=none启动两个实现者和一个独立验收者。原5项测试及独立API/CLI额外输入通过，最终源码摘要一致，两票证据及独立验收被索引后才关闭Story。

此结果证明该小Story在主会话具备子Agent工具时可以按本入口完成，不证明任意模型、长程大项目或200k上下文表现。主会话知道设计，非盲测；未作相同真实任务的without_skill比较。正式history由Creator聚合器生成，quality字段保持unassessed，不宣称统计质量增益。token/时间未暴露，保持未知。

嵌套主Agent探针看不到collaboration工具，曾误用桌面fork；该轮保留为工具适配诊断，不计通过。技能现要求准确报告该缺口，禁止用桌面会话替代子Agent；最后两处计划恢复/关闭职责文字补充只做静态复核，未全量重跑。

触发题库20条（10正10反），三组新上下文Agent每组回答全题，路由筛查均符合预期。trigger-benchmark明确标注batched-routing-smoke，组内结果有关联，不等于Creator每题三独立新上下文探针或宿主真实自动触发验收。五件套文件存在不能替代这一证据限制。

原iterations历史及原题库保留在legacy-evaluation/；旧baseline应为5通过/1失败/2不明确，详见更正记录。

原始工件位于parking-agents仓库外层的`evals/story-workflow-workspace/iteration-2/`（默认不提交）：

- `eval-root-story/with_skill/run-1/outputs/project/`：实际两票、源码、原始验证和最终evidence-index.json。
- `dispatch-diagnostic/`：工具适配诊断，保留实际fork及未完成结果。
- `legacy-reaggregation/`：按原逐条评分重新汇总，unclear按未证明通过处理。
- `trigger-smoke/`：批量路由原始结果及聚合。
- `review.html`：本轮自包含评审页。

未来真实Story使用本技能时，继续记录真实工具身份和独立验收；若需要正式发布稳定性判断，补完整独立触发探针及多场景长程行为验证。本文件披露限制，不给运行任务增加统一的测试次数或额外审批要求。
