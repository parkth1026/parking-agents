<!-- draft v1 | published 2026-08-20T00:00:00Z
     用户意见：（待质疑）
     状态：confirmed（已晋升至 behavior.md） -->
# 行为对照表: 2026-08-20-workflow-interview-web

「现在」= workflow-interview 家族终端模式；「改后」= 显式调用 `$workflow-interview-web` 后。

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | agent 完成分诊、形成一轮问题 | 文本发完整问题块 + AskUserQuestion 收选择（≤4 题） | `node publish.mjs round --issue-dir <dir> --file <json>`：校验 schema（pct 和 100±2、三段、tier 枚举）后原子写 `<issue>/web/state.json`，server fs.watch → WS 广播 → 浏览器单页实时渲染整轮 |
| 2 | 用户作答 | 终端逐题回复或工具点选 | 浏览器内：提问区选项 chip 单选 + Other 自由文本；默认区「不反对」或「翻掉+一句理由」；确认区一键「确认」或「翻掉」；点「提交本轮」一次性整轮提交（POST /api/submit） |
| 3 | 提交完成 | 无此概念（终端消息即回合边界） | server 先落 `<issue>/web/submissions/<round>.json` 再回 200；同轮重复提交 409 拒绝（幂等） |
| 4 | agent 等待答案 | AskUserQuestion 阻塞收答案，或结束回合等终端消息 | agent 挂 `node wait-submit.mjs --round <id>` 为**后台任务（无超时）**后正常结束回合；提交落盘 → 任务退出 → 宿主自动唤起 agent 继续 |
| 5 | agent 被唤醒 | 用户回终端发消息（唯一通道） | 后台任务退出通知为主通道；唤醒后读 submissions/<round>.json，映射回 `session.mjs round '<json>'` 行（tier/q_id/user_choice/user_verbatim 齐全），rounds.jsonl 仍唯一真源 |
| 6 | 宿主会话关闭（过夜/重启） | server 随宿主死（aes-grilling-web 看门狗模式），页面变墓碑 | server 为 detached 守护（无 owner 看门狗），默认 48h 空闲超时兜底；页面仍可提交、提交入盘不丢；下次会话续跑协议**先扫未消化 submissions 再继续** |
| 7 | 会话重启续跑 | 读 manifest 从断点继续（终端交互） | 读 manifest 定位阶段 → 探活 server（死则以盘上 state.json 重启恢复页面）→ 吸收未消化提交 → 重新挂 wait-submit 后台任务 → 继续 |
| 8 | 2-prototype 对照物展示 | mock.html 等绝对路径请用户自己打开 | publish.mjs `--attach` 复制产物进 `<issue>/web/assets/`，单页附件卡 **iframe 内嵌** + 逐项质疑问题卡 |
| 9 | 3-contract 契约确认 | 终端文本确认（aes-grilling-web 红线） | 契约文档视图（分节+「依据」溯源）在单页呈现，「确认交付标准 ✓」/「需修改」+ 文本框都在 Web 完成；修改意见作为下一轮提交唤醒 agent |
| 10 | 阶段流转 | session.mjs stage 门禁（done 结构校验） | **完全不变**，agent 在被唤醒回合照常调 session.mjs；三阶段面包屑/歧义计数由 state.json 驱动渲染 |

### 边界值行（单独成行）

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| B1 | 同一轮第二次提交 | 无此概念 | 409 `{error:"duplicate_round"}`，页面提示已提交；首次提交内容为准 |
| B2 | 必答 ask 题未选就点提交 | 无此概念 | 前端拦截：未选题高亮 + 提交按钮禁用；绕过前端则 server 422 `{error:"missing_required",q_ids:[...]}` |
| B3 | Other 文本超长（>2000 字符） | 无此概念 | server 截断至 2000 并在提交回执标注 `truncated:true` |
| B4 | 浏览器刷新/误关 | 无此概念 | 未提交草稿从 localStorage 恢复；已提交轮次由 state.json 渲染锁定态，不丢 |
| B5 | server 进程死亡后页面提交 | 页面墓碑，点击丢失 | 页面断线重连（指数退避至 30s）；server 由下次会话重启恢复；提交期间断网走客户端离线队列，重连后补发 |
| B6 | 两个 issue 并发使用 | 不适用（无 web） | 各 issue 独立 web/ 目录与 server 会话；粘性端口被占则退随机端口，互不串台 |
| B7 | 宿主无后台任务能力（降级） | 不适用 | SKILL.md 指示降级为 aes-grilling-web 回合模式：发布后结束回合，页面提示「答完请回终端发消息」，任务文本优先 |
| B8 | Node/浏览器不可用（降级） | 不适用 | 直接走纯文本 workflow-interview 原流程，范围不变 |

## 不变清单

- asking.md 方法论零改动：三档分诊、批量问、三段选项、pct 加和 100±2、跨仓库边界一律提问区。
- `session.mjs` 全部命令与门禁逻辑零改动；`manifest.json` 仍只由 session.mjs 写。
- `rounds.jsonl` schema 与唯一写入口（session.mjs round）零改动；web 提交只是换了采集面。
- 既有 issue 目录（`.aes-workflow/grilling/<slug>/`）结构不变，老 issue 照常纯终端续跑。
- aes-grilling-web 本体一行不改（19432/19433 端口并存，两技能互不感知）。
- 未显式调用本技能时，workflow-interview 家族行为逐字节与现在一致。

## 配置差异

| 字段 | 现在 | 改后 | 迁移 |
| --- | --- | --- | --- |
| `WI_WEB_PORT` | 不存在 | 可选，默认 19433；粘性端口文件 `.aes-workflow/workflow-interview-web/.last-port` | 无需迁移，零配置即用 |
| `WI_WEB_IDLE_TIMEOUT_MS` | 不存在 | 可选，默认 172800000（48h） | 无需迁移 |
| 其他 | — | 无新增配置文件；config.json 不引入（零配置技能） | — |
