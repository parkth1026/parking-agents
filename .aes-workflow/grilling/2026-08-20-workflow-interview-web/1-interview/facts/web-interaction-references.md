# Fact: 外部 Web 交互参考（superpowers/brainstorming、open-design、.dc.html）

- 派遣问题：三个参考各自的交互机制是什么？双向唤醒在 open-design 里如何实现？目标 UX（.dc.html）长什么样？
- 完成：2026-08-20T00:00:00Z（计划阶段探索代理汇总）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| superpowers/brainstorming 是 aes-grilling-web 的上游：同款「写 HTML 进 screen_dir → WS reload → 点击写 events → 用户回终端发消息」文件协议；浏览器事件只是辅助，终端消息为主 | `AI_WorkFlow_ref/superpowers/skills/brainstorming/visual-companion.md` |
| open-design 双向的本质：agent 消息内嵌声明式 `<question-form>` JSON，发完**停止回合**；用户在浏览器提交（无论隔多久），提交 = `formatFormAnswers` 序列化为普通用户消息 `POST /api/chat` → 守护进程开启**新回合**。无轮询、无等待、无自建表单服务器——聊天流就是传输层 | `open-design/AGENTS.md:226-238`；`apps/web/src/artifacts/question-form.ts`；`apps/web/src/components/QuestionForm.tsx` |
| open-design 表单规范：每表单 ≤5 题；每题预填推荐 default；`default` 键写在 `options` 前（流式渲染）；`</question-form>` 后立即停回合不写代码；id/type/option value 保持英文稳定，label 本地化；类型 radio/checkbox/text/textarea/select/number/…；有限选项自动附「Other」自由输入；跳过记 `(skipped)` | `apps/daemon/src/prompts/discovery.ts`；`question-form.ts` |
| open-design 有 10 分钟自动续走倒计时（未答按 skipped 提交）——与本次「无超时」要求相反，不采用 | `QuestionForm.tsx` |
| 本宿主（ZCode）的等价唤醒通道：Bash 工具 `run_in_background: true` 的官方语义「detached 运行、跨回合存活、**退出时重新唤起 agent**」——后台任务退出通知即「新用户消息」 | ZCode Bash 工具文档（系统级） |
| .dc.html 目标 UX：顶栏 = 3 阶段面包屑（完成变 ✓ 绿）+ 实时「开放歧义 N」计数胶囊（>0 赤陶红/=0 绿）+ CTA（未就绪灰）；主体 = 左流程列（开场卡→轮次问题卡→研究间奏→门禁横幅）+ 右「已锁定结论」实时累积栏；终态切换为长文档视图（分节+「依据」溯源行） | `ClaudeWork/Design/projects/221d22fb.../收敛-单页全流程.dc.html` |
| .dc.html 问题卡组件：chip 圆角选项（选中=墨色填充；默认项=虚线绿边标「（默认）」；多选=13px 勾选框）；每题 Other 自由文本胶囊；状态药丸（红「不可逆·值得选」/绿「已带默认·可不答」/灰「此前已答」）；每轮底部「提交本轮，生成追问 →」 | 同上 |
| .dc.html 视觉语言：暖纸 #F7F5F0 / 墨 #201D18 / 赤陶 #C4501E / 鼠尾草绿 #3D7A4E / 发丝线 #E6E1D6；Noto Serif SC 衬线标题 + Space Grotesk 眉标（宽字距大写）；白卡 1px 边 10-12px 圆角；fadeUp 入场动画；深色反白卡用于开场陈述 | 同上 |
| .dc.html 状态机：线性 phase（开场→研究→W1→W2→交付标准→终态）；答案存 chip 索引 + others 自由文本；右栏与歧义计数由答案派生重算；阶段推进自动滚底 | 同上 DCLogic |

## 未知项

- open-design 桌面端（Electron）与 daemon 的进程细节——与本次无关（我们只要表单交互模式）

## 没查的

- open-design ~200 个设计技能目录内容（与传输机制无关）
