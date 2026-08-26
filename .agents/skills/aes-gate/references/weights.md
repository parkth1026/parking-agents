# 六维评分与档位规则（依据）

> 依据来源：`docs/research/gate-builder-skill-blueprint.md`（TOP-5 门禁调研的能力模型）、
> `docs/research/aes-gate-行业实践四路验证-2026-08-25.md`（修订②：权重与档位依据文档化——
> OpenSSF Scorecard 被批评的软肋正是权重赋值不透明，本文件就是透明化承诺）。
> 计分实现：`scripts/collect.mjs` 的 `scoreGates()`；本文件与代码同步演进，规则变了先改这里。

## 总原则

- **总分 110 = 30+20+15+20+15+10**，只是体检参考。
- **档位不看总分**：由「阻断强制性」维的保护结构直接决定（见下）——防止用低维堆分冒充高保护（Goodhart 防线）。
- **约定级不计分**：`conventions[]`（无机器断言）永不进任何维度。
- 每个加项都有机械检测规则（collect.mjs 内联），语义存疑的一律不加、留给 agent 复核补充（须带证据）。

## 档位（tier）规则

| 档位 | 条件（门的最高保护级别） | 含义 |
| --- | --- | --- |
| hard 硬门禁 | `ci-protected`：门被 CI required check 执行 **且** branch protection 已开（以 `.aes-gate/protection.json` 人工登记为准——branch protection 离线不可核实，宁保守） | 红代码进不了默认分支 |
| partial 部分 | `ci`：门在 CI 里执行、但无 branch protection | CI 会红，但可绕过合并 |
| paper 纸面 | 其余（manual / hooks / none） | git 官方坐实本地钩子一行 `--no-verify` 即可绕过；本地命令链靠手动 |

依据：四路验证修订①（git 官方文档）；本地 hooks 记 2 分正因为它「有反馈但可绕」。

## 六维计分表

### 1. 阻断强制性 blocking /30

取**保护级别最高的门**的档位分：`ci-protected`→30，`ci`→15，`hooks`→2，`manual`（本地命令链）→0.5，无门→0。
依据：pre-commit 官方生态承认「只在本地跑不够」（pre-commit.ci 的存在本身）；「不碰配置的情况下红代码能不能进 main」是 TOP-5 调研的第一判据。

### 2. 覆盖广度 coverage /20

对门清单全部命令文本做机械匹配（命中即加，可叠加）：

| 检测面 | 分 | 规则（正则示意） |
| --- | --- | --- |
| 可执行测试链 | 4 | 命令含 `test` |
| 结构一致性检查 | 3 | `check:repo` / `check-skill` / `check-structure` / `guard-structure` |
| 生成物漂移防线 | 3 | `build-release --check` / `check-clean` / `drift` |
| lint | 2 | `lint` / `eslint` / `biome` / `prettier --check` |
| typecheck | 2 | `typecheck` / `tsc --noEmit` |
| 覆盖率阈值 | 2 | `coverage` / `c8` / `nyc` / `lcov` |
| 架构边界断言 | 4 | `boundary` / `import-edge` / `fitness` |

依据：orca 覆盖最全的标杆拆解（蓝图能力域 2）。

### 3. 分层反馈 layering /15

| 形态 | 分 | 规则 |
| --- | --- | --- |
| 单一全量链 | 3 | 存在 ≥1 个 test/gate 动作 |
| 多门可选择性执行 | 8 | run.toml 注册的不同 test/gate 命令 ≥2 条 |
| CI 按路径/lane 分层 | 15 | workflows 含按变更文件选择性执行的结构（语义项，agent 复核后手工补记） |

依据：Google SWE Book「测试套越慢跑得越少」；codex 快检/全量分层标杆。

### 4. 有效性证据 evidence /20

| 检测面 | 分 | 规则 |
| --- | --- | --- |
| 逐门实跑退出码 | 3 | 本轮全部注册门实跑且 exitCode 非 null |
| 证据带文件出处 | 3 | 每门 evidence 字段非空 |
| 门带 selftest | 6 | 命令含 `self-test`（变异式：植入违规必须检出） |
| 登记簿在场 | 4 | gate-registry.json 存在（跨轮持久） |
| 历史 ≥2 可对比 | 3 | registry.history.length ≥2 |
| 诚实降级语义 | 1 | BLOCKED / stale（疑似过时）机制可用（本技能内置） |

依据：四路验证第四路——agent/工具自评一律不可信，selftest+确定性验证+退出码显式读取是必要条件；Meta TestGen-LLM 的有效性恰来自「生成后过确定性检查门」。

### 5. AI 门禁 ai /15（光谱制，取最高档不叠加）

| 档 | 分 | 判据 |
| --- | --- | --- |
| eval 命令在场未接线 | 2 | package.json scripts.evals 或 .agents/evals/ 存在 |
| 协议约定（advisory） | 5 | AGENTS.md 验证协议条款（语义项，agent 复核补记） |
| 结构化证据（evidence） | 10 | 验证证据文件+校验脚本在场 |
| CI gating | 15 | eval 进 CI 阻断（语义项，agent 复核补记） |

依据：gstack eval-as-gating 唯一标杆；oh-my-openagent「NO EVIDENCE == NO COMMIT」；机械面只判前 2 分，高档须证据。

### 6. 持续演进 evolution /10

| 检测面 | 分 | 规则 |
| --- | --- | --- |
| 棘轮在场 | 4 | 门/命令含 `ratchet`，或 ratchet-baseline.json 存在 |
| 登记簿在场 | 3 | registry.history ≥1 |
| 豁免清单机制 | 3 | 门/命令含 `exempt`/豁免（棘轮泄压阀，修订④） |

依据：orca「only SHRINK」棘轮；Codecov threshold 泄压阀；豁免清单只许缩小。

## 局限声明（报告与看板必须带）

- **低分≠有风险**：分数衡量门禁基建形态，不衡量代码质量（Scorecard 官方同款自认）。
- 无生态基线：总分只与自己的 history 序列比，不做横向排名。
- branch protection 离线不可核实：`ci-protected` 只认人工登记的 `.aes-gate/protection.json`。
