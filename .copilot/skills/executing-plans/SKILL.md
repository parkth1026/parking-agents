---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# 执行计划

## 概述

加载计划，批判性审查，执行所有任务，完成后报告。

**启动时声明：** "我正在使用 executing-plans skill 来实施此计划。"

**注意：** 如果 subagent 可用，推荐使用 subagent-driven-development skill（读取 `.copilot/skills/subagent-driven-development/SKILL.md`）代替本 skill，以获得更高质量的输出。

## 流程

### 步骤 1：加载并审查计划
1. 读取计划文件
2. 批判性审查——识别计划中的任何问题或疑虑
3. 如有疑虑：在开始前向用户提出
4. 如无疑虑：创建 `manage_todo_list` 任务列表并继续

### 步骤 2：执行任务

对每个任务：
1. 标记为 in_progress
2. 严格按步骤执行（计划已拆分为细粒度步骤）
3. 按要求运行验证
4. 标记为 completed

### 步骤 3：完成开发

所有任务完成并验证后：
- 声明："我正在使用 finishing-a-development-branch skill 来完成此工作。"
- **必需子 skill：** 读取 `.copilot/skills/finishing-a-development-branch/SKILL.md` 并遵循其流程
- 按该 skill 验证测试、展示选项、执行选择

## 何时停止并寻求帮助

**立即停止执行：**
- 遇到阻塞（缺少依赖、测试失败、指令不清）
- 计划存在关键缺陷无法开始
- 不理解某条指令
- 验证反复失败

**遇到不确定时请求澄清，不要猜测。**

## 何时回到之前的步骤

**回到审查（步骤 1）：**
- 用户根据反馈更新了计划
- 需要重新思考基本方法

**不要强行突破阻塞** ——停下来询问。

## 要点
- 先批判性审查计划
- 严格按计划步骤执行
- 不跳过验证
- 在计划要求时引用相关 skill
- 遇到阻塞时停止，不猜测
- 未经用户明确同意，不在 main/master 分支上开始实现

## 集成

**必需的工作流 skill：**
- **using-git-worktrees**（读取 `.copilot/skills/using-git-worktrees/SKILL.md`）——确保隔离工作区
- **writing-plans**（读取 `.copilot/skills/writing-plans/SKILL.md`）——创建本 skill 执行的计划
- **finishing-a-development-branch**（读取 `.copilot/skills/finishing-a-development-branch/SKILL.md`）——所有任务完成后收尾
