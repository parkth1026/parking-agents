---
name: graphics-adapter-warp-fail
category: startup-fail
signature: "[N.N.N-N.N.N:N][  N]LogDNDNRHI: Error: Failed to choose a DNDN Adapter."
match: "Failed to choose a D3D12 Adapter"
first-seen: 2026-08-26
last-seen: 2026-08-27
verified: true
sources:
  - Docs/bugs/2026-08-27-multigpu-pixelstreaming-gpu3d-zero-freeze-diagnosis.md
---

## 识别特征

- match: `Failed to choose a D3D12 Adapter`
- 错误原句（三连）：
  `LogD3D12RHI: Error: Failed to choose a D3D12 Adapter.`
  `LogD3D12RHI: Adapter was not found`
  `LogWindows: FPlatformMisc::RequestExit(1, HandleUnsupportedRHI.D3D12)`（启动 ~6s 即退）
- 上下文：枚举段里目标序号是 `Microsoft Basic Render Driver (VendorId: 1414)`

## 机理

多卡机 DXGI 枚举含 BRD 软件卡；引擎枚举时 `bSkipWARP = (!bRequestedWARP && bIsWARP &&
!bAllowSoftwareRendering)` **先行剔除软件卡**——即使 `-GraphicsAdapter=N` 显式点名该序号也救不回来；
其余物理卡又因 `AdapterIndex != N` 全部被跳过 → 候选集空。物理卡插拔/驱动重置后**枚举顺序会变**
（BRD 位置漂移），编排器按 DXGI 序号派卡即踩中。源码：WindowsD3D12Device.cpp。

## 对治

- 责任方：编排器。GPU 映射改用 `gpuAdapterLuid`/总线地址（进程已在自报），过滤 VendorId 1414；
  连续失败 N 次熔断+告警（实测案例：每 6 秒盲试 34.3 小时共 10,964 次）。

## 证据

- 2026-08-26 14:48:51 起崩溃循环（`019ff533-.../2026-08-26/14-48-51.log` 等 10,964 个）
