<!-- draft v1 | published 2026-09-11
     用户意见：待确认（前置校验=用法错类已拍板）
     状态：draft（门禁 CLI 契约 v2） -->

# verify-squash-merge.mjs 契约（v2 修订版）· local-mr-squash 硬门禁

v2 相对 v1（../2026-09-11-local-mr-squash/2-prototype/verify-squash-merge.md）的变化仅两处：**新增用法错前置校验**（检出==源 → 拒）与**第 4 项 FAIL 提示文案**改 reset --hard。四项检查判定逻辑逐字不动。

## CLI 契约

```
node verify-squash-merge.mjs <source-branch> [--keep]
```

- 退出码 **0** = 四项全绿，合并算完成；**1** = 有 FAIL 或用法错
- 用法错两态（均 exit 1，不输出四项检查）：
  1. 未给 source
  2. **当前检出 == source**——门禁必须在目标分支的检出上运行；在源检出上四项检查会同义反复假绿（合并前实测全绿 exit 0，v1 无防护）
- `--keep` = 显式跳过第 4 项（分支收口）的逃生门；用了必须写进合并报告
- 零配置：无 policy、无环境变量、无仓内依赖；任意 git 仓通用；仅 Node 内置模块

## 四项硬检查语义（与 v1 逐字一致）

| # | 检查 | 判定 | FAIL 提示要点 |
| --- | --- | --- | --- |
| 1 | 树净（**从严：含未跟踪文件**） | `git status --porcelain` 为空 | 先 commit/清理暂存内容 |
| 2 | 单笔提交 | `git rev-list --parents -n 1 HEAD` 恰两字段（HEAD+单父） | true merge 留双父，非 squash 形态 |
| 3 | 全包含 | `git diff --quiet HEAD...<source>` 退出 0 | 源有内容未并入，或 squash 后源又前进（B1 漂移捕获） |
| 4 | 已收口 | 分支已删，或源 tip == HEAD（前滚到位） | 见下方 v2 新文案 |

第 4 项 FAIL 提示（v2 文案）：

```
收口三选一：git branch -f <source> HEAD（未被 worktree 检出时）/ 在其 worktree 里
git reset --hard <target>（彼处树净且 tip 未前进）/ git branch -D <source>（短命流，
源被 worktree 检出时先拆该 worktree）；或 --keep 显式放行
```

## 新增前置校验输出形态（实测形态）

**用法错·检出==源**（在源分支的检出里运行，合并前）：

```text
用法错：当前检出就是源分支 feature——门禁必须在目标分支的检出上运行（源检出上四项检查同义反复假绿）
```

exit 1，无四项检查输出。

## 双 worktree 收口演示（v2 实测形态，temp fixture）

源=feature 检出于附属 worktree，目标=main，squash 已 commit 后：

```text
PASS  树净（无未提交/未跟踪残留）
PASS  单笔提交（HEAD 非merge commit）
PASS  全包含（feature 内容已全部进入 HEAD）
FAIL  已收口（feature tip == HEAD，前滚到位） — 收口三选一：…在其 worktree 里 git reset --hard <target>…
门禁未过：1 项 FAIL，按提示修复后重跑。
```

彼处执行 `git reset --hard main` 后重跑：

```text
PASS  树净（无未提交/未跟踪残留）
PASS  单笔提交（HEAD 非merge commit）
PASS  全包含（feature 内容已全部进入 HEAD）
PASS  已收口（feature tip == HEAD，前滚到位）
门禁全绿：squash 合并收口完成。
```

## 已锁定的约定

- 四项检查判定与退出码语义与 v1 逐字一致；本轮只加前置校验与改提示文案
- 树净从严（未跟踪文件也算脏）——维持
- 门禁非绿不得宣称合并完成；`--keep` 必须显形于最终报告——维持
- 脚本不写任何仓内文件——维持
- 已知残留（不在本轮范围）：分支删除后第 3 项会因 `git diff HEAD...<missing>` 报错变红（v1 已上报的内部矛盾，维持待裁定）
