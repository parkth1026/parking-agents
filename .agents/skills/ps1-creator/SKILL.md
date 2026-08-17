---
name: ps1-creator
description: "Use when: creating, modifying, or reviewing PowerShell (.ps1) scripts, user mentions 'ps1', 'PowerShell script', '脚本' in context of .ps1 files. Enforces expected-behavior header contract, minimal code principle, mandatory post-write testing. DO NOT USE FOR: general shell commands, non-ps1 scripting, bat/cmd files."
disable-model-invocation: true
---

# PowerShell Script Creation Discipline

## 1. Expected Behavior Header（强制契约）

每个 `.ps1` 文件**必须**以如下注释块开头，这是脚本的行为契约：

```powershell
<#
.SYNOPSIS
  一句话说明脚本做什么

.EXPECTED BEHAVIOR
  1. 具体期望行为 1
  2. 具体期望行为 2
  3. ...
#>
```

- **先写 Header，再写代码**——Header 是设计文档，代码是实现。
- 不允许省略 `.SYNOPSIS` / `.EXPECTED BEHAVIOR`。
- `.EXPECTED BEHAVIOR` 每条必须是可验证的断言，不能是模糊描述。

## 2. 契约不可变性

- 修改现有 `.ps1` 时，**先读 `.EXPECTED BEHAVIOR`**。
- 如果改动会**违反**已声明行为 → **立即停止，征求用户同意**。
- 如果要**新增**行为 → 先添加到 Header，再实现代码。
- 绝不静默改变契约。

## 3. 无参数原则

PS1 脚本**必须直接可执行**：`.\script.ps1` 即可运行，不需要任何参数。

- **禁止 `param()` 块**。默认值硬编码或自动检测。
- 如需可配置项，用**环境变量**或**配置文件**，不用命令行参数。
- 用户体验第一：双击或终端直接跑，零学习成本。

## 4. 极简代码原则

- 目标 **< 10 行**实际代码（不含 Header）。每一行必须证明自己的存在价值。
- 禁止花哨 banner、多余 `Write-Host`、无用颜色输出。
- 禁止对显而易见的代码加注释。
- 优先使用 one-liner chain：pipeline `|`、`;` 串联、三元 `$x ? 'a' : 'b'`。
- 能一行写完的不要拆两行。如果写了 15 行能缩成 8 行，重写。

## 5. 强制测试验证

写完或修改完任何 `.ps1` 后**必须**：

1. 运行脚本
2. 逐条验证 `.EXPECTED BEHAVIOR` 中的每个行为
3. 以 checklist 格式报告结果：

```
Expected Behavior 验证：
1. ✅ Backend 在 39527 端口启动 — 日志显示 listening on :39527
2. ✅ Frontend dev server 热更新 — localhost:5173 可访问
3. ❌ Ctrl+C 同时停止两个服务 — backend job 残留
```

4. 任何 ❌ 必须修复后重测，直到全部 ✅。

## 6. 进程清理铁律（CRITICAL）

**NEVER** 按通用进程名杀进程。`node.exe`、`cargo.exe`、`python.exe` 这些名字在用户机器上可能有多个实例在运行（其他项目、IDE 服务、工具链）。

**杀进程三步走**：

1. **启动时记录 PID**：
   ```powershell
   $proc = Start-Process cargo -PassThru -ArgumentList "run","--release"
   # $proc.Id 就是 PID
   ```

2. **按端口定位 PID**（当 PID 不可得时）：
   ```powershell
   $pid = (Get-NetTCPConnection -LocalPort 39527 -EA 0).OwningProcess | Select-Object -First 1
   if ($pid) { Stop-Process -Id $pid -Force }
   ```

3. **绝对禁止**：
   ```powershell
   # ❌ 会杀掉所有 node 进程（其他项目的 dev server、IDE 插件等）
   Stop-Process -Name "node" -Force
   taskkill /IM node.exe /F
   
   # ❌ 会杀掉所有 cargo 进程（其他 workspace 的编译）
   Stop-Process -Name "cargo" -Force
   ```

## 7. 已知陷阱（必须牢记）

| 陷阱 | 错误做法 | 正确做法 |
|------|----------|----------|
| `$args` 保留变量 | `param($args)` in ScriptBlock | `param($myArgs)` 或其他名称 |
| 按名称杀进程 | `Stop-Process -Name "node"` | 按 PID：`Stop-Process -Id $pid -Force` |
| Start-Job 清理 | 依赖 `finally` 块 | 文档注明：Ctrl+C = 干净退出，强杀 = 孤儿进程 |
| 路径含空格 | `cd My Path` | `cd "My Path"` |
| 文件编码 | `Out-File`（默认 UTF-16） | `Set-Content -Encoding UTF8` 或 `-Encoding UTF8` |
| 全局杀进程 | `taskkill /IM node.exe /F` | 按端口找 PID → `Stop-Process -Id $pid` |

## 8. 修改工作流

1. 读取现有 `.ps1` 的 Header
2. 确认改动是否影响已声明行为
3. 影响 → 停止征求同意；不影响 → 继续
4. 新增行为 → 先更新 Header
5. 实现代码改动
6. 运行 + 逐条验证（§5）
7. 全部 ✅ 后完成

## 9. 最佳实践

### 并行服务器模式
```powershell
<#
.SYNOPSIS
  并行启动 backend + frontend 开发环境
.EXPECTED BEHAVIOR
  1. Backend release 编译后启动，监听默认端口
  2. Frontend dev server 热更新
  3. Ctrl+C 清理所有进程
#>
$job = Start-Job { Set-Location $using:PWD; cargo run --release --bin server -- --dir ..\data 2>&1 }
Write-Host "Backend :39527 | UI http://localhost:5173"
Start-Sleep 3
try { Push-Location frontend; npm run dev } finally { Pop-Location; Stop-Job $job -EA 0; Remove-Job $job -Force -EA 0 }
```

### 端口清理模式
```powershell
<#
.SYNOPSIS
  清理指定端口的占用进程
.EXPECTED BEHAVIOR
  1. 只杀占用指定端口的进程，不影响其他
  2. 无占用时静默通过
#>
@(39527, 5173) | ForEach-Object {
  $p = (Get-NetTCPConnection -LocalPort $_ -EA 0).OwningProcess | Select-Object -First 1
  if ($p) { Stop-Process -Id $p -Force; Write-Host "Killed PID $p on :$_" }
}
```

### 构建脚本模式
```powershell
<#
.SYNOPSIS
  前端+后端联合构建
.EXPECTED BEHAVIOR
  1. 前端构建 (npm run build)
  2. 后端 release 构建 (cargo build --release)
  3. 任一步失败立即退出
#>
Push-Location twe_server_ui; npm run build; if ($LASTEXITCODE) { Pop-Location; exit 1 }; Pop-Location
cargo build --release -p aes_meta_tool --bin twe_server; if ($LASTEXITCODE) { exit 1 }
Write-Host "Build OK"
```
