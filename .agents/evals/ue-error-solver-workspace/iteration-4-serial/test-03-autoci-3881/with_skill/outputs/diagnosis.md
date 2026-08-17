## Diagnosis: C1085 (fatal error) in SharedPCH.Engine.Project (Package Build Stage)

**Build**: aes6-ue-runtime-ci #3881
**URL**: http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/3881/
**Result**: FAILURE
**Duration**: ~550 seconds
**Date**: 2026-03-24

**Primary Error**: `fatal error C1085: Cannot write precompiled header file: '...SharedPCH.Engine.Project.*.pch': There is not enough space on the disk.`
**Error Classification**: Infrastructure error (disk space exhaustion)
**Root Cause**: The CI build agent (twe_autoci) ran out of disk space on drive D: during the Package Project stage. The first stage (Editor Build, 918 compilation steps) completed successfully, but the second stage (BuildCookRun for TWE Win64 Development, 568 steps) failed at steps 250-253 when MSVC attempted to write precompiled header (.pch) files.
**Confidence**: High

### Error Details

Four identical C1085 errors occurred in rapid succession during PCH generation:

1. `SharedPCH.Engine.Project.RTTI.Exceptions.ValApi.Cpp20.cpp` -> `.pch` write failed
2. `SharedPCH.Engine.Project.NonOptimized.ValApi.Cpp20.cpp` -> `.pch` write failed
3. `SharedPCH.Engine.Project.ValApi.Cpp20.cpp` -> `.pch` write failed
4. `SharedPCH.Engine.Project.NonOptimized.Exceptions.ValApi.Cpp20.cpp` -> `.pch` write failed

All errors are the same root cause: disk full. PCH files for UE5 Engine modules are typically 200-400MB each, and four were being compiled in parallel, requiring ~1-1.6GB of free space that was not available.

Build result: `Rebuild All: 0 succeeded, 1 failed, 0 skipped` -> `ExitCode=6` -> `BUILD FAILED`

### Build Pipeline Summary

| Stage | Result | Details |
|-------|--------|---------|
| Prepare | OK | Robocopy tools, Git checkout |
| Editor Build (TWEEditor) | OK | 918/918 steps, 352s, ExitCode=0 |
| Package Project (TWE Win64 Development) | FAILED | 250/568 steps, C1085 disk full, 41s, ExitCode=6 |

### Evidence

- **Knowledge base**: This build is already catalogued in `analyzed-builds.json` as `failure:infra:disk-full-C1085`. The knowledge base intentionally scored C1085 at 6.5/10 and did not promote it to the details directory because it is a generic infrastructure issue, not specific to UE5. Build #3879 (same job) had the identical disk space failure.
- **Epic guidance**: Skipped -- infrastructure error, not a UE5 API/compilation issue. Epic's assistant cannot help with CI agent disk space problems.
- **Source context**: Skipped -- no code changes needed; the error is in the build environment, not in source code.
- **Web search**: Skipped -- well-understood infrastructure failure with clear root cause.

### Recommended Fix

This is NOT a code issue. No source code changes are needed. The fix is operational:

1. **Immediate**: Free disk space on the `twe_autoci` build agent's D: drive. Check `D:\ws_twe_ue5.5_ci\Project\Intermediate\` for stale build artifacts that can be cleaned.
2. **Verify**: Build #3883 (the next successful build on this job) confirms the issue was transient -- once disk space was available, the build succeeded.
3. **Prevention**:
   - Add a pre-build disk space check to the Jenkins pipeline (e.g., fail fast if < 10GB free on D:)
   - Set up periodic cleanup of `Intermediate\Build\` directories on CI agents
   - Monitor disk usage on CI agents with alerts at 85-90% capacity
   - Consider whether both Editor Build and Package Build need to run on the same workspace, as they both generate large PCH files

### References

- Knowledge base entry: `analyzed-builds.json` key `wdp-ue/job/Earth/job/aes6-ue-runtime-ci#3881` = `failure:infra:disk-full-C1085`
- MSVC C1085 documentation: https://learn.microsoft.com/en-us/cpp/error-messages/compiler-errors-1/fatal-error-c1085
- Next successful build: #3883 (confirms transient disk space issue)
