# Fact: 深度调研——提交唤醒机制与跨天持久化（用户要求的 Deep Research）

- 派遣问题：参考软件（open-design / Claude Design / 社区工具）的「提交按钮→agent 继续」机制与服务生命周期怎么做？对本技能的建议是什么？
- 完成：2026-08-20T00:00:00Z（两路调研代理：open-design 源码深挖 + Web 调研）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| open-design 提交机制：submit = 格式化成普通用户消息 → POST /api/runs → daemon **冷启动新回合**（每次 spawn 一个 CLI 子进程当 agent，跑完即死）；无队列无调度器；并发控制 = 客户端排队 + clientRequestId 幂等 + 每条 assistant 消息一次原子 DB 抢占（409 RUN_IN_PROGRESS） | `open-design/apps/daemon/src/routes/runs.ts:3068-3273`；`runtimes/runs.ts:634,903,1235`；`server.ts:9634,12257` |
| open-design 持久化：用户消息（含表单答案 prose）**先于回合启动落 SQLite**；表单答案没有独立存储——下一条用户消息文本就是存储，重载时正则解析回只读已答状态 | `db.ts:45`；`AssistantMessage.tsx:2740`；`QuestionForm.tsx:157` |
| open-design daemon **随桌面应用关闭而死**（window-all-closed → SHUTDOWN IPC → 5s 强杀），不常驻；隔天可用靠的是状态落盘 + 重开冷启动，不是保活 | `apps/desktop/src/main/index.ts:1081`；`apps/packaged/src/sidecars.ts:839` |
| open-design 崩溃语义：daemon 重启时未终态 run 标记 failed(DAEMON_RESTARTED, retryable)，不自动续跑；web 显示可续卡片 | `runtimes/run-restart-recovery.ts`；`runs.ts:685-726` |
| open-design 对外部 CLI 的通道：`od mcp` 只给 start_run/get_run **轮询** + events.jsonl 文件让外层自己 tail——没有 daemon→CLI 的反向推送 | `apps/daemon/src/mcp.ts:741,798,2646,2695` |
| Claude Design（真产品）：澄清是**对话式**追问，无公开的多问题表单向导；持久化靠项目产物保存 + 分享链接，无公开会话保活时长；第三方称跨独立会话不保留记忆 | anthropic.com/news 官方公告；support.claude.com 帮助中心；MindStudio 博客 |
| Claude Code Remote Control（官方桥接）：本地 CLI **必须一直运行**；断网约 10 分钟后服务器模式退出；恢复窗口约 4 小时（`--continue`/`--session-id`） | code.claude.com/docs/en/remote-control |
| 业界跨天共识：transcript 持续落盘 + session resume（Claude Code 默认保留 30 天）；分歧只在「谁保活」——常驻服务（Windows 上是坑：PM2/登出被杀/弹窗，OpenCode 官方建议 WSL）、厂商中继（窗口有限）、不保活靠下次交互唤醒 | code.claude.com/docs/en/sessions；rogs.me systemd 实践；pm2-installer#78；opencode.ai/docs/web |
| 野外 5 种模式：A 包装器/子进程（Happy 等，web 是 agent 父进程）；B 官方中继；C 同 server 双前端（OpenCode attach，需 harness 支持）；D 回合边界+事件文件（aes-grilling-web，无自动唤醒）；E 官方 defer+resume+updatedInput（Claude Code hooks 专利，**ZCode hooks 子集不支持**：仅 7 事件、无 async、Stop 最多续 3 次） | 调研综合；ZCode 官方插件 diagnosing-hooks SKILL.md |
| ZCode 有 Claude Code 没等价物的一等公民通道：Bash `run_in_background` 跨回合 detached 运行、**退出时重新唤起 agent**（Claude Code 同类机制有已知 bug #21048/#17456） | ZCode Bash 工具文档（系统级）；anthropics issues |

## 未知项

- Claude Design 服务端内部实现（闭源，仅公开文档可达）

## 没查的

- Happy Coder / The Companion 的源码细节（机制已由评测与 README 确认，足够决策）

## 给本技能的推论（Agent 推断，非事实）

- 「提交即新回合」在 open-design 成立的前提是 daemon 拥有 spawn 权；本宿主中该角色由「后台任务退出通知」承担，语义等价：提交→wait-submit 退出→宿主唤起。
- 「隔天」的正确解法不是保活 agent（做不到）而是**提交永不丢**：submission 先落盘（open-design 先落消息的同款纪律）+ server detached 缓冲 + 重开续跑先吸收。这严格优于 open-design（其 daemon 随应用死， ours 可缓冲）。
- 幂等与失败语义照抄 open-design：按 round-id 幂等（重复提交冲突拒绝）；宿主死于回合中 → 未消化提交保留，重开吸收，不自动续跑。
