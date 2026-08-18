# 诊断报告：aes6-ue-runtime-ci #3939 构建失败

> 任务性质：纯诊断（未修改任何代码 / 未创建分支 / 未提交 / 未改动 Jenkins）。
> 日志副本：`outputs/console.log`（94,368 字节，与 Jenkins console 输出一致）。

## 摘要

| 项 | 值 |
|---|---|
| 构建 | `aes6-ue-runtime-ci` #3939（FAILURE，耗时 4m40s） |
| 失败阶段 | `Package Project` → UAT `BuildCookRun -build` → UBT 编译 `TWE` (Win64 Development) |
| 主错误 | UBT ExitCode=6：`Missing precompiled manifest for 'TraceAnalysis'` |
| 引入提交 | AesWorld `5e33587` 「新增AesWorldInsights性能分析模块，重构ProducerGraph接口」（2026-04-07 21:17） |
| 结论 | **该构建的失败已在 dev 分支修复**（AesWorld `8894ec395`，2026-04-08 02:07），修复后 #3940 已 SUCCESS。#3939 属于"修复落地前的一次性红灯"，无需新动作。 |

时间线：#3938 SUCCESS → 提交 `5e33587`（引入破坏）→ **#3939 FAILURE**（本构建，检出即破坏提交）→ 提交 `8894ec395`（拆分模块修复）→ #3940 SUCCESS。

## 诊断：UBT ExitCode=6 — Missing precompiled manifest (TraceAnalysis) — Source/AesWorldInsights/AesWorldInsights.Build.cs

**错误信息**：

```
Missing precompiled manifest for 'TraceAnalysis',
'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled.
This module can not be referenced in a monolithic precompiled build, remove this reference or migrate to a fully compiled source build.
This module was most likely not flagged during a release for being included in a precompiled build -
set 'PrecompileForTargets = PrecompileTargetsType.Any;' in TraceAnalysis.Build.cs to override.
Dependent modules 'AesWorldInsights TraceServices'
```

级联错误（非根因）：`UnrealBuildTool failed` → `BUILD FAILED` → `ERROR: Package project failed.`（Auto Test / Archive 阶段全部跳过）。

**根因分析**：

1. #3939 检出的 AesWorld（dev @ `5e33587`）新增了模块 `AesWorldInsights`（uplugin 中 `Type: DeveloperTool`），其 `AesWorldInsights.Build.cs` **无条件**声明了私有依赖：
   ```csharp
   PrivateDependencyModuleNames.AddRange(new string[] {
       "Json", "JsonUtilities", "Projects",
       "TraceAnalysis",   // ← 直接依赖
       "TraceServices"    // ← 传递依赖 TraceAnalysis
   });
   ```
2. 该 CI 使用**安装版引擎**（`D:\Epic\UE_5.5_51`，UBT 带 `-installed`）打包游戏。`TWE` 是**单体（monolithic）游戏 target**，只能引用在安装版引擎中已预编译（存在 `.precompiled` manifest）的引擎模块。
3. `TraceAnalysis` 是面向编辑器/分析工具的引擎模块，未对 `UnrealGame` 配置预编译，因此 UBT 在模块依赖图解析阶段直接报错（ExitCode=6），打包失败。
4. 同一构建中更早的 `TWEEditor`（模块化 editor target）编译成功——编辑器 target 链接的是安装版引擎自带的 `UnrealEditor-*.dll`，不受此限制，这解释了"editor 绿、game 红"的现象。

**置信度**：高（知识库精确命中同一构建号 + 源码/提交历史独立复核 + 修复提交已在后续构建验证通过）。

### 证据

#### Phase 2 检查清单

| 步骤 | 状态 | 结果 |
|---|---|---|
| 2.1 源码 | 已完成 | CI commit 处 `AesWorldInsights.Build.cs` 含 `TraceAnalysis`/`TraceServices` 依赖；uplugin 注册为 `DeveloperTool` |
| 2.2 知识库 | 已完成 | `085-precompiled-manifest-traceanalysis-module-dep.md`，评分 9/10 |
| 2.3 Epic | 已跳过 | 知识库评分 ≥ 8（技能规则允许跳过）；当前环境亦无 `epic-ue-assistant` 技能 |
| 2.4 Web | 已跳过 | 知识库 ≥ 8 且已有已验证修复（#3940 SUCCESS） |

#### 详细证据

- **知识库**：`C:\Users\Administrator\memory\jenkins-learnings\details\085-precompiled-manifest-traceanalysis-module-dep.md`，评分 **9/10**——条目即针对本构建 #3939，错误信息逐字一致，根因、修复提交（`8894ec3`）、修复后构建（#3940 SUCCESS）全部齐备。
- **源码上下文**（本地 `D:\Git\AesWorld`，按 CI commit `5e33587` 只读取证，未切分支）：
  - `Source/AesWorldInsights/AesWorldInsights.Build.cs`：`PrivateDependencyModuleNames` 含 `"TraceAnalysis"`、`"TraceServices"`（上文引述）；
  - `AesWorld.uplugin`：`AesWorldInsights` 条目 `Type: DeveloperTool, LoadingPhase: PostEngineInit, PlatformAllowList: [Win64, ...]`；
  - `git log`：该 Build.cs 仅由 `5e33587` 引入（2026-04-07 21:17），即 #3939 检出的 AesWorld tip（与构建通知 `AesWorld: 5e33587 新增AesWorldInsights性能分析模块` 一致）；
  - 修复提交 `8894ec395`「拆分AesWorldInsights为AesWorldProfiling(Runtime)和AesWorldInsights(Program)」（2026-04-08 02:07，xiongxing）：运行时部分拆为 `AesWorldProfiling`（依赖仅 Core/CoreUObject/Engine/TraceLog/Json/JsonUtilities/Projects，**不再含 TraceAnalysis/TraceServices**），Trace 分析部分移至 `Tests/AesWorldInsights/` 独立 Program（自带 `.Target.cs`），`TraceServices`/`TraceAnalysis` 依赖仅保留在 Program 侧。
- **Epic 指引**：跳过——知识库评分 ≥ 8，且当前环境未安装 `epic-ue-assistant` 技能（优雅降级）。
- **Web 搜索**：跳过——知识库 ≥ 8 且修复已在线上构建验证。
- **Jenkins 交叉验证**（只读）：#3938 SUCCESS、#3939 FAILURE、#3940 SUCCESS，与"单提交破坏、单提交修复"的时间线完全吻合。

### 修复建议

**针对本构建：无需任何操作。** 破坏性提交 `5e33587` 之后 dev 已合入修复 `8894ec395`，#3940 起流水线恢复绿色。若需在仍基于旧 commit 的其他分支上恢复构建，cherry-pick `8894ec395` 即可。

若类似问题再次出现（新模块依赖引擎编辑器侧模块导致 runtime 打包失败），修复模式参照 `8894ec395`：

1. **拆分模块**：运行时可用的采集/打点代码放入 Runtime 模块（仅依赖 `TraceLog` 等运行时可用模块）；依赖 `TraceServices`/`TraceAnalysis` 的离线分析代码放入 Editor 模块或独立 Program（自带 `.Target.cs`），使其不进入游戏 target 的模块依赖图。
2. 不建议按错误提示去改引擎 `TraceAnalysis.Build.cs` 的 `PrecompileForTargets`——CI 用的是安装版引擎（`D:\Epic\UE_5.5_51`），引擎侧不可改，且会引入源码版引擎依赖。
3. 预防：给插件模块新增引擎依赖前，先确认该引擎模块对 monolithic game target 是否有预编译 manifest（查看其 `Build.cs` 的 `PrecompileForTargets`）；开发者本地用源码版引擎编译通过不代表安装版引擎 CI 能过。

### 参考资料

- 知识库条目：`C:\Users\Administrator\memory\jenkins-learnings\details\085-precompiled-manifest-traceanalysis-module-dep.md`（索引：`C:\Users\Administrator\memory\jenkins-learnings\index.md`）
- 失败构建：http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/console
- 修复提交：AesWorld dev `8894ec3951df7601814361a2ad93c5b3e4c6965b`（本地仓库 `D:\Git\AesWorld`）
- 日志原始保存路径：`C:\Users\Administrator\memory\jenkins-learnings-raw\tmp\ue-error\aes6-ue-runtime-ci_3939_20260814_145531.log`
