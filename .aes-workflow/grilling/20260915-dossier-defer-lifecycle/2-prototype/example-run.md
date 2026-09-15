# 可执行示例: 20260915-dossier-defer-lifecycle

## 场景 1：改动后回归（既有测试不破）

```text
$ node C:/Users/parking/.agents/skills/workflow-interview/scripts/export-dossier.test.mjs
ok - answerSummary choice/multi/custom/text 不变语义
…（新增用例见场景 2）
# 全绿

$ node C:/Users/parking/.agents/skills/workflow-interview/scripts/session.test.mjs
ok - round 校验：default 行带 item 通过（新增：缺 user 时 stderr 一行警告）
# 全绿
```

## 场景 2：新增用例（写死的期望输出）

```text
$ node export-dossier.test.mjs
ok - defer 行渲染为「⏸ 暂缓」而非 custom
ok - defer 无承接轮计入 openAmbiguities；被承接后关闭
ok - default user="未反对" → 默认生效；user 缺席 → 未记录反应；均不显示「尚未回答」
ok - 同 q_id 跨轮聚合生命周期 + triggered_by 标注
ok - 长文本 user 渲染为翻案文本（非误标 veto 徽标语义）
```

## 场景 3：黄金回放（issue149 真实数据）

回放数据源（issue149 会话目录，含 defer 形态/6 行缺 user/1 行补录长文本全部形态）：
`G:/GIT/AI_UE_Workflow/AntHub-dev3/.aes-workflow/grilling/20260914-issue149-stage-gate-anchor-reconciliation`

改后重导：

```text
$ node C:/Users/parking/.agents/skills/workflow-interview/scripts/export-dossier.mjs --issue-dir <上述目录>
{"ok":true,…}
```

人工核对（无自动 diff，逐处可观察结果）：
- Q1 两轮 → 一条生命周期线（⏸暂缓→↻重发→选 B→已关闭）
- 默认区 5 条中 3 条 →「默认生效」；gate.full 条 →「默认生效→翻案」；悬空四条中尚未表态者 →「悬而未决」（仅 ask 语义条目）
- 对照物确认行 →「已确认」（不再显示未回答）
- 「尚未回答」字样仅出现在真正无回应的 ask 条目（当前数据集中为零或极少）

## 场景 4：既有用法必须原样可跑

旧形态 rounds 行（无 user 字段、verbatim 无 choice）在新代码下落盘与导出均不报错；`session.mjs round` 收到带 `user_choice:"defer"` 的新行按场景 1 放行。
