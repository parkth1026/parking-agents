<!-- draft v1 | published 2026-08-22T17:05:00Z
     用户意见：待收集
     状态：superseded by v2-behavior.md -->

# 行为对照表: 2026-08-23-worktree-board

对照基线 = 本会话已建成的 v1（worktree 中心视图）。改后 = 访谈锁定的作战图终态。

## 变化行

| # | 输入 / 前置 | 现在的行为（v1） | 改后的行为 |
| --- | --- | --- | --- |
| 1 | `node …/collect.mjs`（gh 在线） | 只采 worktree 关联 issue（当前 4 个：#24 #35 #55 #41），无依赖概念 | 全仓 issue 全采（当前 17 OPEN + 44 CLOSED = 61 节点），解析 body 依赖边，推导 frontier（OPEN 且依赖全闭且无队员认领） |
| 2 | 打开看板主视图 | 环形图：main 居中、dev1~5 环绕、issue 挂卫星 | wayfinder 星图：issue 按依赖 rank 力导向成环；frontier=蓝星呼吸脉动；被认领=金星+轨道环；被阻塞=暗红小星；CLOSED=暗绿余烬；依赖曲线边（满足=实线+流动粒子，未满足=暗虚线）；相机可平移缩放 |
| 3 | 队员定位（如 dev5 正做 #41） | 无队员概念 | dev5 队员单位绕 #41 金星运行；空闲队员（dev1）停靠中心基地；每个队员拖一条暗色轨迹连其完成过的 issue（按时间序） |
| 4 | 派发到 dirty worktree（如 dev3 现有 16 改动+15 未跟踪） | 直接派发 | 页面弹确认层列 dirty 摘要，点「仍要派发」才执行；API 首次返回 409 `dirty_confirm_required`，带 `confirmDirty:true` 重试才执行；主 agent 对话派发时先复述 dirty 状态征求确认 |
| 5 | 派发到干净 worktree（边界） | 直接派发 | **不变**：直接派发，无确认步 |
| 6 | 评估陈旧（assessedAt 早于该节点最新 commit 时间或最近任务 endedAt） | 只显示评估时间戳 | 评估块自动加「已过期」黄色标记，提示回主仓重跑巡检 |
| 7 | 合并建议遇到无 issue 的独立任务分支（近期 commit 无 `(#N)`） | recommend 判据未涉及此情况 | 最高只能给 `not-yet`，reason 强制注明「产出需先补 issue 才能进入合并评估」 |
| 8 | frontier 派活 | 无 | 巡检汇总表附 frontier 清单；星图点 frontier 星 → 面板内选一个空闲队员直接派发 |
| 9 | frontier 为空（全部 OPEN 被认领或阻塞，边界） | — | HUD frontier 计数显示 0；巡检汇总注明「无可开工项」，不报错 |
| 10 | 依赖边缺失（issue body 没写 blocked by，边界） | — | 该 issue 无入边即按「依赖全闭」参与 frontier 判定；图上无边不报错——边质量取决于 issue 书写纪律（访谈已确认此代价） |
| 11 | CLOSED issue 的呈现 | 不显示（除非 worktree 关联） | 暗星常驻地图（wayfinder resolved 样式），点开面板只读，不提供派发 |

## 不变清单

以下 v1 已实测行为必须原样保持，执行 Agent 逐条对照：

- **派发内核**：dispatch.mjs 的 PID 并发锁、prompt 走 stdin、守护到进程结束、tasks/ 三件套记录（json/log/prompt.txt）——主 agent 与 server 都在依赖。
- **评估内核**：assess.mjs 的 CLI 参数与 assessment 字段结构（currentTask/done/merge/reason/assessedAt/assessedBy），collect 重采时按节点保留。
- **服务边界**：server 仅绑 127.0.0.1；`GET /api/status`、`POST /api/dispatch`、`GET /api/task/<id>` 三端点继续存在；干净 worktree 的派发请求报文与 v1 逐字节兼容（新握手只在 dirty 时出现）。
- **双模式**：LIVE（fetch /api）失败自动降级读 `<script src>` 注入的快照——file:// 双击可用这一点不许破坏。
- **作用范围**：同级既有 worktree 枚举规则；任何情况下不创建、不删除 worktree；合并只建议不执行；issue 关闭不由系统执行。
- **配置**：board.config.json 现有字段（mainBranch/issueRepo/port/defaultAgent/agents）原样有效。
- **test agent 冒烟**：`node …/dispatch.mjs dev1 --agent test "冒烟"` 的行为与输出结构和 v1 一致（路径前缀除外）。
- **历史 tasks/ 记录**：新代码能读 v1 已写盘的任务 json（字段只增不改义）。

## 配置差异

| 项 | 现在（v1） | 改后 | 迁移 |
| --- | --- | --- | --- |
| 脚本落位 | `worktree-board/*.mjs` | `.claude/skills/aes-worktree-board/scripts/*.mjs` | 整目录搬移，`worktree-board/` 删除 |
| 页面落位 | `worktree-board/board.html` | `.claude/skills/aes-worktree-board/board.html` | 同上 |
| 运行时生成物 | `worktree-board/{status.json,status.js,tasks/}` | `.claude/skills/aes-worktree-board/runtime/` 下同名 | 旧生成物直接废弃，首跑重新采集 |
| 后端启动 | `.\run board` | `node .claude/skills/aes-worktree-board/scripts/server.mjs`（launch.json 同步更新） | run.toml 的 board 动词撤销 |
| skill 落位 | 用户级 `~/.claude/skills/aes-worktree-board/` | 项目级 `.claude/skills/aes-worktree-board/`（SKILL.md 与脚本同目录自包含） | 用户级副本删除 |
| git 状态 | run.toml、.gitignore 已改（未提交） | 两文件改动全部撤销；`.claude/` 整体不进 git，进不进/何时搬出项目由用户后续自行处理 | `git checkout -- run.toml .gitignore` |
