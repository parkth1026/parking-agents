# 影响面扫描: 2026-08-20-workflow-interview-web

判据：改完之后，这个程序在哪些地方跑起来不一样了？每一处不一样，谁会看见、谁会受影响？

本任务是**新建技能**（`.agents/skills/workflow-interview-web/`），不改任何现有文件；
「现状」= workflow-interview 家族的终端交互模式。

| # | 影响面 | 有/无 | 具体差异 | 谁受影响 | 对照物 |
| --- | --- | --- | --- | --- | --- |
| 1 | 用户可见界面 | **有** | 全新浏览器单页：顶栏阶段面包屑+开放歧义计数+CTA；左流程列（开场卡/三档问题卡/研究间奏/门禁横幅）；右「已锁定结论」累积栏；终态契约文档视图（含确认/需修改） | 显式调用 `$workflow-interview-web` 的用户 | `mock.html` |
| 2 | 可观察行为 | **有** | 提问载体从终端文本+AskUserQuestion 变为网页整轮提交；提交经后台任务退出即时唤醒 agent；宿主关闭时 detached server 缓冲提交、重开吸收；无后台任务宿主降级回合模式 | 用户、执行该技能的 agent | `behavior.md` |
| 3 | 可运行输出 | **有** | 新增终端输出：server start/stop 的 JSON 行、wait-submit 退出时的提交 JSON、run-tests 结果 | 用户、agent、CI | `example-run.md` |
| 4 | 对外接口报文 | **有** | 新增本地 HTTP/WS 协议：GET /api/state、POST /api/submit（含幂等/未答校验）、WS 广播 state-updated/submitted、GET /files/<name>、GET /shutdown | 浏览器单页（唯一客户端）、run-tests | `api-mock.md` |
| 5 | 用户配置 | **有（轻）** | 环境变量 WI_WEB_PORT（默认 19433）、WI_WEB_IDLE_TIMEOUT_MS（默认 48h）；默认零配置即用 | 想改端口/超时的用户 | `behavior.md` 配置差异节 |
| 6 | 历史兼容性 | **无破坏** | 全新目录，零现有文件改动；rounds.jsonl/manifest schema 完全不变；既有 issue 目录照常续跑；与 aes-grilling-web 并存（19432/19433 不冲突） | 既有 workflow-interview/aes-grilling-web 使用者（应无感） | `behavior.md` 不变清单 |
| 7 | 架构与依赖 | **有** | 新组件：server.mjs（detached 守护）、publish.mjs、wait-submit.mjs、web 单页；文件（state.json/submissions/）为传输介质；对 workflow-interview 家族是薄层引用（不 import 其代码，靠 agent 串联两条 CLI） | 维护者、后续移植者 | `diagram.html` |

七面扫描结论：六面「有」一面「无破坏」，无跳过；五份对照物全部产出。
