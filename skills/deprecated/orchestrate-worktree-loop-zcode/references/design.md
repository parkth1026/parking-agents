# design.md — orchestrate-worktree-loop-zcode

## 意图与触发场景

在 ZCode 宿主里，让一个协调者 session 按「严格 issue 交付循环」驱动**真实的顶级 ZCode session**（UI 可见、用户可中途插话、非 subagent），每个 git worktree 一个，走完 实现 → 测试 → 双轴评审 → 提交 → 串行合并入集成分支 → 合并后验证 → 认领下一 issue 的状态机。触发词：总管/巡检多个 worktree、再来一轮、finish-and-merge issues。Codex 宿主用姊妹技能 `orchestrate-worktree-loop`。

两个等价控制面：Surface A = `mcp__zcode_threads__*` 原生工具（`~/.zcode/cli/config.json` 注册 `zcode_threads`）；Surface B = `zcode-session-driver.mjs` 终端 daemon。两者共享 `~/.zcode/bridge/sessions.json` 协调者登记簿，底层都是 headless app-server（NDJSON JSON-RPC over stdio）。

## 设计取舍

- **顶级 session 而非 subagent**：用户可在 UI 看到/接管每个 worktree 的执行；代价是只能经 app-server 协议间接驱动，且 session 可能被用户中途改动——SKILL.md 规则 3（每次操作前重查 status）即为此设。
- **双控制面单一语义**：MCP 工具与 CLI 子命令一一镜像，共享登记簿；协议参数形状必须一致（曾因两边各自漂移出 4 个缺陷，见迭代记录）。
- **证据归协调者**：session 的报告只是 claim；状态推进必须由协调者用 git/亲跑 gate 核证（SKILL.md 规则 4）。
- **离线回归门 vs 在线探针分离**：`run-tests.mjs` 只覆盖零依赖可离线验证的部分（语法、inspect 黑盒、CLI 守卫、协议形状静态断言）；需要真实 app-server + 模型的协议/e2e 探针留在评测 workspace 手动跑（`probe-mcp.mjs` 12 项、按 SKILL.md 的完整交付循环），避免每次升级都烧真实会话。

## 验收条件

| # | 验收条件 | 验证方式 |
| --- | --- | --- |
| AC-1 | `inspect-worktrees.mjs` 对多 worktree 输出结构化 JSON（branch/head/dirty/集成分支祖先关系/git 操作标记），非 repo 路径 stdout `[]` + stderr 错误 + exit 1，缺 `--paths` exit 2 | run-tests T2（黑盒，临时 git fixture） |
| AC-2 | driver daemon 启动写 `bridge.json` 并打印 `BRIDGE_READY`；CLI 子命令 create/send/wait/status/result/list/close/stop/approve/daemon-stop 与 MCP 工具一一对应；daemon-stop 清理 `bridge.json` | 评测 workspace 手动探针（2026-08-24 实测通过，见报告） |
| AC-3 | `close` 或 daemon/服务器重启后，对登记簿内已知 session 的下一个操作自动恢复（`session/resume` 以 `workspace` **对象** `{workspacePath, workspaceKey}` 传参） | run-tests T4.1 静态断言 + 手动重启实测（T2.14：重启后 status 自动恢复） |
| AC-4 | MCP server 以 stdio JSON-RPC 暴露恰好 9 个工具；initialize/tools/list/tools/call 合规；未知方法 `-32601`；工具执行错误以 `isError` 返回不崩服务器 | run-tests T4.3 + probe-mcp 12 项（手动） |
| AC-5 | `session/create` 参数面与 app-server schema 严格一致：不支持 `title`（CLI 显式拒绝），`workspace` 为对象 | run-tests T3.2 / T4.2 |
| AC-6 | 按 SKILL.md 驱动的交付循环在合成仓库可完整走通状态机至 `NEXT_ISSUE_CLAIMED` 并同 session 重派下一 issue；协调者独立核证每态证据；脏 worktree 的无关用户文件全程保全 | 2026-08-24 e2e：wt1 两轮（issue-1→issue-3）+ wt2 一轮（issue-2），3 次串行合并，USER-NOTES.md 原样保留 |

## 迭代记录

- **2026-08-24**：parking-skill-creator 方法论严格测试（脚本单测 + 协议探针 + 双 worktree 完整 e2e），修复 4 缺陷：#1 `create --title` 违反 app-server schema（删除透传，CLI 显式拒绝）；#2 `promptCount` 两控制面口径不一（create 带 prompt 计 1）；#3 `session/resume` 误传字符串致 close/重启后自动恢复全坏（改传 workspace 对象，两控制面同修）；#4 usage 注释宣传不存在的 `--prompt-file`（改 `--file`）。e2e 判定：技能正确工作。本轮无上轮基线（首次结构化评测），won/lost/tie 记 N/A。无拆分建议（编排技能本体即编排层，原子能力已外置为脚本）。
