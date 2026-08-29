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

## 安全边界

关闭旧进程前，按端口列出 PID、命令行和工作目录，并确认目标属于当前开发环境；
不得按进程名或未知 PID 强制终止。`ExecutionPolicy Bypass` 仅可用于用户明确授权的、
已审查的本地生成入口，不得用来静默执行未审查脚本。端口冲突无法归属时停止并报告，
不要扩大清理范围。

生成的 `dev.ps1`/`dev.bat` 是 Windows 入口的登记平台例外；跨平台业务逻辑仍应落在
`.mjs` 或项目既有任务配置中，不能借此新增未审查的脚本。

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

## Advanced reference

For the PowerShell entrypoint, dev.bat, CORS, design decisions, pitfalls, and validation checklist, read [references/advanced-templates-and-validation.md](references/advanced-templates-and-validation.md) when implementing those parts.
