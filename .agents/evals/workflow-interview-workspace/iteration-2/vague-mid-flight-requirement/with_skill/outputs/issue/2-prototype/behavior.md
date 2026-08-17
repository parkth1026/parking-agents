# 行为对照表: 2026-08-13-mid-flight-requirement-change

**确认版·锁定。** 执行 Agent 改的是产品，不是这份对照表。
用户确认：2026-08-13T00:20:00Z

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | 用户在 `3-contract` 阶段、`contract.md` 已经 `finalize` 通过且 `stage 3-contract done` 已跑过（`status: ready`）之后，想追加一条新的 AC | 没有任何文档说明这条路径存在。执行者只知道 `needs_reinterview`——一个专门写给「子技能报出材料歧义」的回退命令，语义上和「我只是想再加一条」不匹配，容易被误用（错误地退回 1-interview 重问一遍）或者干脆不知道能不能做 | `aes-goal-contract/SKILL.md` 明确写出步骤：直接编辑 `contract.md` 追加 `AC-00N` 与其 `Verify` 行 → 重跑 `node scripts/session.mjs finalize <issue-dir>` → 重跑 `node scripts/session.mjs stage <issue-dir> 3-contract done`。机制不变（`session.mjs` 零代码改动），只是被显式承认、写进文档、并有回归测试兜底 |
| 2 | 追加的这条 AC 涉及界面或行为差异（需要新的/变更的确认版对照物） | 同样没有文档说明，容易被就地在 `contract.md` 里凭空编一段描述糊过去，绕开对照物确认这一步 | 文档明确：这种情况**不是**「只加一条 AC」能覆盖的，算作 `aes-prototype` 定义的「材料歧义」，走既有 `needs_reinterview` 打回 `aes-interview`（更重，但仍然是唯一路径，不新增中间态）。纯文字性质（不涉及任何可观察差异）才走变化行 1 那条更轻的路径 |
| 3 | 追加导致 AC 总数超过 7 条 | `validate-goal-contract.mjs` 已经会拒收（「一个任务最多七条 AC」） | 不变。文档提醒：撞到这条说明这次追加其实是另一件独立可交付的事，该另开一个 issue，不是把条数压回去 |

## 不变清单

- `session.mjs` 全部 7 个子命令（`init/round/stage/verify/rebuild/finalize/list`）的
  参数、退出码、输出文案零改动——这次不新增命令、不新增 `stage_gates` 状态值。
- `needs_reinterview` 的既有语义与行为完全不变：仍然是「无条件退回 1-interview」，
  仍然是唯一处理「材料歧义」的路径。这次新增的说明只覆盖它管不到的那个更窄场景
  （契约还没定稿、纯文字追加），不替代它、不改它的判定范围。
- 已经 `done` 的旧 issue 目录的 `manifest.json`、`contract.md` 不受影响；`rebuild`、
  `list`、`verify` 对它们的判定结果不变。
- `validate-goal-contract.mjs` 的全部校验规则（7 条 AC 上限、编号连续、Verify 档位、
  「残留风险」对账等）零改动。

## 配置差异

无配置变更。（本次不新增命令行参数、环境变量或配置文件字段，这一节整节省略实质
内容，仅保留标题以证明已扫描确认无差异。）
