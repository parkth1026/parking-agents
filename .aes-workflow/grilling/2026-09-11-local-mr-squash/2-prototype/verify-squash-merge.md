# verify-squash-merge.mjs 契约（确认版）· local-mr-squash 硬门禁

**确认版·锁定。** 执行 Agent 改的是产品，不是这份契约。
用户确认：2026-09-11（随 v2 整体确认；参考实现见同目录 `verify-squash-merge.mjs`，2026-09-11 已实打 AntAgent_v2 仓三态验证）

## CLI 契约

```
node verify-squash-merge.mjs <source-branch> [--keep]
```

- 退出码 **0** = 四项全绿，合并算完成；**1** = 有 FAIL（含用法错：未给 source）
- `--keep` = 显式跳过第 4 项（分支收口）的逃生门；用了必须写进合并报告
- 零配置：无 policy、无环境变量、无仓内依赖；任意 git 仓通用；仅 Node 内置模块

## 四项硬检查语义

| # | 检查 | 判定 | FAIL 提示要点 |
| --- | --- | --- | --- |
| 1 | 树净（**从严：含未跟踪文件**，用户拍板口径） | `git status --porcelain` 为空 | 先 commit/清理暂存内容 |
| 2 | 单笔提交 | `git rev-list --parents -n 1 HEAD` 恰两字段（HEAD+单父） | true merge 留双父，非 squash 形态 |
| 3 | 全包含 | `git diff --quiet HEAD...<source>` 退出 0 | 源有内容未并入，或 squash 后源又前进（B1 漂移捕获） |
| 4 | 已收口 | 分支已删，或源 tip == HEAD（前滚到位） | 三选一：`branch -f`（未被检出）/彼处 `merge`（树净未前进）/`branch -D`；或 --keep |

## 三态实测输出（2026-09-11 打 AntAgent_v2 仓，源=dev-parking）

**FAIL 态（树脏，exit 1）**——真实触发：访谈档案未跟踪：

```text
FAIL  树净（无未提交/未跟踪残留） — 提交或清理后重跑；merge --squash 的暂存内容必须先 commit
PASS  单笔提交（HEAD 非merge commit）
PASS  全包含（dev-parking 内容已全部进入 HEAD）
PASS  已收口（dev-parking tip == HEAD，前滚到位）
门禁未过：1 项 FAIL，按提示修复后重跑。
```

**--keep 态（exit 仍 1，因树脏真实存在）**：第 4 项输出 `SKIP 已收口（--keep 显式放行——必须写进合并报告）`。

**全绿态（临时 stash 访谈档案后，exit 0）**：

```text
PASS  树净（无未提交/未跟踪残留）
PASS  单笔提交（HEAD 非merge commit）
PASS  全包含（dev-parking 内容已全部进入 HEAD）
PASS  已收口（dev-parking tip == HEAD，前滚到位）
门禁全绿：squash 合并收口完成。
```

## 已锁定的约定

- 树净从严（未跟踪文件也算脏）——用户确认维持，正当未跟踪证据目录会被挡门，属故意设计
- 门禁非绿不得宣称合并完成（SKILL.md 第 7 步 + B4 行）
- `--keep` 必须显形于最终报告（SKILL.md 第 7 步原文）
- 脚本不写任何仓内文件（U3）
