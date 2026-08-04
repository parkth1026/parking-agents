# autoci #3939 构建失败诊断报告

## 基本信息

| 项目 | 详情 |
|------|------|
| **构建编号** | #3939 |
| **Jenkins Job** | wdp-ue/Earth/aes6-ue-runtime-ci |
| **构建结果** | FAILURE |
| **触发方式** | GitLab push by xiongxiong |
| **构建耗时** | 约 4 分 40 秒 (279701ms) |
| **失败阶段** | Package Project (打包阶段) |
| **上一次构建** | #3938 - SUCCESS |
| **引擎版本** | UE 5.5 (D:\Epic\UE_5.5_51) |
| **目标平台** | Win64 / Development |

## 触发提交

本次构建由 AesWorld 插件的一次 Git push 触发，关键提交：

- **AesWorld**: `5e33587` - "新增AesWorldInsights性能分析模块，重构ProducerGraph接口"

## 错误分析

### 核心错误

构建在 **Package Project** 阶段失败（Editor 编译阶段已成功通过）。

UnrealBuildTool 在构建 Game target（TWE Win64 Development）时报错：

```
Missing precompiled manifest for 'TraceAnalysis', 
'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled.

This module can not be referenced in a monolithic precompiled build, 
remove this reference or migrate to a fully compiled source build.

This module was most likely not flagged during a release for being included 
in a precompiled build - set 'PrecompileForTargets = PrecompileTargetsType.Any;' 
in TraceAnalysis.Build.cs to override.

Dependent modules 'AesWorldInsights TraceServices'
```

**ExitCode=6** (UBT 构建失败)

### 根因分析

1. **直接原因**：新增的 `AesWorldInsights` 模块依赖了引擎的 `TraceServices` 模块，而 `TraceServices` 又依赖了 `TraceAnalysis` 模块。`TraceAnalysis` 是一个引擎内部模块，在预编译(precompiled/installed)引擎构建中**没有提供预编译的 manifest 文件**。

2. **为什么 Editor 构建成功但 Package 失败**：Editor 构建使用的是 `UnrealEditor` target (TWEEditor)，这是一个非单体(modular)构建，模块以 DLL 形式单独编译链接，对预编译 manifest 的要求不同。而 Package 阶段构建的是 `Game` target (TWE Win64 Development)，这是一个**单体(monolithic)构建**，需要将所有模块静态链接在一起，此时 UBT 会检查所有依赖模块是否有预编译 manifest，`TraceAnalysis` 没有，因此构建失败。

3. **引入时机**：这个问题是由提交 `5e33587` ("新增AesWorldInsights性能分析模块") 引入的。该模块在 Build.cs 中添加了对 `TraceServices` 的依赖，而 `TraceServices` 传递依赖了 `TraceAnalysis`。

### 依赖链

```
AesWorldInsights -> TraceServices -> TraceAnalysis (缺少预编译 manifest)
```

## 修复建议

有以下几种修复方案（按推荐程度排序）：

### 方案一：移除对 TraceServices/TraceAnalysis 的依赖（推荐）

如果 `AesWorldInsights` 模块的性能分析功能不是必须依赖 `TraceServices`，可以：

1. 在 `AesWorldInsights.Build.cs` 中移除对 `TraceServices` 的 `PublicDependencyModuleNames` 或 `PrivateDependencyModuleNames` 引用
2. 改用其他不受此限制的性能分析 API（如 `Stats`/`Stats2` 宏、`FAutoConsoleCommand` 等）

### 方案二：条件编译依赖

在 `AesWorldInsights.Build.cs` 中，仅在 Editor 构建时引用 `TraceServices`：

```csharp
if (Target.Type == TargetType.Editor)
{
    PrivateDependencyModuleNames.Add("TraceServices");
    PrivateDefinitions.Add("WITH_TRACE_SERVICES=1");
}
```

然后在 C++ 代码中用 `#if WITH_TRACE_SERVICES` 条件编译包裹相关代码。

### 方案三：修改引擎 TraceAnalysis.Build.cs（不推荐）

在 `D:\Epic\UE_5.5_51\Engine\...\TraceAnalysis\TraceAnalysis.Build.cs` 中添加：

```csharp
PrecompileForTargets = PrecompileTargetsType.Any;
```

然后重新编译引擎。此方案不推荐，因为需要修改引擎源码，且可能在引擎升级时丢失。

## 警告（非致命）

构建日志中还存在以下弃用警告，虽然不影响本次构建，但建议后续修复：

1. `Sort` 已弃用，请改用 `Algo::Sort`（EarthZoneGraphBVTree.cpp:77）
2. `BezierUtilities.h` 已移动到 `Curves/BezierUtilities.h`
3. `FSelectedOjectsChangeList` 已弃用，请改用 `FSelectedObjectsChangeList`（EarthModelerSelectionUtil.cpp）
4. 插件 `AesWorld` 依赖了已弃用的 `StructUtils` 插件（5.5 版本弃用）

## 总结

**autoci #3939 构建失败的根本原因**：新增的 `AesWorldInsights` 模块通过 `TraceServices` 间接依赖了引擎的 `TraceAnalysis` 模块，而该模块在预编译引擎中不可用于 Game target 的单体构建。Editor 编译阶段通过（因为是模块化构建），但 Package 打包阶段失败（因为是单体构建需要预编译 manifest）。

**最佳修复方案**：在 `AesWorldInsights.Build.cs` 中将 `TraceServices` 依赖改为仅 Editor target 可用，或者完全移除该依赖，改用其他性能统计方案。
