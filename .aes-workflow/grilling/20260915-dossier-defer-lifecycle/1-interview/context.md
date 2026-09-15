# Context Snapshot: 20260915-dossier-defer-lifecycle

- 创建：2026-09-15（宿主直接调查——全部事实来自上一轮对 issue149 会话 dossier 失真的完整追溯）
- 分片来源：无，宿主直接调查

## 任务陈述

用户原话：「[$workflow-interview] 如果要解决这个问题 应该怎么做」（「这个问题」= 前一轮确认的 dossier 轨迹记录/显示三层缺陷，此前用户原话：「如果 不好选 再深度调研这种情况 如果再 dossier 里显示未选择 好奇怪啊。。。有什么更合理的记录或者显示方法？」）

## 用户提出的方案

已认可方向（前一轮提案，用户以调用 workflow-interview 回应=走流程落地）：① ask 行补第四态 defer；② 同 q_id 跨轮生命周期聚合 + triggered_by 连线；③ 条目四态显示（已答/暂缓/悬而未决/机制性默认）。

## 意图假设

决策档案（dossier）的 trajectory 视图要如实反映用户真实的决策行为：用户每次被提问都回应了，但「暂缓型回应」（要求补充证据再答）与「机制性默认」（不反对就算定）当前被渲染成与「未回答」混淆的形态——修复后，用户打开 dossier 看到的应是决策的连续生命周期，而非充满假阴性的「未回答」墙。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 渲染器 `answerSummary`：无答案一律返回「尚未回答」，不分 tier | `C:/Users/parking/.agents/skills/workflow-interview/scripts/lib/dossier.mjs:498-499` | Fact |
| default/confirm 行只有 `row.user !== undefined` 才产生答案；约定值 `'未反对'`→accept、`'确认'`→confirm、**其他任意文本→veto**（长文本必被渲染成翻案） | `dossier.mjs:174-177` | Fact |
| ask 行：无 choice 有 verbatim → custom 答案（defer 型回应被伪装成自由答案，问题实际仍开放） | `dossier.mjs:162-164` | Fact |
| 渲染器已有 `openAmbiguities` 统计排除 default 行（统计层分了、卡片层没分） | `dossier.mjs:181-185` | Fact |
| 轨迹按 `stage#round` 分组，同 q_id 跨轮的连续性、`triggered_by` 因果均未渲染 | `dossier.mjs:136-146` | Fact |
| aes-interview SKILL.md 字段表列了 default 行 `user` 字段，但无落盘时机、无约定枚举值、无缺席后果说明——约定只存在于渲染器代码 | `C:/Users/parking/.agents/skills/aes-interview/SKILL.md`（rounds.jsonl 字段表） | Fact |
| session.mjs round 校验只强制 default 行带 `item`、ask 行带 question+options pct——允许落「永远显示未回答」的行 | session.mjs（round 命令校验逻辑） | Fact |
| rounds.jsonl schema 已有 `triggered_by` 字段（回流传导位）、`user_verbatim`、`response`（九种类型）；defer 不在九种内 | aes-interview SKILL.md 字段表 | Fact |
| 测试基建存在：`export-dossier.test.mjs`、`session.test.mjs`（与实现同目录，node 直跑） | `C:/Users/parking/.agents/skills/workflow-interview/scripts/` | Fact |
| 实证案例：issue149 会话 13 行记录中 9 行渲染异常构成（6 行 default 无 user、1 行回答入描述、1 行补录长文本被渲染为 veto、1 行 verbatim 伪装 custom）；27 处「尚未回答」 | `AntHub-dev3/.aes-workflow/grilling/20260914-issue149-stage-gate-anchor-reconciliation/1-interview/rounds.jsonl` + dossier.html | Fact |
| 改动对象在用户本机全局 skill 目录（~/.agents/skills/），跨出 AntHub 仓库边界 | 路径事实 | Fact |
| aes-* 家族可能存在同构投影实现（skill 自述「与 workflow-interview-web 共用同一投影实现」）——web 载体共享 dossier.mjs，改一处双生效 | workflow-interview SKILL.md 终态报告节 | Fact |

## 验证基建候选池

- `node export-dossier.test.mjs` / `node session.test.mjs`（现成单测，改动后回归）——代价：低，但需先确认测试对现有行为的锁定范围
- 真实数据回放：用 issue149 会话的 rounds.jsonl（含 defer/翻案/补录全部形态）作黄金输入重导 dossier，人工核对渲染——代价：中，无自动 diff 基建
- 新增单测：四态渲染、defer 类型、q_id 聚合各补测试例——代价：中

## 术语冲突

无。

## 四分类

- **Fact**：上表全部（渲染器行为、schema 缺口、文档缺口、测试基建、实证案例）
- **User decision**：范围（三层全改 vs 只改渲染）、defer 的 schema 形态（`user_choice:"defer"` vs 独立字段）、向后兼容策略（历史 rounds 是否重写）、是否同步修 aes-interview 文档与 session.mjs 校验警告
- **Agent-owned**：渲染实现细节（四态样式、连线画法）、测试用例设计、mock 制作
- **Blocked**：无

## 决定边界未知项

- defer schema 形态是否要向 workflow-interview-web 的发布 schema 对齐（跨 skill 边界）——归 User decision 还是查 web skill 后定 Agent-owned，待分诊

## 未知项

无。
