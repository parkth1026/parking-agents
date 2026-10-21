---
name: aes-issue-worker
description: 单 owner session 内把一张 typed IssueWorkOrder 跑成 typed 终局——tdd/diagnosing-bugs 实现 ⇄ aes-qa 循环验证，必要清理后单次 candidate commit，READY_TO_MERGE terminal 进 registry；code-review 与 merge 归 aes-merge-worker，不 merge、不写 GitHub、不自行挑 Issue。仅当用户点名 aes-issue-worker 或明确要求认领某张工单时使用。
---

# AES Issue Worker

在一个 owner session 内完成总管派发的工单，向 registry 回报；不自行挑 Issue、写 GitHub 或合并 integration。

接单先按 [工单与回报协议](references/protocol.md) 核对工作树、baseCommit、授权、AC 和来源；旧已存工单不自动迁移。

理解背景、目标、范围和必要例子，不只读 AC。实现方法按 workflowRole 选择，验证围绕目标、实际影响和总时间成本；旧任务已确认要求、人工门和证据绑定继续有效。

## 闭环

实现与独立 aes-qa 循环收敛，必要时 simplify；happy path 只生成一个 candidate commit，再由 aes-qa 最终轮绑定 SHA 出具回执，回报 READY_TO_MERGE。

QA 读取用户目标与契约依据，隔离实现者自证。AC 全绿却已观察到目标未达成时，按目标依据修复，不追加未授权目标。

READY 不等于已合并。review、merge 和既定集成门禁归 merge-worker；被打回后在原 owner 修复，按新 candidate 重验。预算、失败分类及终局字段见工单协议。

## 边界与恢复

不清理或覆盖用户现场，不自行放宽验收，不代答人工。未完成、权限不足或预算耗尽时如实回报相应 typed 状态，不制造通过。

当前已确认目标、范围或约束内的问题在本 job 处理；独立新问题经 DISCOVERED_WORK 回总管。契约外行为按既有协议披露，不静默扩面。

中断优先恢复原 owner；确需新 attempt 时保留历史并重新绑定证据。
