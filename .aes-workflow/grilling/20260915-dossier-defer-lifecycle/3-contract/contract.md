# Goal Contract: dossier trajectory 如实呈现决策生命周期——defer 四态 + q_id 聚合 + schema/文档缺口补齐

- Status: Ready
- Target: `C:/Users/parking/.agents/skills/workflow-interview/scripts/`（dossier.mjs、session.mjs、export-dossier.test.mjs、session.test.mjs）+ `C:/Users/parking/.agents/skills/aes-interview/SKILL.md`（跨出 AntHub 仓库，用户本机全局 skill）
- Updated: 2026-09-15

## 原始请求

> 如果 不好选 再深度调研这种情况 如果 再 dossier 里显示未选择 好奇怪啊。。。 有什么更合理的 记录或者显示方法？
>
> [$workflow-interview] 如果要解决这个问题 应该怎么做

## 目标

dossier 的 trajectory 视图如实反映用户真实决策行为：暂缓型回应（defer）不再伪装成答案或未回答、机制性默认与悬而未决分态显示、同一问题跨轮呈现为连续生命周期——「未回答」只剩真未回答。

## Why

- 现状三层缺口（2026-09-14 issue149 会话实证）：渲染器把 default 行机制性无反应渲染成「尚未回答」（27 处假阴性）；defer 型回应被伪装成 custom 答案；同 q_id 跨轮因果（triggered_by 已落盘）不被渲染。
- user 字段渲染约定（'未反对'/'确认'/翻案文本）只存在于渲染器代码，aes-interview 文档未记载——落盘方无从遵守。
- schema 校验允许落「永远显示未回答」的行，失真在源头持续产生。

## 范围

做：

- `dossier.mjs`：answerSummary 补 defer 分支与四态渲染（已答/⏸暂缓/悬而未决/默认生效·未记录反应）；`projectFamilyTrajectory` 按同 q_id 聚合生命周期线（triggered_by 因果标注、承接关闭、未承接计入 openAmbiguities、默认→翻案迁移展示）
- `session.mjs` round 校验：放行 `user_choice:"defer"`（必须带 user_verbatim，缺则拒收）；"defer" 为保留值，选项 key 撞名时 defer 语义优先并警告；default/confirm 行缺 user 字段发非阻断 stderr 警告
- `export-dossier.test.mjs` / `session.test.mjs`：新增用例只增不改既有断言
- `aes-interview/SKILL.md`：轮次记录字段表补 user 字段落盘时机、约定值（'未反对'/'确认'/翻案文本）与缺席后果；补 defer 落盘约定
- issue149 会话已闭环行补 user 状态（`#3` 翻案、`#7` 被选 B 追认、`#9` 原行确认、`#11` 自查闭环）——悬空四条不编造反应，保持悬而未决

不做：

- workflow-interview-web 载体的 UI 重构（共享投影实现一处改双生效，web 端仅 schema 消息同步）
- 历史轮次数据迁移或回溯改判（无 defer 标记的旧 verbatim 行维持 custom 渲染）
- 编排器状态文件写入路径、轮次卡片字段集、openAmbiguities 统计口径（本就排除 default 行）

## 强约束

- 轮次记录 append-only：只用 round 脚本写，不 Edit/Write 直改既有行
- pct 校验（单选语义 100±2）与 tier/stage/round 必填校验不变；defer 行不豁免 options 校验
- 既有测试用例语义不变（新用例只增）；既有 dossier 导出对旧数据幂等
- 确认版对照物不可修改：`../2-prototype/` 下四份——执行 Agent 改的是产品不是对照物
- q_id 生命周期聚合不得抹除轮次原始记录（聚合是投影视图，轮次记录原行不动）

## 自主边界

不用问，直接定：

- 四态样式与措辞细节、生命周期线画法（mock 已定方向，视觉细节自由）
- 新增测试用例命名与组织
- 警告文案措辞
- issue149 补状态行的具体 item/triggered_by 措辞

必须停下来问：

- 改 workflow-interview-web 载体源码（本票只动共享投影与 schema 消息）
- 删除或改语义既有测试断言
- 动编排器阶段状态写入逻辑

## 读什么

- `../2-prototype/mock.html` — 四态渲染与生命周期线目标形态（确认版）
- `../2-prototype/behavior.md` — 校验行为变化行、边界值、兼容表（确认版）
- `../2-prototype/api-mock.md` — defer 报文对与保留值约定（确认版）
- `../2-prototype/example-run.md` — 回归/新用例/黄金回放场景（确认版）
- `C:/Users/parking/.agents/skills/workflow-interview/scripts/lib/dossier.mjs` — answerSummary(:498)/projectFamilyTrajectory(:136) 两处改动点
- 黄金回放数据源路径见 `../2-prototype/example-run.md` 场景 3（issue149 会话，13 行全形态：defer 暂缓、6 行 default 缺 user、1 行补录长文本、门跑翻案）

## 验收条件

- AC-001: defer 类型可落盘可渲染——session.mjs 放行 `user_choice:"defer"`（缺 verbatim 拒收；选项 key 撞名 defer 优先+警告）；dossier 渲染为「⏸ 暂缓」，不再伪装 custom
  - Verify: [A] `grep -q defer "C:/Users/parking/.agents/skills/workflow-interview/scripts/export-dossier.test.mjs"` → 退出码 0；[A] `grep -q defer "C:/Users/parking/.agents/skills/workflow-interview/scripts/session.mjs"` → 退出码 0；[C] issue149 黄金回放（example-run 场景 3）：Q1 两轮聚合为「⏸暂缓→↻重发→选 B→已关闭」
- AC-002: default 行 user 约定渲染——'未反对'→默认生效、'确认'→已确认、长文本→翻案、字段缺席→「未记录反应」（诚实模糊态）；缺席落盘时 stderr 非阻断警告
  - Verify: [A] `grep -q 未记录反应 "C:/Users/parking/.agents/skills/workflow-interview/scripts/export-dossier.test.mjs"` → 退出码 0
- AC-003: q_id 生命周期聚合——同 q_id 跨轮聚合为生命周期线（triggered_by 标注、承接轮落答后关闭、未承接计入 openAmbiguities、默认→翻案迁移如实展示）
  - Verify: [A] `grep -q 生命周期 "C:/Users/parking/.agents/skills/workflow-interview/scripts/export-dossier.test.mjs"` → 退出码 0
- AC-004: 向后兼容不破坏——历史行不回溯改判（无 defer 标记的 verbatim 行维持 custom）、旧形态落盘与导出均不报错、既有测试用例语义不变
  - Verify: [A] `node "C:/Users/parking/.agents/skills/workflow-interview/scripts/export-dossier.test.mjs"` → 退出码 0；[A] `node "C:/Users/parking/.agents/skills/workflow-interview/scripts/session.test.mjs"` → 退出码 0（本条为不破坏类，改前改后均应绿）

## 挡着的事

- None.

## 残留风险

- 「未记录反应」与「悬而未决」的语义区分依赖落盘方补记 user 状态——若 agent 今后仍不补记，历史新行将持续停在模糊态（错了吗：dossier 仍有假阴性观感，但不再有假阴性误判——模糊态是诚实的）。
- web 载体（workflow-interview-web）的 schema 消息同步属后续动作，本票只保证共享投影实现兼容——若 web 端有独立 schema 副本未同步，defer 行在 web 端可能仍显示旧形态。

## 访谈记录

### 第 1 轮（1-interview）

| 问题 | 候选（带当时给的百分比） | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| Q1 修复范围 | A 全栈三层 55% / B 渲染+文档 30% / C 只改渲染 15% | A，只改渲染时 default 行无数据无法区分真默认与漏记 | A |
| Q2 defer schema 形态 | A user_choice:"defer" 62% / B 独立字段 25% / C response.type 13% | A，最小侵入且 web schema 同步成本最低 | A |

| 定了什么 | 档 | 为什么这么定 | 用户 |
| --- | --- | --- | --- |
| q_id 聚合+triggered_by 连线渲染 | 默认 | 用户核心诉求：决策是有生命周期的对象 | 未反对 |
| 验证走现成单测+issue149 黄金回放 | 默认 | 测试与实现同目录；真实数据全形态齐 | 未反对 |
| 历史行不重写、悬空四条不编 | 默认 | append-only 纪律；数据不能造 | 未反对 |
| web 载体联动：共享投影一处改双生效 | 默认 | skill 自述共用投影实现 | 未反对 |

### 第 2 轮（2-prototype）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| 四份对照物确认 | 确认锁定 / 有质疑点 | 确认 | 确认，锁定对照物 |

### 第 3 轮（3-contract）

| 问题 | 候选 | 推荐 | 用户选了 |
| --- | --- | --- | --- |
| AC-001..004 后果与途径 | 全部确认 / 有要改的 | 全部确认 | （本轮发出，见 Verify 与后果陈述） |

## 设计取舍

### D-1 defer 的 schema 形态

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A user_choice:"defer"（选定） | 复用现有字段位，verbatim 记原因，渲染器判保留值 | 语义借道 choice 字段 | 无 |
| B 独立 deferred 字段 | 结构化 {reason,ask} | schema/渲染/web 三处新认识 | 改动面大不匹配收益 |
| C response.type 第十种 | 与九种类型对齐 | response 当前是提问侧约束声明，回应侧复用易混 | 语义错位 |
| 什么都不做 | defer 伪装 custom | 「门还开着」被记录成「门已关」 | 实证失真 |

选定 A。理由：最小侵入打通落盘-校验-渲染-web 同步四点；"defer" 设为保留值防撞名。
落进契约的形态：`强约束` 写「defer 行不豁免 options 校验、必须带 verbatim」。

### D-2 修复范围

| 方案 | 怎么做 | 代价 | 为什么没选 |
| --- | --- | --- | --- |
| A 全栈三层+数据补齐（选定） | 渲染+schema 校验+文档+issue149 补状态 | 改 3 文件+2 测试 | 无 |
| B 渲染+文档 | 不动校验不补数据 | 失真源头仍在 | issue149 dossier 修不干净 |
| C 只改渲染 | 单文件 | default 行无数据，无法区分真默认与漏记 | 硬矛盾无解 |

选定 A。理由：显示层能力与数据层能力必须对齐，否则四态里两态无米之炊。
落进契约的形态：`范围` 全栈清单 + issue149 数据补齐（悬空四条除外）。
