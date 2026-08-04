# Diagnosis: fatal error C1085 in SharedPCH.Engine.Project (Build #3881)

**Job**: aes6-ue-runtime-ci #3881
**URL**: http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3881/
**Result**: FAILURE
**Duration**: 550 seconds (~9 minutes)
**Node**: twe_autoci
**Triggered by**: piaotonghu
**Date**: 2026-03-24

---

## Primary Error

**Error Code**: fatal error C1085
**Error Message**: Cannot write precompiled header file: 'SharedPCH.Engine.Project.RTTI.Exceptions.ValApi.Cpp20.h.pch': There is not enough space on the disk.
**Classification**: Infrastructure Error (Disk Space Exhaustion)
**Confidence**: High

### Error Details

The build failed during the **Package Project** stage (BuildCookRun, TWE Win64 Development). Four identical C1085 errors occurred in rapid succession at build steps 250-253 out of 568:

```
[250/568] Compile [x64] SharedPCH.Engine.Project.RTTI.Exceptions.ValApi.Cpp20.cpp (0:35.64 at +0:00)
fatal error C1085: Cannot write precompiled header file: '...SharedPCH.Engine.Project.RTTI.Exceptions.ValApi.Cpp20.h.pch': There is not enough space on the disk.

[251/568] Compile [x64] SharedPCH.Engine.Project.NonOptimized.ValApi.Cpp20.cpp (0:35.64 at +0:00)
fatal error C1085: Cannot write precompiled header file: '...SharedPCH.Engine.Project.NonOptimized.ValApi.Cpp20.h.pch': There is not enough space on the disk.

[252/568] Compile [x64] SharedPCH.Engine.Project.ValApi.Cpp20.cpp (0:35.65 at +0:00)
fatal error C1085: Cannot write precompiled header file: '...SharedPCH.Engine.Project.ValApi.Cpp20.h.pch': There is not enough space on the disk.

[253/568] Compile [x64] SharedPCH.Engine.Project.NonOptimized.Exceptions.ValApi.Cpp20.cpp (0:35.65 at +0:00)
fatal error C1085: Cannot write precompiled header file: '...SharedPCH.Engine.Project.NonOptimized.Exceptions.ValApi.Cpp20.h.pch': There is not enough space on the disk.
```

All four errors are compiling **Shared Precompiled Header (PCH)** files for the Engine, which are the largest compilation artifacts. PCH files for UE5 Engine modules typically range 200-500MB each, so attempting to write 4 simultaneously would require significant free disk space.

### Build Pipeline Context

The pipeline has the following stages:
1. **Prepare** - OK
2. **Pull Plugins** - OK (AesArtAsset, ArtCommon, EarthArtAsset, WdpCamera, AesWorld, AesRuntime)
3. **Clean Build** - OK
4. **Pull Project** - OK
5. **Build Project** (Editor target, TWEEditor) - **SUCCEEDED** (918/918 steps, ExitCode=0, ~352s)
6. **Package Project** (Game target, TWE Win64 Development) - **FAILED** at step 250/568 (ExitCode=6, ~41s before failure)
7. Auto Test - Skipped
8. Archive - Skipped

The Editor build completed successfully (all 918 steps), consuming a large amount of disk space for its intermediate files. When the Package build started immediately afterward, the Intermediate directory for the game target needed to write new PCH files, but the disk was already near capacity from the Editor build artifacts.

## Root Cause

The D:\ drive on CI node `twe_autoci` ran out of disk space. The Editor build (TWEEditor, 918 steps) completed successfully but consumed all available space. When the Package build (TWE Win64 Development, 568 steps) attempted to write its own set of precompiled headers at step 250, the disk had no remaining capacity.

Precompiled headers (PCH) are the largest compilation artifacts in UE5 builds. The Engine SharedPCH files (e.g., SharedPCH.Engine.Project.*.pch) can easily be 200-500MB each. With 8 parallel compilation processes and multiple PCH variants (RTTI, NonOptimized, Exceptions combinations), the disk space demand at this point in the build is extremely high.

## Evidence

- **Knowledge Base**: This is a known recurring infrastructure issue on this CI pipeline. Build #3879 (same job) and twe-ue5.5-installed #395 both failed with the identical C1085 disk-full pattern. The knowledge base explicitly classifies this as `failure:infra:disk-full-C1085`. The next build #3883 succeeded, indicating the disk space was reclaimed between builds.
- **Epic Guidance**: N/A -- This is an infrastructure/environment issue, not a UE5 API or compilation logic problem. No Epic query needed.
- **Source Context**: N/A -- No code changes caused this failure. The Editor build compiled all 918 steps successfully with no code errors.
- **Web Search**: N/A -- This is a well-understood MSVC error with a straightforward cause.

## Recommended Actions

This is **not a code error** -- no code fix is needed or possible. The recommended actions are all infrastructure-level:

1. **Immediate**: Re-trigger the build. Build #3883 already succeeded after this failure, confirming the issue is transient.
2. **Clean Intermediate Files**: Add a cleanup step between the Editor and Package builds to delete `D:\ws_twe_ue5.5_ci\Project\Intermediate\Build\` before starting the Package build. The two builds produce separate intermediate artifacts and do not share PCH files.
3. **Increase Disk Space**: The `twe_autoci` node's D:\ drive is undersized for running both Editor and Package builds in the same workspace. Consider:
   - Expanding the D:\ drive
   - Moving the build workspace to a larger volume
   - Using separate workspace roots for Editor vs Package builds
4. **Workspace Cleanup Pipeline**: Implement a periodic Jenkins job to clean old build artifacts, packages, and intermediate files on CI nodes.
5. **Disk Space Monitoring**: Add a pre-build check that verifies minimum free disk space (e.g., 50GB) before starting the build, failing fast with a clear message instead of wasting time on a build destined to fail.

## References

- MSVC fatal error C1085: https://learn.microsoft.com/en-us/cpp/error-messages/compiler-errors-1/fatal-error-c1085
- Knowledge base entry: `analyzed-builds.json` records this build as `failure:infra:disk-full-C1085`
- Related failures: aes6-ue-runtime-ci #3879 (same error), twe-ue5.5-installed #395 (same error)
- Recovery: aes6-ue-runtime-ci #3883 (succeeded after disk space recovered)
