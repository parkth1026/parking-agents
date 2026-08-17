# AutoCI #3939 构建失败诊断报告

## 基本信息

| 项目 | 详情 |
|------|------|
| 构建编号 | #3939 |
| 任务 | wdp-ue/Earth/aes6-ue-runtime-ci |
| 触发者 | GitLab push by xiongxiong |
| 触发时间 | 2026-04-07 21:21 |
| 失败阶段 | Package Project (Game Target 构建) |
| 退出码 | ExitCode=6 |

## 错误摘要

构建在 **Package Project** 阶段失败。Editor Target (`TWEEditor`) 编译成功（519/519 actions，耗时约200秒），但随后的 Game Target (`TWE Win64 Development`) 在 UBT makefile 生成阶段即失败，未进入实际编译。

### 核心错误信息

```
Missing precompiled manifest for 'TraceAnalysis',
'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled.
This module can not be referenced in a monolithic precompiled build, remove this reference
or migrate to a fully compiled source build.

This module was most likely not flagged during a release for being included in a precompiled build
- set 'PrecompileForTargets = PrecompileTargetsType.Any;' in TraceAnalysis.Build.cs to override.

Dependent modules 'AesWorldInsights TraceServices'
```

## 根因分析

### 直接原因

`AesWorldInsights` 模块（位于 `Tests/AesWorldInsights/`）在其 `AesWorldInsights.Build.cs` 中声明了对以下引擎模块的依赖：

- `TraceAnalysis`
- `TraceServices`
- `TraceLog`

这些是 Unreal Insights（引擎性能分析工具）的内部模块。在 **Editor** 构建中，这些模块可正常链接（Editor 使用 modular/DLL 链接方式）。但在 **Game** 打包构建中，引擎以 **预编译（precompiled/installed）** 模式使用，`TraceAnalysis` 模块没有生成 `.precompiled` manifest 文件，因此 UBT 拒绝将其纳入 monolithic 构建。

### 触发提交

- **仓库**: AesWorld（`http://10.100.10.55/neon/AesWorld.git`，dev 分支）
- **提交**: `5e33587` — "新增AesWorldInsights性能分析模块，重构ProducerGraph接口"
- **作者**: xiongxing

此提交新增了 `AesWorldInsights` 模块，该模块是一个独立的 **Program Target**（`TargetType.Program`，`LinkType.Monolithic`，`BuildEnvironment.Shared`），设计为独立可执行程序。然而，由于其 `.Target.cs` 和 `.Build.cs` 文件被放置在插件的 `Tests/` 目录下，UBT 在为 Game Target 创建 makefile 时会扫描到这些文件并尝试解析其依赖关系，导致对 `TraceAnalysis` 的依赖检查失败。

### 关键文件

| 文件 | 路径 |
|------|------|
| Build.cs | `AesWorld/Tests/AesWorldInsights/AesWorldInsights.Build.cs` |
| Target.cs | `AesWorld/Tests/AesWorldInsights/AesWorldInsights.Target.cs` |

### Build.cs 中的问题依赖（第21-22行）

```csharp
PrivateDependencyModuleNames.AddRange(
    new string[]
    {
        "ApplicationCore",
        "Core",
        "CoreUObject",
        "Projects",
        "TraceAnalysis",   // <-- 引擎 Insights 内部模块，无 precompiled manifest
        "TraceServices",   // <-- 引擎 Insights 内部模块，无 precompiled manifest
        "TraceLog",
        "Json",
        "JsonUtilities",
    }
);
```

## 影响范围

- **Editor 构建**: 不受影响（已成功）
- **Game/Runtime 打包**: 完全阻塞，无法生成 makefile
- **Auto Test**: 因 Package 失败而跳过
- **Archive**: 因 Package 失败而跳过

## 建议修复方案

### 方案 A：条件编译排除（推荐）

在 `AesWorldInsights.Build.cs` 中添加 Target 类型检查，仅在 Editor/Program 构建时包含 Trace 相关依赖：

```csharp
if (Target.Type == TargetType.Editor || Target.Type == TargetType.Program)
{
    PrivateDependencyModuleNames.AddRange(new string[]
    {
        "TraceAnalysis",
        "TraceServices",
    });
}
```

### 方案 B：将模块移出插件目录

将 `AesWorldInsights` 的 `Tests/` 目录移到项目级别的 `Source/Programs/` 下，避免 UBT 在扫描插件时解析到这个 Program Target。

### 方案 C：从 Game Target 排除该模块

确保 `AesWorldInsights` 模块不会被 Game Target 的依赖链引用到。检查是否有其他模块（如 `AesWorldProfiling`）间接引用了 `AesWorldInsights`。

## 附加警告（非阻塞）

1. **StructUtils 弃用警告**: `Plugin 'AesWorld' depends on plugin 'StructUtils' which was deprecated in 5.5 and will soon be removed.` — 需要迁移。
2. **Sort API 弃用**: `EarthZoneGraphBVTree.cpp(77): warning C4996: 'Sort': Sort is deprecated, please use Algo::Sort.` — 需要更新 API 调用。
3. **FSelectedOjectsChangeList 弃用**: `EarthModelerSelectionUtil.cpp` 中多处使用了已弃用的类名，需替换为 `FSelectedObjectsChangeList`。
4. **XGE 许可证未激活**: 构建系统以 standalone 模式运行，未使用分布式编译加速。
