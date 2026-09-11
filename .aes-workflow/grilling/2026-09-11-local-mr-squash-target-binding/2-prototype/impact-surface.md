# 影响面扫描: 2026-09-11-local-mr-squash-target-binding

判据：改完之后，程序在哪些地方跑起来不一样了？谁看见、谁受影响？

| 影响面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- |
| 用户可见界面 | 无 | CLI 技能，无 UI | — | — |
| 可观察行为 | **有** | ① 收口路径语义变更：彼处 merge（永红死路）→ 彼处 `reset --hard <target>`（实测唯一全绿）；② prose 第 1 步目标显式化（当前检出即目标、源≠当前检出）；③ 正文「主干」→「目标分支（dev/main 等）」 | 点名调用本技能的会话（用户双 worktree 形态为主） | `behavior.md`、`skill.md`（实文） |
| 可运行输出 | **有** | 门禁新增用法错拒绝输出（检出==源 → exit 1，不输出四项检查）；第 4 项 FAIL 提示文案改 reset --hard | 跑门禁的 agent 与用户 | `verify-squash-merge.md`（CLI 契约 v2） |
| 对外接口报文 | 无新结构 | CLI 参数、退出码语义（0/1）不变，仅扩用法错类；沿旧 issue 先例由 CLI 契约件承载，不另立 api-mock | — | 并入 `verify-squash-merge.md` |
| 用户配置 | 无 | 零配置保持（无 policy/台账/环境变量） | — | — |
| 历史兼容性 | **有（全不变面）** | description 逐字不动（触发评测定稿资产）；四项检查判定不动；--keep 语义不动；单 worktree `branch -f` 收口路径照常全绿；量级门槛不破 | 既有触发评测成绩、既有 run-tests 回归资产 | `behavior.md` 不变清单 |
| 架构与依赖 | 无 | 文件集合、symlink 拓扑、模块边界、依赖方向均不变，仅文件内容修订 | — | — |

七面扫描结论：三面「有」（行为/输出/兼容不变面），四面「无」。对照物三件：`skill.md`、`verify-squash-merge.md`、`behavior.md`。
