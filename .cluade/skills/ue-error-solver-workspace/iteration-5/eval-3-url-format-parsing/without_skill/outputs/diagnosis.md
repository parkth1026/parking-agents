# Jenkins Build Failure Diagnosis

## Build Information

| Field | Value |
|-------|-------|
| **Job** | wdp-ue / Earth / aes6-ue-runtime-ci |
| **Build Number** | #3939 |
| **Result** | FAILURE |
| **Duration** | ~4m 40s (279701ms) |
| **Triggered By** | GitLab push by xiongxiong |
| **Engine** | UE 5.5 (D:\Epic\UE_5.5_51) |
| **Target Platform** | Windows (Win64) |
| **Failed Stage** | Package Project (BuildCookRun) |

## Trigger Commit

- **Repository**: AesWorld (http://10.100.10.55/neon/AesWorld.git dev)
- **Commit**: `5e33587` - "新增AesWorldInsights性能分析模块，重构ProducerGraph接口"
- **Author**: xiongxiong

## Root Cause

**Missing precompiled manifest for 'TraceAnalysis' module**

The build **succeeded** in the **Compile Editor** stage (519/519 targets compiled, ExitCode=0), but **failed** in the **Package Project** stage when running `BuildCookRun` for the runtime (Game) target TWE (Win64 Development).

The key error:

```
Missing precompiled manifest for 'TraceAnalysis', 'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled.
This module can not be referenced in a monolithic precompiled build, remove this reference or migrate to a fully compiled source build.
This module was most likely not flagged during a release for being included in a precompiled build - set 'PrecompileForTargets = PrecompileTargetsType.Any;' in TraceAnalysis.Build.cs to override.
Dependent modules 'AesWorldInsights TraceServices'
```

UnrealBuildTool exited with **ExitCode=6** (compile/build error).

## Detailed Analysis

1. The newly added **AesWorldInsights** module (from commit `5e33587`) has a dependency chain that references the **TraceAnalysis** engine plugin.

2. The dependency chain is: **AesWorldInsights** -> **TraceServices** -> **TraceAnalysis**

3. **TraceAnalysis** is an engine plugin that is available for **Editor** builds (which is why the editor compilation at step 519/519 succeeded), but its `.precompiled` manifest does not exist for the **Game** (UnrealGame) target configuration.

4. When packaging for runtime (Win64 Development, non-editor), UBT tries to resolve all module dependencies. Since TraceAnalysis was not flagged with `PrecompileForTargets = PrecompileTargetsType.Any` in the engine's precompiled build, it cannot be referenced by a Game target in a precompiled (installed) engine setup.

5. This is a classic problem when using an **installed/precompiled engine** (not built from source) and referencing engine modules that are only available for Editor targets.

## Why Editor Build Succeeded But Package Failed

- The **Editor** build (`TWEEditor` target) compiles with `UnrealEditor` configuration, where TraceAnalysis is available as a precompiled module.
- The **Game/Runtime** build (`TWE` target, `UnrealGame` configuration) uses a different set of precompiled manifests. TraceAnalysis was never included in the Game precompiled build of UE 5.5, so it is unavailable.

## Recommended Fix

There are several approaches to resolve this, ordered by preference:

### Option 1: Conditionally exclude TraceAnalysis dependency for non-editor builds (Recommended)

In the **AesWorldInsights** module's `.Build.cs` file, wrap the TraceServices/TraceAnalysis dependency so it only applies to Editor targets:

```csharp
if (Target.Type == TargetType.Editor)
{
    PrivateDependencyModuleNames.Add("TraceServices");
    // or whatever references TraceAnalysis
}
```

Also wrap any code that uses TraceAnalysis/TraceServices APIs with preprocessor guards:

```cpp
#if WITH_EDITOR
// TraceAnalysis-related code
#endif
```

### Option 2: Remove the TraceAnalysis/TraceServices dependency entirely

If the performance analysis (Insights) functionality is only needed during development/editor sessions, consider removing the runtime dependency on TraceServices/TraceAnalysis and using alternative profiling approaches for runtime builds.

### Option 3: Build the engine from source

If TraceAnalysis is truly needed at runtime, build UE 5.5 from source with TraceAnalysis included for Game targets. This is the most invasive option and generally not recommended for CI pipelines using installed builds.

## Additional Warnings (Non-blocking)

The build log also contains several deprecation warnings that should be addressed before the next UE version upgrade:

1. **Sort API deprecated**: `EarthZoneGraphBVTree.cpp(77)` - Replace `Sort` with `Algo::Sort`
2. **BezierUtilities.h deprecated**: File moved to `Curves/BezierUtilities.h`
3. **FSelectedOjectsChangeList deprecated**: `EarthModelerSelectionUtil.cpp` - Use `FSelectedObjectsChangeList` instead (typo fix in API)
4. **StructUtils plugin deprecated**: AesWorld depends on `StructUtils` which is deprecated in UE 5.5

## Summary

The build failed because the new **AesWorldInsights** module introduced in commit `5e33587` depends on **TraceServices** which in turn depends on **TraceAnalysis** -- an engine module not available for Game/Runtime targets in the precompiled UE 5.5 installation. The fix is to make this dependency editor-only by conditionalizing it in the module's Build.cs file.
