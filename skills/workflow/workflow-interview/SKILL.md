---
name: workflow-interview
description: 显式选择需求访谈与契约交接时使用。查清目标、授权和验收，按任务需要组合调查、对照物与提问；不实现契约中的产品目标。
---

# 需求访谈与契约交接

把用户的背景、想做成的样子和验收依据对齐，交付可独立执行的契约；不实现契约中的产品目标。

调查、对照物和提问按需要组合，复用已知事实与授权。只把会改变目标、授权或验收的重要分歧交给用户；实现选择由 Agent 判断。

- aes-interview：查清事实与目标。
- aes-prototype：用具体表达暴露误解；已有材料够用时不另制。
- aes-goal-contract：记录目标、边界、AC 和验证依据。

三者是职责，不是固定三轮。AC 补充目标，不扩成通用 QA 清单；验证按证据价值、实际影响和总时间成本选择。

## 记录与交接

用 `scripts/session.mjs init` 建立任务；续跑先读 manifest、当前契约和相关决定。契约保存在 `3-contract/contract.md`。命令、问答格式与恢复见 [session.md](references/session.md)。

manifest 与问答只经脚本写入。记录重要决定及依据，不为流程补材料、问题或自评分。

契约经 `finalize` 校验后，已有授权足以执行时声明 `3-contract done` 并交接。机器校验不代表用户确认或产品完成。

保留旧任务已确认约束及历史。改变目标或验收含义时对齐受影响部分；契约或 candidate 变化后，按既有摘要、SHA 与回执规则复验。

收尾给出契约路径、证据结论、重要未决项和交接指令。未执行、未证明或待人验的部分如实保留。

需要提问时参考 [asking.md](references/asking.md)；用户选择 Web 时用 workflow-interview-web。
