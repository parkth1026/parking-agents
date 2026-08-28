# UE 运行日志领域知识

分析 UE 运行日志前需要掌握的格式与语义。脚本负责提取，本文负责解读。

## 行格式解剖

```
[2026.08.25-08.51.34:572][253]LogAesEarth: Display: [EarthReady] Timer: 12.0
└───────┬───────────────┘└─┬─┘└───┬────┘└──┬────┘
      时间戳           帧号    日志类别   级别+正文
```

- **时间戳** `YYYY.MM.DD-HH.MM.SS:mmm`：**默认 UTC**（`log.Timestamp` cvar 默认值 1，
  LaunchEngineLoop.cpp）。`Engine.ini [LogFiles] LogTimes=Local` 可切为本地时间（AES 部分
  部署机是本地时间）。**判别办法**：与日志内 KeepAlive 的 `Data:` epoch 字段或 `Log file open`
  行交叉换算，别猜。`log.Timestamp` 共 5 档：0=无时间戳 / 1=UTC / 2=自启动秒数
  （`[0130.29][420]` 形态）/ 3=本地 / 4=时间码（`[17:59:50:18]` 形态）。
  脚本已支持 2/4 形态解析（判活/间隔不受影响，绝对时间不可得）；0 档零前缀行会得到
  「检查 log.Timestamp」提示而非误判。
- **帧号** `[N]`：**游戏线程当前帧 mod 1000**（UE5 原生，`GFrameCounter % 1000`，%3llu 格式）。
  GFrameCounter 由游戏线程每引擎 tick +1（FEngineLoop::Tick 末尾）——这是 UE 日志独有的判活
  信号（见下节），且**必然在 999 处回绕**。
- **无前缀行**：多行消息的续行（ensure 块、KeepAlive 体、callstack），或首条时间戳行之前的输出
  （启动早期 `AppInit` 阶段日志无前缀，如 `LogRHI: Using Default RHI`、CSV 元数据块）。
  挂在最近带前缀行上理解。

## 帧号语义（判活第一信号）

| 形态 | 含义 | 典型原因 |
| --- | --- | --- |
| 全程帧 0 | 游戏线程从未出帧 | LoadMap 同步加载卡死（PROJ/GDAL 坐标转换、FlushAsyncLoading、同步 IO） |
| 帧号停滞（时间走、帧号不走） | 游戏线程卡死在某一帧 | 死锁、同步阻塞（FlushRenderingCommands 等 PSO、阻塞 IO） |
| 帧号持续增长但 FPS 骤降 | 存活但负载异常 | 流送风暴、PSO 编译、GC、卡顿源在后台线程 |
| 帧号增长至日志结束 | 存活 | —— |

帧号只反映**游戏线程**；渲染线程卡死时游戏线程通常随后阻塞在 flush 上（帧号随后也停）。
GPU 占用归零 + 画面冻结的经典链路：游戏线程阻塞 → 渲染线程无新帧提交 → GPU 无工作。

## 关键日志类别速查

| 类别 | 关注点 |
| --- | --- |
| `LogOutputDevice` | ensure（`=== Handled ensure: ===`）与 callstack，非致命但要读栈 |
| `LogStreaming` | `Couldn't find file for package`（pak 缺资产）、`RequestLevel(...) is flushing async loading`（同步流送） |
| `LogLoad` | `LoadMap:`、`Failed to enter <地图>`（地图加载失败） |
| `LogD3D12RHI` | `Waited for PSO creation for Nms`（PSO 无缓存/编译慢，注意递增序列 100→200→400→800→1600） |
| `LogWorld` | `BeginTearingDown`（换图/清理） |
| `LogExit` | `Exiting` = 正常退出，出现在尾部可排除"卡死" |
| `LogWindows` | `Fatal error` / `Critical error` / `Unhandled Exception` = 崩溃 |
| `LogNaniteStreaming` | `legacy IO path` 警告 = 未启用 ioStore，流送慢 |

## 终止形态判定

| 尾部特征 | 判定 |
| --- | --- |
| `LogExit: Exiting` | 正常退出 |
| `Fatal error` / `Critical error` / `Unhandled Exception` | 崩溃终止——继续找 `.dmp`/crash 上下文 |
| 都没有，日志戛然而止 | 进程被杀（人工/运维/容器回收）、断电或日志拷贝截止。**心跳类日志（KeepAlive ping/pong）到最后仍正常 = 被杀前进程健康** |

## 常见错误模式库（实战沉淀·速查层）

> 本节是**速查层**：怎么读日志的阅读知识（回绕/_2 后缀/RHI 早死/LOW-POWER/循环簇）只活在这里。
> 真错误模式的**增长层**在 `patterns/`（schema + 去重 + recurrence 回流 + 校验），
> `errors --kb patterns` 可自动匹配标注；新实证模式入库见 method.md 增长纪律。

1. **异步加载线程上的 ensure**：`Ensure condition failed: IsInGameThread()` + 栈含
   `FCoreRedirects::Initialize` ← `FLinkerLoad::AddKnownMissingPackage` ← `FAsyncPackage::CreateLinker`。
   机制：EDL 在异步加载线程上找不到包 → AddKnownMissing → FCoreRedirects 惰性初始化撞线程断言。
   根因是**那个包不在 pak 里**（看上一条 `Couldn't find file for package`），ensure 只是连锁。
2. **PSO 等待**：打包版无 PSO 持久化缓存时，首次渲染每种材质组合都触发驱动编译；
   多实例同秒冷启动会争抢驱动级编译队列，等待次数暴增。
3. **`Can't Find URL: ResX=200` / `Failed to enter ...Maps/`**：启动参数 `ResX=...` 缺 `-` 前缀
   被并入默认地图 URL。引擎随后 Browse 自愈，但产生报错噪声。
4. **像素流 LOW-POWER 语义**（PixelStreaming 类插件）：预热实例无玩家连接时自动降分辨率
   （如 200x200）+ 静音——**GPU 占用≈0 是设计行为**，不是故障。判定真假卡死要用帧号，
   不要用 GPU 占用。玩家接入/断开会有 `FULL-SPEED`/`LOW-POWER` 切换日志。
5. **PROJ/GDAL 文件钩子刷屏**：`FEarthUFSProj::open 'proj.db'` 反复 open/close = 每次坐标
   转换重开 SQLite 数据库，PJ 上下文未复用——游戏线程同步阻塞的直接证据。
6. **帧号 mod 1000 回绕（UE5 引擎原生，非定制）**：`log.Timestamp` cvar 帮助原文即
   "Layout: [time][frame mod 1000]"，实现见 `OutputDeviceHelper.cpp`
   （`Format.Appendf(TEXT("[%3llu]"), GFrameCounter % 1000)`）。GFrameCounter 由游戏线程每引擎
   tick +1（`LaunchEngineLoop.cpp` FEngineLoop::Tick 末尾）。**UE5 日志帧号列必然在 999 处回绕**，
   长日志出现 999→000 序列是常态；"最大帧号 999"是回绕假象，跨回绕的 FPS 会算错；
   **冻结段判定不受影响**（帧号恒定=无帧推进）。frames 子命令已自动检测并解绕。
7. **海量等大小小文件 + 固定间隔 = 编排器崩溃重试循环**：目录里成千上万个 ~25KB、
   每隔 N 秒一个的日志 = 每次启动都在同一处失败退出、上层不断重拉。抽样 1 个解剖尾部的
   `RequestExit(reason)` 即得死因；首尾文件的时间差 × 间隔 = 重试次数。别全量跑脚本。
8. **`-GraphicsAdapter=N` 踩到软件卡（WARP 过滤先于序号匹配）**：多卡机上 DXGI 枚举含
   Microsoft Basic Render Driver（VendorId 1414）。`WindowsD3D12Device.cpp` 枚举时
   `bSkipWARP = (!bRequestedWARP && bIsWARP && !bAllowSoftwareRendering)` **先行剔除软件卡**——
   即使 `-GraphicsAdapter=N` 显式点名该序号也救不回来；其余物理卡又因
   `AdapterIndex != CVarExplicitAdapterValue` 全部被跳过 → 候选集空 →
   `Failed to choose a D3D12 Adapter` → `RequestExit(1, HandleUnsupportedRHI.D3D12)`，启动 ~6s 即退。
   物理卡插拔/驱动重置后**枚举顺序会变**（BRD 位置漂移），编排器按 DXGI 序号派卡是脆弱设计，
   对治：按 LUID/总线地址映射。
9. **像素流多线程委托数据竞争 ensure → 静默冻结**：`Data race detected` + 栈含
   `TMulticastDelegate<...>::Broadcast` ← 插件 Stats/事件聚合 ← `rtc_ue5::Thread` /
   `VideoStreamEncoder::OnFrame` = 非线程安全委托（FNotThreadSafeDelegateMode）被编码/RTC
   线程并发 Broadcast。ensure 本身非致命，但竞争可损坏调用列表——后续游戏线程 Broadcast
   可**无任何日志地永久挂死**（帧号冻结、其余线程心跳正常、无 Device Removed）。玩家每次
   接入都会触发一次该竞争（接入时刻与 ensure 时刻强相关），是"接入后画面卡死/掉线"的
   首要嫌疑。
10. **RHI 初始化早于启动信息打印**：UE5.5 中 RHI 模块加载/适配器枚举发生在
   `FApp::PrintStartupLogMessages()`（打印 `LogInit: Engine Version` / `LogInit: Command Line`，
   App.cpp）**之前**——选卡失败的短日志没有 Command Line 行，完整命令行只存在于
   `LogCsvProfiler: Display: Metadata set : commandline="..."` 元数据里。恢复启动参数要 grep 元数据。

## 与其他日志的配合

- `-ABSLOG=<path>` 指定绝对路径日志；同进程可能同时写默认日志（`Saved/Logs/<项目名>.log`）。
- **`_2`/`_3` 后缀的真实机理**：`FOutputDeviceFile::CreateWriter` 打开主文件失败（被其他进程
  占用锁，如同机多进程共用一个 `-ABSLOG` 基名、或 server+client 同机同日志名）时自动滚动
  `_2`、`_3`…重试——**后缀 = 主文件被并发占用**，不是"同一进程的第二份输出"。编排器给同秒
  拉起的多个 UE 传同一 ABSLOG 基名时，就得到 `14-13-00.log/_2/_3/_4` 这样的槽位族。
- 崩溃时另查 `Saved/Crashes/`、`Saved/Logs/` 旁的 `.dmp`。
