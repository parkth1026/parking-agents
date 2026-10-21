---
name: workflow-interview-web
description: "workflow-interview 的本地 Web 交互与决策档案。仅当用户显式调用 $workflow-interview-web 或明确选择 Web 入口时使用；持久保存提交，人工续接，支持跨会话恢复与静态导出。"
compatibility: "需要同级安装 workflow-interview、aes-interview、aes-prototype 和 aes-goal-contract；Web 主路径需要 Node.js 与浏览器，但不需要保持模型 turn 等待。"
category: productivity
---

# Web 访谈入口

作为 workflow-interview 的交互与档案投影层，沿用其目标、授权和契约规则；不另造访谈流程。收到任务后调查并发布有价值的内容，不让用户重述。

按当前职责读取家族技能。首次运行和续跑按当前操作查阅 [web-protocol.md](references/web-protocol.md) 相应章节；需要修改页面或状态模型时再读 [design.md](references/design.md)。

- 发布 round 后核验状态，保持用户草稿；不要主动刷新页面。
- 提交先持久化再回执。HTTP 成功只证明 persisted，不等于 Agent 已吸收或用户已确认契约。
- 默认发布后结束当前模型回合。用户回当前会话说“请继续”后，先扫描未消化提交，取得当前 recovery payload，写入家族 round 成功后再标 consumed。
- 保留 revision/digest、幂等消费与恢复协议。不用模型轮询、后台等待器或 subagent 等待模拟自动唤醒。
- manifest 和 rounds 仍由家族脚本写；附件发布不修改确认版源文件。服务只绑定 loopback。

没有明确宿主续接能力就不承诺自动恢复。Node 或浏览器不可用时回到文本入口；目标、验收和旧任务约束不降级。
