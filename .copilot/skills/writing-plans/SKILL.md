---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# 编写计划

## 概述

编写全面的实施计划，假设工程师对我们的代码库零上下文且品味存疑。记录他们需要知道的一切：每个任务要触碰哪些文件、代码、测试、可能需要检查的文档、如何测试。将完整计划拆分为细粒度任务。DRY、YAGNI、TDD、频繁提交。

假设他们是熟练的开发者，但对我们的工具集和问题域几乎一无所知。假设他们不太了解良好的测试设计。

**启动时声明：** "我正在使用 writing-plans skill 来创建实施计划。"

**上下文：** 如果在隔离的 worktree 中工作，它应该在执行时通过 using-git-worktrees skill（读取 .copilot/skills/using-git-worktrees/SKILL.md）创建。

**计划保存路径：** docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md
- （用户对计划位置的偏好覆盖此默认值）

## 范围检查

如果规格覆盖多个独立子系统，应该在 brainstorming 阶段被拆分为子项目规格。如果没有，建议拆分为单独的计划——每个子系统一个。每个计划应独立产出可工作、可测试的软件。

## 文件结构

在定义任务之前，先列出将要创建或修改的文件及其各自的职责。分解决策在此锁定。

- 设计边界清晰、接口定义明确的单元。每个文件应有一个清晰的职责。
- 你对可以一次性放入上下文的代码推理最好，文件聚焦时编辑更可靠。偏好更小、更聚焦的文件而非做太多事的大文件。
- 一起变更的文件应放在一起。按职责拆分，而非按技术层拆分。
- 在现有代码库中，遵循已有模式。如果代码库使用大文件，不要单方面重构——但如果你修改的文件已膨胀得难以管理，在计划中包含拆分是合理的。

此结构决定任务分解。每个任务应产出独立有意义的自包含变更。

## 细粒度任务粒度

**每步是一个动作（2-5 分钟）：**
- "编写失败的测试" ——步骤
- "运行它确保失败" ——步骤
- "实现使测试通过的最小代码" ——步骤
- "运行测试确保通过" ——步骤
- "提交" ——步骤

## 计划文档头部

**每个计划必须以此头部开始：**

``markdown
# [功能名称] 实施计划

> **For agentic workers:** 必需子 skill：使用 subagent-driven-development（推荐，读取 .copilot/skills/subagent-driven-development/SKILL.md）或 executing-plans（读取 .copilot/skills/executing-plans/SKILL.md）逐任务实施此计划。步骤使用 checkbox (- [ ]) 语法跟踪。

**目标：** [一句话描述构建什么]

**架构：** [2-3 句话描述方法]

**技术栈：** [关键技术/库]

---
``

## 任务结构

``markdown
### Task N: [组件名称]

**文件：**
- 创建: xact/path/to/file.py
- 修改: xact/path/to/existing.py:123-145
- 测试: 	ests/exact/path/to/test.py

- [ ] **步骤 1: 编写失败的测试**

`python
def test_specific_behavior():
    result = function(input)
    assert result == expected
`

- [ ] **步骤 2: 运行测试验证失败**

运行: pytest tests/path/test.py::test_name -v
期望: FAIL，报 "function not defined"

- [ ] **步骤 3: 编写最小实现**

`python
def function(input):
    return expected
`

- [ ] **步骤 4: 运行测试验证通过**

运行: pytest tests/path/test.py::test_name -v
期望: PASS

- [ ] **步骤 5: 提交**

`ash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
`
``

## 禁止占位符

每步必须包含工程师实际需要的内容。以下是**计划缺陷**——永远不要写：
- "TBD"、"TODO"、"后续实现"、"填充细节"
- "添加适当的错误处理" / "添加验证" / "处理边界情况"
- "为上述编写测试"（不含实际测试代码）
- "类似 Task N"（重复代码——工程师可能不按顺序阅读任务）
- 描述做什么但不展示如何做的步骤（代码步骤需要代码块）
- 引用未在任何任务中定义的类型、函数或方法

## 要点
- 始终使用精确文件路径
- 每步包含完整代码——如果步骤改变代码，展示代码
- 精确命令与预期输出
- DRY、YAGNI、TDD、频繁提交

## 自审

编写完整计划后，用新鲜的眼光看规格并对照检查。这是你自己运行的检查清单——不是 subagent 分派。

**1. 规格覆盖：** 浏览规格中每个章节/需求。能指向实现它的任务吗？列出任何缺口。

**2. 占位符扫描：** 搜索计划中的危险信号——上面"禁止占位符"部分的任何模式。修复它们。

**3. 类型一致性：** 在后续任务中使用的类型、方法签名和属性名是否与前面任务中定义的一致？在 Task 3 中叫 clearLayers() 但在 Task 7 中叫 clearFullLayers() 就是 bug。

如发现问题，内联修复。无需重新审查——修复后继续。如发现规格需求无对应任务，添加任务。

## 执行交接

保存计划后，提供执行选择：

**"计划已完成并保存到 docs/superpowers/plans/<filename>.md。两种执行选项：**

**1. Subagent 驱动（推荐）** ——每个任务分派一个新 subagent，任务间审查，快速迭代

**2. 内联执行** ——在当前会话中使用 executing-plans 执行任务，带检查点的批量执行

**选择哪种？"**

**如果选择 Subagent 驱动：**
- **必需子 skill：** 读取 .copilot/skills/subagent-driven-development/SKILL.md
- 每任务新 subagent + 两阶段审查

**如果选择内联执行：**
- **必需子 skill：** 读取 .copilot/skills/executing-plans/SKILL.md
- 带检查点的批量执行
