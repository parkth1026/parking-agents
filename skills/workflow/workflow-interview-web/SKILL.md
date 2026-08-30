---
name: workflow-interview-web
description: "workflow-interview 的本地 Web 双向入口与完整决策档案。仅当用户显式调用 $workflow-interview-web、明确选择 Web 入口时使用；把三阶段问题、原型质疑、结构化多选与契约确认放在同一浏览器单页完成，并以 durable submission 与回 Agent 输入‘请继续’的人工 follow-up 为主路径，支持分层回执、跨会话吸收和自包含静态导出。"
compatibility: "需要同级安装 workflow-interview、aes-interview、aes-prototype 和 aes-goal-contract；Web 主路径需要 Node.js 与浏览器，但不需要保持模型 turn 等待。"
category: productivity
---

# workflow-interview · Web 入口

这是 `workflow-interview` 的交互与决策档案投影层，不是第二套访谈逻辑。收到显式调用后，直接开始调查
并发布第一轮有价值的内容，不让用户重复输入任务。

开始前完整读取并遵守 [../workflow-interview/SKILL.md](../workflow-interview/SKILL.md)、
[../workflow-interview/references/asking.md](../workflow-interview/references/asking.md) 与当前
阶段子技能。三阶段门禁、提问分诊、确认版产物和 Goal Contract 仍由家族技能定义；本技能
只替换提问、展示和确认的载体。

首次运行或处理续跑时读 [web-protocol.md](references/web-protocol.md)。需要改页面结构、
状态字段或附件呈现时再读 [design.md](references/design.md)。

## 每个 Web 回合

1. 用家族 `session.mjs init` 建立或读取 issue，读 manifest 定位阶段。
2. 先用 `wait-submit.mjs --scan --oldest` 扫描最早未消化提交（只得到身份摘要和答案数量）；恢复时用
   `--recovery-payload <round>` 取得当前 round 的有界问题/答案/身份载荷。逐项映射成家族
   round 行，通过 `session.mjs round` 写入；全部成功后才标记该 Web round 已消化。Web 文件
   不是 `rounds.jsonl` 的替代真源。
3. 按当前阶段完成事实调查、分诊或对照物/契约候选。把本轮声明式 JSON 原子发布到页面；
   原型文件作为附件发布，契约用 `view: "contract"` 的 round 发布。问题需要表达范围组合、
   数量、优先级、证据或长文本时，使用协议的结构化 response type，不把多选伪装成一串单选。
   页面通过 WebSocket 收到状态变化后重新读取 state 并原地 render；Agent 用 `/api/state` 或当前 DOM
   核验发布结果，不主动 reload 页面，避免打断用户正在编辑的草稿。
4. 启动或复用 issue 自己的 loopback server；主路径在发布 Web round 后结束当前模型 turn，不启动
   模型等待器、不派 subagent 等待。兼容命令 `wait-submit.mjs --round <id>` 只负责 watch-first
   transport 与 `persisted`，不得 arm continuation。
5. 用户在浏览器提交后，页面先显示 `persisted` 并明确提示“请回当前 Codex task 输入‘请继续’”。
   收到“请继续”或等价的人工恢复请求后，先运行 `wait-submit.mjs --scan`，再按
   `{session_slug, round, revision, digest}` 做持久幂等吸收；全部家族 `session.mjs round` 成功后
   才运行 `--mark-consumed`，直到当前阶段收口；阶段推进仍只调用家族 `session.mjs stage` / `finalize`。

提交必须先入 `web/submissions/` 再向页面回执。只有 `session.mjs round` 成功之后才能写
`web/consumed/` 标记；中途失败时保留未消化状态，下一会话会再次发现它。

## 续跑协议

每次重开任务都按此顺序：读 manifest → 扫描未消化提交 → 在用户“请继续”后吸收并标记 → 探活或
重启 server。server 只保活提交入口与状态，不保活 Agent；不因等待 Web 而保持模型 turn。默认
48 小时空闲退出；进程退出不删除 state、submission、ledger 或草稿。

页面的“决策档案”不是浏览器临时摘要：默认只从 server 投影当前 round 与上 3 个已锁定 round，
更早 round 通过显式分页读取；`/export` 和 `export-static.mjs` 才一次性导出完整 dossier。已提交
答案不能只存在 localStorage；页面刷新、跨会话重开和静态导出必须仍能完整解释“问了什么、有哪些
候选、为什么选、代价是什么、最终契约如何追溯”。

## 当前回合续接与人工恢复

continuation 是宿主控制面，submission 是必须先落盘的数据面。公开状态只允许使用以下闭集：

- `mode`: `current_turn_deferred` 或 `manual_followup`，默认是 `manual_followup`；`status`: `arming`、
  `awaiting_submission`、`submitted`、`resuming`、`manual_recovery_required`、`consumed`。
- `receipt_stage`: `persisted`、`agent_resumed`、`consumed`；HTTP 200 最多证明 `persisted`。
- `next_user_action`: `submit`、`send_message`、`none`。`arming` 与 manual 的提交前状态都保持
  `submit`，不因等待器未就绪而禁用输入。

runtime receipt 与 lease 位于 `<issue>/web/runtime/`，只有明确的 continuation authority 才能写入，并以
单调 `generation` 拒绝旧 owner。普通 manual 主路径不创建 lease；round JSON、浏览器请求、普通 CLI
flag 和环境变量不能声明 `current_turn_deferred`。runtime 文件不进入 dossier；页面只接收 normalized projection。

人工主路径提交后先经过 `persisted`，页面提示回当前 task 输入“请继续”；下一条人工消息的第一动作是
`--scan --oldest`，然后用 `--recovery-payload <round>` 只读取当前 submission，吸收成功后才
`--mark-consumed`。如需核对冲突或审计，才用 `--history <round> [--q-id <id>]` 定向读取；若未来有明确宿主 authority，可额外使用
`current_turn_deferred/agent_resumed`，但它不是本技能的默认承诺。`--claim-consume` 可在
家族 round 写入前建立持久 processing 记录，崩溃重试沿同一幂等键恢复，不重复追加同一 family round。

## 真源与安全边界

- `manifest.json` 只由家族 `session.mjs` 写；`rounds.jsonl` 只经 `session.mjs round` 追加。
- runtime 脚本不 import 家族代码；浏览器不直接读写家族过程文件。
- 每个 issue 独立 `web/` 目录。服务只绑定 loopback，使用固定的 plain URL，不设 session key、cookie
  或登录步骤；本技能面向单用户本机交互，状态完整性由 round revision/digest、原子 submission 和
  exactly-once consumed 协议保证。server 重启复用 sticky port，页面直接从持久 state 恢复。
- 确认版对照物保持只读。发布附件是复制到 `web/assets/`，不改源文件。
- `decision-ledger.jsonl` 是带摘要链的 Web 事件证据；家族过程文件与 Goal Contract 的权威性
  高于 ledger，浏览器草稿最低。
- 本技能只收敛并交付 Goal Contract，不实现 Contract 里的任务目标。

## 降级阶梯

1. **人工 follow-up 主路径。** 仍可发布 Web 页面；提交后页面提示用户回当前 task 输入“请继续”。下一回合先读任务文本、
   再运行 `--scan --oldest`、`--recovery-payload <round>` 吸收 submission；历史冲突以双方事实为准，
   用 `--history <round> [--q-id <id>]` 定向核对，明确裁决前不标记 consumed。没有明确宿主 capability 时不显示自动续接承诺。
2. **Node 不可用 → 纯文本。** 直接使用 `workflow-interview` 原流程，三阶段范围与门禁不变。
3. **浏览器不可用 → 纯文本。** 直接使用 `workflow-interview` 原流程，三阶段范围与门禁不变。

不得用 hook、插件、MCP 通知、CLI resume、模型侧轮询、subagent 等待或 detached waiter 退出模拟唤醒；
主路径只依赖持久 submission 与明确的人工“请继续”消息。只有未来明确的宿主 pending tool 真正返回时，
才可显示可选的自动回执。

## 收尾

契约确认提交吸收后照常运行家族 `finalize`。运行 `export-static.mjs` 生成自包含 HTML，并把
导出路径、dossier digest、契约路径、目标、范围、验收条数、校验结果、非 `[A]` 验收面与精确
交接指令一起报告。显式停止 server；盘上的 state/submissions/consumed/decision-ledger 保留为
会话证据。
