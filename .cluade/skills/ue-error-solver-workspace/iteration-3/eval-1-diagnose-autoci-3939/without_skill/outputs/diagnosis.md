# Build #3939 Failure Diagnosis

## Build Info
- **Job**: aes6-ue-runtime-ci #3939
- **URL**: http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/
- **Trigger**: GitLab push by **xiongxiong**
- **Engine**: UE 5.5 (D:\Epic\UE_5.5_51) - precompiled/installed build
- **Result**: FAILURE (ExitCode=6)
- **Duration**: ~4 minutes 40 seconds
- **Failed Stage**: Package Project (BuildCookRun)

## Root Cause

**Missing precompiled manifest for engine module `TraceAnalysis`** when building the **runtime (non-editor) target `TWE`**.

The new module **`AesWorldInsights`** (introduced in AesWorld plugin commit `5e33587`) depends on `TraceServices`, which in turn depends on the engine module `TraceAnalysis`. The `TraceAnalysis` module does not have a precompiled manifest available for the runtime/game target in the installed (precompiled) UE 5.5 engine build.

### Key Error Messages

```
Missing precompiled manifest for 'TraceAnalysis', 'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled.
This module can not be referenced in a monolithic precompiled build, remove this reference or migrate to a fully compiled source build.

This module was most likely not flagged during a release for being included in a precompiled build - set 'PrecompileForTargets = PrecompileTargetsType.Any;' in TraceAnalysis.Build.cs to override.

Dependent modules 'AesWorldInsights TraceServices'
```

### Why Editor Build Succeeded but Runtime Failed

- The **Editor build** (`TWEEditor`, Win64, Development) succeeded (ExitCode=0) because editor builds are **modular** (DLL-based), and `TraceAnalysis` has precompiled binaries available for the editor target type.
- The **Runtime/Package build** (`TWE`, Win64, Development via BuildCookRun) failed because runtime builds are **monolithic** (statically linked), and `TraceAnalysis` was not flagged for inclusion in precompiled monolithic builds. The engine's installed build simply does not ship `TraceAnalysis.precompiled` for the `UnrealGame` target.

## Offending Commit

- **Plugin**: AesWorld
- **Commit**: `5e33587` - "新增AesWorldInsights性能分析模块，重构ProducerGraph接口" (Add AesWorldInsights performance analysis module, refactor ProducerGraph interface)
- **Author**: xiongxiong

The newly added `AesWorldInsights` module declares a dependency on `TraceServices`, which pulls in `TraceAnalysis` -- an engine module not available for runtime/game targets in a precompiled engine.

## Recommended Fixes

### Option 1: Remove the TraceServices/TraceAnalysis dependency for runtime builds (Recommended)
In `AesWorldInsights.Build.cs`, conditionally include the `TraceServices` dependency only for editor builds:

```csharp
if (Target.Type == TargetType.Editor)
{
    PrivateDependencyModuleNames.Add("TraceServices");
    PrivateDependencyModuleNames.Add("TraceAnalysis");
}
```

And wrap any code using Trace APIs with `#if WITH_EDITOR` preprocessor guards.

### Option 2: Move AesWorldInsights to editor-only module
If the performance analysis/insights functionality is only needed in the editor, mark `AesWorldInsights` as an editor-only module by setting `Type = ModuleType.Editor` in the `.uplugin` descriptor. This way it won't be included in runtime builds at all.

### Option 3: Rebuild the engine from source with TraceAnalysis enabled for game targets
Set `PrecompileForTargets = PrecompileTargetsType.Any;` in the engine's `TraceAnalysis.Build.cs` and rebuild the engine. This is the most invasive option and requires maintaining a custom engine build.

## Additional Warnings (Non-blocking)

1. **Deprecated plugin dependency**: Plugin 'AesWorld' depends on plugin 'StructUtils' which was deprecated in UE 5.5 and will be removed soon. Update dependencies.
2. **Deprecated API usage**: `FSelectedOjectsChangeList` in `EarthModelerSelectionUtil.cpp` line 28 -- use `FSelectedObjectsChangeList` instead.
