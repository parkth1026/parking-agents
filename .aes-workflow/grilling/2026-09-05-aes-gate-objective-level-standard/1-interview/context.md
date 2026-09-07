# Context Snapshot: 2026-09-05-aes-gate-objective-level-standard

- 创建：2026-09-05T00:00:00+08:00
- 分片来源：`facts/report-source.md`、`facts/current-aes-gate-and-repo-samples.md`

## 任务陈述

> 我认为 L几应该是客观的 标准，而不是排序。以后所有仓库都是统一的，应该写进 aes-gate 标准。
> 以后提到任何一个 L 都知道是什么强度，有共识。请你结合软件工程最佳实践来设计这个模式，
> 并且作为 aes-gate 技能标准。请你先深度调研与思考，然后我们开始 workflow-interview。

## 用户提出的方案

建立跨仓统一的 L 强度公共语言；L 不再是某仓脚本的执行顺序或历史层号，标准由 aes-gate 持有。

## 意图假设

真正目标是让人、agent、CI、QaReceipt 和 merge gate 对“通过了多强的验证”使用同一个可机械审计的
词汇，杜绝裸“gate PASS”与各仓 L3 含义不同。用户没有要求所有仓库运行完全相同的测试；统一的是
保证边界与证据 schema，仓库按产品形态映射具体 suites。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| 行业没有通用 L0-L5；AES 必须声明为组织标准 | `facts/report-source.md`，ISO/ISTQB/Google/Bazel | Fact |
| test level/type/size 是不同维度 | ISTQB CTFL 4.0.1、ISO 29119-1 | Fact |
| SLSA 已使用 Build L0-L3，裸 Lx 会碰撞 | SLSA v1.2 | Fact |
| 当前 aes-gate 没有 assurance level schema | `skills/workflow/aes-gate/` | Fact |
| 当前 aes-qa/GATE-qa 不强制仓库 gate 等级 | aes-qa SKILL、`merge-policy.mjs` | Fact |
| AntAgent 的 L3 随 HTTP 退役消失，证明旧 L 是实现顺序 | AntAgent #53 / `scripts/gate/gate.ps1` | Fact |
| 用户要求 L 是客观跨仓标准，不是排序 | 用户原话 | User decision（已定） |

## 验证基建候选池

- aes-gate `run-tests.mjs`：schema、collect、旧 registry 兼容与正反样例。
- aes-worktree-board `run-tests.mjs`：QaReceipt 新版本与 GATE-qa fail-closed。
- parking-agents `npm test`：发布/安装/技能发现回归。
- workflow-interview 三阶段结构校验与 finalize。
- 新建跨仓映射 fixtures 与 independent classification eval：验证同一 gate 在不同执行者下得到相同 L。

## 术语冲突

- ISO/ISTQB `test level` 与用户所说“强度 L”不完全同义；候选名为 `AES Gate Assurance Level`。
- SLSA `Build Lx` 与 AES Lx 冲突；候选规范要求全称 `AES-QG Lx`。
- 旧 aes-gate `G0` 是缺口编号，不是 L0，需要迁移编号域。
- quick/mid/full 是执行 profile；L0-L5 是保证边界，不能互相替代。

## 四分类

- **Fact**：行业术语、当前技能结构、跨仓现状、SLSA 命名碰撞、可用验证入口。
- **User decision**：命名强制性、公共命令面、L5 与发布资格关系、是否严格累计。
- **Agent-owned**：schema 文件布局、validator/helper 拆分、fixture 命名、内部实现语言。
- **Blocked**：无；当前只等待第一轮用户裁决。

## 决定边界未知项

- 已收口，无。

## 未知项

- 无会改变目标或边界的未知项；各仓迁移节奏是执行期排程，不改变分阶段迁移合同。

## 已确认裁决

1. 机器报文、日志、Issue、commit 的首次出现强制完整 `AES-QG Lx` namespace；裸 `Lx`
   只允许在紧邻已声明 AES-QG 上下文中使用。
2. 标准命令为 `gate.l0...gate.l5`；quick/mid/full 仅为可选 profile，必须声明 `targetLevel`。
3. `AES-QG L5 PASS` 不自动等于 release-qualified；发布资格由 required level、正交证据 profile
   与 candidate/artifact identity 共同裁决。
4. `achievedLevel=Lx` 必须在同一 candidate 上累计满足 L0..Lx；单个检查只声明
   `classifiedAt`，不能独立声称整体达到 Lx。
5. 仓库分别声明 `supported/required/achieved`；unsupported 不算失败，但不能跨过该级声称更高等级。
6. 新增版本化 `gate-policy.toml`，以 `run.toml` action id 为外键；不复制 argv。
7. 较低级证据仅在 candidate SHA、artifact digest、gate-definition digest、policy digest、
   environment identity 全匹配时允许复用；否则 `STALE_EVIDENCE`。
8. 现有仓分阶段迁移：先标 `legacy-unqualified` 并生成映射，再增加新 action/schema，最终裸
   `gate` fail closed；旧证据保留但不获得新 L 含义。
