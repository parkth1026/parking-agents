# 失败恢复矩阵

`convert.mjs --apply` 失败时按报告里的 `phase` / `state` 对号入座。原则：**先看现场再动手，一次只修一层；不要盲目重跑 `--apply`**。

## 自动回滚已发生（报告 `rolledBack: true`）

phase 在 `refs/stage/backup-git/clear/worktree-add` 失败时脚本已尽力还原：`.git` 回位、资产从暂存区搬回。检查：

1. `git -C <target> status --porcelain` 干净、`git -C <target> log --oneline -1` 正常 → clone 已恢复，处理失败原因后可重试。
2. 报告 `rollbackLeftovers` 非空 → 按列出的路径手工搬移（源 `<target>__staging/<rel>` → 目标 `<target>/<rel>`），搬完删暂存区。

## 现场保留（报告 `rolledBack: false`）

phase 在 `restore/submodule/verify/cleanup` 失败：worktree 已建、部分资产可能还在暂存区。逐项排查：

| 现象 | 恢复动作 |
| --- | --- |
| 暂存区 `<target>__staging/` 还有条目 | 目标路径无同名内容时 `mv` 回 `<target>/<rel>`；有意外内容先 diff 再决定 |
| submodule `status` 前缀 `-`（未初始化） | `git -C <target> submodule update --init <path>`；gitdir 缺失见下行 |
| submodule 报 `not a git repository` | 检查 `modules/<path>` 是否在 `<主仓>/.git/worktrees/<名>/modules/` 与备份 `.bak.git/modules/` 哪一边，把缺的一边补齐后重做 gitfile 指针（对照 convert.mjs phase 7 的三步：迁 gitdir、写 `.git` 文件、改 `core.worktree`） |
| `verify` 报资产未回到位但暂存区已空 | 资产可能在移动途中断——按 `movedArtifacts` 清单逐个找（staging/backup/原位），宁可疑不删 |
| worktree 注册了但目录是空的 | `git -C <主仓> worktree remove --force <target>` 后从「自动回滚」一节的手工路径走 |

## 清理顺序（全部恢复后）

1. 确认 `<target>` 可用（status 干净、构建能跑）。
2. 删 `<target>.bak.git`（旧对象库，独有 refs 已在主仓才可删；不确定就先 `git -C <主仓> for-each-ref` 核对）。
3. 删空了的 `<target>__staging`。

## 已知限制（不是失败）

- 旧 clone `.git/config` 里的本地配置（分支级 merge-base、编辑器偏好等）不迁移——worktree 共用主仓 config。
- submodule 的 submodule（嵌套）未做递归手术，需要时在 worktree 里 `git submodule update --init --recursive` 重取。
- 仓库自带的依赖合同门禁（如 SuperTools 的 `verify-native-deps.ps1`）若在转换前就已过期，转换不会也不该修它——按该仓库自己的初始化入口重录。
