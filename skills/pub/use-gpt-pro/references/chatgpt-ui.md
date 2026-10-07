# ChatGPT 网页端 UI 地图（chatgpt.com）

本文是「该找什么」的锚点提示，不是选择器契约。ChatGPT 前端会改版——任何元素定位都以现场 `domSnapshot()` 的事实为准，本文只帮你省去「不知道页面上有什么」的摸索。首次接入、找不到元素、判定生成是否结束时读本文。

## 页面结构

- 左侧栏：导航（Home / Space / Scheduled / Plugins / Explore）+ New chat 入口 + Recents 历史会话列表（每项含标题与会话链接 `/c/<id>`）。
- 主区：消息流。你的消息与回复交替出现；回复以 Markdown 渲染。
- 底部：输入区。多行文本框（accessible name 通常为 `Ask ChatGPT`）+ 发送按钮（`Send`）+ 附件与语音入口。
- 输入框旁有模型选择器（`Select ChatGPT model`），其可见文本显示当前模式（如 `Pro`）。

## 输入与发送

- 用 `fill()` 把全文写入文本框，然后点发送按钮——不要用 Enter 键发送。
- **标准 Playwright `click()` 在 Send 按钮上会 actionability 超时**；对该唯一定位执行页面内点击 `locator.evaluate(el => el.click())` 可靠。
- 发送成功的判据：输入框清空 + URL 变为 `/c/<id>`。注意两阶段 URL：先出现 `/c/local-chatgpt:<uuid>`（本地临时 ID），数秒内落定为正式 `/c/<uuid>`——恢复会话时以正式 URL 为准。
- 一次只发一条消息；它生成期间不输入下一条。

## 模型选择器

- 长思考模式（Pro 模式）由用户手动选定；agent 只读当前显示的可见文本，不点击、不改动选择器。
- 需要长思考而当前显示不是 Pro 模式时，停下请用户切换，不代操作。

## 生成完成判定（多信号，任一单信号都不可靠）

1. 「停止」按钮出现后消失；
2. 输入框恢复可输入状态；
3. 最新回复文本长度在间隔 ≥5 秒的两次采样中不再增长。

Pro 模式的长思考可达数十分钟：耐心轮询，不催促、不点停止、不重发。判定「卡死」前至少观察数分钟无任何文本增长。

## 读取回复

- 目标是「最后一条回复」的消息容器：从快照按消息顺序定位——你的消息（`You said:`）之后紧邻的回复块（`ChatGPT said:`）即目标。
- 长回复优先对该容器用 `innerText()` 取全文；快照可能截断长文本。
- 回复底部有操作条（Copy / Rate / Share / Regenerate 等），读文本时不要点到它们。

## 会话管理

- 相互独立的任务各开一个新对话（防上下文污染）；同一任务的追问留在同一会话。
- 继续既有任务：从左侧 Recents 列表按标题找回并点入。
- 页面刷新/断线后：重进会话列表找回原会话，从最后完成的位置继续，不要新开会话丢上下文。
- 把所用会话的标题与 URL（`/c/<id>`）写进转录与最终报告。

## 实测记录

<!-- 实机验证后按日期追加：哪些锚点成立、哪些已过时、UI 改版后的新判据。只追加不回改。 -->

### 2026-10-07 冒烟（中文界面账号，ZCode IAB，会话 /c/6ac5a4a0-e3bc-83ec-afda-884f77351b82）

- 输入框 accessible name 为 `Ask ChatGPT`；发送按钮 accessible name 为 `Send`，fill 后由 disabled 转 enabled。
- 发送键标准 `click()` 超时（与 use-deepseek 的 DeepSeek 发送键同款抖动），页面内 `evaluate(el => el.click())` 一次成功；fill 的文字在超时期间未丢失。
- 两阶段 URL 实测成立：发送成功后 URL 先为 `/c/local-chatgpt:76802d0a-...`，生成完成后已落定正式 `/c/6ac5a4a0-...`。
- 停止按钮出现-消失判定实测有效：普通问答约 27 秒生成完成，停止按钮消失即完成。
- 回复结构锚点：`You said:` / `ChatGPT said:` 两级 heading 分段；模型选择器可见文本显示 `Pro`。
- 首轮接管时 `Open profile menu` 处于 disabled 且显示 `Loading profile`——这是登录加载暂态，不是登录墙；数秒后自动就绪。未登录的判据是出现登录/注册入口，而非此暂态。
