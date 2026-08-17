# 影响面: 2026-08-13-mid-flight-requirement-change

判据：改完之后，这个「三阶段访谈编排器」在哪些地方跑起来不一样了？

范围已经在 1-interview 收口：不新增 CLI 命令、不新增 `stage_gates` 状态值，机制上
`session.mjs` 已经允许在 `3-contract done` 之后继续编辑 `contract.md`、重跑
`finalize`、重跑 `stage 3-contract done`。这次改动是把这条已存在的路径**写清楚、
写成一条被承认的支持路径**，并加一条回归测试证明它确实不受拒收，同时明确一条边界
规则：追加内容涉及界面/行为差异时仍然走（更重的）`needs_reinterview`，不发明新的
中间态。

## 用户可见界面

无。`workflow-interview`/`aes-goal-contract`/`session.mjs` 都没有图形界面，这次改动
是文档 + 一条测试用例，不涉及任何人眼可见的界面元素。

## 可观察行为

有，但很小：`aes-goal-contract/SKILL.md`「落盘」一节新增一小节，明确写出「3-contract
契约还没 done 之前想追加一条新 AC，该怎么做」的具体步骤，以及「什么情况下这条追加
算作材料歧义、要走 needs_reinterview」的判据。`workflow-interview/SKILL.md`「回退」
一节加一句话，指向这条新说明，避免执行者以为除了 `needs_reinterview` 就没有别的路。

`session.mjs` 本身的命令行为**不变**——没有新增子命令、没有新增 flag，这是本次改动
唯一要向用户确认的关键点，因为它决定了这次改动有没有代码层面的风险。

见 `behavior.md`。

## 可运行输出

有：`session.test.mjs` 新增一条回归用例，跑一遍「编辑 contract.md 追加一条 AC →
重跑 finalize → 重跑 stage 3-contract done」，断言全程退出码为 0、`manifest.json`
的 AC 计数与 `validation.status` 正确更新；再跑一遍「追加 AC 但不重跑 finalize 就
直接 stage done」，断言仍然按现有闸门规则被拒收（mtime 检查生效）。这两条终端输出
序列写进 `example-run.md`。

## 对外接口报文

无。`session.mjs` 不提供网络接口，不涉及请求/响应报文结构。

## 用户配置

无。不新增命令行参数、环境变量或配置文件字段——这是 1-interview 阶段用户明确要求
的边界（不要新命令/新子系统）。

## 历史兼容性

有需要确认的点：现有 issue 目录（已经跑过 `1-interview`/`2-prototype`/`3-contract`
`done` 的旧记录）不能因为这次改动受影响。`session.mjs` 代码本身零改动，`rebuild`、
`list`、`verify` 等既有命令的行为保持逐字节不变；新增测试用例只是新增断言，不改
已有断言。这条不出对照物，写进 `behavior.md` 的「不变清单」。
