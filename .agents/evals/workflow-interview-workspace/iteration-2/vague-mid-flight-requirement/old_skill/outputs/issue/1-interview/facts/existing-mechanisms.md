# Fact: workflow-interview 现有的「改需求」相关机制

- 派遣问题：仓库里已经有哪些机制处理「访谈中途需求变了」，它们的边界在哪、状态怎么转
- 完成：2026-08-13T00:00:00Z（宿主直接调查，未派 subagent）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| `needs_reinterview` 是目前唯一的「回退改需求」路径：子技能（`aes-prototype`/`aes-goal-contract`）撞出新歧义时报这个状态，编排器把 `manifest.stage` 强制打回 `1-interview` 并清空 `next_action` | `.claude/skills/workflow-interview/scripts/session.mjs:222-229` |
| `needs_reinterview` 的语义是「重新问」，不是「追加一条」——回退后要把 `1-interview` 的五个自评维度重新走到「已定」才能再往下 | `.claude/skills/aes-interview/SKILL.md:71-88` |
| `session.mjs stage` 命令本身不限制状态转换方向：任何 `<stage> <status>` 组合都能设，包括把已经是 `done` 的阶段重新设回 `in_progress`（没有守卫代码） | `.claude/skills/workflow-interview/scripts/session.mjs:188-242`（`cmdStage` 全函数，未见状态机校验） |
| `manifest.json` 没有任何字段记录「这份契约改过几次」「上一版长什么样」——`blankManifest()` 只有 `stage_gates`、`validation`、`residual_risk` 等字段，没有版本号或变更历史 | `.claude/skills/workflow-interview/scripts/session.mjs:89-111` |
| `aes-goal-contract` 的 `goal-contract-shape.md` 已经写明「任务已经存在时改它的契约文件，不新建」，判据是「这次要动的是现有验收标准，还是一件新的事」；AC 编号规则是「编号跟着那条 AC 走，删掉一条不补号」，暗示追加/修改本就被允许，只是没有专门给「中途」这个时点写流程 | `.claude/skills/aes-goal-contract/references/goal-contract-shape.md:11-13, 198-202` |
| `aes-goal-contract` 的正文第 2 步「逐条带候选，批量提问」本身就是迭代过程：契约在 `finalize` 之前允许反复改、反复问，不算「回退」 | `.claude/skills/aes-goal-contract/SKILL.md:50-121` |
| `aes-prototype` 已有六面影响面判断表（界面/行为/可运行输出/接口报文/用户配置/历史兼容性），用来决定新变化要不要出对照物；这套表没有专门给「3-contract 阶段追加一条 AC」这个场景写判断路径，但表本身的判据（有无可观察差异）可以直接套用 | `.claude/skills/aes-prototype/SKILL.md:33-49` |
| `finalize` 的「残留风险对账」会拿 `manifest.residual_risk` 和被跳过的阶段跟 `contract.md` 的「残留风险」节对账，对不上直接拒；这个机制目前只覆盖「访谈时主动跳过」，不覆盖「契约定稿后又改」 | `.claude/skills/workflow-interview/scripts/session.mjs:452-463` |
| `validate-goal-contract.mjs` 是仓库里唯一的契约结构校验器，任何改动 `contract.md` 之后都要重新跑它；它不区分「首次写」还是「追加改动」 | `.claude/skills/workflow-interview/scripts/validate-goal-contract.mjs`（通篇；无「改动来源」相关逻辑） |

## 未知项

- workflow-interview 编排器完全不掌握「执行 Agent 是否已经按交接指令开始跑」这件事——manifest 里没有字段能回答，`session.mjs` 也没有任何命令读取执行 Agent 的状态。这件事跨出仓库边界，读代码读不出来。

## 没查的

- codex `/goal` 侧（执行 Agent 拿到交接指令之后怎么消费它、能不能接收「契约变了」的通知）不在这个仓库里，超出调查范围。
