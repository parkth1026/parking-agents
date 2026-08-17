# Diagnosis: UBT Missing Precompiled Manifest for TraceAnalysis

> **Build**: aes6-ue-runtime-ci [#3939](http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/)
> **Result**: FAILURE (ExitCode=6)
> **Date**: 2026-04-07
> **Triggered by**: GitLab push by xiongxiong

---

## Primary Error

```
Missing precompiled manifest for 'TraceAnalysis', 'D:\Epic\UE_5.5_51\Engine\Intermediate\Build\Win64\UnrealGame\Development\TraceAnalysis\TraceAnalysis.precompiled.
This module can not be referenced in a monolithic precompiled build, remove this reference or migrate to a fully compiled source build.
This module was most likely not flagged during a release for being included in a precompiled build - set 'PrecompileForTargets = PrecompileTargetsType.Any;' in TraceAnalysis.Build.cs to override.
Dependent modules 'AesWorldInsights TraceServices'
```

**Error Classification**: UBT (UnrealBuildTool) module dependency error
**Failed Stage**: Package Project (BuildCookRun -- TWE Win64 Development Game target)
**Note**: The Editor build (TWEEditor) succeeded. The failure occurred only in the Game/Runtime packaging step.

---

## Root Cause

**Confidence**: High

Commit `5e33587` ("新增AesWorldInsights性能分析模块，重构ProducerGraph接口") on the AesWorld plugin introduced a new module called **AesWorldInsights** that declared dependencies on two engine modules:

1. **TraceAnalysis** -- part of UE5's Unreal Insights trace analysis framework
2. **TraceServices** -- the trace service infrastructure module

Both of these engine modules are **Editor/Program-only** modules. They are NOT compiled or distributed for Game targets in installed/precompiled engine builds. When the CI pipeline ran the packaging step (BuildCookRun for TWE Win64 Development), UBT attempted to build the Game target in a monolithic precompiled configuration and could not find the precompiled `.lib` for TraceAnalysis, causing ExitCode=6.

**Why the Editor build passed**: Editor builds include all developer modules. The missing precompiled manifest only manifests when building the Game target, which strips editor-only modules.

**Build pipeline sequence**:
1. `RunUAT.bat BuildTarget -Target=Editor -Platform=Win64 -Configuration=Development` -- **PASSED** (ExitCode=0, 200.83s)
2. `RunUAT.bat BuildCookRun -project=TWE.uproject -targetplatform=Win64 -clientconfig=Development -build -cook -stage -archive -package` -- **FAILED** (ExitCode=6, 2.59s)

---

## Evidence

### Knowledge Base

**Direct match found**: `autoci-3939-UBT-TraceAnalysisPrecompiledManifest.md`

The knowledge base contains a verified entry for this exact build, documenting:
- The root cause (AesWorldInsights module depending on editor-only TraceAnalysis/TraceServices)
- The fix (commit `8894ec3` -- splitting the module into AesWorldProfiling (Runtime) and AesWorldInsights (standalone Program))
- The subsequent fix was already applied in build #3940 which succeeded

**Related entries**:
- `linux-466-Wdelete-incomplete-FAesTracePayloadScope.md` -- a cascading error from the same module split fix, where incomplete type stubs caused clang `-Wdelete-incomplete` errors on Linux
- `installed-469-C7568-TraceSessionController.md` -- additional compilation errors in the installed build pipeline from the same module restructuring

### Epic Official Guidance

**Query**: "Missing precompiled manifest for TraceAnalysis when building Game target in installed engine"

**Key points from Epic's response**:
- TraceAnalysis is part of UE5's Trace/Unreal Insights framework and is distributed as an **editor/developer module only**, not for runtime/shipping game targets
- Installed Engine setups only include modules needed by the game; editor-only modules do NOT have precompiled binaries for Game builds
- The proper solution is to **split the plugin into Runtime and Editor modules**:
  - Runtime module: gameplay code, no TraceAnalysis dependency
  - Editor module (Type: "Editor"): profiling/analysis code, can safely depend on TraceAnalysis
- Use `#if WITH_EDITOR` guards for any shared code that references trace logic
- Use `UE_TRACE_CHANNEL` macros from `TraceLog` (which IS available at runtime) for event emission, NOT `TraceAnalysis` (which is for consuming/analyzing logs)

**References**:
- [Trace Developer Guide](https://dev.epicgames.com/documentation/unreal-engine/developer-guide-to-tracing-in-unreal-engine)
- [Unreal Insights Reference](https://dev.epicgames.com/documentation/unreal-engine/unreal-insights-reference-in-unreal-engine-5)
- [Modules - Overview and Structure](https://dev.epicgames.com/community/learning/knowledge-base/GDD9/unreal-engine-modules-overview-and-structure)
- [Editor Modules](https://dev.epicgames.com/documentation/unreal-engine/setting-up-editor-modules-for-customizing-the-editor-in-unreal-engine)

### Source Code Context

The fix has already been applied to the AesWorld repository. The current state shows:
- `AesWorldInsights` module no longer exists as a Build.cs in the source tree
- No Build.cs files in D:\Git\AesWorld reference TraceAnalysis or TraceServices
- The module was split into `AesWorldProfiling` (Runtime, no trace dependency) and a standalone `Tests/AesWorldInsights` (Program target with its own .Target.cs)

---

## Recommended Fix

The fix was already applied in build #3940. The approach taken was the correct one:

1. **Split the module** into two parts:
   - **AesWorldProfiling** (Runtime module) -- contains trace recording code. Does NOT depend on TraceAnalysis/TraceServices. Safe for Game targets.
   - **Tests/AesWorldInsights** (standalone Program target) -- contains offline analysis code. Depends on TraceAnalysis/TraceServices. Built as a separate executable, never linked into the Game target.

2. **Key file changes** (commit `8894ec3` by xiongxing):
   - `AesWorld.uplugin`: replaced AesWorldInsights module entry with AesWorldProfiling
   - `AesWorldProfiling.Build.cs`: new Build.cs without TraceAnalysis dependency
   - `Tests/AesWorldInsights/AesWorldInsights.Build.cs`: standalone program with TraceAnalysis dependency
   - `Tests/AesWorldInsights/AesWorldInsights.Target.cs`: new .Target.cs for the standalone program
   - Runtime trace recording moved to `Source/AesWorldProfiling/`
   - Offline analysis moved to `Tests/AesWorldInsights/`

---

## Additional Warnings (non-blocking)

The Editor build phase produced several deprecation warnings that should be addressed:

1. **C4996: BezierUtilities.h deprecated** -- file moved to `Curves/BezierUtilities.h`
   - File: `D:\Epic\UE_5.5_51\Engine\Plugins\Runtime\ZoneGraph\Source\ZoneGraph\Public\BezierUtilities.h`

2. **C4996: Sort deprecated** -- use `Algo::Sort` instead
   - File: `AesWorld\Source\AesRenderResource\Private\Traffic\EarthZoneGraphBVTree.cpp(77)`

3. **C4996: FSelectedOjectsChangeList deprecated** -- use `FSelectedObjectsChangeList` (typo fix)
   - File: `AesWorld\Source\EarthModeler\Private\Utils\EarthModelerSelectionUtil.cpp` (lines 8, 17, 28)

4. **StructUtils plugin deprecated** -- AesWorld depends on StructUtils which was deprecated in UE5.5

5. **License not activated** -- build system warning

---

## Prevention

- Never add `TraceAnalysis` or `TraceServices` as dependencies for Runtime or Game modules in installed/precompiled engine builds -- these are Editor/Program-only engine modules
- When creating profiling/analysis features, split them into a Runtime recording module (no analysis dependencies) and a separate Program target for offline analysis
- Test new modules against both Editor AND Game build targets before merging
- Use `UE_TRACE_CHANNEL` macros from `TraceLog` for runtime event emission; reserve `TraceAnalysis` for editor-only analysis tools
