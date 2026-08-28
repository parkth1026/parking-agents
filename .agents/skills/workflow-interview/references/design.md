# workflow-interview 设计依据

## 意图与触发场景

三阶段需求缔约的编排器：访谈锁需求、原型锁对照物、契约锁验收，全程决定下一步进哪个
阶段、卡住时退回哪里。由用户或上游编排显式选择，不靠只言片语触发。自己不产出文件，
各阶段产物的定义都在产出它们的子技能里。

## 设计取舍

- **只锁「做什么 / 怎么算做完」**：中间怎么实现交给执行 Agent；这两个点定偏了，中间
  质量救不回来。
- **状态机单一真源**：`manifest.json` / `rounds.jsonl` 只由 `session.mjs` 写；`done`
  不是自报的，结构闸门当场强制，质量仍归自评与用户确认。
- **结构化问法属于家族（#146）**：`response` 字段（九种应答类型）是 `rounds.jsonl`
  的一等字段；`pct` 与 100±2 加和只在单选语义强制——多选的选项是候选集合不是概率，
  硬卡加和只会逼人编数字。schema 与 Web 载体发布协议同源，映射无需变形。
- **决策档案是核心逻辑（#146）**：`export-dossier.mjs` 从家族真源（任务原文、轮次、
  契约）重投影出自包含 HTML；投影库（`scripts/lib/dossier.mjs`）两载体共用一份实现，
  纯对话访谈产出与 Web 版同构的档案，Web 侧只多提交事件证据（ledger）。
- **简单不是跳过访谈的理由**：再简单的需求也留下问答、取舍与残留风险记录。

## 验收条件

| 编号 | 验收条件 |
| --- | --- |
| AC-1 | 三阶段结构闸门缺件拒收 `done`；`skipped` 仅 2-prototype 可用且必须带 reason，`finalize` 与残留风险对账 |
| AC-2 | `rounds.jsonl` 行先过 schema 再追加；`ask` 行必带 `question`，单选语义 `pct` 加和 100±2 |
| AC-3 | 非单选结构化行（如 `multi_select`）无 `pct` 可落盘；`min`/`max` 别名写入时正规化为 `min_selections`/`max_selections`，冲突拒收 |
| AC-4 | 无 `web/` 目录时 `export-dossier.mjs` 仍能从 rounds/manifest/contract 导出自包含档案，含完整轨迹、候选优劣势、用户决定、契约原文与 digest，且不创建 `web/` |
| AC-5 | `finalize` 拦契约外路径、非 `[A]` 档盲区、残留风险与契约对不上账、交接指令超长 |

## 迭代记录

| 日期 | 改动 | 备注 |
| --- | --- | --- |
| 2026-08-29 | `response` 结构化类型下沉家族 round schema（pct 仅单选强制、别名正规化）；决策档案投影库家族化，新增 `export-dossier.mjs` CLI 与根部 `run-tests.mjs`——两载体产出同构档案（#146） | 回归 session 71/71、export-dossier 13/13；用户裁决：两技能只应有载体差异，档案算核心逻辑 |
