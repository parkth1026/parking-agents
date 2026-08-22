<!-- 确认版 · 晋升自 drafts/v1-example-run.md | 用户确认：2026-08-20（"ok"）
     不可修改：执行 Agent 改的是产品，不是这份对照物 -->
# 可执行示例: 2026-08-20-workflow-interview-web

端到端跑起来的样子。报文结构见 api-mock.md，本文只写「怎么调用、看到什么」。

## 场景 1 · 正常回合循环（宿主活着）

```console
$ node .agents/skills/workflow-interview-web/scripts/server.mjs start \
    --issue-dir .aes-workflow/grilling/2026-08-20-mytask --open
{"type":"server-started","port":19433,
 "url":"http://127.0.0.1:19433/?key=3f9a…",
 "web_dir":"…/2026-08-20-mytask/web","pid":48812,"reused":false}
# 浏览器自动打开；页面顶部出现面包屑与「开放歧义 N」计数

$ node .agents/skills/workflow-interview-web/scripts/publish.mjs round \
    --issue-dir .aes-workflow/grilling/2026-08-20-mytask --file round-r1.json
{"ok":true,"round":"r1","items":7,"open_ambiguities":3}
# 页面即时刷新出 Round 1 问题卡（无需手动刷新）

# agent 在宿主内以【后台任务】方式挂起等待（无超时），随后结束回合：
$ node .agents/skills/workflow-interview-web/scripts/wait-submit.mjs \
    --issue-dir .aes-workflow/grilling/2026-08-20-mytask --round r1
# （后台运行中……用户在浏览器作答，点「提交本轮，生成追问 →」）
{"ok":true,"round":"r1","submitted_at":"2026-08-20T12:00:00Z","answers":[…]}
# 进程退出 → 宿主自动唤起 agent → agent 读此输出，
# 映射回 session.mjs round 行落盘，发布 Round 2……循环直到收口
```

人看到什么：终端每个回合只有两三行命令输出；问答全部发生在浏览器单页；
右栏「已锁定结论」随轮次累积；门禁横幅在开放歧义归零时变绿。

## 场景 2 · 隔天（宿主关闭过夜，场景 Q1-A 采纳的直接后果）

```console
# 前夜：宿主关闭。server 是 detached 守护进程，继续存活（默认 48h 空闲超时）。
# 用户次日早上直接在仍开着的页面点「提交本轮」：
#   → server 落 submissions/r2.json（成功回执，页面锁定本轮）
#   → wait-submit 后台任务已随宿主会话死亡，无人被唤醒——这是预期行为

# 用户重开 ZCode，续跑同一 issue：
$ node .agents/skills/workflow-interview/scripts/session.mjs list
# 找到 issue → SKILL 续跑协议：
#   1) 读 manifest 定位阶段
#   2) 探活 server（活着则复用 URL；死则重启，state.json 使页面原样恢复）
#   3) 扫 web/submissions/ 发现未消化的 r2 → 先吸收落盘再继续
#   4) 重新挂 wait-submit 后台任务，回到场景 1 循环
```

## 场景 3 · 降级（宿主无后台任务能力）

```console
# SKILL.md 指示：发布后不挂后台任务，直接结束回合，页面底部提示改为
# 「答完请回到当前任务发送任意消息」；下一回合先读任务消息、再读
# submissions（冲突以任务文本为准，并向用户说明冲突）。
# 行为与 aes-grilling-web 回合边界协议一致。
```

## 场景 4 · 现有用法保持不变（改完必须逐字节一样能跑）

```console
$ node .agents/skills/workflow-interview/scripts/session.mjs init 2026-08-20-别的任务
$ node .agents/skills/workflow-interview/scripts/session.mjs list
# 未显式调用 $workflow-interview-web 时：无 server、无 web/ 目录、
# 无端口占用；终端问答流程与今天完全一致。
$ node .agents/skills/aes-grilling-web/scripts/start-server.ps1   # 如常
# aes-grilling-web 照旧占 19432；两者并存互不感知。
```

## 测试运行（验证基建主途径）

```console
$ node .agents/skills/workflow-interview-web/scripts/run-tests.mjs
check 1  server start → server-info 落盘 → /api/state 200（带 key）
check 2  无 key 访问 403
check 3  POST /api/submit 200 → submissions/<round>.json 落盘
check 4  重复提交 409 duplicate_round
check 5  必答缺失 422 missing_required
check 6  publish.mjs pct 和 ≠100±2 拒收
check 7  wait-submit：已有提交立即退出并打印 JSON
check 8  wait-submit --timeout-ms 500 超时退出码 2（该开关仅供测试）
check 9  /files/ 越权路径 404
check 10 shutdown → 进程退出、server-stopped 标记
10/10 passed
```

退出码约定：`0` 成功；`2` wait-submit 超时（仅测试模式出现——生产无超时）；
`1` 其余错误（stderr 一行人读原因）。
