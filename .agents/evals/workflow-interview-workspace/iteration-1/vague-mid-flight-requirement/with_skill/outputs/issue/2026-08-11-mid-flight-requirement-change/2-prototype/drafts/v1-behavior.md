<!-- draft v1 | published 2026-08-11T00:00:00Z
     用户意见：（待收集）
     状态：draft -->

# 行为对照表: 2026-08-11-mid-flight-requirement-change

**草稿 v1，未确认。**

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | 对照物已确认，进了 `3-contract` 提问区，用户在契约还没 `finalize`/未定稿时提出想追加一条新的验收条件（不涉及改目标、边界或已确认对照物） | SKILL.md 没有点名这种情况，执行者容易把它和"材料歧义"混淆，猜测该不该报 `needs_reinterview` 整体回退到 `1-interview` 重新走一遍访谈 | `aes-goal-contract/SKILL.md` 明确写出：这属于"逐条带候选，批量提问"提问区里的追加一轮，直接在当前一轮追加候选/AC 继续问即可，**不触发 `needs_reinterview`，不回退** |
| 2 | 用户提出的新增内容其实是要改已确认的对照物（如 mock.html）或改目标/边界本身 | 现状：这属于材料歧义，报 `needs_reinterview`，回 `1-interview` | 不变：仍然报 `needs_reinterview`，回 `1-interview`。`workflow-interview/SKILL.md` 新增一句判据文字，帮助执行者区分"只是追加一条独立 AC"（走变化行 1）和"改已有对照物/目标/边界"（走这一行），但触发条件和落点都不变 |
| 3 | 契约已经 `finalize` 通过（`status=ready`）之后，用户才想追加一条验收条件 | 现状：`aes-goal-contract/SKILL.md:147-149` 已写"这次要动的是现有验收标准还是一件新的事……都回原契约重做"——回原 issue 编辑 `contract.md`，重新跑 `finalize` | 不变：路径本身不变；新增文字明确点名"这也是`中途改需求`的一种，不必新开 issue、不必回 `1-interview`"，减少执行者误判的概率 |
| 4 | 新增的验收条件涉及界面/行为的可观察差异 | `aes-prototype` 六面影响面门禁已覆盖此判断 | 不变：仍按现有六面门禁自行判断要不要重出对照物，纯文字性质的新增条件（如补一句边界说明）不需要重出对照物。本次不改 `aes-prototype/SKILL.md` |

## 不变清单

- `needs_reinterview` 的触发条件与效果（`session.mjs` 把 `stage` 写死回
  `STAGES[0]`）完全不变——这次不新增任何"部分回退"或"回退到中间阶段"的能力。
- `session.mjs` 的 `STATUSES`、`STAGES`、所有子命令（`init/round/stage/verify/
  rebuild/finalize/list`）签名和行为完全不变，不新增子命令、不新增 status 值。
- `rounds.jsonl`、`manifest.json` 的 schema 完全不变，不新增字段。
- `aes-prototype/SKILL.md` 的六面影响面门禁规则不变，不新增强制步骤。
- "改已确认对照物内容"或"改目标/边界"这两类场景，处理路径（材料歧义 →
  `needs_reinterview` → 回 `1-interview`）完全不变。
- 现有依赖这套编排脚本的其它 issue（例如仓库里已经跑过的其它 `.aes-workflow/
  grilling/*` issue）不受本次改动影响，因为不改代码只改文档说明。

## 配置差异

（无变化，整节省略）
