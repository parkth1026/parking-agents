---
name: workflow-interview-web
description: "workflow-interview 的本地 Web 双向入口：三阶段问题、原型质疑与契约确认都在同一浏览器单页完成，并支持提交唤醒与跨会话吸收。"
disable-model-invocation: true
---

# workflow-interview · Web 入口

这是 `workflow-interview` 的交互薄层，不是第二套访谈逻辑。显式调用
`$workflow-interview-web` 就表示用户选择了 Web 入口；直接开始调查并发布第一轮有价值的
内容，不让用户重复输入任务。

开始前完整读取并遵守 [../workflow-interview/SKILL.md](../workflow-interview/SKILL.md)、
[../workflow-interview/references/asking.md](../workflow-interview/references/asking.md) 与当前
阶段子技能。三阶段门禁、提问分诊、确认版产物和 Goal Contract 仍由家族技能定义；本技能
只替换提问、展示和确认的载体。

首次运行或处理续跑时读 [web-protocol.md](references/web-protocol.md)。需要改页面结构、
状态字段或附件呈现时再读 [design.md](references/design.md)。

## 每个 Web 回合

1. 用家族 `session.mjs init` 建立或读取 issue，读 manifest 定位阶段。
2. 先扫描未消化提交。逐项映射成家族 round 行，通过 `session.mjs round` 写入；全部成功后
   才标记该 Web round 已消化。Web 文件不是 `rounds.jsonl` 的替代真源。
3. 按当前阶段完成事实调查、分诊或对照物/契约候选。把本轮声明式 JSON 原子发布到页面；
   原型文件作为附件发布，契约用 `view: "contract"` 的 round 发布。
4. 启动或复用 issue 自己的 loopback server。把 `wait-submit.mjs --round <id>` 作为宿主
   后台任务运行，不设超时，然后结束当前 Agent 回合。
5. 用户在浏览器提交后，后台任务退出通知唤起当前 Agent。回到第 2 步，直到当前阶段收口；
   阶段推进仍只调用家族 `session.mjs stage` / `finalize`。

提交必须先入 `web/submissions/` 再向页面回执。只有 `session.mjs round` 成功之后才能写
`web/consumed/` 标记；中途失败时保留未消化状态，下一会话会再次发现它。

## 续跑协议

每次重开任务都按此顺序：读 manifest → 扫描未消化提交 → 吸收并标记 → 探活或重启 server
→ 若仍有 pending round，重新挂后台等待；没有就发布下一轮。server 只保活提交入口与状态，
不保活 Agent。默认 48 小时空闲退出；进程退出不删除 state、submission 或草稿。

## 真源与安全边界

- `manifest.json` 只由家族 `session.mjs` 写；`rounds.jsonl` 只经 `session.mjs round` 追加。
- runtime 脚本不 import 家族代码；浏览器不直接读写家族过程文件。
- 每个 issue 独立 `web/` 目录。服务只绑定 loopback，所有 HTTP/WS 请求都经会话 key；key
  只存在于 owner-only 会话文件和首次 URL，不写日志或 git。
- 确认版对照物保持只读。发布附件是复制到 `web/assets/`，不改源文件。
- 本技能只收敛并交付 Goal Contract，不实现 Contract 里的任务目标。

## 降级阶梯

1. **宿主无后台任务能力 → 回合模式。** 仍可发布 Web 页面；提交后页面提示用户回当前任务
   发任意消息。下一回合先读任务文本、再读 submission；冲突以任务文本为准并说明。
2. **Node 不可用 → 纯文本。** 直接使用 `workflow-interview` 原流程，三阶段范围与门禁不变。
3. **浏览器不可用 → 纯文本。** 直接使用 `workflow-interview` 原流程，三阶段范围与门禁不变。

不得用 hook、插件、MCP 通知、CLI resume、模型侧轮询或无限阻塞模拟唤醒；主路径只依赖
宿主后台任务退出通知，降级时使用上面的明确回合边界。

## 收尾

契约确认提交吸收后照常运行家族 `finalize`。报告契约路径、目标、范围、验收条数、校验结果、
非 `[A]` 验收面与精确交接指令。显式停止 server；盘上的 state/submissions/consumed 保留为
会话证据。
