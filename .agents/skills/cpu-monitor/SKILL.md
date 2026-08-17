---
name: cpu-monitor
description: Windows CPU 性能采样与 WMI 诊断工具集。用 Win32 API(EnumProcesses/GetProcessTimes + CreateToolhelp32Snapshot/GetThreadTimes)直接读取进程/线程 CPU 数据,完全绕开 WMI Provider Service,不会像 wmic/Get-CimInstance 那样拉高 WmiPrvSE。当用户提到以下场景时使用:(1) 机器卡/CPU 高,要找 Top 进程;(2) 要抓 Top 线程定位热点;(3) WmiPrvSE.exe 异常高 CPU 要找根因;(4) 怀疑 WMI 仓库损坏或被滥用;(5) 任何"抓 10/60 秒 CPU Top N"的请求。不适用于 Linux/macOS。
disable-model-invocation: true
---

# CPU Monitor

Windows CPU 进程/线程 Top-N 采样器 + WMI 诊断器。核心特点:**不经 WMI,不拉高 WmiPrvSE**(走 Win32 API 直读,与 bottom/btm 的 sysinfo crate 同款路径)。

## 数据源(关键)

| 脚本 | 调用的 Win32 API | 等价于 |
|---|---|---|
| `proc-snapshot.ps1` | `EnumProcesses` + `GetProcessTimes` | btm / 任务管理器底层 |
| `thread-snapshot.ps1` | `CreateToolhelp32Snapshot` + `GetThreadTimes` | Process Explorer 线程视图 |
| `wmi-diag.ps1` | `Get-Counter` + `Get-WinEvent` + `Get-CimInstance` | WMI 专用诊断 |

**为什么不用 wmic/typeperf?**
- `wmic` → 经 WmiPrvSE 应答 → 拉高 WmiPrvSE(观察者效应,会让被测对象飙到 700%)
- `typeperf` → 走 PDH 不拉高 WmiPrvSE,但实例名是 `svchost#1/#2`,**没 PID**
- 本 skill 的 Win32 API 直调 → 不拉高 WmiPrvSE + 有 PID ✅

## 快速决策

```
用户要什么?
├─ "抓 CPU Top N 进程" → node scripts/top-cpu.mjs
├─ "抓 CPU Top N 线程" → node scripts/top-threads.mjs
├─ "WmiPrvSE 高 CPU" / "机器卡死" → 先跑 scripts/wmi-diag.ps1
└─ "机器慢但不知道哪个进程" → top-cpu.mjs 先扫一遍
```

## 脚本用法

### 1. top-cpu.mjs(进程级 Top-N,最常用)

```bash
# 默认 10 秒、Top 5
node scripts/top-cpu.mjs

# 60 秒、Top 10,存报告
node scripts/top-cpu.mjs --seconds 60 --top 10 --report report.txt

# 参数:--seconds / --top / --interval / --report
```

输出含三路校验(A 细项求和 / B Idle 反推 / C _Total 计数器),B vs C 应接近 0。A 系统性低于 B/C,差额是中断/DPC(Windows 固有,非 bug)。

### 2. top-threads.mjs(线程级 Top-N)

```bash
node scripts/top-threads.mjs --seconds 15 --top 20
```

适合定位"哪个进程的哪个线程在烧 CPU"。线程级总和必然略小于进程级(短命线程在采样间隔消失)。

### 3. wmi-diag.ps1(WmiPrvSE 异常诊断)

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/wmi-diag.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/wmi-diag.ps1 -Window 10
```

一次性输出 8 段证据:WmiPrvSE 实时 CPU / Provider Host 配额 / 调用方 Top / 永久订阅 / 通知查询 / 句柄 Top / 仓库健康。

## CPU% 口径(必读,避免误判)

| 名称 | 含义 | 范围 |
|---|---|---|
| **单核%** | 任务管理器口径,100 = 跑满一个逻辑核 | 多核机器可 >100,上限 = 核数×100 |
| **总占%** | 占系统总 CPU,100 = 跑满全部核 | 0~100,= 单核% / 核数 |

例:24 核机器上某进程单核 240% = 用了 2.4 个核 = 总占 10%。

## 常见误判与陷阱

### 1. PowerShell 采样辅助进程被记入 Top
每秒 fork 一个 PowerShell 拿快照,会被采到(单核 1~5%)。已在备注列标"采样辅助",可忽略。要彻底消除,需把采样器本身编译为原生程序(参考 btm)。

### 2. 采样辅助 = 采样工具自己 fork 的进程
`OBSERVER` 集合(powershell/pwsh/node/cmd/conhost/WindowsTerminal/wmic)会被标注。用户本人的 Node/PowerShell 工作进程不算采样辅助。

### 3. 进程名缺失显示 `PID-xxxxxx`
采样期间存在的进程,采样结束时已退出,事后查 WMI 拿不到。thread-snapshot.ps1 已改为采样时同步读进程名(`Get-Process`),大幅减少此情况。

### 4. 校验 A vs (B/C) 差额大 ≠ bug
A 路径漏算中断/DPC/未注册内核时间,Windows 计数器固有特性。**B vs C 才是数据可信度指标**(应接近 0)。

## WMI 仓库损坏的修复路径

当 `wmi-diag.ps1` 显示 `verifyrepository: WMI repository verification failed`:

1. 温和修复(推荐先做):`winmgmt /salvagerepository`
2. 升级:`winmgmt /resetrepository`(重置为初始状态,第三方 Provider 需重装)
3. 重启服务:`Restart-Service Winmgmt`

**需要管理员权限**。不影响用户代码/项目,只动 `C:\Windows\System32\wbem\Repository\`。

详见 [references/wmi-troubleshooting.md](references/wmi-troubleshooting.md)。

## 运行要求

- Windows 10/11(不支持 Linux/macOS)
- Node.js 18+
- PowerShell 5.1+(用 `Add-Type` 做 P/Invoke,无需额外模块)
- 非管理员可用(但拿不到系统/受保护进程的路径,Top 进程名会缺)
- **管理员权限推荐**(拿全进程路径 + WMI 仓库修复)

## 文件清单

```
scripts/
├── proc-snapshot.ps1    # 进程快照助手(Win32 API,Node 调用)
├── thread-snapshot.ps1  # 线程快照助手(Win32 API,Node 调用)
├── top-cpu.mjs          # 进程级 Top-N 主程序
├── top-threads.mjs      # 线程级 Top-N 主程序
└── wmi-diag.ps1         # WMI/WmiPrvSE 诊断(独立)
references/
└── wmi-troubleshooting.md  # WMI 高 CPU 根因分析与修复
```
