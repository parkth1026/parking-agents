---
name: aes-goal-contract
description: 锁定验收——把已知目标与具体例子整理成可执行契约，解决真正未定的口径，校验后交接。仅当用户点名 aes-goal-contract 或明确要求锁定验收/出 Goal Contract 时使用。
---

# 锁定验收

把原始背景、本次想做成的样子、范围与约束整理成可执行契约。实现路径留给执行 Agent。

AC 用有区分力的预期结果补充目标，并覆盖本次变化可能破坏的重要承诺和成立前提；Verify 说明判断依据。不要把易测指标或通用 QA 清单当成目标。

按证据价值、实际影响和准备、执行、诊断、维护的总时间成本选择验证。复用有效证据；现成全量套件也可能更经济，不逐项新造测试或评分。

已有证据足够就停止重复验证；重要疑点未解决时调查或说明未证明部分。AC 全绿不能覆盖已观察到的目标偏差，也不能借目标追加未授权义务。

旧任务已确认的结果、Verify、人工决定权和仓库门禁继续有效。改变验收含义需要相应授权，不通过改门槛、隐藏失败或使用失效证据制造通过。

## 落盘与交接

契约存入 `<issue>/3-contract/contract.md`。目标、范围、强约束和验收条件保持现有机器入口；必要依据可内联或引用可访问材料。

用 `session.mjs finalize <issue>` 检查结构、命令入口和交接条件；通过只证明机器检查完成，不证明目标达成或用户已确认。已有授权足够时声明 `3-contract done`，输出交接指令及尚未证明部分。

- 起草契约：[形态与兼容格式](references/goal-contract-shape.md)、[示例](references/goal-contract-example.md)。
- 交给执行者：[交接模板](references/handoff-prompt.md)。
- 操作任务记录：[session.md](../workflow-interview/references/session.md)。
