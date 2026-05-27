# VS Code 性能优化 — 已应用配置（可复制到其他机器）

> 应用日期：2026-05-27  
> 适用场景：Copilot Chat 长对话 + UE5/大型 C++ 项目

---

## 文件 1：argv.json

> **位置**：`%USERPROFILE%\.vscode\argv.json`  
> **注意**：`crash-reporter-id` 每台机器不同，保留原值即可。修改后需重启 VS Code。

```json
{
	// "disable-hardware-acceleration": true,

	"enable-crash-reporter": false,

	"crash-reporter-id": "保留本机原有值",
	"locale": "zh-cn",

	// 性能优化：Extension Host 堆内存 8GB，防止长对话 OOM
	"js-flags": "--max-old-space-size=8192",

	// 阻止 Windows 遮挡检测降级 WebView 渲染
	"disable-features": "CalculateNativeWinOcclusion"
}
```

---

## 文件 2：settings.json（性能相关部分）

> **位置**：`%APPDATA%\Code\User\settings.json`  
> **操作**：将以下内容合并到已有 settings.json 的末尾（`}` 之前）。

```json
    // ===== Copilot 性能优化 =====
    "github.copilot.nextEditSuggestions.enabled": false,
    "github.copilot.chat.anthropic.thinking.budgetTokens": 16000,
    "github.copilot.chat.anthropic.thinking.forceExtendedThinking": false,

    // ===== 编辑器渲染优化 =====
    "editor.minimap.enabled": false,
    "editor.bracketPairColorization.enabled": false,
    "editor.occurrencesHighlight": "off",
    "editor.cursorSmoothCaretAnimation": "off",
    "editor.wordBasedSuggestions": "off",
    "editor.renderWhitespace": "none",
    "editor.hover.delay": 500,

    // ===== 工作台 =====
    "workbench.editor.limit.enabled": true,
    "workbench.editor.limit.value": 8,

    // ===== 资源管理器 & 搜索 =====
    "explorer.autoReveal": false,
    "search.followSymlinks": false,

    // ===== Git =====
    "git.autorefresh": false,
    "git.decorations.enabled": false,

    // ===== 遥测 & 更新 =====
    "telemetry.telemetryLevel": "off",
    "extensions.autoUpdate": false,

    // ===== 文件监视排除（大项目关键）=====
    "files.watcherExclude": {
        "**/Binaries/**": true,
        "**/Intermediate/**": true,
        "**/Content/**": true,
        "**/DerivedDataCache/**": true,
        "**/Saved/**": true,
        "**/.git/objects/**": true,
        "**/node_modules/**": true
    },

    // ===== 搜索排除 =====
    "search.exclude": {
        "**/Binaries": true,
        "**/Intermediate": true,
        "**/Content": true,
        "**/DerivedDataCache": true,
        "**/node_modules": true
    }
```

---

## 手动操作：Windows Defender 排除

> 路径：Windows 安全中心 → 病毒和威胁防护 → 管理设置 → 排除项 → 添加文件夹

添加以下目录：

1. `%USERPROFILE%\.vscode\`
2. `%APPDATA%\Code\`
3. VS Code 安装目录（如 `D:\Program Files\Microsoft VS Code\`）
4. 工作区根目录（如 `G:\P4_SH\neon\AES_v5\TEST_5.5\Plugins\`）

---

## 效果说明

| 改动 | 效果 |
|------|------|
| `max-old-space-size=8192` | 长对话卡顿阈值从 ~20 轮推迟到 ~60+ 轮 |
| `CalculateNativeWinOcclusion` 禁用 | Chat WebView 不因窗口遮挡被降级渲染 |
| `nextEditSuggestions` 关闭 | Extension Host CPU 占用降 ~30% |
| `thinking.budgetTokens` 降到 16000 | 简单问题响应更快 |
| `forceExtendedThinking` 关闭 | 不强制所有问题都深度思考 |
| `files.watcherExclude` | UE5 编译产物不触发文件监视，主进程 IO 大幅降低 |
| `minimap` + `bracketPair` 关闭 | 大文件编辑器帧率明显提升 |
| `git.autorefresh` 关闭 | 大仓库不自动扫描 git 状态 |
| Defender 排除 | 消除实时扫描对文件读写的延迟 |

---

## 对话中自救

感觉卡时：`Ctrl+Shift+P` → `Developer: Reload Window`（保留历史，重置 WebView DOM）
