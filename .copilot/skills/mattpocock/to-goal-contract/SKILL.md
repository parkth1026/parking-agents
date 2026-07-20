---
name: to-goal-contract
description: 将已经确认的共享理解固化为仓库内可持久、可交接的 Goal Contract，包含可观察验收标准、完整验证矩阵、权限与升级边界，以及明确的完成和阻塞条件。用于设计访谈确认后的默认 handoff、跨会话执行前的目标固化，或用户明确要求 goal contract；不要用它继续访谈、编写实现 spec、拆票或直接实施。
---

# To Goal Contract

把已确认的目标转成执行代理可以独立判断“继续、升级、完成或阻塞”的持久契约。只做证据核对、契约合成、落盘和自检，不实施功能、不拆票、不提交。

## 前置门槛

仅在共享理解已经由用户明确确认，或用户直接提供了等价的完整目标边界时继续。至少需要：

- 期望的可观察结果；
- 范围与非目标；
- 必须保持的约束或兼容性；
- 可判定的成功证据；
- 用户与代理的决策边界。

缺少会改变目标契约的信息时，停止并指出唯一最关键的缺口；若来源是尚未完成的设计访谈，交回 `$grill-with-docs-plus`。不要自行补造用户决策，也不要重新进行完整访谈。

一个 Goal Contract 只能有一个可独立完成和判定的顶层 Outcome。先检查目标基数：

- 若存在多个已分别确认的独立顶层目标，分别生成独立契约，不得塞进同一份契约；
- 若目标边界尚不能可靠拆分，生成 `Status: Blocked` 的契约并把目标拆分决策写入解除条件；
- 若单一顶层 Outcome 包含多个可独立实施、验证或跨会话推进的功能切片，但尚无用户批准且 revision 可追溯的 spec，先停止契约生成，要求用户明确调用 `$to-spec`；
- 若已有用户批准且 revision 可追溯的 spec，并且它只有一个顶层 Outcome，即使包含多个实施切片也生成一份 Goal Contract，以 AC 和验证矩阵覆盖各切片；若 spec 包含多个独立顶层目标，仍须拆分契约。

## 取证与落盘

1. 读取目标路径适用的仓库规则、相关 `CONTEXT.md`、ADR、测试和当前行为。只核实会影响契约的事实。
2. 将对话中的已确认决策与仓库事实分开；冲突时明确记录冲突，不静默覆盖用户确认的目标。
3. 记录来源的可复现 revision（commit、issue/spec revision、文档版本或内容摘要哈希）以及用户批准共享理解的证据。缺少任一项时不得标记 `Ready`。
4. 优先采用仓库已有的 goal、plan 或 design 文档目录和命名约定。没有约定时写入 `docs/goal-contracts/<YYYY-MM-DD>-<short-slug>.md`。
5. 使用不会覆盖既有文件的短横线英文 slug。只有用户明确指定现有文件时才更新它。
6. 以用户当前语言编写，领域术语遵循 `CONTEXT.md`。在最终回复中报告绝对路径。

## Goal Contract 格式

严格输出以下结构。删除所有占位说明，不留下 `TODO`、`TBD` 或不可判定措辞。

```markdown
# Goal Contract: <可观察目标>

## Contract Metadata
- Status: Ready | Blocked
- Created: YYYY-MM-DD
- Source: <已确认的对话、issue 或文档>
- Source Revision: <commit、issue/spec revision、文档版本或内容摘要哈希>
- Approved By: <确认共享理解的用户或授权主体>
- Approved At: <可追溯时间或对话轮次>
- Target Scope: <仓库、模块或路径边界>

## Outcome
<从用户视角描述完成后可观察到的结果。>

## Scope
- In scope: ...
- Out of scope: ...

## Constraints and Preserved Behavior
- ...

## Accepted Assumptions
- <仍被接受、已说明风险且不阻塞执行的假设；没有则写 None。>

## Applicability and Execution Context
- Applies when: <契约有效的版本、配置和前置状态>
- Does not apply when: <必须重新确认或生成新契约的边界>
- Required environment: <运行时、平台、依赖或服务>
- Fixtures and test data: <来源、版本、隔离与重置要求>
- Cleanup: <验证后必须移除或恢复的产物与状态>
- Rollback: <实现或验证失败时恢复到已知状态的具体路径>

## Acceptance Criteria
- AC-01: <单一、可观察、可判定的结果>
- AC-02: ...

## Validation Matrix
| AC | Validation seam | Command or procedure | Environment / fixture | Expected observable evidence | Evidence artifact | Cleanup / rollback | Permission |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AC-01 | <尽可能高的行为边界> | `<已确认可用的命令>` | <环境与固定输入> | <明确通过条件> | <日志、报告、截图或测试结果> | <清理与失败恢复> | Pre-authorized / Ask first |

## Authority and Escalation
### Pre-authorized
- <为实现和验证目标可自动执行的低风险、可逆动作>

### Ask First
- <破坏性、不可逆、凭据受限、外部生产或实质扩范围动作>

### Forbidden or Out of Scope
- <即使有助于目标也不得执行的动作>

### Escalation Package
- Trigger: <何时必须升级给用户>
- Provide: <已尝试方法、原始错误、影响范围、最小决策问题>

## Completion Conditions
- <全部 AC 和验证证据必须满足的联合条件>
- <诊断、测试、构建、diff 审计和临时产物要求>

## Blocked Conditions
- <只有缺少权限、凭据、外部状态或关键事实时才成立的客观条件>
- <阻塞前必须尝试的安全替代路径与所需证据>

## Handoff
- Next action: <一个明确动作>
- Stop condition: Complete | Blocked under the conditions above
```

## 契约规则

- 每条 AC 只描述一个外部可观察结果，使用 `AC-01` 形式的稳定编号。
- 整份契约只能表达一个顶层 Outcome；出现并列且可独立完成的结果时必须拆分或阻塞。
- 验证矩阵必须覆盖每条 AC；一条 AC 可以有多种验证，但不得存在没有 AC 的孤立验证。
- 优先使用最高可行测试缝隙和现有命令。任何完成判定所必需的验证命令、环境或 fixture 未确认时，契约必须是 `Status: Blocked`；写明核实方法和解除条件，不能以“执行时核实”绕过。
- `Expected observable evidence` 必须能明确区分通过与失败；“工作正常”“测试通过”等无边界描述不合格。
- 权限边界必须针对当前目标具体化。默认预授权本地只读调查和低风险可逆编辑；破坏性、不可逆、凭据受限、外部生产或实质扩范围动作必须升级。
- `Status: Ready` 只表示契约足以开始执行，不表示工作已完成。它要求单一目标、来源 revision、批准证据、适用范围、环境、fixture、清理、回滚和所有必需验证命令均已确认；任一项待核实就使用 `Blocked` 并写明解除条件。
- 完成条件必须要求所有 AC 有新鲜证据、相关诊断和测试通过、没有调试残留，并审查最终 diff。
- 阻塞不能等同于困难、耗时、首次失败或接近上下文限制；必须是安全替代路径已用尽后的客观外部障碍。
- 不把实现方案细节写成验收结果，除非它是已确认的公共契约或兼容性约束。

## 自检与交付

落盘后重新读取文件并完成以下审计：

1. **单目标审计**：只有一个可独立完成的顶层 Outcome；多目标已经拆分；多切片已有批准且 revision 可追溯的 spec，否则已转交 `$to-spec`。
2. **覆盖审计**：每条 AC 至少映射一个验证行，且每个验证行引用有效 AC。
3. **Ready 审计**：来源 revision、批准证据、适用性、环境、fixture、清理、回滚和必需命令全部已确认；任何待核实项都强制 `Blocked`。
4. **判定审计**：每条 AC、通过证据、完成条件和阻塞条件都有明确红绿边界。
5. **权限审计**：预授权、需询问和禁止动作无冲突；升级触发器可执行。
6. **范围审计**：Outcome、Scope、非目标和约束与已确认共享理解一致。
7. **持久化审计**：文件位于仓库内、无占位符、链接和命令格式可读。

任一审计失败就修订后重读。最终只报告契约状态、绝对路径、AC 数量、验证行数量、覆盖结果和仍被接受的假设；不要开始实现。
