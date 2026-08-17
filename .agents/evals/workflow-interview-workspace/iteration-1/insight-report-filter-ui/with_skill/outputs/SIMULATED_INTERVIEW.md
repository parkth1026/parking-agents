# SIMULATED_INTERVIEW.md

评测对象：`workflow-interview` 技能
触发请求（原话）：

> .copilot/agents/insight/generate-insight-report.js 生成的报告现在是一份很长的静态大页面，想加一个按 facet 筛选的下拉框，选了之后只显示对应 facet 的内容，不用整页翻。

用户人设：仓库维护者。核心诉求是加一个按 facet 筛选的下拉框，选了只看那个 facet，不用整页翻；单选、不记忆选择、每次打开默认看全部。两条只在被问到时才主动说的隐藏偏好：
1. 下拉框选项文案要用人话，不能用 `facets-schema.json` 里的内部 key。
2. 某 facet 当前没有数据时，选项要标"无数据"灰掉，或选中后明确提示"这个 facet 目前没有数据"，不能让界面看起来像坏了。

---

## 事实调查（触发技能前的准备工作）

在调用技能前，先读了以下文件了解现状：

- `.copilot/agents/insight/generate-insight-report.js`（3210 行）：单文件生成暗色主题静态 HTML 报告的 Node 脚本。报告里已经有大量 section（Token 消耗、工具使用热力图、时间分布、代码变更、异常检测、学习曲线等），用内联 `<style>` + 折叠面板（`.collapse-toggle`/`.collapse-content`）组织内容，已有一个 `.nav-toc` 侧边导航（左侧抽屉式，点击展开/收起），但没有任何按 facet 筛选、隐藏其他 section 的机制。所有 section 一次性渲染进同一个 HTML，用户目前只能靠滚动或侧边导航跳转查看。
- `.copilot/agents/insight/facets-schema.json`：定义 `SessionFacets` 的 JSON Schema。facet 是"每个会话由 LLM 分析产出的语义标注"，包含 `goalCategories`、`outcome`、`sessionType`、`userSatisfaction`、`claudeHelpfulness`、`frictionCounts`、`correctionEvents`、`turnAnalysis`、`conversationDynamics`、`aiFeedbackUtilization` 等字段——这些是**内部 key**（如 `feature_work`、`bug_fix`、`wrong_approach`），不是给最终读者看的文案。这一点后续如果被问到"下拉框文案用什么"，会成为回答依据。

这些事实观察记入我自己的笔记，用于回答技能后续可能提出的关于"现状是什么"的问题（若技能走到那一步）。

---

## 技能触发结果：在第一步即被硬阻断

调用方式（按任务要求，显式调用，不依赖自动触发）：

```
Skill(skill="workflow-interview", args="<上面的用户原话>")
```

返回结果（工具层面的错误，非技能内容）：

```
Skill workflow-interview cannot be used with Skill tool due to disable-model-invocation.
Ask the user to run /workflow-interview themselves — it cannot be invoked via Skill tool.
Do not replicate this skill's workflow by other means — it is reserved for explicit user invocation.
```

确认了 `.claude/skills/workflow-interview/SKILL.md` 的 frontmatter：

```yaml
name: workflow-interview
description: workflow-interview
disable-model-invocation: true
```

### 我的判断

评测任务的前提假设是："`disable-model-invocation: true` 只是不让它被自动触发，显式调用（用 Skill 工具点名）应该还能走通"。实测下来这个假设不成立：Claude Code 的 Skill 工具对 `disable-model-invocation: true` 的技能是**完全拒绝**从工具侧调用，不区分"自动触发"和"agent 显式点名调用"——只有真人在 CLI 里敲 `/workflow-interview` 斜杠命令才能启动它。工具的报错文本里还附带了一条明确的反规避指令："不要用其他方式复现这个技能的工作流"。

这是一条来自工具/系统层的硬限制，且明确写了"不要绕过"。按照我的操作准则，这类系统级 guardrail（尤其是带显式反规避条款的）优先级高于上游任务里的操作指令。所以我没有：

- 手动读取 `aes-interview` / `aes-prototype` / `aes-goal-contract` 三个子技能的 `SKILL.md`，然后自己扮演"编排器"把三阶段走一遍；
- 手动跑 `session.mjs init` 建 issue 目录（这本身就是技能编排的第一步，不是独立于技能之外的工具）；
- 用自由发挥的方式生成 mock.html / Goal Contract 来冒充技能的产物。

因为以上任何一种做法都精确落入工具明确禁止的"用其他方式复现这个技能的工作流"。

### 因此没有发生的事情

- 没有创建 `.aes-workflow/grilling/2026-08-11-insight-report-filter-ui/` 目录，也没有 `manifest.json`、`rounds.jsonl`。
- 没有进入 1-interview / 2-prototype / 3-contract 任何一个阶段。
- 没有向"用户人设"提出任何一轮问题，因此人设里那两条"被问到才说"的隐藏偏好（选项文案要人话化、无数据 facet 的呈现方式）**从未被问到，也就没有机会被说出来**——这是本次评测下人设行为的真实记录，不是遗漏。
- 没有 mock.html 或任何草稿版本产出。

---

## 结论

本次评测在"触发技能"这一步即告终止，是工具层面的硬阻断，不是技能内容或人设交互层面的问题。技能本身的三阶段编排逻辑、提问质量、mock 迭代处理方式均未被实际验证到。
