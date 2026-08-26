# UE 运行日志领域知识

分析 UE 运行日志前需要掌握的格式与语义。脚本负责提取，本文负责解读。

## 行格式解剖

```
[2026.08.25-08.51.34:572][253]LogAesEarth: Display: [EarthReady] Timer: 12.0
└───────┬───────────────┘└─┬─┘└───┬────┘└──┬────┘
     UTC 时间戳          帧号    日志类别   级别+正文
```

- **时间戳** `YYYY.MM.DD-HH.MM.SS:mmm`：默认 UTC（打包版），与时区无关，只看相对间隔。
- **帧号** `[N]`：**游戏线程当前帧**。这是 UE 日志独有的判活信号（见下节）。
- **无前缀行**：多行消息的续行（ensure 块、KeepAlive 体、callstack），或首条时间戳行之前的输出（如 `aqProf.dll` 加载失败）。挂在最近带前缀行上理解。

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

## 常见错误模式库（实战沉淀）

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

## 与其他日志的配合

- `-ABSLOG=<path>` 指定绝对路径日志；同进程可能同时写默认日志（`Saved/Logs/<项目名>.log`），
  同秒启动的多实例归档会撞名加 `_2` 后缀——拿到多份日志先判断是同一进程的双写还是多实例。
- 崩溃时另查 `Saved/Crashes/`、`Saved/Logs/` 旁的 `.dmp`。
