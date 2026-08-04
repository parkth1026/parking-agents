# Visual Companion 协议

本协议及 `scripts/` 是 `aes-grilling-web` 自带的 Web runtime。运行时只需要 Node.js 和
Bash，不读取 Superpowers 的安装目录、插件缓存或 checkout；用户只安装本技能目录即可运行。

初始实现基于 `obra/superpowers` 的 MIT 许可代码演化，许可证见
[SUPERPOWERS-LICENSE.txt](SUPERPOWERS-LICENSE.txt)。来源声明只用于许可证合规，不代表安装
或运行依赖。

## 何时使用

只有当“看”比“读”更容易理解时才使用浏览器，例如流程、结构、并排方案或状态关系。概念问题、
简短取舍和正式批准回到当前任务文本。

## 启动

只要求 Node.js。按宿主选择技能自带入口。

Windows 默认使用 PowerShell，不需要 Bash：

```powershell
$env:AES_GRILLING_WEB_PROJECT_DIR = "<target-repository-root>"
& "<skill-dir>\scripts\start-server.ps1"
```

如需在首屏发布后自动打开浏览器，启动前设置
`$env:AES_GRILLING_WEB_OPEN = "1"`。PowerShell 7 和 Windows PowerShell 5.1 使用同一入口。

macOS、Linux 或明确使用 Git Bash 时：

```bash
bash "<skill-dir>/scripts/start-server.sh" \
  --project-dir "<target-repository-root>" \
  --open
```

脚本输出一行 JSON：

```json
{"url":"http://localhost:19432/?key=...","screen_dir":"...","state_dir":"...","pid":1234,"reused":false}
```

保存 `url`、`screen_dir`、`state_dir` 和 `pid`。`--open` 会在首屏可用时打开浏览器；仍向用户
提供 URL 作为远程或无头环境的后备。服务默认只绑定 loopback，URL key 同时保护 HTTP 与
WebSocket；不要删除 key 或把服务暴露到不可信网络。

两个入口都会让同一项目复用端口、token 和浏览器标签。并发项目使用各自的 session。
未显式指定项目目录时，以当前工作目录为目标仓库；仍只写入其
`.aes-workflow/aes-grilling-web/`，不得回退到系统临时目录或 `.superpowers/`。

Git Bash 下，随附 `.sh` 会自动以前台模式保持服务存活；宿主应把它作为可继续读取的
长运行命令启动，取得首行 `server-started` JSON 后继续当前工作，结束时再精确停止。不要为了
让命令立即返回而改造出第二个后台 Agent。

## 发布屏幕

将完整 HTML 文件原子写入 `screen_dir`。避免用户看到半写文件：先写临时文件，再重命名为
最终 `.html`。页面内容由当前 Agent 生成并视为可信代码；不得拼接未转义的仓库文本或用户
自由输入。

最小结构：

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AES 需求收敛</title>
</head>
<body>
  <main>
    <p>已调查事实：……</p>
    <h1>这个材料决定应选哪一种？</h1>
    <button data-choice="option-a">方案 A（推荐）</button>
    <button data-choice="option-b">方案 B</button>
    <p>选择后，请回到当前任务发送任意消息；同一个 Agent 会继续。</p>
  </main>
</body>
</html>
```

可交互元素使用 `data-choice="<stable-value>"`。Helper 会暴露：

```js
window.aesGrillingWeb.choice("option-a")
window.aesGrillingWeb.send({ type: "choice", value: "option-a" })
```

使用稳定、语义化的 `value`，不要把显示文本当协议键。若需要多个决定，事件 payload 必须带
决定 ID，避免相同 value 混淆。

## 下一回合读取

点击会追加到：

```text
<state_dir>/events
```

每行一个 JSON 对象。新屏发布时旧 events 会被清理，所以在覆盖屏幕前先读取并吸收当前事件。

同一 Agent 的下一回合按以下顺序：

1. 读取当前任务的新消息；
2. 读取 `state_dir/events`（若存在）；
3. 合并输入，冲突时以任务消息为准；
4. 更新决定前沿；
5. 原子发布新屏，或发布 waiting screen 后转回文本。

浏览器选择后不会主动唤醒 Agent。不要轮询 events，不要让模型长时间保持运行；发布后结束
回合，等待用户回到当前任务发消息。

## Waiting screen

当下一步回到文本时，覆盖陈旧屏幕：

```html
<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>请回到当前任务</title></head>
<body>
  <main>
    <h1>下一步在当前任务中继续</h1>
    <p>浏览器选择已记录。请回到当前任务发送消息；同一个 Agent 会继续。</p>
  </main>
</body>
</html>
```

## 停止

结束或放弃会话时，Windows 使用：

```powershell
$env:AES_GRILLING_WEB_STATE_DIR = "<state_dir>"
& "<skill-dir>\scripts\stop-server.ps1"
```

macOS、Linux 或 Git Bash 使用：

```bash
bash "<skill-dir>/scripts/stop-server.sh" "<session_dir-or-state_dir>"
```

脚本只停止该 session 记录且身份匹配的精确服务进程。服务也会在 owner 消失或默认四小时空闲
后退出。不要按进程名批量终止 Node。

## 失败与降级

- Bash、Node 或浏览器不可用：告知用户后继续同一 `aes-grilling` 纯文本语义。
- URL 无法访问：先提供带 key 的输出 URL；远程绑定必须由用户明确授权。
- `events` 不存在：只使用当前任务文本。
- 页面已过期：不要解释为用户批准，重新发布当前 revision。

## 临时文件边界

- runtime：`.aes-workflow/aes-grilling-web/<session>/`
- 测试：`.aes-workflow/test-runs/<run>/`
- 浏览器验收：`.aes-workflow/aes-grilling-web/evidence/<run>/`

运行浏览器 CLI 时先把工作目录切到本次 `evidence/<run>/`，使其内部 `.playwright-cli/` 也留在
`.aes-workflow/`。不得在仓库根目录生成 `.playwright-cli/`，不得把截图写入 `output/`。
