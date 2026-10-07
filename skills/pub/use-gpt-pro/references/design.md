# design: use-gpt-pro

## 意图与触发场景

用户在 ZCode 主会话里要让 ChatGPT Pro（chatgpt.com 网页端，Pro 套餐）作为外部高级工程师参与工作：深入调研、方案设计、写代码、外部评审，并要求多轮来回（追问、纠错），而不是一次性问答。触发语如「问问 GPT Pro」「让 ChatGPT Pro 分析/设计/评审/写代码」「用外部高级工程师交叉验证」。产出形态：完成多轮协作后，把结论与主 agent 的独立验证证据带回主会话，全程转录落盘。

## 设计取舍

- 由 codex-use-gpt-pro（2026-10-07 改名）迁移：宿主从 Codex 内置浏览器换到 ZCode browser-use。browser use 不支持文件上传，上下文投递从「ZIP 打包上传 + SHA-256 基线」改为「消息文本内联 + 分块标记（第 i/N 块）」——该约束与解法沿用 use-deepseek 的实证结论。
- 触发从纯手动（disable-model-invocation: true）改为可模型触发的场景描述，与 use-deepseek 同族对齐。
- 协议五步结构（接入/整理任务/消息循环/转录持久化/独立验收）与 use-deepseek 同构；本文件只写 ChatGPT Pro 增量。
- UI 知识放 `references/chatgpt-ui.md` 并声明「锚点非契约」：ChatGPT 前端会改版，固化选择器必然过时；文档只回答「该找什么」。
- 模型选择器（Pro 模式）由用户手动选定，agent 只读显示不点击——对齐 use-deepseek 2026-09-28 的用户裁定（开关由用户管理）。差异：DeepSeek 侧连「读取」都禁止（实测状态读取与实际相反）；ChatGPT 侧的显示文本是所见即所得的快照事实，允许只读。
- 保留 codex-use-gpt-pro 的独有资产：Pro 长思考耐心协议（数十分钟不催促不打断）、Passkey/两步验证交还用户、模拟测试不得说成生产验证、交付代码先落成文件再验收。
- 生成完成判定用多信号（停止按钮消失/输入框恢复/长度稳定）而非固定延时：单信号与固定等待都会被长思考模式或 UI 改版击穿。
- 每轮往返即时落盘 JSONL 转录：多轮对话超出上下文窗口后，转录是恢复现场与最终报告的唯一可靠凭据。

## 验收条件

| 编号 | 条件 | 类型 |
| --- | --- | --- |
| AC-1 | SKILL.md frontmatter 合规：name=use-gpt-pro、description 非空且 ≤1024 字符、无尖括号、全文无待办占位 | script |
| AC-2 | 正文含接入护栏：指涉 control-browser 通用协议、优先接管既有标签页（tabs.list/user.openTabs）、登录或验证码即停 | script |
| AC-3 | 正文含凭据红线：密码/Cookie/验证码不代填不索取，凭据类内容不外发 | script |
| AC-4 | 正文含消息循环（发送/等待/读取/落盘）且指向 chatgpt-ui.md 的完成判定，含「不催促、不重发」约束 | script |
| AC-5 | chatgpt-ui.md 存在且声明以现场快照为准，含完成判定多信号 | script |
| AC-6 | design.md 验收表无待办占位 | script |
| AC-7 | 实机冒烟：找到或新建 chatgpt.com 会话，完成 ≥1 轮「发送→等待完成→读回全文→转录落盘」 | manual |

## 迭代记录

<!-- 行格式: | 日期 | 改了什么一句 | 本轮 vs 上轮 won/lost/tie | 拆分建议结论(如有) |；只追加不回改 -->
| 日期 | 改了什么 | 轮次结果 | 拆分建议 |
| --- | --- | --- | --- |
| 2026-10-07 | 改名 use-gpt-pro 并从 Codex 内置浏览器迁到 ZCode browser-use（协议对齐 use-deepseek） | 未跑评测轮 | 无 |
| 2026-10-07 | 实机冒烟 AC-7 通过（会话 /c/6ac5a4a0-...，1 轮往返，模型自述 GPT-6 Astra Pro）；与 use-deepseek 互学：补 references/chatgpt-ui.md（含实测记录）、design.md、run-tests.mjs 三件套，模型选择器改为用户手动管理 | 冒烟通过（非评测轮） | 无 |
