---
name: dev-environment
description: Use when setting up or fixing a local .NET backend plus Vite or Node frontend development environment with idempotent startup, shared .env port configuration, Ctrl+C cleanup, PowerShell dev.ps1 and dev.bat entrypoints, smart-dev.mjs and stop-dev.mjs scripts, or Windows port and process troubleshooting.
disable-model-invocation: true
---

# Dev Environment — .NET + Frontend 一键启动

## 目标

为 .NET 后端 + Node.js 前端的项目提供一键启动开发环境方案，满足以下需求：

- **幂等启动**：重复执行不产生多余进程
- **Ctrl+C 优雅退出**：前后端同时关闭，无残留进程
- **端口统一管理**：`.env` 单一来源，所有脚本/配置自动读取
- **跨平台兼容**：Windows（PowerShell 5.1+ / pwsh）为主，脚本同时支持 macOS/Linux

---

## 架构模式

```
项目根/
├── dev.ps1                  # 主入口：杀旧进程 → 编译 → 启动后端 → 健康检查 → 幂等启动前端
├── dev.bat                  # Windows 双击入口，委托给 dev.ps1
├── {{BACKEND_DIR}}/.env     # 后端环境变量（BACKEND_PORT）
├── frontend/
│   ├── .env                 # 前端环境变量（BACKEND_PORT, FRONTEND_PORT, BACKEND_URL）
│   ├── package.json         # scripts: dev / dev:all / dev:stop
│   ├── vite.config.ts       # loadEnv 读取 .env，strictPort: true
│   └── scripts/
│       ├── smart-dev.mjs    # 幂等启动：端口探测 → 已运行则复用 → 否则后台启动
│       ├── stop-dev.mjs     # 按端口精准关闭前端进程
│       └── kill-backend.mjs # 按端口精准关闭后端进程
```

### 启动方式矩阵

| 命令 | 场景 | 前后端联动 | Ctrl+C 清理 |
|------|------|:----------:|:-----------:|
| `dev.ps1` / `dev.bat` | 日常开发（推荐） | ✅ | ✅ |
| `npm run dev` | 仅前端（后端已运行） | 前端幂等 | 前端 only |
| `npm run dev:all` | 简化版联动 | ✅ | ✅ via concurrently |
| `npm run dev:stop` | 关闭前端 | — | — |

---

## 实现清单

### Step 1: 创建 `.env` 文件

**`{{BACKEND_DIR}}/.env`**
```env
# 后端开发环境配置
# ASP.NET Core 通过 appsettings.json 配置，此文件供 dev.ps1 脚本读取
BACKEND_PORT={{BACKEND_PORT}}
```

**`frontend/.env`**
```env
# 前端开发环境配置
BACKEND_PORT={{BACKEND_PORT}}
FRONTEND_PORT={{FRONTEND_PORT}}
BACKEND_URL=http://localhost:{{BACKEND_PORT}}
```

> `.env` 加入 `.gitignore`（如为团队共享则保留，或提供 `.env.example`）。

---

### Step 2: 创建 `frontend/scripts/smart-dev.mjs`

幂等 dev server 启动：探测端口 → 已运行则复用 → 否则后台启动 Vite。

```javascript
#!/usr/bin/env node

/**
 * smart-dev.mjs — 幂等 dev server 启动脚本
 *
 * 行为：
 *   1. 从 vite.config.ts 解析实际端口
 *   2. 探测该端口是否已有 vite 在响应
 *   3. 已在运行 → 打印提示，exit 0（复用）
 *   4. 未运行   → 后台启动 vite，等待就绪后 exit 0
 */

import { resolveConfig } from 'vite';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// ── 1. 从 vite config 解析端口 ─────────────────────────────
const config = await resolveConfig(
  { configFile: path.join(projectRoot, 'vite.config.ts') },
  'serve',
);
const port = config.server?.port || {{FRONTEND_PORT}};

// ── 2. 探测端口是否已有 server ──────────────────────────────
function probe(targetPort) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${targetPort}`, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

if (await probe(port)) {
  console.log(`[smart-dev] 已有 Vite 实例运行在 port ${port}，复用`);
  process.exit(0);
}

// ── 3. 后台启动 vite ───────────────────────────────────────
console.log(`[smart-dev] Starting dev server on :${port}...`);

const logOut = fs.openSync(path.join(projectRoot, 'dev-out.txt'), 'a');
const logErr = fs.openSync(path.join(projectRoot, 'dev-err.txt'), 'a');

const child = spawn('npx vite', {
  cwd: projectRoot,
  stdio: ['ignore', logOut, logErr],
  detached: true,       // 独立于启动终端存活
  shell: true,
  windowsHide: true,
});
child.unref();          // 父进程不等待子进程

// ── 4. 等待就绪（最多 30 秒）────────────────────────────────
const MAX_WAIT = 30;
for (let i = 0; i < MAX_WAIT; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  if (await probe(port)) {
    console.log(`[smart-dev] Dev server ready → http://localhost:${port} (PID: ${child.pid})`);
    process.exit(0);
  }
}

console.error(
  `[smart-dev] Server failed to start within ${MAX_WAIT}s. Check dev-err.txt for details.`,
);
process.exit(1);
```

**关键设计**：
- `resolveConfig()` 从 vite.config.ts 动态读取端口，避免硬编码
- `detached: true` + `child.unref()` 使 Vite 进程独立于启动终端
- 日志重定向到 `dev-out.txt` / `dev-err.txt`，后台启动时可回溯问题

---

### Step 3: 创建 `frontend/scripts/stop-dev.mjs`

按端口精准关闭前端 dev server，不误杀其他 node 进程。

```javascript
#!/usr/bin/env node

/**
 * stop-dev.mjs — 精准关闭 dev server
 *
 * 行为：
 *   1. 从 vite.config.ts 解析实际端口
 *   2. 查找监听该端口的进程 PID（跨平台）
 *   3. 仅关闭该 PID，不影响其他 node 进程
 */

import { resolveConfig } from 'vite';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// ── 1. 从 vite config 解析端口 ─────────────────────────────
const config = await resolveConfig(
  { configFile: path.join(projectRoot, 'vite.config.ts') },
  'serve',
);
const port = config.server?.port || {{FRONTEND_PORT}};

// ── 2. 查找监听该端口的 PID ────────────────────────────────
function findPids(targetPort) {
  if (process.platform === 'win32') {
    try {
      const output = execSync(
        `netstat -ano | findstr ":${targetPort}" | findstr "LISTENING"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] },
      );
      const pids = new Set();
      for (const line of output.trim().split('\n')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
      }
      return [...pids];
    } catch {
      return [];
    }
  } else {
    try {
      const output = execSync(`lsof -i :${targetPort} -t`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

// ── 3. 关闭进程 ────────────────────────────────────────────
const pids = findPids(port);
if (pids.length === 0) {
  console.log(`[stop-dev] 端口 ${port} 上没有找到运行中的 dev server`);
  process.exit(0);
}

for (const pid of pids) {
  console.log(`[stop-dev] 终止 PID ${pid} (port ${port})`);
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
  } catch { /* already exited */ }
}
console.log('[stop-dev] Dev server 已关闭');
```

---

### Step 4: 创建 `frontend/scripts/kill-backend.mjs`

用于 `dev:all` 启动前清理占用后端端口的旧进程。

```javascript
#!/usr/bin/env node

/**
 * kill-backend.mjs — 终止占用后端端口的进程
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');

function loadBackendPort() {
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/^BACKEND_PORT\s*=\s*(\d+)/m);
    if (match) return parseInt(match[1], 10);
  } catch { /* .env 不存在则用默认值 */ }
  return {{BACKEND_PORT}};
}

const port = process.env.BACKEND_PORT
  ? parseInt(process.env.BACKEND_PORT, 10)
  : loadBackendPort();

function findAndKill() {
  if (process.platform === 'win32') {
    try {
      const output = execSync(
        `netstat -ano | findstr ":${port}" | findstr "LISTENING"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] },
      );
      const pids = new Set();
      for (const line of output.trim().split('\n')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
      }
      for (const pid of pids) {
        console.log(`  终止后端进程 PID ${pid} (port ${port})`);
        try {
          execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
        } catch { /* already exited */ }
      }
      if (pids.size > 0) console.log('  后端进程已清理');
    } catch { /* no process on port */ }
  } else {
    try {
      const output = execSync(`lsof -i :${port} -t`, {
        encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'],
      });
      for (const pid of output.trim().split('\n').filter(Boolean)) {
        console.log(`  终止后端进程 PID ${pid} (port ${port})`);
        try { execSync(`kill -9 ${pid}`, { stdio: 'ignore' }); }
        catch { /* already exited */ }
      }
    } catch { /* no process on port */ }
  }
}

findAndKill();
```

---

### Step 5: 更新 `package.json` scripts

```jsonc
{
  "scripts": {
    "dev": "node scripts/smart-dev.mjs",
    "dev:all": "node scripts/kill-backend.mjs && concurrently -k -n be,fe -c blue,green \"cd ../{{BACKEND_DIR}} && dotnet run\" \"npx vite\"",
    "dev:stop": "node scripts/stop-dev.mjs",
    "dev:vite": "vite"
  }
}
```

需要安装 `concurrently` 作为 devDependency：
```bash
npm install -D concurrently
```

---

### Step 6: 更新 `vite.config.ts`

关键改动：`loadEnv` 读 `.env`、`strictPort: true`、代理配置。

```typescript
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // 从 frontend/ 目录加载 .env
  const env = loadEnv(mode, __dirname, '')
  const backendPort = env.BACKEND_PORT || '{{BACKEND_PORT}}'
  const frontendPort = parseInt(env.FRONTEND_PORT || '{{FRONTEND_PORT}}')
  const backendHttp = `http://localhost:${backendPort}`
  const backendWs = `ws://localhost:${backendPort}`

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: frontendPort,
      strictPort: true,     // 端口冲突时报错而非自动递增
      proxy: {
        '/api': {
          target: backendHttp,
          changeOrigin: true,
        },
        '/ws': {
          target: backendWs,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
```

---

### Step 7: 创建 `dev.ps1`

项目根目录的主入口脚本。

```powershell
# dev.ps1 — {{PROJECT_NAME}} 开发环境一键启动
# Ctrl+C 退出时同时关闭前后端

$ErrorActionPreference = 'Stop'
$ROOT = $PSScriptRoot

# --- 0. 加载 .env 配置 ---
function Load-EnvFile($path) {
    if (Test-Path $path) {
        Get-Content $path | ForEach-Object {
            if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+)$' -and $_ -notmatch '^\s*#') {
                [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim(), 'Process')
            }
        }
    }
}
Load-EnvFile (Join-Path $ROOT '{{BACKEND_DIR}}\.env')
Load-EnvFile (Join-Path $ROOT 'frontend\.env')
$backendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { '{{BACKEND_PORT}}' }
$frontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { '{{FRONTEND_PORT}}' }

# --- 1. 杀掉旧后端 (port $backendPort) ---
Write-Host "[1/3] 关闭已有后端..." -ForegroundColor Cyan
$listening = netstat -ano | Select-String ":${backendPort}\s.*LISTENING"
foreach ($line in $listening) {
    $procId = ($line -split '\s+')[-1]
    if ($procId -and $procId -ne '0') {
        Write-Host "  终止 PID $procId"
        taskkill /PID $procId /F /T 2>$null | Out-Null
    }
}

# --- 2. 编译并启动后端 ---
Write-Host "[2/3] 编译并启动后端..." -ForegroundColor Cyan
Push-Location "$ROOT\{{BACKEND_DIR}}"
dotnet build --configuration Debug --verbosity quiet
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "后端编译失败" }

$backendJob = Start-Process -FilePath "dotnet" -ArgumentList "run --no-build" -PassThru -WindowStyle Minimized
$backendPid = $backendJob.Id
Write-Host "  后端已启动 PID $backendPid (http://localhost:${backendPort})"
Pop-Location

# --- 等待后端就绪 ---
Write-Host "  等待后端就绪..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        # 健康检查：探测一个确实存在的 API endpoint
        $response = Invoke-WebRequest -Uri "http://localhost:${backendPort}/api/config" `
            -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 401) {
            $ready = $true
            break
        }
    } catch {
        # 后端尚未就绪，继续等待
    }
    Start-Sleep -Seconds 1
}
if ($ready) {
    Write-Host "  后端就绪 ✓" -ForegroundColor Green
} else {
    Write-Host "  ⚠ 后端未在 60 秒内就绪，继续启动前端" -ForegroundColor Yellow
}

# --- 3. 启动前端 (幂等) ---
Write-Host "[3/3] 启动前端..." -ForegroundColor Cyan
Push-Location "$ROOT\frontend"
node scripts/smart-dev.mjs
Pop-Location

# --- 获取前端 PID ---
$frontendPid = $null
$viteListening = netstat -ano | Select-String ":${frontendPort}\s.*LISTENING"
if ($viteListening) {
    $frontendPid = ($viteListening[0] -split '\s+')[-1]
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  开发环境就绪" -ForegroundColor Green
Write-Host "  后端: http://localhost:${backendPort}" -ForegroundColor Green
Write-Host "  前端: http://localhost:${frontendPort}" -ForegroundColor Green
Write-Host "  按 Ctrl+C 关闭前后端" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green

# --- 等待 Ctrl+C，然后清理 ---
try {
    # Wait-Process 是 PowerShell 原生 cmdlet，能被 Ctrl+C 正常中断
    # 而 .NET 的 Process.WaitForExit() 在 PS 5.1 中不可中断
    Wait-Process -Id $backendPid
} finally {
    Write-Host "`n正在关闭开发环境..." -ForegroundColor Yellow

    # 重新获取前端 PID（可能在等待期间变化）
    $viteListening = netstat -ano | Select-String ":${frontendPort}\s.*LISTENING"
    if ($viteListening) {
        $frontendPid = ($viteListening[0] -split '\s+')[-1]
    }

    # Kill backend
    if ($backendPid) {
        try { taskkill /PID $backendPid /F /T 2>$null | Out-Null } catch {}
        Write-Host "  后端已关闭"
    }

    # Kill frontend
    if ($frontendPid) {
        try { taskkill /PID $frontendPid /F /T 2>$null | Out-Null } catch {}
        Write-Host "  前端已关闭"
    }

    Write-Host "  开发环境已停止" -ForegroundColor Green
}
```

---

### Step 8: 创建 `dev.bat`

```batch
@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0dev.ps1"
```

---

### Step 9: 更新 CORS（后端 Program.cs）

确保 ASP.NET Core 后端允许前端开发服务器跨域请求：

```csharp
// Program.cs 中
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins($"http://localhost:{frontendPort}")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});
```

或者使用 Vite 的 proxy 功能（Step 6 已配置），将 `/api` 和 `/ws` 请求代理到后端，此时无需 CORS。

---

## 关键设计决策

### 端口唯一来源

```
.env ──→ vite.config.ts (loadEnv)
     ──→ smart-dev.mjs  (resolveConfig → 读 vite config → 拿到端口)
     ──→ stop-dev.mjs   (同上)
     ──→ kill-backend.mjs (直接读 .env 文件)
     ──→ dev.ps1         (Load-EnvFile 解析)
```

端口只在 `.env` 中定义一次，其他所有脚本/配置通过链式读取获得。

### `strictPort: true`

Vite 默认行为：端口被占用时自动递增（51888 → 51889）。这在幂等启动场景下有害——smart-dev 探测 51888 发现没有进程，于是启动新 Vite；但如果旧实例占了 51888，新实例会用 51889，导致两个实例并存。

`strictPort: true` 使端口冲突直接报错，配合 smart-dev 的端口探测实现正确的幂等。

### `Wait-Process` vs `.WaitForExit()`

| 方式 | Ctrl+C 中断 | PowerShell 兼容性 |
|------|:-----------:|:-----------------:|
| `Wait-Process -Id $pid` | ✅ 触发 finally | PS 5.1 + pwsh 7 |
| `$process.WaitForExit()` | ❌ 阻塞不可中断 | PS 5.1 bug |

必须使用 `Wait-Process` cmdlet，不能用 .NET `Process` 对象的 `WaitForExit()` 方法。

### `resolveConfig()` 动态读端口

smart-dev 和 stop-dev 不硬编码端口，而是调用 Vite 的 `resolveConfig()` 解析 vite.config.ts，获取实际生效的端口。这样端口改动只需改 `.env`，所有脚本自动生效。

### `detached: true` + `unref()`

```javascript
const child = spawn('npx vite', {
  detached: true,      // 子进程不属于父进程的进程组
  shell: true,
});
child.unref();         // 父进程不等待子进程结束
```

这使 Vite 进程在 smart-dev.mjs 退出后继续存活。smart-dev 的职责是"确保 Vite 在运行"，不是"持有 Vite"。

### 健康检查

```powershell
Invoke-WebRequest -Uri "http://localhost:${backendPort}/api/config" -UseBasicParsing -TimeoutSec 1
```

探测一个实际存在的 API endpoint（非 `/health`），确认后端完全就绪。接受 200（无需 auth 的 endpoint）或 401（需 auth，说明服务已启动）。

### `concurrently -k`

`dev:all` 使用 `concurrently -k`（kill others on exit），任一进程退出时关闭另一进程，实现 Ctrl+C 联动清理。适合不需要后台守护的简化场景。

---

## 易错点

### 1. `$pid` 是 PowerShell 只读自动变量

```powershell
# ❌ 错误：$pid 是当前 PowerShell 进程 ID，只读
$pid = $process.Id

# ✅ 正确：换个变量名
$procId = $process.Id
$backendPid = $backendJob.Id
```

### 2. `.NET WaitForExit()` 在 PS 5.1 中不可被 Ctrl+C 中断

Windows PowerShell 5.1 的 Ctrl+C 只中断 PowerShell cmdlet，不中断 .NET 方法调用。使用 `Wait-Process` cmdlet 代替。

### 3. React StrictMode 双挂载导致 WebSocket 竞态

开发模式下 React.StrictMode 会 mount → unmount → mount 组件。如果 WebSocket 连接在 mount 时建立，可能出现两个连接。解决：在 `useEffect` cleanup 中正确关闭 WebSocket。

### 4. Vite `loadEnv` 的 `envDir` 参数

```typescript
// loadEnv 第二个参数是 .env 文件所在目录
const env = loadEnv(mode, __dirname, '')  // __dirname = frontend/
// 第三个参数 '' 表示加载所有 env 变量（不限于 VITE_ 前缀）
```

如果 `.env` 不在 `vite.config.ts` 同目录，需要显式指定路径。

### 5. Windows `taskkill /T` 杀进程树

```powershell
# ❌ 只杀父进程，子进程（如 dotnet 的 kestrel）残留
taskkill /PID $procId /F

# ✅ /T 杀整个进程树
taskkill /PID $procId /F /T
```

`dotnet run` 启动的是 `dotnet.exe`，它会 fork 出实际的应用进程。不加 `/T` 会导致子进程残留。

### 6. `Start-Sleep` 在等待循环中

`dev.ps1` 健康检查循环中，`Invoke-WebRequest -TimeoutSec 1` 已自带超时。额外加 `Start-Sleep` 可以降低探测频率，但不影响正确性。

---

## 验证步骤

### 冷启动测试

```powershell
# 确保没有残留进程
netstat -ano | findstr ":9721\|:51888" | findstr LISTENING  # 应无输出
# 启动
.\dev.ps1
# 验证
# - 终端显示 "开发环境就绪"
# - http://localhost:9721/api/config 有响应
# - http://localhost:51888 有响应
```

### 幂等复用测试

```powershell
# 第一次启动
.\dev.ps1                          # 正常启动
# 另一个终端
cd frontend; npm run dev           # 应显示 "已有 Vite 实例运行在 port 51888，复用"
```

### Ctrl+C 退出清理测试

```powershell
.\dev.ps1                          # 启动
# 按 Ctrl+C
# 验证：
netstat -ano | findstr ":9721\|:51888" | findstr LISTENING  # 应无输出
```

### 端口冲突测试

```powershell
# 先占用前端端口
npx -y http-server -p 51888 &
# 尝试启动
cd frontend; npx vite              # 应报错 "Port 51888 is already in use"（strictPort）
npm run dev                        # smart-dev 探测到已有服务，显示"复用"
```

---

## 模板变量

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `{{PROJECT_NAME}}` | 项目名称 | AesResourceGenerator |
| `{{BACKEND_DIR}}` | 后端项目目录名 | AesResourceGenerator.Server |
| `{{BACKEND_PORT}}` | 后端监听端口 | 9721 |
| `{{FRONTEND_PORT}}` | 前端 dev server 端口 | 51888 |

---

## 适用条件

- 后端：.NET（ASP.NET Core / WPF + Server 分离）
- 前端：Vite-based（React / Vue / Svelte 均可）
- OS：Windows 为主（脚本跨平台兼容）
- 包管理：npm / pnpm

不适用于：Docker Compose 管理的环境、monorepo 多后端场景、非 Vite 打包工具。
