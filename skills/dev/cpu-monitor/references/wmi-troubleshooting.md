# WMI 高 CPU 根因分析与修复

当 `wmi-diag.ps1` 显示 WmiPrvSE.exe 单核 >100% 持续,或用户报告"机器卡/WmiPrvSE 高",按本指南定位与修复。

## 目录
1. [WMI 仓库是什么](#wmi-仓库是什么)
2. [诊断流程](#诊断流程)
3. [常见根因](#常见根因)
4. [修复方案](#修复方案)
5. [校验清单](#校验清单)

## WMI 仓库是什么

- **本质**:Windows 自带的"系统描述数据库"(类似注册表但结构化)
- **路径**:`C:\Windows\System32\wbem\Repository\` 几个 .map/.dat 文件
- **存的内容**:
  - 命名空间(Namespace,类似 schema):`root\cimv2`、`root\WMI` 等
  - 类定义(Class,类似表):`Win32_Process`、`Win32_Service` 等约 1000+ 个
  - Provider 注册:47 个左右 DLL,告诉 WMI "谁来填这些数据"
- **大小**:45 MB 量级正常,大小本身不是问题
- **跟用户代码的关系**:**完全无关**。用户的项目代码、git 仓库不进这里

## 诊断流程

### 第 1 步:跑 wmi-diag.ps1

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/wmi-diag.ps1 -Window 5
```

### 第 2 步:看 8 段输出,按下表对照

| 段 | 异常信号 | 含义 |
|---|---|---|
| 1 WmiPrvSE CPU | 单核持续 >100% | WMI 过载,某个 Provider 在死跑 |
| 1 WmiPrvSE CPU | 多实例并存(>2) | Provider 频繁崩溃重启 |
| 3 WmiPrvSE 进程 | 启动时间 < 5 分钟前 | 反复崩溃重启 |
| 4 调用方 Top | 某 PID 持续高频 calls | 常驻进程在轮询 WMI |
| 4 调用方 Top | 全是 "(exited)" | 短时调用方(可能是脚本),看 Top queried targets |
| 4 Top targets | `Win32_Process` 占大多数 | 有人在反复枚举进程 |
| 5 Permanent Subscriptions | 非系统 Filter | 第三方装了永久订阅,常驻轮询 |
| 6 Notification Queries | 高频 `WITHIN=N` 轮询 | 某软件在轮询事件,降 N 提升频率 |
| 7 Handle Count Top | 某进程 >5 万句柄 | 句柄泄漏 + 可能 WMI 滥用 |
| 8 verifyrepository | `verification failed` | **仓库损坏,必修** |

### 第 3 步:定位调用方

段 4 的 PID 如果显示进程名(不是 exited),直接看那个进程是谁。常见嫌疑:
- **安全软件/EDR**(CrowdStrike、SentinelOne、Defender):高频枚举进程
- **远程管理工具**(LANDesk、SCCM、SimpleHelp):定时资产上报
- **硬件厂商工具**(Intel ME、HP ProtectTools):驱动级 Provider
- **自研监控脚本**:用了 `Get-CimInstance` 死循环

如果 PID 都 exited,看段 4 的 "Top queried targets":
- `Win32_Process` 占绝大多数 → 某个短时脚本在反复枚举进程
- 查 `Win32_PerfFormattedData_*` → 某监控工具在拉性能数据

## 常见根因

### 1. WMI 仓库损坏(最常见)
**症状**:`verifyrepository` 失败,WmiPrvSE 频繁重启,错误码 `0x80041032`(QUOTA_VIOLATION)
**原因**:服务异常退出、第三方软件反复注册/注销 Provider、Windows 更新中断
**修复**:`winmgmt /salvagerepository`(温和)→ `/resetrepository`(激进)

### 2. 第三方永久事件订阅
**症状**:段 5 有非系统 EventFilter
**原因**:某软件装了 `__EventFilter` + `__FilterToConsumerBinding`,常驻轮询
**修复**:删除订阅
```powershell
Get-CimInstance -Namespace root\subscription -ClassName __EventFilter | Where-Object { $_.Name -eq 'X' } | Remove-CimInstance
```

### 3. 高频 NotificationQuery 轮询
**症状**:段 6 有 `WITHIN=1` 或极短间隔的查询
**原因**:某进程用临时订阅反复查
**修复**:找到调用方进程(段 6 的 ClientProcessId),关闭或调整

### 4. 句柄泄漏进程
**症状**:段 7 有进程 >5 万句柄
**原因**:某进程打开大量 WMI 句柄不释放
**修复**:重启该进程;长期方案是软件本身修 bug

### 5. Provider DLL 损坏
**症状**:某 Provider 反复启动失败(段 4 没线索,但 WmiPrvSE 不稳定)
**修复**:`mofcomp` 重新注册 MOF 文件,或重装对应软件

## 修复方案

### 方案 A:温和修复(首选)

```powershell
# 管理员 PowerShell
Stop-Service Winmgmt -Force
winmgmt /salvagerepository
# 看输出:
#   "WMI repository has been salvaged"     → 成功
#   "WMI repository verification failed"   → 升级到方案 B
Start-Service Winmgmt
```

### 方案 B:重置仓库(终极)

```powershell
Stop-Service Winmgmt -Force
winmgmt /resetrepository
# 重置为 Windows 初始状态,第三方 WMI Provider 注册会丢失
# 需要重装那些软件才能恢复对应查询能力
Start-Service Winmgmt
Restart-Computer
```

### 方案 C:调整 Provider Host 配额(治标)

```powershell
# 提高单 Host 承载上限,缓解配额耗尽
Set-CimInstance -Namespace root -ClassName __ProviderHostQuotaConfiguration -Property @{
    ThreadsPerHost = 512       # 默认 256
    HandlesPerHost = 8192      # 默认 4096
}
```

副作用:WmiPrvSE 可能占用更多内存。

### 方案 D:禁用可疑 Provider

找到段 4/5 的可疑 Provider 后,直接禁用:
```powershell
# 例:禁用某第三方 Provider
$instance = Get-CimInstance -Namespace root\cimv2 -ClassName __Win32Provider | Where-Object { $_.Name -eq 'X' }
Remove-CimInstance $instance
```

## 校验清单

修复后逐项确认:
- [ ] `winmgmt /verifyrepository` 输出 "WMI repository is consistent"
- [ ] `wmi-diag.ps1` 段 1 WmiPrvSE 单核 < 10%
- [ ] `wmi-diag.ps1` 段 4 最近 5 分钟 5858 错误 < 10 条
- [ ] 任务管理器不再显示 WmiPrvSE 高 CPU
- [ ] Get-CimInstance 查询响应 < 1 秒

## 不要做的事

- ❌ 不要 `taskkill /F /IM WmiPrvSE.exe`(会触发立即重启,雪崩)
- ❌ 不要删除 `C:\Windows\System32\wbem\Repository\` 文件夹(系统会无法启动 WMI 服务)
- ❌ 不要禁用 Winmgmt 服务(大量系统功能依赖,会导致 Win11 异常)
- ❌ 不要随意 `mofcomp` 未知 .mof 文件(可能覆盖现有注册)

## 官方参考

- [Troubleshoot WMI high CPU usage issues – Microsoft Learn](https://learn.microsoft.com/en-us/troubleshoot/windows-server/system-management-components/troubleshoot-wmi-high-cpu-issues)
- [WMI Tasks: Performance Monitoring – Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/wmisdk/wmi-tasks--performance-monitoring)
