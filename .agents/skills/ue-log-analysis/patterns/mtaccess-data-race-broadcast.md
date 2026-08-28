---
name: mtaccess-data-race-broadcast
category: hang
signature: "[N.N.N-N.N.N:N][N]LogOutputDevice: Error: Data race detected: other thread(s) ac"
match: "Data race detected"
first-seen: 2026-08-26
last-seen: 2026-08-27
verified: true
sources:
  - Docs/bugs/2026-08-27-multigpu-pixelstreaming-gpu3d-zero-freeze-diagnosis.md
---

## 识别特征

- match: `Data race detected`
- 错误原句：
  `Data race detected: other thread(s) activity during acquiring write access on thread 36292: 0 -> 0 readers, 4095 -> 4095 writers on thread 4294967295 -> 32340:`
- 配套栈（紧跟的 Callstack 行）：`TMulticastDelegate<...>::Broadcast ← 插件 Stats/事件聚合 ← rtc_ue5::Thread / VideoStreamEncoder::OnFrame`
- 委托注册形态：`FNotThreadSafeDelegateMode`（栈里 TDelegateAccessHandlerBase 模板参数可见）

## 机理

非线程安全委托被编码/RTC 工作线程与游戏线程并发 Broadcast。MTAccessDetector 只能**检测**部分竞争
（打得出 ensure 的都活了下来）；未被打断的并发写可损坏委托调用链，游戏线程随后 Broadcast
可**无任何日志地永久挂死**——帧号冻结、其余线程心跳正常、无 Device Removed。
已实证实例：PixelStreaming51Cloud FStats（Stats.cpp:191 FireStatChanged），玩家每次接入
38s~3min 内必触发（5/5 槽位，2026-08-26/27）。

## 对治

- 责任方：代码（当前实证：PixelStreaming51Cloud）。委托改 FThreadSafeDelegateMode，或
  编码/RTC 线程只做原子聚合、由游戏线程 tick 统一广播。
- 分析动作：ensure 时刻与玩家接入/资源事件时刻对齐 → 强相关即指向并发缺陷；
  读栈定位 Broadcast 的双线程归属。

## 证据

- 2026-08-26 GPU4 14:47:52 ensure → 14:52:46 永久冻结 18.4h（`14-13-00_4.log` L4251）
- 2026-08-27 09:10-09:14 四槽位接连触发（GPU0×4/GPU2×3/GPU5×4/GPU6×4）
