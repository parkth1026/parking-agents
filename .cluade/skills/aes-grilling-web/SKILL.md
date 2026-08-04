---
name: aes-grilling-web
description: "使用本地 Web Companion 对齐材料决定，并生成可直接交给执行 Agent 的轻量 Goal Contract。"
disable-model-invocation: true
---

# AES 需求收敛（Web）

这是 `aes-grilling` 的 Web 入口，不是第二个 Agent，也不是插件或外层编排器。

开始前完整读取并遵守 [../aes-grilling/SKILL.md](../aes-grilling/SKILL.md)。除交互载体外，
事实边界、决定前沿、轻量 Goal Contract、最终确认、验证和交接规则完全相同。

## 唯一机制

浏览器能力由本技能目录完整持有：

```text
当前 Agent 写 HTML
  → skills/productivity/aes-grilling-web/scripts 中的本地 Node 服务监视 screen_dir
  → WebSocket 让同一浏览器页面刷新
  → data-choice 点击写入 state_dir/events JSONL
  → 用户回到当前任务发送消息
  → 同一 Agent 下一回合读取事件并继续
```

浏览器只是视觉展示/选择工具，不启动后台 Agent，不能唤醒已结束的 Agent。不要使用 Hook、
插件、MCP 通知、CLI resume、文件轮询或无限等待来模拟唤醒。

显式调用 `$aes-grilling-web` 即表示用户选择了 Web 入口，不再重复询问是否启用 Companion。
先完成仓库调查并形成第一个有价值的决定前沿，再启动服务并直接发布首屏；不要让用户在 Web
重新输入宿主 Prompt。

首次使用前完整读取 [references/visual-companion.md](references/visual-companion.md)，严格遵循
其中的启动、HTML、事件、安全、等待页和停止协议。启动、展示、事件持久化和停止只允许调用
本技能随附的 `scripts/`；不得查找、安装或调用 Superpowers、插件、MCP 或其他外部
Companion。用户只安装 `aes-grilling-web` 技能目录即可使用 Web 能力。

在 Windows 上必须默认使用同目录的 `start-server.ps1` / `stop-server.ps1`；只有当前宿主
明确运行在 macOS、Linux 或 Git Bash 时才使用 `.sh`。不要要求 Windows 用户安装 Bash。

所有会话、日志、测试临时目录和浏览器验收产物都必须位于目标仓库 `.aes-workflow/` 下。
不得写入 `.superpowers/`、系统临时目录、仓库 `output/` 或根目录 `.playwright-cli/`。

## 哪些内容进 Web

每个问题都重新判断：

- 用 Web：方案结构、流程图、状态关系、并列差异或其他“看比读更清楚”的材料决定。
- 用当前任务文本：概念澄清、事实说明、简短权衡和最终 Contract 确认。

AES Round 1 可以在同一屏展示全部互不依赖的材料决定；每个决定仍必须显示证据、why、推荐项
和代价。不要把非材料问题塞进 Web 来制造流程。

## 回合边界

发布页面后结束当前 Agent 回合，不循环等待。页面必须提示：

> 选择后，请回到当前任务发送任意消息；同一个 Agent 会读取你的选择并继续。

下一回合：

1. 先读取用户当前任务中的消息；它是主输入。
2. 再读取 `state_dir/events`；它是补充的浏览器交互。
3. 两者冲突时，以当前任务文本为准，并说明冲突。
4. 吸收本次事件后发布下一屏；切回文本步骤时发布 waiting screen 清除陈旧问题。

如果没有 events，按当前任务文本继续。不得声称另一个 Agent 已在后台处理。

## 最终确认

Web 点击只表达设计选择，不等于确认最终 Goal Contract。完整候选必须回到当前任务，由用户
确认内容或提出修改，再按 `aes-grilling` 的轻量模板落盘并验证。Contract 使用普通 Git diff
和 commit history 管理，不生成 hash、批准凭据或独立 handoff 附件。
