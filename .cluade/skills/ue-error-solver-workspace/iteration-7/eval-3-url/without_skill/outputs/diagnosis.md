# Build Failure Diagnosis

## Build Information

| Field | Value |
|-------|-------|
| **Job** | aes6-ue-runtime-ci |
| **Build Number** | #3939 |
| **URL** | http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/ |
| **Triggered By** | GitLab push by xiongxiong |
| **Build Node** | twe_autoci |
| **Workspace** | D:\Jenkins\workspace\wdp-ue\Earth\aes6-ue-runtime-ci |
| **Engine** | UE 5.5 (D:\Epic\UE_5.5_51) |
| **Result** | FAILURE (Package Error) |

## Failed Stage

**Package Project** (BuildCookRun) -- The Editor compilation stage succeeded (519/519 targets, ExitCode=0), but the subsequent game target build for packaging failed.

## Root Cause

### Missing Precompiled Manifest for TraceAnalysis Module

The build failed with **ExitCode=6** during the `BuildCookRun` packaging step when UnrealBuildTool attempted to compile the **TWE game target** (Win64, Development). The error is:

```
Missing precompiled manifest for 'TraceAnalysis',
'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled.
This module can not be referenced in a monolithic precompiled build, remove this reference or migrate to a fully compiled source build.

This module was most likely not flagged during a release for being included in a precompiled build -
set 'PrecompileForTargets = PrecompileTargetsType.Any;' in TraceAnalysis.Build.cs to override.

Dependent modules 'AesWorldInsights TraceServices'
```

### Why It Happened

1. The **AesWorld** plugin was updated with commit `5e33587` ("新增AesWorldInsights性能分析模块，重构ProducerGraph接口") which added a new module called **AesWorldInsights**.

2. The **AesWorldInsights** module depends on **TraceServices**, which in turn depends on the engine module **TraceAnalysis**.

3. The **TraceAnalysis** module is an engine plugin that does **not** have a precompiled manifest (`TraceAnalysis.precompiled` file is missing) for the `UnrealGame` (non-editor) target configuration.

4. During the **Editor build** (TWEEditor target), this works fine because editor builds may have different module availability. All 519 compilation steps succeeded.

5. During the **Game build** (TWE target, for packaging), UnrealBuildTool cannot resolve TraceAnalysis in the precompiled engine installation, causing the build to fail with ExitCode=6.

### Dependency Chain

```
AesWorldInsights (new plugin module)
  -> TraceServices (engine module)
    -> TraceAnalysis (engine module, NOT precompiled for game target)
```

## Recommended Fixes

### Option 1: Remove TraceAnalysis Dependency for Game Target (Recommended)

In the `AesWorldInsights` module's `.Build.cs` file, wrap the dependency on `TraceServices`/`TraceAnalysis` so it is only included for Editor targets:

```csharp
if (Target.Type == TargetType.Editor)
{
    PrivateDependencyModuleNames.Add("TraceServices");
}
```

This is the cleanest fix since performance analysis/insights tooling is typically only needed in the editor, not in packaged game builds.

### Option 2: Modify TraceAnalysis.Build.cs in Engine

Add `PrecompileForTargets = PrecompileTargetsType.Any;` in `TraceAnalysis.Build.cs`. However, this requires modifying the engine source, which may not be desirable in a precompiled engine setup.

### Option 3: Use Conditional Compilation

If some TraceAnalysis functionality is needed at runtime, use `#if WITH_EDITOR` guards in the AesWorldInsights code and conditionally include the module dependency only for editor builds.

## Additional Warnings (Non-blocking)

These warnings did not cause the failure but should be addressed:

1. **Deprecated API usage** in `EarthModelerSelectionUtil.cpp` (lines 8, 17, 28): `FSelectedOjectsChangeList` is deprecated, use `FSelectedObjectsChangeList` instead.
2. **Deprecated Sort API** in `EarthZoneGraphBVTree.cpp` (line 77): `Sort` is deprecated, use `Algo::Sort`.
3. **Deprecated header** `BezierUtilities.h` should be replaced with `Curves/BezierUtilities.h`.
4. **Deprecated plugin dependency**: Plugin 'AesWorld' depends on plugin 'StructUtils' which was deprecated in UE 5.5.
5. **License warning**: "License not activated" from XGE build system.

## Trigger Commit

| Plugin | Commit | Message |
|--------|--------|---------|
| **AesWorld** | 5e33587 | 新增AesWorldInsights性能分析模块，重构ProducerGraph接口 |
