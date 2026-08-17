# FINAL_REPORT.md — workflow-interview 技能评测（insight-report-filter-ui）

## 状态：BLOCKED（在触发阶段即被工具硬阻断，未进入任何编排阶段）

## 触发请求原话

> .copilot/agents/insight/generate-insight-report.js 生成的报告现在是一份很长的静态大页面，想加一个按 facet 筛选的下拉框，选了之后只显示对应 facet 的内容，不用整页翻。

## 契约路径

无。未创建 `.aes-workflow/grilling/2026-08-11-insight-report-filter-ui/` 或其下任何文件，因此没有 Goal Contract 产出。

## 目标一句话

未锁定（技能从未进入 1-interview 阶段，目标未经确认）。

## 范围

未锁定。

## 验收条件条数

0（3-contract 阶段从未运行）。

## finalize 的校验与冒烟结果

未运行，无结果。

## 交接指令原文

无。

---

## 卡在哪、为什么

**卡点：第一步——用 Skill 工具显式调用 `workflow-interview`。**

评测任务的前提是："`.claude/skills/workflow-interview/SKILL.md` frontmatter 里的 `disable-model-invocation: true` 只阻止自动触发，agent 用 Skill 工具点名显式调用应该还能走通"。实测证明这个前提不成立。

调用 `Skill(skill="workflow-interview", args="<触发请求原话>")` 后，工具直接返回错误，未加载 SKILL.md 内容、未执行任何步骤：

```
Skill workflow-interview cannot be used with Skill tool due to disable-model-invocation.
Ask the user to run /workflow-interview themselves — it cannot be invoked via Skill tool.
Do not replicate this skill's workflow by other means — it is reserved for explicit user invocation.
```

也就是说 Claude Code 的 Skill 工具对 `disable-model-invocation: true` 的技能一律拒绝调用，无论是自动触发还是 agent 点名调用；只有真人在交互式 CLI 里敲斜杠命令 `/workflow-interview` 才能启动。而且报错文本自带一条明确的反规避条款——"不要用其他方式复现这个技能的工作流"。

按操作准则，这种带显式反规避条款的系统级工具限制，优先级高于上游任务里"照着技能编排走完整三阶段"的指令。因此我没有：
- 手动读取三个子技能（`aes-interview`、`aes-prototype`、`aes-goal-contract`）的 SKILL.md 后自己充当编排器把三阶段跑一遍；
- 手动执行 `node .claude/skills/workflow-interview/scripts/session.mjs init ...` 建 issue 目录（这本身是技能编排流程的一部分，不是独立于技能之外的通用工具）；
- 自由发挥生成 mock.html / 逐轮问答 / Goal Contract 来冒充技能应有的产物。

以上任何一种都会精确落入工具明确禁止的"用其他方式复现工作流"。

### 附带说明：环境准备问题（不是卡点本身，但影响了排查过程）

评测所在的 worktree（`G:\GIT\AI_WorkFlow\parking-agents\.claude\worktrees\agent-a09fefc1dc944c33c`）最初的 `.claude/skills/` 目录下**没有** `workflow-interview`、`aes-interview`、`aes-prototype`、`aes-goal-contract` 这几个技能目录（只有主仓库检出 `G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\` 下才有），推测是这些技能目录被 gitignore 排除、worktree 创建时未同步未跟踪文件所致。为了能实际尝试调用技能，我把这四个目录从主仓库检出手动复制进了 worktree 的 `.claude/skills/` 下（`aes-goal-contract`、`aes-interview`、`aes-prototype`、`workflow-interview`）。这一步只是让 Skill 工具能找到并解析到 `workflow-interview`（进而才拿到上面那条精确的拒绝错误，而不是"skill not found"），不构成对技能工作流的替代执行。这些复制进来的目录目前仍留在 worktree 里（`git status` 显示为未跟踪文件，未提交）。

## 未发生的事情（如实记录）

- 未创建 issue 目录 `.aes-workflow/grilling/2026-08-11-insight-report-filter-ui/`，因此没有 `manifest.json`、`rounds.jsonl`、`2-prototype/mock.html` 或任何草稿版本可供复制。
- 未进行任何一轮向"用户人设"提问，因此人设脚本里那两条"只有被问到才主动说"的隐藏偏好（下拉框选项文案要人话化、无数据 facet 的呈现方式）从未被触发，也没有被说出来——这是本次运行下人设分支未被走到的真实情况，不是遗漏或跳过。
- 未生成任何 mock.html、行为对照表、接口报文对等 aes-prototype 阶段产物。

## 交出的产物清单

- `SIMULATED_INTERVIEW.md`：记录事实调查内容、技能触发过程、拒绝原文、以及不绕过限制的判断依据。
- 本文件 `FINAL_REPORT.md`。
- 无 issue 目录可复制（技能从未运行到创建它的那一步）。
