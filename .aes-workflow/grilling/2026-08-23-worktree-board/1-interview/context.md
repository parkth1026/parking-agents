# Context Snapshot: 2026-08-23-worktree-board

- 创建：2026-08-22T16:30:00Z
- 分片来源：无，宿主直接调查（事实多数来自本会话已完成的建设过程）

## 任务陈述

> 我需要你写一个skill，专门负责更新当前仓库下所有worktree当前正在干嘛的状态，正在完成哪个issue或者独立任务，是否完成 是否应当merge到main。核心诉求：通过在主仓库中调用这个技能，检查所有sub-worktree的工作状态并判断是否应当合并。任务完全通过一个主Agent去发送（给所有worktree发任务），另一个是监控任务有没有完成、合并状态。用JSON描述每个结点状态，完成任务时更新JSON。HTML静态解析JSON展现状态，点刷新获得当前状态，不需要后端；有后端更好：1.通过Web看到所有issue的图谱 2.通过图谱点击发送指令让对应worktree干活。我在创建的是一套尽可能一个主脑控制所有其他worktree干活的系统，用户交互只有一个主仓库的agent对话+一个页面，就能达到消化所有需求的目标。有些执行细节我会去worktree的对话去详细决定，但核心还是在主worktree中干活。（补充：我们来锁定需求范围，你走太快了）

## 用户提出的方案

用户自带了明确的架构骨架：JSON 状态契约 + 静态 HTML 渲染器 + 可选后端（图谱 + 点击派发）+ 单一主 Agent 派发模式。参考物：`G:\GIT\AI_WorkFlow_ref\wayfinder-maps`（issue 图谱可视化）。

## 意图假设

任务陈述说的是「一个查状态的 skill」，但补充消息揭示真正要的是**一套主脑作战系统**：用户只守两个界面（主仓对话 + 一张网页）就消化全部需求——需求进来、拆给 worktree、监控执行、判断合并，全程不离开主仓。skill 和网页只是这套系统的两个入口。差异所在：如果只做「状态查询 skill」，派发、图谱、评估时效都可砍；按主脑系统做，这些是主干。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| worktree 布局：dev1~5 与主仓同级（`aes-agents-v2-dev1..5`），另有 Temp 下一个 detached 临时 worktree 应排除 | `git worktree list` | Fact |
| issue 在 GitHub `51world-ai-copilot/aes-agent`，gh 已登录；commit message 强制带 `(#N)` | AGENTS.md:5,92 | Fact |
| git 2.53 支持 `merge-tree --write-tree` 干跑冲突预判 | `git --version` | Fact |
| `claude` 是原生 .exe（可直接 spawn），`codex` 是 npm .cmd shim（需 cmd.exe 包装） | `where.exe` 输出 | Fact |
| run 体系：run.toml `[[actions]]` argv 格式，一级动词 | run.toml | Fact |
| `pnpm-workspace.yaml` 不含 `worktrees/`；主仓有未跟踪 `worktrees/package.json`（内容 `{}`），用途不明 | pnpm-workspace.yaml、git status | Fact（用途待确认） |
| 本会话已建成 v1：`worktree-board/`（collect/assess/dispatch/server/board.html/config）+ 用户级 skill `aes-worktree-board` + run 动词 `board` + launch.json，均未提交；派发链路/网页派发/双模式已实测走通 | 本会话记录、`git status` | Fact（是既存物，不是已确认需求） |
| 用户已裁决 5 项：①后端+静态兜底并存 ②派发=主 agent 自建 headless 任务（claude/codex 皆可），仅限同级既有 worktree、绝不新建 ③headless 全自动权限 ④合并只建议不执行 ⑤主仓对话+页面是唯一交互面 | 本会话 AskUserQuestion 回答 + 中途消息 | User decision（已定） |
| AGENTS.md 约束：进程只用启动时捕获的 PID 管理；验收分 [A]/[C] 档；未执行人工验收标 BLOCKED | AGENTS.md:21,45,54 | Fact |

## 验证基建候选池

| 途径 | 代价 |
| --- | --- |
| `vp run -r test`（vitest，`scripts/` 是 workspace 成员、`*.test.ts` 惯例） | worktree-board 不在 workspace 内：要么测试文件挂到 `scripts/`，要么把 worktree-board 纳入 workspace——两者都是先建约定 |
| Node 内置 test runner 裸跑（`node --test worktree-board/*.test.mjs`） | 与零依赖路线一致，但不在 CI 门里，需另挂 run 动词才有入口 |
| test agent 冒烟（board.config.json 已有 `test` 模板，本会话已用它实测派发链路） | 只覆盖派发管线，不覆盖采集正确性与页面 |
| in-app Browser 自动化验收（本会话已示范：JS 驱动点击、断言面板内容） | 需要起后端；断言写在会话里不留存，若要留存需固化成脚本 |
| 真实浏览器 [C] 档人工验收 | 占用用户时间；按 AGENTS.md 未执行时只能标 BLOCKED |

## 术语冲突

- 用户说「**所有 issue** 的图谱」；已建页面显示的是「**worktree 关联到的** issue」（从 commit 提取），两者范围差一个量级 → 进提问区 Q1。
- 用户说「**当前仓库下**所有 worktree」；实际布局是**同级目录**——中途消息已澄清为同级 dev1~5，按同级理解，已定。

## 四分类

- **Fact**：上表所列；含已建 v1 的能力边界。
- **User decision**：已定 5 项（见上表）；待问 4 项（图谱范围、工作单位、并发防护、评估时效）；待确认若干（进 git、判定标准、通用性、无队列、issue 关闭权）。
- **Agent-owned**：JSON schema 字段细节、页面视觉与布局、脚本内部结构、派发 prompt 的组织、collect 性能、任务日志格式。
- **Blocked**：无。

## 决定边界未知项

- `worktrees/` 空目录（含空 package.json）是否有既定用途——影响本系统落位目录是否要避让 → 确认区。

## 未知项

- codex `exec` 的免审批 flag 现名（`--dangerously-bypass-approvals-and-sandbox` 是凭记忆预置）——仓库内读不到，首次真实派发前需现场核对 `codex exec --help`。
