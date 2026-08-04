## Diagnosis: C1085 (fatal error) -- Disk Space Exhaustion on Build Agent

**Primary Error**: `fatal error C1085: Cannot write precompiled header file: '...SharedPCH.Engine.Project.ValApi.Cpp20.h.pch': There is not enough space on the disk.`
**Root Cause**: The Jenkins build agent's disk (D: drive on `ws_twe_ue5.5_ci`) ran out of space during compilation. The MSVC compiler could not write precompiled header (.pch) files, which are typically 200-500MB each. Four separate PCH compilations all failed with the same C1085 error.
**Confidence**: High
**Error Type**: Infrastructure (no code fix possible)

### Error Details

4 instances of the same error, all during PCH generation at compilation step 250-253 of 568:

1. `SharedPCH.Engine.Project.ValApi.Cpp20.cpp` -> C1085 disk full
2. `SharedPCH.Engine.Project.NonOptimized.Exceptions.ValApi.Cpp20.cpp` -> C1085 disk full
3. `SharedPCH.Engine.Project.NonOptimized.ValApi.Cpp20.cpp` -> C1085 disk full
4. `SharedPCH.Engine.Project.RTTI.Exceptions.ValApi.Cpp20.cpp` -> C1085 disk full

UBT exited with ExitCode=6. Build result: FAILURE.

### Evidence

- **Knowledge base**: Match found. Build #3879 is already catalogued as `failure:infra:disk-full-C1085` in analyzed-builds.json. A previous scratch knowledge entry (027) scored 5/10 and was not promoted because C1085 disk-full is a generic infrastructure issue, not UE5-specific. The knowledge base also records #3881 as the same disk-full failure.
- **Epic guidance**: Skipped -- infrastructure error (disk space exhaustion), not related to UE5 APIs or engine code. Epic query would provide no useful information.
- **Source context**: Skipped -- no code to read. The error is in the build infrastructure, not in any source file.
- **Web search**: Skipped -- well-known MSVC error code with obvious cause (insufficient disk space).

### Build Context

- **Job**: aes6-ue-runtime-ci (autoci)
- **Build**: #3879 (FAILURE)
- **Duration**: ~26 minutes (1,567,566 ms)
- **Started by**: tonghu
- **Platform**: Windows (Win64, x64, Development)
- **Previous build**: #3878 (SUCCESS)
- **Next builds**: #3881 (FAILURE, same disk-full issue), #3883 (SUCCESS)

The failure is transient -- build #3878 immediately before succeeded, and build #3883 after the disk was cleaned up also succeeded. Builds #3879 and #3881 both failed with the identical disk-full error, indicating the disk filled up between #3878 and #3879 and was cleaned before #3883.

### Recommended Action

This is NOT a code error. No code fix is needed or possible. The resolution is operational:

1. **Immediate**: Clean up disk space on the Jenkins build agent (delete old build intermediates, old PCH files, previous build artifacts)
2. **Already resolved**: Build #3883 succeeded, confirming the disk space issue was already addressed
3. **Prevention**: Configure Jenkins to periodically clean workspace intermediates (`Intermediate/Build/`) between builds, or add a pre-build step to check available disk space and abort early with a clear message if below threshold (e.g., 50GB free required for UE5 PCH generation)

### References

- Knowledge base: `analyzed-builds.json` entry for autoci#3879 (`failure:infra:disk-full-C1085`)
- MSVC C1085 documentation: Fatal error indicating insufficient disk space to write output file
