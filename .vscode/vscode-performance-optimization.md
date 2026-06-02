# VS Code 性能优化完整对比清单

> 生成日期：2026-05-27  
> 目标：解决 Copilot Chat 长对话卡顿 + UE5 大项目整体流畅度

---

## 📁 文件 1：`C:\Users\parking\.vscode\argv.json`

> ⚠️ 修改后需**重启 VS Code** 生效

| 参数 | 当前值 | 建议值 | 作用 |
|------|--------|--------|------|
| `js-flags` | ❌ 未设置 | `"--max-old-space-size=8192"` | Extension Host 堆内存上限 8GB，长对话不 OOM |
| `disable-features` | ❌ 未设置 | `"CalculateNativeWinOcclusion"` | 阻止 Windows 遮挡检测降级 WebView 渲染 |
| `disable-hardware-acceleration` | 注释状态（= 未启用） | 保持注释（不动） | GPU 加速应保持开启 |
| `locale` | `"zh-cn"` | ✅ 保持不变 | — |
| `enable-crash-reporter` | `true` | `false`（可选） | 关闭崩溃上报减少后台 IO |

> ⚠️ **风险提示**：
> - `max-old-space-size=8192`：**16GB 内存机器建议设 4096**，32GB+ 才用 8192。因为 VS Code 多进程（主进程 + Extension Host + LSP servers）各自独立占内存，8GB 上限可能导致系统 swap。
> - `CalculateNativeWinOcclusion`：Chromium 内部 feature flag，未来版本可能重命名或移除。
> - Node 18+ (VS Code 1.80+) 默认堆约 4GB（非旧版的 1.5GB），所以 8192 是在默认值上翻倍。

### 建议最终内容

```json
{
    // Use software rendering instead of hardware accelerated rendering.
    // "disable-hardware-acceleration": true,

    "enable-crash-reporter": false,
    "crash-reporter-id": "5ec4184e-2979-41de-8615-0698a7d3c1ab",
    "locale": "zh-cn",

    // 性能优化
    "js-flags": "--max-old-space-size=8192",
    "disable-features": "CalculateNativeWinOcclusion"
}
```

---

## 📁 文件 2：`%APPDATA%\Code\User\settings.json`

### 🔴 需要新增的设置（性能关键）

| 设置 | 当前值 | 建议值 | 作用 |
|------|--------|--------|------|
| `editor.minimap.enabled` | 未设置（默认 `true`） | `false` | 减少编辑器渲染开销 |
| `editor.cursorSmoothCaretAnimation` | 未设置（默认 `"on"`） | `"off"` | 去除光标动画 CPU 开销 |
| `editor.smoothScrolling` | 未设置（默认 `false`） | `false` | 确保关闭 |
| `editor.bracketPairColorization.enabled` | 未设置（默认 `true`） | `false` | 大文件括号着色很耗性能 |
| `editor.occurrencesHighlight` | 未设置（默认 `"singleFile"`） | `"off"` | 减少符号扫描 |
| `editor.wordBasedSuggestions` | 未设置（默认 `"matchingDocuments"`） | `"off"` | 大文件不做全词扫描补全 |
| `editor.renderWhitespace` | 未设置（默认 `"selection"`） | `"none"` | 减少渲染计算 |
| `editor.hover.delay` | 未设置（默认 `300`） | `500` | 减少频繁 hover 计算 |
| `editor.suggest.preview` | 未设置（默认 `false`） | `false` | 确保关闭 |
| `editor.largeFileOptimizations` | 未设置（默认 `true`） | `true` | 确保大文件优化开启 |
| `workbench.list.smoothScrolling` | 未设置（默认 `false`） | `false` | 确保关闭 |
| `workbench.editor.limit.enabled` | 未设置（默认 `false`） | `true` | 限制打开的 tab 数量 |
| `workbench.editor.limit.value` | 未设置 | `12` | 超过时自动关闭最早的 tab |
| `workbench.tips.enabled` | 未设置（默认 `true`） | `false` | 关闭提示减少干扰 |
| `files.watcherExclude` | 未设置 | 见下方 | **UE5 大项目必须配置** |
| `search.exclude` | 未设置 | 见下方 | 搜索排除无关目录 |
| `search.followSymlinks` | 未设置（默认 `true`） | `false` | 不跟踪符号链接 |
| `explorer.autoReveal` | 未设置（默认 `true`） | `false` | 不自动展开/滚动文件树 |
| `git.autorefresh` | 未设置（默认 `true`） | `false` | 不自动刷新 git 状态 |
| `git.decorations.enabled` | 未设置（默认 `true`） | `false` | 关闭 git 文件颜色标记 |
| `telemetry.telemetryLevel` | 未设置（默认 `"all"`） | `"off"` | 关闭遥测减少后台网络 |
| `extensions.autoUpdate` | 未设置（默认 `true`） | `false` | 手动更新，避免后台下载 |

> ⚠️ **风险提示**：
> - `files.watcherExclude: **/Content/**`：**仅适用于 UE5 项目**（Content 下是二进制 .uasset）。前端项目如有 src/Content/ 目录包含源文件，排除后热重载失效。建议放 workspace settings 而非 user settings。
> - `git.autorefresh: false`：Git 用户提交后侧边栏不自动更新，需手动点刷新。P4 用户无影响。
> - `extensions.autoUpdate: false`：可能错过安全修复，建议每周手动检查一次更新。
> - `workbench.editor.limit = 12`：P4/Git 解冲突时可能需要更多 tab，可按需调高。
> - Copilot `anthropic.thinking.*` 设置属于实验性 API，无稳定性保证，可能随版本更新失效或重命名。

### 🟡 你已有的设置 — 建议修改

| 设置 | 当前值 | 建议值 | 原因 |
|------|--------|--------|------|
| `github.copilot.nextEditSuggestions.enabled` | `true` | `false` | **最大性能杀手之一**，持续后台分析编辑意图，大幅占 Extension Host CPU |
| `github.copilot.chat.anthropic.thinking.budgetTokens` | `32000` | `16000`（可选） | 降低思考 token 可加快响应速度，适合非复杂问题 |
| `github.copilot.chat.anthropic.thinking.forceExtendedThinking` | `true` | `false`（可选） | 不强制深度思考，简单问题秒回 |

### 🟢 你已有的好配置（保持不动）

| 设置 | 当前值 | 评价 |
|------|--------|------|
| `workbench.startupEditor` | `"none"` | ✅ 启动快 |
| `github.copilot.enable["*"]` | `false` | ✅ 全局关闭行内补全，省 CPU |
| `github.copilot.enable["cpp"]` | `true` | ✅ 只对 C++ 开启 |
| `git.openRepositoryInParentFolders` | `"never"` | ✅ 不向上搜索 git 仓库 |
| `chat.agent.maxRequests` | `1000` | ✅ 不影响性能 |

### 建议新增的 JSON 块

```json
{
    // ===== 编辑器渲染优化 =====
    "editor.minimap.enabled": false,
    "editor.cursorSmoothCaretAnimation": "off",
    "editor.smoothScrolling": false,
    "editor.bracketPairColorization.enabled": false,
    "editor.occurrencesHighlight": "off",
    "editor.wordBasedSuggestions": "off",
    "editor.renderWhitespace": "none",
    "editor.hover.delay": 500,
    "editor.suggest.preview": false,
    "editor.codeLens": false,
    "editor.inlayHints.enabled": "off",
    "editor.stickyScroll.enabled": false,
    "editor.guides.indentation": false,
    "editor.renderLineHighlight": "none",
    "editor.matchBrackets": "never",

    // ===== 工作台 =====
    "workbench.list.smoothScrolling": false,
    "workbench.editor.limit.enabled": true,
    "workbench.editor.limit.value": 12,
    "workbench.tips.enabled": false,
    "workbench.reduceMotion": "on",

    // ===== 文件监视排除（大项目关键）=====
    "files.watcherExclude": {
        "**/Binaries/**": true,
        "**/Intermediate/**": true,
        "**/Content/**": true,
        "**/DerivedDataCache/**": true,
        "**/Saved/**": true,
        "**/.git/objects/**": true
    },

    // ===== 搜索排除 =====
    "search.exclude": {
        "**/Binaries": true,
        "**/Intermediate": true,
        "**/Content": true,
        "**/DerivedDataCache": true
    },
    "search.followSymlinks": false,

    // ===== 资源管理器 =====
    "explorer.autoReveal": false,

    // ===== Git =====
    "git.autorefresh": false,
    "git.decorations.enabled": false,

    // ===== 遥测 & 更新 =====
    "telemetry.telemetryLevel": "off",
    "extensions.autoUpdate": false,
    "extensions.autoCheckUpdates": false,

    // ===== Copilot 性能 =====
    "github.copilot.nextEditSuggestions.enabled": false
}
```

---

## 📁 文件 3：工作区 `.vscode/settings.json`（建议新建）

> 路径：`G:\P4_SH\neon\AES_v5\TEST_5.5\Plugins\.vscode\settings.json`  
> 只影响此工作区，不影响其他项目

```json
{
    "files.watcherExclude": {
        "**/Binaries/**": true,
        "**/Intermediate/**": true,
        "**/Content/**": true,
        "**/DerivedDataCache/**": true,
        "**/Saved/**": true,
        "**/.git/objects/**": true
    },
    "search.exclude": {
        "**/Binaries": true,
        "**/Intermediate": true,
        "**/Content": true,
        "**/DerivedDataCache": true,
        "**/Saved": true
    },
    "files.exclude": {
        "**/Binaries": true,
        "**/Intermediate": true
    }
}
```

---

## 📁 系统级优化

### Windows Defender 排除（强烈建议）

| 路径 | 原因 |
|------|------|
| `C:\Users\parking\.vscode\` | VS Code 核心文件 |
| `C:\Users\parking\AppData\Roaming\Code\` | 配置 + 扩展 |
| `C:\Users\parking\AppData\Local\Programs\Microsoft VS Code\` | 安装目录 |
| `G:\P4_SH\neon\AES_v5\TEST_5.5\Plugins\` | 工作区 |

**设置方法：** Windows 安全中心 → 病毒和威胁防护 → 管理设置 → 排除项 → 添加文件夹

### 硬件要求

| 项目 | 当前状态 | 建议 |
|------|----------|------|
| 内存 | 请确认 | 32GB+ 推荐（VS Code 长对话可占 4-6GB） |
| 磁盘 | 请确认工作区在 SSD | HDD 上 file watcher 延迟极高 |
| GPU | 有独显最好 | WebView 渲染受益于 GPU 加速 |
| 虚拟内存 | 系统属性 → 高级 → 性能 → 虚拟内存 | 设为"系统管理的大小" |

---

## 💡 长对话卡顿专项策略

### 优先级排序

| 优先级 | 操作 | 预期效果 |
|--------|------|----------|
| **P0** | argv.json 加 `max-old-space-size=8192` | Extension Host/renderer 堆上限增大，推迟 OOM |
| **P0** | 关闭 `nextEditSuggestions` | Extension Host CPU 降 30%+ |
| **P1** | 加 `files.watcherExclude` | 主进程 CPU/IO 大幅降低 |
| **P1** | 关闭 minimap + bracketPairColorization | 编辑器渲染帧率提升 |
| **P1** | `workbench.reduceMotion: "on"` | 减少 CSS 动画合成开销 |
| **P2** | 感觉卡时 `Ctrl+Shift+P` → Reload Window | WebView DOM 重置，历史保留 |
| **P2** | argv.json 加 `disable-features` | WebView 不被降级渲染 |
| **P3** | Windows Defender 排除 | IO 延迟降低 |

### 对话中的自救操作

1. **轻量释放**：`Ctrl+Shift+P` → 搜索 `compact` → 执行 **"Compact Conversation"** — 尝试压缩 DOM（比 Reload 更轻）
2. **感觉开始变卡**：`Ctrl+Shift+P` → `Developer: Reload Window` — 重载但保留 Chat 历史
3. **Process Explorer 监控**：`Ctrl+Shift+P` → `Process Explorer` — renderer > 2GB 就该 Reload
4. **避免超长输出**：指示 AI "简洁回答" / "只输出改动部分" 可减少 DOM 节点增长
5. **终极手段**：如果 Reload 都救不回来，新开对话是唯一解

### 本质原因

> Copilot Chat 使用 WebView（Chromium 嵌入）渲染对话。每条消息都是 DOM 节点，  
> 长对话 = DOM 树无限增长 = 重排/重绘越来越慢。这是架构性限制，无法完全消除，  
> 只能通过增加资源 + 减少竞争来推迟阈值。
>
> **官方状态**：GitHub Issue [#316407](https://github.com/microsoft/vscode/issues/316407) 已报告此问题（2026-05-13），  
> 建议的修复方向为 virtualized message rendering（仅渲染可见消息），但尚未实现。

---

## 🔧 诊断命令速查

| 命令（Ctrl+Shift+P） | 用途 |
|----------------------|------|
| `Developer: Startup Performance` | 启动瓶颈分析 |
| `Developer: Show Running Extensions` | 扩展 CPU/内存排行 |
| `Process Explorer` | 进程级资源占用 |
| `Developer: Reload Window` | 快速重载释放内存 |
| `Developer: Open Logs Folder` | 日志定位问题 |
| 终端运行 `code --status` | VS Code 整体状态 |
| 终端运行 `code --disable-extensions` | 纯净启动排查扩展问题 |
