# 运行时错误分类路由表

先分类，再取径。拿到日志先跑 `frames`/`errors` 定类，按下表走对应路径；
分类不确定时先做**判活**（frames 四问）——判活结果会直接排除若干类别。
单条错误模式的具体机理见 `ue-log-format.md` 模式库。

## 路由表

| 类别 | 识别特征 | 首选动作 | 误报防范 |
| --- | --- | --- | --- |
| **crash 崩溃** | 尾部 `Fatal error` / `Critical error` / `Unhandled Exception` | 找 `Saved/Crashes/`、`.dmp`；`errors` 首类往前追 1-2 行找触发者 | 日志戛然而止 ≠ 崩溃：无尾部错误标记优先怀疑被杀/拷贝截止 |
| **ensure 连锁** | `=== Handled ensure: ===` + callstack（Error 或 Warning 级，由 `GEnsuresAreErrors` 决定） | 读栈找上游：栈顶常是受害者（如异步加载线程），触发者在其上方 1-2 行（常见：`Couldn't find file for package`） | ensure 非致命；排在 errors 首位不等于根因 |
| **hang 冻结** | 帧号冻结（frames 判活谱该小时=0）+ 心跳正常 + 无错误尾部 | `frames` 看冻结起点 → `gaps` 看空窗前最后几行 = 阻塞现场；查游戏线程阻塞源（同步 IO/死锁/FlushRenderingCommands） | 心跳正常 = 进程活着 = 不是崩溃；GPU 占用 0 是结果不是原因 |
| **struggle→freeze** | 冻结前有挣扎段（低 fps 仍出帧 ≥5s） | 冻结前兆：把冻结起点与接入/资源事件时间对齐（玩家连接、分辨率恢复、加载完成） | 挣扎段只认密接对（≤2s）；稀疏心跳的 fps 因帧号 mod 1000 歧义不参与 |
| **GPU 设备级** | `Device removed` / `DXGI_ERROR_DEVICE*` / `GPU hang` / 多日志间 DXGI 枚举序列变化 | **报运维**：事件查看器（nvlddmkm/Kernel-PnP）、驱动、PCIe/供电；不做代码归因 | 设备级事件会连坐全机进程，单进程日志只看到症状 |
| **infra 环境** | OOM（`LogMemory`暴涨/分配失败）/ 磁盘满 / 网络超时 / 依赖服务不可达 | **报运维** + 建议重试；不做代码归因 | 环境问题误当代码 bug 会浪费工程投入 |
| **启动失败** | 全程帧 0 + 尾部 `RequestExit(reason)` / RHI 失败 / `Failed to enter <地图>` | `env` 提取参数（早死日志命令行只在 CSV 元数据）→ 尾部死因：选卡失败（`-GraphicsAdapter` 踩软件卡）/ 缺包 ensure / 地图加载失败 | 帧全 0 也可能是正常 commandlet；看命令行确认形态 |
| **网络信令** | ICE 状态翻转（Connected→Disconnected→Closed）/ TURN 4xx / `Unsupported message's event type` | 对照信令协议与 TURN 鉴权配置；区分前端侧断开（Closed 直达）与服务侧超时（Disconnected 先行） | ICE 断开时游戏线程可能完全健康——先跑 frames 排除引擎侧 |
| **编排/部署** | 目录里等大小+固定间隔的海量小日志 | `inventory` 聚类抽样 1 个看死因；重试次数=首尾差÷间隔；查编排器为何无熔断 | 这是编排器行为不是引擎行为；逐个分析是浪费 |

## 分类不确定时

1. 先判活（frames 四问：出过帧吗/停在哪/怎么终止/活着但慢吗）。
2. 判活分岔的 A/B 对比用 `diff`：存活份携带的错误自动降级为非致死候选。
3. 多日志同因判定走 method.md 两层纪律：错误谱一致 ≠ 同因。

## 案例索引（实证过的类别）

- hang + struggle→freeze + 网络信令 + 编排/部署：`Docs/bugs/2026-08-27-multigpu-pixelstreaming-gpu3d-zero-freeze-diagnosis.md`
  （FStats 数据竞争 → GPU4 冻结 18.4h；GPU 消失 → 10,964 次选卡失败循环；TURN 403 → ICE 断）
- 启动失败（帧 0 + PSO/PROJ）：`Docs/bugs/2026-08-25-packaged-build-gpu-zero-freeze-analysis.md`
- ensure 连锁（缺包 → IsInGameThread）：fixtures/fixture-stall.log
