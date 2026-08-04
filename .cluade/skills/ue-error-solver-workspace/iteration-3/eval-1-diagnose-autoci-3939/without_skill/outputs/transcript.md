# Transcript: Diagnosing Jenkins Build #3939

## Task
Diagnose why Jenkins build http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/ failed.

## Step 1: Fetch Build Metadata

**Action**: Used `curl.exe` to query the Jenkins JSON API at:
```
http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3939/api/json?pretty=true
```

**Findings**:
- Build class: WorkflowRun
- Trigger: GitLab push by user "xiongxiong"
- Engine: UE 5.5 (D:\Epic\UE_5.5_51) - installed/precompiled build
- Target platform: Windows (Win64)
- Package command args: `-clientconfig=Development -nocompileeditor -nop4 -pak -cook -stage -archive -package -compressed -prereqs -build -utf8output`
- Multiple plugins pulled from GitLab repos (AesArtAsset, ArtCommon, EarthArtAsset, WdpCamera, AesWorld, AesRuntime, AesTilesEditor, SkyCreatorPlugin, WdpEnvironment)

## Step 2: Fetch Build Result Summary

**Action**: Queried `api/json?tree=result,duration,timestamp,displayName`

**Findings**:
- Result: **FAILURE**
- Duration: 279,701 ms (~4 min 40 sec)
- Display name: #3939

## Step 3: Download Console Log

**Action**: Downloaded full console log from `/consoleText` endpoint.

**Result**: 94,368 bytes, saved to `console.log`.

## Step 4: Search for Errors in Log

**Action**: Searched for patterns `error|Error|ERROR|fatal|FATAL` and `FAILURE|failed|Failed`.

**Key findings**:
- Line 1708: `Missing precompiled manifest for 'TraceAnalysis'`
- Line 1714: `UnrealBuildTool failed. See log for more details.`
- Line 1713: `ExitCode=6`
- Line 1757: `ERROR: Package project failed.`
- Line 1758: `Finished: FAILURE`
- Line 1659: Editor build: `Rebuild All: 1 succeeded, 0 failed, 0 skipped` (editor was fine)

## Step 5: Analyze the Error Context (Lines 1690-1718)

**Action**: Read the Package Project stage in detail.

**Findings**:
The runtime build (`TWE Win64 Development` via BuildCookRun) failed at UnrealBuildTool stage:

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

## Step 6: Trace the Dependency Chain

**Action**: Searched for `TraceAnalysis`, `TraceServices`, and `AesWorldInsights` across the log.

**Findings**:
- `AesWorldInsights` is a new module added in AesWorld plugin commit `5e33587` ("新增AesWorldInsights性能分析模块，重构ProducerGraph接口")
- `AesWorldInsights` compiled successfully in the **editor** build (lines 1546-1550)
- The dependency chain: `AesWorldInsights` -> `TraceServices` -> `TraceAnalysis`
- `TraceAnalysis` is an engine module that does NOT have precompiled binaries for the `UnrealGame` (runtime) target in the installed UE 5.5 build
- The editor build is modular (DLL-based), so precompiled status for UnrealGame doesn't matter
- The runtime/package build is monolithic (statically linked), so it needs `TraceAnalysis.precompiled` manifest which doesn't exist

## Step 7: Verify Editor Build Success

**Action**: Read lines 1640-1669 to confirm the editor build stage.

**Findings**:
- Editor build completed: `Rebuild All: 1 succeeded, 0 failed, 0 skipped`
- Editor build exit code: 0 (Success)
- Time: 200.83 seconds
- Warnings present but non-fatal: deprecated `StructUtils` dependency, deprecated `FSelectedOjectsChangeList` API

## Step 8: Identify the Offending Commit

**Action**: Read the AesWorld plugin checkout section (lines 370-384).

**Findings**:
- AesWorld commit: `5e33587` by xiongxiong
- Message: "新增AesWorldInsights性能分析模块，重构ProducerGraph接口"
- This commit introduced the `AesWorldInsights` module which has the problematic `TraceServices` dependency

## Conclusion

The build failed because the newly added `AesWorldInsights` module depends on `TraceServices`/`TraceAnalysis`, which are engine modules not available for runtime (monolithic) builds in the precompiled UE 5.5 engine. The editor build succeeded because it uses modular (DLL) linking where this restriction doesn't apply.

**Fix**: Either make the TraceServices dependency editor-only, make AesWorldInsights an editor-only module, or rebuild the engine with TraceAnalysis enabled for game targets.
