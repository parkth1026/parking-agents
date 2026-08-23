# Fact: aes-grilling-web 运行时机制

- 派遣问题：aes-grilling-web 的 Web runtime 如何实现（服务、发布、回传、生命周期）？「单向」具体缺什么？哪些可复用？
- 完成：2026-08-20T00:00:00Z（计划阶段探索代理汇总）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| 数据层并非纯单向：浏览器 WS 事件带 `choice` 字段会追加到 `<state_dir>/events` JSONL，agent 下一回合读取——缺的是自由文本作答、整轮表单提交语义、以及 agent 被浏览器唤醒 | `scripts/server.cjs` handleMessage；`references/visual-companion.md:93-112` |
| server.cjs（约 25KB，零依赖）：手写 RFC6455 WebSocket + HTTP；token 鉴权（URL ?key= + HttpOnly SameSite=Strict cookie + 常时比较 + WS 同源校验）；环回绑定 | `scripts/server.cjs` |
| 端口策略：显式 PORT → 项目级粘性端口文件 → 随机 49152+16383；默认端口 19432；EADDRINUSE 回退随机端口 | `server.cjs` preferredPort() |
| 发布模型：agent 原子写完整 HTML 进 content/；fs.watch + 100ms debounce；新屏会**清空旧 events**；WS 广播 reload → 页面 location.reload()；无 JSON 模板，每屏都是手写 HTML | `server.cjs`；`visual-companion.md:56-81` |
| 浏览器侧 helper.js：注入每个页面；点击 `[data-choice]` 上报；断线队列+指数退避重连（500ms→30s）+15s 墓碑遮罩；sessionStorage 只存会话 key；无 fetch/XHR POST | `scripts/helper.js` |
| 协议红线（该技能自我约束）：发布页面后结束回合不循环等待；不许 Hook/插件/MCP 通知/CLI resume/文件轮询/无限等待模拟唤醒；下一回合任务文本为主、events 为辅，冲突以任务文本为准；最终契约确认必须回任务文本 | `SKILL.md:27-28, 56-74` |
| 生命周期：owner-PID 看门狗（60s 探活）+ 默认 4h 空闲超时 + stop 脚本双重身份校验（PID + 随机 server-id 出现在进程命令行）；Windows 默认 .ps1、MSYS 下自动前台并清 OWNER_PID | `server.cjs`；`start-server.sh`；`stop-server.ps1/.sh` |
| 静态审计已标记问题：`../aes-grilling/SKILL.md` 断链；description 太弱触发不可靠；.cjs + .ps1/.sh 违反仓库 .mjs/无 PowerShell 约定（被记为特例） | `docs/reports/skill-static-audit-2026-08-17/report.md`（S1 #1 等） |
| 可复用的成熟逻辑：token 鉴权全链、粘性端口、原子发布+watch+广播、WS 手写实现、断线重连队列、身份校验式停止 | `server.cjs` / `helper.js` 整体 |

## 未知项

- 无

## 没查的

- open-design 与 .dc.html 的交互机制（另见 web-interaction-references.md）
