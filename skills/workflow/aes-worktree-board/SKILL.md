---
name: aes-worktree-board
description: 主仓 worktree 编排总管——采集全仓 Issue Map 与队员坐标，Desktop create_thread 派发可见 Task，以 registry/inbox/三维 verdict/熔断/全局停止协议恢复与审计执行，启动需求星图看板；含受门禁保护的合并。仅当用户点名 aes-worktree-board 或明确要求启动看板/恢复编排时使用。
---

# AES Worktree Board

基于目标仓的 Git、Issue 和 registry 事实恢复并编排既有 worker，显示同一事实的看板。脚本负责采集、登记、锁和校验，不模拟宿主生命周期。

先明确目标仓和当前 runtime；registry 是控制面真源，快照只用于展示。恢复时先消费 pending 事件，再按可推进状态行动。

## 按当前操作读取

- 巡检、Desktop Task 派发、事件消费、全局停止或看板：读 [Desktop 编排操作](references/desktop-orchestration.md) 的相关章节。
- v4 工单、runner、merge gate、outbox 或中断恢复：查 [工单控制面](references/control-plane.md) 的相应章节。
- 修改或升级本技能：读 [验证入口](references/verification.md)；设计依据见 [design.md](references/design.md)。

## 核心边界

- 只使用属于目标仓的既有 worktree；不创建、删除、清理或覆盖用户现场。dirty 授权不能越过 writer 租约。
- 正常派发使用可见 Desktop Task；CLI fallback 需要已有明确授权。遵守该模式已有模型路由、事件幂等和 BLOCK 熔断协议。
- 只有用户明确要求持续编排时才启动 Goal；巡检或打开看板不自动变成长任务。
- 证据绑定当前目标、契约和 candidate。NOT_RUN 不写 PASS，人验不代答；旧任务的确认约束与记录保留。
- v4 总管不合并；merge-worker 经独立 review 和既定门禁串行合并。恢复是否已合并要查 Git，不只看状态位。
- 身份和目标仓不明确时不操作远端；不切换全局账号，不把凭据写入 prompt、配置或记录。

工单和验证围绕用户期望结果。已有集成门禁继续有效，不把它们复制成每项任务的新 AC。
