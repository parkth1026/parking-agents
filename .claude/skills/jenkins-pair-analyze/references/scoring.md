# Scoring Criteria

## 10-Point Scale

| Dimension | Criteria | Points |
|-----------|----------|--------|
| **Error Info (0-3)** | Has error code (C1083, LNK2019, etc.) | +1 |
| | Has file path | +1 |
| | Has line number | +1 |
| **Log Diff (0-2)** | Confirmed error gone in SUCCESS build | +1 |
| | Single root cause identified (not multiple unrelated errors) | +1 |
| **Commit (0-3)**（修复侧证据语义，见下文专节） | 失败→修复窗口内存在**书面变更证据**：版本控制提交（代码或内容资产，git/P4）、job 配置变更 diff、流水线参数变化、管理员操作记录——任一 | +1 |
| | 该变更直接触及错误文件/对象本身，或其直接对应的配置 | +1 |
| | 变更描述能清楚说明修复（提交消息/变更说明读得出"改了什么、为何修复"） | +1 |
| **Reuse (0-2)** | 知识文件含**真实 diff**（`git show` 的 before/after 代码或配置片段），**或** 等效强归因链成立（三条件，见下文专节） | +1 |
| | Has prevention advice applicable to similar cases | +1 |

## Reuse 第 1 分：diff 判定的唯一定义

本节是「diff 算不算分、算在哪一维」的**唯一定义点**。analyze.md 与编排器
`jenkins-log-auto-learning/references/config.md` 只引用本节，不得另立口径。

拿 Reuse 第 1 分有且只有两条路：

1. **真实 diff**：知识文件正文含 `git show {commit}` 的 before/after 片段（代码或配置）。
   取自修复侧提交，或已用 `git show` 验证的引入侧（culprit）提交，均可——
   MissingPlugin（culprit `17c5ab3c9` 的 uplugin diff 块）与
   EnvironmentStateLag（b9c0b5d 拆分 DataPath 的验证性变更描述）均走此路。
2. **等效强归因链**（diff 不可得时：浅克隆 `--depth=1`、远端凭据不可得、force-push 后对象消失）：
   以下三条件**同时**成立才计分：
   - ① 失败→成功两构建的 pin/提交集合比对，**唯一**变化指向单一变更；
   - ② 该变更的标题/内容与失败对象**同名或直接对应**；
   - ③ 目标错误在 fix 构建中**消失**。

   纯推断（缺任一条件，例如 pin 间有多个提交无法唯一定位）**不计分**。
   链成立时在知识文件 Fix 节注明标注格式：
   `归因强度：等效强归因链（唯一 pin 变化 {hash} + 与失败对象同名 + 错误消失）`。
   参照案例：`details/aes6-329-StageFileMissing-runtimeversion-not-in-repo.md`
   （db82ef2 唯一 pin 变化 + 标题 "add runtimeversion.json" 与失败文件同名 + #330 错误消失）。

## Commit 维度语义：修复侧证据

Commit 三分全部衡量**修复侧**（促成失败→成功转变的那一侧）的书面证据：

- 引入错误的 culprit 提交**不计 Commit 分**——它属于 Root Cause 叙述；其真实 diff 可按上节
  为 Reuse 供分，但不给 Commit 供分。
- **infra 配置变更证据条款**：修复 = Jenkins 配置/环境变更（无代码提交）时，凭书面证据
  （job 配置变更 diff、流水线参数变化记录、管理员操作记录）可获第 1、3 分；
  该变更直接触及错误对象对应配置时可获第 2 分。
- 「重跑即好、无任何变更证据」= 0/3（EnvironmentStateLag、GitFetchDNSFailure 型）。

## Thresholds

| Score | Action | Directory |
|-------|--------|-----------|
| >= 8 | High-quality knowledge, full write-up required | `details/` |
| 5-7 | Partial knowledge, shorter format OK | `scratch/` |
| < 5 | Not worth writing — record score in tracking only | (none) |

<5 分支至今未被触发过，这本身正常：多见于日志不可得（`log-unavailable` 已提前收尾）
或弱归因的老构建对——未触发不说明规则有错，也不必为凑分硬写。

## 校准触发条件

四维权重（Info3/Diff2/Commit3/Reuse2）与阈值（8/5）当前未经数据校准。以下三条件
**任一**满足即触发权重/阈值复审（对照账本与盲评基线重审数字；复审是独立任务，触发≠立即改数）：

1. 账本 `:see=` 累计 ≥ 30 条（去重指针成为常态效用信号）；
2. 距上次校准 ≥ 6 个月（从未校准过则从本规则生效时刻 2026-08-17 起算）；
3. 盲评一致率 < 0.8（|Δ总分| ≤ 1 的文件占比，口径见 [blind-review.md](blind-review.md)）。

## File Naming

以 FAILURE 构建号为主标识符：`{jobCode}-{failBuild}[-{failEnd}]-{ErrorCode}-{ShortDesc}.md`，
jobCode 取自编排器技能 config.json 的 jobCodes 注册表。命名语法、frontmatter 与验收规则
统一见 [knowledge-format.md](knowledge-format.md)（v2），由 validate-raw.mjs 机械校验。

Examples:
- `twe-inst-898-903-LNK1120-TiffJpegUnresolved.md`
- `aes6-3746-C2061-FZoneGraphBuildData.md`

## Notes

- **Commit from console log**: For WorkflowRun pipeline jobs, `changeSet` in the Jenkins API is often empty. Commits extracted from the console log (git checkout lines, commit messages) count the same as changeSet data for scoring purposes——它们作为修复侧变更证据同样计分。
- **diff 不可得是常态而非例外**：无真实 diff 且等效强归因链不成立时，Reuse 第 1 分记 0，
  上限 9/10（3+2+3+1，仅预防建议供分）。此时按链的三条件如实判定，不靠错误消息与
  提交描述的想象补齐——诚实记 0 优于编一个分。
